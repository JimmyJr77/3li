import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PatchNoteBody } from "./api";
import { previewFromDoc, titleMatchesWiki } from "./localWiki";
import type { AtlasNoteDto, NoteLinkSummaryDto, NotesBootstrapDto, NotesFolderDto } from "./types";
import { DEFAULT_NOTEBOOK_BASE, DEFAULT_NOTE_BASE, nextSequencedTitle } from "./defaultNames";
import { isProtectedNotebookTitle } from "./notebookConstants";

export const LOCAL_WORKSPACE_ID = "local-workspace";
export const LOCAL_BRAND_ID = "local-brand";

function nowIso() {
  return new Date().toISOString();
}

function emptyDoc() {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

function buildInitial(): {
  folders: NotesFolderDto[];
  defaultFolderId: string;
  quickCaptureFolderId: string;
  notes: AtlasNoteDto[];
  workspaceCreatedAt: string;
} {
  const notebookFolderId = crypto.randomUUID();
  const quickFolderId = crypto.randomUUID();
  const noteId = crypto.randomUUID();
  const t = nowIso();
  const doc = emptyDoc();
  return {
    folders: [
      {
        id: quickFolderId,
        workspaceId: LOCAL_WORKSPACE_ID,
        parentId: null,
        title: "Quicknotes",
        position: 0,
        rowAccentColor: null,
        createdAt: t,
        updatedAt: t,
      },
      {
        id: notebookFolderId,
        workspaceId: LOCAL_WORKSPACE_ID,
        parentId: null,
        title: DEFAULT_NOTEBOOK_BASE,
        position: 1,
        rowAccentColor: null,
        createdAt: t,
        updatedAt: t,
      },
    ],
    defaultFolderId: notebookFolderId,
    quickCaptureFolderId: quickFolderId,
    notes: [
      {
        id: noteId,
        workspaceId: LOCAL_WORKSPACE_ID,
        folderId: notebookFolderId,
        title: DEFAULT_NOTE_BASE,
        slug: null,
        contentJson: doc,
        previewText: null,
        position: 0,
        rowAccentColor: null,
        isPinned: false,
        isPublic: false,
        publicSlug: null,
        routingSource: null,
        labels: [],
        createdAt: t,
        updatedAt: t,
      },
    ],
    workspaceCreatedAt: t,
  };
}

type LocalState = {
  folders: NotesFolderDto[];
  defaultFolderId: string;
  quickCaptureFolderId: string;
  notes: AtlasNoteDto[];
  /** Stable timestamps for workspace DTO */
  workspaceCreatedAt: string;
};

type LocalActions = {
  getBootstrap: () => NotesBootstrapDto;
  listNotes: (folderFilter: string | "all") => AtlasNoteDto[];
  searchNotes: (q: string) => AtlasNoteDto[];
  createNote: (folderId: string, title?: string, contentJson?: unknown | null, previewText?: string | null) => AtlasNoteDto;
  patchNote: (id: string, body: PatchNoteBody) => AtlasNoteDto;
  deleteNote: (id: string) => void;
  createFolder: (title?: string) => NotesFolderDto;
  patchFolder: (id: string, body: { title?: string; position?: number; rowAccentColor?: string | null }) => NotesFolderDto;
  deleteFolder: (id: string) => void;
  reorderFolders: (orderedFolderIds: string[]) => void;
  reorderNotesInFolder: (folderId: string, orderedNoteIds: string[]) => void;
  getForwardLinks: (noteId: string) => NoteLinkSummaryDto[];
  getBacklinks: (noteId: string) => NoteLinkSummaryDto[];
};

export const useLocalNotesStore = create<LocalState & LocalActions>()(
  persist(
    (set, get) => ({
      ...buildInitial(),

      getBootstrap: (): NotesBootstrapDto => {
        const s = get();
        const t = nowIso();
        return {
          workspace: {
            id: LOCAL_WORKSPACE_ID,
            name: "This browser",
            brandId: LOCAL_BRAND_ID,
            createdAt: s.workspaceCreatedAt,
            updatedAt: t,
          },
          defaultFolderId: s.defaultFolderId,
          quickCaptureFolderId: s.quickCaptureFolderId,
          defaultLabelBoardId: null,
          folders: s.folders,
          notes: s.notes,
        };
      },

      listNotes: (folderFilter) => {
        const { notes } = get();
        if (folderFilter === "all") return [...notes].sort(sortNotes);
        return notes.filter((n) => n.folderId === folderFilter).sort(sortNotes);
      },

      searchNotes: (q) => {
        const term = q.trim().toLowerCase();
        if (!term) return [];
        return get().notes.filter(
          (n) =>
            n.title.toLowerCase().includes(term) || (n.previewText ?? "").toLowerCase().includes(term),
        );
      },

      createNote: (folderId, title, contentJson, previewText) => {
        const s = get();
        const inFolder = s.notes.filter((n) => n.folderId === folderId);
        const position = (inFolder.reduce((m, n) => Math.max(m, n.position), -1) ?? -1) + 1;
        const t = nowIso();
        const trimmed = title !== undefined && title !== null ? String(title).trim() : "";
        const resolvedTitle = trimmed
          ? trimmed
          : nextSequencedTitle(inFolder.map((n) => n.title), DEFAULT_NOTE_BASE);
        const note: AtlasNoteDto = {
          id: crypto.randomUUID(),
          workspaceId: LOCAL_WORKSPACE_ID,
          folderId,
          title: resolvedTitle,
          slug: null,
          contentJson: contentJson ?? emptyDoc(),
          previewText: previewText ?? null,
          position,
          rowAccentColor: null,
          isPinned: false,
          isPublic: false,
          publicSlug: null,
          labels: [],
          createdAt: t,
          updatedAt: t,
        };
        set((st) => ({ notes: [...st.notes, note] }));
        return note;
      },

      patchNote: (id, body) => {
        const s = get();
        const idx = s.notes.findIndex((n) => n.id === id);
        if (idx < 0) throw new Error("Note not found");
        const prev = s.notes[idx];
        const next: AtlasNoteDto = {
          ...prev,
          title: body.title !== undefined ? body.title : prev.title,
          contentJson: body.contentJson !== undefined ? body.contentJson : prev.contentJson,
          previewText: body.previewText !== undefined ? body.previewText : prev.previewText,
          folderId: body.folderId !== undefined ? body.folderId : prev.folderId,
          slug: body.slug !== undefined ? body.slug : prev.slug,
          isPinned: body.isPinned !== undefined ? body.isPinned : prev.isPinned,
          isPublic: body.isPublic !== undefined ? body.isPublic : prev.isPublic,
          publicSlug: body.publicSlug !== undefined ? body.publicSlug : prev.publicSlug,
          position: body.position !== undefined ? body.position : prev.position,
          rowAccentColor: body.rowAccentColor !== undefined ? body.rowAccentColor : prev.rowAccentColor,
          updatedAt: nowIso(),
        };
        const notes = [...s.notes];
        notes[idx] = next;
        set({ notes });
        return next;
      },

      deleteNote: (id) => {
        set((st) => {
          let notes = st.notes.filter((n) => n.id !== id);
          if (notes.length === 0) {
            const notebookFolder = st.folders.find((f) => f.parentId === null && f.title === DEFAULT_NOTEBOOK_BASE);
            if (notebookFolder) {
              const t = nowIso();
              notes = [
                {
                  id: crypto.randomUUID(),
                  workspaceId: LOCAL_WORKSPACE_ID,
                  folderId: notebookFolder.id,
                  title: DEFAULT_NOTE_BASE,
                  slug: null,
                  contentJson: emptyDoc(),
                  previewText: null,
                  position: 0,
                  rowAccentColor: null,
                  isPinned: false,
                  isPublic: false,
                  publicSlug: null,
                  routingSource: null,
                  labels: [],
                  createdAt: t,
                  updatedAt: t,
                },
              ];
            }
          }
          return { notes };
        });
      },

      createFolder: (title) => {
        const s = get();
        const top = s.folders.filter((f) => f.parentId === null);
        const trimmed = title !== undefined && title !== null ? String(title).trim() : "";
        const resolvedTitle = trimmed
          ? trimmed
          : nextSequencedTitle(top.map((f) => f.title), DEFAULT_NOTEBOOK_BASE);
        const position = (s.folders.reduce((m, f) => Math.max(m, f.position), -1) ?? -1) + 1;
        const t = nowIso();
        const folder: NotesFolderDto = {
          id: crypto.randomUUID(),
          workspaceId: LOCAL_WORKSPACE_ID,
          parentId: null,
          title: resolvedTitle,
          position,
          rowAccentColor: null,
          createdAt: t,
          updatedAt: t,
        };
        set((st) => ({ folders: [...st.folders, folder] }));
        return folder;
      },

      patchFolder: (id, body) => {
        const s = get();
        const idx = s.folders.findIndex((f) => f.id === id);
        if (idx < 0) throw new Error("Folder not found");
        const prev = s.folders[idx];
        const next: NotesFolderDto = {
          ...prev,
          title: body.title !== undefined ? body.title : prev.title,
          position: body.position !== undefined ? body.position : prev.position,
          rowAccentColor: body.rowAccentColor !== undefined ? body.rowAccentColor : prev.rowAccentColor,
          updatedAt: nowIso(),
        };
        const folders = [...s.folders];
        folders[idx] = next;
        set({ folders });
        return next;
      },

      deleteFolder: (id) => {
        const s = get();
        const victim = s.folders.find((f) => f.id === id);
        if (!victim) throw new Error("Folder not found");
        if (victim.parentId === null && isProtectedNotebookTitle(victim.title)) {
          throw new Error("The Quicknotes and default Notebook folders cannot be deleted.");
        }
        const top = s.folders.filter((f) => f.parentId === null);
        if (top.length <= 1) throw new Error("Cannot delete the only folder");
        const target = top.find((f) => f.id !== id);
        if (!target) throw new Error("No target folder");
        const notes = s.notes.map((n) =>
          n.folderId === id ? { ...n, folderId: target.id, updatedAt: nowIso() } : n,
        );
        const remaining = s.folders.filter((f) => f.id !== id);
        const topRemaining = remaining.filter((f) => f.parentId === null).sort((a, b) => a.position - b.position);
        const folders = remaining.map((f) => {
          if (f.parentId !== null) return f;
          const ti = topRemaining.findIndex((x) => x.id === f.id);
          return { ...f, position: ti, updatedAt: nowIso() };
        });
        const defaultFolderId = s.defaultFolderId === id ? target.id : s.defaultFolderId;
        const quickCaptureFolderId = s.quickCaptureFolderId === id ? target.id : s.quickCaptureFolderId;
        set({ notes, folders, defaultFolderId, quickCaptureFolderId });
      },

      reorderFolders: (orderedFolderIds) => {
        const pos = new Map(orderedFolderIds.map((fid, i) => [fid, i]));
        set((st) => ({
          folders: st.folders.map((f) =>
            pos.has(f.id) ? { ...f, position: pos.get(f.id)!, updatedAt: nowIso() } : f,
          ),
        }));
      },

      reorderNotesInFolder: (folderId, orderedNoteIds) => {
        const pos = new Map(orderedNoteIds.map((nid, i) => [nid, i]));
        set((st) => ({
          notes: st.notes.map((n) =>
            n.folderId === folderId && pos.has(n.id) ? { ...n, position: pos.get(n.id)!, updatedAt: nowIso() } : n,
          ),
        }));
      },

      getForwardLinks: (noteId) => {
        const s = get();
        const from = s.notes.find((n) => n.id === noteId);
        if (!from) return [];
        const blob = JSON.stringify(from.contentJson ?? {});
        const titles = new Set<string>();
        const re = /\[\[([^\]]+)\]\]/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(blob)) !== null) {
          const t = m[1].trim();
          if (t) titles.add(t);
        }
        const out: NoteLinkSummaryDto[] = [];
        for (const title of titles) {
          const target = s.notes.find(
            (n) => n.id !== noteId && n.title.trim().toLowerCase() === title.toLowerCase(),
          );
          if (target) {
            out.push({
              id: target.id,
              title: target.title,
              previewText: target.previewText,
              updatedAt: target.updatedAt,
            });
          }
        }
        return out;
      },

      getBacklinks: (noteId) => {
        const s = get();
        const target = s.notes.find((n) => n.id === noteId);
        if (!target) return [];
        const refTitle = target.title.trim();
        const out: NoteLinkSummaryDto[] = [];
        for (const n of s.notes) {
          if (n.id === noteId) continue;
          const blob = JSON.stringify(n.contentJson ?? {});
          if (titleMatchesWiki(blob, refTitle)) {
            out.push({
              id: n.id,
              title: n.title,
              previewText: n.previewText,
              updatedAt: n.updatedAt,
            });
          }
        }
        return out;
      },

    }),
    {
      name: "atlas-notes-local-v1",
      partialize: (s) => ({
        folders: s.folders,
        defaultFolderId: s.defaultFolderId,
        quickCaptureFolderId: s.quickCaptureFolderId,
        notes: s.notes,
        workspaceCreatedAt: s.workspaceCreatedAt,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<LocalState> | undefined;
        if (!p || !p.folders?.length) {
          return { ...current, ...buildInitial() };
        }
        const t = nowIso();
        let folders: NotesFolderDto[] = p.folders.map((f) => ({ ...f }));
        const top = () => folders.filter((f) => f.parentId === null);

        const hasNotebook = () => top().some((f) => f.title === DEFAULT_NOTEBOOK_BASE);
        if (!hasNotebook()) {
          const legacy = top().find((f) => f.title === "Notes");
          if (legacy) {
            const idx = folders.findIndex((f) => f.id === legacy.id);
            if (idx >= 0) {
              folders[idx] = { ...folders[idx]!, title: DEFAULT_NOTEBOOK_BASE, updatedAt: t };
            }
          }
        }

        if (!top().some((f) => f.title === "Quicknotes")) {
          const qid = crypto.randomUUID();
          folders.push({
            id: qid,
            workspaceId: LOCAL_WORKSPACE_ID,
            parentId: null,
            title: "Quicknotes",
            position: 9999,
            rowAccentColor: null,
            createdAt: t,
            updatedAt: t,
          });
        }

        if (!top().some((f) => f.title === DEFAULT_NOTEBOOK_BASE)) {
          const nid = crypto.randomUUID();
          folders.push({
            id: nid,
            workspaceId: LOCAL_WORKSPACE_ID,
            parentId: null,
            title: DEFAULT_NOTEBOOK_BASE,
            position: 9998,
            createdAt: t,
            updatedAt: t,
          });
        }

        const tops = top();
        const quickF = tops.find((f) => f.title === "Quicknotes");
        const nbF = tops.find((f) => f.title === DEFAULT_NOTEBOOK_BASE);
        const others = tops
          .filter((f) => f.id !== quickF?.id && f.id !== nbF?.id)
          .sort((a, b) => a.position - b.position);
        const orderedTop = [quickF, nbF, ...others].filter((f): f is NotesFolderDto => Boolean(f));
        const posById = new Map(orderedTop.map((f, i) => [f.id, i]));
        folders = folders.map((f) =>
          f.parentId === null && posById.has(f.id) ? { ...f, position: posById.get(f.id)!, updatedAt: t } : f,
        );

        const quickCaptureFolder =
          folders.find((f) => f.parentId === null && f.title === "Quicknotes") ?? null;
        const notebookFolder =
          folders.find((f) => f.parentId === null && f.title === DEFAULT_NOTEBOOK_BASE) ?? null;
        let quickCaptureFolderId = p.quickCaptureFolderId;
        if (
          quickCaptureFolder &&
          (!quickCaptureFolderId || !folders.some((f) => f.id === quickCaptureFolderId))
        ) {
          quickCaptureFolderId = quickCaptureFolder.id;
        } else if (quickCaptureFolder) {
          quickCaptureFolderId = quickCaptureFolder.id;
        }

        let defaultFolderId = p.defaultFolderId;
        if (!defaultFolderId || !folders.some((f) => f.id === defaultFolderId)) {
          defaultFolderId = notebookFolder?.id ?? defaultFolderId;
        }
        if (notebookFolder && defaultFolderId === quickCaptureFolder?.id) {
          defaultFolderId = notebookFolder.id;
        }

        let notes = p.notes ? [...p.notes] : [];
        notes = notes.map((raw) => {
          const x = raw as AtlasNoteDto & { tags?: unknown };
          const { tags: _legacyTags, ...rest } = x;
          return {
            ...rest,
            labels: Array.isArray(x.labels) ? x.labels : [],
          } as AtlasNoteDto;
        });
        if (notes.length === 0 && notebookFolder) {
          notes.push({
            id: crypto.randomUUID(),
            workspaceId: LOCAL_WORKSPACE_ID,
            folderId: notebookFolder.id,
            title: DEFAULT_NOTE_BASE,
            slug: null,
            contentJson: emptyDoc(),
            previewText: null,
            position: 0,
            rowAccentColor: null,
            isPinned: false,
            isPublic: false,
            publicSlug: null,
            routingSource: null,
            labels: [],
            createdAt: t,
            updatedAt: t,
          });
        }

        return {
          ...current,
          ...p,
          folders,
          notes,
          defaultFolderId: defaultFolderId ?? current.defaultFolderId,
          quickCaptureFolderId: quickCaptureFolderId ?? current.quickCaptureFolderId,
          workspaceCreatedAt: p.workspaceCreatedAt ?? current.workspaceCreatedAt,
        };
      },
    },
  ),
);

function sortNotes(a: AtlasNoteDto, b: AtlasNoteDto) {
  if (a.position !== b.position) return a.position - b.position;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

/** When applying editor save, refresh preview if missing. */
export function applyLocalContentPatch(
  id: string,
  contentJson: unknown,
): AtlasNoteDto {
  const store = useLocalNotesStore.getState();
  const preview = previewFromDoc(contentJson);
  return store.patchNote(id, { contentJson, previewText: preview || null });
}
