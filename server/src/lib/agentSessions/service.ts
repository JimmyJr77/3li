import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import {
  AGENT_KIND_ADVISOR_AGENTS,
  AGENT_KIND_BRAINSTORM_AI,
  EVENT_ASSISTANT_MESSAGE,
  EVENT_BRAINSTORM_TURN,
  EVENT_MAIL_DECOMPOSE,
  EVENT_MAIL_PLAN,
  EVENT_MAIL_ROUTE,
  EVENT_USER_MESSAGE,
} from "./constants.js";
import { titleFromText, truncateForEvent } from "./sanitizePayload.js";

export type HubBrainstormKind = typeof AGENT_KIND_BRAINSTORM_AI | typeof AGENT_KIND_ADVISOR_AGENTS;

async function nextSeq(tx: Prisma.TransactionClient, sessionId: string): Promise<number> {
  const last = await tx.agentSessionEvent.findFirst({
    where: { sessionId },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  return (last?.seq ?? 0) + 1;
}

async function verifySessionForReuse(
  sessionId: string,
  workspaceId: string,
  agentKind: string,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const row = await prisma.agentSession.findFirst({
    where: {
      id: sessionId,
      workspaceId,
      agentKind,
      archivedAt: null,
    },
    select: { id: true },
  });
  return row ? { ok: true, id: row.id } : { ok: false };
}

export async function ensureSession(
  workspaceId: string,
  agentKind: string,
  existingSessionId: string | undefined,
  titleHint: string,
  metadata?: Record<string, unknown> | null,
): Promise<string> {
  if (existingSessionId) {
    const v = await verifySessionForReuse(existingSessionId, workspaceId, agentKind);
    if (v.ok) return v.id;
  }
  const session = await prisma.agentSession.create({
    data: {
      workspaceId,
      agentKind,
      title: titleFromText(titleHint),
      metadata: metadata === undefined ? undefined : (metadata as object),
    },
  });
  return session.id;
}

export async function appendEvents(
  sessionId: string,
  rows: { type: string; payload?: Record<string, unknown> | null }[],
): Promise<void> {
  if (rows.length === 0) return;
  await prisma.$transaction(async (tx) => {
    let seq = await nextSeq(tx, sessionId);
    for (const row of rows) {
      await tx.agentSessionEvent.create({
        data: {
          sessionId,
          seq,
          type: row.type,
          payload: row.payload === undefined || row.payload === null ? undefined : (row.payload as object),
        },
      });
      seq += 1;
    }
    await tx.agentSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  });
}

type LogPmParams = {
  workspaceId: string;
  agentSessionId?: string | null;
  message: string;
  result: string;
  contextSnippet?: string | null;
};

export async function logProjectManagerTurn(p: LogPmParams): Promise<{ agentSessionId: string }> {
  const sid = await ensureSession(
    p.workspaceId,
    "project_manager",
    typeof p.agentSessionId === "string" ? p.agentSessionId : undefined,
    p.message,
    null,
  );
  const userPayload: Record<string, unknown> = { text: truncateForEvent(p.message) };
  if (p.contextSnippet) userPayload.contextSnippet = truncateForEvent(p.contextSnippet, 4000);
  await appendEvents(sid, [
    { type: EVENT_USER_MESSAGE, payload: userPayload },
    { type: EVENT_ASSISTANT_MESSAGE, payload: { text: truncateForEvent(p.result) } },
  ]);
  return { agentSessionId: sid };
}

type LogBrandParams = {
  workspaceId: string;
  agentSessionId?: string | null;
  surfaceType: "brand_rep_review" | "brand_rep_center";
  userMessage: string;
  assistantText: string;
  /** Full `User: … / Brand Rep: …` thread sent to the model; stored for dashboard history. */
  transcript?: string | null;
  extras?: Record<string, unknown> | null;
};

export async function logBrandRepTurn(p: LogBrandParams): Promise<{ agentSessionId: string }> {
  const sid = await ensureSession(
    p.workspaceId,
    "brand_rep",
    typeof p.agentSessionId === "string" ? p.agentSessionId : undefined,
    p.userMessage,
    { surfaceType: p.surfaceType },
  );
  const transcriptTrim = typeof p.transcript === "string" ? p.transcript.trim() : "";
  await appendEvents(sid, [
    {
      type: EVENT_USER_MESSAGE,
      payload: {
        text: truncateForEvent(p.userMessage),
        surfaceType: p.surfaceType,
        ...(transcriptTrim ? { transcript: truncateForEvent(transcriptTrim) } : {}),
        ...(p.extras ?? {}),
      },
    },
    { type: EVENT_ASSISTANT_MESSAGE, payload: { text: truncateForEvent(p.assistantText) } },
  ]);
  return { agentSessionId: sid };
}

type LogMailParams = {
  workspaceId: string;
  agentSessionId?: string | null;
  surfaceType: "mail_clerk_decompose" | "mail_clerk_route" | "mail_clerk_plan";
  titleHint: string;
  summary: string;
  payload: Record<string, unknown>;
  /** Inbound capture / instruction text so the session history is not only the model summary. */
  userInputSummary?: string | null;
};

export async function logMailClerkTurn(p: LogMailParams): Promise<{ agentSessionId: string }> {
  const eventType =
    p.surfaceType === "mail_clerk_decompose"
      ? EVENT_MAIL_DECOMPOSE
      : p.surfaceType === "mail_clerk_route"
        ? EVENT_MAIL_ROUTE
        : EVENT_MAIL_PLAN;
  const sid = await ensureSession(
    p.workspaceId,
    "mail_clerk",
    typeof p.agentSessionId === "string" ? p.agentSessionId : undefined,
    p.titleHint,
    null,
  );
  const userIn = typeof p.userInputSummary === "string" ? p.userInputSummary.trim() : "";
  await appendEvents(sid, [
    {
      type: eventType,
      payload: {
        executiveSummary: truncateForEvent(p.summary, 2000),
        detail: p.payload,
        ...(userIn ? { userInput: truncateForEvent(userIn, 8000) } : {}),
      },
    },
  ]);
  return { agentSessionId: sid };
}

type LogBrainstormParams = {
  workspaceId: string;
  hubAgentKind: HubBrainstormKind;
  agentSessionId?: string | null;
  prompt: string;
  result: string;
  mode: string;
  agentRole?: string;
  brainstormCanvasSessionId?: string | null;
};

export async function logBrainstormAiTurn(p: LogBrainstormParams): Promise<{ agentSessionId: string }> {
  const meta: Record<string, unknown> = {
    mode: p.mode,
    agentRole: p.agentRole ?? null,
  };
  if (p.brainstormCanvasSessionId) meta.brainstormCanvasSessionId = p.brainstormCanvasSessionId;
  const sid = await ensureSession(
    p.workspaceId,
    p.hubAgentKind,
    typeof p.agentSessionId === "string" ? p.agentSessionId : undefined,
    p.prompt,
    meta,
  );
  await appendEvents(sid, [
    {
      type: EVENT_BRAINSTORM_TURN,
      payload: {
        prompt: truncateForEvent(p.prompt),
        result: truncateForEvent(p.result),
        mode: p.mode,
        agentRole: p.agentRole ?? null,
      },
    },
  ]);
  return { agentSessionId: sid };
}
