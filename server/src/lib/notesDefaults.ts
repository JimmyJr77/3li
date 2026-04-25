import type { NotesFolder } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { AppUserPrincipal } from "./auth/workspaceScope.js";
import { prisma } from "./db.js";
import { ensurePersonalWorkspaceBoard } from "./taskDefaults.js";
import { DEFAULT_NOTE_BASE } from "./sequencedDefaultTitle.js";
import { DEFAULT_NOTEBOOK_TITLE, QUICKNOTES_NOTEBOOK_TITLE } from "./notebookConstants.js";

const LEGACY_NOTES_FOLDER_TITLE = "Notes";

/** Empty TipTap doc for seeded notes (delete-last-note recovery, bootstrap). */
export const STARTER_NOTE_CONTENT_JSON: Prisma.InputJsonValue = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/**
 * Ensures top-level notebooks: Quicknotes (position 0, quick capture) and Notebook (position 1, default).
 * Renames legacy "Notes" → "Notebook" when no Notebook exists yet.
 * If the workspace has no notes, creates a starter note titled "Note" in Notebook.
 */
export async function syncNotesWorkspaceFolderDefaults(
  workspaceId: string,
): Promise<{ notebook: NotesFolder; quicknotes: NotesFolder }> {
  await prisma.$transaction(async (tx) => {
    const refetchTops = () =>
      tx.notesFolder.findMany({
        where: { workspaceId, parentId: null },
        orderBy: { position: "asc" },
      });

    let tops = await refetchTops();

    const hasNotebookTitle = tops.some((f) => f.title === DEFAULT_NOTEBOOK_TITLE);
    if (!hasNotebookTitle) {
      const legacyNotes = tops.filter((f) => f.title === LEGACY_NOTES_FOLDER_TITLE);
      if (legacyNotes.length === 1) {
        await tx.notesFolder.update({
          where: { id: legacyNotes[0]!.id },
          data: { title: DEFAULT_NOTEBOOK_TITLE },
        });
        tops = await refetchTops();
      }
    }

    if (!tops.some((f) => f.title === QUICKNOTES_NOTEBOOK_TITLE)) {
      await tx.notesFolder.create({
        data: {
          workspaceId,
          parentId: null,
          title: QUICKNOTES_NOTEBOOK_TITLE,
          position: 9999,
        },
      });
      tops = await refetchTops();
    }

    if (!tops.some((f) => f.title === DEFAULT_NOTEBOOK_TITLE)) {
      await tx.notesFolder.create({
        data: {
          workspaceId,
          parentId: null,
          title: DEFAULT_NOTEBOOK_TITLE,
          position: 9998,
        },
      });
      tops = await refetchTops();
    }

    const quickFolder = tops.find((f) => f.title === QUICKNOTES_NOTEBOOK_TITLE);
    const notebookFolder = tops.find((f) => f.title === DEFAULT_NOTEBOOK_TITLE);
    if (!quickFolder || !notebookFolder) {
      throw new Error("notesDefaults: failed to ensure Quicknotes and Notebook folders");
    }

    const rest = tops.filter((f) => f.id !== quickFolder.id && f.id !== notebookFolder.id);
    const ordered = [quickFolder, notebookFolder, ...rest];

    for (let i = 0; i < ordered.length; i += 1) {
      await tx.notesFolder.update({
        where: { id: ordered[i]!.id },
        data: { position: i },
      });
    }

    const noteCount = await tx.note.count({ where: { workspaceId } });
    if (noteCount === 0) {
      await tx.note.create({
        data: {
          workspaceId,
          folderId: notebookFolder.id,
          title: DEFAULT_NOTE_BASE,
          position: 0,
          contentJson: STARTER_NOTE_CONTENT_JSON,
        },
      });
    }
  });

  const quicknotes = await prisma.notesFolder.findFirstOrThrow({
    where: { workspaceId, parentId: null, title: QUICKNOTES_NOTEBOOK_TITLE },
  });
  const notebook = await prisma.notesFolder.findFirstOrThrow({
    where: { workspaceId, parentId: null, title: DEFAULT_NOTEBOOK_TITLE },
  });
  return { notebook, quicknotes };
}

/** Default notebook (not Quicknotes) for new notes when no folder is chosen. */
export async function ensureDefaultNotesFolder(workspaceId: string) {
  return (await syncNotesWorkspaceFolderDefaults(workspaceId)).notebook;
}

/** Top-level notebook used for Quick Capture (⌘⇧C) saves. */
export async function ensureQuicknotesFolder(workspaceId: string) {
  return (await syncNotesWorkspaceFolderDefaults(workspaceId)).quicknotes;
}

/** Workspace + default Notebook folder for the signed-in account. */
export async function ensureNotesBootstrap(user: AppUserPrincipal) {
  const { workspace } = await ensurePersonalWorkspaceBoard(user);
  const { notebook: defaultFolder } = await syncNotesWorkspaceFolderDefaults(workspace.id);
  return { workspace, defaultFolder };
}
