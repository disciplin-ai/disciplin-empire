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

const ReqSchema = z.object({
  followups_id: z.string().min(1, "Missing followups_id"),
  section_id: z.enum(["overview", "training", "nutrition", "recovery", "questions"]),
  question: z.string().min(1, "Missing question"),
  context: z.string().optional(),
});

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

const DirectAnswerSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
  },
  required: ["answer"],
} as const;

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

function clean(input: unknown) {
  return String(input ?? "").replace(/\s+/g, " ").trim();
}

function trimSentence(input: string, maxChars: number) {
  const text = clean(input);
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trim()}…`;
}

function trimStep(input: string, maxChars: number) {
  const text = clean(input);
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
  const text = trimSentence(input, 240);
  if (!text || containsWeakLanguage(text)) {
    return "The physical effect and fight consequence are not defined clearly enough. Re-run with clearer cause → effect → consequence logic.";
  }
  return text;
}

function strengthenDecision(input: string) {
  const text = trimSentence(input, 110);
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

function strengthenDirectAnswer(input: string) {
  const text = clean(input);
  if (!text) return "No direct answer returned.";

  const sentences = text
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const limited = sentences.slice(0, 2).join(". ");
  const trimmed =
    limited.length > 140 ? `${limited.slice(0, 139).trim()}…` : limited;

  return trimmed;
}

function safeNumber(input: unknown): number | null {
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

function isDirectQuestion(question: string) {
  const q = clean(question).toLowerCase();

  return (
    q.includes("which") ||
    q.includes("what") ||
    q.includes("should i") ||
    q.includes("do i") ||
    q.includes("pick") ||
    q.includes("choose") ||
    q.includes("best gym") ||
    q.includes("which gym") ||
    q.includes("what gym")
  );
}

async function getLatestVisionContext(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string
) {
  const candidates = ["vision_runs", "vision_messages"];

  for (const table of candidates) {
    try {
      const { data, error } = await sb
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const findings = Array.isArray((data as any).findings) ? (data as any).findings : [];
        const primary = findings[0] ?? null;

        return {
          sourceTable: table,
          raw: data,
          primary: primary
            ? {
                title: clean(primary.title),
                severity: clean(primary.severity),
                interrupt: clean(primary.interrupt),
                fix_next_rep: clean(primary.fix_next_rep),
                dashboard_detail: clean(primary.dashboard_detail || primary.detail),
                if_ignored: clean(primary.if_ignored),
              }
            : null,
        };
      }
    } catch {
      // continue
    }
  }

  return {
    sourceTable: null,
    raw: null,
    primary: null,
  };
}

async function getLatestFuelContext(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string
) {
  const candidates = ["fuel_logs", "fuel_messages"];

  for (const table of candidates) {
    try {
      const { data, error } = await sb
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const score =
          safeNumber((data as any).score) ??
          safeNumber((data as any).fuel_score) ??
          safeNumber((data as any).readiness_score);

        const rating =
          clean((data as any).rating) ||
          clean((data as any).grade) ||
          clean((data as any).status);

        const report =
          clean((data as any).report) ||
          clean((data as any).assessment) ||
          clean((data as any).decision);

        return {
          sourceTable: table,
          raw: data,
          summary: {
            score,
            rating,
            report,
          },
        };
      }
    } catch {
      // continue
    }
  }

  return {
    sourceTable: null,
    raw: null,
    summary: null,
  };
}

function systemPromptDirect() {
  return `
You are Sensei AI — a strict fight-camp decision engine inside Disciplin.

You are answering one direct user question inside an active fight-camp system.

CRITICAL PRODUCT RULE:
Answer only what the user asked.
Do not turn the answer into a report.
Do not add extra analysis unless needed for the direct answer.

CONNECTED SYSTEM RULE:
- If Vision exists, stay inside the active correction
- If Fuel exists, use it to modify readiness / load / recovery logic
- If both exist, interlink them naturally
- Never ignore the active correction because of a broad question

STYLE RULES:
- Be sharp
- Be short
- No fluff
- No markdown
- No lists unless necessary
- No labels like assessment, impact, decision
- 1–2 sentences max
- Return ONLY raw JSON

Examples:
- "Dagestan Top Team Dubai. Best fit for pressure wrestling and corrective rounds."
- "Yes. Fuel support is too weak for a hard session today."
- "Train technical entries only tonight. Do not turn it into open volume."

Return exactly:
{ "answer": "..." }
`.trim();
}

function systemPromptDecision() {
  return `
You are Sensei AI — a strict fight-camp decision engine inside Disciplin.

You are NOT a generic chatbot.
You are NOT a therapist.
You are NOT a motivational coach.
You make hard training decisions.

The system is connected:
- Vision identifies the active technical correction
- Fuel identifies nutrition / recovery support
- Sensei must integrate both

CRITICAL PRODUCT RULE:
If a Vision correction exists, it is the primary training truth.
You do NOT override it.
You do NOT introduce unrelated focuses.
You do NOT build balanced training around multiple themes.

CRITICAL INTERLINK RULE:
Every feature must interlink.

That means:
- Vision sets what must be fixed
- Sensei decides how training should revolve around that correction
- Fuel modifies how hard the fighter should train, how much volume they can support, and whether recovery or fueling is limiting the session

Decision hierarchy:
1. If Vision correction exists → build around it
2. If Fuel is weak → reduce load / tighten execution / avoid reinforcing bad reps
3. If Fuel is strong → training can support sharper execution and normal pressure
4. Never ignore the active correction because of a generic question

Your job:
- detect what is wrong from the connected system context
- explain what it does physically
- explain what happens because of it in training or a fight
- make one clear decision
- give exactly 3 direct next steps

Rules:
- be direct
- no fluff
- no hedging
- no generic tips
- no repeating the user's question
- no markdown
- return ONLY raw JSON matching the schema

CRITICAL REASONING RULE:
The response must follow this chain:
1. Cause = what is wrong
2. Effect = what it does physically
3. Consequence = what happens in sparring, later rounds, exchanges, or a fight

assessment = max 1 sentence
impact = max 2 sentences
decision = max 1 sentence
next_steps = exactly 3 items, short and executable
`.trim();
}

function buildConnectedContext(args: {
  section_id: "overview" | "training" | "nutrition" | "recovery" | "questions";
  followups_id: string;
  question: string;
  context?: string;
  vision: Awaited<ReturnType<typeof getLatestVisionContext>>;
  fuel: Awaited<ReturnType<typeof getLatestFuelContext>>;
  directMode: boolean;
}) {
  const { section_id, followups_id, question, context, vision, fuel, directMode } = args;

  const visionBlock = vision.primary
    ? `
VISION STATUS:
- Active correction: ${vision.primary.title || "Unknown correction"}
- Severity: ${vision.primary.severity || "Unknown"}
- Stop command: ${vision.primary.interrupt || "Not available"}
- Fix next rep: ${vision.primary.fix_next_rep || "Not available"}
- Why it matters: ${vision.primary.dashboard_detail || "Not available"}
- If ignored: ${vision.primary.if_ignored || "Not available"}

VISION NON-NEGOTIABLE:
- This correction is the primary training truth.
- Do not introduce unrelated focus.
- The decision must revolve around fixing this.
`.trim()
    : `
VISION STATUS:
- No active Vision correction found.
`.trim();

  const fuelBlock = fuel.summary
    ? `
FUEL STATUS:
- Score: ${fuel.summary.score ?? "Unknown"}
- Rating: ${fuel.summary.rating || "Unknown"}
- Fuel note: ${fuel.summary.report || "No report"}

FUEL RULE:
- Use this to modify readiness, volume, intensity, and recovery decisions.
- If support is weak, tighten the session and avoid reinforcing bad reps under fatigue.
`.trim()
    : `
FUEL STATUS:
- No active Fuel result found.
`.trim();

  const systemPrompt = directMode ? systemPromptDirect() : systemPromptDecision();

  return `
${systemPrompt}

FOLLOWUPS_ID: ${followups_id}
SECTION: ${section_id}

CONNECTED SYSTEM CONTEXT:
${visionBlock}

${fuelBlock}

ADDITIONAL CONTEXT:
${clean(context) || "No additional context provided."}

USER QUESTION:
${clean(question)}

FINAL DECISION RULE:
- If Vision exists, answer from the correction first
- If Fuel exists, modify the recommendation based on readiness
- If both exist, interlink them explicitly
- If direct mode is active, answer only the actual question
- If decision mode is active, return the full decision structure

Return the JSON now.
`.trim();
}

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
    const directMode = isDirectQuestion(question);

    const [vision, fuel] = await Promise.all([
      getLatestVisionContext(sb, auth.user.id),
      getLatestFuelContext(sb, auth.user.id),
    ]);

    const prompt = buildConnectedContext({
      section_id,
      followups_id,
      question,
      context,
      vision,
      fuel,
      directMode,
    });

    const schema = directMode ? DirectAnswerSchema : DecisionSchema;
    const schemaName = directMode ? "sensei_answer" : "sensei_decision";

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
          name: schemaName,
          strict: true,
          schema,
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

    if (directMode) {
      let parsedOutput: { answer: string };

      try {
        parsedOutput = JSON.parse(raw);
      } catch {
        console.error("[sensei] failed to parse direct JSON:", raw);
        return NextResponse.json(
          { ok: false, error: "Sensei returned invalid JSON." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        answer: strengthenDirectAnswer(parsedOutput.answer),
        mode: "direct",
        connected: {
          vision: {
            present: !!vision.primary,
            correction: vision.primary?.title ?? null,
            severity: vision.primary?.severity ?? null,
            fix_next_rep: vision.primary?.fix_next_rep ?? null,
          },
          fuel: {
            present: !!fuel.summary,
            score: fuel.summary?.score ?? null,
            rating: fuel.summary?.rating ?? null,
          },
        },
      });
    }

    let parsedOutput: {
      assessment: string;
      impact: string;
      decision: string;
      next_steps: string[];
    };

    try {
      parsedOutput = JSON.parse(raw);
    } catch {
      console.error("[sensei] failed to parse decision JSON:", raw);
      return NextResponse.json(
        { ok: false, error: "Sensei returned invalid JSON." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      assessment: strengthenAssessment(parsedOutput.assessment),
      impact: strengthenImpact(parsedOutput.impact),
      decision: strengthenDecision(parsedOutput.decision),
      next_steps: strengthenSteps(parsedOutput.next_steps),
      mode: "decision",
      connected: {
        vision: {
          present: !!vision.primary,
          correction: vision.primary?.title ?? null,
          severity: vision.primary?.severity ?? null,
          fix_next_rep: vision.primary?.fix_next_rep ?? null,
        },
        fuel: {
          present: !!fuel.summary,
          score: fuel.summary?.score ?? null,
          rating: fuel.summary?.rating ?? null,
        },
      },
    });
  } catch (err: any) {
    console.error("[sensei] crashed:", err);
    return NextResponse.json(
      { ok: false, error: "Sensei backend crashed." },
      { status: 500 }
    );
  }
}