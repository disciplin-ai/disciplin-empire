// src/app/api/sensei/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

// If you use Supabase auth like the old route, keep this.
// If you DON'T want auth gating, delete the next 2 lines + the auth block below.
import { supabaseServer } from "../../../lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/* =========================
   Request Schemas
========================= */

const PlanSchema = z.object({
  mode: z.literal("plan"),
  week: z.string().optional().default("Today"),
  context: z.string().min(8, "Missing context"),
  followups_id: z.string().optional(),
});

const AskSchema = z.object({
  mode: z.literal("ask"),
  followups_id: z.string().min(1, "Missing followups_id"),
  section_id: z.enum(["overview", "training", "nutrition", "recovery", "questions"]),
  question: z.string().min(1, "Missing question"),
  week: z.string().optional(),
  context: z.string().optional(),
});

const ReqSchema = z.union([PlanSchema, AskSchema]);

/* =========================
   Output JSON Schemas (OpenAI)
========================= */

function planJsonSchema() {
  // Strict schema ensures the model returns exactly what your UI can render.
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      followups_id: { type: "string" },
      weekLabel: { type: "string" },
      intensityTag: { type: "string", enum: ["LOW", "MODERATE", "HIGH", "MAX"] },

      overview: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["title", "bullets"],
        },
      },
      training: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["title", "bullets"],
        },
      },
      nutrition: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["title", "bullets"],
        },
      },
      recovery: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["title", "bullets"],
        },
      },
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["title", "bullets"],
        },
      },
    },
    required: ["followups_id", "weekLabel", "intensityTag", "overview", "training", "nutrition", "recovery", "questions"],
  } as const;
}

function askJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      reply: { type: "string" },
    },
    required: ["reply"],
  } as const;
}

/* =========================
   Prompt Builders
========================= */

function systemRules() {
  return [
    "You are Sensei AI: a strict MMA coach.",
    "Return STRICT JSON only (no markdown, no extra text).",
    "Never use markdown symbols (no ##, no **).",
    "Never repeat the user’s full context back to them.",
    "Be decisive. No 'maybe'. No self-corrections.",

    "",
    "PLAN FORMAT:",
    "- Output EXACTLY 5 sections: overview, training, nutrition, recovery, questions.",
    "- Each section: 3–6 blocks, each block 1–3 bullets.",
    "- Bullets must be concrete: numbers, timers, reps, limits, do/avoid.",
    "- Include at least ONE bullet that starts with 'Cost:' in the overview section.",
    "- Safety must appear in recovery.",

    "",
    "ASK FORMAT:",
    "- Answer ONLY the question.",
    "- 3–7 bullets max.",
    "- Concrete steps; no essays; no restating the plan.",
  ].join("\n");
}

function buildPlanPrompt(weekLabel: string, followups_id: string, context: string) {
  return [
    systemRules(),
    "",
    `WEEK_LABEL: ${weekLabel}`,
    `FOLLOWUPS_ID: ${followups_id}`,
    "",
    "CONTEXT:",
    context.trim(),
    "",
    "TASK:",
    "- Produce the 5 sections for this session.",
    "- Keep it tight and executable.",
    "- Include 'Cost:' as instructed.",
  ].join("\n");
}

function buildAskPrompt(args: {
  followups_id: string;
  section_id: string;
  question: string;
  weekLabel?: string;
  context?: string;
}) {
  const { followups_id, section_id, question, weekLabel, context } = args;

  return [
    systemRules(),
    "",
    `FOLLOWUPS_ID: ${followups_id}`,
    weekLabel ? `WEEK_LABEL: ${weekLabel}` : "",
    context ? ["CONTEXT (brief):", context.trim(), ""].join("\n") : "",
    `SECTION: ${section_id}`,
    "",
    "USER QUESTION:",
    question.trim(),
    "",
    "TASK:",
    "- Answer ONLY the question.",
    "- 3–7 bullets max.",
    "- Concrete, coach-like.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* =========================
   Response Text Extractor
========================= */

function getResponseText(resp: any): string {
  const a = String(resp?.output_text ?? "").trim();
  if (a) return a;

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

/* =========================
   Handler
========================= */

export async function POST(req: Request) {
  try {
    // OPTIONAL AUTH (recommended)
    // If you don't want auth, remove this entire block.
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
    // ASK
    // -------------------------
    if (parsed.data.mode === "ask") {
      const prompt = buildAskPrompt({
        followups_id: parsed.data.followups_id,
        section_id: parsed.data.section_id,
        question: parsed.data.question,
        weekLabel: parsed.data.week,
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
            schema: askJsonSchema(),
          },
        },
      } as any);

      const raw = getResponseText(resp);
      if (!raw) return NextResponse.json({ ok: false, error: "Sensei returned empty output." }, { status: 500 });

      const out = JSON.parse(raw) as { reply: string };

      const reply = String(out.reply ?? "").trim();
      return NextResponse.json({ ok: true, reply });
    }

    // -------------------------
    // PLAN
    // -------------------------
    const weekLabel = (parsed.data.week || "Today").trim();
    const followups_id = parsed.data.followups_id || crypto.randomUUID();
    const context = parsed.data.context;

    const prompt = buildPlanPrompt(weekLabel, followups_id, context);

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
          name: "sensei_plan",
          strict: true,
          schema: planJsonSchema(),
        },
      },
    } as any);

    const raw = getResponseText(resp);
    if (!raw) return NextResponse.json({ ok: false, error: "Sensei returned empty output." }, { status: 500 });

    const out = JSON.parse(raw) as any;

    out.followups_id = followups_id;
    out.weekLabel = weekLabel;
    if (!out.intensityTag) out.intensityTag = "MODERATE";

    return NextResponse.json({ ok: true, ...out });
  } catch (err: any) {
    console.error("[sensei] crashed:", err);
    return NextResponse.json({ ok: false, error: "Sensei backend crashed." }, { status: 500 });
  }
}