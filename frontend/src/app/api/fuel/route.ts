// src/app/api/fuel/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { supabaseServer } from "../../../lib/supabaseServer";
import type {
  FuelOutput,
  FuelRequest,
  FuelHistoryResponse,
  FuelAnalyzeResponse,
} from "../../../lib/fuelTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/** -----------------------------
 *  Zod request schemas
 *  KEY FIX: use .partial().default({}) for object defaults
 *  ---------------------------- */
const FighterSchema = z
  .object({
    age: z.string(),
    currentWeight: z.string(),
    targetWeight: z.string(),
    bodyType: z.string(),
    paceStyle: z.string(),
  })
  .partial()
  .default({});

const TrainingSchema = z
  .object({
    session: z.string(),
    intensity: z.string(),
    goal: z.string(),
    fightWeek: z.boolean(),
    timeOfTraining: z.string(),
  })
  .partial()
  .default({});

const AnalyzeSchema = z.object({
  mode: z.literal("analyze"),
  meals: z.string().min(1, "Missing meals text"),
  fighter: FighterSchema,
  training: TrainingSchema,
});

const RefineSchema = z.object({
  mode: z.literal("refine"),
  followups_id: z.string().min(1, "Missing followups_id"),
  answers: z.record(z.string(), z.string()).default({}),
});

const HistorySchema = z.object({
  mode: z.literal("history"),
  limit: z.number().int().min(1).max(30).optional().default(8),
});

function schemaForFuelOutput() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      rating: { type: "string", enum: ["CLEAN", "MID", "TRASH"] },
      score: { type: "number" },
      score_reason: { type: "string" },
      macros: {
        type: "object",
        additionalProperties: false,
        properties: {
          calories_kcal_range: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
          },
          protein_g_range: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
          },
          carbs_g_range: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
          },
          fat_g_range: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
          },
        },
        required: [
          "calories_kcal_range",
          "protein_g_range",
          "carbs_g_range",
          "fat_g_range",
        ],
      },
      macro_confidence: {
        type: "object",
        additionalProperties: false,
        properties: {
          calories: { type: "string", enum: ["low", "med", "high"] },
          protein: { type: "string", enum: ["low", "med", "high"] },
          carbs: { type: "string", enum: ["low", "med", "high"] },
          fat: { type: "string", enum: ["low", "med", "high"] },
        },
        required: ["calories", "protein", "carbs", "fat"],
      },
      confidence: { type: "string", enum: ["low", "med", "high"] },
      report: { type: "string" },
      questions: {
        type: "array",
        items: { type: "string" },
        minItems: 0,
        maxItems: 3,
      },
      followups_id: { type: "string" },
    },
    required: [
      "rating",
      "score",
      "score_reason",
      "macros",
      "macro_confidence",
      "confidence",
      "report",
      "questions",
      "followups_id",
    ],
  } as const;
}

function buildFuelSystemRules() {
  return [
    "You are Fuel AI for fighters.",
    "Output JSON ONLY matching the provided schema.",
    "",
    "Non-negotiables:",
    "- Be strict and useful, not short.",
    "- Always provide: score (0–100), rating (CLEAN/MID/TRASH), macros as RANGES, and macro_confidence per macro.",
    "- Ask 1–3 follow-up questions when portions/ingredients/timing are unclear. Otherwise 0 questions.",
    "",
    "Fight week logic:",
    "- If fightWeek=true, prioritize: low fiber near weigh-in, sodium/water manipulation caution, predictable foods, no GI surprises, carb timing, and avoid risky new foods.",
    "- Mention weigh-in vs fight-day fueling differences.",
    "",
    "Report structure (in report string):",
    "1) Summary (1–2 lines) + rating/score meaning",
    "2) Macro estimate ranges + why (include uncertainty drivers)",
    "3) Performance impact (training goal + session/intensity)",
    "4) Fixes (2–5 concrete upgrades) with exact swaps/amounts/timing",
    "5) Fight week notes (only if fightWeek=true)",
    "6) If questions exist: list them clearly at the end",
  ].join("\n");
}

function buildAnalyzePrompt(meals: string, fighter: any, training: any, followupsId: string) {
  return [
    buildFuelSystemRules(),
    "",
    `FOLLOWUPS_ID: ${followupsId}`,
    "",
    "FIGHTER (may be empty):",
    JSON.stringify(fighter ?? {}, null, 2),
    "",
    "TRAINING (may be empty):",
    JSON.stringify(training ?? {}, null, 2),
    "",
    "MEALS TEXT:",
    meals.trim(),
    "",
    "TASK:",
    "- Infer likely ingredients + portions from text (no hallucinated brands).",
    "- Output full JSON.",
  ].join("\n");
}

function buildRefinePrompt(prior: any, answers: Record<string, string>) {
  return [
    buildFuelSystemRules(),
    "",
    "You previously generated this Fuel result (JSON):",
    JSON.stringify(prior, null, 2),
    "",
    "The user answered your questions (question -> answer):",
    JSON.stringify(answers, null, 2),
    "",
    "TASK:",
    "- Update macros ranges, confidence, score, and report using these answers.",
    "- Keep the SAME followups_id.",
    "- If still unclear, you may ask up to 2 new questions max (only if truly necessary).",
  ].join("\n");
}

function safeJsonParse<T>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return { ok: false, error: "Model output was not valid JSON." };
  }
}

function getOutputText(resp: any): string {
  // SDKs vary; this keeps it robust.
  return String(resp?.output_text ?? resp?.outputText ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const sb = await supabaseServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as FuelRequest | null;
    if (!body || typeof body !== "object" || !("mode" in body)) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    // -------------------------
    // HISTORY
    // -------------------------
    if (body.mode === "history") {
      const parsed = HistorySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
      }

      const limit = parsed.data.limit ?? 8;

      const { data, error } = await sb
        .from("fuel_reports")
        .select("created_at, score")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      const points = (data ?? []).map((r: any) => {
        const d = new Date(r.created_at);
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`;
        return { day, fuel_score: typeof r.score === "number" ? r.score : null };
      });

      const resp: FuelHistoryResponse = { ok: true, points };
      return NextResponse.json(resp);
    }

    // -------------------------
    // REFINE
    // -------------------------
    if (body.mode === "refine") {
      const parsed = RefineSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
      }

      const followupsId = parsed.data.followups_id;

      const { data: priorRow, error: priorErr } = await sb
        .from("fuel_reports")
        .select("*")
        .eq("user_id", user.id)
        .eq("followups_id", followupsId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (priorErr || !priorRow) {
        return NextResponse.json(
          { ok: false, error: "Could not find prior Fuel report for that followups_id." },
          { status: 404 }
        );
      }

      const prompt = buildRefinePrompt(
        {
          rating: priorRow.rating,
          score: priorRow.score,
          score_reason: priorRow.score_reason,
          macros: {
            calories_kcal_range: priorRow.calories_kcal_range,
            protein_g_range: priorRow.protein_g_range,
            carbs_g_range: priorRow.carbs_g_range,
            fat_g_range: priorRow.fat_g_range,
          },
          macro_confidence: priorRow.macro_confidence,
          confidence: priorRow.confidence,
          report: priorRow.report,
          questions: priorRow.questions,
          followups_id: priorRow.followups_id,
        },
        parsed.data.answers
      );

      const resp = await openai.responses.create({
        model: "gpt-5.1",
        input: [
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "fuel_output",
            schema: schemaForFuelOutput(),
            strict: true,
          },
        },
      });

      const raw = getOutputText(resp);
      if (!raw) {
        return NextResponse.json({ ok: false, error: "Fuel returned empty output text." }, { status: 500 });
      }

      const parsedJson = safeJsonParse<FuelOutput>(raw);
      if (!parsedJson.ok) {
        return NextResponse.json({ ok: false, error: parsedJson.error, raw }, { status: 500 });
      }

      const out = parsedJson.value;

      await sb.from("fuel_reports").insert({
        user_id: user.id,
        mode: "refine",
        followups_id: out.followups_id,
        rating: out.rating,
        score: Math.round(out.score),
        score_reason: out.score_reason,

        calories_kcal_range: out.macros.calories_kcal_range,
        protein_g_range: out.macros.protein_g_range,
        carbs_g_range: out.macros.carbs_g_range,
        fat_g_range: out.macros.fat_g_range,

        macro_confidence: out.macro_confidence,
        confidence: out.confidence,
        report: out.report,
        questions: out.questions,
        source: "fuel",
      });

      const okResp: FuelAnalyzeResponse = { ok: true, ...out };
      return NextResponse.json(okResp);
    }

    // -------------------------
    // ANALYZE
    // -------------------------
    const parsed = AnalyzeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
    }

    const followupsId = crypto.randomUUID();

    const prompt = buildAnalyzePrompt(parsed.data.meals, parsed.data.fighter, parsed.data.training, followupsId);

    const resp = await openai.responses.create({
      model: "gpt-5.1",
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "fuel_output",
          schema: schemaForFuelOutput(),
          strict: true,
        },
      },
    });

    const raw = getOutputText(resp);
    if (!raw) {
      return NextResponse.json({ ok: false, error: "Fuel returned empty output text." }, { status: 500 });
    }

    const parsedJson = safeJsonParse<FuelOutput>(raw);
    if (!parsedJson.ok) {
      return NextResponse.json({ ok: false, error: parsedJson.error, raw }, { status: 500 });
    }

    const out = parsedJson.value;

    await sb.from("fuel_reports").insert({
      user_id: user.id,
      mode: "text",
      followups_id: out.followups_id,
      rating: out.rating,
      score: Math.round(out.score),
      score_reason: out.score_reason,

      calories_kcal_range: out.macros.calories_kcal_range,
      protein_g_range: out.macros.protein_g_range,
      carbs_g_range: out.macros.carbs_g_range,
      fat_g_range: out.macros.fat_g_range,

      macro_confidence: out.macro_confidence,
      confidence: out.confidence,
      report: out.report,
      questions: out.questions,
      source: "fuel",
    });

    const okResp: FuelAnalyzeResponse = { ok: true, ...out };
    return NextResponse.json(okResp);
  } catch (err: any) {
    console.error("Fuel crashed:", err);
    return NextResponse.json({ ok: false, error: "Fuel backend crashed." }, { status: 500 });
  }
}
