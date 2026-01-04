// /src/app/api/sensei/route.ts
import { NextResponse } from "next/server";

type SenseiMode = "new" | "refine" | "chat" | "continue";

type SenseiRequest = {
  mode: SenseiMode;

  // Your existing fields
  style?: string;
  favourites?: string;
  campStage?: string;
  weightGoal?: string;
  scenario?: string;

  // Existing camp context
  previousPlan?: string | null;

  // Chat mode
  message?: string;
  videoNotes?: string;

  // Optional: profile summary string (recommended)
  // If you already store profile_json in Supabase, you can generate a summary in the client and send it.
  profileSummary?: string;

  // Optional: if user explicitly wants "continue"
  continueFromLast?: boolean;
};

type SenseiResponse =
  | { ok: true; plan?: string; reply?: string; truncated?: boolean; mode: SenseiMode }
  | { ok: false; error: string; mode: SenseiMode };

const OPENAI_URL = "https://api.openai.com/v1/responses";

// ---- CONFIG ----
const MODEL = "gpt-5.1";

// You can tweak these
const MAX_OUTPUT_TOKENS_PLAN = 3200;
const MAX_OUTPUT_TOKENS_CHAT = 1600;

// Hard rules to keep your “final behavior”
function buildSystemPrompt() {
  return `
You are SENSEI AI for Disciplin OS.

CORE IDENTITY
- You are a disciplined, calm father-figure for young athletes: firm, protective, high standards, zero fluff.
- You must NEVER humiliate, insult, or abuse. No edgy “tough love” that crosses into cruelty.
- You must NEVER replace a real coach. You are an assistant: clarify, structure, reflect, and support.
- You must frequently encourage: “confirm with your coach”, “adjust with a qualified coach”, and “stop if pain/red flags”.

MODE LOCK (choose ONE and do not drift)
- FORGING: youth / competitive / hungry. Tone: firm father-figure, high standards, direct.
- HYBRID: serious hobbyist / amateur. Tone: structured, realistic, disciplined.
- STEWARD: older / health-first / injuries / heart conditions risk. Tone: calm, conservative, longevity-first, safety-first.

You MUST select the mode based on the user’s age, constraints, injuries, and intent. Once selected, STAY in it.

LANGUAGE RULE (non-negotiable)
- Detect the language of the user’s LAST message.
- Respond entirely in that language.
- Do not translate unless explicitly asked.
- Preserve coaching tone in that language.

COACH-SAFETY RULE (non-negotiable)
- You do not diagnose medical conditions.
- If user mentions heart conditions, chest pain, fainting, severe dizziness, blood pressure issues, or unexplained shortness of breath:
  - You MUST advise consulting a clinician before intense training.
  - You MUST propose conservative alternatives.
- Always include a short “Coach check / Safety” line: confirm with coach, stop if pain, adjust volume.

ASK + GIVE (non-negotiable)
- You must ALWAYS:
  1) Give a useful answer/plan component, AND
  2) Ask 2–5 targeted questions that move the plan forward.
- If critical info is missing, ask questions FIRST, then give a safe “placeholder micro-plan” (minimum viable plan) until answers arrive.

ANTI-TRUNCATION / OUTPUT CONTROL
- If you cannot fit a full camp plan, output in CHUNKS:
  - End with: "TYPE: CONTINUE" (in the same language)
  - Next chunk continues seamlessly without repeating.
- Prefer structured formatting:
  - Short headings, bullets, numbered blocks.
  - Avoid giant walls of text.

CONTENT BOUNDARIES
- No medical claims. No illegal advice. No instructions for harming others.
- Training advice must be practical, cautious, and coach-friendly.

OUTPUT FORMAT RULES
For camp plans (new/refine/continue):
- Start with:
  1) MODE LOCK: (FORGING / HYBRID / STEWARD)
  2) 1-paragraph “Coach check / Safety”
  3) Plan structure with weeks/days
  4) Questions for user (2–5)

For chat answers:
- Start with a short direct answer
- Then “What I need from you” questions (2–4)
`;
}

// Build a single input string (Responses API-safe)
function buildUserInput(req: SenseiRequest) {
  const parts: string[] = [];

  parts.push(`REQUEST TYPE: ${req.mode.toUpperCase()}`);

  if (req.profileSummary?.trim()) {
    parts.push(`PROFILE SUMMARY:\n${req.profileSummary.trim()}`);
  }

  parts.push(`FORM INPUTS:
- Style: ${req.style ?? ""}
- Favourite/closest fighters: ${req.favourites ?? ""}
- Camp stage/timeframe: ${req.campStage ?? ""}
- Weight goal: ${req.weightGoal ?? ""}
- Scenario/problem: ${req.scenario ?? ""}`);

  if (req.videoNotes?.trim()) {
    parts.push(`VIDEO NOTES (optional):\n${req.videoNotes.trim()}`);
  }

  if (req.previousPlan?.trim()) {
    parts.push(`PREVIOUS PLAN (context):\n${req.previousPlan.trim()}`);
  }

  if (req.mode === "chat") {
    parts.push(`USER MESSAGE:\n${req.message ?? ""}`);
  }

  if (req.mode === "continue" || req.continueFromLast) {
    parts.push(`INSTRUCTION: Continue from the last cutoff. Do not restart. Do not repeat. Keep same format.`);
  }

  // A small “what you must do” instruction to reduce drift
  parts.push(`
MANDATE:
- Follow system rules exactly.
- Ask + give (must ask 2–5 questions every response).
- End with TYPE: CONTINUE if you are cut off.
`);

  return parts.join("\n\n");
}

// Extract text from Responses API
function extractText(responseJson: any): string {
  // responses API typically returns output_text helper sometimes
  if (typeof responseJson?.output_text === "string") return responseJson.output_text;

  // Otherwise traverse output -> content
  const out = responseJson?.output;
  if (!Array.isArray(out)) return "";

  let text = "";
  for (const item of out) {
    const content = item?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c?.type === "output_text" && typeof c?.text === "string") {
        text += c.text;
      }
    }
  }
  return text.trim();
}

export async function POST(request: Request) {
  let body: SenseiRequest;

  try {
    body = (await request.json()) as SenseiRequest;
  } catch {
    const bad: SenseiResponse = { ok: false, error: "Invalid JSON body.", mode: "chat" };
    return NextResponse.json(bad, { status: 400 });
  }

  const mode: SenseiMode = body.mode ?? "chat";

  // Basic guards to prevent your “style/timeframe” false error
  const style = (body.style ?? "").trim();
  const campStage = (body.campStage ?? "").trim();

  if ((mode === "new" || mode === "refine") && (!style || !campStage)) {
    const bad: SenseiResponse = {
      ok: false,
      mode,
      error: "Sensei needs at least: your style AND camp stage/timeframe.",
    };
    return NextResponse.json(bad, { status: 200 });
  }

  if (mode === "chat" && !(body.message ?? "").trim()) {
    const bad: SenseiResponse = { ok: false, mode, error: "Empty message." };
    return NextResponse.json(bad, { status: 200 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const bad: SenseiResponse = { ok: false, mode, error: "Missing OPENAI_API_KEY in env." };
    return NextResponse.json(bad, { status: 500 });
  }

  const systemPrompt = buildSystemPrompt();
  const userInput = buildUserInput(body);

  const maxOutput =
    mode === "chat" ? MAX_OUTPUT_TOKENS_CHAT : MAX_OUTPUT_TOKENS_PLAN;

  try {
    const resp = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
        max_output_tokens: maxOutput,
      }),
    });

    const json = await resp.json();

    if (!resp.ok) {
      console.error("[Sensei API] OpenAI error:", json);
      const bad: SenseiResponse = {
        ok: false,
        mode,
        error: json?.error?.message ?? "OpenAI request failed.",
      };
      return NextResponse.json(bad, { status: 200 });
    }

    const text = extractText(json);
    if (!text) {
      console.error("[Sensei API] Empty output:", json);
      const bad: SenseiResponse = { ok: false, mode, error: "Sensei returned empty output." };
      return NextResponse.json(bad, { status: 200 });
    }

    const truncated =
      typeof json?.incomplete_details === "string" ||
      json?.status === "incomplete" ||
      /TYPE:\s*CONTINUE/i.test(text);

    // Return shape compatible with your frontend
    if (mode === "chat") {
      const ok: SenseiResponse = { ok: true, mode, reply: text, truncated };
      return NextResponse.json(ok, { status: 200 });
    }

    const ok: SenseiResponse = { ok: true, mode, plan: text, truncated };
    return NextResponse.json(ok, { status: 200 });
  } catch (e: any) {
    console.error("[Sensei API] Unexpected error:", e);
    const bad: SenseiResponse = {
      ok: false,
      mode,
      error: e?.message ?? "Unexpected server error.",
    };
    return NextResponse.json(bad, { status: 200 });
  }
}
