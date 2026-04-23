import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { RoutingSourceBadge } from "@/components/shared/RoutingSourceBadge";
import type { AtlasNoteDto } from "./types";
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
import { extractPlainTextFromDoc } from "./extractPreview";
import { AtlasNotesBrowseColumns } from "./AtlasNotesBrowseColumns";
import { applyLocalContentPatch, LOCAL_WORKSPACE_ID, useLocalNotesStore } from "./localNotesStore";
import { NoteEditor } from "./NoteEditor";
import { NoteLinksPanel } from "./NoteLinksPanel";
import { NotePublishingBar } from "./NotePublishingBar";
import { NoteTagsRow } from "./NoteTagsRow";
import { NotesPortabilityPanel } from "./NotesPortabilityPanel";
import type { ExportedNotePayload } from "./notesImportExport";
import { useOptionalNotesAdvisorAgentsShell } from "./NotesAdvisorAgentsShellContext";
import { useNotesWorkspaceShortcuts } from "./NotesWorkspaceShortcutsProvider";

export function AtlasNotesApp() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeWorkspaceId, isLoading: workspacesLoading } = useActiveWorkspace();
  const { data: bootstrapData, isLoading: bootstrapLoading, isError: bootstrapError } = useQuery({
    queryKey: ["notes-app", "bootstrap", activeWorkspaceId ?? "default"],
    queryFn: () => fetchNotesBootstrap(activeWorkspaceId ?? undefined),
    enabled: !workspacesLoading,
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
  const deleteTagLocal = useLocalNotesStore((s) => s.deleteTag);
  const getForwardLinks = useLocalNotesStore((s) => s.getForwardLinks);
  const getBacklinks = useLocalNotesStore((s) => s.getBacklinks);

  const workspaceId = localMode ? LOCAL_WORKSPACE_ID : bootstrapData?.workspace.id;
  const defaultFolderId = localMode ? localDefaultFolderId : bootstrapData?.defaultFolderId;

  const topFolders = useMemo(() => {
    const list = localMode ? localFolders : (bootstrapData?.folders ?? []);
    return [...list].filter((f) => f.parentId === null).sort((a, b) => a.position - b.position);
  }, [localMode, localFolders, bootstrapData?.folders]);

  const [folderFilter, setFolderFilter] = useState<string | "all">("all");

  /* Pick a default notebook once the list loads (no more “All notes” in the UI). */
  useEffect(() => {
    if (folderFilter !== "all") return;
    if (!topFolders.length) return;
    const pick =
      defaultFolderId && topFolders.some((f) => f.id === defaultFolderId)
        ? defaultFolderId
        : topFolders[0]!.id;
    setFolderFilter(pick);
  }, [topFolders, defaultFolderId, folderFilter]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  /** Workspace-wide search results (only while universal search mode is on). */
  const [universalSearchHits, setUniversalSearchHits] = useState<AtlasNoteDto[] | null>(null);
  const [universalSearch, setUniversalSearch] = useState(false);
  const beforeUniversalRef = useRef<{ folderFilter: string | "all"; selectedId: string | null } | null>(null);
  const urlNoteApplied = useRef(false);
  const { setActiveNotesFolderId } = useNotesWorkspaceShortcuts();
  const notesAdvisorSetPayload = useOptionalNotesAdvisorAgentsShell()?.setNotesAdvisorPayload;

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

  const notebookClientFiltered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const title = (n.title || "").toLowerCase();
      const prev = (n.previewText || "").toLowerCase();
      return title.includes(q) || prev.includes(q);
    });
  }, [notes, searchQ]);

  const displayList = useMemo(() => {
    if (universalSearch) {
      const q = searchQ.trim();
      if (!q) return [];
      return universalSearchHits ?? [];
    }
    return notebookClientFiltered;
  }, [universalSearch, searchQ, universalSearchHits, notebookClientFiltered]);

  /* Debounced search across all notebooks while globe mode is on. */
  useEffect(() => {
    if (!universalSearch) {
      setUniversalSearchHits(null);
      return;
    }
    const q = searchQ.trim();
    if (!q) {
      setUniversalSearchHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        if (localMode) {
          setUniversalSearchHits(searchNotesLocal(q));
          return;
        }
        if (!workspaceId) return;
        try {
          const hits = await searchNotes(workspaceId, q);
          setUniversalSearchHits(hits);
        } catch {
          setUniversalSearchHits([]);
        }
      })();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [universalSearch, searchQ, localMode, workspaceId, searchNotesLocal]);

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
      const folderId =
        folderFilter === "all"
          ? localMode
            ? localDefaultFolderId!
            : bootstrapData!.defaultFolderId!
          : folderFilter;
      if (localMode) {
        return createNoteLocal(folderId);
      }
      if (!workspaceId || !bootstrapData) throw new Error("No workspace");
      return createNote({ workspaceId, folderId });
    },
    onSuccess: (note) => {
      if (!localMode) void qc.invalidateQueries({ queryKey: ["notes-app"] });
      setSelectedId(note.id);
    },
  });

  const newFolderMut = useMutation({
    mutationFn: () => {
      if (localMode) return Promise.resolve(createFolderLocal());
      if (!workspaceId) throw new Error("No workspace");
      return createFolder({ workspaceId });
    },
    onSuccess: () => {
      if (!localMode) invalidateAll();
    },
  });

  const pickNotebook = (id: string | "all") => {
    setFolderFilter(id);
    if (universalSearch) {
      setUniversalSearch(false);
      beforeUniversalRef.current = null;
      setUniversalSearchHits(null);
      setSearchQ("");
    }
  };

  const setUniversalSearchMode = (on: boolean) => {
    if (on) {
      beforeUniversalRef.current = { folderFilter, selectedId };
      setUniversalSearch(true);
      setUniversalSearchHits([]);
      return;
    }
    setUniversalSearch(false);
    setUniversalSearchHits(null);
    setSearchQ("");
    const snap = beforeUniversalRef.current;
    beforeUniversalRef.current = null;
    if (snap) {
      setFolderFilter(snap.folderFilter);
      setSelectedId(snap.selectedId);
    }
  };

  const captureFolderForShortcuts =
    workspaceId && defaultFolderId
      ? folderFilter === "all"
        ? defaultFolderId
        : folderFilter
      : null;

  useEffect(() => {
    if (!captureFolderForShortcuts) {
      setActiveNotesFolderId(null);
      return;
    }
    setActiveNotesFolderId(captureFolderForShortcuts);
    return () => setActiveNotesFolderId(null);
  }, [captureFolderForShortcuts, setActiveNotesFolderId]);

  useEffect(() => {
    if (!notesAdvisorSetPayload) return;
    if (bootstrapLoading || !workspaceId) {
      notesAdvisorSetPayload(null);
      return;
    }
    if (selected) {
      const bodyPlain = extractPlainTextFromDoc(selected.contentJson, 7200);
      const bodyBlock = (bodyPlain || selected.previewText || "").trim();
      notesAdvisorSetPayload({
        workspaceId,
        contextHint: `Title: ${selected.title}\n\nBody:\n${bodyBlock}`.slice(0, 8000),
        noteAi: {
          note: selected,
          offline: localMode,
          onUpdated: () => void qc.invalidateQueries({ queryKey: ["notes-app"] }),
        },
      });
    } else {
      notesAdvisorSetPayload({
        workspaceId,
        contextHint: "",
      });
    }
    return () => {
      notesAdvisorSetPayload(null);
    };
  }, [bootstrapLoading, localMode, notesAdvisorSetPayload, qc, selected, workspaceId]);

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
        Loading Notebooks…
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

  const forwardOverride = localMode && selected ? getForwardLinks(selected.id) : undefined;
  const backOverride = localMode && selected ? getBacklinks(selected.id) : undefined;

  return (
    <div className="flex min-h-[min(70vh,720px)] flex-1 flex-col gap-3">
      {localMode ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <p>
            <span className="font-medium">Using browser storage</span> — the Notebooks API is unavailable. Your notes
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
          onPickNotebook={pickNotebook}
          universalSearch={universalSearch}
          onUniversalSearchChange={setUniversalSearchMode}
          notesLoading={!localMode && notesQuery.isLoading}
          displayList={displayList}
          resolvedSelectedId={resolvedSelectedId}
          setSelectedId={setSelectedId}
          searchQ={searchQ}
          setSearchQ={setSearchQ}
          createPending={createMut.isPending}
          onNewNote={() => createMut.mutate()}
          onNewFolder={() => newFolderMut.mutate()}
          newFolderPending={newFolderMut.isPending}
          routingWorkspaceId={localMode ? undefined : workspaceId ?? undefined}
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
          onPatchFolder={async (folderId, payload) => {
            try {
              if (localMode) {
                patchFolderStore(folderId, { title: payload.title, rowAccentColor: payload.rowAccentColor });
                return;
              }
              await patchFolderApi(folderId, { title: payload.title, rowAccentColor: payload.rowAccentColor });
              invalidateAll();
            } catch (e: unknown) {
              const msg =
                typeof e === "object" && e !== null && "response" in e
                  ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
                  : e instanceof Error
                    ? e.message
                    : "Could not update notebook";
              window.alert(msg ?? "Could not update notebook");
            }
          }}
          onPatchNote={async (noteId, payload) => {
            try {
              if (localMode) {
                patchNoteLocal(noteId, { title: payload.title, rowAccentColor: payload.rowAccentColor });
                return;
              }
              await patchNote(noteId, { title: payload.title, rowAccentColor: payload.rowAccentColor });
              void qc.invalidateQueries({ queryKey: ["notes-app"] });
            } catch (e: unknown) {
              const msg =
                typeof e === "object" && e !== null && "response" in e
                  ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
                  : e instanceof Error
                    ? e.message
                    : "Could not update note";
              window.alert(msg ?? "Could not update note");
            }
          }}
          onDeleteNote={async (noteId) => {
            try {
              if (localMode) {
                deleteNoteLocal(noteId);
              } else {
                await deleteNote(noteId);
                void qc.invalidateQueries({ queryKey: ["notes-app"] });
              }
              setSelectedId((prev) => (prev === noteId ? null : prev));
            } catch (e: unknown) {
              const msg =
                typeof e === "object" && e !== null && "response" in e
                  ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
                  : e instanceof Error
                    ? e.message
                    : "Failed to delete note";
              window.alert(msg ?? "Failed to delete note");
            }
          }}
          onDeleteFolder={async (folderId) => {
            if (topFolders.length <= 1) {
              window.alert("Create a second notebook before deleting this one. Every workspace needs at least one notebook.");
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
                    : "Failed to delete notebook";
              window.alert(msg ?? "Failed to delete notebook");
            }
          }}
          canReorderNotes={
            !universalSearch && folderFilter !== "all" && searchQ.trim() === ""
          }
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
                <RoutingSourceBadge source={selected.routingSource} className="shrink-0" />
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

              <div className="mt-4 shrink-0 border-t border-border pt-4">
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
                  deleteTagFn={localMode ? async (tagId) => Promise.resolve(deleteTagLocal(tagId)) : undefined}
                  mailClerkAutotagUnavailable={localMode}
                />
              </div>
              <div className="mt-4 shrink-0 border-t border-border pt-4">
                <NoteLinksPanel
                  noteId={selected.id}
                  onOpenNote={(id) => setSelectedId(id)}
                  forwardLinksOverride={forwardOverride}
                  backLinksOverride={backOverride}
                />
              </div>
              <div className="mt-4 shrink-0 border-t border-border pt-4">
                <div className="rounded-lg border border-border bg-muted/15 p-4">
                  <NotePublishingBar
                    key={selected.id}
                    embedded
                    note={selected}
                    offline={localMode}
                    onUpdated={() => void qc.invalidateQueries({ queryKey: ["notes-app"] })}
                  />
                  <div className="mt-4 border-t border-border pt-4">
                    <NotesPortabilityPanel
                      embedded
                      localMode={localMode}
                      selected={selected}
                      exportableNotes={exportableNotes}
                      onImportPayloads={importPayloads}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <FileText className="size-10 opacity-40" />
              <p className="text-sm">Select or create a note</p>
            </div>
          )}
        </section>
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
