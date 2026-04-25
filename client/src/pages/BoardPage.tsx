import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Kanban, LayoutGrid, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { PMAgentSheet, buildBoardContextSnapshot } from "@/features/agents/PMAgentSheet";
import { BoardKanban } from "@/features/taskflow/BoardKanban";
import { BoardTable } from "@/features/taskflow/BoardTable";
import { TaskDetailSheet } from "@/features/taskflow/TaskDetailSheet";
import {
  boardFiltersActive,
  filterBoard,
  type BoardFilterState,
} from "@/features/taskflow/filters";
import { createBoardList, fetchBoard, fetchMyTicketLabels, patchBoard } from "@/features/taskflow/api";
import type { BoardDto, TaskFlowTask } from "@/features/taskflow/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type View = "board" | "table";

function flattenBoardTasks(board: BoardDto): TaskFlowTask[] {
  return board.lists.flatMap((list) =>
    list.tasks.map((t) => ({
      ...t,
      list: {
        id: list.id,
        title: list.title,
        key: list.key,
        position: list.position,
        boardId: board.id,
        board: {
          id: board.id,
          name: board.name,
          workspaceId: board.workspaceId,
        },
      },
    })),
  );
}

const defaultBoardFilters = (): BoardFilterState => ({
  q: "",
  labelId: null,
  completed: "all",
  priority: null,
});

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { activeWorkspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("board");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoardFilterState>(defaultBoardFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const boardQuery = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => fetchBoard(boardId!),
    enabled: Boolean(boardId),
  });

  const board = boardQuery.data;

  const myTicketLabelsQuery = useQuery({
    queryKey: ["my-ticket-labels", board?.brandId],
    queryFn: () => fetchMyTicketLabels(board!.brandId!),
    enabled: Boolean(board?.brandId),
  });

  const archiveBoardMutation = useMutation({
    mutationFn: (archived: boolean) => patchBoard(board!.id, { archived }),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", next.id], next);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["archived-boards"] });
    },
  });

  const displayBoard = useMemo(
    () => (board ? filterBoard(board, filters) : null),
    [board, filters],
  );

  const filtersOn = board ? boardFiltersActive(filters) : false;
  const boardArchived = Boolean(board?.archivedAt);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId || !board) return null;
    for (const list of board.lists) {
      const t = list.tasks.find((x) => x.id === selectedTaskId);
      if (t) return t;
    }
    return null;
  }, [board, selectedTaskId]);

  const tableTasks = useMemo(
    () => (displayBoard ? flattenBoardTasks(displayBoard) : []),
    [displayBoard],
  );

  const addListMutation = useMutation({
    mutationFn: (title: string) => createBoardList(board!.id, title.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", board?.id] });
    },
  });

  const requestAddSubBoard = () => {
    if (boardArchived) return;
    const title = window.prompt("Sub-board name");
    if (!title?.trim()) return;
    addListMutation.mutate(title.trim());
  };

  const requestArchiveBoard = () => {
    if (
      !window.confirm(
        "Archive this project board? It will disappear from your project spaces list until you restore it from Project Boards → Archived.",
      )
    ) {
      return;
    }
    archiveBoardMutation.mutate(true);
  };

  if (!boardId) {
    return (
      <p className="text-sm text-destructive">
        Missing board in URL. Open a board from{" "}
        <Link to="/app/boards" className="font-medium text-primary underline-offset-4 hover:underline">
          Project Boards
        </Link>
        .
      </p>
    );
  }

  if (boardQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Loading board…
      </div>
    );
  }

  if (boardQuery.isError || !board) {
    return (
      <p className="text-sm text-destructive">
        Could not load the board. Is the API running and the database migrated?
      </p>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4">
      <div className="text-sm">
        <Link
          to="/app/boards"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Project Boards
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-x-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Kanban className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <h1 className="max-w-xl text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              {board.name}
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="flex rounded-lg border p-0.5">
              <Button
                type="button"
                variant={view === "board" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1"
                onClick={() => setView("board")}
              >
                <Kanban className="size-4" />
                Board
              </Button>
              <Button
                type="button"
                variant={view === "table" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1"
                onClick={() => setView("table")}
              >
                <LayoutGrid className="size-4" />
                Table
              </Button>
            </div>
            <Button
              type="button"
              variant={filtersOpen ? "secondary" : "outline"}
              size="sm"
              className="gap-1"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <Search className="size-4" />
              Search & filters
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["board", board.id] })}
            >
              Refresh
            </Button>
            {activeWorkspaceId ? (
              <PMAgentSheet
                workspaceId={activeWorkspaceId}
                contextText={buildBoardContextSnapshot(board)}
                surfaceLabel="Project board snapshot"
              />
            ) : null}
            {boardArchived ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-1"
                disabled={archiveBoardMutation.isPending}
                onClick={() => archiveBoardMutation.mutate(false)}
              >
                <ArchiveRestore className="size-4" />
                Restore board
              </Button>
            ) : null}
          </div>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Drag columns by the grip, move cards between lists, open a card for detail, or use the table view. Filters
          pause drag-and-drop.
        </p>
      </div>

      {boardArchived ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p className="text-foreground">
            This board is <span className="font-medium">archived</span>. Column and card editing is paused
            until you restore it.
          </p>
          <Button
            type="button"
            size="sm"
            className="gap-1 shrink-0"
            onClick={() => archiveBoardMutation.mutate(false)}
            disabled={archiveBoardMutation.isPending}
          >
            <ArchiveRestore className="size-4" />
            Restore
          </Button>
        </div>
      ) : null}

      {filtersOpen ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/15 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[180px] flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Title or description…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
        </div>
        <div className="w-full min-w-[140px] space-y-1 sm:w-auto">
          <Label className="text-xs text-muted-foreground">Label</Label>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm sm:w-[160px]"
            value={filters.labelId ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, labelId: e.target.value || null }))
            }
          >
            <option value="">Any</option>
            <optgroup label="Board labels">
              {board.labels.map((lb) => (
                <option key={lb.id} value={lb.id}>
                  {lb.name}
                </option>
              ))}
            </optgroup>
            {(myTicketLabelsQuery.data ?? []).length > 0 ? (
              <optgroup label="Your labels (this brand)">
                {(myTicketLabelsQuery.data ?? []).map((lb) => (
                  <option key={lb.id} value={lb.id}>
                    {lb.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>
        <div className="w-full min-w-[120px] space-y-1 sm:w-auto">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={filters.completed}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                completed: e.target.value as BoardFilterState["completed"],
              }))
            }
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div className="w-full min-w-[120px] space-y-1 sm:w-auto">
          <Label className="text-xs text-muted-foreground">Priority</Label>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={filters.priority ?? "all"}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                priority: e.target.value === "all" ? null : e.target.value,
              }))
            }
          >
            <option value="all">Any</option>
            {["none", "low", "medium", "high", "urgent"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => setFilters(defaultBoardFilters())}
          disabled={!filtersOn}
        >
          Clear filters
        </Button>
        </div>
      ) : null}

      {view === "board" && displayBoard ? (
        <BoardKanban
          board={displayBoard}
          dragDisabled={filtersOn || boardArchived}
          onAddSubBoard={requestAddSubBoard}
          onArchiveBoard={boardArchived ? undefined : requestArchiveBoard}
          boardArchived={boardArchived}
          onOpenTask={(t) => {
            setSelectedTaskId(t.id);
          }}
        />
      ) : view === "table" ? (
        <BoardTable
          tasks={tableTasks}
          onRowClick={(t) => {
            setSelectedTaskId(t.id);
          }}
        />
      ) : null}

      <TaskDetailSheet
        board={board}
        boardArchived={boardArchived}
        task={selectedTask}
        open={Boolean(selectedTaskId)}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId(null);
        }}
      />
    </div>
  );
}
