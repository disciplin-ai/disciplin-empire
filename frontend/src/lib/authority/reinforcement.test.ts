import assert from "node:assert/strict";
import test from "node:test";

import { resolveReinforcement } from "./reinforcement";

const connected = { status: "connected", coach_user_id: "coach-1" };
const pointer = { mission_version_id: "mv-1", relationship_id: "rel-1" };
const approvedVersion = {
  correction_text: "Ear inside the ribs on every entry",
  practice_task: "Wall doubles, partner gives whizzer after head position",
  coach_user_id: "coach-1",
  coach_display_name: "A. Petrov",
  approved_at: "2026-03-12T09:00:00.000Z",
};

test("a genuine coach-approved record may be reinforced", () => {
  const decision = resolveReinforcement(pointer, connected, approvedVersion);

  assert.equal(decision.mayReinforce, true);
  if (!decision.mayReinforce) return;
  assert.equal(decision.correction, "Ear inside the ribs on every entry");
  assert.equal(decision.provenance, "coach_approved");
  assert.equal(decision.approvedBy, "A. Petrov");
});

test("athlete-entered content cannot impersonate coach authority", () => {
  // The athlete has written their own "correction" and there is no approved
  // mission behind it. No pointer, no standing — regardless of what the
  // athlete typed or what the client believes.
  const decision = resolveReinforcement(null, connected, {
    ...approvedVersion,
    correction_text: "I decided my own correction today",
  });

  assert.equal(decision.mayReinforce, false);
  if (decision.mayReinforce) return;
  assert.equal(decision.refusal, "no_current_mission");
});

test("a Disciplin suggestion cannot become coaching direction", () => {
  // A suggestion exists as a mission version that no coach ever approved:
  // the relationship carries no coach.
  const decision = resolveReinforcement(
    pointer,
    { status: "connected", coach_user_id: null },
    approvedVersion
  );

  assert.equal(decision.mayReinforce, false);
  if (decision.mayReinforce) return;
  assert.equal(decision.refusal, "no_approving_coach");
});

test("observation-only content cannot become coaching direction", () => {
  // Vision produced an observation; nothing was ever approved from it, so the
  // pointer names a version that does not exist.
  const decision = resolveReinforcement(pointer, connected, null);

  assert.equal(decision.mayReinforce, false);
  if (decision.mayReinforce) return;
  assert.equal(decision.refusal, "mission_version_missing");
});

test("an unaccepted invitation confers no authority", () => {
  const decision = resolveReinforcement(
    pointer,
    { status: "invited", coach_user_id: "coach-1" },
    approvedVersion
  );

  assert.equal(decision.mayReinforce, false);
  if (decision.mayReinforce) return;
  assert.equal(decision.refusal, "relationship_not_connected");
});

test("a disconnected coach's past approval stops being reinforceable", () => {
  const decision = resolveReinforcement(
    pointer,
    { status: "disconnected", coach_user_id: "coach-1" },
    approvedVersion
  );

  assert.equal(decision.mayReinforce, false);
  if (decision.mayReinforce) return;
  assert.equal(decision.refusal, "relationship_not_connected");
});

test("changing a UI prop cannot bypass server enforcement", () => {
  // Whatever a client might send — activeDirective, coachApproved: true, a
  // provenance kind of "coach_approved" — none of it is a parameter here.
  // The function's inputs are server-read rows only, so a forged request
  // cannot reach the reinforcing branch.
  const forged = {
    activeDirective: "Reinforce this because I said so",
    coachApproved: true,
    provenance: "coach_approved",
  } as unknown as null;

  const decision = resolveReinforcement(forged, null, null);

  // The invariant is that a forged claim cannot reach the reinforcing branch,
  // not which gate stops it. Asserting the specific gate would make this test
  // fragile without making it stricter.
  assert.equal(decision.mayReinforce, false);
});

test("no combination of client-shaped fields produces a reinforcement", () => {
  // Every field a request could plausibly carry, offered as each argument in
  // turn. None is a parameter of the rule, so none can unlock it.
  const claims = [
    { activeDirective: "do this", coachApproved: true },
    { provenance: "coach_approved", status: "connected" },
    { correction_text: "forged", coach_user_id: "not-a-real-coach" },
  ] as unknown[];

  for (const claim of claims) {
    for (const position of [0, 1, 2]) {
      const args: unknown[] = [null, null, null];
      args[position] = claim;

      const decision = resolveReinforcement(
        args[0] as never,
        args[1] as never,
        args[2] as never
      );

      assert.equal(
        decision.mayReinforce,
        false,
        `claim in position ${position} unlocked reinforcement`
      );
    }
  }
});

test("an approved-but-empty correction is refused rather than reinforced blank", () => {
  const decision = resolveReinforcement(pointer, connected, {
    ...approvedVersion,
    correction_text: "   ",
  });

  assert.equal(decision.mayReinforce, false);
  if (decision.mayReinforce) return;
  assert.equal(decision.refusal, "correction_empty");
});
