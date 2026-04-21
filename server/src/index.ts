import "dotenv/config";
import cors from "cors";
import express from "express";
import aiRouter from "./routes/ai.js";
import brainstormRouter from "./routes/brainstorm.js";
import chatAppRouter from "./routes/chatApp.js";
import notesAppRouter from "./routes/notesApp.js";
import taskAppRouter from "./routes/taskApp.js";

const app = express();
const port = Number(process.env.PORT) || 3001;
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "three-lions-api" });
});

app.use("/api/ai", aiRouter);
app.use("/api/brainstorm", brainstormRouter);
app.use("/api/chat", chatAppRouter);
app.use("/api/task-app", taskAppRouter);
app.use("/api/notes-app", notesAppRouter);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
