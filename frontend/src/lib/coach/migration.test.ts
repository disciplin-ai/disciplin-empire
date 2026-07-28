import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const sql = readFileSync(
  join(process.cwd(), "src/lib/supabase/sql/015_coach_connection_mvp.sql"),
  "utf8",
);

test("coach migration exposes no direct authenticated write policies", () => {
  assert.doesNotMatch(sql, /for\s+(insert|update|delete)\s+to\s+authenticated/i);
  assert.match(sql, /revoke all on public\.coach_invitations from anon, authenticated/i);
  assert.match(sql, /grant select on public\.mission_versions to authenticated/i);
});

test("coach migration enforces identity and immutable approved history", () => {
  assert.match(sql, /relationship\.coach_user_id = v_actor/i);
  assert.match(sql, /relationship\.athlete_user_id <> v_actor/i);
  assert.match(sql, /self_invitation_not_allowed/i);
  assert.match(sql, /mission_versions_immutable/i);
  assert.match(sql, /coach_audit_events_immutable/i);
});

test("coach invitation lifecycle stores hashes and enforces durable limits", () => {
  assert.match(sql, /token_hash text not null unique/i);
  assert.doesNotMatch(sql, /\btoken\s+text/i);
  assert.match(sql, /created_at > now\(\) - interval '1 hour'/i);
  assert.match(sql, /created_at > now\(\) - interval '24 hours'/i);
  assert.match(sql, /expires_at > now\(\)/i);
});

