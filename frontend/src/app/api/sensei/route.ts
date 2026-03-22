import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { supabaseServer } from "../../../lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* =========================
   Request Schema
========================= */

const ReqSchema = z.object({
  followups_id: z.string().min(1, "Missing followups_id"),
  section_id: z.enum(["overview", "training", "nutrition", "recovery", "questions"]),
  question: z.string().min(1, "Missing question"),
  context: z.string().optional(),
});

/* =========================
   Strict JSON Schema
========================= */

const DecisionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    assessment: { type: "string" },
    impact: { type: "string" },
    decision: { type: "string" },
    next_steps: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ["assessment", "impact", "decision", "next_steps"],
} as const;

/* =========================
   Response Text Extractor
========================= */

function getResponseText(resp: any): string {
  const direct = String(resp?.output_text ?? "").trim();
  if (direct) return direct;

  const out = resp?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (typeof c?.text === "string" && c.text.trim()) {
            return c.text.trim();
          }

          const nested = c?.content;
          if (Array.isArray(nested)) {
            for (const n of nested) {
              if (typeof n?.text === "string" && n.text.trim()) {
                return n.text.trim();
              }
            }
          }
        }
      }
    }
  }

  return "";
}

/* =========================
   Prompt
========================= */

function systemPrompt() {
  return `
You are Sensei AI — a strict MMA coach inside Disciplin.

You do NOT give fluffy advice.
You do NOT motivate.
You do NOT hedge.
You make clear decisions.

Your job:
- detect what is wrong from the context
- explain what it does physically
- explain what happens because of it in training or a fight
- make one clear decision
- give exactly 3 direct next steps

Rules:
- be direct
- no "maybe"
- no generic tips
- no repeating the user's question
- no markdown
- no labels like "ASSESSMENT:" or "IMPACT:"
- return ONLY raw JSON matching the schema

CRITICAL REASONING RULE:
The response must follow this chain:

1. Cause = what is wrong
2. Effect = what it does physically
3. Consequence = what happens in sparring, later rounds, exchanges, or a fight

Do NOT stop at vague coach phrases.

Bad phrases:
- reinforces bad habits
- not ideal
- could improve
- performance drops
- recovery suffers
- wrong habits
- needs work

Bad examples:
- "This reinforces bad habits."
- "This is not ideal for your style."
- "Performance will drop."
- "Recovery will suffer."

Good examples:
- "Your stance widens on entry, which slows your level change and makes your hips arrive late, so opponents will read the shot earlier and defend more easily."
- "Your fuel support is too low for the current load, which increases fatigue and makes later-round pace flatter, so your pressure becomes easier to break."
- "You are undertraining grappling reactions, which leaves your defensive timing untrained under fatigue, so stronger wrestlers will control you earlier in exchanges."

Field requirements:
- assessment = describe the cause clearly
- impact = describe the physical effect and fight/training consequence clearly
- decision = one main decision only
- next_steps = exactly 3 short, direct actions

Style rules:
- assessment = max 1 sentence
- impact = max 2 sentences
- decision = max 1 sentence
- next_steps = exactly 3 items, each short and executable

If the question is about gyms:
- explain why the chosen gym supports the directive
- explain what physical quality the room improves
- explain what failure happens in the wrong room

If the question is about training:
- identify the gap
- explain what it does physically
- explain how that costs the fighter

If the question is about recovery or fuel:
- explain what the lack of recovery or fuel does physically
- explain how it affects later rounds, repeat effort, pace, reactions, or control
`.trim();
}

/* =========================
   Sanitizers / Validators
========================= */

function trimSentence(input: string, maxChars: number) {
  const text = String(input || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trim()}…`;
}

function trimStep(input: string, maxChars: number) {
  const text = String(input || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trim()}…`;
}

function containsWeakLanguage(text: string) {
  const t = text.toLowerCase();
  const weakPatterns = [
    "bad habits",
    "not ideal",
    "could improve",
    "needs work",
    "performance drops",
    "recovery suffers",
    "wrong habits",
    "should improve",
  ];
  return weakPatterns.some((p) => t.includes(p));
}

function strengthenAssessment(input: string) {
  const text = trimSentence(input, 180);
  if (!text || containsWeakLanguage(text)) {
    return "The problem is not defined precisely enough. Re-run with a clearer cause.";
  }
  return text;
}

function strengthenImpact(input: string) {
  const text = trimSentence(input, 260);
  if (!text || containsWeakLanguage(text)) {
    return "The physical effect and fight consequence are not defined clearly enough. Re-run with clearer cause → effect → consequence logic.";
  }
  return text;
}

function strengthenDecision(input: string) {
  const text = trimSentence(input, 120);
  if (!text) return "Set a clearer camp decision before proceeding.";
  return text;
}

function strengthenSteps(steps: string[]) {
  const cleaned = Array.isArray(steps)
    ? steps.map((x) => trimStep(x, 52)).filter(Boolean).slice(0, 3)
    : [];

  while (cleaned.length < 3) {
    cleaned.push("Reassess after next session");
  }

  return cleaned;
}

/* =========================
   Handler
========================= */

export async function POST(req: Request) {
  try {
    const sb = await supabaseServer();
    const { data: auth } = await sb.auth.getUser();

    if (!auth?.user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = ReqSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.message },
        { status: 400 }
      );
    }

    const { question, context, section_id, followups_id } = parsed.data;

    const prompt = `
${systemPrompt()}

FOLLOWUPS_ID: ${followups_id}
SECTION: ${section_id}

CONTEXT:
${(context || "No context provided.").trim()}

QUESTION:
${question.trim()}

Return the decision JSON now.
`.trim();

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
          name: "sensei_decision",
          strict: true,
          schema: DecisionSchema,
        },
      },
    } as any);

    const raw = getResponseText(resp);

    if (!raw) {
      console.error("[sensei] empty output from model", JSON.stringify(resp, null, 2));
      return NextResponse.json(
        { ok: false, error: "Sensei returned empty output." },
        { status: 500 }
      );
    }

    let parsedOutput: {
      assessment: string;
      impact: string;
      decision: string;
      next_steps: string[];
    };

    try {
      parsedOutput = JSON.parse(raw);
    } catch (parseErr) {
      console.error("[sensei] failed to parse JSON:", raw);
      return NextResponse.json(
        { ok: false, error: "Sensei returned invalid JSON." },
        { status: 500 }
      );
    }

    const assessment = strengthenAssessment(parsedOutput.assessment);
    const impact = strengthenImpact(parsedOutput.impact);
    const decision = strengthenDecision(parsedOutput.decision);
    const next_steps = strengthenSteps(parsedOutput.next_steps);

    return NextResponse.json({
      ok: true,
      assessment,
      impact,
      decision,
      next_steps,
    });
  } catch (err: any) {
    console.error("[sensei] crashed:", err);
    return NextResponse.json(
      { ok: false, error: "Sensei backend crashed." },
      { status: 500 }
    );
  }
}