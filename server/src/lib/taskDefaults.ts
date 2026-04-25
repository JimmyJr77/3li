import { randomUUID } from "node:crypto";
import { prisma } from "./db.js";
import type { AppUserPrincipal } from "./auth/workspaceScope.js";
import { workspaceWhereForAppUser } from "./auth/workspaceScope.js";
import { defaultWorkspaceTitleFromBrandName } from "./workspaceLimits.js";

const DEFAULT_LISTS: { title: string; key: string; position: number }[] = [
  { title: "Backlog", key: "backlog", position: 0 },
  { title: "In progress", key: "in_progress", position: 1 },
  { title: "Done", key: "done", position: 2 },
];

/** Ensures the three default columns exist (handles boards created before lists existed). */
export async function ensureBoardLists(boardId: string) {
  for (const l of DEFAULT_LISTS) {
    await prisma.boardList.upsert({
      where: {
        boardId_key: { boardId, key: l.key },
      },
      create: {
        boardId,
        title: l.title,
        key: l.key,
        position: l.position,
      },
      update: {},
    });
  }
}

/**
 * Ensures the default project space + main board for a specific brand workspace.
 * Does not insert demo tasks or other seeded content — new brands start empty (lists/labels only when a board is created).
 */
export async function ensureDefaultBoardForWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, archivedAt: null },
    include: { brand: true },
  });
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  let projectSpace = await prisma.projectSpace.findFirst({
    where: { workspaceId: workspace.id, archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { position: "asc" }, { createdAt: "asc" }],
  });
  if (!projectSpace) {
    projectSpace = await prisma.projectSpace.create({
      data: {
        workspaceId: workspace.id,
        name: "Primary project space",
        position: 0,
        isDefault: true,
      },
    });
  }

  const existingBoard = await prisma.board.findFirst({
    where: { projectSpaceId: projectSpace.id, archivedAt: null },
    orderBy: { position: "asc" },
  });

  let board: NonNullable<typeof existingBoard>;
  if (!existingBoard) {
    board = await prisma.board.create({
      data: {
        projectSpaceId: projectSpace.id,
        name: "Main project board",
        position: 0,
      },
    });
    await prisma.boardList.createMany({
      data: DEFAULT_LISTS.map((l) => ({
        boardId: board.id,
        title: l.title,
        key: l.key,
        position: l.position,
      })),
    });
    await prisma.label.createMany({
      data: [
        { boardId: board.id, name: "Bug", color: "#ef4444" },
        { boardId: board.id, name: "Feature", color: "#22c55e" },
        { boardId: board.id, name: "Chore", color: "#64748b" },
      ],
    });
  } else {
    board = existingBoard;
    await ensureBoardLists(board.id);
  }

  return { workspace, board };
}

/** First accessible workspace for this account, or a new owned brand + workspace + default board. */
export async function ensurePersonalWorkspaceBoard(user: AppUserPrincipal) {
  let workspace = await prisma.workspace.findFirst({
    where: {
      archivedAt: null,
      brand: { archivedAt: null, ownerUserId: user.id },
    },
    orderBy: [{ brand: { position: "asc" } }, { createdAt: "asc" }],
    include: { brand: true },
  });

  if (!workspace && user.role === "admin") {
    workspace = await prisma.workspace.findFirst({
      where: workspaceWhereForAppUser(user),
      orderBy: [{ brand: { position: "asc" } }, { createdAt: "asc" }],
      include: { brand: true },
    });
  }

  if (!workspace) {
    const maxPos = await prisma.brand.aggregate({
      where: { archivedAt: null },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;
    const userRow = await prisma.appUser.findUnique({ where: { id: user.id } });
    const fromNames = [userRow?.firstName, userRow?.lastName].filter(Boolean).join(" ").trim();
    const rawLabel =
      userRow?.displayName?.trim() ||
      fromNames ||
      (userRow?.username
        ? `${userRow.username.slice(0, 1).toUpperCase()}${userRow.username.slice(1)}`
        : "Workspace");
    const brandName = rawLabel.slice(0, 80);
    const brand = await prisma.brand.create({
      data: { position, name: brandName, ownerUserId: user.id, joinKey: randomUUID() },
    });
    workspace = await prisma.workspace.create({
      data: { name: defaultWorkspaceTitleFromBrandName(brand.name), brandId: brand.id },
      include: { brand: true },
    });
  }

  return ensureDefaultBoardForWorkspace(workspace.id);
}

/** Default sub-board for new tickets: backlog column if present, else first sub-board on the board. */
export async function getDefaultSubBoardIdForBoard(boardId: string): Promise<string> {
  const lists = await prisma.boardList.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
  });
  const backlog = lists.find((l) => l.key === "backlog");
  if (backlog) return backlog.id;
  const first = lists[0];
  if (!first) {
    throw new Error("No sub-boards on board");
  }
  return first.id;
}

/** @deprecated Alias for older call sites — returns a `BoardList` id (sub-board). */
export const getBacklogListId = getDefaultSubBoardIdForBoard;
