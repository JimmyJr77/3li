import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PatchNoteBody } from "./api";
import { previewFromDoc, titleMatchesWiki } from "./localWiki";
import type { AtlasNoteDto, NoteLinkSummaryDto, NoteTagDto, NotesBootstrapDto, NotesFolderDto } from "./types";

export const LOCAL_WORKSPACE_ID = "local-workspace";

function nowIso() {
  return new Date().toISOString();
}

function emptyDoc() {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

function buildInitial(): {
  folders: NotesFolderDto[];
  defaultFolderId: string;
  notes: AtlasNoteDto[];
  tags: NoteTagDto[];
  workspaceCreatedAt: string;
} {
  const folderId = crypto.randomUUID();
  const t = nowIso();
  return {
    folders: [
      {
        id: folderId,
        workspaceId: LOCAL_WORKSPACE_ID,
        parentId: null,
        title: "Notes",
        position: 0,
        rowAccentColor: null,
        createdAt: t,
        updatedAt: t,
      },
    ],
    defaultFolderId: folderId,
    notes: [],
    tags: [],
    workspaceCreatedAt: t,
  };
}

type LocalState = {
  folders: NotesFolderDto[];
  defaultFolderId: string;
  notes: AtlasNoteDto[];
  tags: NoteTagDto[];
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
  createFolder: (title: string) => NotesFolderDto;
  patchFolder: (id: string, body: { title?: string; position?: number; rowAccentColor?: string | null }) => NotesFolderDto;
  deleteFolder: (id: string) => void;
  reorderFolders: (orderedFolderIds: string[]) => void;
  reorderNotesInFolder: (folderId: string, orderedNoteIds: string[]) => void;
  getForwardLinks: (noteId: string) => NoteLinkSummaryDto[];
  getBacklinks: (noteId: string) => NoteLinkSummaryDto[];
  createTag: (name: string, color?: string) => NoteTagDto;
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
            createdAt: s.workspaceCreatedAt,
            updatedAt: t,
          },
          defaultFolderId: s.defaultFolderId,
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
        const note: AtlasNoteDto = {
          id: crypto.randomUUID(),
          workspaceId: LOCAL_WORKSPACE_ID,
          folderId,
          title: title?.trim() || "Untitled",
          slug: null,
          contentJson: contentJson ?? emptyDoc(),
          previewText: previewText ?? null,
          position,
          rowAccentColor: null,
          isPinned: false,
          isPublic: false,
          publicSlug: null,
          tags: [],
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
        let tags = prev.tags;
        if (body.tagIds !== undefined) {
          const idSet = new Set(body.tagIds);
          tags = s.tags.filter((t) => idSet.has(t.id));
        }
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
          tags,
          updatedAt: nowIso(),
        };
        const notes = [...s.notes];
        notes[idx] = next;
        set({ notes });
        return next;
      },

      deleteNote: (id) => {
        set((st) => ({ notes: st.notes.filter((n) => n.id !== id) }));
      },

      createFolder: (title) => {
        const s = get();
        const position = (s.folders.reduce((m, f) => Math.max(m, f.position), -1) ?? -1) + 1;
        const t = nowIso();
        const folder: NotesFolderDto = {
          id: crypto.randomUUID(),
          workspaceId: LOCAL_WORKSPACE_ID,
          parentId: null,
          title: title.trim() || "Folder",
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
        const top = s.folders.filter((f) => f.parentId === null);
        if (top.length <= 1) throw new Error("Cannot delete the only folder");
        const victim = s.folders.find((f) => f.id === id);
        if (!victim) throw new Error("Folder not found");
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
        set({ notes, folders, defaultFolderId });
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

      createTag: (name, color) => {
        const s = get();
        const trimmed = name.trim();
        const existing = s.tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing;
        const t = nowIso();
        const tag: NoteTagDto = {
          id: crypto.randomUUID(),
          workspaceId: LOCAL_WORKSPACE_ID,
          name: trimmed,
          color: color ?? "#6366f1",
          createdAt: t,
          updatedAt: t,
        };
        set((st) => ({ tags: [...st.tags, tag] }));
        return tag;
      },
    }),
    {
      name: "atlas-notes-local-v1",
      partialize: (s) => ({
        folders: s.folders,
        defaultFolderId: s.defaultFolderId,
        notes: s.notes,
        tags: s.tags,
        workspaceCreatedAt: s.workspaceCreatedAt,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<LocalState> | undefined;
        if (!p || !p.folders?.length) {
          return { ...current, ...buildInitial() };
        }
        return {
          ...current,
          ...p,
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
