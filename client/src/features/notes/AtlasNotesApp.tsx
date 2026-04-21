import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileText, Lightbulb, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { stashNoteForBrainstormImport } from "@/features/brainstorm/brainstormNoteImport";
import type { AtlasNoteDto } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createFolder,
  createNote,
  deleteFolder as deleteFolderApi,
  deleteNote,
  fetchNotesBootstrap,
  fetchNotesList,
  patchFolder as patchFolderApi,
  patchNote,
  reorderFolders as reorderFoldersApi,
  reorderNotes as reorderNotesApi,
  searchNotes,
} from "./api";
import { AtlasNotesBrowseColumns } from "./AtlasNotesBrowseColumns";
import { applyLocalContentPatch, LOCAL_WORKSPACE_ID, useLocalNotesStore } from "./localNotesStore";
import { extractPreviewFromDoc } from "./extractPreview";
import type { NoteTemplate } from "./noteTemplates";
import { templateSeedTitle } from "./noteTemplates";
import { NoteAIActions } from "./NoteAIActions";
import { NoteEditor } from "./NoteEditor";
import { NoteLinksPanel } from "./NoteLinksPanel";
import { NotePublishingBar } from "./NotePublishingBar";
import { NoteTagsRow } from "./NoteTagsRow";
import { NotesCommandPalette } from "./NotesCommandPalette";
import { NotesPortabilityPanel } from "./NotesPortabilityPanel";
import type { ExportedNotePayload } from "./notesImportExport";
import { QuickCaptureSheet } from "./QuickCaptureSheet";

export function AtlasNotesApp() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: bootstrapData, isLoading: bootstrapLoading, isError: bootstrapError } = useQuery({
    queryKey: ["notes-app", "bootstrap"],
    queryFn: fetchNotesBootstrap,
    retry: false,
  });

  const localMode = !bootstrapLoading && (bootstrapError || !bootstrapData);

  const localFolders = useLocalNotesStore((s) => s.folders);
  const localTags = useLocalNotesStore((s) => s.tags);
  const localDefaultFolderId = useLocalNotesStore((s) => s.defaultFolderId);
  const listNotesLocal = useLocalNotesStore((s) => s.listNotes);
  const searchNotesLocal = useLocalNotesStore((s) => s.searchNotes);
  const patchNoteLocal = useLocalNotesStore((s) => s.patchNote);
  const createNoteLocal = useLocalNotesStore((s) => s.createNote);
  const deleteNoteLocal = useLocalNotesStore((s) => s.deleteNote);
  const createFolderLocal = useLocalNotesStore((s) => s.createFolder);
  const patchFolderStore = useLocalNotesStore((s) => s.patchFolder);
  const deleteFolderStore = useLocalNotesStore((s) => s.deleteFolder);
  const reorderFoldersStore = useLocalNotesStore((s) => s.reorderFolders);
  const reorderNotesInFolderStore = useLocalNotesStore((s) => s.reorderNotesInFolder);
  const createTagLocal = useLocalNotesStore((s) => s.createTag);
  const getForwardLinks = useLocalNotesStore((s) => s.getForwardLinks);
  const getBacklinks = useLocalNotesStore((s) => s.getBacklinks);

  const workspaceId = localMode ? LOCAL_WORKSPACE_ID : bootstrapData?.workspace.id;
  const defaultFolderId = localMode ? localDefaultFolderId : bootstrapData?.defaultFolderId;

  const topFolders = useMemo(() => {
    const list = localMode ? localFolders : (bootstrapData?.folders ?? []);
    return [...list].filter((f) => f.parentId === null).sort((a, b) => a.position - b.position);
  }, [localMode, localFolders, bootstrapData?.folders]);

  const [folderFilter, setFolderFilter] = useState<string | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<AtlasNoteDto[] | null>(null);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const urlNoteApplied = useRef(false);

  const notesQuery = useQuery({
    queryKey: ["notes-app", "notes", workspaceId, folderFilter],
    queryFn: () =>
      fetchNotesList({
        workspaceId: workspaceId!,
        folderId: folderFilter,
      }),
    enabled: !!workspaceId && !localMode,
  });

  const allNotesForExportQuery = useQuery({
    queryKey: ["notes-app", "notes", workspaceId, "all-export"],
    queryFn: () =>
      fetchNotesList({
        workspaceId: workspaceId!,
        folderId: "all",
      }),
    enabled: !!workspaceId && !localMode,
  });

  const notesFromApi = notesQuery.data ?? [];
  const notes = localMode ? listNotesLocal(folderFilter) : notesFromApi;
  const displayList = searchHits ?? notes;

  const resolvedSelectedId = useMemo(() => {
    if (!displayList.length) return null;
    if (selectedId && displayList.some((n) => n.id === selectedId)) return selectedId;
    return displayList[0].id;
  }, [displayList, selectedId]);

  const selected = useMemo(
    () => (resolvedSelectedId ? displayList.find((n) => n.id === resolvedSelectedId) ?? null : null),
    [displayList, resolvedSelectedId],
  );

  const exportableNotes = localMode ? listNotesLocal("all") : (allNotesForExportQuery.data ?? []);

  /* eslint-disable react-hooks/set-state-in-effect -- keep selected note aligned with folder list + optional ?note= */
  useEffect(() => {
    if (!displayList.length) {
      setSelectedId(null);
      return;
    }
    if (!urlNoteApplied.current) {
      const urlNote = searchParams.get("note");
      if (urlNote && displayList.some((n) => n.id === urlNote)) {
        setSelectedId(urlNote);
      } else if (!selectedId || !displayList.some((n) => n.id === selectedId)) {
        setSelectedId(displayList[0].id);
      }
      urlNoteApplied.current = true;
      return;
    }
    if (selectedId && displayList.some((n) => n.id === selectedId)) return;
    setSelectedId(displayList[0].id);
  }, [displayList, selectedId, searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const u = new URLSearchParams(prev);
        if (!selectedId) {
          if (u.has("note")) {
            u.delete("note");
            return u;
          }
          return prev;
        }
        if (u.get("note") === selectedId) return prev;
        u.set("note", selectedId);
        return u;
      },
      { replace: true },
    );
  }, [selectedId, setSearchParams]);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["notes-app"] });
  };

  const createMut = useMutation({
    mutationFn: async () => {
      if (localMode) {
        const folderId = folderFilter === "all" ? localDefaultFolderId : folderFilter;
        return createNoteLocal(folderId, "Untitled");
      }
      if (!workspaceId || !bootstrapData) throw new Error("No workspace");
      const folderId = folderFilter === "all" ? bootstrapData.defaultFolderId : folderFilter;
      return createNote({ workspaceId, folderId, title: "Untitled" });
    },
    onSuccess: (note) => {
      if (!localMode) void qc.invalidateQueries({ queryKey: ["notes-app"] });
      setSelectedId(note.id);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => {
      if (localMode) {
        deleteNoteLocal(id);
        return Promise.resolve();
      }
      return deleteNote(id);
    },
    onSuccess: () => {
      if (!localMode) void qc.invalidateQueries({ queryKey: ["notes-app"] });
      setSelectedId(null);
    },
  });

  const newFolderMut = useMutation({
    mutationFn: () => {
      if (localMode) return Promise.resolve(createFolderLocal("New folder"));
      if (!workspaceId) throw new Error("No workspace");
      return createFolder({ workspaceId, title: "New folder" });
    },
    onSuccess: () => {
      if (!localMode) invalidateAll();
    },
  });

  const runSearch = async () => {
    if (!searchQ.trim()) {
      setSearchHits(null);
      return;
    }
    if (localMode) {
      setSearchHits(searchNotesLocal(searchQ.trim()));
      return;
    }
    if (!workspaceId) return;
    const hits = await searchNotes(workspaceId, searchQ.trim());
    setSearchHits(hits);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const t = e.target as HTMLElement | null;
        if (t?.closest?.('[data-slot="dialog-content"]')) return;
        e.preventDefault();
        setCommandOpen((o) => !o);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        const t = e.target as HTMLElement | null;
        if (t?.closest?.('[data-slot="sheet-content"]')) return;
        e.preventDefault();
        setQuickCaptureOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const applyTemplate = (template: NoteTemplate) => {
    if (!defaultFolderId) return;
    const folderId = folderFilter === "all" ? defaultFolderId : folderFilter;
    const preview = extractPreviewFromDoc(template.contentJson);
    const title = templateSeedTitle(template);
    if (localMode) {
      const note = createNoteLocal(folderId, title, template.contentJson, preview || null);
      setSelectedId(note.id);
      return;
    }
    if (!workspaceId) return;
    void createNote({
      workspaceId,
      folderId,
      title,
      contentJson: template.contentJson,
      previewText: preview || null,
    }).then((note) => {
      void qc.invalidateQueries({ queryKey: ["notes-app"] });
      setSelectedId(note.id);
    });
  };

  const importPayloads = async (payloads: ExportedNotePayload[]) => {
    if (!defaultFolderId) return;
    const folderId = folderFilter === "all" ? defaultFolderId : folderFilter;
    let lastId: string | null = null;
    for (const p of payloads) {
      if (localMode) {
        const note = createNoteLocal(folderId, p.title, p.contentJson, p.previewText ?? null);
        lastId = note.id;
      } else if (workspaceId) {
        const note = await createNote({
          workspaceId,
          folderId,
          title: p.title || "Imported note",
          contentJson: p.contentJson,
          previewText: p.previewText ?? null,
        });
        lastId = note.id;
      }
    }
    if (!localMode) void qc.invalidateQueries({ queryKey: ["notes-app"] });
    if (lastId) setSelectedId(lastId);
  };

  if (bootstrapLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading Atlas Notes…
      </div>
    );
  }

  if (!workspaceId || !defaultFolderId) {
    return (
      <p className="text-destructive">
        Could not initialize notes. Try refreshing the page.
      </p>
    );
  }

  const captureFolderId = folderFilter === "all" ? defaultFolderId : folderFilter;

  const forwardOverride = localMode && selected ? getForwardLinks(selected.id) : undefined;
  const backOverride = localMode && selected ? getBacklinks(selected.id) : undefined;

  return (
    <div className="flex min-h-[min(70vh,720px)] flex-1 flex-col gap-3">
      {localMode ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <p>
            <span className="font-medium">Using browser storage</span> — the Atlas Notes API is unavailable. Your notes
            stay on this device until the server is reachable again.
          </p>
        </div>
      ) : null}

      <div className="flex min-h-[min(68vh,700px)] flex-1 gap-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex min-w-0 shrink-0 items-stretch">
        <AtlasNotesBrowseColumns
          localMode={localMode}
          topFolders={topFolders}
          folderFilter={folderFilter}
          setFolderFilter={setFolderFilter}
          setSearchHits={setSearchHits}
          notesLoading={!localMode && notesQuery.isLoading}
          displayList={displayList}
          resolvedSelectedId={resolvedSelectedId}
          setSelectedId={setSelectedId}
          searchQ={searchQ}
          setSearchQ={setSearchQ}
          runSearch={runSearch}
          createPending={createMut.isPending}
          onNewNote={() => createMut.mutate()}
          onQuickCapture={() => setQuickCaptureOpen(true)}
          onNewFolder={() => newFolderMut.mutate()}
          newFolderPending={newFolderMut.isPending}
          onReorderFolders={async (ids) => {
            if (localMode) {
              reorderFoldersStore(ids);
              return;
            }
            await reorderFoldersApi(workspaceId!, ids);
            invalidateAll();
          }}
          onReorderNotes={async (ids) => {
            if (folderFilter === "all") return;
            if (localMode) {
              reorderNotesInFolderStore(folderFilter, ids);
              return;
            }
            await reorderNotesApi(workspaceId!, folderFilter, ids);
            invalidateAll();
          }}
          onRenameFolder={async (folderId, title) => {
            try {
              if (localMode) {
                patchFolderStore(folderId, { title });
                return;
              }
              await patchFolderApi(folderId, { title });
              invalidateAll();
            } catch (e: unknown) {
              const msg =
                typeof e === "object" && e !== null && "response" in e
                  ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
                  : e instanceof Error
                    ? e.message
                    : "Could not rename folder";
              window.alert(msg ?? "Could not rename folder");
            }
          }}
          onDeleteFolder={async (folderId) => {
            if (topFolders.length <= 1) {
              window.alert("Create a second folder before deleting this one. Every workspace needs at least one folder.");
              return;
            }
            try {
              if (localMode) {
                deleteFolderStore(folderId);
              } else {
                await deleteFolderApi(folderId);
              }
              if (folderFilter === folderId) setFolderFilter("all");
              invalidateAll();
            } catch (e: unknown) {
              const msg =
                typeof e === "object" && e !== null && "response" in e
                  ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
                  : e instanceof Error
                    ? e.message
                    : "Failed to delete folder";
              window.alert(msg ?? "Failed to delete folder");
            }
          }}
          canReorderNotes={folderFilter !== "all" && searchHits === null}
        />
        </div>

        <section className="flex min-w-0 min-h-0 flex-1 flex-col border-l border-border bg-background p-4">
          {selected ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3">
                <AtlasNoteTitleInput
                  key={selected.id}
                  note={selected}
                  onCommit={async (nextTitle) => {
                    if (localMode) {
                      patchNoteLocal(selected.id, { title: nextTitle });
                    } else {
                      await patchNote(selected.id, { title: nextTitle });
                      void qc.invalidateQueries({ queryKey: ["notes-app"] });
                    }
                  }}
                />
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    title="Add this note as an idea card on the Brainstorm board"
                    onClick={() => {
                      stashNoteForBrainstormImport(selected);
                      void qc.invalidateQueries({ queryKey: ["brainstorm"] });
                      navigate("/app/brainstorm");
                    }}
                  >
                    <Lightbulb className="size-3.5" />
                    Brainstorm
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                    onClick={() => {
                      if (confirm("Delete this note?")) deleteMut.mutate(selected.id);
                    }}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <NoteEditor
                  key={selected.id}
                  note={selected}
                  onSaved={() => {
                    if (!localMode) void qc.invalidateQueries({ queryKey: ["notes-app"] });
                  }}
                  persistNote={
                    localMode
                      ? async (id, body) => {
                          applyLocalContentPatch(id, body.contentJson);
                        }
                      : undefined
                  }
                />
              </div>

              <div className="mt-4 shrink-0">
                <NoteLinksPanel
                  noteId={selected.id}
                  onOpenNote={(id) => setSelectedId(id)}
                  forwardLinksOverride={forwardOverride}
                  backLinksOverride={backOverride}
                />
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <NoteTagsRow
                  note={selected}
                  workspaceId={workspaceId}
                  allTags={localMode ? localTags : undefined}
                  patchNoteFn={localMode ? (id, body) => Promise.resolve(patchNoteLocal(id, body)) : undefined}
                  createTagFn={
                    localMode
                      ? async (body) => createTagLocal(body.name, body.color)
                      : undefined
                  }
                />
              </div>
              <div className="mt-4 grid gap-4 border-t border-border pt-4 lg:grid-cols-2">
                <NotePublishingBar
                  key={selected.id}
                  note={selected}
                  offline={localMode}
                  onUpdated={() => void qc.invalidateQueries({ queryKey: ["notes-app"] })}
                />
                <NoteAIActions
                  note={selected}
                  workspaceId={workspaceId}
                  offline={localMode}
                  onUpdated={() => void qc.invalidateQueries({ queryKey: ["notes-app"] })}
                />
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <NotesPortabilityPanel
                  localMode={localMode}
                  selected={selected}
                  exportableNotes={exportableNotes}
                  onImportPayloads={importPayloads}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <FileText className="size-10 opacity-40" />
              <p className="text-sm">Select or create a note</p>
            </div>
          )}
        </section>
        <QuickCaptureSheet
          open={quickCaptureOpen}
          onOpenChange={setQuickCaptureOpen}
          workspaceId={workspaceId}
          folderId={captureFolderId}
          onCreated={(id) => setSelectedId(id)}
          createNoteFn={
            localMode
              ? async (body) => {
                  const note = createNoteLocal(body.folderId, body.title, body.contentJson, body.previewText);
                  return { id: note.id };
                }
              : undefined
          }
        />
        <NotesCommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          localMode={localMode}
          workspaceId={workspaceId}
          searchNotesLocal={searchNotesLocal}
          onOpenNote={(id) => setSelectedId(id)}
          onNewNote={() => createMut.mutate()}
          onQuickCapture={() => setQuickCaptureOpen(true)}
          onApplyTemplate={applyTemplate}
        />
      </div>
    </div>
  );
}

function AtlasNoteTitleInput({
  note,
  onCommit,
}: {
  note: AtlasNoteDto;
  onCommit: (title: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(note.title);
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === note.title) return;
        void onCommit(draft);
      }}
      className="h-9 max-w-xl border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
      aria-label="Note title"
    />
  );
}
