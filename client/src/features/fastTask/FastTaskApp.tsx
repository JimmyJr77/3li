import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GalleryHorizontal, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoutingSourceBadge } from "@/components/shared/RoutingSourceBadge";
import { Input } from "@/components/ui/input";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { fetchMe } from "@/features/auth/api";
import { fetchNotesBootstrap, patchNote } from "@/features/notes/api";
import { applyLocalContentPatch, LOCAL_WORKSPACE_ID, useLocalNotesStore } from "@/features/notes/localNotesStore";
import { NoteLabelsSection } from "@/features/notes/NoteLabelsSection";
import { NoteEditor } from "@/features/notes/NoteEditor";
import type { AtlasNoteDto } from "@/features/notes/types";
import { filterFastTaskBoards, unionNoteLabels } from "./fastTaskFilterUtils";
import { FastTaskAssigneeStrip } from "./FastTaskAssigneeStrip";
import { FastTaskIndexer, type FastTaskIndexerView } from "./FastTaskIndexer";
import { ensureFastTaskBoards } from "./ensureFastTaskBoards";
import { useFastTaskMetaStore, type FastTaskMember } from "./fastTaskMetaStore";

const FAST_TASK_SCROLL_BLEED = "-mx-4 w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)]";

/** Stable fallback so the Zustand selector does not return a new [] every read. */
const EMPTY_MEMBERS: FastTaskMember[] = [];

function useFastTaskBootstrap() {
  const { activeWorkspaceId, isLoading: workspacesLoading } = useActiveWorkspace();
  return useQuery({
    queryKey: ["notes-app", "bootstrap", activeWorkspaceId ?? "default"],
    queryFn: () => fetchNotesBootstrap(activeWorkspaceId ?? undefined),
    enabled: !workspacesLoading,
    retry: false,
  });
}

function useFastTaskBoardsQuery(localMode: boolean, bootstrapReady: boolean) {
  const { activeWorkspaceId, isLoading: workspacesLoading } = useActiveWorkspace();
  return useQuery({
    queryKey: ["fast-task-boards", localMode ? "local" : activeWorkspaceId],
    queryFn: () =>
      ensureFastTaskBoards({
        workspaceId: activeWorkspaceId,
        localMode,
      }),
    enabled: !workspacesLoading && bootstrapReady && (localMode || Boolean(activeWorkspaceId)),
  });
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
      data-atlas-note-title
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

function FastTaskNoteCard({
  note,
  localMode,
  workspaceKey,
  members,
  brandId,
  defaultLabelBoardId,
  onTitleCommit,
  onInvalidateFolder,
}: {
  note: AtlasNoteDto;
  localMode: boolean;
  workspaceKey: string;
  members: FastTaskMember[];
  brandId: string | null;
  defaultLabelBoardId: string | null;
  onTitleCommit: (title: string) => void | Promise<void>;
  onInvalidateFolder: () => void;
}) {
  const qc = useQueryClient();
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 border-b border-border pb-3">
        <AtlasNoteTitleInput key={note.id} note={note} onCommit={onTitleCommit} />
        <RoutingSourceBadge source={note.routingSource} className="shrink-0" />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <NoteEditor
          key={note.id}
          note={note}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["fast-task-boards"] });
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
      <div className="mt-3 shrink-0 border-t border-border pt-1">
        <NoteLabelsSection
          note={note}
          brandId={brandId}
          defaultLabelBoardId={defaultLabelBoardId}
          offline={localMode}
          onAfterInvalidateNotes={onInvalidateFolder}
          hideAutotag
        />
      </div>
      <FastTaskAssigneeStrip workspaceKey={workspaceKey} noteId={note.id} members={members} />
    </div>
  );
}

export function FastTaskApp() {
  const qc = useQueryClient();
  const { activeWorkspaceId } = useActiveWorkspace();
  const boardWrapRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [indexerView, setIndexerView] = useState<FastTaskIndexerView>("taskboard");
  const [ownerFilterId, setOwnerFilterId] = useState<string | null>(null);
  const [labelFilterId, setLabelFilterId] = useState<string | null>(null);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);

  const bootstrapQ = useFastTaskBootstrap();
  const localMode = !bootstrapQ.isLoading && (bootstrapQ.isError || !bootstrapQ.data);
  const bootstrapReady = bootstrapQ.isSuccess || bootstrapQ.isError;
  const boardsQ = useFastTaskBoardsQuery(localMode, bootstrapReady);

  const workspaceKey = localMode ? LOCAL_WORKSPACE_ID : (activeWorkspaceId ?? "");

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    staleTime: 60_000,
  });

  useEffect(() => {
    const u = meQuery.data;
    if (!u || !workspaceKey) return;
    const displayName = u.displayName?.trim() || u.username || u.email || "Me";
    const cur = useFastTaskMetaStore.getState().workspaces[workspaceKey]?.members.find((m) => m.id === u.id);
    if (cur?.displayName === displayName) return;
    useFastTaskMetaStore.getState().upsertMember(workspaceKey, {
      id: u.id,
      displayName,
    });
  }, [meQuery.data, workspaceKey]);

  const allLocalNotes = useLocalNotesStore((s) => s.notes);
  const membersRaw = useFastTaskMetaStore((s) => s.workspaces[workspaceKey]?.members ?? EMPTY_MEMBERS);
  const membersSorted = useMemo(
    () =>
      [...membersRaw].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
      ),
    [membersRaw],
  );

  const folderNotes = useMemo((): AtlasNoteDto[] => {
    if (!boardsQ.data?.notes?.length) return [];
    if (boardsQ.data.localMode) {
      return boardsQ.data.notes.map((ref) => allLocalNotes.find((n) => n.id === ref.id) ?? ref);
    }
    return [...boardsQ.data.notes];
  }, [boardsQ.data, allLocalNotes]);

  const getAssign = useCallback(
    (noteId: string) => useFastTaskMetaStore.getState().getBoardAssign(workspaceKey, noteId),
    [workspaceKey],
  );

  const visibleNotes = useMemo(
    () =>
      filterFastTaskBoards(folderNotes, {
        indexerView,
        ownerFilterId,
        labelFilterId,
        getAssign,
      }),
    [folderNotes, indexerView, ownerFilterId, labelFilterId, getAssign],
  );

  const labelOptions = useMemo(() => unionNoteLabels(folderNotes), [folderNotes]);

  const scrollBoardToCenter = useCallback((noteId: string) => {
    boardWrapRefs.current.get(noteId)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActiveBoardId(noteId);
  }, []);

  const onInvalidateFolder = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["fast-task-boards"] });
  }, [qc]);

  const patchTitleMut = useMutation({
    mutationFn: async ({ noteId, title, offline }: { noteId: string; title: string; offline: boolean }) => {
      if (offline) {
        useLocalNotesStore.getState().patchNote(noteId, { title });
        return;
      }
      await patchNote(noteId, { title });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notes-app"] });
      void qc.invalidateQueries({ queryKey: ["fast-task-boards"] });
    },
  });

  const indexerHighlightId = useMemo(() => {
    if (activeBoardId && visibleNotes.some((n) => n.id === activeBoardId)) return activeBoardId;
    return visibleNotes[0]?.id ?? null;
  }, [activeBoardId, visibleNotes]);

  if (boardsQ.isPending || bootstrapQ.isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" aria-hidden />
        <p className="text-sm">Preparing Fast Task…</p>
      </div>
    );
  }

  if (boardsQ.isError || !boardsQ.data) {
    return (
      <p className="text-destructive text-sm">
        {boardsQ.error instanceof Error ? boardsQ.error.message : "Could not load Fast Task."}
      </p>
    );
  }

  const bootstrap = boardsQ.data.bootstrap;
  const brandId = bootstrap?.workspace.brandId ?? null;
  const defaultLabelBoardId = bootstrap?.defaultLabelBoardId ?? null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        className={`min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border ${FAST_TASK_SCROLL_BLEED}`}
        onScroll={(e) => {
          const root = e.currentTarget;
          const mid = root.scrollLeft + root.clientWidth / 2;
          let best: string | null = null;
          let bestDist = Number.POSITIVE_INFINITY;
          for (const n of visibleNotes) {
            const el = boardWrapRefs.current.get(n.id);
            if (!el) continue;
            const c = el.offsetLeft + el.offsetWidth / 2;
            const d = Math.abs(c - mid);
            if (d < bestDist) {
              bestDist = d;
              best = n.id;
            }
          }
          if (best) {
            setActiveBoardId((prev) => (prev === best ? prev : best));
          }
        }}
      >
        <div
          className="flex h-full min-h-[min(72vh,720px)] items-stretch gap-4 py-1 pl-4 pr-0 sm:pl-6 md:gap-5 lg:pl-8"
          style={{ width: "max-content" }}
        >
          <FastTaskIndexer
            indexerView={indexerView}
            onIndexerViewChange={(v) => {
              setIndexerView(v);
              if (v === "taskboard") setOwnerFilterId(null);
            }}
            labelFilterId={labelFilterId}
            onLabelFilterChange={setLabelFilterId}
            labelOptions={labelOptions}
            allNotesSorted={folderNotes}
            membersSorted={membersSorted}
            ownerFilterId={ownerFilterId}
            onOwnerFilterChange={setOwnerFilterId}
            onCenterBoard={scrollBoardToCenter}
            activeBoardId={indexerHighlightId}
          />
          {visibleNotes.map((note) => (
            <div
              key={note.id}
              id={`fast-task-board-${note.id}`}
              ref={(el) => {
                if (el) boardWrapRefs.current.set(note.id, el);
                else boardWrapRefs.current.delete(note.id);
              }}
              data-slot="card"
              className="flex h-full min-h-0 w-[min(90vw,28rem)] shrink-0 snap-center snap-always flex-col rounded-xl border border-border bg-card p-4 shadow-md md:w-[30rem] md:p-5"
            >
              <FastTaskNoteCard
                note={note}
                localMode={localMode}
                workspaceKey={workspaceKey}
                members={membersSorted}
                brandId={brandId}
                defaultLabelBoardId={defaultLabelBoardId}
                onTitleCommit={(title) =>
                  patchTitleMut.mutate({
                    noteId: note.id,
                    title,
                    offline: localMode,
                  })
                }
                onInvalidateFolder={onInvalidateFolder}
              />
            </div>
          ))}
        </div>
      </div>

      <p className="mx-auto flex w-full max-w-none shrink-0 flex-nowrap items-center justify-center gap-1.5 overflow-x-auto px-4 py-3 text-center text-nowrap text-[11px] text-muted-foreground">
        <GalleryHorizontal className="size-3.5 shrink-0 opacity-70" aria-hidden />
        Use the left rail to center a board, or scroll
      </p>
    </div>
  );
}
