import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProofStatus = "accepted" | "rejected";

type ProofResult = {
  status: ProofStatus;
  score: number;
  confidence: number;
  reason: string;
  visibleResistance: boolean;
  correctionVisible: boolean;
  correctionHeld: boolean;
  repQuality: "clean" | "partial" | "failed" | "unclear";
  nextRequiredProof: string;
};

function cleanText(input: unknown) {
  return String(input ?? "").replace(/\s+/g, " ").trim();
}

function stripDataUrl(input: string) {
  const value = cleanText(input);
  const commaIndex = value.indexOf(",");
  if (value.startsWith("data:") && commaIndex !== -1) {
    return value.slice(commaIndex + 1);
  }
  return value;
}

function safeNumber(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeResult(raw: any): ProofResult {
  const status: ProofStatus =
    raw?.status === "accepted" ? "accepted" : "rejected";

  const visibleResistance = raw?.visibleResistance === true;
  const correctionVisible = raw?.correctionVisible === true;
  const correctionHeld = raw?.correctionHeld === true;

  const repQuality: ProofResult["repQuality"] =
    raw?.repQuality === "clean" ||
    raw?.repQuality === "partial" ||
    raw?.repQuality === "failed" ||
    raw?.repQuality === "unclear"
      ? raw.repQuality
      : "unclear";

  const score = safeNumber(raw?.score, status === "accepted" ? 75 : 35);
  const confidence = safeNumber(raw?.confidence, 60);

  const reason =
    cleanText(raw?.reason) ||
    (status === "accepted"
      ? "Correction is visible and holds under resistance."
      : "Proof does not clearly show the correction holding under resistance.");

  const nextRequiredProof =
    cleanText(raw?.nextRequiredProof) ||
    "Upload a clearer rep showing the correction before contact, during resistance, and after the exchange.";

  const finalAccepted =
    status === "accepted" &&
    score >= 70 &&
    confidence >= 60 &&
    visibleResistance &&
    correctionVisible &&
    correctionHeld &&
    repQuality === "clean";

  return {
    status: finalAccepted ? "accepted" : "rejected",
    score,
    confidence,
    reason: finalAccepted
      ? reason
      : status === "accepted"
        ? "Rejected by enforcement gate. Proof must clearly show resistance, correction visibility, and the correction holding."
        : reason,
    visibleResistance,
    correctionVisible,
    correctionHeld,
    repQuality,
    nextRequiredProof,
  };
}

function fallbackReject(reason = "Proof could not be evaluated."): ProofResult {
  return {
    status: "rejected",
    score: 0,
    confidence: 0,
    reason,
    visibleResistance: false,
    correctionVisible: false,
    correctionHeld: false,
    repQuality: "unclear",
    nextRequiredProof:
      "Upload a clearer proof clip with the full body visible, opponent resistance visible, and the correction shown through contact.",
  };
}

function extractOutputText(data: any) {
  const direct = cleanText(data?.output_text);
  if (direct) return direct;

  const output = Array.isArray(data?.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      const text = cleanText(block?.text);
      if (text) return text;
    }
  }

  return "";
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const fileBase64 = stripDataUrl(cleanText(body?.fileBase64));
    const mimeType = cleanText(body?.mimeType || "image/png");
    const correction = cleanText(body?.correction);
    const fixNextRep = cleanText(body?.fixNextRep);
    const context = cleanText(body?.context);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        fallbackReject("Missing OPENAI_API_KEY."),
        { status: 200 }
      );
    }

    if (!fileBase64 || !correction) {
      return NextResponse.json(
        fallbackReject("Missing proof file or correction."),
        { status: 200 }
      );
    }

    if (!mimeType.startsWith("image/")) {
      return NextResponse.json(
        fallbackReject(
          "Video proof route is not enabled yet. Upload a clear image frame for V1 validation."
        ),
        { status: 200 }
      );
    }

    const systemPrompt = `
You are Disciplin Proof Judge.

You judge whether a combat-sports proof image validates one correction.

Be strict.
Do not reward effort.
Do not accept unclear proof.
Do not accept self-report.
Do not accept a clean pose with no resistance.
Do not accept if the correction is only visible before contact but breaks during contact.

You must check five gates:

1. Resistance visible:
- opponent, partner, or live defensive pressure must be visible.
- solo shadowboxing does not count unless the correction is only a solo posture correction.

2. Correction visible:
- the requested correction must be visible in the image.

3. Correction held:
- the correction must still be present at the moment of pressure/contact.

4. Rep quality:
- clean = correction held under resistance.
- partial = correction attempted but not fully stable.
- failed = correction breaks.
- unclear = angle/frame does not prove it.

5. Confidence:
- if the image angle is poor, confidence must be below 60.

Acceptance rule:
Only accept if:
- visibleResistance = true
- correctionVisible = true
- correctionHeld = true
- repQuality = "clean"
- score >= 70
- confidence >= 60

Return ONLY valid JSON.

JSON shape:
{
  "status": "accepted" | "rejected",
  "score": 0-100,
  "confidence": 0-100,
  "reason": "short technical reason",
  "visibleResistance": true | false,
  "correctionVisible": true | false,
  "correctionHeld": true | false,
  "repQuality": "clean" | "partial" | "failed" | "unclear",
  "nextRequiredProof": "what the next proof must show"
}
`.trim();

    const userPrompt = `
Correction to validate:
${correction}

Fix-next-rep instruction:
${fixNextRep || "Not provided"}

User context:
${context || "No extra context"}

Judge the proof image. Be strict. If the correction is not clearly proven under resistance, reject it.
`.trim();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5.1-mini",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: userPrompt },
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${fileBase64}`,
              },
            ],
          },
        ],
        max_output_tokens: 500,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        fallbackReject(data?.error?.message || "Proof model request failed."),
        { status: 200 }
      );
    }

    const rawText = extractOutputText(data);
    const parsed = parseJson(rawText);

    if (!parsed) {
      return NextResponse.json(
        fallbackReject("Proof judge returned invalid JSON."),
        { status: 200 }
      );
    }

    return NextResponse.json(normalizeResult(parsed), { status: 200 });
  } catch (err: any) {
    console.error("[sensei-vision-proof] route failed:", err);

    return NextResponse.json(
      fallbackReject(err?.message || "Server error during proof evaluation."),
      { status: 200 }
    );
  }
}