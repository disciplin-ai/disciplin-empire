export type CoachRelationshipStatus =
  | "invited"
  | "connected"
  | "declined"
  | "disconnected"
  | "revoked";

export type InvitationDeliveryStatus =
  | "created"
  | "unavailable"
  | "development_available"
  | "confirmed"
  | "failed";

export type CoachRelationshipRecord = {
  id: string;
  athlete_user_id: string;
  coach_user_id: string | null;
  athlete_display_name: string;
  coach_display_name: string;
  invited_email: string;
  academy_name: string | null;
  status: CoachRelationshipStatus;
  delivery_status: InvitationDeliveryStatus;
  delivery_updated_at: string | null;
  invited_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  disconnected_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MissionSubmissionRecord = {
  id: string;
  relationship_id: string;
  athlete_user_id: string;
  proposed_change_to_version_id: string | null;
  correction_text: string;
  practice_task: string;
  athlete_context: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  submitted_at: string;
  decided_at: string | null;
  decided_by: string | null;
  rejection_reason: string | null;
  created_at: string;
};

export type MissionVersionRecord = {
  id: string;
  submission_id: string;
  relationship_id: string;
  athlete_user_id: string;
  coach_user_id: string | null;
  coach_display_name: string;
  version_number: number;
  correction_text: string;
  practice_task: string;
  athlete_context: string | null;
  approval_kind: "approved" | "edited_and_approved";
  approved_at: string;
  created_at: string;
};

export type CurrentCoachMissionRecord = {
  athlete_user_id: string;
  relationship_id: string;
  mission_version_id: string;
  activated_at: string;
};

export type CoachAuditEventRecord = {
  id: string;
  relationship_id: string | null;
  actor_user_id: string | null;
  actor_display_name: string;
  actor_role: "athlete" | "coach";
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CoachWorkspaceState = {
  userId: string;
  athleteRelationship: CoachRelationshipRecord | null;
  coachedRelationships: CoachRelationshipRecord[];
  submissions: MissionSubmissionRecord[];
  versions: MissionVersionRecord[];
  currentMission: MissionVersionRecord | null;
  auditEvents: CoachAuditEventRecord[];
};

export type CoachRequestError = {
  code:
    | "AUTHENTICATION_REQUIRED"
    | "COACH_SCHEMA_UNAVAILABLE"
    | "COACH_REQUEST_FAILED"
    | "NETWORK_ERROR";
  message: string;
  retryable: boolean;
  diagnosticRef?: string;
};

export const EMPTY_COACH_WORKSPACE: CoachWorkspaceState = {
  userId: "",
  athleteRelationship: null,
  coachedRelationships: [],
  submissions: [],
  versions: [],
  currentMission: null,
  auditEvents: [],
};

export function coachConnectionLabel(relationship: CoachRelationshipRecord | null) {
  if (!relationship) return "No coach connected";
  if (relationship.status === "connected") return `Connected to ${relationship.coach_display_name}`;
  if (relationship.status === "invited") {
    if (relationship.delivery_status === "confirmed") return "Invitation delivered";
    if (relationship.delivery_status === "development_available") return "Invite link ready";
    if (relationship.delivery_status === "unavailable") return "Email not sent";
    if (relationship.delivery_status === "failed") return "Email delivery failed";
    return "Invitation created";
  }
  return "No coach connected";
}
