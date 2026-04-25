import { randomUUID } from "node:crypto";
import { Prisma, type RoutingHold } from "@prisma/client";
import { Router } from "express";
import {
  BOARD_TEMPLATES,
  DEFAULT_TEMPLATE_LABELS,
  type BoardTemplateList,
} from "../lib/boardTemplates.js";
import {
  assertBoardAccess,
  assertBrandAccess,
  assertBrandOwnerAccess,
  assertProjectSpaceAccess,
  assertTaskAccess,
  assertWorkspaceAccess,
  brandAccessWhereForUserId,
  brandWhereForAppUser,
  listAccessibleWorkspaceIds,
  workspaceWhereForAppUser,
  type AppUserPrincipal,
} from "../lib/auth/workspaceScope.js";
import { newInviteToken } from "../lib/auth/brandInvite.js";
import { EMAIL_RE, normalizeEmail } from "../lib/auth/identifiers.js";
import { prisma } from "../lib/db.js";
import { ensurePersonalWorkspaceBoard, getBacklogListId } from "../lib/taskDefaults.js";
import { formatBrandProfileForPrompt } from "../lib/brandProfileFormat.js";
import { parseBrandProfileForSave } from "../lib/brandProfileSchema.js";
import { brandDisplayNameFromProfileJson } from "../lib/brandDisplayName.js";
import { defaultWorkspaceTitleFromBrandName, normalizeWorkspaceName } from "../lib/workspaceLimits.js";
import { boardJsonForApi, taskJsonForApi } from "../lib/boardForApi.js";
import { activityActorDto } from "../lib/activityActorLabel.js";
import { buildRoutingIndexPayload } from "../lib/routingIndexForWorkspace.js";

const router = Router();

router.param("workspaceId", async (req, res, next, workspaceId) => {
  try {
    const ok = await assertWorkspaceAccess(req.appUser!, workspaceId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Workspace access check failed" });
  }
});

router.param("boardId", async (req, res, next, boardId) => {
  try {
    const ok = await assertBoardAccess(req.appUser!, boardId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Board access check failed" });
  }
});

router.param("taskId", async (req, res, next, taskId) => {
  try {
    const ok = await assertTaskAccess(req.appUser!, taskId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Task access check failed" });
  }
});

router.param("brandId", async (req, res, next, brandId) => {
  try {
    const ok = await assertBrandAccess(req.appUser!, brandId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Brand access check failed" });
  }
});

router.param("projectSpaceId", async (req, res, next, projectSpaceId) => {
  try {
    const ok = await assertProjectSpaceAccess(req.appUser!, projectSpaceId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Project space access check failed" });
  }
});

function appPublicOrigin(req: import("express").Request): string {
  const fromEnv = process.env.APP_PUBLIC_ORIGIN?.replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost:5173";
  const proto = req.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

const boardProjectSpaceRef = { select: { workspaceId: true } } as const;

function parseTemplateListsPayload(raw: unknown): BoardTemplateList[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: BoardTemplateList[] = [];
  const seenKeys = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) return null;
    let key: string | null = null;
    if (o.key !== undefined && o.key !== null) {
      if (typeof o.key !== "string") return null;
      const k = o.key.trim();
      if (k) {
        if (seenKeys.has(k)) return null;
        seenKeys.add(k);
        key = k;
      }
    }
    out.push({ title, key });
  }
  return out.length ? out : null;
}

async function resolveWorkspaceTemplate(
  user: AppUserPrincipal,
  workspaceId: string,
  templateId: string,
): Promise<{ templateName: string; lists: BoardTemplateList[] } | null> {
  const builtin = BOARD_TEMPLATES.find((t) => t.id === templateId);
  if (builtin) {
    return { templateName: builtin.name, lists: builtin.lists };
  }
  const row = await prisma.customBoardTemplate.findUnique({
    where: { id: templateId },
  });
  if (!row) return null;
  if (row.workspaceId) {
    if (row.workspaceId !== workspaceId) {
      return null;
    }
  } else if (row.createdByUserId !== user.id) {
    return null;
  }
  const ok = await assertWorkspaceAccess(user, workspaceId);
  if (!ok) {
    return null;
  }
  const lists = parseTemplateListsPayload(row.lists);
  if (!lists) return null;
  return { templateName: row.name, lists };
}

const activityActorSelect = {
  id: true,
  username: true,
  displayName: true,
  firstName: true,
  lastName: true,
} as const;

/** Full task history for everyone with workspace access (Activity Tracker shows who did what). */
function taskActivitiesInclude(take: number) {
  return {
    orderBy: { createdAt: "desc" as const },
    take,
    include: { actorUser: { select: activityActorSelect } },
  };
}

function buildTaskInclude(user: AppUserPrincipal) {
  return {
    list: {
      select: {
        id: true,
        title: true,
        key: true,
        position: true,
        boardId: true,
        board: { select: { id: true, name: true, projectSpace: boardProjectSpaceRef } },
      },
    },
    ideaNode: { select: { id: true, title: true } },
    labels: { include: { label: true } },
    comments: { orderBy: { createdAt: "asc" as const } },
    checklist: { orderBy: { position: "asc" as const } },
    activities: taskActivitiesInclude(30),
  } as const;
}

/** Kanban and API responses only surface non-archived tasks on a board. */
const activeTaskWhere: Prisma.TaskWhereInput = { archivedAt: null };

const boardIncludeBootstrap = {
  projectSpace: boardProjectSpaceRef,
  lists: {
    orderBy: { position: "asc" as const },
    include: {
      tasks: {
        where: activeTaskWhere,
        orderBy: { order: "asc" as const },
        include: {
          ideaNode: { select: { id: true, title: true } },
          labels: { include: { label: true } },
        },
      },
    },
  },
  labels: { orderBy: { name: "asc" as const } },
} as const;

function buildBoardIncludeFull(user: AppUserPrincipal) {
  return {
    projectSpace: boardProjectSpaceRef,
    lists: {
      orderBy: { position: "asc" as const },
      include: {
        tasks: {
          where: activeTaskWhere,
          orderBy: { order: "asc" as const },
          include: {
            ideaNode: { select: { id: true, title: true } },
            labels: { include: { label: true } },
            comments: { orderBy: { createdAt: "asc" as const } },
            checklist: { orderBy: { position: "asc" as const } },
            activities: taskActivitiesInclude(20),
          },
        },
      },
    },
    labels: { orderBy: { name: "asc" as const } },
  } as const;
}

const boardIncludePositions = {
  projectSpace: boardProjectSpaceRef,
  lists: {
    orderBy: { position: "asc" as const },
    include: {
      tasks: {
        where: activeTaskWhere,
        orderBy: { order: "asc" as const },
        include: {
          ideaNode: { select: { id: true, title: true } },
          labels: { include: { label: true } },
        },
      },
    },
  },
  labels: { orderBy: { name: "asc" as const } },
} as const;

async function logActivity(taskId: string, actorUserId: string, action: string, detail = "") {
  await prisma.activity.create({ data: { taskId, actorUserId, action, detail } });
}

router.get("/bootstrap", async (req, res) => {
  try {
    const { workspace, board } = await ensurePersonalWorkspaceBoard(req.appUser!);
    const fullBoard = await prisma.board.findUnique({
      where: { id: board.id },
      include: boardIncludeBootstrap,
    });
    const { brand, ...wsRest } = workspace;
    res.json({
      workspace: {
        ...wsRest,
        brandName: brand?.name ?? "Brand",
        brandDisplayName: brandDisplayNameFromProfileJson(brand?.brandProfile ?? null),
      },
      board: fullBoard ? boardJsonForApi(fullBoard) : null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Bootstrap failed" });
  }
});

router.get("/workspaces", async (req, res) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: workspaceWhereForAppUser(req.appUser!),
      orderBy: [{ brand: { position: "asc" } }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        brandId: true,
        brand: { select: { id: true, name: true, brandProfile: true } },
        projectSpaces: {
          where: { archivedAt: null },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            position: true,
            isDefault: true,
            purpose: true,
            boards: {
              where: { archivedAt: null },
              orderBy: { position: "asc" },
              select: { id: true, name: true, position: true },
            },
          },
        },
      },
    });
    res.json(
      workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        brandId: w.brandId,
        brandName: w.brand.name,
        brandDisplayName: brandDisplayNameFromProfileJson(w.brand.brandProfile),
        projectSpaces: w.projectSpaces,
      })),
    );
  } catch {
    res.status(500).json({ error: "Failed to list workspaces" });
  }
});

/** Full brand kit JSON for the Brand Center page (one kit per brand; loaded via active project space). */
router.get("/workspaces/:workspaceId/brand-profile", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, brand: { select: { id: true, brandProfile: true } } },
    });
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    res.json({
      workspaceId: ws.id,
      brandId: ws.brand.id,
      name: ws.name,
      brandProfile: ws.brand.brandProfile ?? null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load brand profile" });
  }
});

/** Pre-formatted brand kit text for client-side AI context merging (single source of truth with DB). */
router.get("/workspaces/:workspaceId/brand-context-text", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { brand: { select: { brandProfile: true } } },
    });
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    res.json({ text: formatBrandProfileForPrompt(ws.brand?.brandProfile ?? null) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load brand context text" });
  }
});

/** Team (brand) + user (workspace) text for Consultant Agent and CONTEXT_BUNDLE assembly. */
router.get("/workspaces/:workspaceId/context-instructions", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        userContextInstructions: true,
        brand: { select: { id: true, teamContextInstructions: true } },
      },
    });
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    res.json({
      workspaceId: ws.id,
      brandId: ws.brand.id,
      teamContextInstructions: ws.brand.teamContextInstructions ?? "",
      userContextInstructions: ws.userContextInstructions ?? "",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load context instructions" });
  }
});

router.put("/workspaces/:workspaceId/context-instructions", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const body = req.body as {
      teamContextInstructions?: unknown;
      userContextInstructions?: unknown;
    };
    if (
      body.teamContextInstructions !== undefined &&
      typeof body.teamContextInstructions !== "string"
    ) {
      res.status(400).json({ error: "teamContextInstructions must be a string" });
      return;
    }
    if (
      body.userContextInstructions !== undefined &&
      typeof body.userContextInstructions !== "string"
    ) {
      res.status(400).json({ error: "userContextInstructions must be a string" });
      return;
    }
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, brandId: true },
    });
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    if (typeof body.teamContextInstructions === "string") {
      await prisma.brand.update({
        where: { id: ws.brandId },
        data: { teamContextInstructions: body.teamContextInstructions.trim() || null },
      });
    }
    if (typeof body.userContextInstructions === "string") {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { userContextInstructions: body.userContextInstructions.trim() || null },
      });
    }
    const next = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        userContextInstructions: true,
        brand: { select: { id: true, teamContextInstructions: true } },
      },
    });
    res.json({
      workspaceId: next!.id,
      brandId: next!.brand.id,
      teamContextInstructions: next!.brand.teamContextInstructions ?? "",
      userContextInstructions: next!.userContextInstructions ?? "",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save context instructions" });
  }
});

/** Boards, lists, notebook folders, brainstorm sessions — for Mail Clerk / Rapid Router. */
router.get("/workspaces/:workspaceId/routing-index", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const payload = await buildRoutingIndexPayload(workspaceId);
    if (!payload) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load routing index" });
  }
});

function serializeRoutingHold(row: RoutingHold) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    body: row.body,
    meta: row.meta,
    status: row.status,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Holding pen: unresolved captures before final routing. */
router.get("/workspaces/:workspaceId/routing-holds", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const ws = await prisma.workspace.findFirst({
      where: { id: workspaceId, archivedAt: null },
      select: { id: true },
    });
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    const q = req.query.status;
    const where: Prisma.RoutingHoldWhereInput = { workspaceId };
    if (typeof q === "string" && ["pending", "routed", "dismissed"].includes(q)) {
      where.status = q;
    } else {
      where.status = "pending";
    }
    const rows = await prisma.routingHold.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(rows.map(serializeRoutingHold));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list routing holds" });
  }
});

router.post("/workspaces/:workspaceId/routing-holds", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const ws = await prisma.workspace.findFirst({
      where: { id: workspaceId, archivedAt: null },
      select: { id: true },
    });
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    const body = req.body as {
      body?: string;
      meta?: unknown;
      source?: string;
    };
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) {
      res.status(400).json({ error: "body is required" });
      return;
    }
    const allowedSources = new Set(["rapid_router", "mail_clerk_plan", "mailroom", "manual"]);
    const source =
      typeof body.source === "string" && allowedSources.has(body.source) ? body.source : "manual";
    let meta: Prisma.InputJsonValue | undefined;
    if (body.meta !== undefined && body.meta !== null) {
      meta = body.meta as Prisma.InputJsonValue;
    }
    const row = await prisma.routingHold.create({
      data: {
        workspaceId,
        body: text.slice(0, 50_000),
        source,
        ...(meta !== undefined ? { meta } : {}),
      },
    });
    res.status(201).json(serializeRoutingHold(row));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create routing hold" });
  }
});

router.patch("/workspaces/:workspaceId/routing-holds/:holdId", async (req, res) => {
  try {
    const { workspaceId, holdId } = req.params;
    const body = req.body as { status?: string };
    const existing = await prisma.routingHold.findFirst({
      where: { id: holdId, workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: "Hold not found" });
      return;
    }
    if (typeof body.status !== "string" || !["pending", "routed", "dismissed"].includes(body.status)) {
      res.status(400).json({ error: "status must be pending | routed | dismissed" });
      return;
    }
    const row = await prisma.routingHold.update({
      where: { id: holdId },
      data: { status: body.status },
    });
    res.json(serializeRoutingHold(row));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update routing hold" });
  }
});

router.delete("/workspaces/:workspaceId/routing-holds/:holdId", async (req, res) => {
  try {
    const { workspaceId, holdId } = req.params;
    const existing = await prisma.routingHold.findFirst({
      where: { id: holdId, workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: "Hold not found" });
      return;
    }
    await prisma.routingHold.delete({ where: { id: holdId } });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete routing hold" });
  }
});

router.put("/workspaces/:workspaceId/brand-profile", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const body = req.body as { brandProfile?: unknown };
    if (!("brandProfile" in body)) {
      res.status(400).json({ error: "brandProfile is required (use null to clear)" });
      return;
    }
    let json: Prisma.InputJsonValue | null;
    try {
      json = parseBrandProfileForSave(body.brandProfile);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "INVALID_BRAND_PROFILE") {
        res.status(400).json({ error: "Invalid brand profile" });
        return;
      }
      throw e;
    }
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, brandId: true },
    });
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    const updatedBrand = await prisma.brand.update({
      where: { id: ws.brandId },
      data: { brandProfile: json === null ? Prisma.JsonNull : json },
      select: { id: true, brandProfile: true },
    });
    res.json({
      workspaceId: ws.id,
      brandId: updatedBrand.id,
      name: ws.name,
      brandProfile: updatedBrand.brandProfile ?? null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save brand profile" });
  }
});

router.get("/workspaces/archived", async (req, res) => {
  try {
    const user = req.appUser!;
    const workspaces = await prisma.workspace.findMany({
      where: {
        archivedAt: { not: null },
        ...(user.role === "admin" ? {} : { brand: brandAccessWhereForUserId(user.id) }),
      },
      orderBy: { archivedAt: "desc" },
      select: { id: true, name: true, archivedAt: true },
    });
    res.json(workspaces);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list archived workspaces" });
  }
});

router.get("/workspaces/:workspaceId/archived-boards", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    const boards = await prisma.board.findMany({
      where: { projectSpace: { workspaceId }, archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
      select: { id: true, name: true, position: true, archivedAt: true },
    });
    res.json({ boards });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list archived boards" });
  }
});

/** Project spaces (delivery threads) archived within this brand workspace only (`router.param` enforces access). */
router.get("/workspaces/:workspaceId/archived-project-spaces", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const projectSpaces = await prisma.projectSpace.findMany({
      where: { workspaceId, archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
      select: { id: true, name: true, archivedAt: true },
    });
    res.json({ projectSpaces });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list archived project spaces" });
  }
});

router.get("/boards/:boardId", async (req, res) => {
  try {
    const board = await prisma.board.findUnique({
      where: { id: req.params.boardId },
      include: buildBoardIncludeFull(req.appUser!),
    });
    if (!board) {
      res.status(404).json({ error: "Board not found" });
      return;
    }
    res.json(boardJsonForApi(board));
  } catch {
    res.status(500).json({ error: "Failed to load board" });
  }
});

function parseTaskListSort(sortRaw: string | undefined): Prisma.TaskOrderByWithRelationInput[] {
  const s = sortRaw ?? "updatedAt:desc";
  const [field, dir] = s.split(":");
  const direction = dir === "asc" ? "asc" : "desc";
  if (field === "title") {
    return [{ title: direction }, { id: "asc" }];
  }
  if (field === "dueDate") {
    return [{ dueDate: { sort: direction, nulls: "last" } }, { id: "asc" }];
  }
  if (field === "priority") {
    return [{ priority: direction }, { id: "asc" }];
  }
  return [{ updatedAt: direction }, { id: "asc" }];
}

/** Flat tasks — filters: workspace, board, search, label, priority, completed, chat thread, sort */
router.get("/tasks", async (req, res) => {
  try {
    const user = req.appUser!;
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
    const boardId = typeof req.query.boardId === "string" ? req.query.boardId : undefined;
    const chatThreadId = typeof req.query.chatThreadId === "string" ? req.query.chatThreadId : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const labelId = typeof req.query.labelId === "string" ? req.query.labelId : undefined;
    const priority = typeof req.query.priority === "string" ? req.query.priority : undefined;
    const completedRaw = typeof req.query.completed === "string" ? req.query.completed : undefined;
    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : undefined;

    const andFilters: Prisma.TaskWhereInput[] = [];

    const archivedRaw = typeof req.query.archived === "string" ? req.query.archived : undefined;
    if (archivedRaw === "true") {
      andFilters.push({ archivedAt: { not: null } });
    } else if (archivedRaw === "all") {
      // no archive filter
    } else {
      andFilters.push({ archivedAt: null });
    }

    if (boardId) {
      const okBoard = await assertBoardAccess(user, boardId);
      if (!okBoard) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      andFilters.push({ list: { is: { boardId } } });
    } else if (workspaceId) {
      const okWs = await assertWorkspaceAccess(user, workspaceId);
      if (!okWs) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      andFilters.push({
        list: { is: { board: { is: { projectSpace: { is: { workspaceId } } } } } },
      });
    } else {
      const ids = await listAccessibleWorkspaceIds(user);
      if (ids.length === 0) {
        res.json([]);
        return;
      }
      andFilters.push({
        OR: ids.map((id) => ({
          list: { is: { board: { is: { projectSpace: { is: { workspaceId: id } } } } } },
        })),
      });
    }
    if (chatThreadId) {
      andFilters.push({ chatThreadId });
    }
    if (q) {
      andFilters.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    if (labelId) {
      andFilters.push({ labels: { some: { labelId } } });
    }
    if (priority && priority !== "all") {
      andFilters.push({ priority });
    }
    if (completedRaw === "true") {
      andFilters.push({ completed: true });
    } else if (completedRaw === "false") {
      andFilters.push({ completed: false });
    }

    const where: Prisma.TaskWhereInput = andFilters.length ? { AND: andFilters } : {};

    const tasks = await prisma.task.findMany({
      where,
      orderBy: parseTaskListSort(sortRaw),
      include: buildTaskInclude(req.appUser!),
    });
    res.json(tasks.map((t) => taskJsonForApi(t)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

router.get("/workspaces/:workspaceId/activity-feed", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const taskScope = {
      archivedAt: null,
      list: { board: { projectSpace: { workspaceId } } },
    };
    const rows = await prisma.activity.findMany({
      where: { task: taskScope },
      orderBy: { createdAt: "desc" },
      take: 120,
      include: {
        actorUser: { select: activityActorSelect },
        task: {
          select: {
            id: true,
            title: true,
            list: { select: { title: true, board: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    res.json(
      rows.map((row) => {
        const { actorUser, ...rest } = row;
        return {
          id: rest.id,
          actorUserId: rest.actorUserId,
          action: rest.action,
          detail: rest.detail,
          createdAt: rest.createdAt,
          actor: activityActorDto(actorUser),
          task: rest.task,
        };
      }),
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load Activity Tracker" });
  }
});

router.get("/board-templates", async (req, res) => {
  try {
    const builtins = BOARD_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      listCount: t.lists.length,
      isBuiltin: true as const,
      workspaceId: null as string | null,
      workspaceName: null as string | null,
    }));
    const rawWs = req.query.workspaceId;
    const workspaceId = typeof rawWs === "string" && rawWs.trim() ? rawWs.trim() : null;
    let customSummaries: {
      id: string;
      name: string;
      description: string;
      listCount: number;
      isBuiltin: false;
      workspaceId: string | null;
      workspaceName: string | null;
    }[] = [];
    if (workspaceId) {
      const ok = await assertWorkspaceAccess(req.appUser!, workspaceId);
      if (!ok) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const customs = await prisma.customBoardTemplate.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        include: { workspace: { select: { name: true } } },
      });
      customSummaries = customs.map((c) => {
        const lists = parseTemplateListsPayload(c.lists);
        return {
          id: c.id,
          name: c.name,
          description: c.description,
          listCount: lists?.length ?? 0,
          isBuiltin: false as const,
          workspaceId: c.workspaceId,
          workspaceName: c.workspace?.name ?? null,
        };
      });
    }
    res.json([...builtins, ...customSummaries]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list templates" });
  }
});

router.get("/board-templates/:templateId", async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const built = BOARD_TEMPLATES.find((t) => t.id === templateId);
    if (built) {
      res.json({
        id: built.id,
        name: built.name,
        description: built.description,
        isBuiltin: true,
        lists: built.lists,
        workspaceId: null,
      });
      return;
    }
    const row = await prisma.customBoardTemplate.findUnique({ where: { id: templateId } });
    if (!row) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    const u = req.appUser!;
    if (row.workspaceId) {
      const ok = await assertWorkspaceAccess(u, row.workspaceId);
      if (!ok) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    } else if (row.createdByUserId) {
      if (row.createdByUserId !== u.id && u.role !== "admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    } else if (u.role !== "admin") {
      res.status(403).json({ error: "Only an administrator can view legacy templates" });
      return;
    }
    const lists = parseTemplateListsPayload(row.lists) ?? [];
    res.json({
      id: row.id,
      name: row.name,
      description: row.description,
      isBuiltin: false,
      lists,
      workspaceId: row.workspaceId,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load template" });
  }
});

router.post("/board-templates", async (req, res) => {
  try {
    const body = req.body as { workspaceId?: string; name?: string; description?: string; lists?: unknown };
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    if (!workspaceId) {
      res.status(400).json({ error: "workspaceId is required" });
      return;
    }
    if (!body.name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const ok = await assertWorkspaceAccess(req.appUser!, workspaceId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const lists = parseTemplateListsPayload(body.lists);
    if (!lists) {
      res.status(400).json({ error: "lists must be a non-empty array of { title, key? }" });
      return;
    }
    const created = await prisma.customBoardTemplate.create({
      data: {
        createdByUserId: req.appUser!.id,
        workspaceId,
        name: body.name.trim(),
        description: body.description?.trim() ?? "",
        lists: lists as unknown as Prisma.InputJsonValue,
      },
      include: { workspace: { select: { name: true } } },
    });
    res.status(201).json({
      id: created.id,
      name: created.name,
      description: created.description,
      listCount: lists.length,
      isBuiltin: false,
      workspaceId: created.workspaceId,
      workspaceName: created.workspace?.name ?? null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.patch("/board-templates/:templateId", async (req, res) => {
  try {
    const templateId = req.params.templateId;
    if (BOARD_TEMPLATES.some((t) => t.id === templateId)) {
      res.status(400).json({ error: "Built-in templates cannot be edited" });
      return;
    }
    const row = await prisma.customBoardTemplate.findUnique({ where: { id: templateId } });
    if (!row) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    const u = req.appUser!;
    if (row.workspaceId) {
      const ok = await assertWorkspaceAccess(u, row.workspaceId);
      if (!ok) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    } else if (row.createdByUserId) {
      if (row.createdByUserId !== u.id && u.role !== "admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    } else if (u.role !== "admin") {
      res.status(403).json({ error: "Only an administrator can edit legacy templates" });
      return;
    }
    const body = req.body as { name?: string; description?: string; lists?: unknown };
    const data: Prisma.CustomBoardTemplateUpdateInput = {};
    if (body.name !== undefined) {
      const n = String(body.name).trim();
      if (!n) {
        res.status(400).json({ error: "name cannot be empty" });
        return;
      }
      data.name = n;
    }
    if (body.description !== undefined) {
      data.description = String(body.description ?? "").trim();
    }
    if (body.lists !== undefined) {
      const lists = parseTemplateListsPayload(body.lists);
      if (!lists) {
        res.status(400).json({ error: "lists must be a non-empty array of { title, key? }" });
        return;
      }
      data.lists = lists as unknown as Prisma.InputJsonValue;
    }
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "At least one of name, description, lists is required" });
      return;
    }
    const updated = await prisma.customBoardTemplate.update({
      where: { id: templateId },
      data,
      include: { workspace: { select: { name: true } } },
    });
    const lists = parseTemplateListsPayload(updated.lists);
    res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      listCount: lists?.length ?? 0,
      isBuiltin: false,
      workspaceId: updated.workspaceId,
      workspaceName: updated.workspace?.name ?? null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.delete("/board-templates/:templateId", async (req, res) => {
  try {
    const templateId = req.params.templateId;
    if (BOARD_TEMPLATES.some((t) => t.id === templateId)) {
      res.status(400).json({ error: "Built-in templates cannot be deleted" });
      return;
    }
    const row = await prisma.customBoardTemplate.findUnique({ where: { id: templateId } });
    if (!row) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    const u = req.appUser!;
    if (row.workspaceId) {
      const ok = await assertWorkspaceAccess(u, row.workspaceId);
      if (!ok) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    } else if (row.createdByUserId) {
      if (row.createdByUserId !== u.id && u.role !== "admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    } else if (u.role !== "admin") {
      res.status(403).json({ error: "Only an administrator can delete legacy templates" });
      return;
    }
    await prisma.customBoardTemplate.delete({ where: { id: templateId } });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

/** Add a project space inside a brand workspace ecosystem. */
router.post("/workspaces/:workspaceId/project-spaces", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const body = req.body as { name?: string };
    const parsed = normalizeWorkspaceName(typeof body.name === "string" ? body.name : "");
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error === "name cannot be empty" ? "name is required" : parsed.error });
      return;
    }
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws || ws.archivedAt !== null) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    const maxPos = await prisma.projectSpace.aggregate({
      where: { workspaceId, archivedAt: null },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;
    const ps = await prisma.projectSpace.create({
      data: { workspaceId, name: parsed.name, position, isDefault: false },
      select: {
        id: true,
        name: true,
        position: true,
        isDefault: true,
        purpose: true,
        boards: {
          where: { archivedAt: null },
          orderBy: { position: "asc" },
          select: { id: true, name: true, position: true },
        },
      },
    });
    res.status(201).json(ps);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create project space" });
  }
});

const PROJECT_SPACE_PURPOSE_MAX = 20_000;

function normalizeProjectSpacePurpose(
  raw: unknown,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "purpose must be a string or null" };
  const t = raw.trim();
  if (t.length > PROJECT_SPACE_PURPOSE_MAX) {
    return { ok: false, error: `purpose must be at most ${PROJECT_SPACE_PURPOSE_MAX} characters` };
  }
  return { ok: true, value: t ? t : null };
}

router.patch("/project-spaces/:projectSpaceId", async (req, res) => {
  try {
    const projectSpaceId = req.params.projectSpaceId;
    const body = req.body as { name?: string; archived?: boolean; purpose?: unknown | null };
    const existing = await prisma.projectSpace.findUnique({ where: { id: projectSpaceId } });
    if (!existing) {
      res.status(404).json({ error: "Project space not found" });
      return;
    }
    if (body.name !== undefined) {
      const parsed = normalizeWorkspaceName(body.name);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      await prisma.projectSpace.update({
        where: { id: projectSpaceId },
        data: { name: parsed.name },
      });
    }
    if (body.purpose !== undefined) {
      const p = normalizeProjectSpacePurpose(body.purpose);
      if (!p.ok) {
        res.status(400).json({ error: p.error });
        return;
      }
      if (p.value !== undefined) {
        await prisma.projectSpace.update({
          where: { id: projectSpaceId },
          data: { purpose: p.value },
        });
      }
    }
    if (body.archived === true) {
      if (existing.isDefault) {
        res.status(400).json({ error: "The primary project space for this brand cannot be archived" });
        return;
      }
      await prisma.projectSpace.update({
        where: { id: projectSpaceId },
        data: { archivedAt: new Date() },
      });
    } else if (body.archived === false) {
      const maxPos = await prisma.projectSpace.aggregate({
        where: { workspaceId: existing.workspaceId, archivedAt: null },
        _max: { position: true },
      });
      const position = (maxPos._max.position ?? -1) + 1;
      await prisma.projectSpace.update({
        where: { id: projectSpaceId },
        data: { archivedAt: null, position },
      });
    }
    const ps = await prisma.projectSpace.findUnique({
      where: { id: projectSpaceId },
      select: {
        id: true,
        name: true,
        position: true,
        workspaceId: true,
        isDefault: true,
        purpose: true,
        boards: {
          where: { archivedAt: null },
          orderBy: { position: "asc" },
          select: { id: true, name: true, position: true },
        },
      },
    });
    res.json(ps);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update project space" });
  }
});

type CloseProjectSpaceDisposition = "transferBoardsToDefault" | "archiveBoards";

/** Close a non-default project space: either move active boards to the default space or archive them, then archive this space. */
router.delete("/project-spaces/:projectSpaceId", async (req, res) => {
  try {
    const projectSpaceId = req.params.projectSpaceId;
    const rawDisposition = (req.body as { disposition?: unknown })?.disposition;
    const disposition: CloseProjectSpaceDisposition | undefined =
      rawDisposition === "transferBoardsToDefault" || rawDisposition === "archiveBoards" ? rawDisposition : undefined;
    if (!disposition) {
      res
        .status(400)
        .json({ error: "body.disposition must be 'transferBoardsToDefault' or 'archiveBoards'" });
      return;
    }

    const space = await prisma.projectSpace.findUnique({ where: { id: projectSpaceId } });
    if (!space) {
      res.status(404).json({ error: "Project space not found" });
      return;
    }
    if (space.archivedAt !== null) {
      res.status(400).json({ error: "Project space is already archived" });
      return;
    }
    if (space.isDefault) {
      res.status(400).json({ error: "The primary project space for this brand cannot be deleted" });
      return;
    }

    if (disposition === "archiveBoards") {
      const now = new Date();
      await prisma.$transaction([
        prisma.board.updateMany({
          where: { projectSpaceId, archivedAt: null },
          data: { archivedAt: now },
        }),
        prisma.projectSpace.update({
          where: { id: projectSpaceId },
          data: { archivedAt: now },
        }),
      ]);
      res.json({ ok: true });
      return;
    }

    const defaultSpace = await prisma.projectSpace.findFirst({
      where: { workspaceId: space.workspaceId, isDefault: true, archivedAt: null },
    });
    if (!defaultSpace) {
      res.status(500).json({ error: "No default project space for this workspace" });
      return;
    }
    if (defaultSpace.id === projectSpaceId) {
      res.status(400).json({ error: "Invalid project space" });
      return;
    }

    const toMove = await prisma.board.findMany({
      where: { projectSpaceId, archivedAt: null },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    const maxOnTarget = await prisma.board.aggregate({
      where: { projectSpaceId: defaultSpace.id, archivedAt: null },
      _max: { position: true },
    });
    let pos = (maxOnTarget._max.position ?? -1) + 1;
    await prisma.$transaction(async (tx) => {
      for (const b of toMove) {
        await tx.board.update({
          where: { id: b.id },
          data: { projectSpaceId: defaultSpace.id, position: pos },
        });
        pos += 1;
      }
      await tx.projectSpace.update({
        where: { id: projectSpaceId },
        data: { archivedAt: new Date() },
      });
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete project space" });
  }
});

router.patch("/workspaces/:workspaceId", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const body = req.body as { name?: string; archived?: boolean };
    const existing = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!existing) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    if (body.name !== undefined) {
      const parsed = normalizeWorkspaceName(body.name);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      await prisma.workspace.update({ where: { id: workspaceId }, data: { name: parsed.name } });
    }
    if (body.archived === true) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { archivedAt: new Date() },
      });
    } else if (body.archived === false) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { archivedAt: null },
      });
    }
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        brandId: true,
        brand: { select: { name: true, brandProfile: true } },
        projectSpaces: {
          where: { archivedAt: null },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            position: true,
            isDefault: true,
            purpose: true,
            boards: {
              where: { archivedAt: null },
              orderBy: { position: "asc" },
              select: { id: true, name: true, position: true },
            },
          },
        },
      },
    });
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    res.json({
      id: ws.id,
      name: ws.name,
      brandId: ws.brandId,
      brandName: ws.brand.name,
      brandDisplayName: brandDisplayNameFromProfileJson(ws.brand.brandProfile),
      projectSpaces: ws.projectSpaces,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update workspace" });
  }
});

/** Reorder project spaces within a brand workspace. */
router.post("/workspaces/:workspaceId/project-spaces/reorder", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const body = req.body as { orderedIds?: string[] };
    if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
      res.status(400).json({ error: "orderedIds is required" });
      return;
    }
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    const active = await prisma.projectSpace.findMany({
      where: { workspaceId, archivedAt: null },
      select: { id: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const activeIds = active.map((w) => w.id);
    if (body.orderedIds.length !== activeIds.length) {
      res.status(400).json({ error: "orderedIds must include every active project space in this workspace exactly once" });
      return;
    }
    const setFromPayload = new Set(body.orderedIds);
    if (setFromPayload.size !== body.orderedIds.length) {
      res.status(400).json({ error: "duplicate id in orderedIds" });
      return;
    }
    for (const id of activeIds) {
      if (!setFromPayload.has(id)) {
        res.status(400).json({ error: "orderedIds must match active project spaces for this workspace" });
        return;
      }
    }
    await prisma.$transaction(
      body.orderedIds.map((id, index) =>
        prisma.projectSpace.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to reorder project spaces" });
  }
});

/** List brands with nested project spaces and boards (settings / admin). */
router.get("/brands", async (req, res) => {
  try {
    const me = req.appUser!;
    const brands = await prisma.brand.findMany({
      where: brandWhereForAppUser(me),
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        position: true,
        ownerUserId: true,
        joinKey: true,
        brandProfile: true,
        workspaces: {
          where: { archivedAt: null },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            projectSpaces: {
              where: { archivedAt: null },
              orderBy: [{ position: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
                name: true,
                position: true,
                isDefault: true,
                purpose: true,
                boards: {
                  where: { archivedAt: null },
                  orderBy: { position: "asc" },
                  select: { id: true, name: true, position: true },
                },
              },
            },
          },
        },
      },
    });
    res.json(
      brands.map((b) => ({
        id: b.id,
        name: b.name,
        position: b.position,
        ownerUserId: b.ownerUserId,
        youAreOwner: b.ownerUserId === me.id || me.role === "admin",
        brandIdentifier: b.joinKey,
        brandDisplayName: brandDisplayNameFromProfileJson(b.brandProfile),
        workspaces: b.workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          projectSpaces: w.projectSpaces,
        })),
      })),
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list brands" });
  }
});

/** Self-join as a team member using the owner-shared join key (separate from the internal brand row id). */
router.post("/brands/join-with-key", async (req, res) => {
  try {
    const me = req.appUser!;
    const raw = (req.body as { joinKey?: unknown }).joinKey;
    const joinKey = typeof raw === "string" ? raw.trim() : "";
    if (!joinKey) {
      res.status(400).json({ error: "joinKey is required" });
      return;
    }
    const brand = await prisma.brand.findFirst({
      where: { joinKey, archivedAt: null },
      select: {
        id: true,
        ownerUserId: true,
        workspaces: {
          where: { archivedAt: null },
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { id: true },
        },
      },
    });
    if (!brand) {
      res.status(404).json({ error: "No brand matches that join key" });
      return;
    }
    const workspaceId = brand.workspaces[0]?.id ?? null;
    if (brand.ownerUserId === me.id) {
      res.status(200).json({
        ok: true,
        brandId: brand.id,
        workspaceId,
        alreadyHadAccess: true,
      });
      return;
    }
    const existing = await prisma.brandMember.findUnique({
      where: { brandId_userId: { brandId: brand.id, userId: me.id } },
    });
    if (existing) {
      res.status(200).json({
        ok: true,
        brandId: brand.id,
        workspaceId,
        alreadyHadAccess: true,
      });
      return;
    }
    await prisma.brandMember.create({
      data: { brandId: brand.id, userId: me.id, invitedByUserId: null },
    });
    res.status(201).json({
      ok: true,
      brandId: brand.id,
      workspaceId,
      alreadyHadAccess: false,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to join brand" });
  }
});

const BRAND_INVITE_EXPIRY_DAYS = 14;

router.get("/brands/:brandId/team", async (req, res) => {
  try {
    const brandId = req.params.brandId;
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        joinKey: true,
        ownerUserId: true,
        ownerUser: {
          select: { id: true, username: true, email: true, displayName: true, firstName: true, lastName: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, email: true, displayName: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        invites: {
          where: { consumedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true, email: true, createdAt: true, expiresAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!brand?.ownerUser) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    const owner = brand.ownerUser;
    const ownerLabel =
      owner.displayName?.trim() ||
      [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim() ||
      owner.username;
    res.json({
      brandId: brand.id,
      brandName: brand.name,
      brandIdentifier: brand.joinKey,
      ownerUserId: brand.ownerUserId,
      owner: {
        id: owner.id,
        username: owner.username,
        email: owner.email,
        label: ownerLabel,
      },
      members: brand.members.map((m) => {
        const u = m.user;
        const label =
          u.displayName?.trim() ||
          [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
          u.username;
        return {
          membershipId: m.id,
          userId: u.id,
          username: u.username,
          email: u.email,
          label,
          invitedByUserId: m.invitedByUserId,
        };
      }),
      pendingInvites: brand.invites.map((i) => ({
        id: i.id,
        email: i.email,
        createdAt: i.createdAt.toISOString(),
        expiresAt: i.expiresAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load brand team" });
  }
});

router.post("/brands/:brandId/invites", async (req, res) => {
  try {
    const brandId = req.params.brandId;
    if (!(await assertBrandOwnerAccess(req.appUser!, brandId))) {
      res.status(403).json({ error: "Only the brand owner can send invites" });
      return;
    }
    const body = req.body as { emails?: unknown };
    if (!Array.isArray(body.emails)) {
      res.status(400).json({ error: "emails must be an array of strings" });
      return;
    }
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, name: true, ownerUserId: true, ownerUser: { select: { email: true } } },
    });
    if (!brand?.ownerUser?.email) {
      res.status(400).json({ error: "Brand has no owner email on file" });
      return;
    }
    const origin = appPublicOrigin(req);
    const invitedByUserId = req.appUser!.id;
    const expiresAt = new Date(Date.now() + BRAND_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const created: { email: string; registerUrl: string; landingUrl: string }[] = [];
    const skipped: string[] = [];

    const rawList = body.emails.filter((x): x is string => typeof x === "string");
    const seen = new Set<string>();
    for (const raw of rawList) {
      const email = normalizeEmail(raw);
      if (!email || !EMAIL_RE.test(email)) {
        skipped.push(String(raw));
        continue;
      }
      if (seen.has(email)) {
        continue;
      }
      seen.add(email);

      if (normalizeEmail(brand.ownerUser.email) === email) {
        skipped.push(email);
        continue;
      }

      const existingUser = await prisma.appUser.findUnique({ where: { email } });
      if (existingUser) {
        if (existingUser.id === brand.ownerUserId) {
          continue;
        }
        const member = await prisma.brandMember.findUnique({
          where: { brandId_userId: { brandId, userId: existingUser.id } },
        });
        if (member) {
          skipped.push(email);
          continue;
        }
      }

      await prisma.brandInvite.deleteMany({
        where: { brandId, email, consumedAt: null },
      });

      const { token, tokenHash } = newInviteToken();
      await prisma.brandInvite.create({
        data: {
          brandId,
          email,
          tokenHash,
          invitedByUserId,
          expiresAt,
        },
      });

      const enc = encodeURIComponent(token);
      created.push({
        email,
        registerUrl: `${origin}/register?invite=${enc}`,
        landingUrl: `${origin}/invite/brand?token=${enc}`,
      });

      if (process.env.NODE_ENV !== "production") {
        console.info(`[brand-invite] brand="${brand.name}" (${brandId}) → ${email}\n  ${origin}/invite/brand?token=${enc}`);
      }
    }

    res.status(201).json({ created, skipped: skipped.length ? skipped : undefined });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create invites" });
  }
});

router.delete("/brands/:brandId/invites/:inviteId", async (req, res) => {
  try {
    const { brandId, inviteId } = req.params;
    if (!(await assertBrandOwnerAccess(req.appUser!, brandId))) {
      res.status(403).json({ error: "Only the brand owner can revoke invites" });
      return;
    }
    const del = await prisma.brandInvite.deleteMany({
      where: { id: inviteId, brandId, consumedAt: null },
    });
    if (del.count === 0) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to revoke invite" });
  }
});

router.delete("/brands/:brandId/members/:userId", async (req, res) => {
  try {
    const { brandId, userId } = req.params;
    if (!(await assertBrandOwnerAccess(req.appUser!, brandId))) {
      res.status(403).json({ error: "Only the brand owner can remove members" });
      return;
    }
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { ownerUserId: true },
    });
    if (!brand) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    if (userId === brand.ownerUserId) {
      res.status(400).json({ error: "Cannot remove the brand owner" });
      return;
    }
    await prisma.brandMember.deleteMany({ where: { brandId, userId } });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to remove member" });
  }
});

/** Owner rotates the shareable join key; previous key stops working for new joins. */
router.post("/brands/:brandId/regenerate-join-key", async (req, res) => {
  try {
    const brandId = req.params.brandId;
    if (!(await assertBrandOwnerAccess(req.appUser!, brandId))) {
      res.status(403).json({ error: "Only the brand owner can rotate the join key" });
      return;
    }
    const next = randomUUID();
    await prisma.brand.update({ where: { id: brandId }, data: { joinKey: next } });
    res.json({ joinKey: next });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to rotate join key" });
  }
});

/** Create a new brand with one workspace ecosystem and one default project space (no board until template). */
router.post("/brands", async (req, res) => {
  try {
    const body = req.body as { name?: string };
    const rawName = typeof body.name === "string" && body.name.trim() ? body.name : "New brand";
    const parsed = normalizeWorkspaceName(rawName);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const maxPos = await prisma.brand.aggregate({
      where: { archivedAt: null },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;
    const workspaceTitle = defaultWorkspaceTitleFromBrandName(parsed.name);
    const brand = await prisma.brand.create({
      data: {
        position,
        name: parsed.name,
        ownerUserId: req.appUser!.id,
        joinKey: randomUUID(),
        workspaces: {
          create: {
            name: workspaceTitle,
            projectSpaces: {
              create: { name: parsed.name, position: 0, isDefault: true },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        position: true,
        joinKey: true,
        brandProfile: true,
        workspaces: {
          where: { archivedAt: null },
          select: {
            id: true,
            name: true,
            projectSpaces: {
              where: { archivedAt: null },
              orderBy: { position: "asc" },
              select: {
                id: true,
                name: true,
                position: true,
                isDefault: true,
                purpose: true,
                boards: {
                  where: { archivedAt: null },
                  orderBy: { position: "asc" },
                  select: { id: true, name: true, position: true },
                },
              },
            },
          },
        },
      },
    });
    const uid = req.appUser!.id;
    res.status(201).json({
      id: brand.id,
      name: brand.name,
      position: brand.position,
      ownerUserId: uid,
      youAreOwner: true,
      brandIdentifier: brand.joinKey,
      brandDisplayName: brandDisplayNameFromProfileJson(brand.brandProfile),
      workspaces: brand.workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        projectSpaces: w.projectSpaces,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create brand" });
  }
});

router.patch("/brands/:brandId", async (req, res) => {
  try {
    const brandId = req.params.brandId;
    const existing = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!existing) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    const body = req.body as { archived?: boolean; name?: string };

    if (body.name !== undefined) {
      const parsed = normalizeWorkspaceName(String(body.name));
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      const previousBrandName = existing.name;
      await prisma.$transaction(async (tx) => {
        await tx.brand.update({ where: { id: brandId }, data: { name: parsed.name } });
        const ws = await tx.workspace.findFirst({ where: { brandId, archivedAt: null } });
        if (ws) {
          const prevDefault = defaultWorkspaceTitleFromBrandName(previousBrandName);
          if (ws.name === prevDefault) {
            await tx.workspace.update({
              where: { id: ws.id },
              data: { name: defaultWorkspaceTitleFromBrandName(parsed.name) },
            });
          }
        }
      });
    }

    if (body.archived === true) {
      if (!(await assertBrandOwnerAccess(req.appUser!, brandId))) {
        res.status(403).json({ error: "Only the brand owner can archive this brand" });
        return;
      }
      await prisma.$transaction([
        prisma.brand.update({
          where: { id: brandId },
          data: { archivedAt: new Date() },
        }),
        prisma.workspace.updateMany({
          where: { brandId },
          data: { archivedAt: new Date() },
        }),
      ]);
    } else if (body.archived === false) {
      if (!(await assertBrandOwnerAccess(req.appUser!, brandId))) {
        res.status(403).json({ error: "Only the brand owner can restore this brand" });
        return;
      }
      const maxPos = await prisma.brand.aggregate({
        where: { archivedAt: null },
        _max: { position: true },
      });
      const position = (maxPos._max.position ?? -1) + 1;
      await prisma.brand.update({
        where: { id: brandId },
        data: { archivedAt: null, position },
      });
    }
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        position: true,
        archivedAt: true,
        brandProfile: true,
        workspaces: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            archivedAt: true,
            projectSpaces: {
              orderBy: { position: "asc" },
              select: {
                id: true,
                name: true,
                position: true,
                isDefault: true,
                purpose: true,
                archivedAt: true,
                boards: {
                  where: { archivedAt: null },
                  orderBy: { position: "asc" },
                  select: { id: true, name: true, position: true },
                },
              },
            },
          },
        },
      },
    });
    res.json({
      id: brand!.id,
      name: brand!.name,
      position: brand!.position,
      archivedAt: brand!.archivedAt,
      brandDisplayName: brandDisplayNameFromProfileJson(brand!.brandProfile),
      workspaces: brand!.workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        archivedAt: w.archivedAt,
        projectSpaces: w.projectSpaces,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update brand" });
  }
});

/** Reorder brands in the sidebar. */
router.post("/brands/reorder", async (req, res) => {
  try {
    const body = req.body as { orderedIds?: string[] };
    if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
      res.status(400).json({ error: "orderedIds is required" });
      return;
    }
    const active = await prisma.brand.findMany({
      where: { archivedAt: null, ...brandWhereForAppUser(req.appUser!) },
      select: { id: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const activeIds = active.map((b) => b.id);
    if (body.orderedIds.length !== activeIds.length) {
      res.status(400).json({ error: "orderedIds must include every active brand exactly once" });
      return;
    }
    const setFromPayload = new Set(body.orderedIds);
    if (setFromPayload.size !== body.orderedIds.length) {
      res.status(400).json({ error: "duplicate id in orderedIds" });
      return;
    }
    for (const id of activeIds) {
      if (!setFromPayload.has(id)) {
        res.status(400).json({ error: "orderedIds must match active brands" });
        return;
      }
    }
    await prisma.$transaction(
      body.orderedIds.map((id, index) =>
        prisma.brand.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to reorder brands" });
  }
});

router.post("/workspaces/:workspaceId/boards/from-template", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const body = req.body as { templateId?: string; name?: string; projectSpaceId?: string };
    if (!body.templateId) {
      res.status(400).json({ error: "templateId is required" });
      return;
    }

    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    if (ws.archivedAt !== null) {
      res.status(400).json({ error: "Cannot add boards to an archived workspace" });
      return;
    }

    const resolved = await resolveWorkspaceTemplate(req.appUser!, workspaceId, body.templateId);
    if (!resolved) {
      res.status(404).json({ error: "Unknown template" });
      return;
    }

    const requestedPs = body.projectSpaceId?.trim();
    let ps = requestedPs
      ? await prisma.projectSpace.findFirst({
          where: { id: requestedPs, workspaceId, archivedAt: null },
        })
      : await prisma.projectSpace.findFirst({
          where: { workspaceId, archivedAt: null },
          orderBy: [{ isDefault: "desc" }, { position: "asc" }, { createdAt: "asc" }],
        });
    if (!ps) {
      res.status(400).json({ error: "No project space in this workspace" });
      return;
    }

    const maxP = await prisma.board.aggregate({
      where: { projectSpaceId: ps.id, archivedAt: null },
      _max: { position: true },
    });

    const board = await prisma.board.create({
      data: {
        projectSpaceId: ps.id,
        name: body.name?.trim() || resolved.templateName,
        position: (maxP._max.position ?? -1) + 1,
        lists: {
          create: resolved.lists.map((l, position) => ({
            title: l.title,
            key: l.key,
            position,
          })),
        },
        labels: {
          create: [...DEFAULT_TEMPLATE_LABELS],
        },
      },
      include: {
        projectSpace: boardProjectSpaceRef,
        lists: { orderBy: { position: "asc" } },
        labels: { orderBy: { name: "asc" } },
      },
    });

    res.status(201).json(boardJsonForApi(board));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create board from template" });
  }
});

router.post("/boards/:boardId/tasks", async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const body = req.body as {
      listId?: string;
      title?: string;
      description?: string;
      priority?: string;
      chatThreadId?: string | null;
      sourceMessageId?: string | null;
      routingSource?: string | null;
    };
    if (!body.title?.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const boardRow = await prisma.board.findUnique({ where: { id: boardId } });
    if (!boardRow || boardRow.archivedAt) {
      res.status(400).json({ error: "Board not found or archived" });
      return;
    }

    let listId = body.listId;
    if (!listId) {
      listId = await getBacklogListId(boardId);
    } else {
      const list = await prisma.boardList.findFirst({
        where: { id: listId, boardId },
      });
      if (!list) {
        res.status(400).json({ error: "Invalid list for this board" });
        return;
      }
    }

    const maxOrder = await prisma.task.aggregate({
      where: { listId },
      _max: { order: true },
    });
    const order = (maxOrder._max.order ?? -1) + 1;

    const routingSource =
      typeof body.routingSource === "string" && body.routingSource.trim()
        ? body.routingSource.trim().slice(0, 64)
        : undefined;

    const task = await prisma.task.create({
      data: {
        listId,
        title: body.title.trim(),
        description: typeof body.description === "string" ? body.description : "",
        ...(body.priority !== undefined &&
        typeof body.priority === "string" &&
        ["none", "low", "medium", "high"].includes(body.priority)
          ? { priority: body.priority }
          : {}),
        order,
        chatThreadId: body.chatThreadId ?? undefined,
        sourceMessageId: body.sourceMessageId ?? undefined,
        ...(routingSource ? { routingSource } : {}),
      },
      include: buildTaskInclude(req.appUser!),
    });
    await logActivity(task.id, req.appUser!.id, "created", task.title);
    res.status(201).json(task);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.patch("/tasks/:taskId", async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const body = req.body as {
      title?: string;
      description?: string;
      completed?: boolean;
      priority?: string;
      dueDate?: string | null;
      startDate?: string | null;
      listId?: string;
      archived?: boolean;
    };

    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    if (body.listId && body.listId !== existing.listId) {
      const list = await prisma.boardList.findUnique({ where: { id: body.listId } });
      const prevList = await prisma.boardList.findUnique({ where: { id: existing.listId } });
      if (!list || !prevList || list.boardId !== prevList.boardId) {
        res.status(400).json({ error: "Invalid list" });
        return;
      }
      const maxOrder = await prisma.task.aggregate({
        where: { listId: body.listId },
        _max: { order: true },
      });
      const order = (maxOrder._max.order ?? -1) + 1;
      const task = await prisma.task.update({
        where: { id: taskId },
        data: {
          listId: body.listId,
          order,
          archivedAt: null,
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.completed !== undefined ? { completed: body.completed } : {}),
          ...(body.priority !== undefined ? { priority: body.priority } : {}),
          ...(body.dueDate !== undefined
            ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
            : {}),
          ...(body.startDate !== undefined
            ? { startDate: body.startDate ? new Date(body.startDate) : null }
            : {}),
        },
        include: buildTaskInclude(req.appUser!),
      });
      await logActivity(taskId, req.appUser!.id, "moved", list.title);
      res.json(taskJsonForApi(task));
      return;
    }

    const archiveData: Prisma.TaskUpdateInput = {};
    if (body.archived === true) {
      archiveData.archivedAt = new Date();
    } else if (body.archived === false) {
      archiveData.archivedAt = null;
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...archiveData,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.completed !== undefined ? { completed: body.completed } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
        ...(body.startDate !== undefined
          ? { startDate: body.startDate ? new Date(body.startDate) : null }
          : {}),
      },
      include: buildTaskInclude(req.appUser!),
    });
    if (body.archived === true) {
      await logActivity(taskId, req.appUser!.id, "archived", task.title);
    } else if (body.archived === false) {
      await logActivity(taskId, req.appUser!.id, "unarchived", task.title);
    }
    res.json(taskJsonForApi(task));
  } catch {
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.post("/boards/:boardId/positions", async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const body = req.body as { positions?: Record<string, string[]> };
    if (!body.positions || typeof body.positions !== "object") {
      res.status(400).json({ error: "positions map required" });
      return;
    }

    const boardCheck = await prisma.board.findUnique({ where: { id: boardId } });
    if (!boardCheck || boardCheck.archivedAt) {
      res.status(400).json({ error: "Board not found or archived" });
      return;
    }

    const lists = await prisma.boardList.findMany({ where: { boardId } });
    const listIds = new Set(lists.map((l) => l.id));
    for (const listId of Object.keys(body.positions)) {
      if (!listIds.has(listId)) {
        res.status(400).json({ error: `Unknown list ${listId}` });
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const [listId, taskIds] of Object.entries(body.positions!)) {
        let order = 0;
        for (const taskId of taskIds) {
          await tx.task.updateMany({
            where: { id: taskId, list: { boardId }, archivedAt: null },
            data: { listId, order },
          });
          order += 1;
        }
      }
    });

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: boardIncludePositions,
    });
    res.json(boardJsonForApi(board));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save positions" });
  }
});

router.patch("/boards/:boardId", async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const body = req.body as { name?: string; archived?: boolean };
    const existing = await prisma.board.findUnique({ where: { id: boardId } });
    if (!existing) {
      res.status(404).json({ error: "Board not found" });
      return;
    }
    if (body.name !== undefined && !String(body.name).trim()) {
      res.status(400).json({ error: "name cannot be empty" });
      return;
    }
    const data: Prisma.BoardUpdateInput = {};
    if (body.name !== undefined) {
      data.name = String(body.name).trim();
    }
    if (body.archived === true) {
      data.archivedAt = new Date();
    } else if (body.archived === false) {
      data.archivedAt = null;
    }
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No updates" });
      return;
    }
    const board = await prisma.board.update({
      where: { id: boardId },
      data,
      include: buildBoardIncludeFull(req.appUser!),
    });
    res.json(boardJsonForApi(board));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update board" });
  }
});

router.patch("/boards/:boardId/lists/:listId", async (req, res) => {
  try {
    const { boardId, listId } = req.params;
    const body = req.body as { title?: string };
    const boardCheck = await prisma.board.findUnique({ where: { id: boardId } });
    if (!boardCheck || boardCheck.archivedAt) {
      res.status(400).json({ error: "Board not found or archived" });
      return;
    }
    const list = await prisma.boardList.findFirst({
      where: { id: listId, boardId },
    });
    if (!list) {
      res.status(404).json({ error: "List not found" });
      return;
    }
    if (body.title !== undefined && !String(body.title).trim()) {
      res.status(400).json({ error: "title cannot be empty" });
      return;
    }
    await prisma.boardList.update({
      where: { id: listId },
      data: body.title !== undefined ? { title: String(body.title).trim() } : {},
    });
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: buildBoardIncludeFull(req.appUser!),
    });
    res.json(boardJsonForApi(board));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update list" });
  }
});

/** Delete a list; tasks move to the backlog column if present, otherwise the first remaining list. */
router.delete("/boards/:boardId/lists/:listId", async (req, res) => {
  try {
    const { boardId, listId } = req.params;
    const boardExists = await prisma.board.findUnique({ where: { id: boardId } });
    if (!boardExists) {
      res.status(404).json({ error: "Board not found" });
      return;
    }
    if (boardExists.archivedAt) {
      res.status(400).json({ error: "Cannot modify an archived board" });
      return;
    }

    const lists = await prisma.boardList.findMany({
      where: { boardId },
      orderBy: { position: "asc" },
    });
    if (lists.length <= 1) {
      res.status(400).json({ error: "Cannot delete the last column on a board" });
      return;
    }

    const victim = lists.find((l) => l.id === listId);
    if (!victim) {
      res.status(404).json({ error: "List not found" });
      return;
    }

    const others = lists.filter((l) => l.id !== listId);
    const targetList =
      others.find((l) => l.key === "backlog") ?? others.sort((a, b) => a.position - b.position)[0];

    await prisma.$transaction(async (tx) => {
      const tasksToMove = await tx.task.findMany({
        where: { listId },
        orderBy: { order: "asc" },
      });
      let nextOrder =
        (await tx.task.aggregate({
          where: { listId: targetList.id },
          _max: { order: true },
        }))._max.order ?? -1;
      nextOrder += 1;
      for (const task of tasksToMove) {
        await tx.task.update({
          where: { id: task.id },
          data: { listId: targetList.id, order: nextOrder++ },
        });
      }
      await tx.boardList.delete({ where: { id: listId } });
      const remaining = await tx.boardList.findMany({
        where: { boardId },
        orderBy: { position: "asc" },
      });
      await Promise.all(
        remaining.map((l, position) =>
          tx.boardList.update({
            where: { id: l.id },
            data: { position },
          }),
        ),
      );
    });

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: buildBoardIncludeFull(req.appUser!),
    });
    res.json(boardJsonForApi(board));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete list" });
  }
});

router.post("/boards/:boardId/reorder-lists", async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const body = req.body as { orderedListIds?: string[] };
    if (!body.orderedListIds?.length) {
      res.status(400).json({ error: "orderedListIds required" });
      return;
    }
    const boardCheck = await prisma.board.findUnique({ where: { id: boardId } });
    if (!boardCheck || boardCheck.archivedAt) {
      res.status(400).json({ error: "Board not found or archived" });
      return;
    }
    await prisma.$transaction(
      body.orderedListIds.map((id, position) =>
        prisma.boardList.updateMany({
          where: { id, boardId },
          data: { position },
        }),
      ),
    );
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: boardIncludePositions,
    });
    res.json(boardJsonForApi(board));
  } catch {
    res.status(500).json({ error: "Failed to reorder lists" });
  }
});

router.post("/boards/:boardId/lists", async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const body = req.body as { title?: string };
    if (!body.title?.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const b = await prisma.board.findUnique({ where: { id: boardId } });
    if (!b || b.archivedAt) {
      res.status(400).json({ error: "Board not found or archived" });
      return;
    }
    const maxP = await prisma.boardList.aggregate({
      where: { boardId },
      _max: { position: true },
    });
    const list = await prisma.boardList.create({
      data: {
        boardId,
        title: body.title.trim(),
        position: (maxP._max.position ?? -1) + 1,
      },
    });
    res.status(201).json(list);
  } catch {
    res.status(500).json({ error: "Failed to create list" });
  }
});

router.post("/tasks/:taskId/comments", async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const body = req.body as { body?: string };
    if (!body.body?.trim()) {
      res.status(400).json({ error: "body is required" });
      return;
    }
    const comment = await prisma.comment.create({
      data: { taskId, body: body.body.trim() },
    });
    await logActivity(taskId, req.appUser!.id, "comment", "");
    res.status(201).json(comment);
  } catch {
    res.status(500).json({ error: "Failed to add comment" });
  }
});

router.post("/tasks/:taskId/checklist", async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const body = req.body as { title?: string };
    if (!body.title?.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const maxP = await prisma.checklistItem.aggregate({
      where: { taskId },
      _max: { position: true },
    });
    const item = await prisma.checklistItem.create({
      data: {
        taskId,
        title: body.title.trim(),
        position: (maxP._max.position ?? -1) + 1,
      },
    });
    res.status(201).json(item);
  } catch {
    res.status(500).json({ error: "Failed to add checklist item" });
  }
});

router.patch("/checklist-items/:itemId", async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const body = req.body as { title?: string; completed?: boolean };
    const item = await prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.completed !== undefined ? { completed: body.completed } : {}),
      },
    });
    res.json(item);
  } catch {
    res.status(500).json({ error: "Failed to update checklist item" });
  }
});

router.post("/tasks/:taskId/labels", async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const body = req.body as { labelId?: string };
    if (!body.labelId) {
      res.status(400).json({ error: "labelId required" });
      return;
    }
    await prisma.taskLabel.upsert({
      where: { taskId_labelId: { taskId, labelId: body.labelId } },
      create: { taskId, labelId: body.labelId },
      update: {},
    });
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: buildTaskInclude(req.appUser!),
    });
    res.json(taskJsonForApi(task));
  } catch {
    res.status(500).json({ error: "Failed to add label" });
  }
});

router.delete("/tasks/:taskId/labels/:labelId", async (req, res) => {
  try {
    const { taskId, labelId } = req.params;
    await prisma.taskLabel.delete({
      where: { taskId_labelId: { taskId, labelId } },
    });
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: buildTaskInclude(req.appUser!),
    });
    res.json(taskJsonForApi(task));
  } catch {
    res.status(500).json({ error: "Failed to remove label" });
  }
});

export default router;
