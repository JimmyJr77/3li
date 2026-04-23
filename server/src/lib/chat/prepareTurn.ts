import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { prisma } from "../db.js";
import type { OpenAI } from "openai";
import {
  type ConsultingMode,
  defaultConsultingMode,
  parseConsultingMode,
} from "../openai/chatMode.js";
import { formatBrandProfileForPrompt } from "../brandProfileFormat.js";
import { loadBrandProfileJsonForWorkspaceId } from "../brandProfileFromWorkspace.js";
import { buildRagContextBlock, systemPromptForConsultingMode } from "../openai/chatPrompts.js";
import { embedQuery } from "../rag/embeddings.js";
import { searchProjectChunks } from "../rag/searchChunks.js";
import { ensureBrainstormProjectForWorkspace } from "../brainstormProject.js";
import { ensureDefaultWorkspaceBoard } from "../taskDefaults.js";
import { formatTeamUserBlocksForPrompt, loadContextInstructionsForWorkspace } from "../contextInstructions.js";

export type CitationPayload = { ref: number; chunkId: string; filename: string };

/** Resolves the consulting-chat / RAG `Project` for a brand workspace (one per workspace). */
export async function getOrCreateProjectForWorkspace(workspaceId: string | null | undefined) {
  if (workspaceId) {
    return ensureBrainstormProjectForWorkspace(workspaceId);
  }
  const { workspace } = await ensureDefaultWorkspaceBoard();
  return ensureBrainstormProjectForWorkspace(workspace.id);
}

export async function getOrCreateDefaultProject() {
  const { workspace } = await ensureDefaultWorkspaceBoard();
  return ensureBrainstormProjectForWorkspace(workspace.id);
}

export type PrepareTurnBody = {
  projectId?: string;
  threadId?: string | null;
  workspaceId?: string | null;
  consultingMode?: unknown;
  message?: string;
  /** Device Rapid Router snippets etc., merged after DB workspace kit. */
  brandCenterContext?: string | null;
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

  let thread =
    body.threadId ?
      await prisma.chatThread.findUnique({ where: { id: body.threadId } })
    : null;

  if (body.threadId && !thread) {
    throw new Error("THREAD_NOT_FOUND");
  }

  const projectId =
    body.projectId ??
    thread?.projectId ??
    (await getOrCreateProjectForWorkspace(body.workspaceId ?? thread?.workspaceId)).id;

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

  let brandBlock = "";
  if (thread.workspaceId) {
    try {
      const kit = await loadBrandProfileJsonForWorkspaceId(thread.workspaceId);
      brandBlock = formatBrandProfileForPrompt(kit);
    } catch (e) {
      console.warn("Brand profile load skipped:", e);
    }
  }

  let brandSupplement = (body.brandCenterContext ?? "").trim();
  if (brandSupplement.length > 8000) {
    brandSupplement = `${brandSupplement.slice(0, 8000)}\n…(truncated)`;
  }
  const brandMerged = [brandBlock, brandSupplement ? `Brand quick captures (this device):\n${brandSupplement}` : ""]
    .filter(Boolean)
    .join("\n\n");

  const { team: teamRaw, user: userRaw } = await loadContextInstructionsForWorkspace(thread.workspaceId);
  const { teamBlock, userBlock } = formatTeamUserBlocksForPrompt(teamRaw, userRaw);

  const consultantAgentDirective =
    "You are the Consultant Agent: follow team methodology before individual preferences when both are present; if the user asks for something that conflicts with team rules, say so explicitly.";

  const systemContent = [
    systemPromptForConsultingMode(mode),
    consultantAgentDirective,
    teamBlock,
    userBlock,
    ragBlock,
    brandMerged,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

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
