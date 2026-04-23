/**
 * Vercel serves `api/*` as Node functions. Rewrites send `/api` and `/api/...`
 * here so requests reach Express (same app as `src/index.ts`).
 */
export { default } from "../server/dist/app.js";
