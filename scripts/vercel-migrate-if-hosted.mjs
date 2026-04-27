#!/usr/bin/env node
/**
 * Run `prisma migrate deploy` on Vercel only when DATABASE_URL targets a real host.
 * Skips when unset or when still pointing at localhost (common copy-paste from .env.example).
 *
 * Neon: Prisma Migrate must not use the **pooler** URL (`…-pooler…`); see `scripts/lib/prisma-migrate-database-url.mjs`.
 * Retries on P1001 (can't reach database) — Neon suspend / cold start and transient network during Vercel builds.
 */
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { prismaMigrateDatabaseUrl } from "./lib/prisma-migrate-database-url.mjs";

const url = process.env.DATABASE_URL?.trim() ?? "";
if (!url) {
  console.log("[vercel-build] DATABASE_URL is unset; skipping prisma migrate deploy.");
  process.exit(0);
}
if (/\b(localhost|127\.0\.0\.1)\b/i.test(url)) {
  console.log(
    "[vercel-build] DATABASE_URL still points at localhost — skipping prisma migrate deploy so the build can finish.",
  );
  console.log(
    "[vercel-build] In Vercel → Settings → Environment Variables, set DATABASE_URL to your hosted Postgres (Neon, Supabase, Vercel Postgres, etc.), then redeploy. Apply migrations once with: npx prisma migrate deploy",
  );
  process.exit(0);
}

const migrateUrl = prismaMigrateDatabaseUrl(url);
if (migrateUrl !== url) {
  console.log("[vercel-build] Using direct (non-pooler) connection for prisma migrate deploy.");
}

const migrateEnv = { ...process.env, DATABASE_URL: migrateUrl };

/**
 * Migrations we may mark `--rolled-back` after a failed Vercel deploy so `migrate deploy` can retry.
 * Only list migrations whose SQL is idempotent / safe to re-run after Prisma P3009.
 */
const SAFE_AUTO_ROLLBACK_MIGRATIONS = new Set([
  "20260426120000_project_space_is_default",
  "20260426180000_board_user_preferences",
]);

const P1001_MAX_ATTEMPTS = 5;

function parseP3009FailedMigrationName(output) {
  const m = output.match(/The `([^`]+)` migration/);
  return m?.[1] ?? null;
}

function migrateDeploy() {
  const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    shell: true,
    env: migrateEnv,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (out.trim()) console.log(out.trimEnd());
  return { status: typeof r.status === "number" ? r.status : 1, out };
}

/** Neon / network: first connection after suspend often fails with P1001 during short Vercel build windows. */
async function migrateDeployWithP1001Retries() {
  let last = { status: 1, out: "" };
  for (let attempt = 0; attempt < P1001_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = Math.min(16_000, 2000 * 2 ** (attempt - 1));
      console.log(
        `[vercel-build] Prisma P1001 (database unreachable). Retry ${attempt + 1}/${P1001_MAX_ATTEMPTS} after ${delayMs}ms…`,
      );
      await setTimeout(delayMs);
    }
    last = migrateDeploy();
    if (last.status === 0) return last;
    if (!last.out.includes("P1001")) return last;
  }
  return last;
}

async function main() {
  for (let i = 0; i < 6; i++) {
    const { status, out } = await migrateDeployWithP1001Retries();
    if (status === 0) process.exit(0);

    if (out.includes("P3009")) {
      const name = parseP3009FailedMigrationName(out);
      if (name && SAFE_AUTO_ROLLBACK_MIGRATIONS.has(name)) {
        console.log(
          `[vercel-build] P3009: clearing failed migration "${name}" so deploy can re-run (allowlisted recovery).`,
        );
        const resolveRb = spawnSync(
          "npx",
          ["prisma", "migrate", "resolve", "--rolled-back", name],
          { shell: true, env: migrateEnv, stdio: "inherit" },
        );
        if (resolveRb.status !== 0) {
          process.exit(typeof resolveRb.status === "number" ? resolveRb.status : 1);
        }
        continue;
      }
    }

    process.exit(status);
  }

  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
