import assert from "node:assert/strict";
import test from "node:test";
import { accountResolutionLabel } from "./accountResolution";

test("new accounts prepare a profile without assuming a role", () => {
  assert.equal(accountResolutionLabel(null), "Preparing your profile");
  assert.equal(accountResolutionLabel({ role: "athlete" }), "Preparing your profile");
});

test("incomplete onboarding restores the existing setup", () => {
  assert.equal(
    accountResolutionLabel({
      role: "athlete",
      onboardingVersion: 1,
      onboardingStage: "EXPERIENCE",
    }),
    "Restoring your setup",
  );
});

test("completed athletes load the athlete workspace", () => {
  assert.equal(
    accountResolutionLabel({
      role: "athlete",
      name: "Verified athlete",
      baseArt: "Wrestling",
      competitionLevel: "Intermediate",
    }),
    "Loading your athlete workspace",
  );
});

test("completed non-athlete roles do not receive athlete copy", () => {
  assert.equal(
    accountResolutionLabel({
      role: "organization",
      name: "Verified organization",
      baseArt: "Wrestling",
      competitionLevel: "Intermediate",
    }),
    "Loading your workspace",
  );
});
