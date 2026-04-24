import { Router } from "express";
import { assertWorkspaceAccess } from "../lib/auth/workspaceScope.js";
import { prisma } from "../lib/db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    const agentKind = typeof req.query.agentKind === "string" ? req.query.agentKind : "";
    if (!workspaceId || !agentKind) {
      res.status(400).json({ error: "workspaceId and agentKind are required" });
      return;
    }
    const ok = await assertWorkspaceAccess(req.appUser!, workspaceId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const rows = await prisma.agentSession.findMany({
      where: { workspaceId, agentKind, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true,
        title: true,
        agentKind: true,
        updatedAt: true,
        createdAt: true,
        metadata: true,
        events: {
          orderBy: { seq: "desc" },
          take: 1,
          select: { type: true, payload: true, seq: true },
        },
      },
    });
    const sessions = rows.map((r) => {
      const last = r.events[0];
      let preview = "";
      if (last?.payload && typeof last.payload === "object") {
        const p = last.payload as Record<string, unknown>;
        const text =
          typeof p.text === "string" ? p.text
          : typeof p.result === "string" ? p.result
          : typeof p.executiveSummary === "string" ? p.executiveSummary
          : typeof p.prompt === "string" ? p.prompt
          : "";
        preview = text.replace(/\s+/g, " ").trim().slice(0, 140);
      }
      return {
        id: r.id,
        title: r.title,
        agentKind: r.agentKind,
        updatedAt: r.updatedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        metadata: r.metadata,
        preview,
      };
    });
    res.json({ sessions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

router.get("/:sessionId", async (req, res) => {
  try {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    const { sessionId } = req.params;
    if (!workspaceId || !sessionId) {
      res.status(400).json({ error: "workspaceId is required" });
      return;
    }
    const ok = await assertWorkspaceAccess(req.appUser!, workspaceId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const session = await prisma.agentSession.findFirst({
      where: { id: sessionId, workspaceId, archivedAt: null },
      include: {
        events: { orderBy: { seq: "asc" } },
      },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({
      session: {
        id: session.id,
        workspaceId: session.workspaceId,
        agentKind: session.agentKind,
        title: session.title,
        metadata: session.metadata,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      events: session.events.map((ev) => ({
        id: ev.id,
        seq: ev.seq,
        type: ev.type,
        payload: ev.payload,
        createdAt: ev.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load session" });
  }
});

router.patch("/:sessionId", async (req, res) => {
  try {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    const { sessionId } = req.params;
    const title = typeof (req.body as { title?: unknown }).title === "string" ? (req.body as { title: string }).title.trim() : "";
    if (!workspaceId || !sessionId || !title) {
      res.status(400).json({ error: "workspaceId query and non-empty title in body are required" });
      return;
    }
    const ok = await assertWorkspaceAccess(req.appUser!, workspaceId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const existing = await prisma.agentSession.findFirst({
      where: { id: sessionId, workspaceId, archivedAt: null },
    });
    if (!existing) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const updated = await prisma.agentSession.update({
      where: { id: sessionId },
      data: { title: title.slice(0, 200) },
    });
    res.json({
      session: {
        id: updated.id,
        title: updated.title,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update session" });
  }
});

router.delete("/:sessionId", async (req, res) => {
  try {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    const { sessionId } = req.params;
    if (!workspaceId || !sessionId) {
      res.status(400).json({ error: "workspaceId is required" });
      return;
    }
    const ok = await assertWorkspaceAccess(req.appUser!, workspaceId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const existing = await prisma.agentSession.findFirst({
      where: { id: sessionId, workspaceId, archivedAt: null },
    });
    if (!existing) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { archivedAt: new Date() },
    });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to archive session" });
  }
});

export default router;
