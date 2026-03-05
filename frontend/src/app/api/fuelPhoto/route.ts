// src/app/api/fuelPhoto/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { supabaseServer } from "../../../lib/supabaseServer";
import type { FuelOutput } from "../../../lib/fuelTypes";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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

function systemRules() {
  return [
    "You are Fuel AI (photo mode) for fighters.",
    "Return STRICT JSON only that matches the schema. No markdown. No extra keys.",
    "Use BOTH the image and the meal text.",
    "Macros MUST be ranges.",
    "If portions/ingredients are unclear, ask 1–3 questions instead of pretending confidence.",
    "Be strict and specific. Short, coach-like report.",
  ].join("\n");
}

function buildPrompt(ingredients: string, fighter: any, training: any, followupsId: string) {
  return [
    systemRules(),
    "",
    `FOLLOWUPS_ID: ${followupsId}`,
    "",
    "FIGHTER:",
    JSON.stringify(fighter ?? {}, null, 2),
    "",
    "TRAINING:",
    JSON.stringify(training ?? {}, null, 2),
    "",
    "MEAL TEXT:",
    ingredients.trim(),
    "",
    "TASK:",
    "- Cross-check the meal text against what you can see in the photo.",
    "- If the photo conflicts with the text, say so in score_reason and lower confidence.",
    "- Output full JSON matching schema.",
  ].join("\n");
}

// Reliable extractor for Responses API outputs
function getResponseText(resp: any): string {
  const direct = String(resp?.output_text ?? "").trim();
  if (direct) return direct;

  const out = resp?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (typeof c?.text === "string" && c.text.trim()) return c.text.trim();
          const tt = c?.content?.[0]?.text;
          if (typeof tt === "string" && tt.trim()) return tt.trim();
        }
      }
    }
  }
  return "";
}

export async function POST(req: Request) {
  try {
    const sb = await supabaseServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });

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

    let fighter: any = {};
    let training: any = {};
    try {
      fighter = parsed.data.fighter ? JSON.parse(parsed.data.fighter) : {};
    } catch {}
    try {
      training = parsed.data.training ? JSON.parse(parsed.data.training) : {};
    } catch {}

    const followupsId = crypto.randomUUID();

    // ✅ Convert uploaded File -> base64 data URL (Responses API expects image_url)
    const ab = await image.arrayBuffer();
    const base64 = Buffer.from(ab).toString("base64");
    const mime = image.type || "image/webp";
    const dataUrl = `data:${mime};base64,${base64}`;

    const prompt = buildPrompt(parsed.data.ingredients, fighter, training, followupsId);

    const resp = await openai.responses.create({
      // Use whatever model you want here.
      // If your account doesn't have gpt-5.1, swap to a vision-capable model you do have.
      model: "gpt-5.1",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: dataUrl }, // ✅ correct
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "fuel_photo_output",
          schema: schemaForFuelOutput(),
          strict: true,
        },
      },
    } as any);

    const raw = getResponseText(resp);
    if (!raw) {
      return NextResponse.json({ ok: false, error: "FuelPhoto returned empty output." }, { status: 500 });
    }

    const out = JSON.parse(raw) as FuelOutput;

    await sb.from("fuel_reports").insert({
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

    return NextResponse.json({ ok: true, ...out });
  } catch (err: any) {
    const msg =
      typeof err?.message === "string"
        ? err.message
        : typeof err?.toString === "function"
        ? err.toString()
        : "FuelPhoto backend crashed.";

    console.error("FuelPhoto crashed:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}