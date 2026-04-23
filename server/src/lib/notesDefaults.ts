import { prisma } from "./db.js";
import { ensureDefaultWorkspaceBoard } from "./taskDefaults.js";

/** Ensures the first workspace has a default top-level notes folder for Notebooks. */
export async function ensureDefaultNotesFolder(workspaceId: string) {
  let folder = await prisma.notesFolder.findFirst({
    where: { workspaceId, parentId: null },
    orderBy: { position: "asc" },
  });
  if (!folder) {
    folder = await prisma.notesFolder.create({
      data: {
        workspaceId,
        title: "Notes",
        position: 0,
      },
    });
  }
  return folder;
}

const QUICKNOTES_FOLDER_TITLE = "Quicknotes";

/** Top-level notebook used for Quick Capture (⌘⇧C) saves. Created if missing. */
export async function ensureQuicknotesFolder(workspaceId: string) {
  const existing = await prisma.notesFolder.findFirst({
    where: { workspaceId, parentId: null, title: QUICKNOTES_FOLDER_TITLE },
  });
  if (existing) return existing;

  const maxPos = await prisma.notesFolder.aggregate({
    where: { workspaceId, parentId: null },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  return prisma.notesFolder.create({
    data: {
      workspaceId,
      parentId: null,
      title: QUICKNOTES_FOLDER_TITLE,
      position,
    },
  });
}

/** Workspace + default folder; reuses TaskFoundry bootstrap so a workspace always exists. */
export async function ensureNotesBootstrap() {
  const { workspace } = await ensureDefaultWorkspaceBoard();
  const defaultFolder = await ensureDefaultNotesFolder(workspace.id);
  await ensureQuicknotesFolder(workspace.id);
  return { workspace, defaultFolder };
}
