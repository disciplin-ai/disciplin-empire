import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { supabaseServer } from "../../../lib/supabaseServer";
import type { FuelOutput } from "../../../lib/fuelTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    "Output JSON ONLY matching the provided schema.",
    "Use BOTH the image and meal text.",
    "Macros MUST be ranges.",
    "Always include: score + rating + macro_confidence per macro + strict report.",
    "If portions/ingredients are unclear, ask 1–3 questions instead of guessing with high confidence.",
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
    "- Ground what you infer from the image: ingredients + rough portions.",
    "- Output full JSON.",
  ].join("\n");
}

// Node 18+ has global File, but OpenAI files.create wants a File/Blob-like object.
// We'll create a File from the uploaded bytes.
async function toNodeFile(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const name = file.name || "meal.jpg";
  const type = file.type || "image/jpeg";
  return new File([bytes], name, { type });
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
    try { fighter = parsed.data.fighter ? JSON.parse(parsed.data.fighter) : {}; } catch {}
    try { training = parsed.data.training ? JSON.parse(parsed.data.training) : {}; } catch {}

    const followupsId = crypto.randomUUID();

    // ✅ Screenshot/webp-safe: upload the file to OpenAI and reference by image_file_id
    const nodeFile = await toNodeFile(image);
    const uploaded = await openai.files.create({
      file: nodeFile as any,
      purpose: "vision",
    } as any);

    const prompt = buildPrompt(parsed.data.ingredients, fighter, training, followupsId);

    const resp = await openai.responses.create({
      model: "gpt-5.1",
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_file_id: (uploaded as any).id },
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

    const raw = String((resp as any).output_text ?? "").trim();
    if (!raw) return NextResponse.json({ ok: false, error: "FuelPhoto returned empty output text." }, { status: 500 });

    const out = JSON.parse(raw) as FuelOutput;

    // Persist (match your schema: if you store macros as jsonb, keep as out.macros)
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
    console.error("FuelPhoto crashed:", err);
    return NextResponse.json({ ok: false, error: "FuelPhoto backend crashed." }, { status: 500 });
  }
}
