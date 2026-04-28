/**
 * Page presence uses PostgreSQL heartbeats so it works on Vercel serverless (no in-process WebSocket rooms).
 * For sub-second updates without polling, you could add a long-running Node process with `ws` and optionally
 * Redis pub/sub when scaling beyond one instance — keep this REST/DB path as fallback.
 */
import { Router } from "express";
import { z } from "zod";
import type { AppUserPrincipal } from "../lib/auth/workspaceScope.js";
import { assertBoardAccess, assertTaskAccess, assertWorkspaceAccess } from "../lib/auth/workspaceScope.js";
import { prisma } from "../lib/db.js";

const router = Router();

/** Peers with no heartbeat in this window are ignored (not shown). */
const STALE_MS = 45_000;

const heartbeatBody = z.object({
  roomKey: z.string().min(1).max(200).trim(),
  tabId: z.string().min(1).max(120).trim(),
});

async function authorizePresenceRoom(user: AppUserPrincipal, roomKey: string): Promise<boolean> {
  if (roomKey.startsWith("board:")) {
    const boardId = roomKey.slice("board:".length).trim();
    if (!boardId) return false;
    return assertBoardAccess(user, boardId);
  }
  if (roomKey.startsWith("brainstorm:")) {
    const sessionId = roomKey.slice("brainstorm:".length).trim();
    if (!sessionId) return false;
    const row = await prisma.brainstormSession.findFirst({
      where: { id: sessionId },
      select: { project: { select: { workspaceId: true } } },
    });
    const wsId = row?.project.workspaceId;
    if (!wsId) return false;
    return assertWorkspaceAccess(user, wsId);
  }
  if (roomKey.startsWith("task:")) {
    const taskId = roomKey.slice("task:".length).trim();
    if (!taskId) return false;
    return assertTaskAccess(user, taskId);
  }
  return false;
}

const userPresenceSelect = {
  id: true,
  username: true,
  displayName: true,
  firstName: true,
  lastName: true,
} as const;

type PresencePeerDto = {
  userId: string;
  username: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
};

async function listPeersInRoom(roomKey: string, excludeUserId: string): Promise<PresencePeerDto[]> {
  const cutoff = new Date(Date.now() - STALE_MS);
  const rows = await prisma.pagePresence.findMany({
    where: { roomKey, lastSeenAt: { gt: cutoff }, userId: { not: excludeUserId } },
    include: { user: { select: userPresenceSelect } },
  });
  const best = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const cur = best.get(r.userId);
    if (!cur || r.lastSeenAt > cur.lastSeenAt) best.set(r.userId, r);
  }
  return [...best.values()].map((r) => ({
    userId: r.user.id,
    username: r.user.username,
    displayName: r.user.displayName,
    firstName: r.user.firstName,
    lastName: r.user.lastName,
  }));
}

router.post("/heartbeat", async (req, res) => {
  try {
    const parsed = heartbeatBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const { roomKey, tabId } = parsed.data;
    const user = req.appUser!;
    const ok = await authorizePresenceRoom(user, roomKey);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const now = new Date();
    await prisma.pagePresence.upsert({
      where: { userId_roomKey_tabId: { userId: user.id, roomKey, tabId } },
      create: { userId: user.id, roomKey, tabId, lastSeenAt: now },
      update: { lastSeenAt: now },
    });
    const peers = await listPeersInRoom(roomKey, user.id);
    res.json({ peers });
  } catch (e) {
    console.error("[presence] heartbeat", e);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const roomKey = typeof req.query.roomKey === "string" ? req.query.roomKey.trim() : "";
    if (!roomKey || roomKey.length > 200) {
      res.status(400).json({ error: "roomKey query is required" });
      return;
    }
    const user = req.appUser!;
    const ok = await authorizePresenceRoom(user, roomKey);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const peers = await listPeersInRoom(roomKey, user.id);
    res.json({ peers });
  } catch (e) {
    console.error("[presence] get", e);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
