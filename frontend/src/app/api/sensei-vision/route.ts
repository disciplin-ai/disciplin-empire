import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import type { VisionAnalysis } from "@/lib/senseiVisionTypes";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const RequestSchema = z.object({
  clipLabel: z.string().optional().default("Frame upload"),
  sport: z.string().optional().default("MMA"),
  notes: z.string().optional().default(""),
  imageBase64: z.string().min(1, "Missing imageBase64"),
});

function buildAllowedFixFamily(technique: string, discipline: string): string[] {
  const t = technique.toLowerCase();
  const d = discipline.toLowerCase();

  if (d === "striking") {
    if (t.includes("high kick") || t.includes("head kick") || t.includes("round kick")) {
      return [
        "support_foot_pivot",
        "hip_turn",
        "chamber_height",
        "guard_position",
        "balance_over_base_leg",
        "torso_posture",
        "extension_path",
        "retraction",
      ];
    }

    if (t.includes("jab")) {
      return [
        "lead_shoulder",
        "rear_hand_guard",
        "elbow_path",
        "chin_position",
        "stance_base",
        "recovery_line",
      ];
    }

    if (t.includes("cross")) {
      return [
        "rear_hip_rotation",
        "rear_heel_turn",
        "rear_shoulder_path",
        "rear_hand_recovery",
        "chin_position",
        "stance_integrity",
      ];
    }

    return [
      "balance",
      "guard_position",
      "hip_turn",
      "posture",
      "range_control",
      "recovery",
    ];
  }

  if (d === "wrestling") {
    if (t.includes("double leg") || t.includes("shot") || t.includes("entry") || t.includes("level change")) {
      return [
        "level_change",
        "penetration_step",
        "head_position",
        "rear_leg_drive",
        "knee_line",
        "posture",
      ];
    }

    if (t.includes("sprawl")) {
      return [
        "hip_pressure",
        "leg_kickback",
        "chest_weight",
        "head_control",
        "base_width",
      ];
    }

    return [
      "base_integrity",
      "head_position",
      "pressure",
      "posture",
      "balance",
      "timing",
    ];
  }

  if (d === "grappling") {
    return [
      "hip_position",
      "base",
      "weight_distribution",
      "head_position",
      "control_points",
      "balance",
    ];
  }

  if (d === "clinch") {
    return [
      "head_position",
      "posture",
      "frames",
      "underhook_position",
      "balance",
      "pressure",
    ];
  }

  return ["unknown"];
}

function buildPrompt(input: {
  clipLabel: string;
  sport: string;
  notes: string;
}) {
  return `
You are SenseiVision for combat sports.

You must analyze the uploaded frame in this exact order:
1. Detect the discipline shown in the image.
2. Detect the technique shown in the image.
3. Restrict corrections to the matching technique family only.
4. Output strict JSON only.

Rules:
- If the frame is a striking frame (for example high kick, jab, cross, round kick), do NOT give wrestling, takedown, sprawl, hand-fight, re-shot, level-change, or cage-entry corrections.
- If the frame is a wrestling frame, do NOT give kicking or striking mechanics.
- If confidence is low, say so clearly and keep the fix conservative.
- The output must be frame-grounded, not generic MMA advice.
- If user notes mention a high kick or kicking form, strongly bias toward striking unless the image clearly contradicts it.

Context:
- Clip label: ${input.clipLabel}
- User selected sport: ${input.sport}
- User note: ${input.notes || "No note"}

Return JSON with these exact fields:
{
  "analysis_id": "string",
  "clipLabel": "string",
  "discipline_detected": "striking | wrestling | grappling | clinch | unknown",
  "technique_detected": "string",
  "confidence": "low | med | high",
  "allowed_fix_family": ["string"],
  "what_you_did_right": ["string"],
  "primary_error": "string",
  "why_it_matters": "string",
  "one_fix": "string",
  "drills": ["string"],
  "safety": ["string"],
  "findings": [
    {
      "id": "string",
      "title": "string",
      "severity": "LOW | MEDIUM | HIGH",
      "detail": "string"
    }
  ]
}
`.trim();
}

function responseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      analysis_id: { type: "string" },
      clipLabel: { type: "string" },
      discipline_detected: {
        type: "string",
        enum: ["striking", "wrestling", "grappling", "clinch", "unknown"],
      },
      technique_detected: { type: "string" },
      confidence: { type: "string", enum: ["low", "med", "high"] },
      allowed_fix_family: {
        type: "array",
        items: { type: "string" },
      },
      what_you_did_right: {
        type: "array",
        items: { type: "string" },
      },
      primary_error: { type: "string" },
      why_it_matters: { type: "string" },
      one_fix: { type: "string" },
      drills: {
        type: "array",
        items: { type: "string" },
      },
      safety: {
        type: "array",
        items: { type: "string" },
      },
      findings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
            detail: { type: "string" },
          },
          required: ["id", "title", "severity", "detail"],
        },
      },
    },
    required: [
      "analysis_id",
      "clipLabel",
      "discipline_detected",
      "technique_detected",
      "confidence",
      "allowed_fix_family",
      "what_you_did_right",
      "primary_error",
      "why_it_matters",
      "one_fix",
      "drills",
      "safety",
      "findings",
    ],
  } as const;
}

function hasStrikingTechnique(technique: string) {
  const t = technique.toLowerCase();
  return (
    t.includes("kick") ||
    t.includes("jab") ||
    t.includes("cross") ||
    t.includes("hook") ||
    t.includes("uppercut") ||
    t.includes("teep") ||
    t.includes("knee")
  );
}

function containsWrestlingLanguage(text: string) {
  const s = text.toLowerCase();
  const blocked = [
    "level change",
    "penetration step",
    "double leg",
    "single leg",
    "re-shot",
    "sprawl",
    "hand fight",
    "underhook",
    "cage entry",
    "shot entry",
  ];
  return blocked.some((x) => s.includes(x));
}

function sanitizeAnalysis(a: VisionAnalysis): VisionAnalysis {
  const mergedText = [
    a.primary_error,
    a.why_it_matters,
    a.one_fix,
    ...(Array.isArray(a.drills) ? a.drills : []),
    ...(Array.isArray(a.safety) ? a.safety : []),
    ...(Array.isArray(a.findings) ? a.findings.map((f) => `${f.title} ${f.detail}`) : []),
  ].join(" ");

  const shouldBlockWrestlingLanguage =
    a.discipline_detected === "striking" || hasStrikingTechnique(a.technique_detected);

  if (shouldBlockWrestlingLanguage && containsWrestlingLanguage(mergedText)) {
    return {
      ...a,
      primary_error: "Support foot and hip mechanics are not aligned with the kick.",
      why_it_matters:
        "If the base foot and hip do not open correctly, height and power leak while balance gets worse.",
      one_fix:
        "Turn the support foot earlier and let the hip open before forcing full extension.",
      drills: [
        "Wall-supported slow high-kick reps",
        "Support-foot pivot reps",
        "Chamber → extend → retract control reps",
      ],
      safety: [
        "Do not force height before the hip opens.",
        "Keep the base leg stable before chasing speed.",
      ],
      findings: [
        {
          id: "f1",
          title: "Kick mechanics mismatch",
          severity: "HIGH",
          detail: "The frame reads as striking, so corrections are restricted to kick mechanics only.",
        },
      ],
      allowed_fix_family: buildAllowedFixFamily(a.technique_detected, "striking"),
    };
  }

  return a;
}

function normalizeAnalysis(analysis: Partial<VisionAnalysis>, clipLabel: string): VisionAnalysis {
  const discipline = analysis.discipline_detected ?? "unknown";
  const technique = analysis.technique_detected ?? "unknown";

  return {
    analysis_id:
      typeof analysis.analysis_id === "string" && analysis.analysis_id.trim()
        ? analysis.analysis_id
        : crypto.randomUUID(),
    clipLabel:
      typeof analysis.clipLabel === "string" && analysis.clipLabel.trim()
        ? analysis.clipLabel
        : clipLabel,
    discipline_detected: discipline,
    technique_detected: technique,
    confidence: analysis.confidence ?? "low",
    allowed_fix_family: Array.isArray(analysis.allowed_fix_family)
      ? analysis.allowed_fix_family
      : buildAllowedFixFamily(technique, discipline),
    what_you_did_right: Array.isArray(analysis.what_you_did_right)
      ? analysis.what_you_did_right
      : [],
    primary_error:
      typeof analysis.primary_error === "string"
        ? analysis.primary_error
        : "No primary error returned.",
    why_it_matters:
      typeof analysis.why_it_matters === "string"
        ? analysis.why_it_matters
        : "No explanation returned.",
    one_fix:
      typeof analysis.one_fix === "string"
        ? analysis.one_fix
        : "No fix returned.",
    drills: Array.isArray(analysis.drills) ? analysis.drills : [],
    safety: Array.isArray(analysis.safety) ? analysis.safety : [],
    findings: Array.isArray(analysis.findings) ? analysis.findings : [],
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.message,
        },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing OPENAI_API_KEY on the server.",
        },
        { status: 500 }
      );
    }

    const prompt = buildPrompt(parsed.data);

    const imageDataUrl = parsed.data.imageBase64.startsWith("data:")
      ? parsed.data.imageBase64
      : `data:image/jpeg;base64,${parsed.data.imageBase64}`;

    const resp = await openai.responses.create({
      model: "gpt-5.1",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "sensei_vision_analysis",
          schema: responseSchema(),
          strict: true,
        },
      },
    } as any);

    const raw = String((resp as any).output_text ?? "").trim();

    if (!raw) {
      return NextResponse.json(
        {
          ok: false,
          error: "SenseiVision returned empty output.",
        },
        { status: 500 }
      );
    }

    let parsedAnalysis: Partial<VisionAnalysis>;
    try {
      parsedAnalysis = JSON.parse(raw) as Partial<VisionAnalysis>;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "SenseiVision returned invalid JSON.",
          raw,
        },
        { status: 500 }
      );
    }

    let analysis = normalizeAnalysis(parsedAnalysis, parsed.data.clipLabel);
    analysis = sanitizeAnalysis(analysis);

    return NextResponse.json({
      ok: true,
      analysis,
    });
  } catch (err: any) {
    console.error("SenseiVision route crashed:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          typeof err?.message === "string"
            ? err.message
            : "SenseiVision backend crashed.",
        raw:
          typeof err?.toString === "function"
            ? err.toString()
            : undefined,
      },
      { status: 500 }
    );
  }
}