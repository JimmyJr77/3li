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
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  applyBoardPositions,
  createBoardTask,
  deleteBoardList,
  patchBoardList,
  patchTask,
  reorderBoardLists,
} from "./api";
import type { BoardDto, BoardListDto, TaskFlowTask } from "./types";
import { cn } from "@/lib/utils";

const COL_PREFIX = "board-col:";

function colDragId(listId: string) {
  return `${COL_PREFIX}${listId}`;
}

function findContainer(id: string, items: Record<string, string[]>): string | undefined {
  if (id in items) return id;
  for (const [cid, ids] of Object.entries(items)) {
    if (ids.includes(id)) return cid;
  }
  return undefined;
}

function buildItems(board: BoardDto): Record<string, string[]> {
  const o: Record<string, string[]> = {};
  for (const list of board.lists) {
    o[list.id] = list.tasks.map((t) => t.id);
  }
  return o;
}

function buildTaskMap(board: BoardDto): Map<string, TaskFlowTask> {
  const m = new Map<string, TaskFlowTask>();
  for (const list of board.lists) {
    for (const t of list.tasks) m.set(t.id, t);
  }
  return m;
}

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.5" } },
  }),
};

function confirmDeleteList(list: BoardListDto): boolean {
  const n = list.tasks.length;
  const detail =
    n > 0
      ? ` ${n} card${n === 1 ? "" : "s"} will move to another column (Backlog if it exists on this board).`
      : "";
  return window.confirm(`Delete the column “${list.title}”?${detail}`);
}

function TaskCardFace({
  task,
  onOpen,
  onToggleComplete,
}: {
  task: TaskFlowTask;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
}) {
  const doneCount = task.checklist?.filter((c) => c.completed).length ?? 0;
  const checkTotal = task.checklist?.length ?? 0;

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <input
        type="checkbox"
        checked={task.completed}
        className="mt-0.5 size-4 shrink-0 rounded border"
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggleComplete(task)}
      />
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onOpen(task)}
      >
        <p
          className={cn(
            "font-medium leading-snug",
            task.completed && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {task.labels.map(({ label }) => (
            <span
              key={label.id}
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
        {task.ideaNode && (
          <p className="mt-1 text-xs text-muted-foreground">Idea: {task.ideaNode.title}</p>
        )}
        {checkTotal > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Checklist {doneCount}/{checkTotal}
          </p>
        )}
        {task.dueDate && (
          <p className="mt-1 text-xs text-muted-foreground">
            Due {new Date(task.dueDate).toLocaleDateString()}
          </p>
        )}
      </button>
    </div>
  );
}

function SortableTaskCard({
  task,
  onOpen,
  onToggleComplete,
}: {
  task: TaskFlowTask;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
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
        "group flex gap-1 rounded-xl border bg-card px-2 py-2 text-sm shadow-sm transition-shadow hover:shadow-md",
        isDragging && "z-10 opacity-40",
      )}
    >
      <button
        type="button"
        className="mt-0.5 cursor-grab touch-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>
      <TaskCardFace task={task} onOpen={onOpen} onToggleComplete={onToggleComplete} />
    </div>
  );
}

function ReadOnlyTaskCard({
  task,
  onOpen,
  onToggleComplete,
}: {
  task: TaskFlowTask;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
}) {
  return (
    <div className="rounded-xl border bg-card px-2 py-2 text-sm shadow-sm transition-shadow hover:shadow-md">
      <TaskCardFace task={task} onOpen={onOpen} onToggleComplete={onToggleComplete} />
    </div>
  );
}

function ColumnTitleInput({
  listId,
  title,
  onCommit,
}: {
  listId: string;
  title: string;
  onCommit: (listId: string, nextTitle: string) => void;
}) {
  const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const t = value.trim();
        if (t && t !== title) onCommit(listId, t);
        if (!t) setValue(title);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="border-input bg-background text-foreground focus-visible:ring-ring min-w-0 flex-1 rounded-md border px-2 py-1 text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
    />
  );
}

function DndKanbanColumn({
  list,
  taskIds,
  taskMap,
  onOpen,
  quickAddPlaceholder,
  onQuickAdd,
  onTitleCommit,
  onToggleComplete,
  canDeleteColumn,
  deleteBusy,
  onRequestDelete,
}: {
  list: BoardListDto;
  taskIds: string[];
  taskMap: Map<string, TaskFlowTask>;
  onOpen: (t: TaskFlowTask) => void;
  quickAddPlaceholder: string;
  onQuickAdd: (listId: string, title: string) => void;
  onTitleCommit: (listId: string, title: string) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  canDeleteColumn: boolean;
  deleteBusy: boolean;
  onRequestDelete: (list: BoardListDto) => void;
}) {
  const listId = list.id;
  const sortId = colDragId(listId);
  const {
    attributes,
    listeners,
    setNodeRef: setSortRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortId });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: listId });
  const [draft, setDraft] = useState("");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setSortRef}
      style={style}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border bg-muted/20 p-3 transition-colors",
        isDragging && "z-20 opacity-90 shadow-lg ring-2 ring-primary/20",
      )}
    >
      <div className="mb-3 flex items-start gap-1">
        <button
          type="button"
          className="mt-1.5 cursor-grab touch-none text-muted-foreground"
          {...attributes}
          {...listeners}
          aria-label="Drag column"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <ColumnTitleInput listId={listId} title={list.title} onCommit={onTitleCommit} />
        </div>
        {canDeleteColumn ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 size-8 shrink-0 text-muted-foreground hover:text-destructive"
            disabled={deleteBusy}
            aria-label={`Delete column ${list.title}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRequestDelete(list);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
      <div
        ref={setDropRef}
        className={cn(
          "flex min-h-[120px] flex-col gap-2 rounded-lg transition-colors",
          isOver && "bg-primary/10 ring-2 ring-primary/25",
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {taskIds.map((id) => {
            const task = taskMap.get(id);
            if (!task) return null;
            return (
              <SortableTaskCard
                key={id}
                task={task}
                onOpen={onOpen}
                onToggleComplete={onToggleComplete}
              />
            );
          })}
        </SortableContext>
      </div>
      <div className="mt-3 border-t pt-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onQuickAdd(listId, draft.trim());
              setDraft("");
            }
          }}
          placeholder={quickAddPlaceholder}
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>
    </div>
  );
}

type BoardKanbanProps = {
  board: BoardDto;
  onOpenTask: (task: TaskFlowTask) => void;
  /** When filters/search are active, drag-and-drop is disabled so positions stay consistent. */
  dragDisabled?: boolean;
};

function KanbanReadOnly({
  board,
  onOpenTask,
  onQuickAdd,
  onTitleCommit,
  onToggleComplete,
  canDeleteColumn,
  deleteBusy,
  onRequestDelete,
}: {
  board: BoardDto;
  onOpenTask: (t: TaskFlowTask) => void;
  onQuickAdd: (listId: string, title: string) => void;
  onTitleCommit: (listId: string, title: string) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  canDeleteColumn: boolean;
  deleteBusy: boolean;
  onRequestDelete: (list: BoardListDto) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {board.lists.map((list) => (
        <ReadOnlyColumn
          key={list.id}
          list={list}
          onOpen={onOpenTask}
          onQuickAdd={onQuickAdd}
          onTitleCommit={onTitleCommit}
          onToggleComplete={onToggleComplete}
          canDeleteColumn={canDeleteColumn}
          deleteBusy={deleteBusy}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </div>
  );
}

function ReadOnlyColumn({
  list,
  onOpen,
  onQuickAdd,
  onTitleCommit,
  onToggleComplete,
  canDeleteColumn,
  deleteBusy,
  onRequestDelete,
}: {
  list: BoardListDto;
  onOpen: (t: TaskFlowTask) => void;
  onQuickAdd: (listId: string, title: string) => void;
  onTitleCommit: (listId: string, title: string) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  canDeleteColumn: boolean;
  deleteBusy: boolean;
  onRequestDelete: (list: BoardListDto) => void;
}) {
  const listId = list.id;
  const [draft, setDraft] = useState("");
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl border bg-muted/20 p-3">
      <div className="mb-3 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <ColumnTitleInput listId={listId} title={list.title} onCommit={onTitleCommit} />
        </div>
        {canDeleteColumn ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 size-8 shrink-0 text-muted-foreground hover:text-destructive"
            disabled={deleteBusy}
            aria-label={`Delete column ${list.title}`}
            onClick={() => onRequestDelete(list)}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="flex min-h-[120px] flex-col gap-2">
        {list.tasks.map((task) => (
          <ReadOnlyTaskCard
            key={task.id}
            task={task}
            onOpen={onOpen}
            onToggleComplete={onToggleComplete}
          />
        ))}
      </div>
      <div className="mt-3 border-t pt-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onQuickAdd(listId, draft.trim());
              setDraft("");
            }
          }}
          placeholder="Add a card…"
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>
    </div>
  );
}

function BoardKanbanFiltered({ board, onOpenTask }: BoardKanbanProps) {
  const queryClient = useQueryClient();
  const canDeleteColumn = board.lists.length > 1;

  const createMutation = useMutation({
    mutationFn: ({ listId, title }: { listId: string; title: string }) =>
      createBoardTask(board.id, { title, listId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });

  const titleMutation = useMutation({
    mutationFn: ({ listId, title }: { listId: string; title: string }) =>
      patchBoardList(board.id, listId, { title }),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", board.id], next);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (task: TaskFlowTask) => patchTask(task.id, { completed: !task.completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: (listId: string) => deleteBoardList(board.id, listId),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", board.id], next);
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });

  const requestDeleteList = (list: BoardListDto) => {
    if (!canDeleteColumn) return;
    if (!confirmDeleteList(list)) return;
    deleteListMutation.mutate(list.id);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Filters are on — drag-and-drop is paused. Clear filters to move cards and columns.
      </p>
      <KanbanReadOnly
        board={board}
        onOpenTask={onOpenTask}
        onQuickAdd={(listId, title) => createMutation.mutate({ listId, title })}
        onTitleCommit={(listId, title) => titleMutation.mutate({ listId, title })}
        onToggleComplete={(t) => toggleMutation.mutate(t)}
        canDeleteColumn={canDeleteColumn}
        deleteBusy={deleteListMutation.isPending}
        onRequestDelete={requestDeleteList}
      />
    </div>
  );
}

function BoardKanbanDnd({ board, onOpenTask }: BoardKanbanProps) {
  const queryClient = useQueryClient();
  const canDeleteColumn = board.lists.length > 1;

  const [items, setItems] = useState<Record<string, string[]>>(() => buildItems(board));
  const [listOrder, setListOrder] = useState<string[]>(() => board.lists.map((l) => l.id));
  const [activeId, setActiveId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const listOrderRef = useRef(listOrder);
  itemsRef.current = items;
  listOrderRef.current = listOrder;

  const taskMap = useMemo(() => buildTaskMap(board), [board]);

  const listById = useMemo(() => new Map(board.lists.map((l) => [l.id, l])), [board.lists]);

  const orderedLists = useMemo(() => {
    const out: BoardListDto[] = [];
    for (const id of listOrder) {
      const l = listById.get(id);
      if (l) out.push(l);
    }
    return out;
  }, [listOrder, listById]);

  useEffect(() => {
    const next = buildItems(board);
    itemsRef.current = next;
    setItems(next);
    const nextOrder = board.lists.map((l) => l.id);
    setListOrder(nextOrder);
    listOrderRef.current = nextOrder;
  }, [board]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const moveMutation = useMutation({
    mutationFn: (positions: Record<string, string[]>) => applyBoardPositions(board.id, positions),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", board.id], next);
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedListIds: string[]) => reorderBoardLists(board.id, orderedListIds),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", board.id], next);
    },
  });

  const createMutation = useMutation({
    mutationFn: ({ listId, title }: { listId: string; title: string }) =>
      createBoardTask(board.id, { title, listId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });

  const titleMutation = useMutation({
    mutationFn: ({ listId, title }: { listId: string; title: string }) =>
      patchBoardList(board.id, listId, { title }),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", board.id], next);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (task: TaskFlowTask) => patchTask(task.id, { completed: !task.completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: (listId: string) => deleteBoardList(board.id, listId),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", board.id], next);
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });

  const requestDeleteList = (list: BoardListDto) => {
    if (!canDeleteColumn) return;
    if (!confirmDeleteList(list)) return;
    deleteListMutation.mutate(list.id);
  };

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    const activeStr = String(active.id);

    if (activeStr.startsWith(COL_PREFIX)) {
      const overId = over?.id != null ? String(over.id) : null;
      if (!overId || !overId.startsWith(COL_PREFIX)) return;
      setListOrder((prev) => {
        const a = activeStr.slice(COL_PREFIX.length);
        const b = overId.slice(COL_PREFIX.length);
        const oldIndex = prev.indexOf(a);
        const newIndex = prev.indexOf(b);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
        const next = arrayMove(prev, oldIndex, newIndex);
        listOrderRef.current = next;
        return next;
      });
      return;
    }

    const overId = over?.id != null ? String(over.id) : null;
    if (!overId) return;

    setItems((prev) => {
      const activeContainer = findContainer(String(active.id), prev);
      const overContainer = findContainer(overId, prev);
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
      const activeStr = String(active.id);

      if (activeStr.startsWith(COL_PREFIX)) {
        setActiveId(null);
        queueMicrotask(() => reorderMutation.mutate([...listOrderRef.current]));
        return;
      }

      setActiveId(null);
      if (!over) return;

      setItems((prev) => {
        const activeContainer = findContainer(String(active.id), prev);
        const overContainer = findContainer(String(over.id), prev);
        if (!activeContainer || !overContainer) return prev;

        let next = prev;

        if (activeContainer === overContainer) {
          const list = [...prev[activeContainer]];
          const oldIndex = list.indexOf(String(active.id));
          const newIndex = list.indexOf(String(over.id));
          if (oldIndex !== newIndex && oldIndex >= 0 && newIndex >= 0) {
            next = { ...prev, [activeContainer]: arrayMove(list, oldIndex, newIndex) };
          }
        }

        itemsRef.current = next;
        queueMicrotask(() => moveMutation.mutate({ ...itemsRef.current }));
        return next;
      });
    },
    [moveMutation, reorderMutation],
  );

  const activeTask = activeId && !activeId.startsWith(COL_PREFIX) ? taskMap.get(activeId) : undefined;
  const activeColListId =
    activeId?.startsWith(COL_PREFIX) ? activeId.slice(COL_PREFIX.length) : null;
  const activeColumnList = activeColListId ? listById.get(activeColListId) : undefined;

  const sortableColumnIds = useMemo(() => listOrder.map(colDragId), [listOrder]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sortableColumnIds} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {orderedLists.map((list) => (
            <DndKanbanColumn
              key={list.id}
              list={list}
              taskIds={items[list.id] ?? []}
              taskMap={taskMap}
              onOpen={onOpenTask}
              quickAddPlaceholder="Add a card…"
              onQuickAdd={(listId, title) => createMutation.mutate({ listId, title })}
              onTitleCommit={(listId, title) => titleMutation.mutate({ listId, title })}
              onToggleComplete={(t) => toggleMutation.mutate(t)}
              canDeleteColumn={canDeleteColumn}
              deleteBusy={deleteListMutation.isPending}
              onRequestDelete={requestDeleteList}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <div className="w-72 rounded-xl border bg-card px-3 py-2 text-sm shadow-lg">
            <p className="font-medium">{activeTask.title}</p>
          </div>
        ) : activeColumnList ? (
          <div className="flex w-72 items-center gap-2 rounded-2xl border bg-muted/30 px-3 py-3 text-sm font-semibold shadow-lg">
            <GripVertical className="size-4 shrink-0 text-muted-foreground" />
            {activeColumnList.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function BoardKanban({ dragDisabled = false, ...rest }: BoardKanbanProps) {
  if (dragDisabled) {
    return <BoardKanbanFiltered {...rest} />;
  }
  return <BoardKanbanDnd {...rest} />;
}
