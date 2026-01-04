// src/app/api/fuelPhoto/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { supabaseServer } from "../../../lib/supabaseServer";
import type { FuelOutput } from "../../../lib/fuelTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/**
 * FormData fields expected from frontend:
 * - image: File (required for FuelPhoto)
 * - ingredients: string (required)
 * - fighter: stringified JSON (optional)
 * - training: stringified JSON (optional)
 */
const FormSchema = z.object({
  ingredients: z.string().min(1, "Missing meal text (ingredients)"),
  fighter: z.string().optional(),
  training: z.string().optional(),
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
          calories_kcal_range: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
          protein_g_range: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
          carbs_g_range: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
          fat_g_range: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
        },
        required: ["calories_kcal_range", "protein_g_range", "carbs_g_range", "fat_g_range"],
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
      questions: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 3 },
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

function buildFuelPhotoRules() {
  return [
    "You are Fuel AI (photo mode) for fighters.",
    "Return JSON ONLY that matches the provided schema.",
    "",
    "Use BOTH the image and the meal text.",
    "Macros MUST be ranges (min,max).",
    "Always include: score, rating, score_reason, macros, macro_confidence, confidence, report, questions, followups_id.",
    "If portions/ingredients are unclear, ask 1–3 questions instead of pretending confidence.",
    "",
    "Fight week logic:",
    "- If fightWeek=true: mention weigh-in vs fight-day fueling, avoid GI risk, predictable foods, sodium/fiber timing cautions.",
    "",
    "Report structure:",
    "1) Summary (1–2 lines)",
    "2) What the image likely shows (brief + grounded)",
    "3) Macro ranges + why (uncertainty drivers)",
    "4) Performance impact (based on training goal/intensity)",
    "5) Fixes (2–5 upgrades with exact swaps/amounts/timing)",
    "6) Fight-week notes if relevant",
    "7) Questions (if any)",
  ].join("\n");
}

function buildPrompt(ingredients: string, fighter: any, training: any, followupsId: string) {
  return [
    buildFuelPhotoRules(),
    "",
    `FOLLOWUPS_ID: ${followupsId}`,
    "",
    "FIGHTER (may be empty):",
    JSON.stringify(fighter ?? {}, null, 2),
    "",
    "TRAINING (may be empty):",
    JSON.stringify(training ?? {}, null, 2),
    "",
    "MEAL TEXT:",
    ingredients.trim(),
    "",
    "TASK:",
    "- Ground what you infer from the image: ingredients + rough portions.",
    "- Output the FULL JSON object.",
  ].join("\n");
}

async function fileToDataURL(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  const base64 = bytes.toString("base64");
  return `data:${mime};base64,${base64}`;
}

function safeJsonParse<T>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return { ok: false, error: "Model output was not valid JSON." };
  }
}

export async function POST(req: Request) {
  try {
    // 1) Auth
    const sb = await supabaseServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    // 2) Parse form
    const form = await req.formData();
    const image = form.get("image");
    const ingredients = form.get("ingredients");
    const fighterStr = form.get("fighter");
    const trainingStr = form.get("training");

    const parsed = FormSchema.safeParse({
      ingredients: typeof ingredients === "string" ? ingredients : "",
      fighter: typeof fighterStr === "string" ? fighterStr : undefined,
      training: typeof trainingStr === "string" ? trainingStr : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
    }

    if (!(image instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing image file." }, { status: 400 });
    }

    // 3) Parse optional JSON blobs safely
    let fighter: any = {};
    let training: any = {};
    try {
      fighter = parsed.data.fighter ? JSON.parse(parsed.data.fighter) : {};
    } catch {}
    try {
      training = parsed.data.training ? JSON.parse(parsed.data.training) : {};
    } catch {}

    // 4) Prepare prompt + image
    const followupsId = crypto.randomUUID();
    const dataUrl = await fileToDataURL(image);
    const prompt = buildPrompt(parsed.data.ingredients, fighter, training, followupsId);

    /**
     * 5) Call Responses API
     *
     * IMPORTANT:
     * - Your API error showed it expects top-level input items like { type: "message" }
     * - Some OpenAI SDK TS typings vary for image content shapes
     * - This structure is the most compatible:
     *    input: [{ type:"message", role:"user", content:[...] }]
     */
    const resp = await openai.responses.create({
      model: "gpt-5.1",
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            // Most compatible shape across SDKs:
            { type: "input_image", image_url: dataUrl },
            // If your SDK insists image_url must be { url: string }, swap to:
            // { type: "input_image", image_url: { url: dataUrl } as any },
          ],
        } as any, // <- typing shield for SDK variations
      ],
      text: {
        format: {
          type: "json_schema",
          name: "fuel_photo_output",
          schema: schemaForFuelOutput(),
          strict: true,
        },
      },
    });

    // 6) Extract + parse model output
    const raw = String((resp as any).output_text ?? "").trim();
    if (!raw) {
      return NextResponse.json({ ok: false, error: "FuelPhoto returned empty output text." }, { status: 500 });
    }

    const parsedJson = safeJsonParse<FuelOutput>(raw);
    if (!parsedJson.ok) {
      return NextResponse.json({ ok: false, error: parsedJson.error, raw }, { status: 500 });
    }

    const out = parsedJson.value;

    // 7) Persist to Supabase
    const { error: insertErr } = await sb.from("fuel_reports").insert({
      user_id: user.id,
      mode: "photo",
      followups_id: out.followups_id,
      rating: out.rating,
      score: Math.round(out.score),
      score_reason: out.score_reason,
      confidence: out.confidence,
      macros: out.macros,
      macro_confidence: out.macro_confidence,
      report: out.report,
      questions: out.questions,
      source: "fuelPhoto",
    });

    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    // 8) Return to UI
    return NextResponse.json({ ok: true, ...out });
  } catch (err: any) {
    console.error("FuelPhoto crashed:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ? String(err.message) : "FuelPhoto backend crashed." },
      { status: 500 }
    );
  }
}
