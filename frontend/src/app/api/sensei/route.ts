// frontend/src/app/api/sensei/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { supabaseServer } from "../../../lib/supabaseServer";
import type { SenseiResponse } from "../../../lib/senseiTypes";
import { senseiJsonSchema } from "../../../lib/senseiTypes";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const PlanSchema = z.object({
  mode: z.literal("plan"),
  week: z.string().default("Week 1"),
  context: z.string().min(1, "Missing context"),
  followups_id: z.string().optional(),
});

const RefineSchema = z.object({
  mode: z.literal("refine"),
  week: z.string().default("Week 1"),
  context: z.string().min(1, "Missing context"),
  followups_id: z.string().min(1, "Missing followups_id"),
  answers: z.record(z.string(), z.string()).default({}),
});

// ✅ NEW: per-section chat
const AskSchema = z.object({
  mode: z.literal("ask"),
  followups_id: z.string().min(1, "Missing followups_id"),
  section_id: z.enum(["overview", "training", "nutrition", "recovery", "questions"]),
  question: z.string().min(1, "Missing question"),
  // optional context so Sensei can answer consistently
  week: z.string().optional(),
  context: z.string().optional(),
});

const ReqSchema = z.union([PlanSchema, RefineSchema, AskSchema]);

function buildSenseiSystemRules() {
  return [
    "You are Sensei AI: a strict MMA coach.",
    "Never use markdown symbols (no ##, no **).",
    "Never repeat the user’s full context back to them.",
    "Be decisive. No 'maybe'. No self-corrections.",
    "",
    "Core structure for plans:",
    "- You must always output exactly 5 sections in this order:",
    "  1) overview  2) training  3) nutrition  4) recovery  5) questions",
    "- Each section: 3–6 blocks, each block 1–3 bullets.",
    "- Each bullet must contain something concrete (numbers/limits/timing/do-avoid).",
    "",
    "For chat answers:",
    "- Answer ONLY the asked question.",
    "- Do NOT restate the whole plan.",
    "- Provide 3–7 bullets max, actionable and specific.",
  ].join("\n");
}

function buildPlanPrompt(args: {
  week: string;
  context: string;
  followups_id: string;
  mode: "plan" | "refine";
  answers?: Record<string, string>;
}) {
  const { week, context, followups_id, mode, answers } = args;

  return [
    buildSenseiSystemRules(),
    "",
    `WEEK_LABEL: ${week}`,
    `FOLLOWUPS_ID: ${followups_id}`,
    "",
    "CONTEXT:",
    context.trim(),
    "",
    mode === "refine"
      ? [
          "MODE: refine",
          "USER ANSWERS (question -> answer):",
          JSON.stringify(answers ?? {}, null, 2),
          "TASK: Update the 5 sections using the answers. Keep the same followups_id.",
        ].join("\n")
      : ["MODE: plan", "TASK: Produce the 5 sections for this week label using the context."].join("\n"),
  ].join("\n");
}

function buildAskPrompt(args: {
  followups_id: string;
  section_id: string;
  question: string;
  week?: string;
  context?: string;
}) {
  const { followups_id, section_id, question, week, context } = args;

  return [
    buildSenseiSystemRules(),
    "",
    `FOLLOWUPS_ID: ${followups_id}`,
    week ? `WEEK_LABEL: ${week}` : "",
    "",
    context ? ["CONTEXT (brief):", context.trim(), ""].join("\n") : "",
    `SECTION: ${section_id}`,
    "",
    "USER QUESTION:",
    question.trim(),
    "",
    "TASK:",
    "- Answer the question ONLY for this section.",
    "- Provide 3–7 bullets. Concrete, coach-like.",
    "- No repetition of the entire plan.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  try {
    const sb = await supabaseServer();
    const { data: auth } = await sb.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = ReqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
    }

    // -------------------------
    // ASK MODE (section chat)
    // -------------------------
    if (parsed.data.mode === "ask") {
      const prompt = buildAskPrompt({
        followups_id: parsed.data.followups_id,
        section_id: parsed.data.section_id,
        question: parsed.data.question,
        week: parsed.data.week,
        context: parsed.data.context,
      });

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
            name: "sensei_ask",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reply: { type: "string" },
              },
              required: ["reply"],
            },
          },
        },
      } as any);

      const raw = String((resp as any).output_text ?? "").trim();
      if (!raw) return NextResponse.json({ ok: false, error: "Sensei returned empty output." }, { status: 500 });

      const out = JSON.parse(raw) as { reply: string };
      return NextResponse.json({ ok: true, reply: out.reply });
    }

    // -------------------------
    // PLAN / REFINE
    // -------------------------
    const followupsId =
      parsed.data.mode === "plan"
        ? parsed.data.followups_id ?? crypto.randomUUID()
        : parsed.data.followups_id;

    const prompt = buildPlanPrompt({
      week: parsed.data.week,
      context: parsed.data.context,
      followups_id: followupsId,
      mode: parsed.data.mode,
      answers: parsed.data.mode === "refine" ? parsed.data.answers : undefined,
    });

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
          name: "sensei_response",
          schema: senseiJsonSchema(),
          strict: true,
        },
      },
    } as any);

    const raw = String((resp as any).output_text ?? "").trim();
    if (!raw) return NextResponse.json({ ok: false, error: "Sensei returned empty output." }, { status: 500 });

    const out = JSON.parse(raw) as SenseiResponse;
    return NextResponse.json({ ok: true, ...out });
  } catch (err: any) {
    console.error("Sensei crashed:", err);
    return NextResponse.json({ ok: false, error: "Sensei backend crashed." }, { status: 500 });
  }
}
