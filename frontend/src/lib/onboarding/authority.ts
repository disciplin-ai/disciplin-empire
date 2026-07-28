export type CoachRelationship = "coach_connected" | "athlete_directed";

export function normalizeCoachRelationship(value: unknown): CoachRelationship | undefined {
  if (value === "coach_connected" || value === "consistent_coach") return "coach_connected";
  if (
    value === "athlete_directed" ||
    value === "no_consistent_coach" ||
    value === "between_coaches"
  ) {
    return "athlete_directed";
  }
  return undefined;
}

