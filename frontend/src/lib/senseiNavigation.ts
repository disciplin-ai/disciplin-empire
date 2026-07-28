import type { AuthorityAction } from "@/lib/authority/state";

export type SenseiCtaDestination =
  | "profile"
  | "vision"
  | "coach_review"
  | "correction_capture"
  | "none";

export function senseiCtaDestination(action: AuthorityAction): SenseiCtaDestination {
  if (action === "OPEN_COACH_CONNECTION") return "profile";
  if (action === "OPEN_VISION" || action === "ADD_ATHLETE_EVIDENCE") return "vision";
  if (action === "VIEW_COACH_REVIEW" || action === "PREPARE_COACH_REVIEW") {
    return "coach_review";
  }
  if (action === "RECORD_COACH_CORRECTION") return "correction_capture";
  return "none";
}
