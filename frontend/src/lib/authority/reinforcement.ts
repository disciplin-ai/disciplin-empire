import { mayBeReinforced, type ProvenanceKind } from "@/lib/provenance/contracts";

/**
 * The reinforcement boundary.
 *
 * Sensei may reinforce a correction only because a coach approved it in a
 * durable record — never because a request said so. Everything the client
 * sends about authority is ignored here by construction: this function takes
 * only rows the server read for itself.
 *
 * Kept pure so the rule can be tested directly rather than inferred from a
 * route's behaviour.
 */

export type CurrentMissionPointer = {
  mission_version_id: string | null;
  relationship_id: string | null;
} | null;

export type RelationshipRow = {
  status: string | null;
  coach_user_id: string | null;
} | null;

export type MissionVersionRow = {
  correction_text: string | null;
  practice_task: string | null;
  coach_user_id: string | null;
  coach_display_name: string | null;
  approved_at: string | null;
} | null;

export type ReinforcementRefusal =
  | "no_current_mission"
  | "relationship_not_connected"
  | "no_approving_coach"
  | "mission_version_missing"
  | "correction_empty";

export type ReinforcementDecision =
  | {
      mayReinforce: true;
      correction: string;
      practiceTask: string;
      provenance: Extract<ProvenanceKind, "coach_approved">;
      approvedBy: string;
      approvedAt: string | null;
    }
  | { mayReinforce: false; refusal: ReinforcementRefusal };

function clean(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * @param pointer         the athlete's current mission pointer, read server-side
 * @param relationship    the coach relationship backing that pointer
 * @param missionVersion  the approved version the pointer names
 *
 * No parameter is derived from the request body. That is the whole point.
 */
export function resolveReinforcement(
  pointer: CurrentMissionPointer,
  relationship: RelationshipRow,
  missionVersion: MissionVersionRow
): ReinforcementDecision {
  if (!pointer || !pointer.mission_version_id) {
    return { mayReinforce: false, refusal: "no_current_mission" };
  }

  // An invitation that was never accepted, or a coach since disconnected,
  // confers nothing. Standing must be current, not merely once-held.
  if (!relationship || relationship.status !== "connected") {
    return { mayReinforce: false, refusal: "relationship_not_connected" };
  }

  if (!relationship.coach_user_id) {
    return { mayReinforce: false, refusal: "no_approving_coach" };
  }

  if (!missionVersion) {
    return { mayReinforce: false, refusal: "mission_version_missing" };
  }

  const correction = clean(missionVersion.correction_text);
  if (!correction) {
    return { mayReinforce: false, refusal: "correction_empty" };
  }

  // Belt and braces: the only provenance Sensei may act on is one the
  // vocabulary itself marks as carrying authority.
  if (!mayBeReinforced("coach_approved")) {
    return { mayReinforce: false, refusal: "no_approving_coach" };
  }

  return {
    mayReinforce: true,
    correction,
    practiceTask: clean(missionVersion.practice_task),
    provenance: "coach_approved",
    approvedBy: clean(missionVersion.coach_display_name) || "Coach",
    approvedAt: missionVersion.approved_at ?? null,
  };
}
