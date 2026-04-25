#!/usr/bin/env node
/**
 * Run `prisma migrate deploy` on Vercel only when DATABASE_URL targets a real host.
 * Skips when unset or when still pointing at localhost (common copy-paste from .env.example).
 *
 * Neon: Prisma Migrate must not use the **pooler** URL (`…-pooler…`); see `scripts/lib/prisma-migrate-database-url.mjs`.
 */
import { spawnSync } from "node:child_process";
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

/** One-shot recovery: an older deploy failed this migration before SQL was idempotent (P3018). Prisma then refuses all deploys (P3009) until `migrate resolve`. */
const STUCK_FAILED_MIGRATION = "20260426120000_project_space_is_default";

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

let { status, out } = migrateDeploy();

if (
  status !== 0 &&
  out.includes("P3009") &&
  out.includes(`\`${STUCK_FAILED_MIGRATION}\``)
) {
  console.log(
    `[vercel-build] P3009: clearing failed migration "${STUCK_FAILED_MIGRATION}" so deploy can re-run (idempotent SQL is in repo).`,
  );
  const resolveRb = spawnSync(
    "npx",
    ["prisma", "migrate", "resolve", "--rolled-back", STUCK_FAILED_MIGRATION],
    { shell: true, env: migrateEnv, stdio: "inherit" },
  );
  if (resolveRb.status !== 0) {
    process.exit(typeof resolveRb.status === "number" ? resolveRb.status : 1);
  }
  ({ status, out } = migrateDeploy());
}

process.exit(status);
