import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Kanban,
  LayoutGrid,
  ListFilter,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PMAgentSheet, buildTasksContextSnapshot } from "@/features/agents/PMAgentSheet";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { useArchivesVisibility } from "@/context/ArchivesVisibilityContext";
import {
  fetchAllTasks,
  fetchBoard,
  fetchWorkspaceUserPreferences,
  patchTask,
  patchWorkspaceUserPreferences,
} from "@/features/taskflow/api";
import { BoardTable } from "@/features/taskflow/BoardTable";
import { TaskDetailSheet } from "@/features/taskflow/TaskDetailSheet";
import type { TaskFlowTask } from "@/features/taskflow/types";
import {
  normalizeTrackerStatus,
  TRACKER_LABELS,
  TRACKER_STATUSES,
  type TrackerStatus,
} from "@/features/taskflow/trackerMeta";
import {
  loadColumnVisibility,
  saveColumnVisibility,
  type TicketTrackerColumnVisibility,
} from "@/features/taskflow/ticketTrackerPrefs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  RightAppSheetResizeHandle,
  rightAppSheetContentClassName,
  useResizableRightAppSheetWidth,
} from "@/hooks/useResizableRightAppSheetWidth";
import { cn } from "@/lib/utils";

type TicketTrackerView = "board" | "table";

const TT_PREFIX = "tt-lane:";

function ttLaneId(status: TrackerStatus) {
  return `${TT_PREFIX}${status}`;
}

function findTrackerContainer(id: string, items: Record<string, string[]>): string | undefined {
  if (id in items) return id;
  for (const [cid, ids] of Object.entries(items)) {
    if (ids.includes(id)) return cid;
  }
  return undefined;
}

function buildTrackerItems(tasks: TaskFlowTask[]): Record<string, string[]> {
  const o: Record<string, string[]> = {};
  for (const st of TRACKER_STATUSES) {
    o[ttLaneId(st)] = [];
  }
  for (const t of tasks) {
    const st = normalizeTrackerStatus(t.trackerStatus);
    o[ttLaneId(st)].push(t.id);
  }
  return o;
}

function buildTaskMap(tasks: TaskFlowTask[]): Map<string, TaskFlowTask> {
  return new Map(tasks.map((t) => [t.id, t]));
}

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.5" } },
  }),
};

function TrackerTicketCard({
  task,
  onOpen,
  colorByBoard,
}: {
  task: TaskFlowTask;
  onOpen: (t: TaskFlowTask) => void;
  colorByBoard?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const accent = task.list?.board?.accentColor;
  const useAccent = Boolean(colorByBoard && accent);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(useAccent ? { borderColor: accent } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card px-2 py-2 text-sm shadow-sm",
        useAccent && "border-2",
        isDragging && "z-10 opacity-50",
      )}
    >
      <div className="flex gap-1">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none text-muted-foreground"
          {...attributes}
          {...listeners}
          aria-label="Drag ticket"
        >
          <span className="text-xs">⋮⋮</span>
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(task)}>
          <p className="font-medium leading-snug">{task.title}</p>
          {task.list ? (
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {task.list.board.name} · {task.list.title}
            </p>
          ) : null}
        </button>
      </div>
    </div>
  );
}

function TrackerColumn({
  status,
  taskIds,
  taskMap,
  onOpen,
  colorByBoard,
}: {
  status: TrackerStatus;
  taskIds: string[];
  taskMap: Map<string, TaskFlowTask>;
  onOpen: (t: TaskFlowTask) => void;
  colorByBoard?: boolean;
}) {
  const laneId = ttLaneId(status);
  const { setNodeRef, isOver } = useDroppable({ id: laneId });

  return (
    <div className="flex min-h-0 min-w-[10rem] flex-1 basis-0 flex-col rounded-xl border bg-muted/15 p-2">
      <div className="mb-2 shrink-0 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {TRACKER_LABELS[status]}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain rounded-md p-1 transition-colors",
          isOver && "bg-primary/10 ring-2 ring-primary/25",
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {taskIds.map((id) => {
            const task = taskMap.get(id);
            if (!task) return null;
            return (
              <TrackerTicketCard key={id} task={task} onOpen={onOpen} colorByBoard={colorByBoard} />
            );
          })}
        </SortableContext>
      </div>
    </div>
  );
}

export function MyTasksPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [labelId, setLabelId] = useState("");
  const [boardId, setBoardId] = useState("");
  const [subBoardId, setSubBoardId] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [completed, setCompleted] = useState<"all" | "true" | "false">("all");
  const [priority, setPriority] = useState("all");
  const [sort, setSort] = useState("dueDate:asc");
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<TicketTrackerColumnVisibility>(() =>
    loadColumnVisibility(),
  );
  const [showFilters, setShowFilters] = useState(true);
  const [trackerSettingsOpen, setTrackerSettingsOpen] = useState(false);
  const [view, setView] = useState<TicketTrackerView>("board");
  const trackerSettingsSheetSizing = useResizableRightAppSheetWidth({ open: trackerSettingsOpen });

  const { activeWorkspace, activeWorkspaceId, isLoading: wsLoading } = useActiveWorkspace();
  const { showArchives } = useArchivesVisibility();

  useEffect(() => {
    if (!showArchives) {
      setArchivedOnly(false);
    }
  }, [showArchives]);

  useEffect(() => {
    saveColumnVisibility(columnVisibility);
  }, [columnVisibility]);

  const defaultBoardId = activeWorkspace?.projectSpaces?.[0]?.boards?.[0]?.id ?? null;

  const boardQuery = useQuery({
    queryKey: ["board", defaultBoardId],
    queryFn: () => fetchBoard(defaultBoardId!),
    enabled: Boolean(defaultBoardId),
  });
  const filterBoardLabels = boardQuery.data?.labels ?? [];

  const filterLabelsBoardId = boardId || defaultBoardId;
  const labelsBoardQuery = useQuery({
    queryKey: ["board", filterLabelsBoardId],
    queryFn: () => fetchBoard(filterLabelsBoardId!),
    enabled: Boolean(filterLabelsBoardId),
  });
  const boardLabels = labelsBoardQuery.data?.labels ?? filterBoardLabels;

  const subBoardOptions = useMemo(() => {
    if (!labelsBoardQuery.data) return [];
    return labelsBoardQuery.data.lists.map((l) => ({ id: l.id, title: l.title }));
  }, [labelsBoardQuery.data]);

  const workspaceId = activeWorkspaceId;
  const archivedFilterActive = showArchives && archivedOnly;

  const workspacePrefsQuery = useQuery({
    queryKey: ["workspace-user-prefs", workspaceId],
    queryFn: () => fetchWorkspaceUserPreferences(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const colorByBoard = workspacePrefsQuery.data?.ticketTrackerColorByBoard === true;

  const workspacePrefsMutation = useMutation({
    mutationFn: (ticketTrackerColorByBoard: boolean) =>
      patchWorkspaceUserPreferences(workspaceId!, { ticketTrackerColorByBoard }),
    onSuccess: (data) => {
      queryClient.setQueryData(["workspace-user-prefs", workspaceId], data);
    },
  });

  const params = useMemo(
    () => ({
      workspaceId: workspaceId!,
      q: q.trim() || undefined,
      labelId: labelId || undefined,
      boardId: boardId || undefined,
      subBoardId: subBoardId || undefined,
      assigneeUserId: assigneeUserId.trim() || undefined,
      completed: completed === "all" ? undefined : completed,
      priority: priority === "all" ? undefined : priority,
      sort,
      ...(archivedFilterActive ? { archived: "true" as const } : {}),
    }),
    [workspaceId, q, labelId, boardId, subBoardId, assigneeUserId, completed, priority, sort, archivedFilterActive],
  );

  const tasksQuery = useQuery({
    queryKey: ["tasks", "flat", params],
    queryFn: () => fetchAllTasks(params),
    enabled: Boolean(workspaceId) && !wsLoading,
  });

  const tasks = tasksQuery.data ?? [];
  const loading = wsLoading || (Boolean(workspaceId) && tasksQuery.isLoading);

  const tasksPmContext = useMemo(
    () => buildTasksContextSnapshot("Filtered tickets (Ticket Tracker)", tasks),
    [tasks],
  );

  const moveTrackerMutation = useMutation({
    mutationFn: ({ taskId, trackerStatus }: { taskId: string; trackerStatus: TrackerStatus }) =>
      patchTask(taskId, { trackerStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const [items, setItems] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const next = buildTrackerItems(tasks);
    itemsRef.current = next;
    setItems(next);
  }, [tasks]);

  const taskMap = useMemo(() => buildTaskMap(tasks), [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id != null ? String(over.id) : null;
    if (!overId) return;

    setItems((prev) => {
      const activeContainer = findTrackerContainer(String(active.id), prev);
      const overContainer = findTrackerContainer(overId, prev);
      if (!activeContainer || !overContainer || activeContainer === overContainer) return prev;

      const activeItems = [...prev[activeContainer]];
      const overItems = [...prev[overContainer]];
      const activeIndex = activeItems.indexOf(String(active.id));
      if (activeIndex === -1) return prev;

      const [moved] = activeItems.splice(activeIndex, 1);
      const overIndex = overItems.indexOf(overId);

      let newIndex: number;
      if (overId in prev) {
        newIndex = overItems.length;
      } else {
        const isBelowOver =
          over &&
          active.rect.current.translated &&
          over.rect &&
          active.rect.current.translated.top > over.rect.top + over.rect.height;
        const modifier = isBelowOver ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length;
      }

      const nextOver = [...overItems];
      nextOver.splice(newIndex, 0, moved);
      const next = { ...prev, [activeContainer]: activeItems, [overContainer]: nextOver };
      itemsRef.current = next;
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;

      const activeContainer = findTrackerContainer(String(active.id), itemsRef.current);
      const overContainer = findTrackerContainer(String(over.id), itemsRef.current);
      if (!activeContainer || !overContainer) return;

      let next = { ...itemsRef.current };

      if (activeContainer === overContainer) {
        const list = [...itemsRef.current[activeContainer]];
        const oldIndex = list.indexOf(String(active.id));
        const newIndex = list.indexOf(String(over.id));
        if (oldIndex !== newIndex && oldIndex >= 0 && newIndex >= 0) {
          next = { ...itemsRef.current, [activeContainer]: arrayMove(list, oldIndex, newIndex) };
        }
      }

      itemsRef.current = next;
      setItems(next);

      const fromStatus = activeContainer.startsWith(TT_PREFIX)
        ? (activeContainer.slice(TT_PREFIX.length) as TrackerStatus)
        : null;
      const toStatus = overContainer.startsWith(TT_PREFIX)
        ? (overContainer.slice(TT_PREFIX.length) as TrackerStatus)
        : null;
      if (fromStatus && toStatus && fromStatus !== toStatus) {
        moveTrackerMutation.mutate({ taskId: String(active.id), trackerStatus: toStatus });
      }
    },
    [moveTrackerMutation],
  );

  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null),
    [tasks, selectedTaskId],
  );

  const activeDragTask = activeId ? taskMap.get(activeId) : undefined;

  const boardOptions = useMemo(() => {
    const ps = activeWorkspace?.projectSpaces ?? [];
    return ps.flatMap((p) => p.boards.map((b) => ({ id: b.id, name: `${p.name} · ${b.name}` })));
  }, [activeWorkspace?.projectSpaces]);

  useEffect(() => {
    if (boardId && !boardOptions.some((b) => b.id === boardId)) {
      setBoardId("");
    }
  }, [boardId, boardOptions]);

  useEffect(() => {
    if (subBoardId && !subBoardOptions.some((s) => s.id === subBoardId)) {
      setSubBoardId("");
    }
  }, [subBoardId, subBoardOptions]);

  const visibleTrackerStatuses = useMemo(
    () => TRACKER_STATUSES.filter((st) => columnVisibility[st]),
    [columnVisibility],
  );

  const hiddenKanbanTaskCount = useMemo(() => {
    let n = 0;
    for (const st of TRACKER_STATUSES) {
      if (columnVisibility[st]) continue;
      n += items[ttLaneId(st)]?.length ?? 0;
    }
    return n;
  }, [items, columnVisibility]);

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    void queryClient.invalidateQueries({ queryKey: ["board"] });
  }, [queryClient]);

  return (
    <div className="flex min-h-[calc(100vh-6rem)] w-full min-w-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Ticket Tracker</h1>
        </div>
        {workspaceId ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
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
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
            >
              <ListFilter className="size-4" />
              Search and Filter
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Refresh tickets"
              onClick={handleRefresh}
              disabled={tasksQuery.isFetching}
            >
              <RefreshCw className={cn("size-4", tasksQuery.isFetching && "animate-spin")} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Tracker view settings"
              onClick={() => setTrackerSettingsOpen(true)}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
            <PMAgentSheet
              workspaceId={workspaceId}
              contextText={tasksPmContext}
              surfaceLabel="Current filtered tickets"
            />
          </div>
        ) : null}
      </div>
      <p className="max-w-2xl shrink-0 text-sm text-muted-foreground">
        All tickets in the active brand workspace, grouped by tracker status. On the board, drag between columns to
        change status, or use the table view. Open a{" "}
        <Link
          to={defaultBoardId ? `/app/boards/${defaultBoardId}` : "/app/boards"}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          project board
        </Link>{" "}
        for sub-board–scoped work.
      </p>

      {showFilters ? (
      <div className="flex shrink-0 flex-col gap-3 rounded-xl border bg-muted/15 p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Title or description…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full space-y-1 lg:min-w-[200px] lg:max-w-xs">
          <Label className="text-xs text-muted-foreground">Board</Label>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={boardId}
            onChange={(e) => {
              setBoardId(e.target.value);
              setSubBoardId("");
            }}
          >
            <option value="">Any board</option>
            {boardOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full space-y-1 lg:w-48">
          <Label className="text-xs text-muted-foreground">Sub-board</Label>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={subBoardId}
            onChange={(e) => setSubBoardId(e.target.value)}
            disabled={!boardId}
          >
            <option value="">Any</option>
            {subBoardOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full space-y-1 lg:w-44">
          <Label className="text-xs text-muted-foreground">Assignee user id</Label>
          <Input
            placeholder="Exact user id…"
            value={assigneeUserId}
            onChange={(e) => setAssigneeUserId(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="w-full space-y-1 lg:w-44">
          <Label className="text-xs text-muted-foreground">Label</Label>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={labelId}
            onChange={(e) => setLabelId(e.target.value)}
          >
            <option value="">Any</option>
            {boardLabels.map((lb) => (
              <option key={lb.id} value={lb.id}>
                {lb.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full space-y-1 lg:w-36">
          <Label className="text-xs text-muted-foreground">Done flag</Label>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={completed}
            onChange={(e) => setCompleted(e.target.value as typeof completed)}
          >
            <option value="all">All</option>
            <option value="false">Open</option>
            <option value="true">Done</option>
          </select>
        </div>
        <div className="w-full space-y-1 lg:w-36">
          <Label className="text-xs text-muted-foreground">Priority</Label>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="all">Any</option>
            {["none", "low", "medium", "high"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full space-y-1 lg:w-44">
          <Label className="text-xs text-muted-foreground">Sort</Label>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="dueDate:asc">Due ↑</option>
            <option value="dueDate:desc">Due ↓</option>
            <option value="updatedAt:desc">Updated</option>
            <option value="title:asc">Title A–Z</option>
            <option value="priority:desc">Priority</option>
          </select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            setLabelId("");
            setBoardId("");
            setSubBoardId("");
            setAssigneeUserId("");
            setCompleted("all");
            setPriority("all");
            setSort("dueDate:asc");
            setArchivedOnly(false);
          }}
        >
          Reset
        </Button>
        {showArchives ? (
          <label className="flex w-full cursor-pointer items-center gap-2 text-sm lg:ml-2 lg:w-auto">
            <input
              type="checkbox"
              checked={archivedOnly}
              className="size-4 rounded border"
              onChange={(e) => setArchivedOnly(e.target.checked)}
            />
            <span className="text-muted-foreground">Archived only</span>
          </label>
        ) : null}
      </div>
      ) : null}

      {view === "board" && hiddenKanbanTaskCount > 0 ? (
        <p className="shrink-0 text-xs text-muted-foreground">
          {hiddenKanbanTaskCount} ticket{hiddenKanbanTaskCount === 1 ? "" : "s"} in hidden columns. Use the
          settings control to show those lanes on the board.
        </p>
      ) : null}

      {loading && (
        <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      )}
      {tasksQuery.isError && (
        <p className="shrink-0 text-sm text-destructive">Could not load tickets. Is the API running?</p>
      )}

      {tasks.length === 0 && !loading && (
        <p className="shrink-0 rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No tickets match. Add tickets on a board or convert ideas from{" "}
          <Link to="/app/brainstorm" className="font-medium text-primary underline-offset-4 hover:underline">
            Brainstorm
          </Link>
          .
        </p>
      )}

      {tasks.length > 0 ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          {view === "board" && visibleTrackerStatuses.length > 0 ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <div className="flex min-h-0 w-full min-w-0 flex-1 items-stretch gap-2 overflow-x-auto pb-0">
                  {visibleTrackerStatuses.map((st) => (
                    <TrackerColumn
                      key={st}
                      status={st}
                      taskIds={items[ttLaneId(st)] ?? []}
                      taskMap={taskMap}
                      onOpen={(t) => setSelectedTaskId(t.id)}
                      colorByBoard={colorByBoard}
                    />
                  ))}
                </div>
                <DragOverlay dropAnimation={dropAnimation}>
                  {activeDragTask ? (
                    <div className="w-56 rounded-lg border bg-card px-2 py-2 text-sm shadow-lg">
                      <p className="font-medium">{activeDragTask.title}</p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          ) : null}

          {view === "board" && visibleTrackerStatuses.length === 0 ? (
            <p className="shrink-0 rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
              No task columns are visible. Open settings and enable at least one column to use the board.
            </p>
          ) : null}

          {view === "table" ? (
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
              <BoardTable
                tasks={tasks}
                colorByBoard={colorByBoard}
                onRowClick={(t) => {
                  setSelectedTaskId(t.id);
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <Sheet open={trackerSettingsOpen} onOpenChange={setTrackerSettingsOpen}>
        <SheetContent
          side="right"
          className={cn(rightAppSheetContentClassName, "overflow-y-auto")}
          style={trackerSettingsSheetSizing.sheetWidthStyle}
        >
          <RightAppSheetResizeHandle onMouseDown={trackerSettingsSheetSizing.startResize} />
          <SheetHeader className="border-b px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
            <SheetTitle>Ticket tracker settings</SheetTitle>
            <SheetDescription>
              Column visibility is saved in this browser. Color-by-board is saved to your account for this workspace.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
            {workspaceId ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  checked={colorByBoard}
                  disabled={workspacePrefsMutation.isPending || workspacePrefsQuery.isLoading}
                  onChange={(e) => workspacePrefsMutation.mutate(e.target.checked)}
                />
                <span>Color-code tickets by project board accent</span>
              </label>
            ) : null}
            {workspacePrefsMutation.isError ? (
              <p className="text-xs text-destructive">Could not save that preference. Try again.</p>
            ) : null}
            <p className="text-xs font-medium text-muted-foreground">Task columns</p>
            <ul className="space-y-2">
              {TRACKER_STATUSES.map((st) => (
                <li key={st}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border"
                      checked={columnVisibility[st]}
                      onChange={(e) =>
                        setColumnVisibility((prev) => ({ ...prev, [st]: e.target.checked }))
                      }
                    />
                    <span>{TRACKER_LABELS[st]}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>

      <TaskDetailSheet
        task={selectedTask}
        open={Boolean(selectedTaskId)}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId(null);
        }}
      />
    </div>
  );
}
