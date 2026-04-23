import { createHash } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/db.js";
import {
  aiServiceUnavailableDetail,
  chatModel,
  embeddingsServiceUnavailableDetail,
  getAiPublicMetadata,
  getEmbeddingsOpenAIOrNull,
  getOpenAIOrNull,
} from "../lib/openai/client.js";
import { defaultConsultingMode, parseConsultingMode } from "../lib/openai/chatMode.js";
import { chunkText } from "../lib/rag/chunkText.js";
import { embedQuery, embedTexts } from "../lib/rag/embeddings.js";
import { searchProjectChunks } from "../lib/rag/searchChunks.js";
import { assertProjectAccess, assertWorkspaceAccess, workspaceWhereForAppUser } from "../lib/auth/workspaceScope.js";
import { ensureBrainstormProjectForWorkspace } from "../lib/brainstormProject.js";
import { ensurePersonalWorkspaceBoard } from "../lib/taskDefaults.js";
import { getOrCreateDefaultProject, prepareConsultingTurn } from "../lib/chat/prepareTurn.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function sseWrite(res: import("express").Response, obj: object) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

router.get("/bootstrap", async (req, res) => {
  try {
    const user = req.appUser!;
    const workspaces = await prisma.workspace.findMany({
      where: workspaceWhereForAppUser(user),
      orderBy: { createdAt: "asc" },
      include: {
        brand: { select: { name: true } },
        projectSpaces: {
          orderBy: { position: "asc" },
          include: {
            boards: { orderBy: { position: "asc" }, select: { id: true, name: true, position: true } },
          },
        },
      },
    });
    const projectIdByWorkspaceId: Record<string, string> = {};
    for (const w of workspaces) {
      const p = await ensureBrainstormProjectForWorkspace(w.id);
      projectIdByWorkspaceId[w.id] = p.id;
    }
    const wsIds = workspaces.map((w) => w.id);
    const projects =
      wsIds.length === 0 ?
        []
      : await prisma.project.findMany({
          where: { workspaceId: { in: wsIds } },
          orderBy: { createdAt: "asc" },
        });
    const { workspace, board } = await ensurePersonalWorkspaceBoard(user);
    const defaultProject = await ensureBrainstormProjectForWorkspace(workspace.id);
    res.json({
      ai: getAiPublicMetadata(),
      defaultProjectId: defaultProject.id,
      projectIdByWorkspaceId,
      projects,
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        brandName: w.brand.name,
        projectSpaces: w.projectSpaces,
      })),
      defaultWorkspaceId: workspace.id,
      defaultBoardId: board.id,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Bootstrap failed" });
  }
});

router.get("/projects", async (req, res) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: workspaceWhereForAppUser(req.appUser!),
      select: { id: true },
    });
    const wsIds = workspaces.map((w) => w.id);
    const projects =
      wsIds.length === 0 ?
        []
      : await prisma.project.findMany({
          where: { workspaceId: { in: wsIds } },
          orderBy: { createdAt: "asc" },
        });
    res.json(projects);
  } catch {
    res.status(500).json({ error: "Failed to list projects" });
  }
});

router.get("/threads", async (req, res) => {
  try {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }
    const ok = await assertProjectAccess(req.appUser!, projectId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const threads = await prisma.chatThread.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { messages: true } },
      },
    });
    res.json(threads);
  } catch {
    res.status(500).json({ error: "Failed to list threads" });
  }
});

router.post("/threads", async (req, res) => {
  try {
    const body = req.body as {
      projectId?: string;
      title?: string;
      workspaceId?: string | null;
      consultingMode?: unknown;
    };
    let projectId = body.projectId;
    if (!projectId) {
      if (body.workspaceId) {
        const ok = await assertWorkspaceAccess(req.appUser!, body.workspaceId);
        if (!ok) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        projectId = (await ensureBrainstormProjectForWorkspace(body.workspaceId)).id;
      } else {
        projectId = (await getOrCreateDefaultProject(req.appUser!)).id;
      }
    } else {
      const ok = await assertProjectAccess(req.appUser!, projectId);
      if (!ok) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    if (typeof body.workspaceId === "string" && body.workspaceId.trim()) {
      const ok = await assertWorkspaceAccess(req.appUser!, body.workspaceId.trim());
      if (!ok) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    const mode = parseConsultingMode(body.consultingMode) ?? defaultConsultingMode();
    const thread = await prisma.chatThread.create({
      data: {
        projectId,
        title: body.title?.trim() || "New chat",
        consultingMode: mode,
        workspaceId: body.workspaceId ?? undefined,
      },
    });
    res.status(201).json(thread);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create thread" });
  }
});

router.get("/threads/:threadId", async (req, res) => {
  try {
    const thread = await prisma.chatThread.findUnique({
      where: { id: req.params.threadId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        project: { select: { id: true, name: true } },
        workspace: { select: { id: true, name: true } },
      },
    });
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    const ok = await assertProjectAccess(req.appUser!, thread.projectId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json(thread);
  } catch {
    res.status(500).json({ error: "Failed to load thread" });
  }
});

router.patch("/threads/:threadId", async (req, res) => {
  try {
    const existing = await prisma.chatThread.findUnique({ where: { id: req.params.threadId } });
    if (!existing) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    if (!(await assertProjectAccess(req.appUser!, existing.projectId))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const { title, consultingMode, workspaceId } = req.body as {
      title?: string;
      consultingMode?: unknown;
      workspaceId?: string | null;
    };
    if (workspaceId !== undefined && workspaceId) {
      const ok = await assertWorkspaceAccess(req.appUser!, workspaceId);
      if (!ok) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    const mode = parseConsultingMode(consultingMode);
    const thread = await prisma.chatThread.update({
      where: { id: req.params.threadId },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(mode ? { consultingMode: mode } : {}),
        ...(workspaceId !== undefined ? { workspaceId: workspaceId || null } : {}),
      },
    });
    res.json(thread);
  } catch {
    res.status(500).json({ error: "Failed to update thread" });
  }
});

router.delete("/threads/:threadId", async (req, res) => {
  try {
    const existing = await prisma.chatThread.findUnique({ where: { id: req.params.threadId } });
    if (!existing) {
      res.status(404).end();
      return;
    }
    if (!(await assertProjectAccess(req.appUser!, existing.projectId))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await prisma.chatThread.delete({ where: { id: req.params.threadId } });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete thread" });
  }
});

router.get("/documents", async (req, res) => {
  try {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }
    if (!(await assertProjectAccess(req.appUser!, projectId))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const docs = await prisma.chatDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        mime: true,
        source: true,
        status: true,
        createdAt: true,
        threadId: true,
        _count: { select: { chunks: true } },
      },
    });
    res.json(docs);
  } catch {
    res.status(500).json({ error: "Failed to list documents" });
  }
});

router.post("/search", async (req, res) => {
  try {
    if (!getEmbeddingsOpenAIOrNull()) {
      res.status(503).json({
        error: "Embeddings unavailable",
        detail: embeddingsServiceUnavailableDetail(),
      });
      return;
    }
    const { projectId, query, topK } = req.body as {
      projectId?: string;
      query?: string;
      topK?: number;
    };
    if (!projectId || !query?.trim()) {
      res.status(400).json({ error: "projectId and query are required" });
      return;
    }
    if (!(await assertProjectAccess(req.appUser!, projectId))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const k = typeof topK === "number" && topK > 0 && topK <= 24 ? topK : 8;
    const qEmb = await embedQuery(query.trim());
    const hits = await searchProjectChunks(projectId, qEmb, k);
    res.json({ hits });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Search failed" });
  }
});

router.post("/documents", upload.single("file"), async (req, res) => {
  try {
    if (!getEmbeddingsOpenAIOrNull()) {
      res.status(503).json({
        error: "Embeddings unavailable",
        detail: embeddingsServiceUnavailableDetail(),
      });
      return;
    }
    const projectId =
      typeof req.body.projectId === "string" ? req.body.projectId : undefined;
    const threadId =
      typeof req.body.threadId === "string" && req.body.threadId ? req.body.threadId : undefined;
    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }
    if (!(await assertProjectAccess(req.appUser!, projectId))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const file = req.file;
    if (!file?.buffer) {
      res.status(400).json({ error: "file is required" });
      return;
    }

    const filename = file.originalname || "upload";
    const mime = file.mimetype || "application/octet-stream";
    const hash = createHash("sha256").update(file.buffer).digest("hex");

    let text: string;
    try {
      const { extractTextFromBuffer } = await import("../lib/rag/extractText.js");
      text = await extractTextFromBuffer(file.buffer, mime, filename);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Could not read file" });
      return;
    }

    if (!text.trim()) {
      res.status(400).json({ error: "No extractable text in file" });
      return;
    }

    const pieces = chunkText(text);
    if (pieces.length === 0) {
      res.status(400).json({ error: "Nothing to index after chunking" });
      return;
    }

    const embeddings = await embedTexts(pieces);

    const doc = await prisma.$transaction(async (tx) => {
      const d = await tx.chatDocument.create({
        data: {
          projectId,
          threadId,
          filename,
          mime,
          source: "upload",
          contentHash: hash,
          status: "ready",
          extractedText: text.slice(0, 50_000),
        },
      });
      for (let i = 0; i < pieces.length; i++) {
        await tx.documentChunk.create({
          data: {
            documentId: d.id,
            chunkIndex: i,
            content: pieces[i],
            embedding: embeddings[i] as object,
          },
        });
      }
      return d;
    });

    res.status(201).json({
      id: doc.id,
      filename: doc.filename,
      chunkCount: pieces.length,
      status: doc.status,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Upload failed" });
  }
});

router.delete("/documents/:documentId", async (req, res) => {
  try {
    const row = await prisma.chatDocument.findUnique({
      where: { id: req.params.documentId },
      select: { projectId: true },
    });
    if (!row) {
      res.status(404).end();
      return;
    }
    if (!(await assertProjectAccess(req.appUser!, row.projectId))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await prisma.chatDocument.delete({ where: { id: req.params.documentId } });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

router.post("/stream", async (req, res) => {
  const openai = getOpenAIOrNull();
  if (!openai) {
    res.status(503).json({
      error: "AI service unavailable",
      detail: aiServiceUnavailableDetail(),
    });
    return;
  }

  let prep: Awaited<ReturnType<typeof prepareConsultingTurn>>;
  try {
    prep = await prepareConsultingTurn(req.appUser!, req.body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "WORKSPACE_FORBIDDEN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (msg === "THREAD_NOT_FOUND") {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    if (msg === "THREAD_PROJECT_MISMATCH") {
      res.status(400).json({ error: "thread project mismatch" });
      return;
    }
    if (msg === "message is required") {
      res.status(400).json({ error: "message is required" });
      return;
    }
    if (msg === "MESSAGE_STATE_INVALID") {
      res.status(500).json({ error: "Message state invalid" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Could not start chat turn" });
    return;
  }

  const { thread, projectId, mode, openaiMessages, citationPayload } = prep;

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  sseWrite(res, {
    type: "meta",
    threadId: thread.id,
    projectId,
    consultingMode: mode,
  });

  let full = "";
  try {
    const stream = await openai.chat.completions.create({
      model: chatModel("primary"),
      messages: openaiMessages,
      stream: true,
    });

    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        sseWrite(res, { type: "token", text: delta });
      }
    }

    const assistantMsg = await prisma.chatMessage.create({
      data: {
        threadId: thread.id,
        role: "assistant",
        content: full,
        citations: citationPayload.length ? citationPayload : undefined,
      },
    });

    await prisma.chatThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    sseWrite(res, {
      type: "done",
      messageId: assistantMsg.id,
      citations: citationPayload,
    });
    res.end();
  } catch (e) {
    console.error(e);
    sseWrite(res, { type: "error", message: e instanceof Error ? e.message : "stream failed" });
    res.end();
  }
});

router.get("/templates", (_req, res) => {
  res.json({
    templates: [
      {
        id: "exec-summary",
        label: "Executive summary",
        body: "Produce a one-page executive summary: situation, complication, key findings, recommendations, and next steps. Audience: executive steering committee.",
      },
      {
        id: "issue-tree",
        label: "Issue tree",
        body: "Build an issue tree for this problem statement. Use MECE branches, testable hypotheses at leaves, and note data sources needed.",
      },
      {
        id: "roadmap",
        label: "90-day roadmap",
        body: "Draft a 90-day roadmap with milestones, owners, risks, and dependencies. Group by workstream.",
      },
    ],
  });
});

router.get("/flows", (_req, res) => {
  res.json({
    flows: [
      {
        id: "mece",
        title: "MECE problem framing",
        description: "Structure the problem before jumping to solutions.",
        steps: [
          {
            id: "s1",
            label: "1. Problem statement",
            prompt:
              "State the client’s problem in one sentence, the stakeholder perspective, and success criteria.",
          },
          {
            id: "s2",
            label: "2. MECE buckets",
            prompt:
              "Propose 3–5 MECE (mutually exclusive, collectively exhaustive) buckets for this problem. Explain gaps or overlaps to avoid.",
          },
          {
            id: "s3",
            label: "3. Key questions",
            prompt:
              "For each bucket, list the top questions to answer and the data or interviews needed.",
          },
        ],
      },
      {
        id: "hypothesis",
        title: "Hypothesis-led analysis",
        description: "Move from guesses to tests.",
        steps: [
          {
            id: "h1",
            label: "1. Leading hypotheses",
            prompt: "List 3–5 hypotheses ranked by impact × ease to test. Mark which are falsifiable.",
          },
          {
            id: "h2",
            label: "2. Evidence plan",
            prompt: "For the top 2 hypotheses, specify analyses, datasets, and decision thresholds.",
          },
        ],
      },
      {
        id: "financial",
        title: "Financial lens",
        description: "Quick structure for numbers-heavy questions.",
        steps: [
          {
            id: "f1",
            label: "1. Baseline & drivers",
            prompt:
              "Identify revenue/cost drivers, unit economics, and the 3 biggest sensitivities. Call out missing data explicitly.",
          },
          {
            id: "f2",
            label: "2. Scenarios",
            prompt: "Outline base / upside / downside with assumptions and implications for the recommendation.",
          },
        ],
      },
    ],
  });
});

router.post("/export/pptx", async (req, res) => {
  try {
    const body = req.body as {
      threadId?: string;
      messageId?: string;
      text?: string;
      title?: string;
    };
    let deckTitle = body.title?.trim() || "Consulting deck";
    let content = typeof body.text === "string" ? body.text.trim() : "";

    if (body.threadId) {
      const thread = await prisma.chatThread.findUnique({
        where: { id: body.threadId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!thread) {
        res.status(404).json({ error: "Thread not found" });
        return;
      }
      if (!(await assertProjectAccess(req.appUser!, thread.projectId))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      deckTitle = body.title?.trim() || thread.title;
      const targetMsg =
        body.messageId ?
          thread.messages.find((m) => m.id === body.messageId)
        : [...thread.messages].reverse().find((m) => m.role === "assistant");
      if (!targetMsg) {
        res.status(400).json({ error: "No message to export" });
        return;
      }
      if (targetMsg.role !== "assistant") {
        res.status(400).json({ error: "Selected message must be an assistant reply" });
        return;
      }
      content = targetMsg.content;
    }

    if (!content) {
      res.status(400).json({ error: "Provide text or a threadId with an assistant message" });
      return;
    }

    const { buildPptxBuffer, slugifyFilename } = await import("../lib/export/pptxDeck.js");
    const buffer = await buildPptxBuffer(deckTitle, content);
    const name = slugifyFilename(deckTitle);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${name}.pptx"`);
    res.send(buffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Export failed" });
  }
});

router.post("/documents/ingest-local", async (req, res) => {
  if (process.env.ALLOW_LOCAL_PATH_INGEST !== "true") {
    res.status(503).json({
      error: "Local path ingestion is disabled",
      detail: "Set ALLOW_LOCAL_PATH_INGEST=true and LOCAL_INGEST_ROOT on the server",
    });
    return;
  }
  if (!getEmbeddingsOpenAIOrNull()) {
    res.status(503).json({
      error: "Embeddings unavailable",
      detail: embeddingsServiceUnavailableDetail(),
    });
    return;
  }
  const body = req.body as { projectId?: string; threadId?: string; relativePath?: string };
  if (!body.projectId || typeof body.relativePath !== "string") {
    res.status(400).json({ error: "projectId and relativePath are required" });
    return;
  }
  if (!(await assertProjectAccess(req.appUser!, body.projectId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rawMax = Number(process.env.LOCAL_INGEST_MAX_FILES ?? "40");
  const maxFiles = Number.isFinite(rawMax) && rawMax > 0 ? Math.min(rawMax, 200) : 40;
  try {
    const { ingestLocalPath } = await import("../lib/rag/ingestLocalFolder.js");
    const result = await ingestLocalPath({
      projectId: body.projectId,
      threadId: body.threadId,
      relativePath: body.relativePath,
      maxFiles,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Ingest failed" });
  }
});

export default router;
