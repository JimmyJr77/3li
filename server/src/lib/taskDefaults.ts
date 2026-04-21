import { prisma } from "./db.js";
import { ensureTaskflowShowcase } from "./showcaseSeed.js";

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

export async function ensureDefaultWorkspaceBoard() {
  let workspace = await prisma.workspace.findFirst({
    where: { archivedAt: null },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({ data: { name: "My Project", position: 0 } });
  }

  const existingBoard = await prisma.board.findFirst({
    where: { workspaceId: workspace.id, archivedAt: null },
    orderBy: { position: "asc" },
  });

  let board: NonNullable<typeof existingBoard>;
  if (!existingBoard) {
    board = await prisma.board.create({
      data: {
        workspaceId: workspace.id,
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

  await ensureTaskflowShowcase(board.id);

  return { workspace, board };
}

export async function getBacklogListId(boardId: string) {
  const list = await prisma.boardList.findFirst({
    where: { boardId, key: "backlog" },
  });
  if (!list) {
    throw new Error("Backlog list not found for board");
  }
  return list.id;
}
