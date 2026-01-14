// frontend/src/app/api/sensei/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import type { SenseiResponse } from "@/lib/senseiTypes";
import { senseiJsonSchema } from "@/lib/senseiTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const ReqSchema = z.object({
  mode: z.enum(["plan", "refine"]).default("plan"),
  week: z.string().default("Week 1"),
  context: z.string().min(1, "Missing context"),
  followups_id: z.string().optional(),
  answers: z.record(z.string(), z.string()).optional(),
});

function buildSenseiSystemRules() {
  return [
    "You are Sensei AI: a strict MMA fight-camp planner.",
    "Return JSON ONLY matching the provided schema. No markdown, no ##, no **.",
    "",
    "You must always output exactly 5 sections in this exact order:",
    "1) overview  2) training  3) nutrition  4) recovery  5) questions",
    "",
    "Each section must be DETAILED but not long:",
    "- Use 3–6 blocks per section.",
    "- Each block has 1–3 bullets.",
    "- Every bullet must include at least one concrete element:",
    "  number / cap / timing / threshold / frequency / do/avoid.",
    "- No self-corrections. No 'maybe'. Commit to one plan.",
    "",
    "Questions section rules:",
    "- Ask 1–2 questions max.",
    "- Questions must change the next plan (no generic questions).",
    "",
    "Nutrition section rules:",
    "- Provide specific targets (one kcal target or tight range), timing, and 2–4 constraints.",
    "- Keep it in blocks (no paragraphs).",
  ].join("\n");
}

function buildPrompt(args: {
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
      : [
          "MODE: plan",
          "TASK: Produce the 5 sections for this week label using the context.",
        ].join("\n"),
  ].join("\n");
}

function safeJsonParse<T>(raw: string): T {
  const v = JSON.parse(raw) as T;
  return v;
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

    const followupsId = parsed.data.followups_id ?? crypto.randomUUID();

    const prompt = buildPrompt({
      week: parsed.data.week,
      context: parsed.data.context,
      followups_id: followupsId,
      mode: parsed.data.mode,
      answers: parsed.data.answers,
    });

    // NOTE: This matches the input style that has worked in your repo:
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
    if (!raw) {
      return NextResponse.json({ ok: false, error: "Sensei returned empty output." }, { status: 500 });
    }

    const out = safeJsonParse<SenseiResponse>(raw);

    // Optional: store to Supabase if you want (recommended later)
    // await sb.from("sensei_runs").insert({...})

    return NextResponse.json({ ok: true, ...out });
  } catch (err: any) {
    console.error("Sensei crashed:", err);
    return NextResponse.json({ ok: false, error: "Sensei backend crashed." }, { status: 500 });
  }
}
