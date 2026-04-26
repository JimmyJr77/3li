import { Router, type Request, type Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import {
  canvasEdgeToDbRow,
  canvasNodeToDbRow,
  dbEdgeToCanvasEdge,
  dbNodeToCanvasNode,
  type CanvasEdgeIncoming,
  type CanvasNodeIncoming,
} from "../lib/brainstormCanvasMapper.js";
import { ensureBrainstormProjectForWorkspace } from "../lib/brainstormProject.js";
import { assertWorkspaceAccess } from "../lib/auth/workspaceScope.js";
import { allocateBrandTicketNumbers } from "../lib/brandTicketNumbers.js";
import { ensureDefaultBoardForWorkspace, ensurePersonalWorkspaceBoard, getBacklogListId } from "../lib/taskDefaults.js";
import { aiServiceUnavailableDetail, isAiBackendConfigured } from "../lib/openai/client.js";
import { CONVERT_PLAN_SYSTEM } from "../lib/openai/brainstormPrompts.js";
import { runBrainstormWithSystem } from "../lib/openai/orchestrator.js";

const router = Router();

async function requireWorkspaceId(req: Request, res: Response): Promise<string | null> {
  const q = req.query.workspaceId;
  if (typeof q !== "string" || !q.trim()) {
    res.status(400).json({ error: "workspaceId is required" });
    return null;
  }
  const workspaceId = q.trim();
  const ok = await assertWorkspaceAccess(req.appUser!, workspaceId);
  if (!ok) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return workspaceId;
}

function brainstorm500(res: Response, route: string, publicMessage: string, err: unknown) {
  console.error(`[api/brainstorm] ${route}`, err);
  const body: { error: string; detail?: string } = { error: publicMessage };
  if (process.env.NODE_ENV !== "production") {
    const detail =
      err instanceof Error ? err.message : err !== undefined ? String(err) : undefined;
    if (detail) {
      body.detail = detail;
    }
  }
  res.status(500).json(body);
}

async function getOrCreateDefaultSession(req: Request) {
  const user = req.appUser!;
  const q = req.query.workspaceId;
  let workspaceId: string;
  if (typeof q === "string" && q.trim()) {
    workspaceId = q.trim();
    const ok = await assertWorkspaceAccess(user, workspaceId);
    if (!ok) {
      throw new Error("WORKSPACE_FORBIDDEN");
    }
  } else {
    const { workspace } = await ensurePersonalWorkspaceBoard(user);
    workspaceId = workspace.id;
  }
  const project = await ensureBrainstormProjectForWorkspace(workspaceId);
  let session = await prisma.brainstormSession.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: "asc" },
  });
  if (!session) {
    session = await prisma.brainstormSession.create({
      data: { projectId: project.id, title: "Main" },
    });
  }
  return { project, session };
}

function buildSessionPayload(
  project: { id: string; name: string },
  full: {
    id: string;
    title: string;
    updatedAt: Date;
    nodes: Array<{
      id: string;
      kind: string;
      payload: Prisma.JsonValue | null;
      positionX: number;
      positionY: number;
      title: string;
      description: string;
      tags: string[];
      status: string;
      priority: string;
    }>;
    edges: Array<{
      id: string;
      sourceId: string;
      targetId: string;
      lineStyle: string;
      label: string;
      sourceHandle: string | null;
      targetHandle: string | null;
    }>;
  },
) {
  const nodes = full.nodes.map((n) => dbNodeToCanvasNode(n));
  const edges = full.edges.map((e) => dbEdgeToCanvasEdge(e));

  return {
    project,
    session: { id: full.id, title: full.title, updatedAt: full.updatedAt },
    nodes,
    edges,
  };
}

async function putCanvas(
  sessionId: string,
  workspaceId: string,
  body: { nodes?: CanvasNodeIncoming[]; edges?: CanvasEdgeIncoming[] },
) {
  const project = await ensureBrainstormProjectForWorkspace(workspaceId);
  const session = await prisma.brainstormSession.findFirst({
    where: { id: sessionId, projectId: project.id },
  });
  if (!session) {
    return { error: "not_found" as const };
  }

  const nodes = body.nodes ?? [];
  const edges = body.edges ?? [];

  await prisma.$transaction(async (tx) => {
    await tx.ideaEdge.deleteMany({ where: { sessionId } });
    await tx.ideaNode.deleteMany({ where: { sessionId } });

    for (const n of nodes) {
      const row = canvasNodeToDbRow(n);
      await tx.ideaNode.create({
        data: {
          id: row.id,
          sessionId,
          kind: row.kind,
          payload: row.payload === null ? undefined : row.payload,
          positionX: row.positionX,
          positionY: row.positionY,
          title: row.title,
          description: row.description,
          tags: row.tags,
          status: row.status,
          priority: row.priority,
        },
      });
    }

    for (const e of edges) {
      const row = canvasEdgeToDbRow(e);
      await tx.ideaEdge.create({
        data: {
          id: row.id,
          sessionId,
          sourceId: row.sourceId,
          targetId: row.targetId,
          lineStyle: row.lineStyle,
          label: row.label,
          sourceHandle: row.sourceHandle,
          targetHandle: row.targetHandle,
        },
      });
    }
  });

  return { ok: true as const };
}

// --- Multi-session API ---

router.get("/sessions", async (req, res) => {
  try {
    const workspaceId = await requireWorkspaceId(req, res);
    if (!workspaceId) {
      return;
    }
    const project = await ensureBrainstormProjectForWorkspace(workspaceId);
    let sessions = await prisma.brainstormSession.findMany({
      where: { projectId: project.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: { select: { nodes: true } },
      },
    });

    if (sessions.length === 0) {
      await prisma.brainstormSession.create({
        data: { projectId: project.id, title: "Main" },
      });
      sessions = await prisma.brainstormSession.findMany({
        where: { projectId: project.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          updatedAt: true,
          _count: { select: { nodes: true } },
        },
      });
    }

    res.json({
      project: { id: project.id, name: project.name },
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        nodeCount: s._count.nodes,
      })),
    });
  } catch (err) {
    brainstorm500(res, "GET /sessions", "Failed to list brainstorm sessions", err);
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const body = req.body as { title?: string; workspaceId?: string };
    const workspaceId =
      typeof body.workspaceId === "string" && body.workspaceId.trim() ? body.workspaceId.trim() : null;
    if (!workspaceId) {
      res.status(400).json({ error: "workspaceId is required" });
      return;
    }
    const ok = await assertWorkspaceAccess(req.appUser!, workspaceId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const project = await ensureBrainstormProjectForWorkspace(workspaceId);
    const title =
      typeof body.title === "string" && body.title.trim().length > 0 ? body.title.trim() : "New session";

    const session = await prisma.brainstormSession.create({
      data: { projectId: project.id, title },
    });

    res.status(201).json({
      project: { id: project.id, name: project.name },
      session: { id: session.id, title: session.title, updatedAt: session.updatedAt },
    });
  } catch (err) {
    brainstorm500(res, "POST /sessions", "Failed to create session", err);
  }
});

router.get("/sessions/:id", async (req, res) => {
  try {
    const workspaceId = await requireWorkspaceId(req, res);
    if (!workspaceId) {
      return;
    }
    const project = await ensureBrainstormProjectForWorkspace(workspaceId);
    const full = await prisma.brainstormSession.findFirst({
      where: { id: req.params.id, projectId: project.id },
      include: { nodes: true, edges: true },
    });
    if (!full) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(buildSessionPayload(project, full));
  } catch (err) {
    brainstorm500(res, "GET /sessions/:id", "Failed to load brainstorm session", err);
  }
});

router.patch("/sessions/:id", async (req, res) => {
  try {
    const workspaceId = await requireWorkspaceId(req, res);
    if (!workspaceId) {
      return;
    }
    const project = await ensureBrainstormProjectForWorkspace(workspaceId);
    const body = req.body as { title?: string };
    if (typeof body.title !== "string" || !body.title.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const updated = await prisma.brainstormSession.updateMany({
      where: { id: req.params.id, projectId: project.id },
      data: { title: body.title.trim() },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const session = await prisma.brainstormSession.findUnique({ where: { id: req.params.id } });
    res.json({
      session: {
        id: session!.id,
        title: session!.title,
        updatedAt: session!.updatedAt,
      },
    });
  } catch (err) {
    brainstorm500(res, "PATCH /sessions/:id", "Failed to update session", err);
  }
});

router.delete("/sessions/:id", async (req, res) => {
  try {
    const workspaceId = await requireWorkspaceId(req, res);
    if (!workspaceId) {
      return;
    }
    const project = await ensureBrainstormProjectForWorkspace(workspaceId);
    const id = req.params.id;

    const count = await prisma.brainstormSession.count({ where: { projectId: project.id } });
    if (count <= 1) {
      res.status(400).json({ error: "Cannot delete the only brainstorm session" });
      return;
    }

    const deleted = await prisma.brainstormSession.deleteMany({
      where: { id, projectId: project.id },
    });

    if (deleted.count === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    brainstorm500(res, "DELETE /sessions/:id", "Failed to delete session", err);
  }
});

router.put("/sessions/:id/canvas", async (req, res) => {
  try {
    const workspaceId = await requireWorkspaceId(req, res);
    if (!workspaceId) {
      return;
    }
    const body = req.body as { nodes?: CanvasNodeIncoming[]; edges?: CanvasEdgeIncoming[] };
    const result = await putCanvas(req.params.id, workspaceId, body);
    if (result.error === "not_found") {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    brainstorm500(res, "PUT /sessions/:id/canvas", "Failed to save canvas", err);
  }
});

// --- Legacy single-session + canvas paths ---

router.get("/session", async (req, res) => {
  try {
    const { project, session } = await getOrCreateDefaultSession(req);
    const full = await prisma.brainstormSession.findUnique({
      where: { id: session.id },
      include: { nodes: true, edges: true },
    });
    if (!full) {
      res.status(500).json({ error: "Session not found" });
      return;
    }
    res.json(buildSessionPayload(project, full));
  } catch (err) {
    if (err instanceof Error && err.message === "WORKSPACE_FORBIDDEN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    brainstorm500(res, "GET /session (legacy)", "Failed to load brainstorm session", err);
  }
});

router.put("/session/:id/canvas", async (req, res) => {
  try {
    const workspaceId = await requireWorkspaceId(req, res);
    if (!workspaceId) {
      return;
    }
    const body = req.body as { nodes?: CanvasNodeIncoming[]; edges?: CanvasEdgeIncoming[] };
    const result = await putCanvas(req.params.id, workspaceId, body);
    if (result.error === "not_found") {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    brainstorm500(res, "PUT /session/:id/canvas (legacy)", "Failed to save canvas", err);
  }
});

async function handleConvertPlan(req: Request, res: Response, sessionId: string) {
  try {
    const workspaceId = await requireWorkspaceId(req, res);
    if (!workspaceId) {
      return;
    }

    if (!isAiBackendConfigured()) {
      res.status(503).json({
        error: "AI service unavailable",
        detail: aiServiceUnavailableDetail(),
      });
      return;
    }

    const scopedProject = await ensureBrainstormProjectForWorkspace(workspaceId);

    const session = await prisma.brainstormSession.findFirst({
      where: { id: sessionId, projectId: scopedProject.id },
      include: { nodes: true, project: { select: { workspaceId: true } } },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const { ideaNodeId } = req.body as { ideaNodeId?: string };
    if (!ideaNodeId || typeof ideaNodeId !== "string") {
      res.status(400).json({ error: "ideaNodeId is required" });
      return;
    }

    const idea = session.nodes.find((n) => n.id === ideaNodeId);
    if (!idea || idea.kind !== "idea") {
      res.status(404).json({ error: "Idea node not found in this session" });
      return;
    }

    const summary = [
      `Title: ${idea.title}`,
      idea.description ? `Description: ${idea.description}` : "",
      `Status: ${idea.status}, Priority: ${idea.priority}`,
      idea.tags.length ? `Tags: ${idea.tags.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const userPrompt = `Convert this idea into an ordered task list.\n\n${summary}`;

    const raw = await runBrainstormWithSystem(CONVERT_PLAN_SYSTEM, userPrompt);

    let tasks: string[] = [];
    try {
      const parsed = JSON.parse(raw) as { tasks?: unknown };
      if (Array.isArray(parsed.tasks)) {
        tasks = parsed.tasks.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
      }
    } catch {
      tasks = raw
        .split(/\n/)
        .map((line) => line.replace(/^[-*]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
        .filter((line) => line.length > 0);
    }

    if (tasks.length === 0) {
      res.status(422).json({ error: "Could not parse tasks from AI response" });
      return;
    }

    const wsId = session.project.workspaceId;
    if (!wsId) {
      res.status(400).json({ error: "Brainstorm session is not linked to a brand workspace" });
      return;
    }

    const { board } = await ensureDefaultBoardForWorkspace(wsId);
    const backlogListId = await getBacklogListId(board.id);

    const workspace = await prisma.workspace.findUnique({ where: { id: wsId }, select: { brandId: true } });
    const brandId = workspace?.brandId;
    const ticketNums = brandId ? await allocateBrandTicketNumbers(brandId, tasks.length) : [];

    const created = await prisma.$transaction(
      tasks.map((title, order) => {
        const n = ticketNums[order];
        return prisma.task.create({
          data: {
            title,
            subBoardId: backlogListId,
            trackerStatus: "BACKLOG",
            order,
            ideaNodeId: idea.id,
            ...(n !== undefined ? { brandTicketNumber: n } : {}),
          },
        });
      }),
    );

    const mapped = created.map((t) => ({
      id: t.id,
      title: t.title,
      completed: t.completed,
      subBoardId: t.subBoardId,
      order: t.order,
      ideaNodeId: t.ideaNodeId,
      ideaNode: { id: idea.id, title: idea.title },
    }));

    res.json({ tasks: mapped });
  } catch (err) {
    brainstorm500(res, "convert-plan", "Convert to plan failed", err);
  }
}

router.post("/sessions/:id/convert-plan", (req, res) => {
  void handleConvertPlan(req, res, req.params.id);
});

router.post("/session/:id/convert-plan", (req, res) => {
  void handleConvertPlan(req, res, req.params.id);
});

export default router;
