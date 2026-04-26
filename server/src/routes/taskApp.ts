import { randomUUID } from "node:crypto";
import { Prisma, type RoutingHold, type TrackerStatus } from "@prisma/client";
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
  assertUserIsBrandParticipant,
  assertWorkspaceAccess,
  brandAccessWhereForUserId,
  brandWhereForAppUser,
  getBrandIdForBoardId,
  listAccessibleWorkspaceIds,
  workspaceWhereForAppUser,
  type AppUserPrincipal,
} from "../lib/auth/workspaceScope.js";
import { newInviteToken } from "../lib/auth/brandInvite.js";
import { EMAIL_RE, normalizeEmail } from "../lib/auth/identifiers.js";
import { prisma } from "../lib/db.js";
import { ensurePersonalWorkspaceBoard, getDefaultSubBoardIdForBoard } from "../lib/taskDefaults.js";
import { parseLaneKey, TRACKER_STATUS_ORDER } from "../lib/trackerStatus.js";
import { allocateBrandTicketNumbers } from "../lib/brandTicketNumbers.js";
import { normalizeCardFaceMetaInput } from "../lib/cardFaceMeta.js";
import { formatBrandProfileForPrompt } from "../lib/brandProfileFormat.js";
import { parseBrandProfileForSave } from "../lib/brandProfileSchema.js";
import { brandDisplayNameFromProfileJson } from "../lib/brandDisplayName.js";
import { defaultWorkspaceTitleFromBrandName, normalizeWorkspaceName } from "../lib/workspaceLimits.js";
import { boardJsonForApi, taskJsonForApi } from "../lib/boardForApi.js";
import { activityActorDto } from "../lib/activityActorLabel.js";
import { buildRoutingIndexPayload } from "../lib/routingIndexForWorkspace.js";
import {
  BOARD_ACCENT_PALETTE,
  nextBoardAccentColorForWorkspace,
  nextSubBoardAccentColorForBoard,
  sanitizeBoardAccentColor,
} from "../lib/boardAccentColor.js";

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

const boardProjectSpaceRef = {
  select: {
    workspaceId: true,
    workspace: { select: { brandId: true } },
  },
} as const;

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

function taskSubBoardSelect() {
  return {
    id: true,
    title: true,
    key: true,
    position: true,
    boardId: true,
    accentColor: true,
    board: {
      select: {
        id: true,
        name: true,
        accentColor: true,
        projectSpace: {
          select: {
            id: true,
            name: true,
            workspaceId: true,
            workspace: { select: { brandId: true } },
          },
        },
      },
    },
  } as const;
}

function buildTaskInclude(_user: AppUserPrincipal, includeUserTicketLabels = true) {
  return {
    subBoard: { select: taskSubBoardSelect() },
    createdBy: { select: activityActorSelect },
    assignee: { select: activityActorSelect },
    ideaNode: { select: { id: true, title: true } },
    labels: { include: { label: true } },
    ...(includeUserTicketLabels
      ? { userBrandTicketLabels: { include: { userBrandTicketLabel: true } } }
      : {}),
    comments: { orderBy: { createdAt: "asc" as const }, include: { author: { select: activityActorSelect } } },
    checklist: { orderBy: { position: "asc" as const } },
    activities: taskActivitiesInclude(30),
  } as const;
}

/** Kanban and API responses only surface non-archived tasks on a board. */
const activeTaskWhere: Prisma.TaskWhereInput = { archivedAt: null };

const taskIncludeBoardCardBase = {
  subBoard: { select: taskSubBoardSelect() },
  createdBy: { select: activityActorSelect },
  assignee: { select: activityActorSelect },
  ideaNode: { select: { id: true, title: true } },
  labels: { include: { label: true } },
} as const;

/** Same as full card but omits user-brand labels (for DBs not migrated yet). */
const taskIncludeBoardCardMinimal = taskIncludeBoardCardBase;

const taskIncludeBoardCard = {
  ...taskIncludeBoardCardBase,
  userBrandTicketLabels: { include: { userBrandTicketLabel: true } },
} as const;

const boardIncludeBootstrap = {
  projectSpace: boardProjectSpaceRef,
  lists: {
    orderBy: { position: "asc" as const },
    include: {
      tasks: {
        where: activeTaskWhere,
        orderBy: { order: "asc" as const },
        include: taskIncludeBoardCardMinimal,
      },
    },
  },
  labels: { orderBy: { name: "asc" as const } },
} as const;

function buildBoardIncludeFull(_user: AppUserPrincipal, includeUserTicketLabels = true) {
  const card = includeUserTicketLabels ? taskIncludeBoardCard : taskIncludeBoardCardMinimal;
  return {
    projectSpace: boardProjectSpaceRef,
    lists: {
      orderBy: { position: "asc" as const },
      include: {
        tasks: {
          where: activeTaskWhere,
          orderBy: { order: "asc" as const },
          include: {
            ...card,
            comments: { orderBy: { createdAt: "asc" as const }, include: { author: { select: activityActorSelect } } },
            checklist: { orderBy: { position: "asc" as const } },
            activities: taskActivitiesInclude(20),
          },
        },
      },
    },
    labels: { orderBy: { name: "asc" as const } },
  } as const;
}

async function findBoardWithApiInclude(boardId: string, user: AppUserPrincipal) {
  try {
    return await prisma.board.findUnique({
      where: { id: boardId },
      include: buildBoardIncludeFull(user),
    });
  } catch (e) {
    console.error(
      "[task-app] board query full include failed; retrying without user ticket labels",
      e,
    );
    return prisma.board.findUnique({
      where: { id: boardId },
      include: buildBoardIncludeFull(user, false),
    });
  }
}

const boardIncludePositions = {
  projectSpace: boardProjectSpaceRef,
  lists: {
    orderBy: { position: "asc" as const },
    include: {
      tasks: {
        where: activeTaskWhere,
        orderBy: { order: "asc" as const },
        include: taskIncludeBoardCardMinimal,
      },
    },
  },
  labels: { orderBy: { name: "asc" as const } },
} as const;

async function logActivity(taskId: string, actorUserId: string, action: string, detail = "") {
  await prisma.activity.create({ data: { taskId, actorUserId, action, detail } });
}

function parseTrackerStatusParam(raw: string | undefined): TrackerStatus[] | undefined {
  if (!raw?.trim()) return undefined;
  const parts = raw.split(",").map((s) => s.trim());
  const out: TrackerStatus[] = [];
  for (const p of parts) {
    if (TRACKER_STATUS_ORDER.includes(p as TrackerStatus)) out.push(p as TrackerStatus);
  }
  return out.length ? out : undefined;
}

function isTrackerStatus(s: string): s is TrackerStatus {
  return TRACKER_STATUS_ORDER.includes(s as TrackerStatus);
}

async function nextOrderInLane(
  client: Pick<typeof prisma, "task">,
  subBoardId: string,
  trackerStatus: TrackerStatus,
): Promise<number> {
  const maxOrder = await client.task.aggregate({
    where: { subBoardId, trackerStatus, archivedAt: null },
    _max: { order: true },
  });
  return (maxOrder._max.order ?? -1) + 1;
}

/** New tasks from quick-add sort above existing rows (`order` ascending in UI). */
async function firstOrderInLane(
  client: Pick<typeof prisma, "task">,
  subBoardId: string,
  trackerStatus: TrackerStatus,
): Promise<number> {
  const minOrder = await client.task.aggregate({
    where: { subBoardId, trackerStatus, archivedAt: null },
    _min: { order: true },
  });
  return (minOrder._min.order ?? 0) - 1;
}

function sanitizeTicketCardColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  // Accept hex colors and compact semantic tokens.
  if (/^#[0-9a-fA-F]{6}$/.test(v) || /^[a-z0-9_-]{1,24}$/.test(v)) return v;
  return null;
}

function sanitizeCardFaceLayout(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().slice(0, 64);
  if (v === "standard" || v === "minimal") return v;
  return undefined;
}

function parseCompleteCheckboxVisibleByDefault(raw: unknown): boolean | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "boolean") return undefined;
  return raw;
}

function sanitizeUserTicketLabelName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t.length > 128) return null;
  return t;
}

function sanitizeUserTicketLabelColor(raw: unknown): string {
  if (typeof raw !== "string") return "#6366f1";
  const v = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return "#6366f1";
}

async function taskBrandIdForUserLabel(taskId: string): Promise<string | null> {
  const row = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      subBoard: {
        select: {
          board: { select: { projectSpace: { select: { workspace: { select: { brandId: true } } } } } },
        },
      },
    },
  });
  return row?.subBoard.board.projectSpace.workspace.brandId ?? null;
}

function parseHiddenTrackerStatuses(raw: unknown): TrackerStatus[] | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const uniq = new Set<TrackerStatus>();
  for (const entry of raw) {
    if (typeof entry !== "string" || !isTrackerStatus(entry)) return null;
    uniq.add(entry);
  }
  const hidden = [...uniq];
  if (hidden.length >= TRACKER_STATUS_ORDER.length) {
    return TRACKER_STATUS_ORDER.filter((s) => s !== "BACKLOG");
  }
  return hidden;
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
              select: { id: true, name: true, position: true, accentColor: true },
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

/** Boards, sub-boards, notebook folders, brainstorm sessions — for Mail Clerk / Rapid Router. */
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

router.get("/workspaces/:workspaceId/user-workspace-preferences", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const row = await prisma.workspaceUserPreference.findUnique({
      where: { userId_workspaceId: { userId: req.appUser!.id, workspaceId } },
      select: {
        workspaceId: true,
        ticketTrackerColorByBoard: true,
        ticketTrackerSubBoardStrip: true,
        updatedAt: true,
      },
    });
    res.json(
      row ?? {
        workspaceId,
        ticketTrackerColorByBoard: false,
        ticketTrackerSubBoardStrip: false,
        updatedAt: null,
      },
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load workspace preferences" });
  }
});

router.patch("/workspaces/:workspaceId/user-workspace-preferences", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const body = req.body as { ticketTrackerColorByBoard?: boolean; ticketTrackerSubBoardStrip?: boolean };
    const patch: Prisma.WorkspaceUserPreferenceUncheckedUpdateInput = {};
    if (Object.prototype.hasOwnProperty.call(body, "ticketTrackerColorByBoard")) {
      if (typeof body.ticketTrackerColorByBoard !== "boolean") {
        res.status(400).json({ error: "Invalid ticketTrackerColorByBoard" });
        return;
      }
      patch.ticketTrackerColorByBoard = body.ticketTrackerColorByBoard;
    }
    if (Object.prototype.hasOwnProperty.call(body, "ticketTrackerSubBoardStrip")) {
      if (typeof body.ticketTrackerSubBoardStrip !== "boolean") {
        res.status(400).json({ error: "Invalid ticketTrackerSubBoardStrip" });
        return;
      }
      patch.ticketTrackerSubBoardStrip = body.ticketTrackerSubBoardStrip;
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No updates" });
      return;
    }
    const pref = await prisma.workspaceUserPreference.upsert({
      where: { userId_workspaceId: { userId: req.appUser!.id, workspaceId } },
      create: {
        userId: req.appUser!.id,
        workspaceId,
        ticketTrackerColorByBoard:
          typeof body.ticketTrackerColorByBoard === "boolean" ? body.ticketTrackerColorByBoard : false,
        ticketTrackerSubBoardStrip:
          typeof body.ticketTrackerSubBoardStrip === "boolean" ? body.ticketTrackerSubBoardStrip : false,
      },
      update: patch,
      select: {
        workspaceId: true,
        ticketTrackerColorByBoard: true,
        ticketTrackerSubBoardStrip: true,
        updatedAt: true,
      },
    });
    res.json(pref);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save workspace preferences" });
  }
});

router.get("/boards/:boardId", async (req, res) => {
  try {
    const board = await findBoardWithApiInclude(req.params.boardId, req.appUser!);
    if (!board) {
      res.status(404).json({ error: "Board not found" });
      return;
    }
    res.json(boardJsonForApi(board));
  } catch (e) {
    console.error("[task-app] GET /boards/:boardId failed", e);
    res.status(500).json({ error: "Failed to load board" });
  }
});

router.get("/boards/:boardId/sub-board-preferences", async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const rows = await prisma.subBoardPreference.findMany({
      where: {
        userId: req.appUser!.id,
        subBoard: { boardId },
      },
      select: {
        subBoardId: true,
        ticketCardColor: true,
        cardFaceLayout: true,
        cardFaceMeta: true,
        completeCheckboxVisibleByDefault: true,
        hiddenTrackerStatuses: true,
        showSubBoardAccentStrip: true,
        updatedAt: true,
      },
    });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load sub-board preferences" });
  }
});

const boardUserPreferenceSelect = {
  boardId: true,
  defaultTicketCardColor: true,
  defaultHiddenTrackerStatuses: true,
  defaultCompleteCheckboxVisible: true,
  defaultCardFaceLayout: true,
  defaultCardFaceMeta: true,
  hiddenSubBoardIds: true,
  showBoardAccentBorder: true,
  updatedAt: true,
} as const;

async function filterHiddenSubBoardIdsForBoard(boardId: string, raw: unknown): Promise<string[] | null> {
  if (!Array.isArray(raw)) return null;
  const lists = await prisma.boardList.findMany({
    where: { boardId },
    select: { id: true },
  });
  const allowed = new Set(lists.map((l) => l.id));
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== "string" || !id.trim()) return null;
    if (!allowed.has(id)) return null;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

router.get("/boards/:boardId/user-board-preferences", async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const row = await prisma.boardUserPreference.findUnique({
      where: { userId_boardId: { userId: req.appUser!.id, boardId } },
      select: boardUserPreferenceSelect,
    });
    res.json(
      row ?? {
        boardId,
        defaultTicketCardColor: null,
        defaultHiddenTrackerStatuses: [],
        defaultCompleteCheckboxVisible: true,
        defaultCardFaceLayout: "standard",
        defaultCardFaceMeta: {},
        hiddenSubBoardIds: [],
        showBoardAccentBorder: true,
        updatedAt: null,
      },
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load board preferences" });
  }
});

router.patch("/boards/:boardId/user-board-preferences", async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const body = req.body as {
      defaultTicketCardColor?: string | null;
      defaultHiddenTrackerStatuses?: string[];
      defaultCompleteCheckboxVisible?: boolean;
      defaultCardFaceLayout?: string;
      defaultCardFaceMeta?: unknown;
      hiddenSubBoardIds?: string[];
      showBoardAccentBorder?: boolean;
    };

    const patch: Prisma.BoardUserPreferenceUncheckedUpdateInput = {};
    if (Object.prototype.hasOwnProperty.call(body, "defaultTicketCardColor")) {
      patch.defaultTicketCardColor = sanitizeTicketCardColor(body.defaultTicketCardColor);
    }
    if (Object.prototype.hasOwnProperty.call(body, "defaultHiddenTrackerStatuses")) {
      const hidden = parseHiddenTrackerStatuses(body.defaultHiddenTrackerStatuses);
      if (hidden == null) {
        res.status(400).json({ error: "Invalid defaultHiddenTrackerStatuses" });
        return;
      }
      patch.defaultHiddenTrackerStatuses = hidden;
    }
    if (Object.prototype.hasOwnProperty.call(body, "defaultCompleteCheckboxVisible")) {
      const vis = parseCompleteCheckboxVisibleByDefault(body.defaultCompleteCheckboxVisible);
      if (vis === undefined) {
        res.status(400).json({ error: "Invalid defaultCompleteCheckboxVisible" });
        return;
      }
      patch.defaultCompleteCheckboxVisible = vis;
    }
    if (Object.prototype.hasOwnProperty.call(body, "defaultCardFaceLayout")) {
      const layout = sanitizeCardFaceLayout(body.defaultCardFaceLayout);
      if (layout === undefined) {
        res.status(400).json({ error: "Invalid defaultCardFaceLayout" });
        return;
      }
      patch.defaultCardFaceLayout = layout;
    }
    if (Object.prototype.hasOwnProperty.call(body, "defaultCardFaceMeta")) {
      patch.defaultCardFaceMeta = normalizeCardFaceMetaInput(body.defaultCardFaceMeta) as Prisma.InputJsonValue;
    }
    if (Object.prototype.hasOwnProperty.call(body, "hiddenSubBoardIds")) {
      const ids = await filterHiddenSubBoardIdsForBoard(boardId, body.hiddenSubBoardIds);
      if (ids == null) {
        res.status(400).json({ error: "Invalid hiddenSubBoardIds" });
        return;
      }
      patch.hiddenSubBoardIds = ids;
    }
    if (Object.prototype.hasOwnProperty.call(body, "showBoardAccentBorder")) {
      if (typeof body.showBoardAccentBorder !== "boolean") {
        res.status(400).json({ error: "Invalid showBoardAccentBorder" });
        return;
      }
      patch.showBoardAccentBorder = body.showBoardAccentBorder;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No updates" });
      return;
    }

    const createHiddenIds =
      body.hiddenSubBoardIds !== undefined
        ? (await filterHiddenSubBoardIdsForBoard(boardId, body.hiddenSubBoardIds)) ?? []
        : [];

    const pref = await prisma.boardUserPreference.upsert({
      where: { userId_boardId: { userId: req.appUser!.id, boardId } },
      create: {
        userId: req.appUser!.id,
        boardId,
        defaultTicketCardColor: sanitizeTicketCardColor(
          Object.prototype.hasOwnProperty.call(body, "defaultTicketCardColor")
            ? body.defaultTicketCardColor
            : null,
        ),
        defaultHiddenTrackerStatuses:
          parseHiddenTrackerStatuses(body.defaultHiddenTrackerStatuses) ?? [],
        defaultCompleteCheckboxVisible:
          parseCompleteCheckboxVisibleByDefault(body.defaultCompleteCheckboxVisible) ?? true,
        defaultCardFaceLayout: sanitizeCardFaceLayout(body.defaultCardFaceLayout) ?? "standard",
        defaultCardFaceMeta: normalizeCardFaceMetaInput(
          Object.prototype.hasOwnProperty.call(body, "defaultCardFaceMeta") ? body.defaultCardFaceMeta : {},
        ) as Prisma.InputJsonValue,
        hiddenSubBoardIds: createHiddenIds,
        showBoardAccentBorder: Object.prototype.hasOwnProperty.call(body, "showBoardAccentBorder")
          ? Boolean(body.showBoardAccentBorder)
          : true,
      },
      update: patch,
      select: boardUserPreferenceSelect,
    });
    res.json(pref);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save board preferences" });
  }
});

/**
 * Apply the same per-user `BoardUserPreference` values to every non-archived project board
 * in this workspace (checkbox default, default tracker visibility, card face defaults, and/or clear hidden sub-board tabs).
 */
router.post("/workspaces/:workspaceId/apply-user-board-defaults", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const user = req.appUser!;
    const ok = await assertWorkspaceAccess(user, workspaceId);
    if (!ok) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const body = req.body as {
      defaultCompleteCheckboxVisible?: boolean;
      defaultHiddenTrackerStatuses?: unknown;
      subBoardTabVisibility?: "show_all";
      defaultCardFaceLayout?: unknown;
      defaultCardFaceMeta?: unknown;
    };

    const hasSubAll = body.subBoardTabVisibility === "show_all";
    const hasCheckbox = Object.prototype.hasOwnProperty.call(body, "defaultCompleteCheckboxVisible");
    const hasTrackers = Object.prototype.hasOwnProperty.call(body, "defaultHiddenTrackerStatuses");
    const hasCardFaceLayout = Object.prototype.hasOwnProperty.call(body, "defaultCardFaceLayout");
    const hasCardFaceMeta = Object.prototype.hasOwnProperty.call(body, "defaultCardFaceMeta");
    if (!hasSubAll && !hasCheckbox && !hasTrackers && !hasCardFaceLayout && !hasCardFaceMeta) {
      res.status(400).json({ error: "No updates" });
      return;
    }
    if (body.subBoardTabVisibility !== undefined && body.subBoardTabVisibility !== "show_all") {
      res.status(400).json({ error: "subBoardTabVisibility must be 'show_all' or omitted" });
      return;
    }

    let hiddenTrackers: TrackerStatus[] | undefined;
    if (hasTrackers) {
      const parsed = parseHiddenTrackerStatuses(body.defaultHiddenTrackerStatuses);
      if (parsed == null) {
        res.status(400).json({ error: "Invalid defaultHiddenTrackerStatuses" });
        return;
      }
      hiddenTrackers = parsed;
    }

    const checkboxValue = hasCheckbox
      ? parseCompleteCheckboxVisibleByDefault(body.defaultCompleteCheckboxVisible)
      : undefined;
    if (hasCheckbox && checkboxValue === undefined) {
      res.status(400).json({ error: "Invalid defaultCompleteCheckboxVisible" });
      return;
    }

    let layoutResolved: string | undefined;
    if (hasCardFaceLayout) {
      layoutResolved = sanitizeCardFaceLayout(body.defaultCardFaceLayout);
      if (layoutResolved === undefined) {
        res.status(400).json({ error: "Invalid defaultCardFaceLayout" });
        return;
      }
    }

    const metaResolved = hasCardFaceMeta ? normalizeCardFaceMetaInput(body.defaultCardFaceMeta) : undefined;

    const boardRows = await prisma.board.findMany({
      where: {
        archivedAt: null,
        projectSpace: { workspaceId, archivedAt: null },
      },
      select: { id: true },
    });

    if (boardRows.length === 0) {
      res.json({ ok: true, boardCount: 0 });
      return;
    }

    const userId = user.id;
    const updatePatch: Prisma.BoardUserPreferenceUncheckedUpdateInput = {};
    if (hasCheckbox) updatePatch.defaultCompleteCheckboxVisible = checkboxValue!;
    if (hiddenTrackers !== undefined) updatePatch.defaultHiddenTrackerStatuses = hiddenTrackers;
    if (hasSubAll) updatePatch.hiddenSubBoardIds = [];
    if (hasCardFaceLayout) updatePatch.defaultCardFaceLayout = layoutResolved!;
    if (hasCardFaceMeta) updatePatch.defaultCardFaceMeta = metaResolved! as Prisma.InputJsonValue;

    const createData = (boardId: string): Prisma.BoardUserPreferenceUncheckedCreateInput => {
      const c: Prisma.BoardUserPreferenceUncheckedCreateInput = {
        userId,
        boardId,
        defaultTicketCardColor: null,
        defaultHiddenTrackerStatuses: hiddenTrackers ?? [],
        defaultCompleteCheckboxVisible: hasCheckbox ? checkboxValue! : true,
        hiddenSubBoardIds: [],
      };
      if (hasCardFaceLayout) c.defaultCardFaceLayout = layoutResolved!;
      if (hasCardFaceMeta) c.defaultCardFaceMeta = metaResolved! as Prisma.InputJsonValue;
      return c;
    };

    await prisma.$transaction(
      boardRows.map((b) =>
        prisma.boardUserPreference.upsert({
          where: { userId_boardId: { userId, boardId: b.id } },
          create: createData(b.id),
          update: updatePatch,
        }),
      ),
    );

    res.json({ ok: true, boardCount: boardRows.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to apply board defaults" });
  }
});

router.get("/sub-boards/:subBoardId/preferences", async (req, res) => {
  try {
    const subBoardId = req.params.subBoardId;
    const sb = await prisma.boardList.findUnique({
      where: { id: subBoardId },
      select: { boardId: true },
    });
    if (!sb) {
      res.status(404).json({ error: "Sub-board not found" });
      return;
    }
    const ok = await assertBoardAccess(req.appUser!, sb.boardId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const row = await prisma.subBoardPreference.findUnique({
      where: { userId_subBoardId: { userId: req.appUser!.id, subBoardId } },
      select: {
        subBoardId: true,
        ticketCardColor: true,
        cardFaceLayout: true,
        cardFaceMeta: true,
        completeCheckboxVisibleByDefault: true,
        hiddenTrackerStatuses: true,
        showSubBoardAccentStrip: true,
        updatedAt: true,
      },
    });
    res.json(
      row ?? {
        subBoardId,
        ticketCardColor: null,
        cardFaceLayout: "standard",
        cardFaceMeta: null,
        completeCheckboxVisibleByDefault: true,
        hiddenTrackerStatuses: [],
        showSubBoardAccentStrip: true,
        updatedAt: null,
      },
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load sub-board preferences" });
  }
});

router.patch("/sub-boards/:subBoardId/preferences", async (req, res) => {
  try {
    const subBoardId = req.params.subBoardId;
    const sb = await prisma.boardList.findUnique({
      where: { id: subBoardId },
      select: { boardId: true },
    });
    if (!sb) {
      res.status(404).json({ error: "Sub-board not found" });
      return;
    }
    const ok = await assertBoardAccess(req.appUser!, sb.boardId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const body = req.body as {
      ticketCardColor?: string | null;
      hiddenTrackerStatuses?: string[];
      cardFaceLayout?: string;
      cardFaceMeta?: unknown | null;
      completeCheckboxVisibleByDefault?: boolean;
      showSubBoardAccentStrip?: boolean;
    };

    const patch: Prisma.SubBoardPreferenceUncheckedUpdateInput = {};
    if (Object.prototype.hasOwnProperty.call(body, "ticketCardColor")) {
      patch.ticketCardColor = sanitizeTicketCardColor(body.ticketCardColor);
    }
    if (Object.prototype.hasOwnProperty.call(body, "hiddenTrackerStatuses")) {
      const hidden = parseHiddenTrackerStatuses(body.hiddenTrackerStatuses);
      if (hidden == null) {
        res.status(400).json({ error: "Invalid hiddenTrackerStatuses" });
        return;
      }
      patch.hiddenTrackerStatuses = hidden;
    }
    if (Object.prototype.hasOwnProperty.call(body, "cardFaceLayout")) {
      const layout = sanitizeCardFaceLayout(body.cardFaceLayout);
      if (layout === undefined) {
        res.status(400).json({ error: "Invalid cardFaceLayout" });
        return;
      }
      patch.cardFaceLayout = layout;
    }
    if (Object.prototype.hasOwnProperty.call(body, "cardFaceMeta")) {
      if (body.cardFaceMeta === null) {
        patch.cardFaceMeta = Prisma.JsonNull;
      } else {
        patch.cardFaceMeta = normalizeCardFaceMetaInput(body.cardFaceMeta) as Prisma.InputJsonValue;
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "completeCheckboxVisibleByDefault")) {
      const vis = parseCompleteCheckboxVisibleByDefault(body.completeCheckboxVisibleByDefault);
      if (vis === undefined) {
        res.status(400).json({ error: "Invalid completeCheckboxVisibleByDefault" });
        return;
      }
      patch.completeCheckboxVisibleByDefault = vis;
    }
    if (Object.prototype.hasOwnProperty.call(body, "showSubBoardAccentStrip")) {
      if (typeof body.showSubBoardAccentStrip !== "boolean") {
        res.status(400).json({ error: "Invalid showSubBoardAccentStrip" });
        return;
      }
      patch.showSubBoardAccentStrip = body.showSubBoardAccentStrip;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No updates" });
      return;
    }

    const createHidden = parseHiddenTrackerStatuses(body.hiddenTrackerStatuses) ?? [];
    const createLayout = sanitizeCardFaceLayout(body.cardFaceLayout) ?? "standard";
    const createCheckboxVis =
      parseCompleteCheckboxVisibleByDefault(body.completeCheckboxVisibleByDefault) ?? true;
    const createMetaPatch: { cardFaceMeta?: Prisma.InputJsonValue | typeof Prisma.JsonNull } = {};
    if (Object.prototype.hasOwnProperty.call(body, "cardFaceMeta")) {
      createMetaPatch.cardFaceMeta =
        body.cardFaceMeta === null
          ? Prisma.JsonNull
          : (normalizeCardFaceMetaInput(body.cardFaceMeta) as Prisma.InputJsonValue);
    }

    const pref = await prisma.subBoardPreference.upsert({
      where: { userId_subBoardId: { userId: req.appUser!.id, subBoardId } },
      create: {
        userId: req.appUser!.id,
        subBoardId,
        ticketCardColor: sanitizeTicketCardColor(body.ticketCardColor),
        hiddenTrackerStatuses: createHidden,
        cardFaceLayout: createLayout,
        completeCheckboxVisibleByDefault: createCheckboxVis,
        showSubBoardAccentStrip: Object.prototype.hasOwnProperty.call(body, "showSubBoardAccentStrip")
          ? Boolean(body.showSubBoardAccentStrip)
          : true,
        ...createMetaPatch,
      },
      update: patch,
      select: {
        subBoardId: true,
        ticketCardColor: true,
        cardFaceLayout: true,
        cardFaceMeta: true,
        completeCheckboxVisibleByDefault: true,
        hiddenTrackerStatuses: true,
        showSubBoardAccentStrip: true,
        updatedAt: true,
      },
    });
    res.json(pref);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save sub-board preferences" });
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

/** Flat tasks / tickets — filters: workspace, board, sub-board, tracker, assignee, search, … */
router.get("/tasks", async (req, res) => {
  try {
    const user = req.appUser!;
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
    const boardId = typeof req.query.boardId === "string" ? req.query.boardId : undefined;
    const projectSpaceId =
      typeof req.query.projectSpaceId === "string" ? req.query.projectSpaceId : undefined;
    const subBoardId = typeof req.query.subBoardId === "string" ? req.query.subBoardId : undefined;
    const chatThreadId = typeof req.query.chatThreadId === "string" ? req.query.chatThreadId : undefined;
    const assigneeUserId =
      typeof req.query.assigneeUserId === "string" ? req.query.assigneeUserId : undefined;
    const createdByUserId =
      typeof req.query.createdByUserId === "string" ? req.query.createdByUserId : undefined;
    const dueBefore = typeof req.query.dueBefore === "string" ? req.query.dueBefore : undefined;
    const dueAfter = typeof req.query.dueAfter === "string" ? req.query.dueAfter : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const labelId = typeof req.query.labelId === "string" ? req.query.labelId : undefined;
    const labelIdsRaw = typeof req.query.labelIds === "string" ? req.query.labelIds : undefined;
    const labelIds = labelIdsRaw
      ? labelIdsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const priority = typeof req.query.priority === "string" ? req.query.priority : undefined;
    const completedRaw = typeof req.query.completed === "string" ? req.query.completed : undefined;
    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : undefined;
    const hasDueDate =
      typeof req.query.hasDueDate === "string" && req.query.hasDueDate.trim().toLowerCase() === "true";
    const trackerStatuses = parseTrackerStatusParam(
      typeof req.query.trackerStatus === "string" ? req.query.trackerStatus : undefined,
    );

    const andFilters: Prisma.TaskWhereInput[] = [];

    const archivedRaw = typeof req.query.archived === "string" ? req.query.archived : undefined;
    if (archivedRaw === "true") {
      andFilters.push({ archivedAt: { not: null } });
    } else if (archivedRaw === "all") {
      // no archive filter
    } else {
      andFilters.push({ archivedAt: null });
    }

    if (subBoardId) {
      const sb = await prisma.boardList.findUnique({
        where: { id: subBoardId },
        select: { boardId: true },
      });
      if (!sb) {
        res.status(400).json({ error: "Unknown sub-board" });
        return;
      }
      const okBoard = await assertBoardAccess(user, sb.boardId);
      if (!okBoard) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      andFilters.push({ subBoardId });
    }

    if (projectSpaceId) {
      const okPs = await assertProjectSpaceAccess(user, projectSpaceId);
      if (!okPs) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      andFilters.push({ subBoard: { board: { projectSpaceId } } });
    }

    if (boardId) {
      const okBoard = await assertBoardAccess(user, boardId);
      if (!okBoard) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      andFilters.push({ subBoard: { is: { boardId } } });
    } else if (workspaceId) {
      const okWs = await assertWorkspaceAccess(user, workspaceId);
      if (!okWs) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      andFilters.push({
        subBoard: { is: { board: { is: { projectSpace: { is: { workspaceId } } } } } },
      });
    } else if (!subBoardId && !projectSpaceId) {
      const ids = await listAccessibleWorkspaceIds(user);
      if (ids.length === 0) {
        res.json([]);
        return;
      }
      andFilters.push({
        OR: ids.map((id) => ({
          subBoard: { is: { board: { is: { projectSpace: { is: { workspaceId: id } } } } } },
        })),
      });
    }
    if (chatThreadId) {
      andFilters.push({ chatThreadId });
    }
    if (assigneeUserId) {
      andFilters.push({ assigneeUserId });
    }
    if (createdByUserId) {
      andFilters.push({ createdByUserId });
    }
    if (dueBefore) {
      const d = new Date(dueBefore);
      if (!Number.isNaN(d.getTime())) andFilters.push({ dueDate: { lte: d } });
    }
    if (dueAfter) {
      const d = new Date(dueAfter);
      if (!Number.isNaN(d.getTime())) andFilters.push({ dueDate: { gte: d } });
    }
    if (hasDueDate) {
      andFilters.push({ dueDate: { not: null } });
    }
    if (trackerStatuses?.length) {
      if (trackerStatuses.length === 1 && trackerStatuses[0] === "DONE") {
        andFilters.push({
          OR: [{ trackerStatus: "DONE" }, { completed: true }],
        });
      } else {
        andFilters.push({ trackerStatus: { in: trackerStatuses } });
      }
    }
    if (q) {
      andFilters.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    if (labelIds.length) {
      andFilters.push({
        OR: labelIds.flatMap((lid) => [
          { labels: { some: { labelId: lid } } },
          { userBrandTicketLabels: { some: { userBrandTicketLabelId: lid } } },
        ]),
      });
    } else if (labelId) {
      andFilters.push({
        OR: [
          { labels: { some: { labelId } } },
          { userBrandTicketLabels: { some: { userBrandTicketLabelId: labelId } } },
        ],
      });
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

    let tasks;
    try {
      tasks = await prisma.task.findMany({
        where,
        orderBy: parseTaskListSort(sortRaw),
        include: buildTaskInclude(req.appUser!),
      });
    } catch (e) {
      console.error(
        "[task-app] GET /tasks full include failed; retrying without user ticket labels",
        e,
      );
      tasks = await prisma.task.findMany({
        where,
        orderBy: parseTaskListSort(sortRaw),
        include: buildTaskInclude(req.appUser!, false),
      });
    }
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
      subBoard: { board: { projectSpace: { workspaceId } } },
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
            subBoard: { select: { title: true, board: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    res.json(
      rows.map((row) => {
        const { actorUser, task, ...rest } = row;
        const sb = task?.subBoard;
        return {
          id: rest.id,
          actorUserId: rest.actorUserId,
          action: rest.action,
          detail: rest.detail,
          createdAt: rest.createdAt,
          actor: activityActorDto(actorUser),
          task: task
            ? {
                id: task.id,
                title: task.title,
                list: {
                  title: sb?.title ?? "",
                  board: sb?.board ?? { id: "", name: "" },
                },
              }
            : null,
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

    const accentColor = await nextBoardAccentColorForWorkspace(workspaceId);
    const board = await prisma.board.create({
      data: {
        projectSpaceId: ps.id,
        name: body.name?.trim() || resolved.templateName,
        position: (maxP._max.position ?? -1) + 1,
        accentColor,
        lists: {
          create: resolved.lists.map((l, position) => ({
            title: l.title,
            key: l.key,
            position,
            accentColor: BOARD_ACCENT_PALETTE[position % BOARD_ACCENT_PALETTE.length]!,
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
      /** Sub-board (`BoardList` id). */
      subBoardId?: string;
      /** @deprecated Same as `subBoardId` (legacy client field). */
      listId?: string;
      trackerStatus?: string;
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
    const titleTrim = body.title.trim();

    const boardRow = await prisma.board.findUnique({ where: { id: boardId } });
    if (!boardRow || boardRow.archivedAt) {
      res.status(400).json({ error: "Board not found or archived" });
      return;
    }

    const requestedSub = body.subBoardId ?? body.listId;
    let subBoardId = requestedSub;
    if (!subBoardId) {
      subBoardId = await getDefaultSubBoardIdForBoard(boardId);
    } else {
      const sb = await prisma.boardList.findFirst({
        where: { id: subBoardId, boardId },
      });
      if (!sb) {
        res.status(400).json({ error: "Invalid sub-board for this board" });
        return;
      }
    }

    let trackerStatus: TrackerStatus = "BACKLOG";
    if (body.trackerStatus && isTrackerStatus(body.trackerStatus)) {
      trackerStatus = body.trackerStatus;
    }

    const order = await firstOrderInLane(prisma, subBoardId, trackerStatus);

    const routingSource =
      typeof body.routingSource === "string" && body.routingSource.trim()
        ? body.routingSource.trim().slice(0, 64)
        : undefined;

    const actorId = req.appUser!.id;

    const brandIdForNum = await getBrandIdForBoardId(boardId);
    const [ticketNo] = brandIdForNum ? await allocateBrandTicketNumbers(brandIdForNum, 1) : [];

    const task = await prisma.task.create({
      data: {
        subBoardId,
        trackerStatus,
        title: titleTrim,
        description: typeof body.description === "string" ? body.description : "",
        ...(body.priority !== undefined &&
        typeof body.priority === "string" &&
        ["none", "low", "medium", "high"].includes(body.priority)
          ? { priority: body.priority }
          : {}),
        order,
        completed: trackerStatus === "DONE",
        ...(ticketNo !== undefined ? { brandTicketNumber: ticketNo } : {}),
        chatThreadId: body.chatThreadId ?? undefined,
        sourceMessageId: body.sourceMessageId ?? undefined,
        ...(routingSource ? { routingSource } : {}),
        createdByUserId: actorId,
        assigneeUserId: actorId,
        lastAssignedAt: new Date(),
      },
      include: buildTaskInclude(req.appUser!),
    });
    await prisma.ticketAssignmentEvent.create({
      data: {
        taskId: task.id,
        fromUserId: null,
        toUserId: actorId,
        actorUserId: actorId,
      },
    });
    await logActivity(task.id, actorId, "created", task.title);
    res.status(201).json(taskJsonForApi(task));
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
      /** @deprecated Use `subBoardId`. */
      listId?: string;
      subBoardId?: string;
      trackerStatus?: string;
      assigneeUserId?: string | null;
      cardFaceLayout?: string;
      /** null = inherit sub-board default for whether the done checkbox appears on the kanban card. */
      showCompleteCheckbox?: boolean | null;
      archived?: boolean;
    };

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      include: { subBoard: { select: { id: true, title: true, boardId: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const requestedSub = body.subBoardId ?? body.listId;
    let nextSubBoardId = existing.subBoardId;
    let nextTracker: TrackerStatus = existing.trackerStatus;
    let subDirty = false;
    let trackerDirty = false;

    if (requestedSub !== undefined && requestedSub !== existing.subBoardId) {
      const sb = await prisma.boardList.findUnique({ where: { id: requestedSub } });
      if (!sb || sb.boardId !== existing.subBoard.boardId) {
        res.status(400).json({ error: "Invalid sub-board" });
        return;
      }
      nextSubBoardId = requestedSub;
      subDirty = true;
    }

    if (body.trackerStatus !== undefined) {
      if (!isTrackerStatus(body.trackerStatus)) {
        res.status(400).json({ error: "Invalid trackerStatus" });
        return;
      }
      if (body.trackerStatus !== existing.trackerStatus) {
        nextTracker = body.trackerStatus;
        trackerDirty = true;
      }
    }

    const placementDirty = subDirty || trackerDirty;
    const nextOrder = placementDirty
      ? await nextOrderInLane(prisma, nextSubBoardId, nextTracker)
      : existing.order;

    const patch: Prisma.TaskUncheckedUpdateInput = {};
    if (body.archived === true) {
      patch.archivedAt = new Date();
    } else if (body.archived === false) {
      patch.archivedAt = null;
    }

    let assigneeUserIdNext: string | null | undefined = undefined;
    if (body.assigneeUserId !== undefined) {
      const raw = body.assigneeUserId;
      if (raw === null || raw === "") {
        assigneeUserIdNext = null;
      } else {
        const u = await prisma.appUser.findUnique({ where: { id: raw } });
        if (!u) {
          res.status(400).json({ error: "Unknown assignee" });
          return;
        }
        const brandId = await getBrandIdForBoardId(existing.subBoard.boardId);
        if (!brandId || !(await assertUserIsBrandParticipant(brandId, raw))) {
          res.status(400).json({
            error: "Assignee must be a teammate who has joined this board’s brand (owner or accepted invite).",
          });
          return;
        }
        assigneeUserIdNext = raw;
      }
    }

    const assigneeDirty =
      assigneeUserIdNext !== undefined && assigneeUserIdNext !== existing.assigneeUserId;

    if (placementDirty) {
      patch.subBoardId = nextSubBoardId;
      patch.trackerStatus = nextTracker;
      patch.order = nextOrder;
      if (body.archived !== true) {
        patch.archivedAt = null;
      }
    }
    if (assigneeDirty) {
      patch.assigneeUserId = assigneeUserIdNext!;
      patch.lastAssignedAt = new Date();
    }
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    {
      // Done swim lane ↔ completed: moving into Done checks the item; moving out of Done unchecks.
      // Card-only toggles (no tracker change) use body.completed. Those keep trackerStatus unchanged.
      const movingCompletedWithTracker =
        trackerDirty && (nextTracker === "DONE" || existing.trackerStatus === "DONE");
      if (trackerDirty) {
        if (nextTracker === "DONE") {
          patch.completed = true;
        } else if (existing.trackerStatus === "DONE") {
          patch.completed = false;
        }
      }
      if (body.completed !== undefined && !movingCompletedWithTracker) {
        patch.completed = body.completed;
      }
    }
    if (body.priority !== undefined) patch.priority = body.priority;
    if (body.dueDate !== undefined) patch.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.startDate !== undefined) patch.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.cardFaceLayout !== undefined && typeof body.cardFaceLayout === "string") {
      patch.cardFaceLayout = body.cardFaceLayout.trim().slice(0, 64);
    }
    if (Object.prototype.hasOwnProperty.call(body, "showCompleteCheckbox")) {
      const v = body.showCompleteCheckbox;
      if (v !== null && v !== undefined && typeof v !== "boolean") {
        res.status(400).json({ error: "Invalid showCompleteCheckbox" });
        return;
      }
      patch.showCompleteCheckbox = v ?? null;
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: patch,
      include: buildTaskInclude(req.appUser!),
    });

    const actorId = req.appUser!.id;
    if (subDirty) {
      const prevTitle = existing.subBoard.title;
      const nextSb = await prisma.boardList.findUnique({ where: { id: nextSubBoardId } });
      await logActivity(taskId, actorId, "sub_board_changed", `${prevTitle} → ${nextSb?.title ?? ""}`);
    }
    if (trackerDirty) {
      await logActivity(
        taskId,
        actorId,
        "tracker_status_changed",
        `${existing.trackerStatus} → ${nextTracker}`,
      );
    }
    if (assigneeDirty) {
      await prisma.ticketAssignmentEvent.create({
        data: {
          taskId,
          fromUserId: existing.assigneeUserId ?? null,
          toUserId: assigneeUserIdNext ?? null,
          actorUserId: actorId,
        },
      });
      await logActivity(taskId, actorId, "assignee_changed", "");
    }
    if (body.archived === true) {
      await logActivity(taskId, actorId, "archived", task.title);
    } else if (body.archived === false) {
      await logActivity(taskId, actorId, "unarchived", task.title);
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
    for (const laneKey of Object.keys(body.positions)) {
      const parsed = parseLaneKey(laneKey);
      if (!parsed || !listIds.has(parsed.subBoardId)) {
        res.status(400).json({ error: `Unknown lane ${laneKey}` });
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const [laneKey, taskIds] of Object.entries(body.positions!)) {
        const parsed = parseLaneKey(laneKey);
        if (!parsed) continue;
        const { subBoardId, trackerStatus } = parsed;
        let order = 0;
        for (const taskId of taskIds) {
          const prev = await tx.task.findFirst({
            where: { id: taskId, subBoard: { boardId }, archivedAt: null },
            select: { trackerStatus: true },
          });
          if (!prev) {
            order += 1;
            continue;
          }
          const data: Prisma.TaskUncheckedUpdateInput = {
            subBoardId,
            trackerStatus,
            order,
          };
          if (trackerStatus === "DONE") {
            data.completed = true;
          } else if (prev.trackerStatus === "DONE") {
            data.completed = false;
          }
          await tx.task.update({
            where: { id: taskId },
            data,
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
    const okBoard = await assertBoardAccess(req.appUser!, boardId);
    if (!okBoard) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const body = req.body as { name?: string; archived?: boolean; projectSpaceId?: string; accentColor?: string };
    const existing = await prisma.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        name: true,
        position: true,
        archivedAt: true,
        projectSpaceId: true,
        accentColor: true,
        projectSpace: { select: { workspaceId: true } },
      },
    });
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
    if (body.projectSpaceId !== undefined) {
      if (existing.archivedAt) {
        res.status(400).json({ error: "Cannot move an archived board" });
        return;
      }
      const nextPsId = String(body.projectSpaceId).trim();
      if (!nextPsId) {
        res.status(400).json({ error: "Invalid projectSpaceId" });
        return;
      }
      if (nextPsId !== existing.projectSpaceId) {
        const okPs = await assertProjectSpaceAccess(req.appUser!, nextPsId);
        if (!okPs) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        const targetSpace = await prisma.projectSpace.findFirst({
          where: {
            id: nextPsId,
            workspaceId: existing.projectSpace.workspaceId,
            archivedAt: null,
          },
          select: { id: true },
        });
        if (!targetSpace) {
          res.status(400).json({ error: "Project space not found in this workspace" });
          return;
        }
        const maxPos = await prisma.board.aggregate({
          where: { projectSpaceId: nextPsId, archivedAt: null },
          _max: { position: true },
        });
        const nextPosition = (maxPos._max.position ?? -1) + 1;
        data.projectSpace = { connect: { id: nextPsId } };
        data.position = nextPosition;
      }
    }
    if (body.accentColor !== undefined) {
      const c = sanitizeBoardAccentColor(body.accentColor);
      if (!c) {
        res.status(400).json({ error: "Invalid accentColor" });
        return;
      }
      const prev = String(existing.accentColor).toLowerCase();
      if (c !== prev) {
        data.accentColor = c;
      }
    }
    if (Object.keys(data).length === 0) {
      if (
        body.projectSpaceId !== undefined &&
        String(body.projectSpaceId).trim() === existing.projectSpaceId
      ) {
        const boardNoop = await findBoardWithApiInclude(boardId, req.appUser!);
        res.json(boardJsonForApi(boardNoop));
        return;
      }
      const noopAccent =
        body.accentColor !== undefined &&
        sanitizeBoardAccentColor(body.accentColor) === String(existing.accentColor).toLowerCase();
      if (noopAccent) {
        const boardNoop = await findBoardWithApiInclude(boardId, req.appUser!);
        res.json(boardJsonForApi(boardNoop));
        return;
      }
      res.status(400).json({ error: "No updates" });
      return;
    }
    let board;
    try {
      board = await prisma.board.update({
        where: { id: boardId },
        data,
        include: buildBoardIncludeFull(req.appUser!),
      });
    } catch (e) {
      console.error("[task-app] PATCH /boards/:boardId full include failed; retrying", e);
      await prisma.board.update({ where: { id: boardId }, data });
      board = await findBoardWithApiInclude(boardId, req.appUser!);
    }
    res.json(boardJsonForApi(board));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update board" });
  }
});

/** Copy column layout and board labels into a new board in the same project space (no tasks). */
router.post("/boards/:boardId/duplicate", async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const ok = await assertBoardAccess(req.appUser!, boardId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const body = req.body as { name?: string } | undefined;
    const source = await prisma.board.findUnique({
      where: { id: boardId },
      select: {
        name: true,
        archivedAt: true,
        projectSpaceId: true,
        projectSpace: {
          select: {
            archivedAt: true,
            workspaceId: true,
            workspace: { select: { archivedAt: true } },
          },
        },
        lists: { orderBy: { position: "asc" }, select: { title: true, key: true } },
        labels: { orderBy: { name: "asc" }, select: { name: true, color: true } },
      },
    });
    if (!source) {
      res.status(404).json({ error: "Board not found" });
      return;
    }
    if (
      source.archivedAt !== null ||
      source.projectSpace.archivedAt !== null ||
      source.projectSpace.workspace.archivedAt !== null
    ) {
      res.status(400).json({ error: "Cannot duplicate an archived board or board in an archived space" });
      return;
    }
    if (source.lists.length === 0) {
      res.status(400).json({ error: "Board has no columns to duplicate" });
      return;
    }
    const nextName = body?.name?.trim() || `${source.name} (copy)`;
    const maxP = await prisma.board.aggregate({
      where: { projectSpaceId: source.projectSpaceId, archivedAt: null },
      _max: { position: true },
    });
    const dupAccent = await nextBoardAccentColorForWorkspace(source.projectSpace.workspaceId);
    const labelCreates =
      source.labels.length > 0
        ? source.labels.map((l) => ({ name: l.name, color: l.color }))
        : DEFAULT_TEMPLATE_LABELS.map((l) => ({ name: l.name, color: l.color }));
    const created = await prisma.board.create({
      data: {
        projectSpaceId: source.projectSpaceId,
        name: nextName,
        position: (maxP._max.position ?? -1) + 1,
        accentColor: dupAccent,
        lists: {
          create: source.lists.map((l, position) => ({
            title: l.title,
            key: l.key,
            position,
            accentColor: BOARD_ACCENT_PALETTE[position % BOARD_ACCENT_PALETTE.length]!,
          })),
        },
        labels: { create: labelCreates },
      },
      select: { id: true },
    });
    const duplicated = await findBoardWithApiInclude(created.id, req.appUser!);
    if (!duplicated) {
      res.status(500).json({ error: "Failed to load duplicated board" });
      return;
    }
    res.status(201).json(boardJsonForApi(duplicated));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to duplicate board" });
  }
});

router.post("/boards/:boardId/labels", async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const body = req.body as { name?: unknown; color?: unknown };
    const name = sanitizeUserTicketLabelName(body.name);
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const color = sanitizeUserTicketLabelColor(body.color);
    const dup = await prisma.label.findFirst({
      where: { boardId, name: { equals: name, mode: "insensitive" } },
    });
    if (dup) {
      res.status(409).json({ error: "A board label with this name already exists" });
      return;
    }
    await prisma.label.create({ data: { boardId, name, color } });
    const board = await findBoardWithApiInclude(boardId, req.appUser!);
    if (!board) {
      res.status(404).json({ error: "Board not found" });
      return;
    }
    res.status(201).json(boardJsonForApi(board));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create board label" });
  }
});

router.patch("/boards/:boardId/lists/:listId", async (req, res) => {
  try {
    const { boardId, listId } = req.params;
    const body = req.body as { title?: string; accentColor?: string };
    const boardCheck = await prisma.board.findUnique({ where: { id: boardId } });
    if (!boardCheck || boardCheck.archivedAt) {
      res.status(400).json({ error: "Board not found or archived" });
      return;
    }
    const list = await prisma.boardList.findFirst({
      where: { id: listId, boardId },
      select: { id: true, title: true, accentColor: true },
    });
    if (!list) {
      res.status(404).json({ error: "List not found" });
      return;
    }
    if (body.title !== undefined && !String(body.title).trim()) {
      res.status(400).json({ error: "title cannot be empty" });
      return;
    }
    const data: Prisma.BoardListUpdateInput = {};
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (t !== list.title) {
        data.title = t;
      }
    }
    if (body.accentColor !== undefined) {
      const c = sanitizeBoardAccentColor(body.accentColor);
      if (!c) {
        res.status(400).json({ error: "Invalid accentColor" });
        return;
      }
      if (c !== String(list.accentColor).toLowerCase()) {
        data.accentColor = c;
      }
    }
    if (Object.keys(data).length === 0) {
      const board = await findBoardWithApiInclude(boardId, req.appUser!);
      res.json(boardJsonForApi(board));
      return;
    }
    await prisma.boardList.update({
      where: { id: listId },
      data,
    });
    const board = await findBoardWithApiInclude(boardId, req.appUser!);
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
        where: { subBoardId: listId },
        orderBy: { order: "asc" },
      });
      let nextOrder =
        (await tx.task.aggregate({
          where: { subBoardId: targetList.id, trackerStatus: "BACKLOG", archivedAt: null },
          _max: { order: true },
        }))._max.order ?? -1;
      nextOrder += 1;
      for (const task of tasksToMove) {
        await tx.task.update({
          where: { id: task.id },
          data: {
            subBoardId: targetList.id,
            trackerStatus: "BACKLOG",
            order: nextOrder++,
          },
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

    const board = await findBoardWithApiInclude(boardId, req.appUser!);
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
    const accentColor = await nextSubBoardAccentColorForBoard(boardId);
    const list = await prisma.boardList.create({
      data: {
        boardId,
        title: body.title.trim(),
        position: (maxP._max.position ?? -1) + 1,
        accentColor,
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
      data: { taskId, body: body.body.trim(), authorUserId: req.appUser!.id },
      include: { author: { select: activityActorSelect } },
    });
    await logActivity(taskId, req.appUser!.id, "comment", "");
    const { author, ...commentRest } = comment;
    res.status(201).json({ ...commentRest, author: activityActorDto(author) });
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

router.get("/brands/:brandId/label-suggestions", async (req, res) => {
  try {
    const brandId = req.params.brandId;
    if (!(await assertBrandAccess(req.appUser!, brandId))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const uid = req.appUser!.id;

    const boardRows = await prisma.label.findMany({
      where: { board: { projectSpace: { workspace: { brandId } } } },
      select: {
        id: true,
        name: true,
        color: true,
        boardId: true,
        _count: { select: { tasks: true } },
      },
    });
    const userRows = await prisma.userBrandTicketLabel.findMany({
      where: { userId: uid, brandId },
      select: {
        id: true,
        name: true,
        color: true,
        _count: { select: { taskLinks: true } },
      },
    });

    type Pick = {
      scope: "board" | "user";
      id: string;
      name: string;
      color: string;
      boardId?: string;
      count: number;
    };
    const combined: Pick[] = [
      ...boardRows.map((r) => ({
        scope: "board" as const,
        id: r.id,
        name: r.name,
        color: r.color,
        boardId: r.boardId,
        count: r._count.tasks,
      })),
      ...userRows.map((r) => ({
        scope: "user" as const,
        id: r.id,
        name: r.name,
        color: r.color,
        count: r._count.taskLinks,
      })),
    ];
    combined.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const frequent = combined.slice(0, 4).map(({ count: _c, ...rest }) => rest);
    const frequentId = new Set(frequent.map((f) => `${f.scope}:${f.id}`));

    type RowRec = {
      id: string;
      scope: string;
      name: string;
      color: string;
      boardId: string | null;
      lastu: Date;
    };
    const boardRecent = await prisma.$queryRaw<RowRec[]>`
      SELECT l.id, 'board' AS scope, l.name, l.color, l."boardId", MAX(t."updatedAt") AS "lastu"
      FROM "Label" l
      INNER JOIN "TaskLabel" tl ON tl."labelId" = l.id
      INNER JOIN "Task" t ON t.id = tl."taskId"
      INNER JOIN "BoardList" bl ON bl.id = t."subBoardId"
      INNER JOIN "Board" b ON b.id = bl."boardId"
      INNER JOIN "ProjectSpace" ps ON ps.id = b."projectSpaceId"
      INNER JOIN "Workspace" w ON w.id = ps."workspaceId"
      WHERE w."brandId" = ${brandId}
      GROUP BY l.id, l.name, l.color, l."boardId"
    `;
    const userRecent = await prisma.$queryRaw<RowRec[]>`
      SELECT u.id, 'user' AS scope, u.name, u.color, NULL::text AS "boardId", MAX(t."updatedAt") AS "lastu"
      FROM "UserBrandTicketLabel" u
      INNER JOIN "TaskUserBrandTicketLabel" link ON link."userBrandTicketLabelId" = u.id
      INNER JOIN "Task" t ON t.id = link."taskId"
      INNER JOIN "BoardList" bl ON bl.id = t."subBoardId"
      INNER JOIN "Board" b ON b.id = bl."boardId"
      INNER JOIN "ProjectSpace" ps ON ps.id = b."projectSpaceId"
      INNER JOIN "Workspace" w ON w.id = ps."workspaceId"
      WHERE w."brandId" = ${brandId} AND u."userId" = ${uid}
      GROUP BY u.id, u.name, u.color
    `;
    const merged = [...boardRecent, ...userRecent]
      .filter((r) => !frequentId.has(`${r.scope}:${r.id}`))
      .sort((a, b) => b.lastu.getTime() - a.lastu.getTime());
    const seen = new Set<string>();
    const recentOut: { scope: "board" | "user"; id: string; name: string; color: string; boardId?: string }[] = [];
    for (const r of merged) {
      const key = `${r.scope}:${r.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (r.scope === "user") {
        recentOut.push({ scope: "user", id: r.id, name: r.name, color: r.color });
      } else {
        recentOut.push({
          scope: "board",
          id: r.id,
          name: r.name,
          color: r.color,
          ...(r.boardId ? { boardId: r.boardId } : {}),
        });
      }
      if (recentOut.length >= 4) break;
    }

    res.json({ frequent, recent: recentOut });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load label suggestions" });
  }
});

router.get("/brands/:brandId/my-ticket-labels", async (req, res) => {
  try {
    const brandId = req.params.brandId;
    const rows = await prisma.userBrandTicketLabel.findMany({
      where: { userId: req.appUser!.id, brandId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, updatedAt: true },
    });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list ticket labels" });
  }
});

router.post("/brands/:brandId/my-ticket-labels", async (req, res) => {
  try {
    const brandId = req.params.brandId;
    const body = req.body as { name?: unknown; color?: unknown };
    const name = sanitizeUserTicketLabelName(body.name);
    if (!name) {
      res.status(400).json({ error: "Invalid name" });
      return;
    }
    const color = sanitizeUserTicketLabelColor(body.color);
    const row = await prisma.userBrandTicketLabel.create({
      data: { userId: req.appUser!.id, brandId, name, color },
      select: { id: true, name: true, color: true, updatedAt: true },
    });
    res.status(201).json(row);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      res.status(409).json({ error: "A label with this name already exists for this brand" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Failed to create ticket label" });
  }
});

router.patch("/brands/:brandId/my-ticket-labels/:labelId", async (req, res) => {
  try {
    const { brandId, labelId } = req.params;
    const body = req.body as { name?: unknown; color?: unknown };
    const existing = await prisma.userBrandTicketLabel.findFirst({
      where: { id: labelId, userId: req.appUser!.id, brandId },
    });
    if (!existing) {
      res.status(404).json({ error: "Label not found" });
      return;
    }
    const patch: Prisma.UserBrandTicketLabelUpdateInput = {};
    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      const name = sanitizeUserTicketLabelName(body.name);
      if (!name) {
        res.status(400).json({ error: "Invalid name" });
        return;
      }
      patch.name = name;
    }
    if (Object.prototype.hasOwnProperty.call(body, "color")) {
      patch.color = sanitizeUserTicketLabelColor(body.color);
    }
    const row = await prisma.userBrandTicketLabel.update({
      where: { id: labelId },
      data: patch,
      select: { id: true, name: true, color: true, updatedAt: true },
    });
    res.json(row);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      res.status(409).json({ error: "A label with this name already exists for this brand" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Failed to update ticket label" });
  }
});

router.delete("/brands/:brandId/my-ticket-labels/:labelId", async (req, res) => {
  try {
    const { brandId, labelId } = req.params;
    const n = await prisma.userBrandTicketLabel.deleteMany({
      where: { id: labelId, userId: req.appUser!.id, brandId },
    });
    if (n.count === 0) {
      res.status(404).json({ error: "Label not found" });
      return;
    }
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete ticket label" });
  }
});

router.post("/tasks/:taskId/my-ticket-labels", async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const body = req.body as { userBrandTicketLabelId?: string };
    if (!body.userBrandTicketLabelId) {
      res.status(400).json({ error: "userBrandTicketLabelId required" });
      return;
    }
    const label = await prisma.userBrandTicketLabel.findFirst({
      where: { id: body.userBrandTicketLabelId, userId: req.appUser!.id },
    });
    if (!label) {
      res.status(404).json({ error: "Label not found" });
      return;
    }
    const taskBrandId = await taskBrandIdForUserLabel(taskId);
    if (!taskBrandId || taskBrandId !== label.brandId) {
      res.status(400).json({ error: "Label brand does not match task workspace" });
      return;
    }
    await prisma.taskUserBrandTicketLabel.upsert({
      where: {
        taskId_userBrandTicketLabelId: { taskId, userBrandTicketLabelId: label.id },
      },
      create: { taskId, userBrandTicketLabelId: label.id },
      update: {},
    });
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: buildTaskInclude(req.appUser!),
    });
    res.json(taskJsonForApi(task));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to add ticket label" });
  }
});

router.delete("/tasks/:taskId/my-ticket-labels/:userBrandTicketLabelId", async (req, res) => {
  try {
    const { taskId, userBrandTicketLabelId } = req.params;
    const label = await prisma.userBrandTicketLabel.findFirst({
      where: { id: userBrandTicketLabelId, userId: req.appUser!.id },
    });
    if (!label) {
      res.status(404).json({ error: "Label not found" });
      return;
    }
    await prisma.taskUserBrandTicketLabel.deleteMany({
      where: { taskId, userBrandTicketLabelId },
    });
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: buildTaskInclude(req.appUser!),
    });
    res.json(taskJsonForApi(task));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to remove ticket label" });
  }
});

export default router;
