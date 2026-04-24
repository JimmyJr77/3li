import "./env.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import type { Request } from "express";
import { ensureSeedUsers } from "./lib/auth/seedUsers.js";
import { loadSessionUser, requireAuth } from "./lib/auth/sessionDb.js";
import { prisma } from "./lib/db.js";
import agentSessionsRouter from "./routes/agentSessions.js";
import aiRouter from "./routes/ai.js";
import adminUsersRouter from "./routes/adminUsers.js";
import authRouter from "./routes/auth.js";
import brainstormRouter from "./routes/brainstorm.js";
import chatAppRouter from "./routes/chatApp.js";
import notesAppRouter, { handleNotesAppPublicSlug } from "./routes/notesApp.js";
import taskAppRouter from "./routes/taskApp.js";

/** Add `https://host` plus `www.` / apex variant so CORS works for both custom-domain shapes. */
function addOriginVariants(raw: string, out: Set<string>): void {
  const s = raw.trim();
  if (!s) return;
  const withProto = s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`;
  out.add(withProto);
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return;
    const h = u.hostname;
    if (h.startsWith("www.")) {
      const alt = new URL(withProto);
      alt.hostname = h.slice(4);
      out.add(alt.origin);
    } else if (h && !h.startsWith("www.")) {
      const alt = new URL(withProto);
      alt.hostname = `www.${h}`;
      out.add(alt.origin);
    }
  } catch {
    /* ignore malformed URLs */
  }
}

function parseAllowedOrigins(): string[] {
  const out = new Set<string>(["http://localhost:5173", "http://127.0.0.1:5173"]);
  for (const s of process.env.CLIENT_ORIGIN?.split(",").map((x) => x.trim()).filter(Boolean) ?? []) {
    addOriginVariants(s, out);
  }
  if (process.env.VERCEL_URL) {
    out.add(`https://${process.env.VERCEL_URL}`);
  }
  const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prodUrl) {
    addOriginVariants(prodUrl, out);
  }
  return [...out];
}

const allowedOrigins = parseAllowedOrigins();

const app = express();

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));

app.use(loadSessionUser);

app.get("/api/health", async (req, res) => {
  const base = { ok: true as const, service: "three-lions-api" as const };
  if (req.query.db === "1") {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ...base, database: "ok" as const });
    } catch (e) {
      console.error("[health] database ping failed", e);
      res.status(503).json({ ok: false as const, service: base.service, database: "error" as const });
    }
    return;
  }
  res.json(base);
});

app.get("/api/notes-app/public/:publicSlug", (req, res) => {
  void handleNotesAppPublicSlug(req, res);
});

app.use("/api/auth", authRouter);

const protectedApi = express.Router();
protectedApi.use(requireAuth);
protectedApi.use("/ai", aiRouter);
protectedApi.use("/agent-sessions", agentSessionsRouter);
protectedApi.use("/brainstorm", brainstormRouter);
protectedApi.use("/chat", chatAppRouter);
protectedApi.use("/task-app", taskAppRouter);
protectedApi.use("/notes-app", notesAppRouter);
protectedApi.use("/admin/users", adminUsersRouter);

app.use("/api", protectedApi);

/**
 * SPA shell: `vercel-build` / root `build` copy `client/dist/index.html` → `server/dist/spa-index.html`
 * so Express can sendFile it on Vercel (no `public/` inside the function bundle). Repo `public/` is a fallback.
 */
function resolveIndexHtmlPath(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "spa-index.html"),
    path.join(here, "..", "dist", "spa-index.html"),
    path.join(process.cwd(), "public", "index.html"),
    path.join(process.cwd(), "client", "public", "index.html"),
    path.join(here, "..", "..", "public", "index.html"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function wantsSpaShell(req: Request): boolean {
  const m = req.method;
  if (m !== "GET" && m !== "HEAD") return false;
  const p = req.path;
  if (p.startsWith("/api")) return false;
  if (p.startsWith("/assets/")) return false;
  if (p === "/favicon.svg" || p === "/icons.svg") return false;
  return true;
}

app.use((req, res, next) => {
  if (!wantsSpaShell(req)) {
    next();
    return;
  }
  const indexHtmlPath = resolveIndexHtmlPath();
  if (!indexHtmlPath) {
    next();
    return;
  }
  res.sendFile(indexHtmlPath);
});

void ensureSeedUsers().catch((e) => {
  console.error("ensureSeedUsers failed", e);
});

export default app;
export { app };
