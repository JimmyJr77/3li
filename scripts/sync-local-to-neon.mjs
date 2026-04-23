#!/usr/bin/env node
/**
 * 1) Applies Prisma migrations to the target DB (Neon).
 * 2) Copies row data from local Postgres with pg_dump --data-only (excludes public._prisma_migrations).
 *
 * Usage (recommended — target URL only in the shell, not in .env):
 *   TARGET_DATABASE_URL='postgresql://…neon…' npm run db:sync-to-neon
 *
 * Source DB defaults to DATABASE_URL from repo-root `.env` (expected: localhost).
 * Override source: SOURCE_DATABASE_URL='postgresql://…' TARGET_DATABASE_URL='…' npm run db:sync-to-neon
 *
 * Requires: pg_dump / pg_restore compatible with your Postgres major version (brew install postgresql@15).
 * Neon: prefer the **non-pooler** “direct” connection string for restore if the pooler times out.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

config({ path: path.join(root, ".env") });

/** Prefer PG_DUMP / PG_RESTORE, then Homebrew @15+ clients (avoids pg_dump 14 vs Postgres 15+ server mismatch). */
function resolvePgTool(name, envOverride) {
  const fromEnv = process.env[envOverride]?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const brewRoots = [
    "/opt/homebrew/opt/postgresql@17/bin",
    "/opt/homebrew/opt/postgresql@16/bin",
    "/opt/homebrew/opt/postgresql@15/bin",
    "/usr/local/opt/postgresql@17/bin",
    "/usr/local/opt/postgresql@16/bin",
    "/usr/local/opt/postgresql@15/bin",
  ];
  for (const dir of brewRoots) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return name;
}

const pgDumpBin = resolvePgTool("pg_dump", "PG_DUMP");
const pgRestoreBin = resolvePgTool("pg_restore", "PG_RESTORE");

function redactUrl(u) {
  try {
    const x = new URL(u);
    if (x.password) x.password = "***";
    return x.origin + x.pathname + x.search;
  } catch {
    return "(unparseable URL)";
  }
}

/** Prisma adds `?schema=public`; libpq rejects that for pg_dump/pg_restore. Neon may add channel_binding. */
function forPgTools(prismaUrl) {
  const u = new URL(prismaUrl);
  u.searchParams.delete("schema");
  u.searchParams.delete("channel_binding");
  const s = u.toString();
  return s.endsWith("?") ? s.slice(0, -1) : s;
}

function mustGet(name, ...aliases) {
  const v = [process.env[name], ...aliases.map((k) => process.env[k])].find((s) => typeof s === "string" && s.trim());
  if (!v?.trim()) {
    const keys = [name, ...aliases].filter(Boolean).join(" or ");
    console.error(`Missing environment variable: ${keys} (see script header).`);
    process.exit(1);
  }
  return v.trim();
}

const targetUrl = mustGet("TARGET_DATABASE_URL", "NEON_DATABASE_URL");
const sourceUrl = mustGet("SOURCE_DATABASE_URL", "DATABASE_URL");

if (/\b(localhost|127\.0\.0\.1)\b/i.test(targetUrl)) {
  console.error("Refusing: TARGET_DATABASE_URL looks like localhost.");
  process.exit(1);
}
if (!/\b(localhost|127\.0\.0\.1)\b/i.test(sourceUrl) && process.env.ALLOW_REMOTE_SOURCE !== "1") {
  console.error(
    "Refusing: SOURCE database does not look like localhost. To override, set ALLOW_REMOTE_SOURCE=1 (be careful).",
  );
  process.exit(1);
}

console.log(`Source (redacted): ${redactUrl(sourceUrl)}`);
console.log(`Target (redacted): ${redactUrl(targetUrl)}`);

const sourcePg = forPgTools(sourceUrl);
const targetPg = forPgTools(targetUrl);

const run = (cmd, args, extraEnv = {}) => {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    cwd: root,
    shell: false,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
};

console.log("\n→ prisma migrate deploy (target)…");
run("npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: targetUrl });

const dumpPath = path.join(os.tmpdir(), `3li-data-${Date.now()}.dump`);
console.log(`\nUsing ${pgDumpBin} / ${pgRestoreBin} (set PG_DUMP / PG_RESTORE to override).`);
console.log("\n→ pg_dump --data-only (source)…");

run(pgDumpBin, [
  "--dbname",
  sourcePg,
  "--data-only",
  "--no-owner",
  "--format=custom",
  "--exclude-table-data=public._prisma_migrations",
  "-f",
  dumpPath,
]);

console.log("\n→ pg_restore --data-only (target)…");
run(pgRestoreBin, [
  "--dbname",
  targetPg,
  "--data-only",
  "--no-owner",
  "--no-privileges",
  "--single-transaction",
  "--verbose",
  dumpPath,
]);

try {
  fs.unlinkSync(dumpPath);
} catch {
  /* ignore */
}

console.log("\nDone. Data copied to Neon (migration history left as from prisma migrate deploy).");
