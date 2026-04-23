import "./env.js";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import { ensureSeedUsers } from "./lib/auth/seedUsers.js";
import { loadSessionUser, requireAuth } from "./lib/auth/sessionDb.js";
import aiRouter from "./routes/ai.js";
import authRouter from "./routes/auth.js";
import brainstormRouter from "./routes/brainstorm.js";
import chatAppRouter from "./routes/chatApp.js";
import notesAppRouter, { handleNotesAppPublicSlug } from "./routes/notesApp.js";
import taskAppRouter from "./routes/taskApp.js";

function parseAllowedOrigins(): string[] {
  const fromEnv =
    process.env.CLIENT_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const out = new Set<string>(["http://localhost:5173", "http://127.0.0.1:5173", ...fromEnv]);
  if (process.env.VERCEL_URL) {
    out.add(`https://${process.env.VERCEL_URL}`);
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "three-lions-api" });
});

app.get("/api/notes-app/public/:publicSlug", (req, res) => {
  void handleNotesAppPublicSlug(req, res);
});

app.use("/api/auth", authRouter);

const protectedApi = express.Router();
protectedApi.use(requireAuth);
protectedApi.use("/ai", aiRouter);
protectedApi.use("/brainstorm", brainstormRouter);
protectedApi.use("/chat", chatAppRouter);
protectedApi.use("/task-app", taskAppRouter);
protectedApi.use("/notes-app", notesAppRouter);

app.use("/api", protectedApi);

const indexHtmlPath = path.join(process.cwd(), "public", "index.html");

app.get(/^(?!\/api(\/|$)).*/, (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }
  if (!fs.existsSync(indexHtmlPath)) {
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
