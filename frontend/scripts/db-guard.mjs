#!/usr/bin/env node
/*
  Refuses to let a migration run anywhere except a declared development
  database.

  The failure this exists to prevent is a tired evening and one wrong shell.
  It is deliberately loud, deliberately fail-closed, and it never reads a
  secret value — only the public project URL and the environment marker.

  Usage:  node scripts/db-guard.mjs
  Exit 0 = safe to proceed. Any other exit = do not run migrations.
*/

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(HERE, "..", ".env.development.local");

/*
  Known-protected project. Treated as production or unknown until explicitly
  confirmed otherwise, and never a migration target.
*/
const FORBIDDEN_PROJECT_REFS = new Set(["pamhlgvwomyilsdtscid"]);

function fail(reason, detail) {
  console.error(`\n  REFUSED — ${reason}`);
  if (detail) console.error(`  ${detail}`);
  console.error("\n  No migration will run.\n");
  process.exit(1);
}

function parseEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

if (!existsSync(ENV_FILE)) {
  fail(
    "no .env.development.local",
    "Create it with the development project's credentials and NEXT_PUBLIC_APP_ENV=development."
  );
}

const env = parseEnvFile(ENV_FILE);

const appEnv = env.NEXT_PUBLIC_APP_ENV;
if (!appEnv) {
  fail(
    "NEXT_PUBLIC_APP_ENV is missing",
    "The environment must name itself. Absent a marker, this is treated as production."
  );
}
if (appEnv !== "development") {
  fail(`NEXT_PUBLIC_APP_ENV is "${appEnv}", not "development"`);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) fail("NEXT_PUBLIC_SUPABASE_URL is missing");

const match = /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(url);
if (!match) fail("NEXT_PUBLIC_SUPABASE_URL is not a recognisable Supabase URL");

const projectRef = match[1];
const host = `${projectRef}.supabase.co`;
const dbHost = `db.${projectRef}.supabase.co`;

if (FORBIDDEN_PROJECT_REFS.has(projectRef)) {
  fail(
    `project ref ${projectRef} is protected`,
    "This is the production-or-unknown project. It is never a migration target."
  );
}

// Cross-check: whatever the shell currently points at must not be the
// protected project either, in case a stray export is in play.
const shellUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
for (const forbidden of FORBIDDEN_PROJECT_REFS) {
  if (shellUrl.includes(forbidden)) {
    fail(
      "the current shell points at the protected project",
      `NEXT_PUBLIC_SUPABASE_URL in this shell contains ${forbidden}. Clear it before continuing.`
    );
  }
}

console.log(`
  Target verified
  ---------------
  environment    ${appEnv}
  project ref    ${projectRef}
  api host       ${host}
  database host  ${dbHost}
  protected ref  not matched (${[...FORBIDDEN_PROJECT_REFS].join(", ")})

  Safe to proceed.
`);
process.exit(0);
