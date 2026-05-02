import { createFolder, createNote, fetchNotesBootstrap, fetchNotesList } from "@/features/notes/api";
import { useLocalNotesStore } from "@/features/notes/localNotesStore";
import type { AtlasNoteDto, NotesBootstrapDto } from "@/features/notes/types";
import { sortBoardsByLastEdited } from "./fastTaskFilterUtils";

const FAST_TASK_FOLDER_TITLE = "Fast Task";
const MIN_BOARDS = 4 as const;
const SLOT_TITLES = ["Fast task 1", "Fast task 2", "Fast task 3", "Fast task 4"] as const;

function findFastTaskFolder(folders: NotesBootstrapDto["folders"]) {
  return folders.find(
    (f) => f.parentId === null && f.title.trim().toLowerCase() === FAST_TASK_FOLDER_TITLE.toLowerCase(),
  );
}

function sortByPosition(a: AtlasNoteDto, b: AtlasNoteDto) {
  if (a.position !== b.position) return a.position - b.position;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

async function ensureApiBoards(
  workspaceId: string,
  bootstrap: NotesBootstrapDto,
): Promise<{
  folderId: string;
  notes: AtlasNoteDto[];
}> {
  let folder = findFastTaskFolder(bootstrap.folders);
  if (!folder) {
    folder = await createFolder({ workspaceId, title: FAST_TASK_FOLDER_TITLE });
  }

  let list = await fetchNotesList({ workspaceId, folderId: folder.id });
  let inFolder = list.filter((n) => n.folderId === folder.id);
  while (inFolder.length < MIN_BOARDS) {
    const i = inFolder.length;
    await createNote({
      workspaceId,
      folderId: folder.id,
      title: SLOT_TITLES[i] ?? `Fast task ${i + 1}`,
      contentJson: { type: "doc", content: [{ type: "paragraph" }] },
      previewText: null,
    });
    list = await fetchNotesList({ workspaceId, folderId: folder.id });
    inFolder = list.filter((n) => n.folderId === folder.id);
  }

  const notes = [...inFolder].sort(sortBoardsByLastEdited);
  return { folderId: folder.id, notes };
}

function ensureLocalBoards(): { folderId: string; notes: AtlasNoteDto[] } {
  const store = useLocalNotesStore.getState();
  let folder = store.folders.find(
    (f) => f.parentId === null && f.title.trim().toLowerCase() === FAST_TASK_FOLDER_TITLE.toLowerCase(),
  );
  if (!folder) {
    folder = store.createFolder(FAST_TASK_FOLDER_TITLE);
  }

  let inFolder = [...store.listNotes(folder.id)].sort(sortByPosition);
  while (inFolder.length < MIN_BOARDS) {
    const i = inFolder.length;
    store.createNote(folder.id, SLOT_TITLES[i] ?? `Fast task ${i + 1}`, { type: "doc", content: [{ type: "paragraph" }] }, null);
    inFolder = [...useLocalNotesStore.getState().listNotes(folder.id)].sort(sortByPosition);
  }

  const notes = [...inFolder].sort(sortBoardsByLastEdited);
  return { folderId: folder.id, notes };
}

export type FastTaskBoardsResult = {
  folderId: string;
  notes: AtlasNoteDto[];
  bootstrap: NotesBootstrapDto | null;
  localMode: boolean;
};

export async function ensureFastTaskBoards(params: {
  workspaceId: string | null;
  /** When true, skip API and use browser notes store */
  localMode: boolean;
}): Promise<FastTaskBoardsResult> {
  if (params.localMode) {
    const { folderId, notes } = ensureLocalBoards();
    return { folderId, notes, bootstrap: null, localMode: true };
  }
  if (!params.workspaceId) throw new Error("No workspace");
  const bootstrap = await fetchNotesBootstrap(params.workspaceId);
  const { folderId, notes } = await ensureApiBoards(params.workspaceId, bootstrap);
  return { folderId, notes, bootstrap, localMode: false };
}
