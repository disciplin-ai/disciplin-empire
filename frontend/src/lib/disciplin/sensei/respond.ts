// src/lib/disciplin/sensei/respond.ts

import type {
  CampState,
  DailySession,
  SenseiIntent,
  SenseiResponse,
} from "../types";

function detectIntent(message: string): SenseiIntent {
  const m = message.toLowerCase();

  if (m.includes("why") && m.includes("directive")) return "why-directive";
  if (m.includes("generate") && m.includes("session")) return "generate-session";
  if (m.includes("mobility") || m.includes("warm up") || m.includes("warmup")) {
    return "mobility-session";
  }
  if (m.includes("why") && m.includes("gym")) return "why-gym";
  if (m.includes("weight")) return "weight-check";
  if (m.includes("vision") || m.includes("frame") || m.includes("mistake")) {
    return "vision-followup";
  }
  if (m.includes("meal") || m.includes("fuel") || m.includes("nutrition")) {
    return "fuel-followup";
  }

  return "general";
}

function buildMobilitySession(): DailySession {
  return {
    title: "15-Minute Morning Mobility",
    objective: "Open the body and prepare for clean training positions.",
    blocks: [
      { title: "Neck + shoulders", durationMin: 3, notes: "Move slowly. No jerking." },
      { title: "Thoracic + hips", durationMin: 4, notes: "Prioritize rotation and hip opening." },
      { title: "Ankles + knees", durationMin: 3, notes: "Controlled range only." },
      { title: "Stance flow", durationMin: 5, notes: "Shadow movement with posture discipline." },
    ],
  };
}

export function respondAsSensei(
  campState: CampState,
  userMessage: string
): SenseiResponse {
  const intent = detectIntent(userMessage);

  switch (intent) {
    case "why-directive":
      return {
        directive: campState.directive,
        correction: campState.correction,
        drill: campState.drill,
        explanation:
          "This is the directive because it is the highest-priority issue affecting your camp right now. Ignore lower-value work until this is cleaner.",
      };

    case "generate-session":
      return {
        directive: campState.directive,
        correction: campState.correction,
        drill: campState.drill,
        explanation: "Session generated from current camp state.",
        session: campState.todaysSession,
      };

    case "mobility-session":
      return {
        directive: "Prepare the body without wasting energy.",
        correction: "You do not need random mobility. You need targeted preparation.",
        drill: "Open the exact areas that affect your stance, rotation, and clean entries.",
        session: buildMobilitySession(),
      };

    case "why-gym": {
      const topGym = campState.gymRecommendations[0];
      return {
        directive: campState.directive,
        correction: campState.correction,
        drill: campState.drill,
        explanation: topGym
          ? `${topGym.gymName} is the best current support option because ${topGym.reason}.`
          : "No strong gym recommendation is available yet from current camp data.",
        optionalGymSupport: topGym?.gymName,
      };
    }

    case "weight-check":
      return {
        directive: campState.directive,
        correction:
          campState.weightStatus.projection === "off-track"
            ? "Your weight trend is not moving correctly."
            : "Your current weight trend is acceptable.",
        drill:
          campState.weightStatus.latestWeightKg !== null
            ? `Latest weight: ${campState.weightStatus.latestWeightKg}kg. Stay disciplined and keep logging.`
            : "Log your weight consistently before asking for trajectory decisions.",
        explanation: `Projection: ${campState.weightStatus.projection}.`,
      };

    case "vision-followup": {
      const latest = campState.lastCorrections[0];
      return {
        directive: campState.directive,
        correction: latest?.correction ?? campState.correction,
        drill: latest?.finding
          ? `Repeat controlled rounds focused on correcting ${latest.finding.toLowerCase()}.`
          : campState.drill,
        explanation: latest
          ? `Latest technical issue detected: ${latest.finding}. Severity: ${latest.severity}.`
          : "No recent Vision finding is available.",
      };
    }

    case "fuel-followup":
      return {
        directive: campState.directive,
        correction:
          campState.latestFuelLog?.report ??
          "Fuel data is too thin. Log meals consistently before making nutrition decisions.",
        drill: "Keep intake structured. Random eating ruins camp control.",
        explanation:
          campState.latestFuelLog?.fuelScore !== null &&
          campState.latestFuelLog?.fuelScore !== undefined
            ? `Latest Fuel Score: ${campState.latestFuelLog.fuelScore}/10.`
            : "No recent Fuel score available.",
      };

    case "general":
    default:
      return {
        directive: campState.directive,
        correction: campState.correction,
        drill: campState.drill,
        explanation:
          "Do not drift. Follow the current directive, complete the session, and clean up the biggest error first.",
        optionalGymSupport: campState.gymRecommendations[0]?.gymName,
      };
  }
}