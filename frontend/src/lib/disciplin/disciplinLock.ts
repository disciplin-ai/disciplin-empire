export type ProofType = "image" | "video" | "metrics" | "none";

export type Rep = {
  index: number;
  clean: boolean;
  underResistance: boolean;
};

export type ProofState = {
  reps: Rep[];
  proofType: ProofType;
  proofSubmitted: boolean;
  verified: boolean;
  locked: boolean;
};

export function createInitialProofState(): ProofState {
  return {
    reps: Array.from({ length: 5 }).map((_, i) => ({
      index: i + 1,
      clean: false,
      underResistance: false,
    })),
    proofType: "none",
    proofSubmitted: false,
    verified: false,
    locked: true,
  };
}

export function updateRep(
  state: ProofState,
  index: number,
  clean: boolean,
  underResistance: boolean
): ProofState {
  const updated = state.reps.map((rep) =>
    rep.index === index
      ? { ...rep, clean, underResistance }
      : rep
  );

  return evaluateState({
    ...state,
    reps: updated,
  });
}

export function submitProof(
  state: ProofState,
  type: ProofType
): ProofState {
  return evaluateState({
    ...state,
    proofType: type,
    proofSubmitted: type !== "none",
  });
}

function evaluateState(state: ProofState): ProofState {
  const cleanReps = state.reps.filter(
    (r) => r.clean && r.underResistance
  ).length;

  const hasEnoughReps = cleanReps >= 5;

  const validProof =
    state.proofType === "image" ||
    state.proofType === "video" ||
    state.proofType === "metrics";

  const verified = hasEnoughReps && validProof;

  return {
    ...state,
    verified,
    locked: !verified,
  };
}