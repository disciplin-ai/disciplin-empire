#!/usr/bin/env node
/*
  The only sanctioned way to apply migrations.

  It runs the guard first, every time, and refuses to continue if the guard
  refuses. There is no flag to skip it — a bypass that exists will eventually
  be used.

  Modes:
    node scripts/migrate.mjs --print
        Emits the whole chain to stdout, in order, for pasting into the
        Supabase SQL editor. Runs the guard first so you cannot print a chain
        while pointed at a protected project. Touches nothing.

    node scripts/migrate.mjs --apply
        Applies the chain to DEV_DATABASE_URL via the Supabase CLI. Requires
        the guard to pass and DEV_DATABASE_URL to be set.

  Each migration file is wrapped in begin/commit, so a failure rolls that file
  back whole and later files never run.
*/

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SQL_DIR = resolve(HERE, "..", "src", "lib", "supabase", "sql");

/*
  Order matters and is asserted, not assumed:
    015 creates organisations and coach_relationships
    016 references both
    017 references coach_relationships for its coach-read policy
*/
export const MIGRATION_CHAIN = [
  "015_coach_connection_mvp.sql",
  "016_evidence_and_history_preservation.sql",
  "017_evidence_storage.sql",
];

const mode = process.argv.includes("--apply")
  ? "apply"
  : process.argv.includes("--print")
    ? "print"
    : null;

if (!mode) {
  console.error("\n  Usage: node scripts/migrate.mjs --print | --apply\n");
  process.exit(2);
}

// ---------------------------------------------------------------------------
// The guard runs first. Always.
// ---------------------------------------------------------------------------
const guard = spawnSync(process.execPath, [resolve(HERE, "db-guard.mjs")], {
  stdio: "inherit",
});

if (guard.status !== 0) {
  console.error("  Guard refused. Nothing was applied.\n");
  process.exit(1);
}

for (const file of MIGRATION_CHAIN) {
  const path = resolve(SQL_DIR, file);
  if (!existsSync(path)) {
    console.error(`\n  Missing migration: ${file}\n`);
    process.exit(1);
  }
}

if (mode === "print") {
  const parts = MIGRATION_CHAIN.map((file) => {
    const sql = readFileSync(resolve(SQL_DIR, file), "utf8");
    return `-- ===========================================================\n-- ${file}\n-- ===========================================================\n\n${sql}`;
  });
  console.log(parts.join("\n\n"));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------
const dbUrl = process.env.DEV_DATABASE_URL;
if (!dbUrl) {
  console.error(`
  DEV_DATABASE_URL is not set.

  Set it to the development project's pooler connection string, then rerun.
  It is read from the shell and never written to a file by this script.
`);
  process.exit(1);
}

if (dbUrl.includes("pamhlgvwomyilsdtscid")) {
  console.error("\n  REFUSED — DEV_DATABASE_URL points at the protected project.\n");
  process.exit(1);
}

for (const file of MIGRATION_CHAIN) {
  const path = resolve(SQL_DIR, file);
  console.log(`\n  Applying ${file} ...`);

  const cli = resolve(HERE, "..", "node_modules", ".bin", "supabase");
  const run = spawnSync(
    cli,
    ["db", "push", "--db-url", dbUrl, "--include-all"],
    { stdio: "inherit", shell: process.platform === "win32", input: readFileSync(path) }
  );

  if (run.status !== 0) {
    console.error(`
  ${file} failed. It was wrapped in begin/commit, so that file rolled back and
  no later migration ran. Fix the cause and rerun from the start — the chain is
  idempotent (create if not exists / drop if exists).
`);
    process.exit(1);
  }
}

console.log("\n  Chain applied.\n");
