import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ImageValidationError,
  validateBase64Image,
} from "@/lib/security/imageValidation";
import { IMAGE_LIMITS } from "@/lib/security/imagePolicy";
import {
  acquireExpensiveRequest,
  requestIp,
  type RateLimitLease,
} from "@/lib/security/rateLimit";
import {
  logServerError,
  rateLimited,
  requestId,
  safeServerError,
  unauthorized,
} from "@/lib/security/responses";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type VisionFinding = {
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | string;
  interrupt: string;
  fix_next_rep: string;
  shot_verdict?: string;
  finish_verdict?: string;
  position_verdict?: string;
  good?: string;
  unstable?: string;
  break_point?: string;
  dashboard_detail?: string;
  cost_of_delay?: string;
  if_ignored?: string;
  short_detail?: string;
  live_rounds?: string[];
  train?: string[];
  repeat_offense_count?: number;
  pattern_line?: string;
};

type VisionAnalysis = {
  analysis_id: string;
  clipLabel: string;
  summary: string;
  findings: VisionFinding[];
};

type PosePoint = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

type SkeletonReport = {
  detected: boolean;
  landmarkCount: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  flags: string[];
  readable: string;
};

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanSentence(text?: string | null) {
  return String(text || "")
    .replace(/\.{3,}|…/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMultiline(text?: string | null) {
  return String(text || "")
    .replace(/\.{3,}|…/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripEllipses(value: unknown) {
  return String(value || "")
    .replace(/\.{3,}|…/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cutAtWordBoundary(value: string, max: number) {
  const clean = cleanSentence(value);
  if (!clean) return "";
  if (clean.length <= max) return clean;

  const sliced = clean.slice(0, max).trim();
  const lastSpace = sliced.lastIndexOf(" ");

  if (lastSpace > 30) return sliced.slice(0, lastSpace).trim();
  return sliced;
}

function clampChars(text?: string | null, max = 140) {
  return cutAtWordBoundary(cleanSentence(text), max);
}

function clampSentences(text?: string | null, maxSentences = 2, maxChars = 220) {
  const value = cleanMultiline(text);
  if (!value) return "";

  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, maxSentences);

  return cutAtWordBoundary(sentences.join(" "), maxChars);
}

function clampWords(text?: string | null, maxWords = 8, maxChars = 72) {
  const value = cleanSentence(text);
  if (!value) return "";

  const words = value.split(/\s+/).slice(0, maxWords).join(" ");
  return cutAtWordBoundary(words, maxChars);
}

function normalizeSeverity(input?: string | null): "LOW" | "MEDIUM" | "HIGH" {
  const v = cleanSentence(input).toUpperCase();
  if (v === "LOW" || v === "MEDIUM" || v === "HIGH") return v;
  return "HIGH";
}

function normalizeVerdict(input?: string | null) {
  const v = cleanSentence(input).toUpperCase();
  if (!v) return "";
  if (v.includes("DIES ON CONTACT")) return "DIES ON CONTACT";
  if (v === "FAKE") return "FAKE";
  if (v === "REAL") return "REAL";
  if (v === "CLEAN") return "CLEAN";
  if (v === "STUCK") return "STUCK";
  if (v === "BREAKING") return "BREAKING";
  if (v === "STABLE") return "STABLE";
  if (v === "UNKNOWN") return "UNKNOWN";
  return clampWords(v, 4, 28).toUpperCase();
}

function hardClean(text?: string | null) {
  return stripEllipses(text)
    .replace(
      /\b(it appears that|it seems that|consider|try to|you should|you can|maybe|might|could)\b/gi,
      ""
    )
    .replace(/\bthis means that\b/gi, "")
    .replace(/\bbecause\b/gi, "")
    .replace(/\bleads to\b/gi, "causes")
    .replace(/\binvites\b/gi, "gives")
    .replace(/\s+/g, " ")
    .trim();
}

function enforceShortCommand(text?: string | null, fallback = "Stop. Reset.") {
  const value = hardClean(text);
  if (!value) return fallback;

  const words = value
    .replace(/[.!?]+$/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  return words.length ? `${words.join(" ")}.` : fallback;
}

function enforceFix(text?: string | null) {
  const value = hardClean(text);
  if (!value) return "Fix the position. If not, reset.";

  const short = clampSentences(value, 2, 140);
  const hasFailureCondition =
    /\bif not\b/i.test(short) ||
    /\breset\b/i.test(short) ||
    /\bdoesn't count\b/i.test(short) ||
    /\bdo not count\b/i.test(short);

  if (hasFailureCondition) return short;

  return `${short.replace(/[.!?]+$/g, "")}. If not, reset.`;
}

function enforceCauseEffect(text?: string | null) {
  const value = hardClean(text);
  if (!value) return "Position breaks. You lose the exchange.";

  return clampSentences(value, 2, 180)
    .replace(/\bcan\b/gi, "will")
    .replace(/\bmay\b/gi, "will");
}

function enforceOutcome(text?: string | null) {
  const value = hardClean(text);
  if (!value) return "You repeat the same failure.";

  return clampSentences(value, 1, 160)
    .replace(/\bcan\b/gi, "will")
    .replace(/\bmay\b/gi, "will");
}

function enforceRuleList(items: unknown, maxItems = 3): string[] {
  const raw = Array.isArray(items) ? items : [];

  const cleaned = raw
    .map((item) => hardClean(String(item)))
    .filter(Boolean)
    .map((item) => {
      let line = item.replace(/[.!?]+$/g, "");

      line = line
        .replace(/^try to\s+/i, "")
        .replace(/^focus on\s+/i, "")
        .replace(/^work on\s+/i, "")
        .replace(/^make sure you\s+/i, "");

      return stripEllipses(line);
    })
    .filter(Boolean)
    .slice(0, maxItems);

  if (cleaned.length) return cleaned;

  return [
    "No reaching reps",
    "Partner gives resistance on contact",
    "Reset every failed rep",
  ];
}

function enforceTrainList(items: unknown): string[] {
  const raw = Array.isArray(items) ? items : [];

  const cleaned = raw
    .map((item) => stripEllipses(item))
    .filter(Boolean)
    .map((item) =>
      item
        .replace(/\bteaches you\b/gi, "Cue:")
        .replace(/\btrains\b/gi, "Cue:")
        .replace(/\bhelps\b/gi, "Cue:")
        .replace(/\bimproves\b/gi, "Cue:")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .slice(0, 2);

  if (cleaned.length) return cleaned;

  return [
    "Clean entry reps. Cue: hands before feet. Payoff: counter misses outside.",
    "Light resistance reps. Cue: reset every break. Payoff: bad entries disappear.",
  ];
}

function enforceVerdict(value?: string | null, fallback = "UNKNOWN") {
  const v = normalizeVerdict(value);
  return v || fallback;
}

function enforceV1Finding(raw: any): VisionFinding {
  const title = clampWords(raw?.title || "Fix the break point", 6, 56);

  return {
    title,
    severity: normalizeSeverity(raw?.severity),
    interrupt: enforceShortCommand(raw?.interrupt, "Stop. Reset."),
    fix_next_rep: enforceFix(raw?.fix_next_rep),
    shot_verdict: enforceVerdict(raw?.shot_verdict),
    finish_verdict: enforceVerdict(raw?.finish_verdict),
    position_verdict: enforceVerdict(raw?.position_verdict),
    good: enforceCauseEffect(raw?.good || "This part still works."),
    unstable: enforceCauseEffect(raw?.unstable || "Position starts to break."),
    break_point: enforceCauseEffect(
      raw?.break_point || "The exchange breaks here."
    ),
    dashboard_detail: enforceCauseEffect(
      raw?.dashboard_detail || "Bad position breaks the exchange."
    ),
    cost_of_delay: enforceOutcome(
      raw?.cost_of_delay || "You waste reps on the wrong habit."
    ),
    if_ignored: enforceOutcome(
      raw?.if_ignored || "You repeat the same failure under resistance."
    ),
    short_detail: enforceCauseEffect(
      raw?.short_detail || "The break is repeatable."
    ),
    live_rounds: enforceRuleList(raw?.live_rounds, 3),
    train: enforceTrainList(raw?.train),
    repeat_offense_count:
      typeof raw?.repeat_offense_count === "number" &&
      Number.isFinite(raw.repeat_offense_count)
        ? Math.max(0, raw.repeat_offense_count)
        : 0,
    pattern_line: enforceOutcome(
      raw?.pattern_line || "This is a repeat pattern, not a one-off mistake."
    ),
  };
}

function normalizeVisionAnalysis(
  raw: any,
  fallbackClipLabel: string
): VisionAnalysis {
  const findings = Array.isArray(raw?.findings)
    ? raw.findings.map((f: any) => enforceV1Finding(f))
    : [];

  return {
    analysis_id: cleanSentence(raw?.analysis_id || uid()),
    clipLabel: clampChars(raw?.clipLabel || fallbackClipLabel || "Frame upload", 48),
    summary: enforceCauseEffect(raw?.summary || "One correction. One fix."),
    findings,
  };
}

function getPoint(landmarks: PosePoint[], index: number): PosePoint | null {
  const p = landmarks[index];
  if (!p) return null;
  if (typeof p.x !== "number" || typeof p.y !== "number") return null;
  return p;
}

function midPoint(a: PosePoint | null, b: PosePoint | null): PosePoint | null {
  if (!a || !b) return null;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z:
      typeof a.z === "number" && typeof b.z === "number"
        ? (a.z + b.z) / 2
        : undefined,
    visibility:
      typeof a.visibility === "number" && typeof b.visibility === "number"
        ? (a.visibility + b.visibility) / 2
        : undefined,
  };
}

function horizontalDistance(a: PosePoint | null, b: PosePoint | null) {
  if (!a || !b) return null;
  return Math.abs(a.x - b.x);
}

function buildSkeletonReport(poseLandmarks: any): SkeletonReport {
  const landmarks: PosePoint[] = Array.isArray(poseLandmarks?.landmarks)
    ? poseLandmarks.landmarks
    : [];

  const detected = poseLandmarks?.detected === true && landmarks.length > 0;
  const landmarkCount =
    typeof poseLandmarks?.landmarkCount === "number"
      ? poseLandmarks.landmarkCount
      : landmarks.length;

  if (!detected) {
    return {
      detected: false,
      landmarkCount,
      confidence: "LOW",
      flags: ["No reliable skeleton detected"],
      readable:
        "Skeleton: not detected. Use image-only reasoning. Do not claim exact joint positions.",
    };
  }

  const nose = getPoint(landmarks, 0);
  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  const leftHip = getPoint(landmarks, 23);
  const rightHip = getPoint(landmarks, 24);
  const leftKnee = getPoint(landmarks, 25);
  const rightKnee = getPoint(landmarks, 26);
  const leftAnkle = getPoint(landmarks, 27);
  const rightAnkle = getPoint(landmarks, 28);

  const shoulderMid = midPoint(leftShoulder, rightShoulder);
  const hipMid = midPoint(leftHip, rightHip);
  const kneeMid = midPoint(leftKnee, rightKnee);
  const ankleMid = midPoint(leftAnkle, rightAnkle);

  const flags: string[] = [];

  const stanceWidth = horizontalDistance(leftAnkle, rightAnkle);
  if (stanceWidth !== null) {
    if (stanceWidth < 0.12) {
      flags.push("Stance appears narrow. Base may fold under pressure.");
    } else if (stanceWidth > 0.38) {
      flags.push("Stance appears wide. Re-attack speed may slow.");
    } else {
      flags.push("Stance width is readable and usable.");
    }
  }

  if (nose && hipMid) {
    const headHipOffset = Math.abs(nose.x - hipMid.x);
    if (headHipOffset > 0.16) {
      flags.push("Head is far outside hip line. Balance is compromised.");
    } else {
      flags.push("Head stays close enough to hip line.");
    }
  }

  if (shoulderMid && hipMid) {
    const shoulderHipDrop = shoulderMid.y - hipMid.y;
    if (shoulderHipDrop > -0.08) {
      flags.push("Upper body is folded low. Posture may collapse forward.");
    } else {
      flags.push("Shoulder-to-hip line remains readable.");
    }
  }

  if (nose && kneeMid) {
    const headKneeOffset = Math.abs(nose.x - kneeMid.x);
    if (headKneeOffset > 0.18) {
      flags.push("Head and knee line are separated. Entry line may be broken.");
    }
  }

  if (hipMid && ankleMid) {
    const hipBaseOffset = Math.abs(hipMid.x - ankleMid.x);
    if (hipBaseOffset > 0.16) {
      flags.push("Hips are drifting outside base. Reset before resistance.");
    }
  }

  const confidence: SkeletonReport["confidence"] =
    landmarkCount >= 30 ? "HIGH" : landmarkCount >= 18 ? "MEDIUM" : "LOW";

  return {
    detected,
    landmarkCount,
    confidence,
    flags: flags.length ? flags : ["No major body warning detected."],
    readable: [
      `Skeleton detected: ${detected}`,
      `Landmarks mapped: ${landmarkCount}`,
      `Skeleton confidence: ${confidence}`,
      "Pose flags:",
      ...flags.map((f) => `- ${f}`),
    ].join("\n"),
  };
}

function buildFallbackAnalysis(args: {
  clipLabel: string;
  sport: string;
  context: string;
  skeletonReport: SkeletonReport;
}): VisionAnalysis {
  return {
    analysis_id: uid(),
    clipLabel: clampChars(args.clipLabel || "Frame upload", 48),
    summary: "Frame is unclear. Upload the exact moment the exchange changes.",
    findings: [
      {
        title: "Upload cleaner frame",
        severity: "HIGH",
        interrupt: "Upload cleaner frame.",
        fix_next_rep:
          "Choose the exact break point. If the exchange is hidden, reset.",
        shot_verdict: "UNKNOWN",
        finish_verdict: "UNKNOWN",
        position_verdict: "UNKNOWN",
        good: args.skeletonReport.detected
          ? "Exchange is visible. Need the exact failure moment."
          : "Signal is unclear. Do not build on it.",
        unstable: "Frame misses the key reaction.",
        break_point: "Missing the moment that decides the exchange.",
        dashboard_detail: "Wrong frame teaches the wrong habit.",
        cost_of_delay: "You waste reps on the wrong habit.",
        if_ignored: "You train a guess.",
        short_detail: "Need the exact exchange.",
        live_rounds: [
          "Correction will not transfer",
          "Source frame is too weak",
          "Re-upload the break point",
        ],
        train: [
          "Show the whole exchange",
          "Show both feet",
          "Upload the failure moment",
        ],
        repeat_offense_count: 0,
        pattern_line: args.skeletonReport.detected
          ? "Need the exact moment the action changes."
          : "Cannot read the exchange clearly.",
      },
    ],
  };
}

function buildSystemPrompt(args: {
  sport: string;
  clipLabel: string;
  context: string;
  skeletonReport: SkeletonReport;
}) {
  const { sport, clipLabel, context, skeletonReport } = args;

  return `
You are Sensei Vision inside Disciplin.

You analyze ONE frame from a combat sport exchange.

You now receive TWO sources:
1. The actual uploaded image.
2. A MediaPipe skeleton report.

Use the skeleton report as supporting structure.
Do not blindly obey it if the image contradicts it.
Do not claim medical risk.
Do not diagnose injury.
Do not mention MediaPipe to the user.

Return ONLY valid JSON.

Your job:
- identify the single biggest correction
- explain what is still worth keeping
- identify where the exchange becomes unstable
- identify the exact break point
- give one stop command
- give one fix-next-rep instruction
- say what happens in live rounds if ignored
- say what to train today
- identify the weakest link in the position, even if the athlete eventually succeeds
- do not call a successful action failed; explain what would fail first against better resistance

SKELETON REPORT:
${skeletonReport.readable}

SKELETON RULES:
- If skeleton says head outside hip line, check if he can be snapped down, crossfaced, whizzered, or turned.
- If skeleton says hips outside base, check if he is reaching, stuck, or losing pressure.
- If skeleton says stance narrow, check if he can still drive, cut the corner, or finish.
- If skeleton says upper body folded low, check if he is hanging on the legs instead of finishing.
- If skeleton confidence is LOW, use it lightly and rely on the image.
- If skeleton confidence is HIGH, use it to sharpen the correction.
- Never invent invisible joints.
- Never say exact degrees unless given.

TITLE RULES:
- title must describe the fight problem, not just the body position
- title must be a complete phrase
- maximum 6 words
- never end a title with "your", "the", "a", "his", "her", "their", "with", "past", or "over"
- if title is incomplete, rewrite it shorter

GOOD TITLE EXAMPLES:
- Head position changes before contact
- Lost head position
- Reaching from too far away
- Kick leaves you stuck
- Hanging on the legs
- Chasing the finish
- Walking onto the counter
- Shot dies on contact

GOOD STOP COMMANDS:
- Get your head inside.
- Forehead on chest.
- Step your trail foot in.
- Stop reaching.
- Stop chasing the legs.
- Bring your hips with you.
- Rear hand to cheek.

STYLE ENFORCEMENT:
- sentences must be short, blunt, and direct
- remove all filler words
- no soft language
- no explanation tone
- no teaching tone
- no descriptive storytelling
- every line must feel like a command or consequence
- use gym language fighters actually say
- avoid coaching textbook vocabulary
- prefer concrete body cues over jargon

OUTPUT INTENT:
- interrupt = command only, 3–6 words max
- fix_next_rep = command + failure condition
- dashboard_detail = cause → consequence only
- if_ignored = direct outcome only
- live_rounds = consequences, not explanations
- train = exactly 2 drills
- every train item must use this format: Drill. Cue: body cue. Payoff: danger removed.
- train items must be complete
- train items must be short enough to display fully
- max 18 words per train item
- absolutely never use "..." or "…" anywhere
- if a drill is too long, rewrite it shorter instead of truncating
- do not use "teaches you", "trains", "helps", "builds", or "improves"
- one body cue only
- one fight consequence only
- remove extra setup details

WEAK FRAME RULES:
- If the frame is completely unreadable or key body landmarks are missing, return upload guidance instead of technical coaching.
- If the frame misses the exact impact moment BUT the structural mistake is still clearly visible, still generate correction, fix, train drills, and live consequences.
- Mark confidence LOW or UNKNOWN only when needed.
- Ask for cleaner frame separately; do not erase visible technical coaching.

LIVE CONSEQUENCE RULES:
- consequence must happen in a real fight
- consequence must be visible
- consequence must not describe biomechanics

BAD LANGUAGE:
- maintain structure
- support leg
- drive base
- posture integrity
- alignment
- stacked
- kinetic chain
- mechanics
- biomechanics
- efficiency
- optimization
- collapse
- rotation
- engagement
- stability

PREFER:
- forehead on chest
- head over lead knee
- ear inside ribs
- feet under you
- step wider
- hips closer
- stop reaching
- stop chasing
- push from your back foot
- lead glove to cheek
- rear glove to eyebrow
- frame hand returns to temple
- get your head back inside

Everything must be:
- works / fails
- counts / does not count
- holds / breaks

VERDICT RULES:
- shot_verdict: REAL, FAKE, DIES ON CONTACT, STABLE, UNKNOWN
- finish_verdict: CLEAN, STUCK, UNKNOWN
- position_verdict: STABLE, BREAKING, UNKNOWN

SEVERITY:
- LOW, MEDIUM, or HIGH only

CONTEXT:
Sport: ${cleanSentence(sport) || "Unknown"}
Clip label: ${cleanSentence(clipLabel) || "Frame upload"}
User context: ${cleanMultiline(context) || "None provided"}

Return JSON in this exact shape:
{
  "analysis_id": "string",
  "clipLabel": "string",
  "summary": "short summary",
  "findings": [
    {
      "title": "Stuck on the kick",
      "severity": "HIGH",
      "interrupt": "short stop command",
      "fix_next_rep": "short next rep instruction",
      "shot_verdict": "DIES ON CONTACT",
      "finish_verdict": "STUCK",
      "position_verdict": "BREAKING",
      "good": "what is still worth keeping",
      "unstable": "what starts to fail",
      "break_point": "where it actually breaks",
      "dashboard_detail": "why this matters",
      "cost_of_delay": "cost of delaying the fix",
      "if_ignored": "what happens if ignored",
      "short_detail": "short supporting detail",
      "live_rounds": ["short bullet", "short bullet"],
      "train": [
        "Jab-step entries. Cue: rear hand glued. Payoff: counter misses outside.",
        "Wall entries only. Cue: feet before chest. Payoff: he loses the counter."
      ],
      "repeat_offense_count": 0,
      "pattern_line": "short pattern line"
    }
  ]
}
`.trim();
}

function buildUserPrompt(args: {
  sport: string;
  clipLabel: string;
  context: string;
  skeletonReport: SkeletonReport;
}) {
  return `
Build one main V1 correction from this frame.

Sport: ${cleanSentence(args.sport)}
Clip label: ${cleanSentence(args.clipLabel)}
Context: ${cleanMultiline(args.context)}

Skeleton:
${args.skeletonReport.readable}

Return only the JSON object.
`.trim();
}

function extractText(resp: any): string {
  const direct = cleanMultiline(resp?.output_text);
  if (direct) return direct;

  const output = Array.isArray(resp?.output) ? resp.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      const text = cleanMultiline(block?.text);
      if (text) return text;
    }
  }

  return "";
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const id = requestId(req);
  let lease: Extract<RateLimitLease, { ok: true }> | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return unauthorized();

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > IMAGE_LIMITS.base64Characters + 1_000_000) {
      return NextResponse.json(
        { ok: false, error: "Image payload is too large." },
        { status: 413 },
      );
    }

    const acquired = acquireExpensiveRequest({
      route: "vision",
      userId: user.id,
      ip: requestIp(req),
    });
    if (!acquired.ok) return rateLimited(acquired);
    lease = acquired;

    const body = await req.json().catch(() => null);

    const clipLabel = cleanSentence(body?.clipLabel || "Frame upload");
    const context = cleanMultiline(body?.context || "");
    const sport = cleanSentence(body?.sport || "Unknown");
    const poseLandmarks = body?.poseLandmarks || null;

    const skeletonReport = buildSkeletonReport(poseLandmarks);

    if (clipLabel.length > IMAGE_LIMITS.clipLabelCharacters ||
        context.length > IMAGE_LIMITS.contextCharacters) {
      return NextResponse.json(
        { ok: false, error: "Analysis context is too long." },
        { status: 400 }
      );
    }

    const validatedImage = validateBase64Image(
      body?.imageBase64,
      body?.mimeType,
    );
    const { base64: imageBase64, mimeType } = validatedImage;

    if (!openai) {
      const fallback = buildFallbackAnalysis({
        clipLabel,
        sport,
        context,
        skeletonReport,
      });

      return NextResponse.json({ ok: true, analysis: fallback });
    }

    const systemPrompt = buildSystemPrompt({
      sport,
      clipLabel,
      context,
      skeletonReport,
    });

    const userPrompt = buildUserPrompt({
      sport,
      clipLabel,
      context,
      skeletonReport,
    });

    const resp = await openai.responses.create({
      model: "gpt-5.1",
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
              image_url: `data:${mimeType};base64,${imageBase64}`,
            },
          ],
        },
      ],
    } as any);

    const rawText = extractText(resp);
    const parsed = tryParseJson(rawText);

    if (!parsed) {
      const fallback = buildFallbackAnalysis({
        clipLabel,
        sport,
        context,
        skeletonReport,
      });

      return NextResponse.json({ ok: true, analysis: fallback });
    }

    const analysis = normalizeVisionAnalysis(parsed, clipLabel);

    if (!analysis.findings.length) {
      const fallback = buildFallbackAnalysis({
        clipLabel,
        sport,
        context,
        skeletonReport,
      });

      return NextResponse.json({ ok: true, analysis: fallback });
    }

    return NextResponse.json({
      ok: true,
      analysis,
      skeleton: skeletonReport,
    });
  } catch (err: unknown) {
    if (err instanceof ImageValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status },
      );
    }
    logServerError("sensei-vision", id, err);
    return safeServerError(id);
  } finally {
    lease?.release();
  }
}
