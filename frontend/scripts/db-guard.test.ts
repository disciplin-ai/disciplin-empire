import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

/**
 * The guard is the only thing standing between a tired evening and a migration
 * against production. These tests exercise it as a process — the same way it
 * actually runs — rather than importing pieces of it, because the exit code is
 * the contract every script depends on.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = resolve(HERE, "db-guard.mjs");
const PROTECTED_REF = "pamhlgvwomyilsdtscid";

const LOCAL_API = "http://127.0.0.1:54321";
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Runs the guard against a throwaway env file. Returns exit code and output. */
function runGuard(
  envBody: string,
  shellEnv: Record<string, string | undefined> = {}
) {
  const dir = mkdtempSync(join(tmpdir(), "guard-"));
  const file = join(dir, "env");
  writeFileSync(file, envBody, "utf8");

  try {
    const result = spawnSync(process.execPath, [GUARD], {
      encoding: "utf8",
      env: {
        ...process.env,
        DB_GUARD_ENV_FILE: file,
        // Cleared unless a case sets them, so the host shell cannot leak in.
        DEV_DATABASE_URL: undefined,
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        ...shellEnv,
      },
    });
    return {
      code: result.status,
      out: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 1. correct local API and local database: pass
// ---------------------------------------------------------------------------
test("correct local API and local database passes", () => {
  const { code, out } = runGuard(
    `NEXT_PUBLIC_APP_ENV=development\nNEXT_PUBLIC_SUPABASE_URL=${LOCAL_API}\n`,
    { DEV_DATABASE_URL: LOCAL_DB }
  );

  assert.equal(code, 0, out);
  assert.match(out, /LOCAL Supabase/);
  assert.match(out, /127\.0\.0\.1:54321/, "must print the API host and port");
  assert.match(out, /127\.0\.0\.1:54322/, "must print the database host and port");
  assert.match(out, /environment\s+development/);
});

test("localhost is accepted as well as 127.0.0.1", () => {
  const { code } = runGuard(
    `NEXT_PUBLIC_APP_ENV=development\nNEXT_PUBLIC_SUPABASE_URL=http://localhost:54321\n`
  );
  assert.equal(code, 0);
});

// ---------------------------------------------------------------------------
// 2. wrong local API port: refuse
// ---------------------------------------------------------------------------
test("a local API on the wrong port is refused", () => {
  for (const port of ["3000", "54323", "5432"]) {
    const { code, out } = runGuard(
      `NEXT_PUBLIC_APP_ENV=development\nNEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${port}\n`
    );
    assert.equal(code, 1, `port ${port} should refuse`);
    assert.match(out, /must use port 54321/);
  }
});

test("a local API with no port is refused", () => {
  const { code, out } = runGuard(
    `NEXT_PUBLIC_APP_ENV=development\nNEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1\n`
  );
  assert.equal(code, 1);
  assert.match(out, /must use port 54321/);
});

// ---------------------------------------------------------------------------
// 3. hosted API with local database: refuse
// ---------------------------------------------------------------------------
test("a hosted API with a local database is refused", () => {
  const { code, out } = runGuard(
    `NEXT_PUBLIC_APP_ENV=development\nNEXT_PUBLIC_SUPABASE_URL=https://somedevref00000.supabase.co\n`,
    { DEV_DATABASE_URL: LOCAL_DB }
  );

  assert.equal(code, 1);
  assert.match(out, /API is hosted but the database is local/);
});

// ---------------------------------------------------------------------------
// 4. local API with hosted database: refuse
// ---------------------------------------------------------------------------
test("a local API with a hosted database is refused", () => {
  const { code, out } = runGuard(
    `NEXT_PUBLIC_APP_ENV=development\nNEXT_PUBLIC_SUPABASE_URL=${LOCAL_API}\n`,
    {
      DEV_DATABASE_URL:
        "postgresql://postgres:pw@db.somedevref00000.supabase.co:5432/postgres",
    }
  );

  assert.equal(code, 1);
  assert.match(out, /API is local but the database is not/);
});

test("a local API with a local database on the wrong port is refused", () => {
  const { code, out } = runGuard(
    `NEXT_PUBLIC_APP_ENV=development\nNEXT_PUBLIC_SUPABASE_URL=${LOCAL_API}\n`,
    { DEV_DATABASE_URL: "postgresql://postgres:pw@127.0.0.1:5432/postgres" }
  );

  assert.equal(code, 1);
  assert.match(out, /must use port 54322/);
});

// ---------------------------------------------------------------------------
// 5. protected project reference anywhere: refuse
// ---------------------------------------------------------------------------
test("the protected ref in the API URL is refused", () => {
  const { code, out } = runGuard(
    `NEXT_PUBLIC_APP_ENV=development\nNEXT_PUBLIC_SUPABASE_URL=https://${PROTECTED_REF}.supabase.co\n`
  );
  assert.equal(code, 1);
  assert.match(out, /is protected/);
});

test("the protected ref in DEV_DATABASE_URL is refused", () => {
  const { code, out } = runGuard(
    `NEXT_PUBLIC_APP_ENV=development\nNEXT_PUBLIC_SUPABASE_URL=${LOCAL_API}\n`,
    {
      DEV_DATABASE_URL: `postgresql://postgres:pw@db.${PROTECTED_REF}.supabase.co:5432/postgres`,
    }
  );
  assert.equal(code, 1);
  assert.match(out, /is protected/);
});

test("a local-looking URL cannot smuggle the protected ref past the check", () => {
  // The protected checks run before the local branch, so this must refuse for
  // being protected — not be waved through for looking local.
  const { code, out } = runGuard(
    `NEXT_PUBLIC_APP_ENV=development\nNEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321/${PROTECTED_REF}\n`
  );
  assert.equal(code, 1);
  assert.match(out, /is protected/);
});

test("the protected ref in the env file's own DEV_DATABASE_URL is refused", () => {
  const { code, out } = runGuard(
    `NEXT_PUBLIC_APP_ENV=development\n` +
      `NEXT_PUBLIC_SUPABASE_URL=${LOCAL_API}\n` +
      `DEV_DATABASE_URL=postgresql://postgres:pw@db.${PROTECTED_REF}.supabase.co:5432/postgres\n`
  );
  assert.equal(code, 1);
  assert.match(out, /is protected/);
});

// ---------------------------------------------------------------------------
// 6. missing development marker: refuse
// ---------------------------------------------------------------------------
test("a missing development marker is refused", () => {
  const { code, out } = runGuard(`NEXT_PUBLIC_SUPABASE_URL=${LOCAL_API}\n`);
  assert.equal(code, 1);
  assert.match(out, /NEXT_PUBLIC_APP_ENV is missing/);
});

test("a marker other than development is refused", () => {
  for (const marker of ["production", "staging", "dev", "Development"]) {
    const { code, out } = runGuard(
      `NEXT_PUBLIC_APP_ENV=${marker}\nNEXT_PUBLIC_SUPABASE_URL=${LOCAL_API}\n`
    );
    assert.equal(code, 1, `marker "${marker}" should refuse`);
    assert.match(out, /not "development"/);
  }
});

// ---------------------------------------------------------------------------
// Fail-closed basics
// ---------------------------------------------------------------------------
test("a missing env file is refused", () => {
  const result = spawnSync(process.execPath, [GUARD], {
    encoding: "utf8",
    env: {
      ...process.env,
      DB_GUARD_ENV_FILE: join(tmpdir(), "definitely-absent-guard-env"),
    },
  });
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}${result.stderr}`, /no /);
});

test("a missing API URL is refused", () => {
  const { code, out } = runGuard(`NEXT_PUBLIC_APP_ENV=development\n`);
  assert.equal(code, 1);
  assert.match(out, /NEXT_PUBLIC_SUPABASE_URL is missing/);
});
