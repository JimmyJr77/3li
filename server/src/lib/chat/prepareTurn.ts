import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { prisma } from "../db.js";
import type { OpenAI } from "openai";
import {
  type ConsultingMode,
  defaultConsultingMode,
  parseConsultingMode,
} from "../openai/chatMode.js";
import { buildRagContextBlock, systemPromptForConsultingMode } from "../openai/chatPrompts.js";
import { embedQuery } from "../rag/embeddings.js";
import { searchProjectChunks } from "../rag/searchChunks.js";

export type CitationPayload = { ref: number; chunkId: string; filename: string };

export async function getOrCreateDefaultProject() {
  let project = await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (!project) {
    project = await prisma.project.create({ data: { name: "Workspace" } });
  }
  return project;
}

export type PrepareTurnBody = {
  projectId?: string;
  threadId?: string | null;
  workspaceId?: string | null;
  consultingMode?: unknown;
  message?: string;
};

export async function prepareConsultingTurn(
  openai: OpenAI,
  body: PrepareTurnBody,
): Promise<{
  thread: { id: string; projectId: string; consultingMode: string; workspaceId: string | null };
  projectId: string;
  mode: ConsultingMode;
  openaiMessages: ChatCompletionMessageParam[];
  citationPayload: CitationPayload[];
}> {
  const message = body.message?.trim();
  if (!message) {
    throw new Error("message is required");
  }

  const projectId = body.projectId ?? (await getOrCreateDefaultProject()).id;

  let thread =
    body.threadId ?
      await prisma.chatThread.findUnique({ where: { id: body.threadId } })
    : null;

  if (body.threadId && !thread) {
    throw new Error("THREAD_NOT_FOUND");
  }

  const modeFromRequest = parseConsultingMode(body.consultingMode);

  if (!thread) {
    const mode = modeFromRequest ?? defaultConsultingMode();
    thread = await prisma.chatThread.create({
      data: {
        projectId,
        title: "New chat",
        consultingMode: mode,
        workspaceId: body.workspaceId ?? undefined,
      },
    });
  } else {
    if (thread.projectId !== projectId) {
      throw new Error("THREAD_PROJECT_MISMATCH");
    }
    if (body.workspaceId !== undefined && body.workspaceId !== thread.workspaceId) {
      await prisma.chatThread.update({
        where: { id: thread.id },
        data: { workspaceId: body.workspaceId || null },
      });
      thread = { ...thread, workspaceId: body.workspaceId || null };
    }
    if (modeFromRequest && modeFromRequest !== thread.consultingMode) {
      await prisma.chatThread.update({
        where: { id: thread.id },
        data: { consultingMode: modeFromRequest },
      });
      thread = { ...thread, consultingMode: modeFromRequest };
    }
  }

  const mode =
    modeFromRequest ??
    parseConsultingMode(thread.consultingMode) ??
    defaultConsultingMode();

  if (thread.title === "New chat") {
    await prisma.chatThread.update({
      where: { id: thread.id },
      data: {
        title: message.length > 52 ? `${message.slice(0, 52)}…` : message,
      },
    });
  }

  await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: "user",
      content: message,
    },
  });

  const allMessages = await prisma.chatMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
  });

  const prior = allMessages.slice(0, -1);
  const latestUser = allMessages[allMessages.length - 1];
  if (!latestUser || latestUser.role !== "user") {
    throw new Error("MESSAGE_STATE_INVALID");
  }

  let ragBlock = "";
  const citationPayload: CitationPayload[] = [];

  try {
    const qEmb = await embedQuery(openai, latestUser.content);
    const hits = await searchProjectChunks(projectId, qEmb, 8);
    const items = hits.map((h, i) => ({
      idx: i + 1,
      filename: h.filename,
      excerpt: h.content.length > 900 ? `${h.content.slice(0, 897)}…` : h.content,
      chunkId: h.chunkId,
    }));
    items.forEach((it, i) => {
      citationPayload.push({ ref: i + 1, chunkId: it.chunkId, filename: it.filename });
    });
    ragBlock = buildRagContextBlock(items);
  } catch (e) {
    console.warn("RAG retrieval skipped:", e);
  }

  const systemContent = `${systemPromptForConsultingMode(mode)}\n\n${ragBlock}`.trim();

  const historyMessages: ChatCompletionMessageParam[] = prior.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const openaiMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...historyMessages,
    { role: "user", content: latestUser.content },
  ];

  return {
    thread: {
      id: thread.id,
      projectId: thread.projectId,
      consultingMode: thread.consultingMode,
      workspaceId: thread.workspaceId,
    },
    projectId,
    mode,
    openaiMessages,
    citationPayload,
  };
}
