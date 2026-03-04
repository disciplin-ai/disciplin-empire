import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Overlay = {
  lines?: Array<{ a: [number, number]; b: [number, number]; label?: string; tone?: "good" | "bad" | "neutral" }>;
  points?: Array<{ p: [number, number]; label?: string; tone?: "good" | "bad" | "neutral" }>;
};

type VisionResult = {
  ok: true;

  errorCode: string;
  biomechCategory: string;
  severity: number;

  primaryError: string;
  smallestCue: string;

  right: string[];
  wrong: string[];

  hindrance: string;

  drills: string[];
  safety: string[];
  questions: string[];
  tags: string[];

  gradePercent: number;

  overlay: Overlay;

  repetitionCount: number;
  scoreDelta: number | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeArr(v: any): string[] {
  return Array.isArray(v)
    ? v
        .map((x) => (typeof x === "string" ? x : String(x)))
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

function ensureMinDrills(drills: string[]) {
  const d = (drills || []).filter(Boolean);
  if (d.length >= 3) return d.slice(0, 6);

  const fallback = [
    "3×10: win inside tie → angle-step → short snap (no long pull).",
    "2×2 min: partner sprawls on cue → you re-grip + re-angle immediately (no reset).",
    "2×3 min: hand-fight rounds — forehead pressure + elbows in, feet always moving.",
  ];
  return [...d, ...fallback].slice(0, 6);
}

function normalizeOverlay(raw: any): Overlay {
  const linesRaw = Array.isArray(raw?.lines) ? raw.lines : [];
  const pointsRaw = Array.isArray(raw?.points) ? raw.points : [];

  const normPt = (p: any): [number, number] => {
    const x = clamp(Number(p?.[0] ?? p?.x ?? 0.5) || 0.5, 0, 1);
    const y = clamp(Number(p?.[1] ?? p?.y ?? 0.5) || 0.5, 0, 1);
    return [x, y];
  };

  const toneOk = (t: any) => (t === "good" || t === "bad" || t === "neutral" ? t : "neutral");

  const lines = linesRaw
    .map((l: any) => ({
      a: normPt(l?.a ?? l?.from),
      b: normPt(l?.b ?? l?.to),
      label: typeof l?.label === "string" ? l.label.slice(0, 36) : undefined,
      tone: toneOk(l?.tone),
    }))
    .slice(0, 10);

  const points = pointsRaw
    .map((p: any) => ({
      p: normPt(p?.p ?? p?.point),
      label: typeof p?.label === "string" ? p.label.slice(0, 36) : undefined,
      tone: toneOk(p?.tone),
    }))
    .slice(0, 12);

  return { lines, points };
}

function normalizeVision(raw: any): Omit<VisionResult, "repetitionCount" | "scoreDelta"> {
  const grade = clamp(Number(raw?.gradePercent ?? 0) || 0, 0, 100);

  const errorCode =
    typeof raw?.errorCode === "string" && raw.errorCode.trim() ? raw.errorCode.trim().toUpperCase() : "UNKNOWN";
  const biomechCategory =
    typeof raw?.biomechCategory === "string" && raw.biomechCategory.trim()
      ? raw.biomechCategory.trim().toLowerCase()
      : "unknown";
  const severity = clamp(Number(raw?.severity ?? 50) || 50, 0, 100);

  const right = safeArr(raw?.right);
  const wrong = safeArr(raw?.wrong);
  const drills = ensureMinDrills(safeArr(raw?.drills));
  const safety = safeArr(raw?.safety);
  const questions = safeArr(raw?.questions);
  const tags = safeArr(raw?.tags);
  const overlay = normalizeOverlay(raw?.overlay ?? raw?.annotations ?? {});

  return {
    ok: true,
    errorCode,
    biomechCategory,
    severity,
    primaryError: typeof raw?.primaryError === "string" && raw.primaryError.trim() ? raw.primaryError.trim() : "—",
    smallestCue: typeof raw?.smallestCue === "string" && raw.smallestCue.trim() ? raw.smallestCue.trim() : "—",
    right: right.length ? right : ["—"],
    wrong: wrong.length ? wrong : ["—"],
    hindrance: typeof raw?.hindrance === "string" && raw.hindrance.trim() ? raw.hindrance.trim() : "—",
    drills,
    safety,
    questions,
    tags,
    gradePercent: grade,
    overlay,
  };
}

async function fileToDataUrl(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function computeRepetitionCount(lastSessions: Array<{ error_code: string }>, currentCode: string): number {
  let streak = 0;
  for (const s of lastSessions) {
    if ((s.error_code || "").toUpperCase() === currentCode.toUpperCase()) streak++;
    else break;
  }
  return streak;
}

function computeAdaptiveGrade(baseGrade: number, repetitionStreak: number, prevGrade: number | null) {
  const repetitionPenalty = repetitionStreak >= 2 ? Math.min(12, (repetitionStreak - 1) * 4) : 0;
  const delta = prevGrade == null ? null : baseGrade - prevGrade;
  const improvementBonus = delta != null && delta > 0 ? Math.min(6, Math.floor(delta / 5) * 2) : 0;

  const final = clamp(baseGrade - repetitionPenalty + improvementBonus, 0, 100);
  return { final, delta };
}

function supaAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const supa = createClient(url, anon, { auth: { persistSession: false } });
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const { data } = await supa.auth.getUser(token);
  return data?.user?.id ?? null;
}

function pickOutputText(envelope: any): string {
  if (typeof envelope?.output_text === "string" && envelope.output_text.trim()) return envelope.output_text.trim();

  if (Array.isArray(envelope?.output)) {
    const txt = envelope.output
      .flatMap((o: any) => o?.content || [])
      .map((c: any) => c?.text)
      .filter(Boolean)
      .join("\n")
      .trim();
    if (txt) return txt;
  }
  return "";
}

/**
 * IMPORTANT:
 * In strict json_schema mode with additionalProperties:false,
 * OpenAI validates that "required" contains EVERY key in "properties".
 * To keep "optional" fields, we make them nullable and still "required".
 */
const ANALYZE_SCHEMA = {
  name: "sensei_vision_analyze",
  type: "json_schema",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      errorCode: { type: "string" },
      biomechCategory: { type: "string" },
      severity: { type: "number" },

      gradePercent: { type: "number" },
      primaryError: { type: "string" },
      smallestCue: { type: "string" },

      right: { type: "array", items: { type: "string" } },
      wrong: { type: "array", items: { type: "string" } },
      hindrance: { type: "string" },

      drills: { type: "array", items: { type: "string" } },
      safety: { type: "array", items: { type: "string" } },
      questions: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },

      overlay: {
        type: "object",
        additionalProperties: false,
        properties: {
          lines: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                a: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
                b: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
                label: { type: ["string", "null"] },
                tone: { type: ["string", "null"], enum: ["good", "bad", "neutral", null] },
              },
              required: ["a", "b", "label", "tone"],
            },
          },
          points: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                p: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
                label: { type: ["string", "null"] },
                tone: { type: ["string", "null"], enum: ["good", "bad", "neutral", null] },
              },
              required: ["p", "label", "tone"],
            },
          },
        },
        required: ["lines", "points"],
      },
    },
    required: [
      "errorCode",
      "biomechCategory",
      "severity",
      "gradePercent",
      "primaryError",
      "smallestCue",
      "right",
      "wrong",
      "hindrance",
      "drills",
      "safety",
      "questions",
      "tags",
      "overlay",
    ],
  },
};

const TIGHTEN_SCHEMA = {
  name: "sensei_vision_tighten",
  type: "json_schema",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      reply: { type: "string" },
    },
    required: ["reply"],
  },
};

async function callOpenAIAnalyze(context: string, dataUrl: string, memory: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

  const system = `
You are Sensei Vision for serious fighters.

Output rules:
- Output MUST match the provided JSON schema.
- smallestCue: one sentence, actionable.
- wrong: 3–6 bullets, concrete.
- drills: MUST be 3–6 (never empty).
- overlay coords: normalized 0..1 relative to the image.
- If the same error repeats, mention it in primaryError OR hindrance.
- For overlay label/tone, if unknown, use null or "neutral".
`.trim();

  const input = [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        { type: "input_text", text: `Context: ${context}` },
        { type: "input_text", text: `Memory: ${JSON.stringify(memory).slice(0, 2000)}` },
        { type: "input_image", image_url: dataUrl },
      ],
    },
  ];

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input,
      temperature: 0.2,
      max_output_tokens: 900,
      text: { format: ANALYZE_SCHEMA },
    }),
  });

  const rawText = await r.text();
  if (!r.ok) throw new Error(`OpenAI error (${r.status}): ${rawText.slice(0, 600)}`);

  const envelope = JSON.parse(rawText);
  const outText = pickOutputText(envelope);
  if (!outText) throw new Error("OpenAI returned empty output_text");

  const parsed = JSON.parse(outText);
  return normalizeVision(parsed);
}

async function callOpenAITighten(question: string, lastResult: any, memory: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";

  const system = `
You are Sensei Tighten.

Output rules:
- Output MUST match the provided JSON schema: { "reply": string }
- 2–6 lines max.
- NEVER restate the user question.
- No fluff. No hype.
- If multiple variables, force ONE variable and give the next sharp question.
`.trim();

  const user = `
Last analysis:
${JSON.stringify(lastResult).slice(0, 2500)}

Memory:
${JSON.stringify(memory).slice(0, 2000)}

User question:
${question}
`.trim();

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_output_tokens: 220,
      text: { format: TIGHTEN_SCHEMA },
    }),
  });

  const rawText = await r.text();
  if (!r.ok) throw new Error(`OpenAI tighten error (${r.status}): ${rawText.slice(0, 600)}`);

  const envelope = JSON.parse(rawText);
  const outText = pickOutputText(envelope);
  if (!outText) throw new Error("OpenAI returned empty output_text");

  const parsed = JSON.parse(outText);
  return { reply: typeof parsed?.reply === "string" ? parsed.reply : "Pick ONE variable. Ask again." };
}

function progressionDrills(baseDrills: string[], repetitionStreak: number, delta: number | null) {
  const drills = [...baseDrills];

  if (repetitionStreak >= 2) {
    drills.unshift("REGRESS: 3×8 — angle-step only. No snap. Win position first.");
  } else if (delta != null && delta >= 8) {
    drills.unshift("PROGRESS: 3×2 min — live tie-ups into snap/shot chain (no reset).");
  } else if (delta != null && delta > 0) {
    drills.unshift("STABILIZE: 2×2 min — tempo reps (slow entry, fast cue).");
  }

  return drills.slice(0, 6);
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Tighten JSON
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      if (String(body?.mode || "").trim() !== "tighten") {
        return NextResponse.json({ error: "Invalid request (expected {mode:'tighten'})" }, { status: 400 });
      }

      const question = String(body?.question || "").trim();
      const lastResult = body?.lastResult || null;

      if (!question) return NextResponse.json({ error: "Missing question" }, { status: 400 });
      if (!lastResult) return NextResponse.json({ error: "Missing lastResult" }, { status: 400 });

      const userId = await getUserIdFromRequest(req);
      const admin = supaAdmin();

      let memory: any = {};
      if (userId && admin) {
        const { data } = await admin
          .from("sensei_vision_sessions")
          .select("created_at,error_code,grade_percent,severity,biomech_category")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(6);

        memory = { recentSessions: data ?? [] };
      }

      const out = await callOpenAITighten(question, lastResult, memory);
      return NextResponse.json(out);
    }

    // Analyze multipart
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Invalid request (expected multipart/form-data analyze or JSON tighten)" },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const context = String(form.get("context") || "").trim();
    const image = form.get("image");

    if (!context) return NextResponse.json({ error: "Missing context" }, { status: 400 });
    if (!(image instanceof File)) return NextResponse.json({ error: "Missing image (field 'image')" }, { status: 400 });

    const dataUrl = await fileToDataUrl(image);

    const userId = await getUserIdFromRequest(req);
    const admin = supaAdmin();

    let recent: any[] = [];
    if (userId && admin) {
      const { data } = await admin
        .from("sensei_vision_sessions")
        .select("created_at,error_code,grade_percent,severity,biomech_category")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(7);

      recent = data ?? [];
    }

    const memory = { recentSessions: recent };

    const base = await callOpenAIAnalyze(context, dataUrl, memory);

    const repetitionStreak = computeRepetitionCount(recent as any[], base.errorCode);
    const prevGrade = recent?.[0]?.grade_percent ?? null;
    const { final, delta } = computeAdaptiveGrade(
      base.gradePercent,
      repetitionStreak,
      typeof prevGrade === "number" ? prevGrade : null
    );

    const drills = progressionDrills(base.drills, repetitionStreak, delta);

    const result: VisionResult = {
      ...base,
      gradePercent: final,
      repetitionCount: repetitionStreak,
      scoreDelta: delta,
      drills,
    };

    if (userId && admin) {
      await admin.from("sensei_vision_sessions").insert({
        user_id: userId,
        context,
        error_code: result.errorCode,
        biomech_category: result.biomechCategory,
        severity: result.severity,
        grade_percent: result.gradePercent,
        repetition_count: result.repetitionCount,
        cue: result.smallestCue,
        primary_error: result.primaryError,
        hindrance: result.hindrance,
        drills: result.drills,
        safety: result.safety,
        tags: result.tags,
        overlay: result.overlay,
      });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}