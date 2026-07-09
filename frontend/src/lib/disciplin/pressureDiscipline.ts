export type PressureState = "LIVE" | "LOCK" | "FALLBACK";

export type PressureSignal =
  | "missed_entry"
  | "got_hit"
  | "failed_exchange"
  | "fatigue_spike"
  | "crowd_pressure"
  | "trash_talk"
  | "rushed_tempo"
  | "ego_exchange"
  | "unknown";

export type PressureDisciplineInput = {
  activeDirective?: string | null;
  userMessage?: string | null;
  latestVisionCorrection?: string | null;
  repeatedFailureCount?: number | null;
  proofVerified?: boolean | null;
  underResistance?: boolean | null;
};

export type PressureDisciplineCard = {
  present: boolean;
  trigger: string;
  risk: string;
  stopCommand: string;
  resetCue: string;
  ifIgnored: string;
  state: PressureState;
  signal: PressureSignal;
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasAny(text: string, terms: string[]) {
  const q = text.toLowerCase();
  return terms.some((term) => q.includes(term.toLowerCase()));
}

function inferPressureSignal(message: string): PressureSignal {
  const q = message.toLowerCase();

  if (
    hasAny(q, [
      "missed shot",
      "missed entry",
      "failed shot",
      "stuffed",
      "sprawled on",
      "my double failed",
      "my single failed",
      "shot failed",
      "entry failed",
    ])
  ) {
    return "missed_entry";
  }

  if (
    hasAny(q, [
      "got hit",
      "got clipped",
      "ate a shot",
      "punched me",
      "countered me",
      "hurt me",
      "got rocked",
    ])
  ) {
    return "got_hit";
  }

  if (
    hasAny(q, [
      "failed exchange",
      "lost exchange",
      "he beat me there",
      "i lost the exchange",
      "exchange went wrong",
    ])
  ) {
    return "failed_exchange";
  }

  if (
    hasAny(q, [
      "gassed",
      "tired",
      "fatigue",
      "exhausted",
      "breathing heavy",
      "gas out",
      "cardio",
      "legs heavy",
    ])
  ) {
    return "fatigue_spike";
  }

  if (
    hasAny(q, [
      "crowd",
      "watching",
      "everyone watching",
      "pressure got to me",
      "nervous",
      "people watching",
    ])
  ) {
    return "crowd_pressure";
  }

  if (
    hasAny(q, [
      "trash talk",
      "talking",
      "he was talking",
      "angry",
      "mad",
      "wanted revenge",
      "ego",
      "provoked",
    ])
  ) {
    return "trash_talk";
  }

  if (
    hasAny(q, [
      "rushed",
      "speed up",
      "too fast",
      "panic",
      "panicked",
      "started swinging",
      "forced it",
      "overreacted",
    ])
  ) {
    return "rushed_tempo";
  }

  if (
    hasAny(q, [
      "prove myself",
      "brawl",
      "stood and traded",
      "chased the finish",
      "wanted to hurt him",
      "revenge",
      "show him",
    ])
  ) {
    return "ego_exchange";
  }

  return "unknown";
}

function buildTrigger(signal: PressureSignal) {
  switch (signal) {
    case "missed_entry":
      return "Missed entry or stuffed shot.";
    case "got_hit":
      return "Got hit or countered clean.";
    case "failed_exchange":
      return "Lost the exchange.";
    case "fatigue_spike":
      return "Fatigue spike under resistance.";
    case "crowd_pressure":
      return "External pressure changed behavior.";
    case "trash_talk":
      return "Provocation tried to pull you off-plan.";
    case "rushed_tempo":
      return "Tempo increased after pressure.";
    case "ego_exchange":
      return "Ego exchange replaced the plan.";
    default:
      return "Pressure not clearly identified yet.";
  }
}

function buildRisk(signal: PressureSignal, directive: string) {
  switch (signal) {
    case "missed_entry":
      return `Starts rushing entries and abandons ${directive}.`;
    case "got_hit":
      return `Reacts emotionally and loses ${directive}.`;
    case "failed_exchange":
      return `Tries to win the next exchange instead of fixing ${directive}.`;
    case "fatigue_spike":
      return `Technique collapses when tired and ${directive} disappears.`;
    case "crowd_pressure":
      return `Performs for the room instead of executing ${directive}.`;
    case "trash_talk":
      return "Lets provocation change tempo, posture, and decision quality.";
    case "rushed_tempo":
      return "Panic pace destroys clean mechanics.";
    case "ego_exchange":
      return "Chases dominance instead of staying technically disciplined.";
    default:
      return `Pressure may hijack ${directive}.`;
  }
}

function buildStopCommand(signal: PressureSignal) {
  switch (signal) {
    case "missed_entry":
      return "Do not speed up after failure.";
    case "got_hit":
      return "Do not answer emotion with volume.";
    case "failed_exchange":
      return "Do not chase the exchange back.";
    case "fatigue_spike":
      return "Do not add intensity when form breaks.";
    case "crowd_pressure":
      return "Do not perform for witnesses.";
    case "trash_talk":
      return "Do not let words change the plan.";
    case "rushed_tempo":
      return "Do not rush the correction.";
    case "ego_exchange":
      return "Do not fight to prove a point.";
    default:
      return "Do not let pressure change the plan.";
  }
}

function buildResetCue(signal: PressureSignal) {
  switch (signal) {
    case "missed_entry":
      return "Exhale. Rebuild stance. Step deep again.";
    case "got_hit":
      return "Guard returns first. Feet under you. Re-enter clean.";
    case "failed_exchange":
      return "Pause half a beat. Reset position. Repeat the cue.";
    case "fatigue_spike":
      return "Slow the rep. Short breath. Clean position first.";
    case "crowd_pressure":
      return "Eyes on target. Ignore the room. Execute the cue.";
    case "trash_talk":
      return "Face blank. Breath down. Make the next technical action.";
    case "rushed_tempo":
      return "Slow hands. Set feet. One clean action.";
    case "ego_exchange":
      return "Drop the ego. Return to the command.";
    default:
      return "Exhale. Reset stance. Execute the command.";
  }
}

function buildIfIgnored(signal: PressureSignal) {
  switch (signal) {
    case "missed_entry":
      return "You will chain bad entries instead of correcting the first mistake.";
    case "got_hit":
      return "You will fight angry and give away clean mechanics.";
    case "failed_exchange":
      return "You will chase recovery instead of building control.";
    case "fatigue_spike":
      return "You will mistake fatigue failure for technical failure.";
    case "crowd_pressure":
      return "You will become performative and lose the plan.";
    case "trash_talk":
      return "The opponent controls your tempo before contact.";
    case "rushed_tempo":
      return "Panic pace will hide the same flaw.";
    case "ego_exchange":
      return "You will abandon the system to win a moment.";
    default:
      return "Emotion will hijack the plan before the correction is proven.";
  }
}

function inferState(
  input: PressureDisciplineInput,
  signal: PressureSignal
): PressureState {
  const repeated = Number(input.repeatedFailureCount || 0);
  const proofVerified = input.proofVerified === true;
  const underResistance = input.underResistance === true;

  if (signal === "unknown") {
    return "FALLBACK";
  }

  if (repeated >= 2 && !proofVerified) {
    return "LOCK";
  }

  if (!underResistance) {
    return "LOCK";
  }

  if (proofVerified) {
    return "LIVE";
  }

  return "LIVE";
}

export function buildPressureDisciplineCard(
  input: PressureDisciplineInput
): PressureDisciplineCard {
  const message = cleanText(input.userMessage);
  const directive =
    cleanText(input.activeDirective) ||
    cleanText(input.latestVisionCorrection) ||
    "the correction";

  const signal = inferPressureSignal(message);
  const state = inferState(input, signal);

  return {
    present: true,
    trigger: buildTrigger(signal),
    risk: buildRisk(signal, directive),
    stopCommand: buildStopCommand(signal),
    resetCue: buildResetCue(signal),
    ifIgnored: buildIfIgnored(signal),
    state,
    signal,
  };
}

export function defaultPressureDisciplineCard(): PressureDisciplineCard {
  return {
    present: true,
    trigger: "Pressure not clearly identified yet.",
    risk: "Emotion may hijack the plan before the correction is proven.",
    stopCommand: "Do not let pressure change the plan.",
    resetCue: "Exhale. Reset stance. Execute the command.",
    ifIgnored: "You will drift from the correction under resistance.",
    state: "FALLBACK",
    signal: "unknown",
  };
}

export function pressureStateLabel(state: PressureState) {
  if (state === "LIVE") return "LIVE";
  if (state === "LOCK") return "LOCK";
  return "FALLBACK";
}

export function pressureStateMeaning(state: PressureState) {
  if (state === "LIVE") {
    return "Pressure detected. Execution still stable.";
  }

  if (state === "LOCK") {
    return "Pressure is corrupting mechanics. Progression blocked.";
  }

  return "Pressure unclear or plan abandoned. Narrow scope again.";
}