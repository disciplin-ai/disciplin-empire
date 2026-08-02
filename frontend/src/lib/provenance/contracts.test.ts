import assert from "node:assert/strict";
import test from "node:test";

import type { EvidenceAuthority } from "@/lib/authority/state";
import {
  PROVENANCE,
  mayBeReinforced,
  provenanceForEvidence,
  type ProvenanceKind,
} from "./contracts";

const ALL = Object.keys(PROVENANCE) as ProvenanceKind[];

test("only a coach can confer technical authority", () => {
  for (const kind of ALL) {
    const meta = PROVENANCE[kind];
    if (meta.carriesAuthority) {
      assert.equal(
        meta.authority,
        "coach",
        `${kind} claims authority without a coach behind it`
      );
    }
  }
});

test("nothing Disciplin produces on its own may be reinforced", () => {
  assert.equal(mayBeReinforced("disciplin_suggested"), false);
  assert.equal(mayBeReinforced("observation_only"), false);
  assert.equal(mayBeReinforced("athlete_entered"), false);
});

test("work awaiting a coach does not yet carry authority", () => {
  assert.equal(mayBeReinforced("pending_coach_review"), false);
  assert.equal(PROVENANCE.pending_coach_review.authority, "coach");
});

test("coach-approved work is the only kind Sensei may reinforce as a standard", () => {
  const reinforceable = ALL.filter(mayBeReinforced);
  assert.deepEqual(reinforceable.sort(), ["coach_approved", "coach_entered"]);
});

test("every evidence authority maps to exactly one provenance kind", () => {
  const authorities: EvidenceAuthority[] = [
    "COACH_APPROVED",
    "COACH_REVIEW_PENDING",
    "ATHLETE_DIRECTED",
    "OBSERVATION_ONLY",
  ];

  for (const authority of authorities) {
    const kind = provenanceForEvidence(authority);
    assert.ok(PROVENANCE[kind], `${authority} mapped to an unknown kind`);
  }

  assert.equal(provenanceForEvidence("COACH_APPROVED"), "coach_approved");
  assert.equal(
    provenanceForEvidence("OBSERVATION_ONLY"),
    "observation_only"
  );
});

test("observation-only never implies a correction or an instruction", () => {
  const meaning = PROVENANCE.observation_only.meaning.toLowerCase();
  assert.match(meaning, /not a correction/);
  assert.doesNotMatch(PROVENANCE.observation_only.label.toLowerCase(), /correct|drill/);
});

test("every kind states its meaning in words, so colour is never the only signal", () => {
  for (const kind of ALL) {
    assert.ok(PROVENANCE[kind].label.trim().length > 0, `${kind} has no label`);
    assert.ok(PROVENANCE[kind].meaning.trim().length > 10, `${kind} has no meaning`);
  }
});
