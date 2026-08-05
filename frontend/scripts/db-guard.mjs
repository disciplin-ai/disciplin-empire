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

/*
  The real target is always .env.development.local. DB_GUARD_ENV_FILE exists so
  the guard's own tests can point at fixtures — it changes which file is read,
  never which rules are applied.
*/
const ENV_FILE =
  process.env.DB_GUARD_ENV_FILE ?? resolve(HERE, "..", ".env.development.local");

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
    `no ${ENV_FILE}`,
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

const dbUrl = process.env.DEV_DATABASE_URL ?? env.DEV_DATABASE_URL ?? "";

/*
  The protected-project checks run first and apply to every target, local or
  hosted. A local-looking URL is not a way around them: the ref is searched for
  as a substring in both URLs before anything else is considered.
*/
for (const forbidden of FORBIDDEN_PROJECT_REFS) {
  if (url.includes(forbidden)) {
    fail(
      `project ref ${forbidden} is protected`,
      "NEXT_PUBLIC_SUPABASE_URL names the production-or-unknown project."
    );
  }
  if (dbUrl.includes(forbidden)) {
    fail(
      `project ref ${forbidden} is protected`,
      "DEV_DATABASE_URL names the production-or-unknown project."
    );
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const LOCAL_API_PORT = "54321";
const LOCAL_DB_PORT = "54322";

let parsedApi;
try {
  parsedApi = new URL(url);
} catch {
  fail("NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
}

const apiIsLocal = LOCAL_HOSTS.has(parsedApi.hostname);

if (apiIsLocal) {
  // ---- local Supabase -----------------------------------------------------
  if (parsedApi.port !== LOCAL_API_PORT) {
    fail(
      `a local API must use port ${LOCAL_API_PORT}`,
      `Got "${parsedApi.port || "none"}". That is not the local Supabase gateway.`
    );
  }

  if (dbUrl) {
    let parsedDb;
    try {
      parsedDb = new URL(dbUrl);
    } catch {
      fail("DEV_DATABASE_URL is not a valid URL");
    }

    if (!LOCAL_HOSTS.has(parsedDb.hostname)) {
      fail(
        "the API is local but the database is not",
        `DEV_DATABASE_URL points at ${parsedDb.hostname}. A split target is never intended.`
      );
    }
    if (parsedDb.port !== LOCAL_DB_PORT) {
      fail(
        `a local database must use port ${LOCAL_DB_PORT}`,
        `Got "${parsedDb.port || "none"}".`
      );
    }
  }

  console.log(`
  Target verified
  ---------------
  environment    ${appEnv}
  target         LOCAL Supabase (Docker)
  api host       ${parsedApi.hostname}:${parsedApi.port}
  database host  ${dbUrl ? `${new URL(dbUrl).hostname}:${new URL(dbUrl).port}` : "(DEV_DATABASE_URL not set)"}
  protected ref  not matched (${[...FORBIDDEN_PROJECT_REFS].join(", ")})

  Safe to proceed.
`);
  process.exit(0);
}

// ---- hosted Supabase ------------------------------------------------------
const match = /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(url);
if (!match) fail("NEXT_PUBLIC_SUPABASE_URL is not a recognisable Supabase URL");

const projectRef = match[1];
const host = `${projectRef}.supabase.co`;
const dbHost = `db.${projectRef}.supabase.co`;

if (dbUrl && LOCAL_HOSTS.has(new URL(dbUrl).hostname)) {
  fail(
    "the API is hosted but the database is local",
    "A split target is never intended."
  );
}

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
