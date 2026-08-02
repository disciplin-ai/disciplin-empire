import type { EvidenceAuthority } from "@/lib/authority/state";

/**
 * Provenance — who put this on the screen, and what standing does it carry.
 *
 * Disciplin's claim is that a coach, not software, holds technical authority.
 * That claim is only credible if the interface says, of any given statement,
 * where it came from. Until now every field rendered identically whether a
 * coach approved it, the athlete typed it, or Disciplin inferred it.
 *
 * The six kinds below are the complete vocabulary. They are ordered by
 * standing, strongest first, and nothing may be shown as carrying more
 * standing than it has.
 */
export type ProvenanceKind =
  | "coach_approved"
  | "coach_entered"
  | "pending_coach_review"
  | "athlete_entered"
  | "disciplin_suggested"
  | "observation_only";

export type ProvenanceMeta = {
  /** Shown to the athlete. Short enough to sit inline beside a value. */
  label: string;
  /** The longer sentence, for tooltips and screen readers. */
  meaning: string;
  /** Who is accountable for this statement. */
  authority: "coach" | "athlete" | "system";
  /**
   * Whether this carries technical authority — i.e. whether Sensei may
   * reinforce it. Only a coach can confer that.
   */
  carriesAuthority: boolean;
};

export const PROVENANCE: Record<ProvenanceKind, ProvenanceMeta> = {
  coach_approved: {
    label: "Coach approved",
    meaning: "Your coach approved this. It is the standard you train to.",
    authority: "coach",
    carriesAuthority: true,
  },
  coach_entered: {
    label: "From your coach",
    meaning: "Your coach wrote this.",
    authority: "coach",
    carriesAuthority: true,
  },
  pending_coach_review: {
    label: "Awaiting coach",
    meaning: "Recorded and waiting for your coach to review. Not yet approved.",
    authority: "coach",
    carriesAuthority: false,
  },
  athlete_entered: {
    label: "You entered this",
    meaning: "You recorded this yourself. It is not coach approved.",
    authority: "athlete",
    carriesAuthority: false,
  },
  disciplin_suggested: {
    label: "Suggested",
    meaning:
      "Disciplin suggested this from your own records. Only your coach can turn it into a correction.",
    authority: "system",
    carriesAuthority: false,
  },
  observation_only: {
    label: "Observation only",
    meaning:
      "What the evidence shows, nothing more. Not a correction and not a coaching instruction.",
    authority: "system",
    carriesAuthority: false,
  },
};

/**
 * Bridges the existing evidence-authority model rather than duplicating it,
 * so the two can never drift apart.
 */
export function provenanceForEvidence(
  authority: EvidenceAuthority
): ProvenanceKind {
  switch (authority) {
    case "COACH_APPROVED":
      return "coach_approved";
    case "COACH_REVIEW_PENDING":
      return "pending_coach_review";
    case "ATHLETE_DIRECTED":
      return "athlete_entered";
    case "OBSERVATION_ONLY":
      return "observation_only";
  }
}

/** True when Sensei is permitted to reinforce a statement of this kind. */
export function mayBeReinforced(kind: ProvenanceKind) {
  return PROVENANCE[kind].carriesAuthority;
}
