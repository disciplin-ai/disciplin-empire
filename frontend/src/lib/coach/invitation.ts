import { createHash, randomBytes } from "node:crypto";

export const COACH_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createInvitationSecret() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashInvitationSecret(token),
    expiresAt: new Date(Date.now() + COACH_INVITATION_TTL_MS).toISOString(),
  };
}

export function hashInvitationSecret(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isPlausibleInvitationSecret(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,100}$/.test(value);
}

