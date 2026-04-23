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
const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: migrateUrl },
});
process.exit(typeof r.status === "number" ? r.status : 1);
