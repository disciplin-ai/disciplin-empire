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
  return localeHint ? safeStr(localeHint, 20) : "auto";
}

// Defensive: if model leaks headings into reply, strip them
function stripReplyNoise(text: string) {
  const banned = ["GRADE:", "KEY FIX:", "DRILLS:", "QUESTIONS:"];
  const lines = (text ?? "").split("\n");
  return lines
    .filter((line) => {
      const t = line.trim().toUpperCase();
      return !banned.some((b) => t.startsWith(b));
    })
    .join("\n")
    .trim();
}

// Defensive: dedupe arrays server-side too
function dedupe(arr: any[], maxLen = 6) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(arr) ? arr : []) {
    const s = safeStr(item, 300).trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= maxLen) break;
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const mode: Mode = (body?.mode ?? "analyze") as Mode;
    const userText = safeStr(body?.userText, 4000);
    const imageBase64 = safeStr(body?.imageBase64, 2_000_000);
    const message = safeStr(body?.message, 2000);
    const localeHint = detectLanguageHint(body?.localeHint);

    // prior can be a string (legacy) or an object (new)
    const priorRaw = body?.prior ?? "";
    const prior =
      typeof priorRaw === "string"
        ? safeStr(priorRaw, 8000)
        : safeStr(JSON.stringify(priorRaw), 8000);

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
- MULTI-LANGUAGE: respond in the same language the user writes in (or locale hint).
- Be concise, not essays. Prefer bullets.
- Always ask 1–3 follow-up questions that improve accuracy.

CRITICAL FORMAT RULES:
- Output MUST be valid JSON only (no extra text).
- The "reply" field must NOT include section headers like "GRADE:", "DRILLS:", "QUESTIONS:", or "KEY FIX:".
- Do NOT list drills/questions/key-fix inside "reply". Those belong ONLY in their dedicated keys.
- Keep "reply" to 3–8 short bullets max.

Output format MUST be valid JSON with exactly these keys:
{
  "reply": string,
  "grade": "green" | "yellow" | "red",
  "keyFix": string,
  "drills": string[],
  "questions": string[]
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

Return JSON only.
`.trim();

    const promptChat = `
CONTEXT:
${userText || "(none)"}

PRIOR (structured):
${prior || "(none)"}

USER MESSAGE:
${message || "(none)"}

TASK:
- Continue coaching based on prior.
- Update key fix/drills/questions if needed (do not repeat identical lists unless necessary).
- Ask 1–2 new questions if you still lack context.
Return JSON only.
`.trim();

    const content: any[] = [];

    content.push({
      type: "input_text",
      text: mode === "chat" ? promptChat : promptAnalyze,
    });

    if (imageBase64) {
      const dataUrl = imageBase64.startsWith("data:")
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;

      content.push({
        type: "input_image",
        image_url: dataUrl,
      });
    }

    const aiRes = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content },
      ],
      max_output_tokens: 1200,
      temperature: 0.2,
    });

    const raw = (aiRes.output_text || "").trim();
    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "Sensei Vision gave no answer." },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
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

    const reply = stripReplyNoise(safeStr(parsed?.reply, 8000));
    const grade = parsed?.grade as any;
    const keyFix = safeStr(parsed?.keyFix, 400).trim();

    const drills = dedupe(parsed?.drills, 6);
    const questions = dedupe(parsed?.questions, 4);

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
