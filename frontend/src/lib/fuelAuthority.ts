import type { AuthorityState } from "@/lib/authority/state";

export type FuelAuthorityContract = {
  state: AuthorityState;
  connectedCoach: boolean;
  approvedMission: boolean;
  reviewPending: boolean;
  headerStatus: string;
  authorityLabel: string;
  authorityDetail: string;
  readyAction: string;
  reducedAction: string;
  productiveBoundary: string;
  handoffLabel: string;
  copyLabel: string;
};

const ATHLETE_DIRECTED_BASE = {
  connectedCoach: false,
  approvedMission: false,
  reviewPending: false,
  headerStatus: "Athlete directed",
  authorityLabel: "Athlete directed",
  authorityDetail: "Not coach approved",
  readyAction: "Train within today’s limits.",
  reducedAction: "Reduce today’s session to the limits below.",
  productiveBoundary: "Fuel sets preparation limits. It does not approve technical work.",
  handoffLabel: "Preparation note",
  copyLabel: "Copy note",
} as const;

export const FUEL_AUTHORITY_MATRIX: Record<
  AuthorityState,
  FuelAuthorityContract
> = {
  COACH_BACKEND_UNAVAILABLE: {
    state: "COACH_BACKEND_UNAVAILABLE",
    ...ATHLETE_DIRECTED_BASE,
    headerStatus: "Connection unavailable",
    authorityLabel: "Connection unavailable",
    authorityDetail: "Coach approval unavailable",
    productiveBoundary: "Fuel can still set preparation limits. It cannot confirm coach approval.",
  },
  NO_COACH_CONNECTED: {
    state: "NO_COACH_CONNECTED",
    ...ATHLETE_DIRECTED_BASE,
    authorityDetail: "Athlete directed",
  },
  COACH_INVITATION_PENDING: {
    state: "COACH_INVITATION_PENDING",
    ...ATHLETE_DIRECTED_BASE,
    headerStatus: "Invite pending",
    authorityDetail: "Invite pending",
  },
  ATHLETE_DIRECTED: {
    state: "ATHLETE_DIRECTED",
    ...ATHLETE_DIRECTED_BASE,
  },
  HAS_COACH_NO_MISSION: {
    state: "HAS_COACH_NO_MISSION",
    connectedCoach: true,
    approvedMission: false,
    reviewPending: false,
    headerStatus: "No approved mission",
    authorityLabel: "No approved mission",
    authorityDetail: "No approved mission",
    readyAction: "Follow today’s limits. Record the coach correction when ready.",
    reducedAction:
      "Follow today’s limits and record the coach correction when ready.",
    productiveBoundary: "Fuel sets preparation limits. It does not approve the work.",
    handoffLabel: "For your coach",
    copyLabel: "Copy for coach",
  },
  HAS_COACH_PENDING_REVIEW: {
    state: "HAS_COACH_PENDING_REVIEW",
    connectedCoach: true,
    approvedMission: false,
    reviewPending: true,
    headerStatus: "Review pending",
    authorityLabel: "Review pending",
    authorityDetail: "Review pending",
    readyAction: "Follow today’s limits while your coach reviews the correction.",
    reducedAction: "Reduce the session while your coach reviews the correction.",
    productiveBoundary: "Fuel sets preparation limits. Your coach decides whether to approve the correction.",
    handoffLabel: "For your coach",
    copyLabel: "Copy for coach",
  },
  COACH_APPROVED_MISSION: {
    state: "COACH_APPROVED_MISSION",
    connectedCoach: true,
    approvedMission: true,
    reviewPending: false,
    headerStatus: "Coach approved",
    authorityLabel: "Coach approved",
    authorityDetail: "Coach approved",
    readyAction: "Follow today’s limits and the approved correction.",
    reducedAction: "Reduce the session within today’s limits. Keep the approved correction unchanged.",
    productiveBoundary: "Fuel changes preparation, not the approved work.",
    handoffLabel: "For your coach",
    copyLabel: "Copy for coach",
  },
};

export function fuelAuthorityContract(state: AuthorityState) {
  return FUEL_AUTHORITY_MATRIX[state];
}
