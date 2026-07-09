export type EnvironmentPace = "controlled" | "chaotic" | "elite";
export type EnvironmentLevel = "low" | "medium" | "high";
export type CorrectionDiscipline = "weak" | "moderate" | "strong";
export type TechnicalPunishment = "light" | "moderate" | "severe";
export type RecoveryCulture = "professional" | "mixed" | "poor";
export type CoachingStyle = "technical" | "motivational" | "warfare";
export type EnvironmentState = "LIVE" | "LOCK" | "FALLBACK";

export type EnvironmentProfileInput = {
  description?: string | null;
  activeDirective?: string | null;
  gymName?: string | null;
  coachNotes?: string | null;
  sparringNotes?: string | null;
};

export type EnvironmentSignal =
  | "ego_sparring"
  | "chaos_rounds"
  | "technical_room"
  | "elite_wrestling"
  | "weak_resistance"
  | "taunt_culture"
  | "coach_structure"
  | "coach_hype"
  | "poor_recovery"
  | "unknown";

export type EnvironmentProfile = {
  present: boolean;
  state: EnvironmentState;
  signal: EnvironmentSignal;

  pace: EnvironmentPace;
  egoLevel: EnvironmentLevel;
  correctionDiscipline: CorrectionDiscipline;
  emotionalPressure: EnvironmentLevel;
  technicalPunishment: TechnicalPunishment;
  recoveryCulture: RecoveryCulture;
  coachingStyle: CoachingStyle;

  systemRisk: number;

  environmentEffect: string;
  correctionSurvival: string;
  risk: string;
  directive: string;
  ifIgnored: string;
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function joinInput(input: EnvironmentProfileInput) {
  return [
    input.description,
    input.activeDirective,
    input.gymName,
    input.coachNotes,
    input.sparringNotes,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function clampRisk(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function inferSignal(text: string): EnvironmentSignal {
  if (
    hasAny(text, [
      "taunt",
      "taunts",
      "trash talk",
      "talking during rounds",
      "mock",
      "laugh",
      "laughing",
      "ego",
      "prove yourself",
      "revenge",
    ])
  ) {
    return "taunt_culture";
  }

  if (
    hasAny(text, [
      "everyone spars hard",
      "hard sparring",
      "war",
      "gym wars",
      "every round is a fight",
      "chaos",
      "brawl",
      "wild rounds",
      "no structure",
    ])
  ) {
    return "chaos_rounds";
  }

  if (
    hasAny(text, [
      "ego sparring",
      "people try to win rounds",
      "trying to hurt",
      "proving",
      "show off",
      "emotional sparring",
    ])
  ) {
    return "ego_sparring";
  }

  if (
    hasAny(text, [
      "olympic wrestler",
      "olympic wrestlers",
      "national team",
      "elite wrestlers",
      "dagestan",
      "strong wrestlers",
      "high level wrestlers",
      "wrestling room",
    ])
  ) {
    return "elite_wrestling";
  }

  if (
    hasAny(text, [
      "technical room",
      "coach corrects",
      "coach stops us",
      "detail focused",
      "structured drilling",
      "clean drilling",
      "specific correction",
      "position first",
    ])
  ) {
    return "technical_room";
  }

  if (
    hasAny(text, [
      "coach screams",
      "coach shouts",
      "hype",
      "motivational",
      "just go hard",
      "be aggressive",
      "kill him",
      "warfare",
    ])
  ) {
    return "coach_hype";
  }

  if (
    hasAny(text, [
      "coach watches details",
      "coach gives corrections",
      "coach forces technique",
      "coach resets us",
      "coach stops bad reps",
    ])
  ) {
    return "coach_structure";
  }

  if (
    hasAny(text, [
      "easy room",
      "weak partners",
      "nobody punishes",
      "comfortable",
      "too easy",
      "no resistance",
      "light resistance",
    ])
  ) {
    return "weak_resistance";
  }

  if (
    hasAny(text, [
      "no recovery",
      "everyone overtrains",
      "injuries",
      "always tired",
      "no rest",
      "poor recovery",
      "bad sleep",
    ])
  ) {
    return "poor_recovery";
  }

  return "unknown";
}

function buildProfileFromSignal(
  signal: EnvironmentSignal,
  text: string
): Omit<
  EnvironmentProfile,
  | "present"
  | "state"
  | "signal"
  | "systemRisk"
  | "environmentEffect"
  | "correctionSurvival"
  | "risk"
  | "directive"
  | "ifIgnored"
> {
  if (signal === "taunt_culture") {
    return {
      pace: "chaotic",
      egoLevel: "high",
      correctionDiscipline: "weak",
      emotionalPressure: "high",
      technicalPunishment: "moderate",
      recoveryCulture: "mixed",
      coachingStyle: "warfare",
    };
  }

  if (signal === "chaos_rounds") {
    return {
      pace: "chaotic",
      egoLevel: "high",
      correctionDiscipline: "weak",
      emotionalPressure: "high",
      technicalPunishment: "severe",
      recoveryCulture: "poor",
      coachingStyle: "warfare",
    };
  }

  if (signal === "ego_sparring") {
    return {
      pace: "chaotic",
      egoLevel: "high",
      correctionDiscipline: "weak",
      emotionalPressure: "high",
      technicalPunishment: "moderate",
      recoveryCulture: "mixed",
      coachingStyle: "warfare",
    };
  }

  if (signal === "elite_wrestling") {
    return {
      pace: "elite",
      egoLevel: hasAny(text, ["taunt", "ego", "trash talk"]) ? "medium" : "low",
      correctionDiscipline: "strong",
      emotionalPressure: "high",
      technicalPunishment: "severe",
      recoveryCulture: "professional",
      coachingStyle: "technical",
    };
  }

  if (signal === "technical_room") {
    return {
      pace: "controlled",
      egoLevel: "low",
      correctionDiscipline: "strong",
      emotionalPressure: "medium",
      technicalPunishment: "moderate",
      recoveryCulture: "professional",
      coachingStyle: "technical",
    };
  }

  if (signal === "coach_structure") {
    return {
      pace: "controlled",
      egoLevel: "low",
      correctionDiscipline: "strong",
      emotionalPressure: "medium",
      technicalPunishment: "moderate",
      recoveryCulture: "professional",
      coachingStyle: "technical",
    };
  }

  if (signal === "coach_hype") {
    return {
      pace: "chaotic",
      egoLevel: "medium",
      correctionDiscipline: "moderate",
      emotionalPressure: "high",
      technicalPunishment: "moderate",
      recoveryCulture: "mixed",
      coachingStyle: "motivational",
    };
  }

  if (signal === "weak_resistance") {
    return {
      pace: "controlled",
      egoLevel: "low",
      correctionDiscipline: "weak",
      emotionalPressure: "low",
      technicalPunishment: "light",
      recoveryCulture: "mixed",
      coachingStyle: "motivational",
    };
  }

  if (signal === "poor_recovery") {
    return {
      pace: "chaotic",
      egoLevel: "medium",
      correctionDiscipline: "moderate",
      emotionalPressure: "medium",
      technicalPunishment: "moderate",
      recoveryCulture: "poor",
      coachingStyle: "warfare",
    };
  }

  return {
    pace: "controlled",
    egoLevel: "medium",
    correctionDiscipline: "moderate",
    emotionalPressure: "medium",
    technicalPunishment: "moderate",
    recoveryCulture: "mixed",
    coachingStyle: "technical",
  };
}

function scoreEnvironment(profile: ReturnType<typeof buildProfileFromSignal>) {
  let score = 0;

  if (profile.pace === "chaotic") score += 24;
  if (profile.pace === "elite") score += 12;

  if (profile.egoLevel === "high") score += 22;
  if (profile.egoLevel === "medium") score += 10;

  if (profile.correctionDiscipline === "weak") score += 24;
  if (profile.correctionDiscipline === "moderate") score += 10;
  if (profile.correctionDiscipline === "strong") score -= 14;

  if (profile.emotionalPressure === "high") score += 18;
  if (profile.emotionalPressure === "medium") score += 8;

  if (profile.technicalPunishment === "severe") score += 10;
  if (profile.technicalPunishment === "light") score += 14;

  if (profile.recoveryCulture === "poor") score += 16;
  if (profile.recoveryCulture === "professional") score -= 10;

  if (profile.coachingStyle === "warfare") score += 16;
  if (profile.coachingStyle === "motivational") score += 8;
  if (profile.coachingStyle === "technical") score -= 8;

  return clampRisk(score);
}

function stateFromRisk(systemRisk: number): EnvironmentState {
  if (systemRisk >= 70) return "LOCK";
  if (systemRisk <= 25) return "LIVE";
  return "FALLBACK";
}

function buildEnvironmentEffect(signal: EnvironmentSignal) {
  if (signal === "taunt_culture") {
    return "This room lets words change entries.";
  }

  if (signal === "chaos_rounds") {
    return "This room rewards surviving chaos more than fixing the mistake.";
  }

  if (signal === "ego_sparring") {
    return "This room rewards winning the exchange instead of preserving the correction.";
  }

  if (signal === "elite_wrestling") {
    return "This room exposes lazy entries immediately.";
  }

  if (signal === "technical_room") {
    return "This room protects correction quality.";
  }

  if (signal === "coach_structure") {
    return "The coach is forcing technical accountability.";
  }

  if (signal === "coach_hype") {
    return "The coaching energy may raise output before the mechanic is clean.";
  }

  if (signal === "weak_resistance") {
    return "This room may let the flaw survive because nobody punishes it.";
  }

  if (signal === "poor_recovery") {
    return "This room may turn fatigue into normal training culture.";
  }

  return "Environment effect is not identified yet.";
}

function buildCorrectionSurvival(
  signal: EnvironmentSignal,
  directive: string
) {
  if (signal === "taunt_culture") {
    return `${directive} survives only if taunts do not change the next entry.`;
  }

  if (signal === "chaos_rounds") {
    return `${directive} will disappear if every round becomes a war.`;
  }

  if (signal === "ego_sparring") {
    return `${directive} fails when the goal becomes winning the moment.`;
  }

  if (signal === "elite_wrestling") {
    return `${directive} gets tested properly because bad entries are punished.`;
  }

  if (signal === "technical_room") {
    return `${directive} has a real chance to become stable.`;
  }

  if (signal === "coach_structure") {
    return `${directive} is more likely to hold because bad reps get stopped.`;
  }

  if (signal === "coach_hype") {
    return `${directive} may get buried under intensity.`;
  }

  if (signal === "weak_resistance") {
    return `${directive} may look fixed without being fixed.`;
  }

  if (signal === "poor_recovery") {
    return `${directive} may collapse because fatigue becomes the default.`;
  }

  return `${directive} needs a room that tests it under resistance.`;
}

function buildRisk(signal: EnvironmentSignal) {
  if (signal === "taunt_culture") {
    return "Opponent behavior starts choosing your pace.";
  }

  if (signal === "chaos_rounds") {
    return "You confuse intensity with improvement.";
  }

  if (signal === "ego_sparring") {
    return "You train reaction instead of command discipline.";
  }

  if (signal === "elite_wrestling") {
    return "The room will punish you fast, but that is useful if you stay technical.";
  }

  if (signal === "technical_room") {
    return "Risk is lower, but only if you accept correction instead of chasing volume.";
  }

  if (signal === "coach_structure") {
    return "Risk is lower because bad reps are interrupted.";
  }

  if (signal === "coach_hype") {
    return "You may perform for intensity and lose the technical goal.";
  }

  if (signal === "weak_resistance") {
    return "False confidence. The flaw survives because nobody exposes it.";
  }

  if (signal === "poor_recovery") {
    return "Tired mechanics become normal mechanics.";
  }

  return "The room may be shaping habits without being measured.";
}

function buildDirective(signal: EnvironmentSignal, directive: string) {
  if (signal === "taunt_culture") {
    return `Do not let taunts change ${directive}. Blank face, reset, re-enter clean.`;
  }

  if (signal === "chaos_rounds") {
    return `Do not match chaos. Keep ${directive} as the only win condition.`;
  }

  if (signal === "ego_sparring") {
    return `Do not win the exchange. Prove ${directive}.`;
  }

  if (signal === "elite_wrestling") {
    return `Use the room to test ${directive}. Do not hide from failed reps.`;
  }

  if (signal === "technical_room") {
    return `Stay in this structure and make ${directive} repeatable.`;
  }

  if (signal === "coach_structure") {
    return `Let the coach interrupt bad reps. Protect ${directive}.`;
  }

  if (signal === "coach_hype") {
    return `Lower output until ${directive} survives the pace.`;
  }

  if (signal === "weak_resistance") {
    return `Find stronger resistance or ${directive} will look fixed too early.`;
  }

  if (signal === "poor_recovery") {
    return `Reduce volume. Do not test ${directive} while fatigue owns the room.`;
  }

  return `Judge the room by whether ${directive} survives resistance.`;
}

function buildIfIgnored(signal: EnvironmentSignal) {
  if (signal === "taunt_culture") {
    return "The opponent will make you abandon your system without needing better technique.";
  }

  if (signal === "chaos_rounds") {
    return "You will become tougher without becoming cleaner.";
  }

  if (signal === "ego_sparring") {
    return "You will train the need to answer back.";
  }

  if (signal === "elite_wrestling") {
    return "You will mistake exposure for failure and leave the room that fixes you.";
  }

  if (signal === "technical_room") {
    return "You will waste a good room by chasing random work.";
  }

  if (signal === "coach_structure") {
    return "You will resist the exact feedback that makes the correction real.";
  }

  if (signal === "coach_hype") {
    return "You will confuse loud training with disciplined training.";
  }

  if (signal === "weak_resistance") {
    return "You will unlock confidence that collapses against better people.";
  }

  if (signal === "poor_recovery") {
    return "You will normalize broken movement.";
  }

  return "The environment will train you silently.";
}

export function analyzeEnvironmentProfile(
  input: EnvironmentProfileInput
): EnvironmentProfile {
  const text = joinInput(input);
  const directive =
    cleanText(input.activeDirective) || "the current correction";

  const signal = inferSignal(text);
  const base = buildProfileFromSignal(signal, text);
  const systemRisk = scoreEnvironment(base);
  const state = stateFromRisk(systemRisk);

  return {
    present: true,
    state,
    signal,
    ...base,
    systemRisk,
    environmentEffect: buildEnvironmentEffect(signal),
    correctionSurvival: buildCorrectionSurvival(signal, directive),
    risk: buildRisk(signal),
    directive: buildDirective(signal, directive),
    ifIgnored: buildIfIgnored(signal),
  };
}

export function defaultEnvironmentProfile(): EnvironmentProfile {
  return {
    present: true,
    state: "FALLBACK",
    signal: "unknown",
    pace: "controlled",
    egoLevel: "medium",
    correctionDiscipline: "moderate",
    emotionalPressure: "medium",
    technicalPunishment: "moderate",
    recoveryCulture: "mixed",
    coachingStyle: "technical",
    systemRisk: 50,
    environmentEffect: "Environment effect is not identified yet.",
    correctionSurvival:
      "The correction needs a room that tests it under resistance.",
    risk: "The room may be shaping habits without being measured.",
    directive:
      "Judge the room by whether the correction survives resistance.",
    ifIgnored: "The environment will train you silently.",
  };
}

export function environmentStateMeaning(state: EnvironmentState) {
  if (state === "LIVE") {
    return "Environment supports correction discipline.";
  }

  if (state === "LOCK") {
    return "Environment is training collapse or abandonment.";
  }

  return "Environment is mixed or unclear. More data needed.";
}

export function environmentRiskLabel(systemRisk: number) {
  if (systemRisk >= 70) return "High system risk";
  if (systemRisk >= 40) return "Mixed system risk";
  return "Low system risk";
}