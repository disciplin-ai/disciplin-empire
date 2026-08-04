import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Schema tests that run without a database.
 *
 * These assert the *intent* of the migration chain: that historical records
 * cannot be destroyed by ordinary workflows, that the ledger is append-only,
 * that evidence is immutable, and that the chain is internally ordered.
 *
 * They cannot prove the SQL executes — only a real database does that, in the
 * acceptance test. What they do prove is that nobody can quietly reintroduce a
 * cascade on a historical table without a test turning red.
 */

const SQL_DIR = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(resolve(SQL_DIR, f), "utf8");

const M015 = read("015_coach_connection_mvp.sql");
const M016 = read("016_evidence_and_history_preservation.sql");
const M017 = read("017_evidence_storage.sql");

/** The body of a `create table` block, so assertions target one table. */
function tableBlock(sql: string, table: string) {
  const start = sql.indexOf(`create table if not exists public.${table} (`);
  assert.notEqual(start, -1, `table ${table} is not created`);
  const end = sql.indexOf("\n);", start);
  assert.notEqual(end, -1, `table ${table} block is unterminated`);
  return sql.slice(start, end);
}

// ---------------------------------------------------------------------------
// History must survive the relationship that produced it
// ---------------------------------------------------------------------------

const HISTORICAL_RELATIONSHIP_LINKS: Array<[string, string]> = [
  ["mission_submissions", "relationship_id"],
  ["mission_versions", "relationship_id"],
  ["coach_audit_events", "relationship_id"],
];

for (const [table, column] of HISTORICAL_RELATIONSHIP_LINKS) {
  test(`${table}.${column} does not cascade from the relationship`, () => {
    const block = tableBlock(M015, table);
    const line = block
      .split("\n")
      .find((l) => l.trim().startsWith(`${column} `));

    assert.ok(line, `${table}.${column} not found`);
    assert.match(
      line,
      /on delete set null/,
      `${table}.${column} must set null, so disconnecting a coach cannot erase history`
    );
    assert.doesNotMatch(line, /on delete cascade/);
  });
}

test("mission_versions.submission_id does not cascade", () => {
  const block = tableBlock(M015, "mission_versions");
  const line = block.split("\n").find((l) => l.includes("submission_id"));
  assert.ok(line);
  assert.doesNotMatch(block.slice(block.indexOf("submission_id")), /^\s*references[\s\S]{0,120}on delete cascade/m);
});

test("an approval's coach link survives the coach leaving", () => {
  const block = tableBlock(M015, "mission_versions");
  assert.match(block, /coach_user_id[\s\S]{0,80}on delete set null/);
  // ...and the name is snapshotted, so the record still reads.
  assert.match(block, /coach_display_name text not null/);
});

// ---------------------------------------------------------------------------
// The ledger is append-only
// ---------------------------------------------------------------------------

test("coach_audit_events is append-only", () => {
  assert.match(M015, /coach_audit_events_append_only/);
  assert.match(
    M015,
    /before update or delete on public\.coach_audit_events/,
    "the trigger must block deletes as well as updates"
  );
});

// ---------------------------------------------------------------------------
// Evidence: immutable, hashed, separated from what was seen in it
// ---------------------------------------------------------------------------

test("an observation cannot outlive its asset", () => {
  const block = tableBlock(M016, "evidence_observations");
  assert.match(
    block,
    /asset_id uuid not null references public\.evidence_assets\(id\) on delete restrict/
  );
});

test("evidence assets are immutable except an explained tombstone", () => {
  assert.match(M016, /evidence_assets_guard/);
  assert.match(M016, /recorded facts are immutable/);
  assert.match(M016, /evidence_assets_deletion_is_explained/);
});

test("observations are insert-only, superseded rather than edited", () => {
  assert.match(M016, /evidence_observations_immutable/);
  assert.match(M016, /insert-only/);
  const block = tableBlock(M016, "evidence_observations");
  assert.match(block, /supersedes_observation_id/);
});

test("the asset carries an integrity hash and a server timestamp", () => {
  const block = tableBlock(M016, "evidence_assets");
  assert.match(block, /content_hash text not null/);
  assert.match(block, /uploaded_at timestamptz not null default now\(\)/);
  // A client's clock is recorded, never substituted for the server's.
  assert.match(block, /client_reported_at timestamptz/);
});

test("the model behind an observation is recorded", () => {
  const block = tableBlock(M016, "evidence_observations");
  assert.match(block, /observer_model text/);
  assert.match(block, /observer_model_version text/);
});

test("identity and organisation are snapshotted, not only referenced", () => {
  for (const table of ["evidence_assets", "evidence_observations"]) {
    const block = tableBlock(M016, table);
    assert.match(block, /organisation_id uuid references public\.organisations\(id\) on delete set null/);
    assert.match(block, /organisation_name_snapshot text/);
  }
  assert.match(tableBlock(M016, "evidence_assets"), /uploader_name_snapshot text not null/);
  assert.match(tableBlock(M016, "evidence_observations"), /observer_name_snapshot text not null/);
});

test("the same bytes are one asset, so a re-upload is not a second record", () => {
  assert.match(M016, /evidence_assets_unique_content[\s\S]{0,120}athlete_user_id, content_hash/);
});

// ---------------------------------------------------------------------------
// Row level security
// ---------------------------------------------------------------------------

test("evidence is readable by its athlete and by a connected coach only", () => {
  assert.match(M016, /evidence_assets_athlete_read[\s\S]{0,200}athlete_user_id = auth\.uid\(\)/);
  assert.match(M016, /evidence_assets_coach_read[\s\S]{0,400}status = 'connected'/);
  assert.match(M016, /evidence_observations_athlete_read/);
  assert.match(M016, /evidence_observations_coach_read/);
});

test("no update or delete policy exists on evidence", () => {
  assert.doesNotMatch(M016, /on public\.evidence_assets for update/);
  assert.doesNotMatch(M016, /on public\.evidence_assets for delete/);
  assert.doesNotMatch(M016, /on public\.evidence_observations for update/);
  assert.doesNotMatch(M016, /on public\.evidence_observations for delete/);
});

test("RLS is enabled on every new table", () => {
  for (const t of ["evidence_assets", "evidence_observations"]) {
    assert.match(M016, new RegExp(`alter table public\\.${t} enable row level security`));
  }
  assert.match(M015, /alter table public\.organisations enable row level security/);
});

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

test("the evidence bucket is private and size-limited", () => {
  assert.match(M017, /'evidence'/);
  assert.match(M017, /false,\s*--\s*never public/);
  assert.match(M017, /10485760/);
  assert.match(M017, /set public = false/, "conflict path must not flip it public");
});

test("an athlete may write only beneath their own prefix", () => {
  assert.match(
    M017,
    /evidence_athlete_upload[\s\S]{0,300}storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/
  );
});

test("a coach reads athlete media only while connected, and never writes it", () => {
  assert.match(M017, /evidence_coach_read[\s\S]{0,400}status = 'connected'/);
  assert.doesNotMatch(M017, /evidence_coach_(upload|write|update|delete)/);
});

// ---------------------------------------------------------------------------
// Chain integrity
// ---------------------------------------------------------------------------

test("every migration is a single transaction", () => {
  for (const [name, sql] of [["015", M015], ["016", M016], ["017", M017]] as const) {
    assert.match(sql, /^begin;/m, `${name} must open a transaction`);
    assert.match(sql, /commit;\s*$/, `${name} must commit`);
  }
});

test("dependencies point backwards only", () => {
  // 016 depends on 015's tables; 015 must not reference 016's.
  assert.match(M016, /references public\.organisations/);
  assert.match(M016, /public\.coach_relationships/);
  assert.doesNotMatch(M015, /evidence_assets|evidence_observations/);
  // 017 depends on 015's relationships.
  assert.match(M017, /public\.coach_relationships/);
});

test("016 retrofits nothing — 015 is born correct", () => {
  assert.doesNotMatch(M016, /alter table public\.mission_versions/);
  assert.doesNotMatch(M016, /alter table public\.coach_audit_events/);
});

test("organisations is created once, in 015", () => {
  assert.match(M015, /create table if not exists public\.organisations/);
  assert.doesNotMatch(M016, /create table if not exists public\.organisations/);
});
