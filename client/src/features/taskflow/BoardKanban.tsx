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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  GripVertical,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Settings2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  applyBoardPositions,
  createBoardTask,
  deleteBoardList,
  fetchBoardSubBoardPreferences,
  fetchBoardUserPreferences,
  patchBoardList,
  patchSubBoardPreference,
  patchTask,
  reorderBoardLists,
} from "./api";
import { ProjectBoardSettingsPanel } from "./ProjectBoardSettingsPanel";
import { UserTicketLabelsPanel } from "./UserTicketLabelsPanel";
import type { BoardDto, BoardListDto, BoardUserPreferenceDto, SubBoardPreferenceDto, TaskFlowTask } from "./types";
import {
  laneKey,
  normalizeTrackerStatus,
  parseLaneKey,
  TRACKER_LABELS,
  TRACKER_STATUSES,
  type TrackerStatus,
} from "./trackerMeta";
import {
  clearRoutedGlow,
  useRoutedTaskGlow,
} from "@/features/rapidRouter/routedHighlightStore";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RightAppSheetResizeHandle, useResizableRightAppSheetWidth, rightAppSheetContentClassName } from "@/hooks/useResizableRightAppSheetWidth";

const SB_PREFIX = "board-subboard:";
const PIN_PREFIX = "board-pinned-subboard:";
const PIN_DROP_ZONE_ID = "board-pinned-drop-zone";
const SUB_BOARD_COLOR_OPTIONS = [
  "#64748b",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#f97316",
] as const;

function sbDragId(subBoardId: string) {
  return `${SB_PREFIX}${subBoardId}`;
}

function pinnedDragId(subBoardId: string) {
  return `${PIN_PREFIX}${subBoardId}`;
}

function findLaneContainer(id: string, items: Record<string, string[]>): string | undefined {
  if (id in items) return id;
  for (const [cid, ids] of Object.entries(items)) {
    if (ids.includes(id)) return cid;
  }
  return undefined;
}

function buildLaneItems(sub: BoardListDto): Record<string, string[]> {
  const o: Record<string, string[]> = {};
  for (const st of TRACKER_STATUSES) {
    o[laneKey(sub.id, st)] = [];
  }
  for (const t of sub.tasks) {
    const st = normalizeTrackerStatus(t.trackerStatus);
    const k = laneKey(sub.id, st);
    (o[k] ?? o[laneKey(sub.id, "BACKLOG")]).push(t.id);
  }
  return o;
}

function mergeLaneItems(subBoards: BoardListDto[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const sb of subBoards) {
    Object.assign(out, buildLaneItems(sb));
  }
  return out;
}

function visibleStatusesForSubBoard(
  subBoardId: string,
  prefBySubBoard: Record<string, SubBoardPreferenceDto | undefined>,
  boardUserPref?: BoardUserPreferenceDto,
): TrackerStatus[] {
  const subHidden = prefBySubBoard[subBoardId]?.hiddenTrackerStatuses ?? [];
  const boardHidden = boardUserPref?.defaultHiddenTrackerStatuses ?? [];
  const hidden = new Set<TrackerStatus>([...boardHidden, ...subHidden]);
  const visible = TRACKER_STATUSES.filter((s) => !hidden.has(s));
  return visible.length > 0 ? visible : ["BACKLOG"];
}

function cardColorForSubBoard(
  subBoardId: string,
  prefBySubBoard: Record<string, SubBoardPreferenceDto | undefined>,
  boardUserPref?: BoardUserPreferenceDto,
): string | undefined {
  const c = prefBySubBoard[subBoardId]?.ticketCardColor ?? boardUserPref?.defaultTicketCardColor ?? null;
  return c ?? undefined;
}

/** Fills defaults when the user has no saved row yet for this sub-board. */
function normalizedSubBoardPref(
  subBoardId: string,
  row?: SubBoardPreferenceDto,
  boardUserPref?: BoardUserPreferenceDto,
): SubBoardPreferenceDto {
  const checkboxFromRow = row?.completeCheckboxVisibleByDefault;
  const checkboxMerged =
    checkboxFromRow !== undefined
      ? checkboxFromRow !== false
      : boardUserPref?.defaultCompleteCheckboxVisible !== false;
  return {
    subBoardId,
    ticketCardColor: row?.ticketCardColor ?? null,
    cardFaceLayout: row?.cardFaceLayout === "minimal" ? "minimal" : "standard",
    completeCheckboxVisibleByDefault: checkboxMerged,
    hiddenTrackerStatuses: row?.hiddenTrackerStatuses ?? [],
    updatedAt: row?.updatedAt ?? null,
  };
}

function effectiveCompleteCheckboxOnCard(
  task: TaskFlowTask,
  pref: SubBoardPreferenceDto,
): boolean {
  if (task.showCompleteCheckbox === true) return true;
  if (task.showCompleteCheckbox === false) return false;
  return pref.completeCheckboxVisibleByDefault;
}

type SubBoardPrefSavePayload = {
  subBoardId: string;
  ticketCardColor: string | null;
  hiddenTrackerStatuses: TrackerStatus[];
  cardFaceLayout: string;
  completeCheckboxVisibleByDefault: boolean;
};

function upsertPrefRows(
  prev: SubBoardPreferenceDto[] | undefined,
  next: SubBoardPreferenceDto,
): SubBoardPreferenceDto[] {
  const rows = [...(prev ?? [])];
  const i = rows.findIndex((r) => r.subBoardId === next.subBoardId);
  if (i >= 0) rows[i] = next;
  else rows.push(next);
  return rows;
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

function confirmDeleteSubBoard(list: BoardListDto): boolean {
  const n = list.tasks.length;
  const detail =
    n > 0
      ? ` ${n} ticket${n === 1 ? "" : "s"} will move to another sub-board (Backlog lane if that sub-board exists).`
      : "";
  return window.confirm(`Delete the sub-board “${list.title}”?${detail}`);
}

function TaskCardFace({
  task,
  onOpen,
  onToggleComplete,
  sendTargets,
  onSendTo,
  subBoardPref,
}: {
  task: TaskFlowTask;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  sendTargets?: { id: string; title: string }[];
  onSendTo?: (taskId: string, subBoardId: string) => void;
  subBoardPref: SubBoardPreferenceDto;
}) {
  const { activeWorkspaceId } = useActiveWorkspace();
  const taskWs = task.list?.board?.workspaceId ?? activeWorkspaceId ?? undefined;
  const doneCount = task.checklist?.filter((c) => c.completed).length ?? 0;
  const checkTotal = task.checklist?.length ?? 0;
  const sbId = task.subBoardId ?? task.listId ?? task.list?.id;
  const others = sendTargets?.filter((s) => s.id !== sbId) ?? [];
  const minimal = subBoardPref.cardFaceLayout === "minimal";
  const showDoneCheckbox = effectiveCompleteCheckboxOnCard(task, subBoardPref);

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      {showDoneCheckbox ? (
        <input
          type="checkbox"
          checked={task.completed}
          className="mt-0.5 size-4 shrink-0 rounded border"
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
          onClick={(e) => e.stopPropagation()}
          onChange={() => {
            if (taskWs) clearRoutedGlow("task", task.id, taskWs);
            onToggleComplete(task);
          }}
        />
      ) : null}
      <button
        type="button"
        className={cn("min-w-0 flex-1 text-left", !showDoneCheckbox && "pl-0.5")}
        onClick={() => {
          if (taskWs) clearRoutedGlow("task", task.id, taskWs);
          onOpen(task);
        }}
      >
        <p
          className={cn(
            "font-medium leading-snug",
            task.completed && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        {!minimal ? (
          <>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {task.labels.map(({ label }) => (
                <span
                  key={label.id}
                  className="rounded px-2 py-0.5 text-[10px] font-medium leading-none text-white"
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
          </>
        ) : null}
      </button>
      {others.length > 0 && onSendTo ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label="Ticket actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Send to…</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {others.map((s) => (
              <DropdownMenuItem key={s.id} onSelect={() => onSendTo(task.id, s.id)}>
                {s.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function SortableTaskCard({
  task,
  onOpen,
  onToggleComplete,
  sendTargets,
  onSendTo,
  cardColor,
  subBoardPref,
}: {
  task: TaskFlowTask;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  sendTargets?: { id: string; title: string }[];
  onSendTo?: (taskId: string, subBoardId: string) => void;
  cardColor?: string;
  subBoardPref: SubBoardPreferenceDto;
}) {
  const { activeWorkspaceId } = useActiveWorkspace();
  const taskWs = task.list?.board?.workspaceId ?? activeWorkspaceId ?? undefined;
  const glow = useRoutedTaskGlow(task.id, taskWs);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(cardColor ? { borderColor: cardColor } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex gap-1 rounded-xl border bg-card px-2 py-2 text-sm shadow-sm transition-shadow hover:shadow-md",
        cardColor ? "border-2" : "border",
        glow &&
          "ring-2 ring-yellow-400/75 ring-offset-2 ring-offset-background shadow-[0_0_18px_rgba(234,179,8,0.42)]",
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
      <TaskCardFace
        task={task}
        onOpen={onOpen}
        onToggleComplete={onToggleComplete}
        sendTargets={sendTargets}
        onSendTo={onSendTo}
        subBoardPref={subBoardPref}
      />
    </div>
  );
}

function ReadOnlyTaskCard({
  task,
  onOpen,
  onToggleComplete,
  sendTargets,
  onSendTo,
  cardColor,
  subBoardPref,
}: {
  task: TaskFlowTask;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  sendTargets?: { id: string; title: string }[];
  onSendTo?: (taskId: string, subBoardId: string) => void;
  cardColor?: string;
  subBoardPref: SubBoardPreferenceDto;
}) {
  const { activeWorkspaceId } = useActiveWorkspace();
  const taskWs = task.list?.board?.workspaceId ?? activeWorkspaceId ?? undefined;
  const glow = useRoutedTaskGlow(task.id, taskWs);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-2 py-2 text-sm shadow-sm transition-shadow hover:shadow-md",
        cardColor ? "border-2" : "border",
        glow &&
          "ring-2 ring-yellow-400/75 ring-offset-2 ring-offset-background shadow-[0_0_18px_rgba(234,179,8,0.42)]",
      )}
      style={cardColor ? { borderColor: cardColor } : undefined}
    >
      <TaskCardFace
        task={task}
        onOpen={onOpen}
        onToggleComplete={onToggleComplete}
        sendTargets={sendTargets}
        onSendTo={onSendTo}
        subBoardPref={subBoardPref}
      />
    </div>
  );
}

function SubBoardTitleInput({
  subBoardId,
  title,
  onCommit,
}: {
  subBoardId: string;
  title: string;
  onCommit: (subBoardId: string, nextTitle: string) => void;
}) {
  const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const t = value.trim();
        if (t && t !== title) onCommit(subBoardId, t);
        if (!t) setValue(title);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="border-input bg-background text-foreground focus-visible:ring-ring max-w-[min(100%,20rem)] rounded-md border px-2 py-1 text-base font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
    />
  );
}

function SortableSubBoardTab({
  list,
  isActive,
  onActivate,
  onEdit,
}: {
  list: BoardListDto;
  isActive: boolean;
  onActivate: () => void;
  onEdit: (subBoardId: string) => void;
}) {
  const sortId = sbDragId(list.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      onClick={onActivate}
      className={cn(
        "relative flex min-h-[44px] min-w-0 flex-1 basis-0 items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-all",
        isActive && "bg-background text-foreground shadow-sm ring-1 ring-primary/30",
        !isActive && "text-muted-foreground hover:bg-background/70 hover:text-foreground",
        isDragging && "z-20 opacity-95 shadow-lg",
      )}
    >
      <span
        className="cursor-grab touch-none text-muted-foreground"
        {...attributes}
        {...listeners}
        aria-label="Reorder sub-board"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-4 shrink-0" />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{list.title}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground"
        aria-label={`Edit sub-board ${list.title}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit(list.id);
        }}
      >
        <Settings2 className="size-3.5" />
      </Button>
    </button>
  );
}

function LaneTrackerHeader({
  label,
  laneId,
  onQuickAdd,
  placeholder,
}: {
  label: string;
  laneId: string;
  onQuickAdd: (laneId: string, title: string) => void;
  placeholder: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (adding) queueMicrotask(() => inputRef.current?.focus());
  }, [adding]);

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    onQuickAdd(laneId, t);
    setDraft("");
    setAdding(false);
  };

  return (
    <>
      <div className="mb-1.5 flex min-h-7 items-center justify-between gap-2 px-0.5">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={`Add ticket in ${label}`}
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      {adding ? (
        <div className="mb-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            onBlur={() => {
              if (!draft.trim()) setAdding(false);
            }}
            placeholder={placeholder}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>
      ) : null}
    </>
  );
}

function TrackerLane({
  laneId,
  label,
  taskIds,
  taskMap,
  onOpen,
  onToggleComplete,
  quickAddPlaceholder,
  onQuickAdd,
  sendTargets,
  onSendTo,
  cardColor,
  subBoardPref,
}: {
  laneId: string;
  label: string;
  taskIds: string[];
  taskMap: Map<string, TaskFlowTask>;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  quickAddPlaceholder: string;
  onQuickAdd: (laneId: string, title: string) => void;
  sendTargets?: { id: string; title: string }[];
  onSendTo?: (taskId: string, subBoardId: string) => void;
  cardColor?: string;
  subBoardPref: SubBoardPreferenceDto;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: laneId });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-2xl border bg-muted/15 p-2.5">
      <LaneTrackerHeader
        label={label}
        laneId={laneId}
        onQuickAdd={onQuickAdd}
        placeholder={quickAddPlaceholder}
      />
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[100px] flex-col gap-2 rounded-lg p-1 transition-colors",
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
                sendTargets={sendTargets}
                onSendTo={onSendTo}
                cardColor={cardColor}
                subBoardPref={subBoardPref}
              />
            );
          })}
        </SortableContext>
      </div>
    </div>
  );
}

type BoardKanbanProps = {
  board: BoardDto;
  onOpenTask: (task: TaskFlowTask) => void;
  onAddSubBoard?: () => void;
  /** When filters/search are active, drag-and-drop is disabled so positions stay consistent. */
  dragDisabled?: boolean;
  /** Archive action (confirm in parent). Shown in the project board ⋮ menu when the board is active. */
  onArchiveBoard?: () => void;
  boardArchived?: boolean;
};

function ReadOnlyTrackerGrid({
  board,
  activeSub,
  onOpenTask,
  onQuickAdd,
  onToggleComplete,
  sendMutation,
  visibleStatuses,
  cardColor,
  prefBySubBoard,
  boardUserPref,
}: {
  board: BoardDto;
  activeSub: BoardListDto;
  onOpenTask: (t: TaskFlowTask) => void;
  onQuickAdd: (laneId: string, title: string) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  sendMutation: { isPending: boolean; mutate: (p: { taskId: string; subBoardId: string }) => void };
  visibleStatuses: TrackerStatus[];
  cardColor?: string;
  prefBySubBoard: Record<string, SubBoardPreferenceDto | undefined>;
  boardUserPref?: BoardUserPreferenceDto;
}) {
  const sendTargets = board.lists.map((l) => ({ id: l.id, title: l.title }));
  const byLane = buildLaneItems(activeSub);

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex w-full min-w-0 gap-2 pb-2">
        {visibleStatuses.map((st) => (
          <ReadOnlyLaneInner
            key={st}
            laneId={laneKey(activeSub.id, st)}
            label={TRACKER_LABELS[st]}
            taskIds={byLane[laneKey(activeSub.id, st)] ?? []}
            taskMap={buildTaskMap(board)}
            onOpen={onOpenTask}
            onToggleComplete={onToggleComplete}
            onQuickAdd={onQuickAdd}
            sendTargets={sendTargets}
            onSendTo={(taskId, subBoardId) => sendMutation.mutate({ taskId, subBoardId })}
            cardColor={cardColor}
            prefBySubBoard={prefBySubBoard}
            boardUserPref={boardUserPref}
          />
        ))}
      </div>
    </div>
  );
}

function ReadOnlyLaneInner({
  laneId,
  label,
  taskIds,
  taskMap,
  onOpen,
  onToggleComplete,
  onQuickAdd,
  sendTargets,
  onSendTo,
  cardColor,
  prefBySubBoard,
  boardUserPref,
}: {
  laneId: string;
  label: string;
  taskIds: string[];
  taskMap: Map<string, TaskFlowTask>;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  onQuickAdd: (laneId: string, title: string) => void;
  sendTargets: { id: string; title: string }[];
  onSendTo: (taskId: string, subBoardId: string) => void;
  cardColor?: string;
  prefBySubBoard: Record<string, SubBoardPreferenceDto | undefined>;
  boardUserPref?: BoardUserPreferenceDto;
}) {
  const laneSubBoardId = parseLaneKey(laneId)?.subBoardId ?? "";
  const subBoardPref = normalizedSubBoardPref(laneSubBoardId, prefBySubBoard[laneSubBoardId], boardUserPref);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-2xl border bg-muted/15 p-2.5">
      <LaneTrackerHeader
        label={label}
        laneId={laneId}
        onQuickAdd={onQuickAdd}
        placeholder="Add a ticket…"
      />
      <div className="flex min-h-[100px] flex-col gap-2 rounded-lg p-1">
        {taskIds.map((id) => {
          const task = taskMap.get(id);
          if (!task) return null;
          return (
            <ReadOnlyTaskCard
              key={id}
              task={task}
              onOpen={onOpen}
              onToggleComplete={onToggleComplete}
              sendTargets={sendTargets}
              onSendTo={onSendTo}
              cardColor={cardColor}
              subBoardPref={subBoardPref}
            />
          );
        })}
      </div>
    </div>
  );
}

function SubBoardPrefsEditor({
  editorSubBoard,
  pinnedSubBoardIds,
  pinSubBoard,
  unpinSubBoard,
  editorColorDraft,
  setEditorColorDraft,
  editorHiddenDraft,
  setEditorHiddenDraft,
  editorCardFaceDraft,
  setEditorCardFaceDraft,
  editorCheckboxDefaultDraft,
  setEditorCheckboxDefaultDraft,
  savePref,
  brandId,
  boardId,
  canDeleteSubBoard,
  deleteBusy,
  onRequestDelete,
  onTitleCommit,
}: {
  editorSubBoard: BoardListDto;
  pinnedSubBoardIds: string[];
  pinSubBoard: (id: string) => void;
  unpinSubBoard: (id: string) => void;
  editorColorDraft: string;
  setEditorColorDraft: (s: string) => void;
  editorHiddenDraft: TrackerStatus[];
  setEditorHiddenDraft: Dispatch<SetStateAction<TrackerStatus[]>>;
  editorCardFaceDraft: string;
  setEditorCardFaceDraft: (s: string) => void;
  editorCheckboxDefaultDraft: boolean;
  setEditorCheckboxDefaultDraft: (b: boolean) => void;
  savePref: (payload: SubBoardPrefSavePayload) => void;
  brandId?: string | null;
  boardId?: string;
  canDeleteSubBoard: boolean;
  deleteBusy: boolean;
  onRequestDelete: (list: BoardListDto) => void;
  onTitleCommit: (subBoardId: string, title: string) => void;
}) {
  const flush = (overrides?: Partial<SubBoardPrefSavePayload>) => {
    savePref({
      subBoardId: editorSubBoard.id,
      ticketCardColor: overrides?.ticketCardColor ?? (editorColorDraft.trim() || null),
      hiddenTrackerStatuses: overrides?.hiddenTrackerStatuses ?? editorHiddenDraft,
      cardFaceLayout: overrides?.cardFaceLayout ?? editorCardFaceDraft,
      completeCheckboxVisibleByDefault:
        overrides?.completeCheckboxVisibleByDefault ?? editorCheckboxDefaultDraft,
    });
  };

  return (
    <div className="space-y-4 px-5 py-4 pb-10 pl-10 pr-6 pt-2 sm:px-7 sm:pl-12 sm:pr-8">
      <div className="space-y-3 border-b border-border/60 pb-4">
        <p className="text-sm font-medium">Sub-board name</p>
        <SubBoardTitleInput
          subBoardId={editorSubBoard.id}
          title={editorSubBoard.title}
          onCommit={onTitleCommit}
        />
        {canDeleteSubBoard ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={deleteBusy}
            onClick={() => onRequestDelete(editorSubBoard)}
          >
            <Trash2 className="mr-1 size-3.5" />
            Delete this sub-board
          </Button>
        ) : null}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Pinned secondary view</p>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            pinnedSubBoardIds.includes(editorSubBoard.id)
              ? unpinSubBoard(editorSubBoard.id)
              : pinSubBoard(editorSubBoard.id)
          }
        >
          {pinnedSubBoardIds.includes(editorSubBoard.id) ? (
            <>
              <PinOff className="mr-1 size-3.5" />
              Unpin from secondary area
            </>
          ) : (
            <>
              <Pin className="mr-1 size-3.5" />
              Pin to secondary area
            </>
          )}
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Ticket card color</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              !editorColorDraft ? "border-primary text-foreground" : "text-muted-foreground",
            )}
            onClick={() => {
              setEditorColorDraft("");
              flush({ ticketCardColor: null });
            }}
          >
            None
          </button>
          {SUB_BOARD_COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "size-7 rounded-md border-2",
                editorColorDraft === color ? "border-primary ring-2 ring-primary/30" : "border-border",
              )}
              style={{ backgroundColor: color }}
              aria-label={`Use ${color} card color`}
              onClick={() => {
                setEditorColorDraft(color);
                flush({ ticketCardColor: color });
              }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Card face</p>
        <select
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          value={editorCardFaceDraft}
          onChange={(e) => {
            const v = e.target.value;
            setEditorCardFaceDraft(v);
            flush({ cardFaceLayout: v });
          }}
        >
          <option value="standard">Standard (title + meta)</option>
          <option value="minimal">Title only</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Applies to every ticket on this sub-board on the board for you.
        </p>
      </div>
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={editorCheckboxDefaultDraft}
            onChange={(e) => {
              const next = e.target.checked;
              setEditorCheckboxDefaultDraft(next);
              flush({ completeCheckboxVisibleByDefault: next });
            }}
          />
          <span>Show complete checkbox on ticket cards by default</span>
        </label>
        <p className="text-xs text-muted-foreground">
          You can still show or hide the checkbox per ticket in ticket settings.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Visible tracker lanes</p>
        <div className="space-y-2">
          {TRACKER_STATUSES.map((st) => {
            const checked = !editorHiddenDraft.includes(st);
            return (
              <label key={st} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setEditorHiddenDraft((prev) => {
                      const nextHidden = e.target.checked
                        ? prev.filter((x) => x !== st)
                        : [...prev, st];
                      const normalized =
                        nextHidden.length >= TRACKER_STATUSES.length
                          ? TRACKER_STATUSES.filter((x) => x !== "BACKLOG")
                          : nextHidden;
                      queueMicrotask(() => {
                        flush({ hiddenTrackerStatuses: normalized });
                      });
                      return normalized;
                    });
                  }}
                />
                {TRACKER_LABELS[st]}
              </label>
            );
          })}
        </div>
      </div>
      {brandId ? (
        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-sm font-medium">Your ticket labels (this brand)</p>
          <p className="text-xs text-muted-foreground">
            Reusable across all project boards in this brand. Full edit is under Settings → Ticket labels.
          </p>
          <UserTicketLabelsPanel brandId={brandId} boardId={boardId} mode="quick" />
        </div>
      ) : null}
    </div>
  );
}

function PlainSubBoardStrip({
  orderedLists,
  activeSubId,
  onSelect,
  listOrder,
  onEditSubBoard,
}: {
  orderedLists: BoardListDto[];
  activeSubId: string;
  onSelect: (id: string) => void;
  listOrder: string[];
  onEditSubBoard: (subBoardId: string) => void;
}) {
  const activeIdx = Math.max(0, listOrder.indexOf(activeSubId));
  const canScroll = orderedLists.length > 1;

  return (
    <div className="relative mb-4 flex w-full min-w-0 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        disabled={!canScroll}
        aria-label="Previous sub-board"
        onClick={() => {
          const ids = listOrder;
          const i = ids.indexOf(activeSubId);
          const next = ids[(i - 1 + ids.length) % ids.length];
          onSelect(next);
        }}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <div className="flex min-h-[44px] w-full min-w-0 flex-1 items-stretch gap-2 rounded-xl bg-muted/30 px-2 py-1.5">
        {orderedLists.map((list) => (
          <div
            key={list.id}
            className={cn(
              "flex min-w-0 flex-1 basis-0 items-center gap-1 rounded-lg px-2 py-1",
              list.id === activeSubId
                ? "bg-background text-foreground shadow-sm ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(list.id)}
              className="min-w-0 flex-1 truncate text-left text-sm font-medium"
            >
              {list.title}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground"
              aria-label={`Edit sub-board ${list.title}`}
              onClick={() => onEditSubBoard(list.id)}
            >
              <Settings2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        disabled={!canScroll}
        aria-label="Next sub-board"
        onClick={() => {
          const ids = listOrder;
          const i = ids.indexOf(activeSubId);
          const next = ids[(i + 1) % ids.length];
          onSelect(next);
        }}
      >
        <ChevronRight className="size-4" />
      </Button>
      <span className="sr-only" aria-live="polite">
        Sub-board {activeIdx + 1} of {orderedLists.length}
      </span>
    </div>
  );
}

function SubBoardCarouselStrip({
  orderedLists,
  activeSubId,
  onSelect,
  listOrder,
  sortable,
  onEditSubBoard,
}: {
  orderedLists: BoardListDto[];
  activeSubId: string;
  onSelect: (id: string) => void;
  listOrder: string[];
  sortable: boolean;
  onEditSubBoard: (subBoardId: string) => void;
}) {
  if (!sortable) {
    return (
      <PlainSubBoardStrip
        orderedLists={orderedLists}
        activeSubId={activeSubId}
        onSelect={onSelect}
        listOrder={listOrder}
        onEditSubBoard={onEditSubBoard}
      />
    );
  }

  const activeIdx = Math.max(0, listOrder.indexOf(activeSubId));
  const canScroll = orderedLists.length > 1;

  return (
    <div className="relative mb-4 flex w-full min-w-0 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        disabled={!canScroll}
        aria-label="Previous sub-board"
        onClick={() => {
          const ids = listOrder;
          const i = ids.indexOf(activeSubId);
          const next = ids[(i - 1 + ids.length) % ids.length];
          onSelect(next);
        }}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <SortableContext items={listOrder.map(sbDragId)} strategy={horizontalListSortingStrategy}>
        <div className="flex min-h-[52px] w-full min-w-0 flex-1 items-stretch gap-2 rounded-xl bg-muted/30 px-2 py-1.5">
          {orderedLists.map((list) => (
            <SortableSubBoardTab
              key={list.id}
              list={list}
              isActive={list.id === activeSubId}
              onActivate={() => onSelect(list.id)}
              onEdit={onEditSubBoard}
            />
          ))}
        </div>
      </SortableContext>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        disabled={!canScroll}
        aria-label="Next sub-board"
        onClick={() => {
          const ids = listOrder;
          const i = ids.indexOf(activeSubId);
          const next = ids[(i + 1) % ids.length];
          onSelect(next);
        }}
      >
        <ChevronRight className="size-4" />
      </Button>
      <span className="sr-only" aria-live="polite">
        Sub-board {activeIdx + 1} of {orderedLists.length}
      </span>
    </div>
  );
}

function PinnedDropZone({
  draggingSubBoard,
  onDropZoneElement,
}: {
  draggingSubBoard: boolean;
  onDropZoneElement?: (el: HTMLDivElement | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: PIN_DROP_ZONE_ID });
  return (
    <div className="space-y-2">
      <div
        ref={(el) => {
          setNodeRef(el);
          onDropZoneElement?.(el);
        }}
        className={cn(
          "flex min-h-[56px] items-center justify-center rounded-xl border-2 border-dashed px-3 py-3 text-sm text-muted-foreground transition-colors",
          isOver && "border-primary bg-primary/5 text-foreground",
        )}
      >
        {draggingSubBoard
          ? "Drop sub-board here to open an additional pinned view"
          : "Drag a sub-board tab here to open an additional pinned view"}
      </div>
    </div>
  );
}

function SortablePinnedPanel({
  subBoard,
  onUnpin,
  children,
}: {
  subBoard: BoardListDto;
  onUnpin: (subBoardId: string) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pinnedDragId(subBoard.id),
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "w-full min-w-0 space-y-2 rounded-xl border bg-background/70 p-3",
        isDragging && "opacity-70",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground"
          {...attributes}
          {...listeners}
          aria-label={`Reorder pinned sub-board ${subBoard.title}`}
        >
          <GripVertical className="size-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{subBoard.title}</p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => onUnpin(subBoard.id)}
        >
          <PinOff className="mr-1 size-3.5" />
          Unpin
        </Button>
      </div>
      {children}
    </section>
  );
}

function BoardKanbanFiltered({
  board,
  onOpenTask,
  onAddSubBoard,
  onArchiveBoard,
  boardArchived = false,
}: BoardKanbanProps) {
  const queryClient = useQueryClient();
  const canDeleteSubBoard = board.lists.length > 1;
  const [activeSubId, setActiveSubId] = useState(() => board.lists[0]?.id ?? "");
  const [pinnedSubBoardIds, setPinnedSubBoardIds] = useState<string[]>([]);
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);

  const boardPrefsQuery = useQuery({
    queryKey: ["board-user-prefs", board.id],
    queryFn: () => fetchBoardUserPreferences(board.id),
  });
  const boardUserPref = boardPrefsQuery.data;

  const hiddenSubSet = useMemo(
    () => new Set(boardUserPref?.hiddenSubBoardIds ?? []),
    [boardUserPref?.hiddenSubBoardIds],
  );

  const visibleListsOrdered = useMemo(
    () => board.lists.filter((l) => !hiddenSubSet.has(l.id)),
    [board.lists, hiddenSubSet],
  );

  const listOrderVisible = useMemo(() => visibleListsOrdered.map((l) => l.id), [visibleListsOrdered]);

  useEffect(() => {
    setPinnedSubBoardIds((prev) => prev.filter((id) => !hiddenSubSet.has(id)));
  }, [hiddenSubSet]);

  useEffect(() => {
    if (!board.lists.some((l) => l.id === activeSubId)) {
      const first = visibleListsOrdered[0] ?? board.lists[0];
      if (first) setActiveSubId(first.id);
    }
  }, [board, activeSubId, visibleListsOrdered]);

  useEffect(() => {
    if (hiddenSubSet.has(activeSubId)) {
      const first = visibleListsOrdered[0];
      if (first) setActiveSubId(first.id);
    }
  }, [activeSubId, hiddenSubSet, visibleListsOrdered]);

  const activeSub =
    board.lists.find((l) => l.id === activeSubId && !hiddenSubSet.has(l.id)) ??
    visibleListsOrdered[0] ??
    board.lists[0] ??
    null;

  if (!board.lists.length) {
    return <p className="text-sm text-muted-foreground">This board has no sub-boards yet.</p>;
  }
  if (!activeSub || !visibleListsOrdered.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No sub-boards are visible. Open project board settings (sliders icon) and enable at least one.
      </p>
    );
  }
  const pinnedSubBoards = pinnedSubBoardIds
    .map((id) => board.lists.find((l) => l.id === id))
    .filter((s): s is BoardListDto => Boolean(s));
  const sendTargets = board.lists.map((l) => ({ id: l.id, title: l.title }));
  const [editorSubBoardId, setEditorSubBoardId] = useState<string | null>(null);
  const [editorColorDraft, setEditorColorDraft] = useState("");
  const [editorHiddenDraft, setEditorHiddenDraft] = useState<TrackerStatus[]>([]);
  const [editorCardFaceDraft, setEditorCardFaceDraft] = useState("standard");
  const [editorCheckboxDefaultDraft, setEditorCheckboxDefaultDraft] = useState(true);

  const subBoardSheetSizing = useResizableRightAppSheetWidth({ open: Boolean(editorSubBoardId) });
  const boardSettingsSheetSizing = useResizableRightAppSheetWidth({ open: boardSettingsOpen });

  const prefQuery = useQuery({
    queryKey: ["sub-board-prefs", board.id],
    queryFn: () => fetchBoardSubBoardPreferences(board.id),
  });
  const prefBySubBoard = useMemo<Record<string, SubBoardPreferenceDto | undefined>>(() => {
    const map: Record<string, SubBoardPreferenceDto | undefined> = {};
    for (const row of prefQuery.data ?? []) map[row.subBoardId] = row;
    return map;
  }, [prefQuery.data]);

  const pinSubBoard = (subBoardId: string) => {
    setPinnedSubBoardIds((prev) => (prev.includes(subBoardId) ? prev : [...prev, subBoardId]));
  };
  const unpinSubBoard = (subBoardId: string) => {
    setPinnedSubBoardIds((prev) => prev.filter((id) => id !== subBoardId));
  };

  const createMutation = useMutation({
    mutationFn: ({ laneId, title }: { laneId: string; title: string }) => {
      const parsed = parseLaneKey(laneId);
      const subBoardId = parsed?.subBoardId ?? activeSub.id;
      const trackerStatus = parsed?.status ?? "BACKLOG";
      return createBoardTask(board.id, { title, subBoardId, trackerStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });

  const titleMutation = useMutation({
    mutationFn: ({ subBoardId, title }: { subBoardId: string; title: string }) =>
      patchBoardList(board.id, subBoardId, { title }),
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
    mutationFn: (subBoardId: string) => deleteBoardList(board.id, subBoardId),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", board.id], next);
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["board-user-prefs", board.id] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: ({ taskId, subBoardId }: { taskId: string; subBoardId: string }) =>
      patchTask(taskId, { subBoardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });
  const prefMutation = useMutation({
    mutationFn: (payload: SubBoardPrefSavePayload) =>
      patchSubBoardPreference(payload.subBoardId, {
        ticketCardColor: payload.ticketCardColor,
        hiddenTrackerStatuses: payload.hiddenTrackerStatuses,
        cardFaceLayout: payload.cardFaceLayout,
        completeCheckboxVisibleByDefault: payload.completeCheckboxVisibleByDefault,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-board-prefs", board.id] });
    },
    onMutate: async (payload) => {
      const optimistic: SubBoardPreferenceDto = {
        subBoardId: payload.subBoardId,
        ticketCardColor: payload.ticketCardColor ?? null,
        hiddenTrackerStatuses: payload.hiddenTrackerStatuses,
        cardFaceLayout: payload.cardFaceLayout === "minimal" ? "minimal" : "standard",
        completeCheckboxVisibleByDefault: payload.completeCheckboxVisibleByDefault,
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<SubBoardPreferenceDto[]>(
        ["sub-board-prefs", board.id],
        (prev) => upsertPrefRows(prev, optimistic),
      );
    },
  });

  const requestDeleteSubBoard = (list: BoardListDto) => {
    if (!canDeleteSubBoard) return;
    if (!confirmDeleteSubBoard(list)) return;
    deleteListMutation.mutate(list.id);
  };

  const activeVisibleStatuses = visibleStatusesForSubBoard(activeSub.id, prefBySubBoard, boardUserPref);
  const activeCardColor = cardColorForSubBoard(activeSub.id, prefBySubBoard, boardUserPref);
  const editorSubBoard = editorSubBoardId
    ? board.lists.find((l) => l.id === editorSubBoardId) ?? null
    : null;

  useEffect(() => {
    if (!editorSubBoardId) return;
    const pref = prefBySubBoard[editorSubBoardId];
    setEditorColorDraft(pref?.ticketCardColor ?? "");
    setEditorHiddenDraft(pref?.hiddenTrackerStatuses ?? []);
    setEditorCardFaceDraft(pref?.cardFaceLayout === "minimal" ? "minimal" : "standard");
    setEditorCheckboxDefaultDraft(pref?.completeCheckboxVisibleByDefault !== false);
  }, [editorSubBoardId, prefBySubBoard]);

  return (
    <section className="w-full min-w-0 space-y-3 rounded-2xl border bg-card/70 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Project board
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          {!boardArchived ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label="Project board settings"
              onClick={() => setBoardSettingsOpen(true)}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground">
                <EllipsisVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => onAddSubBoard?.()}>Add sub-board</DropdownMenuItem>
              {onArchiveBoard && !boardArchived ? (
                <DropdownMenuItem
                  onSelect={() => {
                    onArchiveBoard();
                  }}
                >
                  <Archive className="mr-2 size-4" />
                  Archive board
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Filters are on — drag-and-drop is paused. Clear filters to move tickets.
      </p>
      <SubBoardCarouselStrip
        orderedLists={visibleListsOrdered}
        activeSubId={activeSub.id}
        onSelect={setActiveSubId}
        listOrder={listOrderVisible}
        sortable={false}
        onEditSubBoard={setEditorSubBoardId}
      />
      <ReadOnlyTrackerGrid
        board={board}
        activeSub={activeSub}
        onOpenTask={onOpenTask}
        onQuickAdd={(laneId, title) => createMutation.mutate({ laneId, title })}
        onToggleComplete={(t) => toggleMutation.mutate(t)}
        sendMutation={sendMutation}
        visibleStatuses={activeVisibleStatuses}
        cardColor={activeCardColor}
        prefBySubBoard={prefBySubBoard}
        boardUserPref={boardUserPref}
      />
      <div className="space-y-3">
        <PinnedDropZone draggingSubBoard={false} />
        {pinnedSubBoards.map((sb) => {
          const byLane = buildLaneItems(sb);
          return (
            <section key={sb.id} className="w-full min-w-0 space-y-2 rounded-xl border bg-background/70 p-3">
              <div className="flex items-center justify-between">
                <p className="min-w-0 truncate text-sm font-semibold">{sb.title}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => unpinSubBoard(sb.id)}
                >
                  <PinOff className="mr-1 size-3.5" />
                  Unpin
                </Button>
              </div>
              <div className="flex w-full min-w-0 gap-2 pb-1">
                {visibleStatusesForSubBoard(sb.id, prefBySubBoard, boardUserPref).map((st) => (
                  <ReadOnlyLaneInner
                    key={`${sb.id}-${st}`}
                    laneId={laneKey(sb.id, st)}
                    label={TRACKER_LABELS[st]}
                    taskIds={byLane[laneKey(sb.id, st)] ?? []}
                    taskMap={buildTaskMap(board)}
                    onOpen={onOpenTask}
                    onToggleComplete={(t) => toggleMutation.mutate(t)}
                    onQuickAdd={(laneId, title) => createMutation.mutate({ laneId, title })}
                    sendTargets={sendTargets}
                    onSendTo={(taskId, subBoardId) => sendMutation.mutate({ taskId, subBoardId })}
                    cardColor={cardColorForSubBoard(sb.id, prefBySubBoard, boardUserPref)}
                    prefBySubBoard={prefBySubBoard}
                    boardUserPref={boardUserPref}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <Sheet open={Boolean(editorSubBoard)} onOpenChange={(open) => !open && setEditorSubBoardId(null)}>
        <SheetContent
          side="right"
          className={cn(rightAppSheetContentClassName, "overflow-y-auto")}
          style={subBoardSheetSizing.sheetWidthStyle}
        >
          <RightAppSheetResizeHandle onMouseDown={subBoardSheetSizing.startResize} />
          <SheetHeader className="border-b px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
            <SheetTitle>Sub-board options</SheetTitle>
            <SheetDescription>
              {editorSubBoard ? `Customize ${editorSubBoard.title} across all board views.` : ""}
            </SheetDescription>
          </SheetHeader>
          {editorSubBoard ? (
            <SubBoardPrefsEditor
              editorSubBoard={editorSubBoard}
              pinnedSubBoardIds={pinnedSubBoardIds}
              pinSubBoard={pinSubBoard}
              unpinSubBoard={unpinSubBoard}
              editorColorDraft={editorColorDraft}
              setEditorColorDraft={setEditorColorDraft}
              editorHiddenDraft={editorHiddenDraft}
              setEditorHiddenDraft={setEditorHiddenDraft}
              editorCardFaceDraft={editorCardFaceDraft}
              setEditorCardFaceDraft={setEditorCardFaceDraft}
              editorCheckboxDefaultDraft={editorCheckboxDefaultDraft}
              setEditorCheckboxDefaultDraft={setEditorCheckboxDefaultDraft}
              savePref={(p) => prefMutation.mutate(p)}
              brandId={board.brandId}
              boardId={board.id}
              canDeleteSubBoard={canDeleteSubBoard}
              deleteBusy={deleteListMutation.isPending}
              onRequestDelete={requestDeleteSubBoard}
              onTitleCommit={(subBoardId, title) => titleMutation.mutate({ subBoardId, title })}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      <Sheet open={boardSettingsOpen} onOpenChange={setBoardSettingsOpen}>
        <SheetContent
          side="right"
          className={cn(rightAppSheetContentClassName, "overflow-y-auto")}
          style={boardSettingsSheetSizing.sheetWidthStyle}
        >
          <RightAppSheetResizeHandle onMouseDown={boardSettingsSheetSizing.startResize} />
          <SheetHeader className="border-b px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
            <SheetTitle>Project board settings</SheetTitle>
            <SheetDescription>
              Defaults for every sub-board on this board. Sub-board options can still override.
            </SheetDescription>
          </SheetHeader>
          {boardPrefsQuery.data ? (
            <ProjectBoardSettingsPanel board={board} preference={boardPrefsQuery.data} />
          ) : (
            <p className="px-5 py-4 pl-10 pr-6 text-sm text-muted-foreground sm:px-6 sm:pl-12 sm:pr-8">
              Loading preferences…
            </p>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function BoardKanbanDnd({ board, onOpenTask, onAddSubBoard, onArchiveBoard, boardArchived = false }: BoardKanbanProps) {
  const queryClient = useQueryClient();
  const canDeleteSubBoard = board.lists.length > 1;

  const [listOrder, setListOrder] = useState<string[]>(() => board.lists.map((l) => l.id));
  const [activeSubId, setActiveSubId] = useState(() => board.lists[0]?.id ?? "");
  const [pinnedSubBoardIds, setPinnedSubBoardIds] = useState<string[]>([]);
  const [editorSubBoardId, setEditorSubBoardId] = useState<string | null>(null);
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  const [editorColorDraft, setEditorColorDraft] = useState("");
  const [editorHiddenDraft, setEditorHiddenDraft] = useState<TrackerStatus[]>([]);
  const [editorCardFaceDraft, setEditorCardFaceDraft] = useState("standard");
  const [editorCheckboxDefaultDraft, setEditorCheckboxDefaultDraft] = useState(true);

  const subBoardSheetSizingDnd = useResizableRightAppSheetWidth({ open: Boolean(editorSubBoardId) });
  const boardSettingsSheetSizingDnd = useResizableRightAppSheetWidth({ open: boardSettingsOpen });

  const boardPrefsQuery = useQuery({
    queryKey: ["board-user-prefs", board.id],
    queryFn: () => fetchBoardUserPreferences(board.id),
  });
  const boardUserPref = boardPrefsQuery.data;

  const hiddenSubSet = useMemo(
    () => new Set(boardUserPref?.hiddenSubBoardIds ?? []),
    [boardUserPref?.hiddenSubBoardIds],
  );

  const listById = useMemo(() => new Map(board.lists.map((l) => [l.id, l])), [board.lists]);

  const orderedLists = useMemo(() => {
    const out: BoardListDto[] = [];
    for (const id of listOrder) {
      const l = listById.get(id);
      if (l) out.push(l);
    }
    return out;
  }, [listOrder, listById]);

  const visibleListsOrdered = useMemo(
    () => orderedLists.filter((l) => !hiddenSubSet.has(l.id)),
    [orderedLists, hiddenSubSet],
  );

  const listOrderVisible = useMemo(() => visibleListsOrdered.map((l) => l.id), [visibleListsOrdered]);

  const stripSortable = hiddenSubSet.size === 0;

  useEffect(() => {
    setPinnedSubBoardIds((prev) => prev.filter((id) => !hiddenSubSet.has(id)));
  }, [hiddenSubSet]);

  useEffect(() => {
    if (hiddenSubSet.has(activeSubId)) {
      const first = visibleListsOrdered[0];
      if (first) setActiveSubId(first.id);
    }
  }, [activeSubId, hiddenSubSet, visibleListsOrdered]);

  const activeSub = useMemo(() => {
    const sub =
      board.lists.find((l) => l.id === activeSubId && !hiddenSubSet.has(l.id)) ??
      visibleListsOrdered[0] ??
      board.lists[0] ??
      null;
    return sub;
  }, [board.lists, activeSubId, hiddenSubSet, visibleListsOrdered]);

  const [items, setItems] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pinnedDropZoneEl, setPinnedDropZoneEl] = useState<HTMLDivElement | null>(null);
  const itemsRef = useRef(items);
  const listOrderRef = useRef(listOrder);
  itemsRef.current = items;
  listOrderRef.current = listOrder;

  const taskMap = useMemo(() => buildTaskMap(board), [board]);

  const pinnedSubBoards = useMemo(
    () =>
      pinnedSubBoardIds
        .map((id) => listById.get(id))
        .filter((s): s is BoardListDto => Boolean(s)),
    [pinnedSubBoardIds, listById],
  );
  const visibleSubBoards = useMemo(() => {
    if (!activeSub) return pinnedSubBoards;
    const seen = new Set<string>([activeSub.id]);
    return [activeSub, ...pinnedSubBoards.filter((s) => !seen.has(s.id))];
  }, [activeSub, pinnedSubBoards]);
  const prefQuery = useQuery({
    queryKey: ["sub-board-prefs", board.id],
    queryFn: () => fetchBoardSubBoardPreferences(board.id),
  });
  const prefBySubBoard = useMemo<Record<string, SubBoardPreferenceDto | undefined>>(() => {
    const map: Record<string, SubBoardPreferenceDto | undefined> = {};
    for (const row of prefQuery.data ?? []) map[row.subBoardId] = row;
    return map;
  }, [prefQuery.data]);

  useEffect(() => {
    const nextOrder = board.lists.map((l) => l.id);
    listOrderRef.current = nextOrder;
    setListOrder(nextOrder);
    setActiveSubId((cur) => (nextOrder.includes(cur) ? cur : nextOrder[0] ?? ""));
    setPinnedSubBoardIds((prev) => prev.filter((id) => nextOrder.includes(id)));
  }, [board]);

  useEffect(() => {
    if (!activeSub && visibleSubBoards.length === 0) {
      setItems({});
      return;
    }
    const next = mergeLaneItems(visibleSubBoards);
    itemsRef.current = next;
    setItems(next);
  }, [activeSub, visibleSubBoards]);

  const pinSubBoard = (subBoardId: string) => {
    setPinnedSubBoardIds((prev) => (prev.includes(subBoardId) ? prev : [...prev, subBoardId]));
  };
  const unpinSubBoard = (subBoardId: string) => {
    setPinnedSubBoardIds((prev) => prev.filter((id) => id !== subBoardId));
  };
  const resolveLaneTarget = useCallback(
    (overId: string, activeTaskId: string): string | undefined => {
      const direct = findLaneContainer(overId, itemsRef.current);
      if (direct) return direct;
      if (overId.startsWith(PIN_PREFIX)) {
        const subBoardId = overId.slice(PIN_PREFIX.length);
        const activeTask = taskMap.get(activeTaskId);
        const preferred = laneKey(subBoardId, normalizeTrackerStatus(activeTask?.trackerStatus));
        if (preferred in itemsRef.current) return preferred;
        const fallback = laneKey(subBoardId, "BACKLOG");
        if (fallback in itemsRef.current) return fallback;
      }
      return undefined;
    },
    [taskMap],
  );

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
    mutationFn: ({ laneId, title }: { laneId: string; title: string }) => {
      const parsed = parseLaneKey(laneId);
      if (!parsed) {
        return createBoardTask(board.id, { title, subBoardId: activeSub!.id, trackerStatus: "BACKLOG" });
      }
      return createBoardTask(board.id, {
        title,
        subBoardId: parsed.subBoardId,
        trackerStatus: parsed.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });

  const titleMutation = useMutation({
    mutationFn: ({ subBoardId, title }: { subBoardId: string; title: string }) =>
      patchBoardList(board.id, subBoardId, { title }),
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
    mutationFn: (subBoardId: string) => deleteBoardList(board.id, subBoardId),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", board.id], next);
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["board-user-prefs", board.id] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: ({ taskId, subBoardId }: { taskId: string; subBoardId: string }) =>
      patchTask(taskId, { subBoardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });
  const prefMutation = useMutation({
    mutationFn: (payload: SubBoardPrefSavePayload) =>
      patchSubBoardPreference(payload.subBoardId, {
        ticketCardColor: payload.ticketCardColor,
        hiddenTrackerStatuses: payload.hiddenTrackerStatuses,
        cardFaceLayout: payload.cardFaceLayout,
        completeCheckboxVisibleByDefault: payload.completeCheckboxVisibleByDefault,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-board-prefs", board.id] });
    },
    onMutate: async (payload) => {
      const optimistic: SubBoardPreferenceDto = {
        subBoardId: payload.subBoardId,
        ticketCardColor: payload.ticketCardColor ?? null,
        hiddenTrackerStatuses: payload.hiddenTrackerStatuses,
        cardFaceLayout: payload.cardFaceLayout === "minimal" ? "minimal" : "standard",
        completeCheckboxVisibleByDefault: payload.completeCheckboxVisibleByDefault,
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<SubBoardPreferenceDto[]>(
        ["sub-board-prefs", board.id],
        (prev) => upsertPrefRows(prev, optimistic),
      );
    },
  });

  const requestDeleteSubBoard = (list: BoardListDto) => {
    if (!canDeleteSubBoard) return;
    if (!confirmDeleteSubBoard(list)) return;
    deleteListMutation.mutate(list.id);
  };

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    const activeStr = String(active.id);

    if (activeStr.startsWith(SB_PREFIX)) {
      const overId = over?.id != null ? String(over.id) : null;
      if (overId === PIN_DROP_ZONE_ID) return;
      if (!overId || !overId.startsWith(SB_PREFIX)) return;
      setListOrder((prev) => {
        const a = activeStr.slice(SB_PREFIX.length);
        const b = overId.slice(SB_PREFIX.length);
        const oldIndex = prev.indexOf(a);
        const newIndex = prev.indexOf(b);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
        const next = arrayMove(prev, oldIndex, newIndex);
        listOrderRef.current = next;
        return next;
      });
      return;
    }
    if (activeStr.startsWith(PIN_PREFIX)) {
      const overId = over?.id != null ? String(over.id) : null;
      if (!overId || !overId.startsWith(PIN_PREFIX)) return;
      setPinnedSubBoardIds((prev) => {
        const a = activeStr.slice(PIN_PREFIX.length);
        const b = overId.slice(PIN_PREFIX.length);
        const oldIndex = prev.indexOf(a);
        const newIndex = prev.indexOf(b);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
      return;
    }

    const overId = over?.id != null ? String(over.id) : null;
    if (!overId) return;

    setItems((prev) => {
      const activeContainer = findLaneContainer(String(active.id), prev);
      const overContainer = resolveLaneTarget(overId, String(active.id));
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

      if (activeStr.startsWith(SB_PREFIX)) {
        setActiveId(null);
        const overId = over?.id != null ? String(over.id) : null;
        const pointerInPinnedZone = (() => {
          if (!pinnedDropZoneEl) return false;
          const ev = event.activatorEvent;
          if (!(ev instanceof MouseEvent)) return false;
          const rect = pinnedDropZoneEl.getBoundingClientRect();
          return (
            ev.clientX >= rect.left &&
            ev.clientX <= rect.right &&
            ev.clientY >= rect.top &&
            ev.clientY <= rect.bottom
          );
        })();
        if (overId === PIN_DROP_ZONE_ID || pointerInPinnedZone) {
          const subBoardId = activeStr.slice(SB_PREFIX.length);
          pinSubBoard(subBoardId);
          return;
        }
        queueMicrotask(() => reorderMutation.mutate([...listOrderRef.current]));
        return;
      }
      if (activeStr.startsWith(PIN_PREFIX)) {
        setActiveId(null);
        return;
      }

      setActiveId(null);
      if (!over) return;

      setItems((prev) => {
        const activeContainer = findLaneContainer(String(active.id), prev);
        const overContainer = resolveLaneTarget(String(over.id), String(active.id));
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
    [moveMutation, reorderMutation, resolveLaneTarget, pinnedDropZoneEl],
  );

  const draggingSubBoardTab = Boolean(activeId?.startsWith(SB_PREFIX));
  const activeTask =
    activeId && !activeId.startsWith(SB_PREFIX) && !activeId.startsWith(PIN_PREFIX)
      ? taskMap.get(activeId)
      : undefined;
  const activeSbPrefix = activeId?.startsWith(SB_PREFIX) ? activeId.slice(SB_PREFIX.length) : null;
  const activeTabList = activeSbPrefix ? listById.get(activeSbPrefix) : undefined;

  if (!board.lists.length) {
    return <p className="text-sm text-muted-foreground">This board has no sub-boards yet.</p>;
  }
  if (!activeSub || !visibleListsOrdered.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No sub-boards are visible. Open project board settings (sliders icon) and enable at least one.
      </p>
    );
  }

  const sendTargets = board.lists.map((l) => ({ id: l.id, title: l.title }));
  const activeVisibleStatuses = visibleStatusesForSubBoard(activeSub.id, prefBySubBoard, boardUserPref);
  const activeCardColor = cardColorForSubBoard(activeSub.id, prefBySubBoard, boardUserPref);
  const editorSubBoard = editorSubBoardId
    ? board.lists.find((l) => l.id === editorSubBoardId) ?? null
    : null;

  useEffect(() => {
    if (!editorSubBoardId) return;
    const pref = prefBySubBoard[editorSubBoardId];
    setEditorColorDraft(pref?.ticketCardColor ?? "");
    setEditorHiddenDraft(pref?.hiddenTrackerStatuses ?? []);
    setEditorCardFaceDraft(pref?.cardFaceLayout === "minimal" ? "minimal" : "standard");
    setEditorCheckboxDefaultDraft(pref?.completeCheckboxVisibleByDefault !== false);
  }, [editorSubBoardId, prefBySubBoard]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <section className="w-full min-w-0 space-y-3 rounded-2xl border bg-card/70 p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Project board
          </p>
          <div className="flex shrink-0 items-center gap-0.5">
            {!boardArchived ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label="Project board settings"
                onClick={() => setBoardSettingsOpen(true)}
              >
                <SlidersHorizontal className="size-4" />
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground">
                  <EllipsisVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => onAddSubBoard?.()}>Add sub-board</DropdownMenuItem>
                {onArchiveBoard && !boardArchived ? (
                  <DropdownMenuItem onSelect={() => onArchiveBoard()}>
                    <Archive className="mr-2 size-4" />
                    Archive board
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <SubBoardCarouselStrip
          orderedLists={visibleListsOrdered}
          activeSubId={activeSub.id}
          onSelect={setActiveSubId}
          listOrder={listOrderVisible}
          sortable={stripSortable}
          onEditSubBoard={setEditorSubBoardId}
        />
        <div className="flex w-full min-w-0 gap-2 pb-2">
          {activeVisibleStatuses.map((st) => {
            const lid = laneKey(activeSub.id, st);
            return (
              <TrackerLane
                key={lid}
                laneId={lid}
                label={TRACKER_LABELS[st]}
                taskIds={items[lid] ?? []}
                taskMap={taskMap}
                onOpen={onOpenTask}
                onToggleComplete={(t) => toggleMutation.mutate(t)}
                quickAddPlaceholder="Add a ticket…"
                onQuickAdd={(laneId, title) => createMutation.mutate({ laneId, title })}
                sendTargets={sendTargets}
                onSendTo={(taskId, subBoardId) => sendMutation.mutate({ taskId, subBoardId })}
                cardColor={activeCardColor}
                subBoardPref={normalizedSubBoardPref(activeSub.id, prefBySubBoard[activeSub.id], boardUserPref)}
              />
            );
          })}
        </div>
      </section>
      <section className="w-full min-w-0 space-y-3 rounded-2xl border bg-card/70 p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pinned sub-board views
          </p>
          <span className="text-xs text-muted-foreground">
            {pinnedSubBoardIds.length} pinned
          </span>
        </div>
        <PinnedDropZone
          draggingSubBoard={draggingSubBoardTab}
          onDropZoneElement={setPinnedDropZoneEl}
        />
        <SortableContext items={pinnedSubBoardIds.map(pinnedDragId)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {pinnedSubBoards.map((sb) => (
              <SortablePinnedPanel key={sb.id} subBoard={sb} onUnpin={unpinSubBoard}>
                <div className="flex w-full min-w-0 gap-2 pb-1">
                  {visibleStatusesForSubBoard(sb.id, prefBySubBoard, boardUserPref).map((st) => {
                    const lid = laneKey(sb.id, st);
                    return (
                      <TrackerLane
                        key={lid}
                        laneId={lid}
                        label={TRACKER_LABELS[st]}
                        taskIds={items[lid] ?? []}
                        taskMap={taskMap}
                        onOpen={onOpenTask}
                        onToggleComplete={(t) => toggleMutation.mutate(t)}
                        quickAddPlaceholder="Add a ticket…"
                        onQuickAdd={(laneId, title) => createMutation.mutate({ laneId, title })}
                        sendTargets={sendTargets}
                        onSendTo={(taskId, subBoardId) => sendMutation.mutate({ taskId, subBoardId })}
                        cardColor={cardColorForSubBoard(sb.id, prefBySubBoard, boardUserPref)}
                        subBoardPref={normalizedSubBoardPref(sb.id, prefBySubBoard[sb.id], boardUserPref)}
                      />
                    );
                  })}
                </div>
              </SortablePinnedPanel>
            ))}
          </div>
        </SortableContext>
      </section>
      <Sheet open={Boolean(editorSubBoard)} onOpenChange={(open) => !open && setEditorSubBoardId(null)}>
        <SheetContent
          side="right"
          className={cn(rightAppSheetContentClassName, "overflow-y-auto")}
          style={subBoardSheetSizingDnd.sheetWidthStyle}
        >
          <RightAppSheetResizeHandle onMouseDown={subBoardSheetSizingDnd.startResize} />
          <SheetHeader className="border-b px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
            <SheetTitle>Sub-board options</SheetTitle>
            <SheetDescription>
              {editorSubBoard ? `Customize ${editorSubBoard.title} across all board views.` : ""}
            </SheetDescription>
          </SheetHeader>
          {editorSubBoard ? (
            <SubBoardPrefsEditor
              editorSubBoard={editorSubBoard}
              pinnedSubBoardIds={pinnedSubBoardIds}
              pinSubBoard={pinSubBoard}
              unpinSubBoard={unpinSubBoard}
              editorColorDraft={editorColorDraft}
              setEditorColorDraft={setEditorColorDraft}
              editorHiddenDraft={editorHiddenDraft}
              setEditorHiddenDraft={setEditorHiddenDraft}
              editorCardFaceDraft={editorCardFaceDraft}
              setEditorCardFaceDraft={setEditorCardFaceDraft}
              editorCheckboxDefaultDraft={editorCheckboxDefaultDraft}
              setEditorCheckboxDefaultDraft={setEditorCheckboxDefaultDraft}
              savePref={(p) => prefMutation.mutate(p)}
              brandId={board.brandId}
              boardId={board.id}
              canDeleteSubBoard={canDeleteSubBoard}
              deleteBusy={deleteListMutation.isPending}
              onRequestDelete={requestDeleteSubBoard}
              onTitleCommit={(subBoardId, title) => titleMutation.mutate({ subBoardId, title })}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      <Sheet open={boardSettingsOpen} onOpenChange={setBoardSettingsOpen}>
        <SheetContent
          side="right"
          className={cn(rightAppSheetContentClassName, "overflow-y-auto")}
          style={boardSettingsSheetSizingDnd.sheetWidthStyle}
        >
          <RightAppSheetResizeHandle onMouseDown={boardSettingsSheetSizingDnd.startResize} />
          <SheetHeader className="border-b px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
            <SheetTitle>Project board settings</SheetTitle>
            <SheetDescription>
              Defaults for every sub-board on this board. Sub-board options can still override.
            </SheetDescription>
          </SheetHeader>
          {boardPrefsQuery.data ? (
            <ProjectBoardSettingsPanel board={board} preference={boardPrefsQuery.data} />
          ) : (
            <p className="px-5 py-4 pl-10 pr-6 text-sm text-muted-foreground sm:px-6 sm:pl-12 sm:pr-8">
              Loading preferences…
            </p>
          )}
        </SheetContent>
      </Sheet>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <div className="w-64 rounded-xl border bg-card px-3 py-2 text-sm shadow-lg">
            <p className="font-medium">{activeTask.title}</p>
          </div>
        ) : activeTabList ? (
          <div className="flex min-w-[140px] items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm font-semibold shadow-lg">
            <GripVertical className="size-4 shrink-0 text-muted-foreground" />
            {activeTabList.title}
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
