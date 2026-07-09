import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  FuelOutput,
  FuelRequest,
  FuelHistoryResponse,
} from "@/lib/fuelTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type PremiumFuelLayer = {
  fighter_verdict: string;
  worst_issue: string;
  fix_before_training: string;
  best_part: string;
  timing_warning: string;
};

type FuelDecisionLayer = {
  assessment: string;
  impact: string;
  decision: string;
  next_steps: string[];
  pattern_line?: string;
} & PremiumFuelLayer;

type FuelDecisionOutput = FuelOutput & FuelDecisionLayer;

type FuelPatternInputs = {
  mealsText: string;
  session?: string;
  intensity?: string;
  purpose?: string;
  fightWeek?: boolean;
  trainingTime?: string;
};

type FuelPatternResult = {
  pattern_line: string;
};

const FighterSchema = z
  .object({
    age: z.string(),
    currentWeight: z.string(),
    targetWeight: z.string(),
    bodyType: z.string(),
    paceStyle: z.string(),
  })
  .partial()
  .default({});

const TrainingSchema = z
  .object({
    session: z.string(),
    intensity: z.string(),
    goal: z.string(),
    fightWeek: z.boolean(),
    timeOfTraining: z.string(),
  })
  .partial()
  .default({});

const AnalyzeSchema = z.object({
  mode: z.literal("analyze"),
  meals: z.string().min(1, "Missing meals text"),
  fighter: FighterSchema,
  training: TrainingSchema,
});

const RefineSchema = z.object({
  mode: z.literal("refine"),
  followups_id: z.string().min(1, "Missing followups_id"),
  answers: z.record(z.string(), z.string()).default({}),
});

const HistorySchema = z.object({
  mode: z.literal("history"),
  limit: z.number().int().min(1).max(30).optional().default(8),
});

function schemaForFuelOutput() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      rating: { type: "string", enum: ["CLEAN", "MID", "TRASH"] },
      score: { type: "number" },
      score_reason: { type: "string" },

      assessment: { type: "string" },
      impact: { type: "string" },
      decision: { type: "string" },

      fighter_verdict: { type: "string" },
      worst_issue: { type: "string" },
      fix_before_training: { type: "string" },
      best_part: { type: "string" },
      timing_warning: { type: "string" },

      next_steps: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
      },

      macros: {
        type: "object",
        additionalProperties: false,
        properties: {
          calories_kcal_range: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
          },
          protein_g_range: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
          },
          carbs_g_range: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
          },
          fat_g_range: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
          },
        },
        required: [
          "calories_kcal_range",
          "protein_g_range",
          "carbs_g_range",
          "fat_g_range",
        ],
      },

      macro_confidence: {
        type: "object",
        additionalProperties: false,
        properties: {
          calories: { type: "string", enum: ["low", "med", "high"] },
          protein: { type: "string", enum: ["low", "med", "high"] },
          carbs: { type: "string", enum: ["low", "med", "high"] },
          fat: { type: "string", enum: ["low", "med", "high"] },
        },
        required: ["calories", "protein", "carbs", "fat"],
      },

      confidence: { type: "string", enum: ["low", "med", "high"] },
      report: { type: "string" },
      questions: {
        type: "array",
        items: { type: "string" },
        minItems: 0,
        maxItems: 3,
      },
      followups_id: { type: "string" },
    },
    required: [
      "rating",
      "score",
      "score_reason",
      "assessment",
      "impact",
      "decision",
      "fighter_verdict",
      "worst_issue",
      "fix_before_training",
      "best_part",
      "timing_warning",
      "next_steps",
      "macros",
      "macro_confidence",
      "confidence",
      "report",
      "questions",
      "followups_id",
    ],
  } as const;
}

function clean(text: unknown) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function cleanMultiline(text: unknown) {
  return String(text ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function trimSentence(input: unknown, max = 240) {
  const text = clean(input);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function normalizeSteps(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => trimSentence(x, 130))
    .filter(Boolean)
    .slice(0, 3);
}

function getOutputText(resp: any): string {
  const direct = String(resp?.output_text ?? resp?.outputText ?? "").trim();
  if (direct) return direct;

  const output = resp?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (typeof block?.text === "string" && block.text.trim()) {
            return block.text.trim();
          }
        }
      }
    }
  }

  return "";
}

function safeJsonParse<T>(
  raw: string
): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return { ok: false, error: "Model output was not valid JSON." };
  }
}

function buildFuelSystemRules() {
  return [
    "You are Fuel AI for Disciplin, a premium fight-camp operating system.",
    "Return JSON ONLY matching the schema.",
    "",
    "The user pays for clarity, not generic nutrition advice.",
    "Your job is to tell the fighter what this meal does to training.",
    "",
    "Non-negotiables:",
    "- Be strict, useful, direct, and specific to combat sports.",
    "- Always provide score 0-100, rating CLEAN/MID/TRASH, macro ranges, macro confidence, assessment, impact, one decision, exactly 3 next steps, and all premium fields.",
    "- Ask 1-3 follow-up questions only when portions, ingredients, sauces, oils, or timing are unclear. Otherwise return 0 questions.",
    "",
    "Premium fields:",
    "- fighter_verdict = the one-line verdict a fighter instantly understands.",
    "- worst_issue = the single biggest flaw or risk.",
    "- fix_before_training = the one fix to apply before the next session.",
    "- best_part = the strongest useful part of the meal.",
    "- timing_warning = how timing affects digestion, energy, gas tank, scrambles, sparring, rounds, recovery, or fight week.",
    "",
    "Meaning of the decision layer:",
    "- assessment = what is wrong or right with this meal for this exact training context.",
    "- impact = what this does physically and what happens in training because of it.",
    "- decision = one main call only.",
    "- next_steps = exactly 3 short direct actions.",
    "",
    "Critical reasoning rule:",
    "1. Cause = what is wrong or right.",
    "2. Effect = what it does physically.",
    "3. Consequence = what happens in training, later rounds, scrambles, pace, or recovery.",
    "",
    "Avoid weak phrases:",
    "- not ideal",
    "- could improve",
    "- bad habits",
    "- performance drops",
    "- recovery suffers",
    "- needs work",
    "- balanced meal",
    "- listen to your body",
    "",
    "Use stronger language like:",
    '- \"This is too fat-heavy for a hard session window, so digestion competes with output and the first hard scramble will feel heavier than it should.\"',
    '- \"Protein is strong, but carb timing is underbuilt for this workload, so repeat effort will fade before conditioning is the real limiter.\"',
    '- \"This is usable for recovery, but not sharp enough before live rounds.\"',
    "",
    "Fight week logic:",
    "- If fightWeek=true, prioritize low GI risk, predictable foods, carb timing, sodium/water caution, and no surprises.",
    "- Never encourage extreme dehydration, reckless cuts, or medical advice.",
    "- Mention weigh-in vs fight-day only when relevant.",
    "",
    "Medical safety:",
    "- Do not diagnose, treat, or give medical instructions.",
    "- Do not provide eating disorder advice or extreme weight-cut protocols.",
    "- Keep it as informational performance guidance.",
    "",
    "Report structure inside report:",
    "1) Summary + rating meaning",
    "2) Macro estimate ranges + uncertainty drivers",
    "3) Performance impact for the actual session/intensity",
    "4) Exact fixes with swaps/amounts/timing",
    "5) Fight week notes if relevant",
    "6) Follow-up questions if they exist",
  ].join("\n");
}

function buildAnalyzePrompt(
  meals: string,
  fighter: Record<string, unknown>,
  training: Record<string, unknown>,
  followupsId: string
) {
  return [
    buildFuelSystemRules(),
    "",
    `FOLLOWUPS_ID: ${followupsId}`,
    "",
    "FIGHTER:",
    JSON.stringify(fighter ?? {}, null, 2),
    "",
    "TRAINING:",
    JSON.stringify(training ?? {}, null, 2),
    "",
    "MEALS TEXT:",
    meals.trim(),
    "",
    "TASK:",
    "- Infer likely ingredients and portions from text only. Do not hallucinate brands.",
    "- Return one rating, one score, one assessment, one impact, one decision, all premium fields, and exactly 3 next steps.",
    "- If uncertainty exists, reflect it in macro ranges and questions.",
    "- Make the result feel worth paying $19.99/month for: specific, tactical, and useful before training.",
  ].join("\n");
}

function buildRefinePrompt(
  prior: FuelDecisionOutput,
  answers: Record<string, string>
) {
  return [
    buildFuelSystemRules(),
    "",
    "You previously generated this Fuel result:",
    JSON.stringify(prior, null, 2),
    "",
    "The user answered your follow-up questions:",
    JSON.stringify(answers, null, 2),
    "",
    "TASK:",
    "- Update the full result using the answers.",
    "- Keep the SAME followups_id.",
    "- Keep the same strict Disciplin style.",
    "- If still unclear, you may ask up to 2 new questions max.",
  ].join("\n");
}

function fallbackPremiumLayer(base: FuelOutput): PremiumFuelLayer {
  const rating = clean(base.rating).toUpperCase();

  if (rating === "TRASH") {
    return {
      fighter_verdict:
        "Do not repeat this before hard training. The session will pay for it.",
      worst_issue:
        "The meal structure does not match the training demand cleanly enough.",
      fix_before_training:
        "Simplify the meal, anchor protein, and make carbs easier to use before hard work.",
      best_part:
        "There may still be usable fuel here, but the structure is not controlled enough.",
      timing_warning:
        "If eaten too close to training, digestion can compete with output and make rounds feel heavier.",
    };
  }

  if (rating === "MID") {
    return {
      fighter_verdict:
        "Usable, but not sharp. Fix the weak point before relying on it.",
      worst_issue:
        "One part of the meal is limiting either energy delivery, digestion, or recovery.",
      fix_before_training:
        "Clean the weakest macro or timing issue instead of changing everything.",
      best_part:
        "The structure is usable enough to build from if portions are controlled.",
      timing_warning:
        "Timing will decide whether this supports the session or sits heavy during pace changes.",
    };
  }

  return {
    fighter_verdict:
      "Keep this structure. Do not ruin it with random extras.",
    worst_issue:
      "The main risk is adding unnecessary extras that change the meal profile.",
    fix_before_training:
      "Repeat the same structure with the same portion discipline.",
    best_part:
      "The meal supports the session demand and recovery goal cleanly.",
    timing_warning:
      "Keep timing consistent so the same meal produces the same training output.",
  };
}

function fallbackDecisionLayer(base: FuelOutput): FuelDecisionLayer {
  const rating = clean(base.rating).toUpperCase();
  const premium = fallbackPremiumLayer(base);

  if (rating === "TRASH") {
    return {
      ...premium,
      assessment:
        "This meal does not support the current training window cleanly enough.",
      impact:
        "Digestion, energy delivery, or recovery support is off for the session demand, so the session will feel harder than it should and repeat effort will drop faster.",
      decision:
        "Do not repeat this meal structure for this training context.",
      next_steps: [
        "Tighten the meal down to a simpler, more predictable structure.",
        "Push protein high enough to anchor recovery and satiety.",
        "Clean up carb timing and reduce excess fats before hard work.",
      ],
    };
  }

  if (rating === "MID") {
    return {
      ...premium,
      assessment:
        "This meal is usable, but it is still limiting performance or recovery somewhere.",
      impact:
        "You can train on it, but the support is not sharp enough for the session demand, so output or recovery will be capped more than necessary.",
      decision:
        "Use this only if you clean up the weak part before repeating it.",
      next_steps: [
        "Tighten the weakest macro instead of changing everything.",
        "Make the pre-session fuel more predictable and easier to use.",
        "Log sauces, oils, and hidden extras more accurately next time.",
      ],
    };
  }

  return {
    ...premium,
    assessment:
      "This meal is broadly aligned with the session demand and recovery goal.",
    impact:
      "Energy delivery and recovery support are solid enough to help the session instead of dragging it down, provided portions are close to what was logged.",
    decision:
      "Keep this structure and repeat it when the same session context returns.",
    next_steps: [
      "Repeat this structure with the same portion discipline.",
      "Keep protein anchored at each meal instead of drifting lower.",
      "Protect the timing and avoid adding random extras that change the profile.",
    ],
  };
}

function normalizeFuelDecisionOutput(raw: FuelDecisionOutput): FuelDecisionOutput {
  const base: FuelOutput = {
    rating:
      raw.rating === "CLEAN" || raw.rating === "MID" || raw.rating === "TRASH"
        ? raw.rating
        : "MID",
    score:
      typeof raw.score === "number"
        ? Math.max(0, Math.min(100, raw.score))
        : 50,
    score_reason:
      trimSentence(raw.score_reason, 180) ||
      "Score returned without a usable reason.",
    macros: {
      calories_kcal_range: raw.macros?.calories_kcal_range || [0, 0],
      protein_g_range: raw.macros?.protein_g_range || [0, 0],
      carbs_g_range: raw.macros?.carbs_g_range || [0, 0],
      fat_g_range: raw.macros?.fat_g_range || [0, 0],
    },
    macro_confidence: {
      calories:
        raw.macro_confidence?.calories === "low" ||
        raw.macro_confidence?.calories === "med" ||
        raw.macro_confidence?.calories === "high"
          ? raw.macro_confidence.calories
          : "low",
      protein:
        raw.macro_confidence?.protein === "low" ||
        raw.macro_confidence?.protein === "med" ||
        raw.macro_confidence?.protein === "high"
          ? raw.macro_confidence.protein
          : "low",
      carbs:
        raw.macro_confidence?.carbs === "low" ||
        raw.macro_confidence?.carbs === "med" ||
        raw.macro_confidence?.carbs === "high"
          ? raw.macro_confidence.carbs
          : "low",
      fat:
        raw.macro_confidence?.fat === "low" ||
        raw.macro_confidence?.fat === "med" ||
        raw.macro_confidence?.fat === "high"
          ? raw.macro_confidence.fat
          : "low",
    },
    confidence:
      raw.confidence === "low" ||
      raw.confidence === "med" ||
      raw.confidence === "high"
        ? raw.confidence
        : "low",
    report: cleanMultiline(raw.report) || "No report returned.",
    questions: Array.isArray(raw.questions)
      ? raw.questions.map((q) => trimSentence(q, 120)).filter(Boolean).slice(0, 3)
      : [],
    followups_id: clean(raw.followups_id) || crypto.randomUUID(),
  };

  const fallback = fallbackDecisionLayer(base);
  const normalizedSteps = normalizeSteps(raw.next_steps);

  return {
    ...base,
    assessment: trimSentence(raw.assessment, 420) || fallback.assessment,
    impact: trimSentence(raw.impact, 360) || fallback.impact,
    decision: trimSentence(raw.decision, 260) || fallback.decision,

    fighter_verdict:
      trimSentence(raw.fighter_verdict, 260) || fallback.fighter_verdict,
    worst_issue: trimSentence(raw.worst_issue, 360) || fallback.worst_issue,
    fix_before_training:
      trimSentence(raw.fix_before_training, 340) ||
      fallback.fix_before_training,
    best_part: trimSentence(raw.best_part, 260) || fallback.best_part,
    timing_warning:
      trimSentence(raw.timing_warning, 260) || fallback.timing_warning,

    next_steps:
      normalizedSteps.length === 3 ? normalizedSteps : fallback.next_steps,
    pattern_line: trimSentence(raw.pattern_line, 360) || "",
  };
}

function includesAny(text: string, words: string[]) {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w));
}

function classifyMealPattern(mealsText: string) {
  const text = mealsText.toLowerCase();

  const highFatSignals = [
    "olive oil",
    "avocado",
    "peanut butter",
    "almonds",
    "nuts",
    "butter",
    "cheese",
    "mayo",
    "mayonnaise",
    "cream",
    "sour cream",
    "egg yolk",
    "salmon",
  ];

  const carbSignals = [
    "rice",
    "potato",
    "bread",
    "banana",
    "oats",
    "pasta",
    "honey",
    "jam",
    "fruit",
    "dates",
    "toast",
    "cereal",
    "wrap",
  ];

  const proteinSignals = [
    "chicken",
    "beef",
    "eggs",
    "egg",
    "fish",
    "tuna",
    "turkey",
    "greek yogurt",
    "yogurt",
    "whey",
    "protein",
    "steak",
  ];

  const riskyFightWeekSignals = [
    "fried",
    "takeaway",
    "takeout",
    "spicy",
    "burger",
    "pizza",
    "cheat meal",
    "fast food",
    "ice cream",
    "buffet",
    "crisps",
    "chips",
    "chocolate",
    "soda",
    "cola",
  ];

  return {
    highFat: includesAny(text, highFatSignals),
    hasCarbs: includesAny(text, carbSignals),
    hasProtein: includesAny(text, proteinSignals),
    fightWeekRisk: includesAny(text, riskyFightWeekSignals),
  };
}

function normalizeSession(value?: string) {
  const v = String(value || "").toLowerCase();

  if (v.includes("mma")) return "mma";
  if (v.includes("wrest")) return "wrestling";
  if (v.includes("spar")) return "sparring";
  if (v.includes("box")) return "boxing";
  if (v.includes("strength")) return "strength";
  if (v.includes("run")) return "run";
  if (v.includes("rest")) return "rest";

  return v || "";
}

function isTrainingWindow(trainingTime?: string) {
  const t = String(trainingTime || "").toLowerCase();

  if (!t) return false;

  return (
    t.includes("pre") ||
    t.includes("before") ||
    t.includes("pm") ||
    t.includes("am") ||
    t.includes("session") ||
    t.includes("spar") ||
    t.includes("training")
  );
}

async function detectFuelPattern(args: {
  sb: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  current: FuelPatternInputs;
}): Promise<FuelPatternResult> {
  const { sb, userId, current } = args;

  const { data, error } = await sb
    .from("fuel_reports")
    .select(
      "meals_text, session, intensity, purpose, fight_week, training_time, score, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error || !data?.length) {
    return { pattern_line: "" };
  }

  const currentSession = normalizeSession(current.session);
  const currentClass = classifyMealPattern(current.mealsText || "");
  const currentIsTrainingWindow = isTrainingWindow(current.trainingTime);

  let repeatedHighFatPreTraining = 0;
  let repeatedLowCarbTraining = 0;
  let repeatedFightWeekRisk = 0;
  let repeatedLowScore = 0;

  for (const row of data) {
    const rowClass = classifyMealPattern(String(row.meals_text || ""));
    const rowSession = normalizeSession(String(row.session || ""));
    const rowFightWeek = !!row.fight_week;
    const rowIsTrainingWindow = isTrainingWindow(String(row.training_time || ""));

    const sameSession =
      !!currentSession && !!rowSession && currentSession === rowSession;

    const sameTrainingContext =
      sameSession || (!currentSession && rowIsTrainingWindow);

    if (sameTrainingContext || currentIsTrainingWindow) {
      if (rowClass.highFat && rowIsTrainingWindow) {
        repeatedHighFatPreTraining += 1;
      }

      if (!rowClass.hasCarbs && rowIsTrainingWindow) {
        repeatedLowCarbTraining += 1;
      }
    }

    if (rowFightWeek && rowClass.fightWeekRisk) {
      repeatedFightWeekRisk += 1;
    }

    if (typeof row.score === "number" && row.score < 70) {
      repeatedLowScore += 1;
    }
  }

  if (
    current.fightWeek &&
    currentClass.fightWeekRisk &&
    repeatedFightWeekRisk >= 1
  ) {
    return {
      pattern_line:
        "Pattern: your fight-week food choices keep carrying too much GI risk, which makes your fueling less predictable when it needs to be the cleanest.",
    };
  }

  if (
    currentClass.highFat &&
    currentIsTrainingWindow &&
    repeatedHighFatPreTraining >= 2
  ) {
    return {
      pattern_line:
        "Pattern: you keep pushing fats too high before training, which slows usable fuel and makes hard sessions feel heavier than they should.",
    };
  }

  if (
    !currentClass.hasCarbs &&
    currentIsTrainingWindow &&
    repeatedLowCarbTraining >= 2
  ) {
    return {
      pattern_line:
        "Pattern: you keep underbuilding carbs around training, so repeat effort and pace support stay lower than they should.",
    };
  }

  if (repeatedLowScore >= 3) {
    return {
      pattern_line:
        "Pattern: your recent fuel decisions keep landing below standard, which means this is no longer one bad meal — it is a repeated preparation issue.",
    };
  }

  return { pattern_line: "" };
}

async function runFuelModel(prompt: string): Promise<FuelDecisionOutput> {
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
        name: "fuel_output",
        schema: schemaForFuelOutput(),
        strict: true,
      },
    },
  } as any);

  const raw = getOutputText(resp);
  if (!raw) {
    throw new Error("Fuel returned empty output text.");
  }

  const parsedJson = safeJsonParse<FuelDecisionOutput>(raw);
  if (!parsedJson.ok) {
    throw new Error(parsedJson.error);
  }

  return normalizeFuelDecisionOutput(parsedJson.value);
}

async function saveFuelReport(
  sb: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  mode: "text" | "refine",
  out: FuelDecisionOutput,
  context: FuelPatternInputs
) {
  const premiumReportBlock = [
    "",
    "Premium Decision Layer:",
    `Fighter verdict: ${out.fighter_verdict}`,
    `Worst issue: ${out.worst_issue}`,
    `Fix before training: ${out.fix_before_training}`,
    `Best part: ${out.best_part}`,
    `Timing warning: ${out.timing_warning}`,
  ].join("\n");

  const payload = {
    user_id: userId,
    mode,
    followups_id: out.followups_id,
    rating: out.rating,
    score: Math.round(out.score),
    score_reason: out.score_reason,

    assessment: out.assessment,
    impact: out.impact,
    decision: out.decision,
    next_steps: out.next_steps,
    pattern_line: out.pattern_line || "",

    calories_kcal_range: out.macros.calories_kcal_range,
    protein_g_range: out.macros.protein_g_range,
    carbs_g_range: out.macros.carbs_g_range,
    fat_g_range: out.macros.fat_g_range,

    macro_confidence: out.macro_confidence,
    confidence: out.confidence,
    report: `${out.report}${premiumReportBlock}`,
    questions: out.questions,

    meals_text: context.mealsText,
    session: context.session ?? null,
    intensity: context.intensity ?? null,
    purpose: context.purpose ?? null,
    fight_week: !!context.fightWeek,
    training_time: context.trainingTime ?? null,
  };

  const { error } = await sb.from("fuel_reports").insert(payload);
  if (error) {
    throw new Error(error.message);
  }
}

function rowToFuelDecisionOutput(row: any): FuelDecisionOutput {
  const base: FuelDecisionOutput = {
    rating:
      row.rating === "CLEAN" || row.rating === "MID" || row.rating === "TRASH"
        ? row.rating
        : "MID",
    score: typeof row.score === "number" ? row.score : 50,
    score_reason: row.score_reason || "",
    macros: {
      calories_kcal_range: row.calories_kcal_range || [0, 0],
      protein_g_range: row.protein_g_range || [0, 0],
      carbs_g_range: row.carbs_g_range || [0, 0],
      fat_g_range: row.fat_g_range || [0, 0],
    },
    macro_confidence: row.macro_confidence || {
      calories: "low",
      protein: "low",
      carbs: "low",
      fat: "low",
    },
    confidence: row.confidence || "low",
    report: row.report || "",
    questions: Array.isArray(row.questions) ? row.questions : [],
    followups_id: row.followups_id || crypto.randomUUID(),

    assessment: row.assessment || "",
    impact: row.impact || "",
    decision: row.decision || "",
    next_steps: Array.isArray(row.next_steps) ? row.next_steps : [],
    pattern_line: row.pattern_line || "",

    fighter_verdict: "",
    worst_issue: "",
    fix_before_training: "",
    best_part: "",
    timing_warning: "",
  };

  return normalizeFuelDecisionOutput(base);
}

export async function POST(req: Request) {
  try {
    const sb = await createSupabaseServerClient();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as FuelRequest | null;

    if (!body || typeof body !== "object" || !("mode" in body)) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body." },
        { status: 400 }
      );
    }

    if (body.mode === "history") {
      const parsed = HistorySchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: parsed.error.message },
          { status: 400 }
        );
      }

      const { data, error } = await sb
        .from("fuel_reports")
        .select("created_at, score")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(parsed.data.limit ?? 8);
       const points = (data ?? []).map((r: any) => {
  const d = new Date(r.created_at);

  const day = `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return {
    day,
    created_at: r.created_at,
    fuel_score:
      typeof r.score === "number" ? r.score : null,
  };
});
      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
const resp: FuelHistoryResponse = {
  ok: true,
  points,
};

return NextResponse.json(resp);
      return NextResponse.json(resp);
    }

    if (body.mode === "refine") {
      const parsed = RefineSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: parsed.error.message },
          { status: 400 }
        );
      }

      const { data: priorRow, error: priorErr } = await sb
        .from("fuel_reports")
        .select("*")
        .eq("user_id", user.id)
        .eq("followups_id", parsed.data.followups_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (priorErr || !priorRow) {
        return NextResponse.json(
          {
            ok: false,
            error: "Could not find prior Fuel report for that followups_id.",
          },
          { status: 404 }
        );
      }

      const prior = rowToFuelDecisionOutput(priorRow);

      const out = await runFuelModel(
        buildRefinePrompt(prior, parsed.data.answers)
      );

      const refineContext: FuelPatternInputs = {
        mealsText: String(priorRow.meals_text || ""),
        session: String(priorRow.session || ""),
        intensity: String(priorRow.intensity || ""),
        purpose: String(priorRow.purpose || ""),
        fightWeek: !!priorRow.fight_week,
        trainingTime: String(priorRow.training_time || ""),
      };

      const pattern = await detectFuelPattern({
        sb,
        userId: user.id,
        current: refineContext,
      });

      const finalOut: FuelDecisionOutput = {
        ...out,
        pattern_line: pattern.pattern_line || "",
      };

      await saveFuelReport(sb, user.id, "refine", finalOut, refineContext);

      return NextResponse.json({
        ok: true,
        ...finalOut,
      });
    }

    const parsed = AnalyzeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.message },
        { status: 400 }
      );
    }

    const followupsId = crypto.randomUUID();

    const out = await runFuelModel(
      buildAnalyzePrompt(
        parsed.data.meals,
        parsed.data.fighter,
        parsed.data.training,
        followupsId
      )
    );

    const currentContext: FuelPatternInputs = {
      mealsText: parsed.data.meals,
      session: parsed.data.training?.session,
      intensity: parsed.data.training?.intensity,
      purpose: parsed.data.training?.goal,
      fightWeek: parsed.data.training?.fightWeek,
      trainingTime: parsed.data.training?.timeOfTraining,
    };

    const pattern = await detectFuelPattern({
      sb,
      userId: user.id,
      current: currentContext,
    });

    const finalOut: FuelDecisionOutput = {
      ...out,
      pattern_line: pattern.pattern_line || "",
    };

    await saveFuelReport(sb, user.id, "text", finalOut, currentContext);

    return NextResponse.json({
      ok: true,
      ...finalOut,
    });
  } catch (err: any) {
    console.error("Fuel crashed:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Fuel backend crashed.",
      },
      { status: 500 }
    );
  }
}