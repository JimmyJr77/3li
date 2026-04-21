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

/** Workspace + default folder; reuses TaskFoundry bootstrap so a workspace always exists. */
export async function ensureNotesBootstrap() {
  const { workspace } = await ensureDefaultWorkspaceBoard();
  const defaultFolder = await ensureDefaultNotesFolder(workspace.id);
  return { workspace, defaultFolder };
}
