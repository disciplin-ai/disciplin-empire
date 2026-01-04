// src/app/api/sensei-vision/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Mode = "analyze" | "chat";

function safeStr(x: any, max = 8000) {
  return String(x ?? "").slice(0, max);
}

function detectLanguageHint(localeHint?: string) {
  // Keep it simple: OpenAI can handle multilingual if we instruct it.
  // localeHint examples: "en-US", "ru-RU"
  return localeHint ? safeStr(localeHint, 20) : "auto";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const mode: Mode = (body?.mode ?? "analyze") as Mode;
    const userText = safeStr(body?.userText, 4000);
    const imageBase64 = safeStr(body?.imageBase64, 2_000_000); // large; keep reasonable
    const prior = safeStr(body?.prior, 8000);
    const message = safeStr(body?.message, 2000);
    const localeHint = detectLanguageHint(body?.localeHint);

    if (!userText && !imageBase64 && !message) {
      return NextResponse.json(
        { ok: false, error: "Missing input for Sensei Vision." },
        { status: 400 }
      );
    }

    const system = `
You are SENSEI VISION — a strict but responsible martial-arts technique coach.
You analyze a SINGLE frame (image) + text context and give practical corrections.

Hard rules:
- Do NOT replace a real coach. Encourage user to confirm with coach.
- Safety first: if you see dangerous neck/back/knee positions, warn calmly and scale intensity.
- Adapt tone to age/level: young competitors can handle firm coaching; older hobbyists get conservative advice.
- MULTI-LANGUAGE: respond in the same language the user writes in (or locale hint), with clear structure.
- Be concise, not essays. Prefer bullets.
- Always ask 1–3 follow-up questions that improve accuracy.

Output format MUST be valid JSON with exactly these keys:
{
  "reply": string,                // the main breakdown (short, structured)
  "grade": "green" | "yellow" | "red",
  "keyFix": string,               // one cue
  "drills": string[],             // 2–5 drills
  "questions": string[]           // 1–3 clarifying questions
}

Grade definitions:
- green = technically correct / safe habit
- yellow = mostly good, needs corrections
- red = habit that must change (inefficient or risky)

Locale hint: ${localeHint}
`.trim();

    const promptAnalyze = `
CONTEXT (user text):
${userText || "(none)"}

TASK:
1) Read the frame.
2) Identify the PRIMARY mistake (1–2 lines).
3) Give the smallest high-leverage fix (one cue).
4) Give 2–5 drills.
5) Give a grade (green/yellow/red).
6) Ask 1–3 questions to confirm details (position/ruleset/intention).

If user mentions a specific elite athlete (e.g., Sadulaev), explain the MECHANICAL difference without hero worship.
Return JSON only.
`.trim();

    const promptChat = `
CONTEXT:
${userText || "(none)"}

PRIOR SENSEI OUTPUT:
${prior || "(none)"}

USER MESSAGE:
${message || "(none)"}

TASK:
- Continue coaching based on prior output.
- Update cue/drills if needed.
- Ask 1–2 new questions.
Return JSON only.
`.trim();

    // Build input array for Responses API
    const input: any[] = [];

    // Combine image + text in one user message when possible (best)
    const content: any[] = [];

    if (mode === "chat") {
      content.push({ type: "input_text", text: promptChat });
    } else {
      content.push({ type: "input_text", text: promptAnalyze });
    }

    if (imageBase64) {
      // Accept either already-clean base64 or full data URL; normalize lightly
      const dataUrl = imageBase64.startsWith("data:")
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;

      content.push({
        type: "input_image",
        image_url: dataUrl,
      });
    }

    input.push({ role: "user", content });

    const aiRes = await openai.responses.create({
      model: "gpt-4.1-mini", // strong + fast for vision-ish; swap if you want
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        ...input,
      ],
      max_output_tokens: 2000,
      temperature: 0.25,
    });

    const raw = (aiRes.output_text || "").trim();
    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "Sensei Vision gave no answer." },
        { status: 500 }
      );
    }

    // Parse JSON safely
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // If model returns extra text, attempt to extract JSON block
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } else {
        return NextResponse.json(
          { ok: false, error: "Invalid JSON from Sensei Vision." },
          { status: 500 }
        );
      }
    }

    const reply = safeStr(parsed?.reply, 8000);
    const grade = parsed?.grade;
    const keyFix = safeStr(parsed?.keyFix, 400);
    const drills = Array.isArray(parsed?.drills) ? parsed.drills.map((d: any) => safeStr(d, 300)) : [];
    const questions = Array.isArray(parsed?.questions) ? parsed.questions.map((q: any) => safeStr(q, 300)) : [];

    return NextResponse.json({
      ok: true,
      reply,
      grade,
      keyFix,
      drills,
      questions,
    });
  } catch (err: any) {
    console.error("[sensei-vision] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Sensei Vision failed." },
      { status: 500 }
    );
  }
}
