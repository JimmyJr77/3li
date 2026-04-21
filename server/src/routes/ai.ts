import { Router } from "express";
import { prepareConsultingTurn } from "../lib/chat/prepareTurn.js";
import { prisma } from "../lib/db.js";
import { getOpenAIOrNull } from "../lib/openai/client.js";
import { runBrainstormAI } from "../lib/openai/orchestrator.js";
import { parseThinkingMode } from "../lib/openai/thinkingMode.js";

const router = Router();

router.post("/brainstorm", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(503).json({
        error: "AI service unavailable",
        detail: "OPENAI_API_KEY is not configured",
      });
      return;
    }

    const { prompt, mode, context } = req.body as {
      prompt?: string;
      mode?: unknown;
      context?: { selectedNodeSummary?: string; canvasSummary?: string };
    };

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const thinkingMode = parseThinkingMode(mode);
    if (!thinkingMode) {
      res.status(400).json({ error: "mode must be divergent | convergent | strategic | execution" });
      return;
    }

    const result = await runBrainstormAI(thinkingMode, prompt, context);
    res.json({ result });
  } catch {
    res.status(500).json({ error: "AI request failed" });
  }
});

router.post("/chat", async (req, res) => {
  try {
    const openai = getOpenAIOrNull();
    if (!openai) {
      res.status(503).json({
        error: "AI service unavailable",
        detail: "OPENAI_API_KEY is not configured",
      });
      return;
    }

    const body = req.body as {
      prompt?: string;
      message?: string;
      projectId?: string;
      threadId?: string | null;
      consultingMode?: unknown;
      workspaceId?: string | null;
    };
    const message = (typeof body.message === "string" ? body.message : undefined) ??
      (typeof body.prompt === "string" ? body.prompt : undefined);

    if (!message?.trim()) {
      res.status(400).json({ error: "prompt or message is required" });
      return;
    }

    const prep = await prepareConsultingTurn(openai, { ...body, message: message.trim() });
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: prep.openaiMessages,
    });
    const full = completion.choices[0]?.message?.content ?? "";
    if (!full) {
      res.status(500).json({ error: "Empty AI response" });
      return;
    }

    await prisma.chatMessage.create({
      data: {
        threadId: prep.thread.id,
        role: "assistant",
        content: full,
        citations: prep.citationPayload.length ? prep.citationPayload : undefined,
      },
    });
    await prisma.chatThread.update({
      where: { id: prep.thread.id },
      data: { updatedAt: new Date() },
    });

    res.json({
      result: full,
      threadId: prep.thread.id,
      projectId: prep.projectId,
      consultingMode: prep.mode,
      citations: prep.citationPayload,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "THREAD_NOT_FOUND") {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    if (msg === "THREAD_PROJECT_MISMATCH") {
      res.status(400).json({ error: "thread project mismatch" });
      return;
    }
    if (msg === "message is required") {
      res.status(400).json({ error: "prompt or message is required" });
      return;
    }
    if (msg === "MESSAGE_STATE_INVALID") {
      res.status(500).json({ error: "Message state invalid" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
