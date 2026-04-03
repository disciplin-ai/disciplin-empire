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
  imageBase64: z.string().min(1, "Missing imageBase64"),
  mimeType: z.string().min(1, "Missing mimeType"),
  clipLabel: z.string().optional(),
  context: z.string().optional(),
});

const VisionFindingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },

    interrupt: { type: "string" },
    fix_next_rep: { type: "string" },

    good: { type: "string" },
    unstable: { type: "string" },
    break_point: { type: "string" },

    dashboard_detail: { type: "string" },
    if_ignored: { type: "string" },
    short_detail: { type: "string" },

    train: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 4,
    },
  },
  required: [
    "title",
    "severity",
    "interrupt",
    "fix_next_rep",
    "good",
    "unstable",
    "break_point",
    "dashboard_detail",
    "if_ignored",
    "short_detail",
    "train",
  ],
} as const;

const VisionResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    analysis_id: { type: "string" },
    clipLabel: { type: "string" },
    summary: { type: "string" },
    findings: {
      type: "array",
      items: VisionFindingSchema,
      minItems: 1,
      maxItems: 5,
    },
  },
  required: ["analysis_id", "clipLabel", "summary", "findings"],
} as const;

type VisionFinding = {
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH";

  interrupt: string;
  fix_next_rep: string;

  good: string;
  unstable: string;
  break_point: string;

  dashboard_detail: string;
  if_ignored: string;
  short_detail: string;

  train: string[];
};

type VisionResponse = {
  analysis_id: string;
  clipLabel: string;
  summary: string;
  findings: VisionFinding[];
};

function getResponseText(resp: any): string {
  const direct = String(resp?.output_text ?? "").trim();
  if (direct) return direct;

  const out = resp?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (typeof c?.text === "string" && c.text.trim()) return c.text.trim();

          const nested = c?.content;
          if (Array.isArray(nested)) {
            for (const n of nested) {
              if (typeof n?.text === "string" && n.text.trim()) return n.text.trim();
            }
          }
        }
      }
    }
  }

  return "";
}

function clean(text: string) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function trimSentence(input: string, maxChars: number) {
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
    "needs work",
    "could improve",
    "looks off",
    "weak form",
    "generally poor",
    "not the best",
    "some issues",
    "a bit off",
    "slightly wrong",
  ];
  return weakPatterns.some((p) => t.includes(p));
}

function severityRank(sev: "LOW" | "MEDIUM" | "HIGH") {
  if (sev === "HIGH") return 3;
  if (sev === "MEDIUM") return 2;
  return 1;
}

function normalizeTitle(title: string) {
  const cleaned = trimSentence(title, 90);
  return cleaned || "Unclear technical issue";
}

function normalizeSummary(summary: string) {
  const cleaned = clean(summary);
  return (
    cleaned ||
    "Frame analyzed. Prioritized the highest-cost visible failure first and stripped the correction down to one usable action path."
  );
}

function normalizeCoachLine(
  value: string,
  fallback: string,
  maxChars: number,
  allowWeak = false
) {
  const cleaned = trimSentence(value, maxChars);
  if (!cleaned) return fallback;
  if (!allowWeak && containsWeakLanguage(cleaned)) return fallback;
  return cleaned;
}

function fallbackInterrupt(title: string) {
  const t = title.toLowerCase();

  if (t.includes("hips")) return "Stop. Hips under you first.";
  if (t.includes("head")) return "Stop. Head up before contact.";
  if (t.includes("hand") || t.includes("reach")) return "Stop reaching. Feet first.";
  if (t.includes("trail leg")) return "Stop. Bring the trail leg under.";
  if (t.includes("base")) return "Stop. Set your base first.";

  return "Stop. Fix the position first.";
}

function fallbackFixNextRep(title: string) {
  const t = title.toLowerCase();

  if (t.includes("hips")) return "Hips under shoulders. Step deeper, settle, then drive.";
  if (t.includes("head")) return "Head up, connected, then drive through.";
  if (t.includes("hand") || t.includes("reach")) return "Move your feet first. Do not let your hands chase.";
  if (t.includes("trail leg")) return "Bring the trail leg under so the finish has base.";
  if (t.includes("base")) return "Build the base first, then attack.";

  return "Restore position first. Then continue the rep.";
}

function fallbackGood(title: string) {
  const t = title.toLowerCase();

  if (t.includes("hips")) return "You are committing to the shot and actually trying to win the leg.";
  if (t.includes("head")) return "You are entering with intent instead of hesitating outside range.";
  if (t.includes("hand") || t.includes("reach")) return "You are closing distance instead of freezing on the outside.";
  if (t.includes("base")) return "You are attempting to drive through the exchange, not back out of it.";

  return "There is still real intent in the action. Keep that part.";
}

function fallbackUnstable(title: string) {
  const t = title.toLowerCase();

  if (t.includes("hips")) return "Your hips lag behind your upper body, so the base starts disappearing before contact.";
  if (t.includes("head")) return "Your head position drops out of line, so posture starts collapsing on entry.";
  if (t.includes("hand") || t.includes("reach")) return "Your hands start moving before your body arrives, so the entry loses structure.";
  if (t.includes("base")) return "Your base gets too narrow or too late, so force cannot stay under you.";

  return "The structure starts to collapse before the exchange is secured.";
}

function fallbackBreakPoint(title: string) {
  const t = title.toLowerCase();

  if (t.includes("hips")) return "Once the base goes, they can sprawl, stuff the head, or spin behind before you can finish.";
  if (t.includes("head")) return "Once posture breaks, they can stuff, snap, or redirect you off the line.";
  if (t.includes("hand") || t.includes("reach")) return "Once the arms arrive first, they can catch the reach and kill the entry.";
  if (t.includes("base")) return "Once the base dies, they can redirect, square up, or force a weak scramble.";

  return "Once this breaks, the opponent gets the defensive answer immediately.";
}

function fallbackDashboardDetail(title: string) {
  const t = title.toLowerCase();

  if (t.includes("hips")) {
    return "Your upper body arrives before your hips, so you lose real drive and end up finishing under their weight.";
  }
  if (t.includes("head")) {
    return "Your head position breaks the line of force, so the entry collapses on contact.";
  }
  if (t.includes("hand") || t.includes("reach")) {
    return "Your hands arrive before your body, so the entry loses structure before the finish even starts.";
  }
  if (t.includes("base")) {
    return "Your base cannot support the direction change, so the exchange breaks under pressure.";
  }

  return "This breaks the exchange early and gives the opponent a clean answer.";
}

function fallbackIfIgnored(title: string) {
  const t = title.toLowerCase();

  if (t.includes("hips")) return "Opponent sprawls, stuffs the head, or spins behind once resistance shows up.";
  if (t.includes("head")) return "Opponent stuffs the entry and redirects you off the line immediately.";
  if (t.includes("hand") || t.includes("reach")) return "Opponent catches the reach and kills the shot before the finish is built.";
  if (t.includes("trail leg")) return "Opponent angles off before you can finish or recover.";
  if (t.includes("base")) return "Opponent redirects or squares up before your finish can stabilize.";

  return "Opponent gets the defensive answer before the finish is established.";
}

function fallbackShortDetail(title: string) {
  return trimSentence(`${title}. This is a real supporting issue.`, 120);
}

function fallbackTrain(title: string): string[] {
  const t = title.toLowerCase();

  if (t.includes("hips") || t.includes("penetration")) {
    return [
      "3 x 8 slow penetration steps with hips under shoulders.",
      "3 x 5 paused entries: freeze, check posture, then continue.",
      "2 controlled rounds of wall shots focused only on hip position.",
    ];
  }

  if (t.includes("head")) {
    return [
      "3 x 6 entries with head tight to the body line before drive.",
      "3 x 5 reps where you stop if the head drops below line.",
      "2 short rounds focused only on head position at contact.",
    ];
  }

  if (t.includes("hand") || t.includes("reach")) {
    return [
      "3 x 8 entries where feet move before hands connect.",
      "3 x 5 reps stepping under the target before grabbing.",
      "2 short rounds focused only on removing reach from the entry.",
    ];
  }

  if (t.includes("base") || t.includes("feet")) {
    return [
      "3 x 8 reps building a wider stagger before contact.",
      "3 x 5 entries where you freeze after the step and check angle.",
      "2 short rounds focused only on base and direction change.",
    ];
  }

  return [
    "3 x 8 slow reps on the primary correction only.",
    "3 x 5 paused entries where you stop before the failure point.",
    "2 short rounds focused on the same fix under controlled speed.",
  ];
}

function normalizeTrain(train: string[] | undefined, title: string) {
  const cleaned = Array.isArray(train)
    ? train.map((x) => trimSentence(x, 90)).filter(Boolean).slice(0, 4)
    : [];

  if (cleaned.length >= 2) return cleaned;
  return fallbackTrain(title);
}

function sanitizeFindings(findings: VisionFinding[]) {
  const cleaned = findings
    .map((f) => {
      const title = normalizeTitle(f.title);

      return {
        title,
        severity: f.severity,

        interrupt: normalizeCoachLine(f.interrupt, fallbackInterrupt(title), 80),
        fix_next_rep: normalizeCoachLine(f.fix_next_rep, fallbackFixNextRep(title), 120),

        good: normalizeCoachLine(f.good, fallbackGood(title), 140),
        unstable: normalizeCoachLine(f.unstable, fallbackUnstable(title), 180),
        break_point: normalizeCoachLine(f.break_point, fallbackBreakPoint(title), 180),

        dashboard_detail: normalizeCoachLine(
          f.dashboard_detail,
          fallbackDashboardDetail(title),
          180,
          true
        ),
        if_ignored: normalizeCoachLine(f.if_ignored, fallbackIfIgnored(title), 140),
        short_detail: normalizeCoachLine(f.short_detail, fallbackShortDetail(title), 120, true),

        train: normalizeTrain(f.train, title),
      };
    })
    .filter((f) => f.title);

  cleaned.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  return cleaned.slice(0, 3);
}

function buildSystemPrompt() {
  return `
You are Sensei Vision for Disciplin.

You analyze combat sports frames, especially wrestling and MMA entries.
You are strict, technical, and consequence-based.
You are not a commentator. You are not motivational. You are a correction engine.

Return JSON only.

GOAL:
Identify the single highest-cost visible technical correction first.
If there are secondary issues, include only the ones that clearly support the same failure path.

STYLE RULES:
- Be direct.
- Be specific.
- Use wrestling / MMA coaching language.
- Explain what is right, what starts failing, and what breaks the exchange.
- Do not praise effort.
- Do not soften criticism.
- Do not use vague filler.

NEVER SAY:
- bad habits
- not ideal
- needs work
- could improve
- looks off
- weak form
- slightly wrong
- some issues

TITLE RULE:
Each finding title should be short and coach-like.
Examples:
- "Hips behind shoulders on the shot"
- "Head drops below opponent line"
- "Support hand reaches to the mat"

SEVERITY RULE:
- HIGH = opponent can punish immediately or the finish collapses
- MEDIUM = meaningful weakness but not the main exchange killer
- LOW = real but secondary or less punishing issue

FOR EVERY FINDING, RETURN:

1. interrupt
- A short, sharp command for mid-training
- Max 8 words

2. fix_next_rep
- One actionable instruction for the next rep
- No explanation
- Execution only

3. good
- One short line
- Something technically useful the fighter is already doing
- This is not praise. It is the part that must be preserved
- Max 140 chars

4. unstable
- One short line
- Explain what starts getting unstable
- This is the yellow stage where the exchange begins to fail
- Max 180 chars

5. break_point
- One short line
- Explain what fully breaks and what the opponent gets
- This is the red stage
- Max 180 chars

6. dashboard_detail
- Why this matters in 1-2 lines
- Max 180 chars

7. if_ignored
- What the opponent gets immediately if ignored
- One sentence max
- Max 140 chars

8. short_detail
- One-line version for supporting issues
- Max 120 chars

9. train
- 2 to 4 short drill / rep lines
- These must reinforce the same correction only
- No generic conditioning
- No unrelated themes

SUMMARY RULE:
The summary must be 2-4 sentences max.
It should describe the main correction path in plain, sharp language.

IMPORTANT:
The output must be usable immediately in training.
Do not just describe the frame.
Tell the fighter:
- what to stop
- what to keep
- what starts failing
- what breaks
- what to do next rep
- what to train today
`.trim();
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

    const { imageBase64, mimeType, clipLabel, context } = parsed.data;
    const analysisId = crypto.randomUUID();
    const finalClipLabel = clean(clipLabel || "Sensei Vision frame");

    const prompt = `
${buildSystemPrompt()}

ANALYSIS_ID: ${analysisId}
CLIP_LABEL: ${finalClipLabel}

OPTIONAL CONTEXT:
${clean(context || "No extra context provided.")}

TASK:
Analyze this combat-sports frame.
Return the highest-value visible technical correction first.
If there are secondary issues, include only the ones that clearly support the same failure path.
Prefer exchange cost over cosmetic detail.

IMPORTANT:
The primary finding must be usable immediately in training.
It is not enough to describe the issue.
You must tell the fighter what to stop, what to preserve, what starts failing, what breaks, and what happens if they ignore it.
`.trim();

    const resp = await openai.responses.create({
      model: "gpt-5.1",
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${imageBase64}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "sensei_vision_output",
          strict: true,
          schema: VisionResponseSchema,
        },
      },
    } as any);

    const raw = getResponseText(resp);

    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "Sensei Vision returned empty output." },
        { status: 500 }
      );
    }

    let out: VisionResponse;
    try {
      out = JSON.parse(raw) as VisionResponse;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Sensei Vision returned invalid JSON." },
        { status: 500 }
      );
    }

    const cleaned: VisionResponse = {
      analysis_id: analysisId,
      clipLabel: trimSentence(out.clipLabel || finalClipLabel, 80),
      summary: normalizeSummary(out.summary),
      findings: sanitizeFindings(Array.isArray(out.findings) ? out.findings : []),
    };

    if (!cleaned.findings.length) {
      cleaned.findings = [
        {
          title: "Frame too unclear for strong finding",
          severity: "LOW",
          interrupt: "Stop. Use a clearer frame.",
          fix_next_rep: "Upload a clearer frame or short clip.",
          good: "There is not enough visual clarity yet to preserve anything reliably.",
          unstable: "The visible mechanics are too unclear to identify the real failure path.",
          break_point: "Without a clearer frame, the correction will be guesswork instead of coaching.",
          dashboard_detail:
            "The frame is too unclear to return a reliable correction that changes behavior.",
          if_ignored:
            "You will train off guesswork instead of a real technical read.",
          short_detail:
            "The frame is too unclear. Use a cleaner frame or short clip.",
          train: [
            "Upload one clearer frame from the moment of contact.",
            "Use a tighter crop with the hips, shoulders, and head visible.",
          ],
        },
      ];
    }

    return NextResponse.json({
      ok: true,
      analysis: cleaned,
    });
  } catch (err: any) {
    console.error("[sensei-vision] crashed:", err);
    return NextResponse.json(
      { ok: false, error: "Sensei Vision backend crashed." },
      { status: 500 }
    );
  }
}