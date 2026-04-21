import type { Prisma } from "@prisma/client";
import { Router } from "express";
import {
  BOARD_TEMPLATES,
  DEFAULT_TEMPLATE_LABELS,
  type BoardTemplateList,
} from "../lib/boardTemplates.js";
import { prisma } from "../lib/db.js";
import { ensureDefaultWorkspaceBoard, getBacklogListId } from "../lib/taskDefaults.js";

const router = Router();

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
  _workspaceId: string,
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
  const lists = parseTemplateListsPayload(row.lists);
  if (!lists) return null;
  return { templateName: row.name, lists };
}

const taskInclude = {
  list: {
    select: {
      id: true,
      title: true,
      key: true,
      position: true,
      boardId: true,
      board: { select: { id: true, name: true, workspaceId: true } },
    },
  },
  ideaNode: { select: { id: true, title: true } },
  labels: { include: { label: true } },
  comments: { orderBy: { createdAt: "asc" as const } },
  checklist: { orderBy: { position: "asc" as const } },
  activities: { orderBy: { createdAt: "desc" as const }, take: 30 },
} as const;

/** Kanban and API responses only surface non-archived tasks on a board. */
const activeTaskWhere: Prisma.TaskWhereInput = { archivedAt: null };

const boardIncludeBootstrap = {
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

const boardIncludeFull = {
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
          activities: { orderBy: { createdAt: "desc" as const }, take: 20 },
        },
      },
    },
  },
  labels: { orderBy: { name: "asc" as const } },
} as const;

const boardIncludePositions = {
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

async function logActivity(taskId: string, action: string, detail = "") {
  await prisma.activity.create({ data: { taskId, action, detail } });
}

router.get("/bootstrap", async (_req, res) => {
  try {
    const { workspace, board } = await ensureDefaultWorkspaceBoard();
    const fullBoard = await prisma.board.findUnique({
      where: { id: board.id },
      include: boardIncludeBootstrap,
    });
    res.json({ workspace, board: fullBoard });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Bootstrap failed" });
  }
});

router.get("/workspaces", async (_req, res) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: { archivedAt: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        boards: {
          where: { archivedAt: null },
          orderBy: { position: "asc" },
          select: { id: true, name: true, position: true },
        },
      },
    });
    res.json(workspaces);
  } catch {
    res.status(500).json({ error: "Failed to list workspaces" });
  }
});

router.get("/workspaces/archived", async (_req, res) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: { archivedAt: { not: null } },
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
      where: { workspaceId, archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
      select: { id: true, name: true, position: true, archivedAt: true },
    });
    res.json({ boards });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list archived boards" });
  }
});

router.get("/boards/:boardId", async (req, res) => {
  try {
    const board = await prisma.board.findUnique({
      where: { id: req.params.boardId },
      include: boardIncludeFull,
    });
    if (!board) {
      res.status(404).json({ error: "Board not found" });
      return;
    }
    res.json(board);
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
      andFilters.push({ list: { is: { boardId } } });
    } else if (workspaceId) {
      andFilters.push({ list: { is: { board: { is: { workspaceId } } } } });
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
      include: taskInclude,
    });
    res.json(tasks);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

router.get("/workspaces/:workspaceId/activity-feed", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const rows = await prisma.activity.findMany({
      where: {
        task: { archivedAt: null, list: { board: { workspaceId } } },
      },
      orderBy: { createdAt: "desc" },
      take: 120,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            list: { select: { title: true, board: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load activity feed" });
  }
});

router.get("/board-templates", async (_req, res) => {
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
    const customs = await prisma.customBoardTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: { workspace: { select: { name: true } } },
    });
    const customSummaries = customs.map((c) => {
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
    res.json([...builtins, ...customSummaries]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list templates" });
  }
});

router.post("/board-templates", async (req, res) => {
  try {
    const body = req.body as { name?: string; description?: string; lists?: unknown };
    if (!body.name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const lists = parseTemplateListsPayload(body.lists);
    if (!lists) {
      res.status(400).json({ error: "lists must be a non-empty array of { title, key? }" });
      return;
    }
    const created = await prisma.customBoardTemplate.create({
      data: {
        workspaceId: null,
        name: body.name.trim(),
        description: body.description?.trim() ?? "",
        lists: lists as unknown as Prisma.InputJsonValue,
      },
    });
    res.status(201).json({
      id: created.id,
      name: created.name,
      description: created.description,
      listCount: lists.length,
      isBuiltin: false,
      workspaceId: null as string | null,
      workspaceName: null as string | null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create template" });
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
    await prisma.customBoardTemplate.delete({ where: { id: templateId } });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

router.post("/workspaces", async (req, res) => {
  try {
    const body = req.body as { name?: string };
    if (!body.name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const maxPos = await prisma.workspace.aggregate({
      where: { archivedAt: null },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;
    const ws = await prisma.workspace.create({
      data: { name: body.name.trim(), position },
    });
    res.status(201).json(ws);
  } catch {
    res.status(500).json({ error: "Failed to create workspace" });
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
      const name = body.name.trim();
      if (!name) {
        res.status(400).json({ error: "name cannot be empty" });
        return;
      }
      await prisma.workspace.update({ where: { id: workspaceId }, data: { name } });
    }
    if (body.archived === true) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { archivedAt: new Date() },
      });
    } else if (body.archived === false) {
      const maxPos = await prisma.workspace.aggregate({
        where: { archivedAt: null },
        _max: { position: true },
      });
      const position = (maxPos._max.position ?? -1) + 1;
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { archivedAt: null, position },
      });
    }
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        boards: {
          where: { archivedAt: null },
          orderBy: { position: "asc" },
          select: { id: true, name: true, position: true },
        },
      },
    });
    res.json(ws);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update workspace" });
  }
});

router.post("/workspaces/reorder", async (req, res) => {
  try {
    const body = req.body as { orderedIds?: string[] };
    if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
      res.status(400).json({ error: "orderedIds is required" });
      return;
    }
    const active = await prisma.workspace.findMany({
      where: { archivedAt: null },
      select: { id: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const activeIds = active.map((w) => w.id);
    if (body.orderedIds.length !== activeIds.length) {
      res.status(400).json({ error: "orderedIds must include every active workspace exactly once" });
      return;
    }
    const setFromPayload = new Set(body.orderedIds);
    if (setFromPayload.size !== body.orderedIds.length) {
      res.status(400).json({ error: "duplicate id in orderedIds" });
      return;
    }
    for (const id of activeIds) {
      if (!setFromPayload.has(id)) {
        res.status(400).json({ error: "orderedIds must match active workspaces" });
        return;
      }
    }
    await prisma.$transaction(
      body.orderedIds.map((id, index) =>
        prisma.workspace.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to reorder workspaces" });
  }
});

router.post("/workspaces/:workspaceId/boards/from-template", async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const body = req.body as { templateId?: string; name?: string };
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

    const resolved = await resolveWorkspaceTemplate(workspaceId, body.templateId);
    if (!resolved) {
      res.status(404).json({ error: "Unknown template" });
      return;
    }

    const maxP = await prisma.board.aggregate({
      where: { workspaceId, archivedAt: null },
      _max: { position: true },
    });

    const board = await prisma.board.create({
      data: {
        workspaceId,
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
        lists: { orderBy: { position: "asc" } },
        labels: { orderBy: { name: "asc" } },
      },
    });

    res.status(201).json(board);
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
      },
      include: taskInclude,
    });
    await logActivity(task.id, "created", task.title);
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
        include: taskInclude,
      });
      await logActivity(taskId, "moved", list.title);
      res.json(task);
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
      include: taskInclude,
    });
    if (body.archived === true) {
      await logActivity(taskId, "archived", task.title);
    } else if (body.archived === false) {
      await logActivity(taskId, "unarchived", task.title);
    }
    res.json(task);
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
    res.json(board);
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
      include: boardIncludeFull,
    });
    res.json(board);
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
      include: boardIncludeFull,
    });
    res.json(board);
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
      include: boardIncludeFull,
    });
    res.json(board);
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
    res.json(board);
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
    await logActivity(taskId, "comment", "");
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
      include: taskInclude,
    });
    res.json(task);
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
      include: taskInclude,
    });
    res.json(task);
  } catch {
    res.status(500).json({ error: "Failed to remove label" });
  }
});

export default router;
