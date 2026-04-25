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
import { ArchiveRestore, LayoutGrid, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PMAgentSheet, buildTasksContextSnapshot } from "@/features/agents/PMAgentSheet";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { useArchivesVisibility } from "@/context/ArchivesVisibilityContext";
import { fetchAllTasks, fetchBoard, patchTask } from "@/features/taskflow/api";
import { TaskDetailSheet } from "@/features/taskflow/TaskDetailSheet";
import type { TaskFlowTask } from "@/features/taskflow/types";
import {
  normalizeTrackerStatus,
  TRACKER_LABELS,
  TRACKER_STATUSES,
  type TrackerStatus,
} from "@/features/taskflow/trackerMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
}: {
  task: TaskFlowTask;
  onOpen: (t: TaskFlowTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card px-2 py-2 text-sm shadow-sm",
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
}: {
  status: TrackerStatus;
  taskIds: string[];
  taskMap: Map<string, TaskFlowTask>;
  onOpen: (t: TaskFlowTask) => void;
}) {
  const laneId = ttLaneId(status);
  const { setNodeRef, isOver } = useDroppable({ id: laneId });

  return (
    <div className="flex w-56 shrink-0 flex-col rounded-xl border bg-muted/15 p-2">
      <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {TRACKER_LABELS[status]}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-col gap-2 rounded-md p-1 transition-colors",
          isOver && "bg-primary/10 ring-2 ring-primary/25",
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {taskIds.map((id) => {
            const task = taskMap.get(id);
            if (!task) return null;
            return <TrackerTicketCard key={id} task={task} onOpen={onOpen} />;
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

  const { activeWorkspace, activeWorkspaceId, isLoading: wsLoading } = useActiveWorkspace();
  const { showArchives } = useArchivesVisibility();

  useEffect(() => {
    if (!showArchives) {
      setArchivedOnly(false);
    }
  }, [showArchives]);

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

  const restoreTaskMutation = useMutation({
    mutationFn: (taskId: string) => patchTask(taskId, { archived: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

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

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Ticket Tracker</h1>
        </div>
        {workspaceId ? (
          <PMAgentSheet
            workspaceId={workspaceId}
            contextText={tasksPmContext}
            surfaceLabel="Current filtered tickets"
          />
        ) : null}
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        All tickets in the active brand workspace, grouped by tracker status. Drag between columns to
        change status, or open a{" "}
        <Link
          to={defaultBoardId ? `/app/boards/${defaultBoardId}` : "/app/boards"}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          project board
        </Link>{" "}
        for sub-board–scoped work.
      </p>

      <div className="flex flex-col gap-3 rounded-xl border bg-muted/15 p-4 lg:flex-row lg:flex-wrap lg:items-end">
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

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      )}
      {tasksQuery.isError && (
        <p className="text-sm text-destructive">Could not load tickets. Is the API running?</p>
      )}

      {tasks.length === 0 && !loading && (
        <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No tickets match. Add tickets on a board or convert ideas from{" "}
          <Link to="/app/brainstorm" className="font-medium text-primary underline-offset-4 hover:underline">
            Brainstorm
          </Link>
          .
        </p>
      )}

      {tasks.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-2 overflow-x-auto pb-4">
            {TRACKER_STATUSES.map((st) => (
              <TrackerColumn
                key={st}
                status={st}
                taskIds={items[ttLaneId(st)] ?? []}
                taskMap={taskMap}
                onOpen={(t) => setSelectedTaskId(t.id)}
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
      )}

      <ul className="divide-y rounded-lg border bg-card">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setSelectedTaskId(task.id)}
            >
              <p className="font-medium leading-snug">{task.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {task.archivedAt && (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                    Archived
                  </span>
                )}
                {task.list && (
                  <span>
                    {task.list.board.name} · {task.list.title}
                  </span>
                )}
                <span>{TRACKER_LABELS[normalizeTrackerStatus(task.trackerStatus)]}</span>
                <span className="capitalize">Prio: {task.priority}</span>
                {task.dueDate && (
                  <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                )}
                {task.ideaNode && <span>Idea: {task.ideaNode.title}</span>}
              </div>
            </button>
            <div className="flex items-center gap-2">
              {task.archivedAt ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  disabled={restoreTaskMutation.isPending}
                  onClick={() => restoreTaskMutation.mutate(task.id)}
                >
                  <ArchiveRestore className="size-4" />
                  Restore
                </Button>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {task.completed ? "Done" : "Open"}
              </span>
            </div>
          </li>
        ))}
      </ul>

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
