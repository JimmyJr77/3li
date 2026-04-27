import {
  DndContext,
  DragOverlay,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  pointerWithin,
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
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  GripVertical,
  Pin,
  PinOff,
  Plus,
  Settings2,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  applyBoardPositions,
  createBoardTask,
  deleteBoardList,
  fetchBoardSubBoardPreferences,
  fetchBoardUserPreferences,
  patchBoardList,
  patchBoardUserPreferences,
  patchSubBoardPreference,
  patchTask,
  reorderBoardLists,
} from "./api";
import { ProjectBoardSettingsPanel } from "./ProjectBoardSettingsPanel";
import {
  CARD_FACE_META_KEYS,
  CARD_FACE_META_LABELS,
  DEFAULT_CARD_FACE_META,
  normalizeCardFaceMetaInput,
  resolveCardFaceMeta,
  type CardFaceMeta,
} from "./cardFaceMeta";
import type { BoardDto, BoardListDto, BoardUserPreferenceDto, SubBoardPreferenceDto, TaskFlowTask } from "./types";
import {
  laneKey,
  normalizeTrackerStatus,
  parseLaneKey,
  TRACKER_LABELS,
  TRACKER_STATUSES,
  type TrackerStatus,
} from "./trackerMeta";
import { BulkTaskActionsSheet } from "./BulkTaskActionsSheet";
import {
  TaskTicketArchiveContextMenu,
  type TicketArchiveMenuState,
} from "./TaskTicketArchiveContextMenu";
import {
  clearRoutedGlow,
  useRoutedTaskGlow,
} from "@/features/rapidRouter/routedHighlightStore";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RightAppSheetResizeHandle, useResizableRightAppSheetWidth, rightAppSheetContentClassName } from "@/hooks/useResizableRightAppSheetWidth";
import { SUB_BOARD_ACCENT_PALETTE } from "./subBoardAccentPalette";

const SB_PREFIX = "board-subboard:";
const PIN_PREFIX = "board-pinned-subboard:";
const PIN_DROP_ZONE_ID = "board-pinned-drop-zone";

function sbDragId(subBoardId: string) {
  return `${SB_PREFIX}${subBoardId}`;
}

function pinnedDragId(subBoardId: string) {
  return `${PIN_PREFIX}${subBoardId}`;
}

/** Prefer pointer-rect hits for pin targets so tab→pin works above dense lane droppables (closestCorners alone often misses). */
function boardKanbanCollisionDetection(args: Parameters<CollisionDetection>[0]): ReturnType<CollisionDetection> {
  const activeIdStr = String(args.active.id);
  if (activeIdStr.startsWith(SB_PREFIX)) {
    const pointerHits = pointerWithin(args);
    const pinHits = pointerHits.filter(
      (c) => String(c.id) === PIN_DROP_ZONE_ID || String(c.id).startsWith(PIN_PREFIX),
    );
    if (pinHits.length > 0) {
      const zoneHit = pinHits.find((c) => String(c.id) === PIN_DROP_ZONE_ID);
      return zoneHit ? [zoneHit] : [pinHits[0]];
    }
    return closestCorners(args);
  }
  if (activeIdStr.startsWith(PIN_PREFIX)) {
    const pinOnly = args.droppableContainers.filter((c) => String(c.id).startsWith(PIN_PREFIX));
    if (pinOnly.length > 0) {
      return closestCorners({ ...args, droppableContainers: pinOnly });
    }
    return closestCorners(args);
  }
  return closestCorners(args);
}

function pointerEndClient(event: DragEndEvent): { x: number; y: number } | null {
  const ev = event.activatorEvent;
  if (ev instanceof PointerEvent || ev instanceof MouseEvent) {
    return { x: ev.clientX + event.delta.x, y: ev.clientY + event.delta.y };
  }
  return null;
}

function pointInClientRect(x: number, y: number, r: DOMRect) {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
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
  board: BoardDto,
  subBoardId: string,
  prefBySubBoard: Record<string, SubBoardPreferenceDto | undefined>,
  boardUserPref?: BoardUserPreferenceDto,
): string | undefined {
  const sub = prefBySubBoard[subBoardId]?.ticketCardColor ?? null;
  if (sub) return sub;
  const showAccent = boardUserPref?.showBoardAccentBorder !== false;
  const accent = board.accentColor;
  if (showAccent && accent) return accent;
  return undefined;
}

/** Effective prefs for cards (merges board-level defaults with per-sub-board row). */
type EffectiveSubBoardPreference = SubBoardPreferenceDto & {
  cardFaceMetaMerged: CardFaceMeta;
};

/** Fills defaults when the user has no saved row yet for this sub-board. */
function normalizedSubBoardPref(
  subBoardId: string,
  row?: SubBoardPreferenceDto,
  boardUserPref?: BoardUserPreferenceDto,
): EffectiveSubBoardPreference {
  const checkboxFromRow = row?.completeCheckboxVisibleByDefault;
  const checkboxMerged =
    checkboxFromRow !== undefined
      ? checkboxFromRow !== false
      : boardUserPref?.defaultCompleteCheckboxVisible !== false;

  const rawLayout = row?.cardFaceLayout;
  const resolvedLayout =
    rawLayout === "minimal"
      ? "minimal"
      : rawLayout === "standard"
        ? "standard"
        : boardUserPref?.defaultCardFaceLayout === "minimal"
          ? "minimal"
          : "standard";

  const mergedMeta = resolveCardFaceMeta(boardUserPref?.defaultCardFaceMeta, row?.cardFaceMeta);

  return {
    subBoardId,
    ticketCardColor: row?.ticketCardColor ?? null,
    cardFaceLayout: resolvedLayout,
    cardFaceMeta: row?.cardFaceMeta ?? null,
    completeCheckboxVisibleByDefault: checkboxMerged,
    hiddenTrackerStatuses: row?.hiddenTrackerStatuses ?? [],
    showSubBoardAccentStrip:
      (boardUserPref?.showSubBoardAccentStrip !== false) && (row?.showSubBoardAccentStrip !== false),
    updatedAt: row?.updatedAt ?? null,
    cardFaceMetaMerged: mergedMeta,
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
  ticketCardColor?: string | null;
  hiddenTrackerStatuses: TrackerStatus[];
  cardFaceLayout: string;
  /** Omit to leave unchanged; `null` clears overrides (inherit board defaults). */
  cardFaceMeta?: CardFaceMeta | null;
  completeCheckboxVisibleByDefault: boolean;
  showSubBoardAccentStrip?: boolean;
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
  return window.confirm(`Archive the sub-board “${list.title}”?${detail}`);
}

/** Short priority label for the card face (same line as due date). */
function formatTaskCardPriorityShort(priority: string): string | null {
  switch (priority) {
    case "low":
      return "Low Pri";
    case "medium":
      return "Med Pri";
    case "high":
      return "Hi Pri";
    default:
      return null;
  }
}

function sentenceCaseToken(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Display like "Jimmy O." (first name + last initial) from assignee label or email. */
function formatAssigneeNameForCard(label: string): string | null {
  const t = label.trim();
  if (!t) return null;
  if (t.includes("@")) {
    const local = t.split("@")[0]?.trim().replace(/[._]+/g, " ");
    if (!local) return null;
    const token = local.split(/\s+/).filter(Boolean)[0] ?? local;
    return sentenceCaseToken(token);
  }
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return sentenceCaseToken(parts[0]!);
  const first = sentenceCaseToken(parts[0]!);
  const last = parts[parts.length - 1]!;
  if (/^[A-Za-z]\.$/.test(last)) {
    return `${first} ${last[0]!.toUpperCase()}.`;
  }
  if (last.length <= 2 && last.endsWith(".")) {
    return `${first} ${last[0]!.toUpperCase()}.`;
  }
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}

function TaskCardLeftTicketStrip({
  show,
  number,
}: {
  show: boolean;
  number: number | null | undefined;
}) {
  if (!show || number == null) return null;
  return (
    <div
      className="relative flex w-6 shrink-0 items-center justify-center self-stretch overflow-visible border-r border-border/60 py-1 pr-0.5"
      aria-label={`Ticket ${number}`}
    >
      <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 select-none whitespace-nowrap font-mono text-[10px] font-medium tabular-nums leading-none text-muted-foreground">
        {number}
      </span>
    </div>
  );
}

/** Fixed-width right rail: optional colored strip (inset from card border via parent `pr-*`). Send-to lives in the ticket sheet → Settings. */
function TaskCardRightRail({
  accentColor,
  showStrip,
}: {
  accentColor?: string | null;
  showStrip: boolean;
}) {
  const colored = Boolean(showStrip && accentColor);
  if (!colored) return null;

  return (
    <div className="flex w-7 shrink-0 self-stretch" aria-hidden>
      <div
        className="flex w-full flex-1 items-center justify-center rounded-sm"
        style={{ backgroundColor: accentColor! }}
      />
    </div>
  );
}

function TaskCardFace({
  task,
  onOpen,
  onToggleComplete,
  subBoardPref,
  selectionMode,
}: {
  task: TaskFlowTask;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  subBoardPref: EffectiveSubBoardPreference;
  /** When true, card face does not open the ticket or toggle completion (multi-select on the card shell). */
  selectionMode?: boolean;
}) {
  const { activeWorkspaceId } = useActiveWorkspace();
  const taskWs = task.list?.board?.workspaceId ?? activeWorkspaceId ?? undefined;
  const doneCount = task.checklist?.filter((c) => c.completed).length ?? 0;
  const checkTotal = task.checklist?.length ?? 0;
  const minimal = subBoardPref.cardFaceLayout === "minimal";
  const showDoneCheckbox = effectiveCompleteCheckboxOnCard(task, subBoardPref);
  const meta = subBoardPref.cardFaceMetaMerged;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 gap-2",
        /* Title-only cards: center checkbox with the single title line; keep default stretch for standard (title + meta). */
        minimal && "items-center",
      )}
    >
      {showDoneCheckbox ? (
        <input
          type="checkbox"
          checked={task.completed}
          className={cn(
            "size-4 shrink-0 rounded border",
            !minimal && "mt-0.5",
            selectionMode && "pointer-events-none opacity-40",
          )}
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
          onClick={(e) => e.stopPropagation()}
          onChange={() => {
            if (selectionMode) return;
            if (taskWs) clearRoutedGlow("task", task.id, taskWs);
            onToggleComplete(task);
          }}
          tabIndex={selectionMode ? -1 : undefined}
        />
      ) : null}
      {selectionMode ? (
        <div className={cn("min-w-0 flex-1 text-left", !showDoneCheckbox && "pl-0.5")}>
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
            {meta.showLabels && task.labels.length > 0 ? (
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
            ) : null}
            {(() => {
              const pri =
                meta.showPriority && task.priority ? formatTaskCardPriorityShort(task.priority) : null;
              const hasDue = Boolean(meta.showDueDate && task.dueDate);
              const assigneeShort =
                meta.showAssignee && task.assignee?.label?.trim()
                  ? formatAssigneeNameForCard(task.assignee.label)
                  : null;
              if (!hasDue && !pri && !assigneeShort) return null;
              const assigneeFull = task.assignee?.label?.trim() ?? "";
              return (
                <p
                  className="mt-1 inline-flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground"
                  {...(assigneeFull ? { title: `Assigned: ${assigneeFull}` } : {})}
                >
                  {hasDue ? <span>Due {new Date(task.dueDate!).toLocaleDateString()}</span> : null}
                  {pri ? <span className="font-medium text-foreground">{pri}</span> : null}
                  {assigneeShort ? (
                    <>
                      <span className="sr-only">Assigned </span>
                      <span aria-hidden className="text-muted-foreground">
                        {"→ "}
                      </span>
                      <span className="font-medium text-foreground">{assigneeShort}</span>
                    </>
                  ) : null}
                </p>
              );
            })()}
            {task.ideaNode && (
              <p className="mt-1 text-xs text-muted-foreground">Idea: {task.ideaNode.title}</p>
            )}
            {checkTotal > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Checklist {doneCount}/{checkTotal}
              </p>
            )}
          </>
        ) : null}
        </div>
      ) : (
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
              {meta.showLabels && task.labels.length > 0 ? (
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
              ) : null}
              {(() => {
                const pri =
                  meta.showPriority && task.priority ? formatTaskCardPriorityShort(task.priority) : null;
                const hasDue = Boolean(meta.showDueDate && task.dueDate);
                const assigneeShort =
                  meta.showAssignee && task.assignee?.label?.trim()
                    ? formatAssigneeNameForCard(task.assignee.label)
                    : null;
                if (!hasDue && !pri && !assigneeShort) return null;
                const assigneeFull = task.assignee?.label?.trim() ?? "";
                return (
                  <p
                    className="mt-1 inline-flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground"
                    {...(assigneeFull ? { title: `Assigned: ${assigneeFull}` } : {})}
                  >
                    {hasDue ? <span>Due {new Date(task.dueDate!).toLocaleDateString()}</span> : null}
                    {pri ? <span className="font-medium text-foreground">{pri}</span> : null}
                    {assigneeShort ? (
                      <>
                        <span className="sr-only">Assigned </span>
                        <span aria-hidden className="text-muted-foreground">
                          {"→ "}
                        </span>
                        <span className="font-medium text-foreground">{assigneeShort}</span>
                      </>
                    ) : null}
                  </p>
                );
              })()}
              {task.ideaNode && (
                <p className="mt-1 text-xs text-muted-foreground">Idea: {task.ideaNode.title}</p>
              )}
              {checkTotal > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Checklist {doneCount}/{checkTotal}
                </p>
              )}
            </>
          ) : null}
        </button>
      )}
    </div>
  );
}

function SortableTaskCard({
  task,
  onOpen,
  onToggleComplete,
  cardColor,
  subBoardPref,
  listAccentColor,
  boardArchived,
}: {
  task: TaskFlowTask;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  cardColor?: string;
  subBoardPref: EffectiveSubBoardPreference;
  /** Canonical sub-board accent for the right strip (from `BoardList`). */
  listAccentColor?: string | null;
  boardArchived?: boolean;
}) {
  const ui = useBoardKanbanUi();
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
  const meta = subBoardPref.cardFaceMetaMerged;
  const showTicketStrip = Boolean(meta.showTicketNumber && task.brandTicketNumber != null);
  const showSubStrip = subBoardPref.showSubBoardAccentStrip !== false;
  const isSelected = ui.selectedTaskIds.includes(task.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex gap-0 rounded-xl border bg-card py-2 pl-0 pr-1.5 text-sm shadow-sm transition-shadow hover:shadow-md",
        cardColor ? "border-2" : "border",
        glow &&
          "ring-2 ring-yellow-400/75 ring-offset-2 ring-offset-background shadow-[0_0_18px_rgba(234,179,8,0.42)]",
        isDragging && "z-10 opacity-40",
        ui.bulkSelectMode && isSelected && "bg-emerald-500/[0.14] ring-2 ring-emerald-400/45 ring-offset-0",
      )}
      onClick={(e) => {
        if (!ui.bulkSelectMode) return;
        e.preventDefault();
        e.stopPropagation();
        ui.toggleTaskSelection(task.id);
      }}
      onContextMenu={(e) => {
        if (boardArchived) return;
        e.preventDefault();
        e.stopPropagation();
        ui.openTicketContextMenu(e, task);
      }}
    >
      <TaskCardLeftTicketStrip show={showTicketStrip} number={task.brandTicketNumber} />
      <button
        type="button"
        className="mt-0.5 shrink-0 cursor-grab touch-none px-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
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
        subBoardPref={subBoardPref}
        selectionMode={ui.bulkSelectMode}
      />
      <TaskCardRightRail accentColor={listAccentColor} showStrip={showSubStrip} />
    </div>
  );
}

function ReadOnlyTaskCard({
  task,
  onOpen,
  onToggleComplete,
  cardColor,
  subBoardPref,
  listAccentColor,
  boardArchived,
}: {
  task: TaskFlowTask;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  cardColor?: string;
  subBoardPref: EffectiveSubBoardPreference;
  listAccentColor?: string | null;
  boardArchived?: boolean;
}) {
  const ui = useBoardKanbanUi();
  const { activeWorkspaceId } = useActiveWorkspace();
  const taskWs = task.list?.board?.workspaceId ?? activeWorkspaceId ?? undefined;
  const glow = useRoutedTaskGlow(task.id, taskWs);
  const meta = subBoardPref.cardFaceMetaMerged;
  const showTicketStrip = Boolean(meta.showTicketNumber && task.brandTicketNumber != null);
  const showSubStrip = subBoardPref.showSubBoardAccentStrip !== false;
  const isSelected = ui.selectedTaskIds.includes(task.id);

  return (
    <div
      className={cn(
        "flex gap-0 rounded-xl border bg-card py-2 pl-0 pr-1.5 text-sm shadow-sm transition-shadow hover:shadow-md",
        cardColor ? "border-2" : "border",
        glow &&
          "ring-2 ring-yellow-400/75 ring-offset-2 ring-offset-background shadow-[0_0_18px_rgba(234,179,8,0.42)]",
        ui.bulkSelectMode && isSelected && "bg-emerald-500/[0.14] ring-2 ring-emerald-400/45 ring-offset-0",
      )}
      style={cardColor ? { borderColor: cardColor } : undefined}
      onClick={(e) => {
        if (!ui.bulkSelectMode) return;
        e.preventDefault();
        e.stopPropagation();
        ui.toggleTaskSelection(task.id);
      }}
      onContextMenu={(e) => {
        if (boardArchived) return;
        e.preventDefault();
        e.stopPropagation();
        ui.openTicketContextMenu(e, task);
      }}
    >
      <TaskCardLeftTicketStrip show={showTicketStrip} number={task.brandTicketNumber} />
      <TaskCardFace
        task={task}
        onOpen={onOpen}
        onToggleComplete={onToggleComplete}
        subBoardPref={subBoardPref}
        selectionMode={ui.bulkSelectMode}
      />
      <TaskCardRightRail accentColor={listAccentColor} showStrip={showSubStrip} />
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
      className="border-input bg-background text-foreground focus-visible:ring-ring w-full min-w-0 rounded-md border px-2 py-1 text-base font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
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
    <div
      ref={setNodeRef}
      style={style}
      role="presentation"
      onClick={onActivate}
      className={cn(
        "relative flex min-h-[44px] min-w-0 flex-1 basis-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-all",
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
    </div>
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
  cardColor,
  subBoardPref,
  listAccentColor,
  boardArchived,
}: {
  laneId: string;
  label: string;
  taskIds: string[];
  taskMap: Map<string, TaskFlowTask>;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  quickAddPlaceholder: string;
  onQuickAdd: (laneId: string, title: string) => void;
  cardColor?: string;
  subBoardPref: EffectiveSubBoardPreference;
  listAccentColor?: string | null;
  boardArchived?: boolean;
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
                cardColor={cardColor}
                subBoardPref={subBoardPref}
                listAccentColor={listAccentColor}
                boardArchived={boardArchived}
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

type BoardKanbanUiValue = {
  bulkSelectMode: boolean;
  setBulkSelectMode: Dispatch<SetStateAction<boolean>>;
  selectedTaskIds: string[];
  toggleTaskSelection: (taskId: string) => void;
  bulkSheetOpen: boolean;
  setBulkSheetOpen: Dispatch<SetStateAction<boolean>>;
  ticketArchiveMenu: TicketArchiveMenuState;
  setTicketArchiveMenu: Dispatch<SetStateAction<TicketArchiveMenuState>>;
  openTicketContextMenu: (e: MouseEvent, task: TaskFlowTask) => void;
};

const BoardKanbanUiContext = createContext<BoardKanbanUiValue | null>(null);

function useBoardKanbanUi(): BoardKanbanUiValue {
  const v = useContext(BoardKanbanUiContext);
  if (!v) throw new Error("useBoardKanbanUi must be used within BoardKanban");
  return v;
}

function BoardKanbanBulkToolbar() {
  const ui = useBoardKanbanUi();
  const n = ui.selectedTaskIds.length;
  return (
    <>
      <Button
        type="button"
        variant={ui.bulkSelectMode ? "secondary" : "ghost"}
        size="icon"
        className="size-8 text-muted-foreground"
        aria-label={ui.bulkSelectMode ? "Exit multi-select mode" : "Select multiple tickets"}
        aria-pressed={ui.bulkSelectMode}
        onClick={() => ui.setBulkSelectMode((v) => !v)}
      >
        <CheckSquare2 className="size-4" />
      </Button>
      {ui.bulkSelectMode && n > 0 ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-8 text-amber-600 dark:text-amber-400"
          aria-label="Open bulk actions"
          onClick={() => ui.setBulkSheetOpen(true)}
        >
          <Zap className="size-4" />
        </Button>
      ) : null}
    </>
  );
}

function ReadOnlyTrackerGrid({
  board,
  activeSub,
  onOpenTask,
  onQuickAdd,
  onToggleComplete,
  visibleStatuses,
  cardColor,
  prefBySubBoard,
  boardUserPref,
  boardArchived,
}: {
  board: BoardDto;
  activeSub: BoardListDto;
  onOpenTask: (t: TaskFlowTask) => void;
  onQuickAdd: (laneId: string, title: string) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  visibleStatuses: TrackerStatus[];
  cardColor?: string;
  prefBySubBoard: Record<string, SubBoardPreferenceDto | undefined>;
  boardUserPref?: BoardUserPreferenceDto;
  boardArchived?: boolean;
}) {
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
            cardColor={cardColor}
            prefBySubBoard={prefBySubBoard}
            boardUserPref={boardUserPref}
            listAccentColor={activeSub.accentColor}
            boardArchived={boardArchived}
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
  cardColor,
  prefBySubBoard,
  boardUserPref,
  listAccentColor,
  boardArchived,
}: {
  laneId: string;
  label: string;
  taskIds: string[];
  taskMap: Map<string, TaskFlowTask>;
  onOpen: (t: TaskFlowTask) => void;
  onToggleComplete: (t: TaskFlowTask) => void;
  onQuickAdd: (laneId: string, title: string) => void;
  cardColor?: string;
  prefBySubBoard: Record<string, SubBoardPreferenceDto | undefined>;
  boardUserPref?: BoardUserPreferenceDto;
  listAccentColor?: string | null;
  boardArchived?: boolean;
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
              cardColor={cardColor}
              subBoardPref={subBoardPref}
              listAccentColor={listAccentColor}
              boardArchived={boardArchived}
            />
          );
        })}
      </div>
    </div>
  );
}

function SubBoardPrefsEditor({
  editorSubBoard,
  board,
  pinnedSubBoardIds,
  pinSubBoard,
  unpinSubBoard,
  editorHiddenDraft,
  setEditorHiddenDraft,
  editorCardFaceDraft,
  setEditorCardFaceDraft,
  editorCardFaceMetaDraft,
  setEditorCardFaceMetaDraft,
  editorCheckboxDefaultDraft,
  setEditorCheckboxDefaultDraft,
  editorShowStripDraft,
  setEditorShowStripDraft,
  boardUserPref,
  savePref,
  patchBoardUserPrefs,
  listAccentBusy,
  onPickListAccent,
  onTitleCommit,
}: {
  editorSubBoard: BoardListDto;
  board: BoardDto;
  pinnedSubBoardIds: string[];
  pinSubBoard: (id: string) => void;
  unpinSubBoard: (id: string) => void;
  editorHiddenDraft: TrackerStatus[];
  setEditorHiddenDraft: Dispatch<SetStateAction<TrackerStatus[]>>;
  editorCardFaceDraft: string;
  setEditorCardFaceDraft: (s: string) => void;
  editorCardFaceMetaDraft: CardFaceMeta;
  setEditorCardFaceMetaDraft: Dispatch<SetStateAction<CardFaceMeta>>;
  editorCheckboxDefaultDraft: boolean;
  setEditorCheckboxDefaultDraft: (b: boolean) => void;
  editorShowStripDraft: boolean;
  setEditorShowStripDraft: (b: boolean) => void;
  boardUserPref?: BoardUserPreferenceDto | null;
  savePref: (payload: SubBoardPrefSavePayload) => void;
  patchBoardUserPrefs: (body: Parameters<typeof patchBoardUserPreferences>[1]) => void;
  listAccentBusy: boolean;
  onPickListAccent: (hex: string) => void;
  onTitleCommit: (subBoardId: string, title: string) => void;
}) {
  const flush = (overrides?: Partial<SubBoardPrefSavePayload>) => {
    const layout = overrides?.cardFaceLayout ?? editorCardFaceDraft;
    const payload: SubBoardPrefSavePayload = {
      subBoardId: editorSubBoard.id,
      hiddenTrackerStatuses: overrides?.hiddenTrackerStatuses ?? editorHiddenDraft,
      cardFaceLayout: layout,
      completeCheckboxVisibleByDefault:
        overrides?.completeCheckboxVisibleByDefault ?? editorCheckboxDefaultDraft,
      showSubBoardAccentStrip: overrides?.showSubBoardAccentStrip ?? editorShowStripDraft,
    };
    if (overrides?.cardFaceMeta !== undefined) {
      payload.cardFaceMeta = overrides.cardFaceMeta;
    } else if (layout === "standard") {
      payload.cardFaceMeta = normalizeCardFaceMetaInput(editorCardFaceMetaDraft);
    }
    savePref(payload);
  };

  const hiddenSubIds = new Set(boardUserPref?.hiddenSubBoardIds ?? []);
  const visibleSubCount = board.lists.filter((l) => !hiddenSubIds.has(l.id)).length;
  const hideSubChecked = hiddenSubIds.has(editorSubBoard.id);
  const hideSubDisabled = !hideSubChecked && visibleSubCount <= 1;

  const stripTitle = `Sub-board (${editorSubBoard.title}) accent strip color`;

  return (
    <div className="space-y-6 px-5 py-2 pb-10 pl-10 pr-6 sm:px-7 sm:pl-12 sm:pr-8">
      <div className="space-y-2 border-b border-border/60 pb-4">
        <Label htmlFor={`sub-board-title-${editorSubBoard.id}`} className="text-sm font-medium">
          Sub-board name
        </Label>
        <div id={`sub-board-title-${editorSubBoard.id}`} className="w-full min-w-0">
          <SubBoardTitleInput
            subBoardId={editorSubBoard.id}
            title={editorSubBoard.title}
            onCommit={onTitleCommit}
          />
        </div>
      </div>

      <div className="space-y-2 border-b border-border/60 pb-6">
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

      <div className="space-y-2 border-b border-border/60 pb-6">
        <p className="text-sm font-medium">{stripTitle}</p>
        <div className="flex flex-wrap gap-2">
          {SUB_BOARD_ACCENT_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "size-7 rounded-md border-2",
                String(editorSubBoard.accentColor ?? "").toLowerCase() === color.toLowerCase()
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border",
              )}
              style={{ backgroundColor: color }}
              aria-label={`${stripTitle} ${color}`}
              disabled={listAccentBusy}
              onClick={() => onPickListAccent(color)}
            />
          ))}
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={editorShowStripDraft}
            onChange={(e) => {
              const next = e.target.checked;
              setEditorShowStripDraft(next);
              flush({ showSubBoardAccentStrip: next });
            }}
          />
          <span>Show colored strip on ticket cards (right edge)</span>
        </label>
      </div>

      <div className="border-b border-border/60 pb-6">
        <p className="mb-2 text-sm font-medium">Default ticket view</p>
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
          <span>Enable &quot;Done&quot; checkmark</span>
        </label>
        <select
          className="border-input bg-background mt-3 h-9 max-w-md rounded-md border px-2 text-sm"
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
        {editorCardFaceDraft === "standard" ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Include on standard cards</p>
            {CARD_FACE_META_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editorCardFaceMetaDraft[key]}
                  onChange={(e) => {
                    const next = { ...editorCardFaceMetaDraft, [key]: e.target.checked };
                    setEditorCardFaceMetaDraft(next);
                    flush({ cardFaceMeta: normalizeCardFaceMetaInput(next) });
                  }}
                />
                {CARD_FACE_META_LABELS[key]}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Default visible tracker lanes</p>
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

      <div className="space-y-2 border-t border-border/60 pt-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hideSubChecked}
            disabled={hideSubDisabled}
            onChange={(e) => {
              const next = new Set(hiddenSubIds);
              if (e.target.checked) next.add(editorSubBoard.id);
              else next.delete(editorSubBoard.id);
              const hidden = [...next];
              const visibleCount = board.lists.length - hidden.length;
              if (visibleCount < 1) return;
              patchBoardUserPrefs({ hiddenSubBoardIds: hidden });
            }}
          />
          <span>Hide sub-board</span>
        </label>
      </div>
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

function PinnedDropZone({ draggingSubBoard }: { draggingSubBoard: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: PIN_DROP_ZONE_ID });
  return (
    <div className="space-y-2">
      {/* Outer hit target: generous padding so highlight/drop aligns with where the pointer actually is */}
      <div ref={setNodeRef} className={cn("rounded-xl p-2 transition-colors", isOver && "bg-primary/5")}>
        <div
          className={cn(
            "flex min-h-[64px] items-center justify-center rounded-lg border-2 border-dashed px-3 py-3 text-sm text-muted-foreground transition-colors",
            isOver && "border-primary text-foreground",
            !isOver && "border-muted-foreground/30",
          )}
        >
          {draggingSubBoard
            ? "Drop sub-board here to open an additional pinned view"
            : "Drag a sub-board tab here to open an additional pinned view"}
        </div>
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

  const activeSub = useMemo(
    () =>
      board.lists.find((l) => l.id === activeSubId && !hiddenSubSet.has(l.id)) ??
      visibleListsOrdered[0] ??
      board.lists[0] ??
      null,
    [board.lists, activeSubId, hiddenSubSet, visibleListsOrdered],
  );

  const [editorSubBoardId, setEditorSubBoardId] = useState<string | null>(null);
  const [editorHiddenDraft, setEditorHiddenDraft] = useState<TrackerStatus[]>([]);
  const [editorCardFaceDraft, setEditorCardFaceDraft] = useState("standard");
  const [editorCardFaceMetaDraft, setEditorCardFaceMetaDraft] = useState<CardFaceMeta>(DEFAULT_CARD_FACE_META);
  const [editorCheckboxDefaultDraft, setEditorCheckboxDefaultDraft] = useState(true);
  const [editorShowStripDraft, setEditorShowStripDraft] = useState(true);

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
      const fallbackSub =
        board.lists.find((l) => l.id === activeSubId && !hiddenSubSet.has(l.id)) ??
        visibleListsOrdered[0] ??
        board.lists[0];
      const subBoardId = parsed?.subBoardId ?? fallbackSub?.id;
      if (!subBoardId) {
        return Promise.reject(new Error("No sub-board to add to"));
      }
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

  const listAccentMutation = useMutation({
    mutationFn: ({ subBoardId, accentColor }: { subBoardId: string; accentColor: string }) =>
      patchBoardList(board.id, subBoardId, { accentColor }),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", board.id], next);
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
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

  const boardUserPrefMutation = useMutation({
    mutationFn: (body: Parameters<typeof patchBoardUserPreferences>[1]) =>
      patchBoardUserPreferences(board.id, body),
    onSuccess: (next) => {
      queryClient.setQueryData(["board-user-prefs", board.id], next);
    },
  });

  const prefMutation = useMutation({
    mutationFn: (payload: SubBoardPrefSavePayload) => {
      const body: Parameters<typeof patchSubBoardPreference>[1] = {
        hiddenTrackerStatuses: payload.hiddenTrackerStatuses,
        cardFaceLayout: payload.cardFaceLayout,
        completeCheckboxVisibleByDefault: payload.completeCheckboxVisibleByDefault,
      };
      if (payload.ticketCardColor !== undefined) body.ticketCardColor = payload.ticketCardColor;
      if (payload.cardFaceMeta !== undefined) body.cardFaceMeta = payload.cardFaceMeta;
      if (payload.showSubBoardAccentStrip !== undefined) body.showSubBoardAccentStrip = payload.showSubBoardAccentStrip;
      return patchSubBoardPreference(payload.subBoardId, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-board-prefs", board.id] });
    },
    onMutate: async (payload) => {
      queryClient.setQueryData<SubBoardPreferenceDto[]>(
        ["sub-board-prefs", board.id],
        (prev) => {
          const old = prev?.find((r) => r.subBoardId === payload.subBoardId);
          const optimistic: SubBoardPreferenceDto = {
            subBoardId: payload.subBoardId,
            ticketCardColor: old?.ticketCardColor ?? null,
            hiddenTrackerStatuses: payload.hiddenTrackerStatuses,
            cardFaceLayout: payload.cardFaceLayout === "minimal" ? "minimal" : "standard",
            completeCheckboxVisibleByDefault: payload.completeCheckboxVisibleByDefault,
            showSubBoardAccentStrip:
              payload.showSubBoardAccentStrip ?? old?.showSubBoardAccentStrip ?? true,
            ...(payload.cardFaceMeta !== undefined ? { cardFaceMeta: payload.cardFaceMeta } : {}),
            updatedAt: new Date().toISOString(),
          };
          return upsertPrefRows(prev, optimistic);
        },
      );
    },
  });

  const requestDeleteSubBoard = (list: BoardListDto) => {
    if (!canDeleteSubBoard) return;
    if (!confirmDeleteSubBoard(list)) return;
    deleteListMutation.mutate(list.id);
  };

  useEffect(() => {
    if (!editorSubBoardId) return;
    const pref = prefBySubBoard[editorSubBoardId];
    const norm = normalizedSubBoardPref(editorSubBoardId, pref, boardUserPref);
    setEditorHiddenDraft(pref?.hiddenTrackerStatuses ?? []);
    setEditorCardFaceDraft(norm.cardFaceLayout);
    setEditorCheckboxDefaultDraft(norm.completeCheckboxVisibleByDefault !== false);
    setEditorCardFaceMetaDraft(norm.cardFaceMetaMerged);
    setEditorShowStripDraft(pref?.showSubBoardAccentStrip !== false);
  }, [editorSubBoardId, prefBySubBoard, boardUserPref]);

  if (!board.lists.length) {
    return <p className="text-sm text-muted-foreground">This board has no sub-boards yet.</p>;
  }

  const pinnedSubBoards = pinnedSubBoardIds
    .map((id) => board.lists.find((l) => l.id === id))
    .filter((s): s is BoardListDto => Boolean(s));
  const activeVisibleStatuses = activeSub
    ? visibleStatusesForSubBoard(activeSub.id, prefBySubBoard, boardUserPref)
    : [];
  const activeCardColor = activeSub
    ? cardColorForSubBoard(board, activeSub.id, prefBySubBoard, boardUserPref)
    : undefined;
  const editorSubBoard = editorSubBoardId
    ? board.lists.find((l) => l.id === editorSubBoardId) ?? null
    : null;

  return (
    <section className="w-full min-w-0 space-y-3 rounded-2xl border bg-card/70 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Project board
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          {!boardArchived ? (
            <>
              <BoardKanbanBulkToolbar />
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
            </>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground">
                <EllipsisVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => onAddSubBoard?.()}>
                <Plus className="mr-2 size-4" />
                Add sub-board
              </DropdownMenuItem>
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
      {!activeSub || !visibleListsOrdered.length ? (
        <p className="text-sm text-muted-foreground">
          No sub-boards are visible. Open project board settings (sliders icon) and enable at least one.
        </p>
      ) : (
        <>
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
            visibleStatuses={activeVisibleStatuses}
            cardColor={activeCardColor}
            prefBySubBoard={prefBySubBoard}
            boardUserPref={boardUserPref}
            boardArchived={boardArchived}
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
                        cardColor={cardColorForSubBoard(board, sb.id, prefBySubBoard, boardUserPref)}
                        prefBySubBoard={prefBySubBoard}
                        boardUserPref={boardUserPref}
                        listAccentColor={sb.accentColor}
                        boardArchived={boardArchived}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
      <Sheet open={Boolean(editorSubBoard)} onOpenChange={(open) => !open && setEditorSubBoardId(null)}>
        <SheetContent
          side="right"
          className={cn(rightAppSheetContentClassName, "!gap-0 min-h-0 overflow-hidden")}
          style={subBoardSheetSizing.sheetWidthStyle}
        >
          <RightAppSheetResizeHandle onMouseDown={subBoardSheetSizing.startResize} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SheetHeader className="border-b px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
              <SheetTitle>Sub-board settings</SheetTitle>
              <SheetDescription>
                {editorSubBoard
                  ? `Settings for ${editorSubBoard.title} mirror project board settings where applicable.`
                  : ""}
              </SheetDescription>
            </SheetHeader>
            {editorSubBoard ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <SubBoardPrefsEditor
                    editorSubBoard={editorSubBoard}
                    board={board}
                    pinnedSubBoardIds={pinnedSubBoardIds}
                    pinSubBoard={pinSubBoard}
                    unpinSubBoard={unpinSubBoard}
                    editorHiddenDraft={editorHiddenDraft}
                    setEditorHiddenDraft={setEditorHiddenDraft}
                    editorCardFaceDraft={editorCardFaceDraft}
                    setEditorCardFaceDraft={setEditorCardFaceDraft}
                    editorCardFaceMetaDraft={editorCardFaceMetaDraft}
                    setEditorCardFaceMetaDraft={setEditorCardFaceMetaDraft}
                    editorCheckboxDefaultDraft={editorCheckboxDefaultDraft}
                    setEditorCheckboxDefaultDraft={setEditorCheckboxDefaultDraft}
                    editorShowStripDraft={editorShowStripDraft}
                    setEditorShowStripDraft={setEditorShowStripDraft}
                    boardUserPref={boardUserPref}
                    savePref={(p) => prefMutation.mutate(p)}
                    patchBoardUserPrefs={(b) => boardUserPrefMutation.mutate(b)}
                    listAccentBusy={listAccentMutation.isPending}
                    onPickListAccent={(hex) =>
                      listAccentMutation.mutate({ subBoardId: editorSubBoard.id, accentColor: hex })
                    }
                    onTitleCommit={(subBoardId, title) => titleMutation.mutate({ subBoardId, title })}
                  />
                </div>
                <div className="shrink-0 border-t border-border bg-card/95 px-10 pt-3 pb-5 sm:px-12 sm:pb-6">
                  <div className="flex w-full flex-wrap items-center justify-start gap-2">
                    <Button type="button" onClick={() => setEditorSubBoardId(null)}>
                      Save & close
                    </Button>
                    {canDeleteSubBoard ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={deleteListMutation.isPending}
                        onClick={() => requestDeleteSubBoard(editorSubBoard)}
                      >
                        <Archive className="mr-1 size-3.5" />
                        Archive Sub-board
                      </Button>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={boardSettingsOpen} onOpenChange={setBoardSettingsOpen}>
        <SheetContent
          side="right"
          className={cn(rightAppSheetContentClassName, "!gap-0 min-h-0 overflow-hidden")}
          style={boardSettingsSheetSizing.sheetWidthStyle}
        >
          <RightAppSheetResizeHandle onMouseDown={boardSettingsSheetSizing.startResize} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SheetHeader className="border-b px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
              <SheetTitle>Project board settings</SheetTitle>
              <SheetDescription>
                Defaults for every sub-board on this project board. Sub-board options can still override these
                settings.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {boardPrefsQuery.isError ? (
                <p className="px-5 py-4 pl-10 pr-6 text-sm text-destructive sm:px-6 sm:pl-12 sm:pr-8">
                  Could not load board preferences. If you recently updated the app, run database migrations
                  (`npx prisma migrate deploy`) and reload.
                </p>
              ) : boardPrefsQuery.data ? (
                <ProjectBoardSettingsPanel board={board} preference={boardPrefsQuery.data} />
              ) : (
                <p className="px-5 py-4 pl-10 pr-6 text-sm text-muted-foreground sm:px-6 sm:pl-12 sm:pr-8">
                  Loading preferences…
                </p>
              )}
            </div>
            <div className="shrink-0 border-t border-border bg-card/95 px-10 pt-3 pb-5 sm:px-12 sm:pb-6">
              <div className="flex flex-wrap items-center justify-start gap-2">
                <Button type="button" onClick={() => setBoardSettingsOpen(false)}>
                  Save & close
                </Button>
              </div>
            </div>
          </div>
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
  const [editorHiddenDraft, setEditorHiddenDraft] = useState<TrackerStatus[]>([]);
  const [editorCardFaceDraft, setEditorCardFaceDraft] = useState("standard");
  const [editorCardFaceMetaDraft, setEditorCardFaceMetaDraft] = useState<CardFaceMeta>(DEFAULT_CARD_FACE_META);
  const [editorCheckboxDefaultDraft, setEditorCheckboxDefaultDraft] = useState(true);
  const [editorShowStripDraft, setEditorShowStripDraft] = useState(true);

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
  const pinnedSectionRef = useRef<HTMLElement | null>(null);
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
    if (!editorSubBoardId) return;
    const pref = prefBySubBoard[editorSubBoardId];
    const norm = normalizedSubBoardPref(editorSubBoardId, pref, boardUserPref);
    setEditorHiddenDraft(pref?.hiddenTrackerStatuses ?? []);
    setEditorCardFaceDraft(norm.cardFaceLayout);
    setEditorCheckboxDefaultDraft(norm.completeCheckboxVisibleByDefault !== false);
    setEditorCardFaceMetaDraft(norm.cardFaceMetaMerged);
    setEditorShowStripDraft(pref?.showSubBoardAccentStrip !== false);
  }, [editorSubBoardId, prefBySubBoard, boardUserPref]);

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

  const ui = useBoardKanbanUi();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: ui.bulkSelectMode ? 9999 : 8 },
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

  const listAccentMutation = useMutation({
    mutationFn: ({ subBoardId, accentColor }: { subBoardId: string; accentColor: string }) =>
      patchBoardList(board.id, subBoardId, { accentColor }),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", board.id], next);
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
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

  const boardUserPrefMutation = useMutation({
    mutationFn: (body: Parameters<typeof patchBoardUserPreferences>[1]) =>
      patchBoardUserPreferences(board.id, body),
    onSuccess: (next) => {
      queryClient.setQueryData(["board-user-prefs", board.id], next);
    },
  });

  const prefMutation = useMutation({
    mutationFn: (payload: SubBoardPrefSavePayload) => {
      const body: Parameters<typeof patchSubBoardPreference>[1] = {
        hiddenTrackerStatuses: payload.hiddenTrackerStatuses,
        cardFaceLayout: payload.cardFaceLayout,
        completeCheckboxVisibleByDefault: payload.completeCheckboxVisibleByDefault,
      };
      if (payload.ticketCardColor !== undefined) body.ticketCardColor = payload.ticketCardColor;
      if (payload.cardFaceMeta !== undefined) body.cardFaceMeta = payload.cardFaceMeta;
      if (payload.showSubBoardAccentStrip !== undefined) body.showSubBoardAccentStrip = payload.showSubBoardAccentStrip;
      return patchSubBoardPreference(payload.subBoardId, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-board-prefs", board.id] });
    },
    onMutate: async (payload) => {
      queryClient.setQueryData<SubBoardPreferenceDto[]>(
        ["sub-board-prefs", board.id],
        (prev) => {
          const old = prev?.find((r) => r.subBoardId === payload.subBoardId);
          const optimistic: SubBoardPreferenceDto = {
            subBoardId: payload.subBoardId,
            ticketCardColor: old?.ticketCardColor ?? null,
            hiddenTrackerStatuses: payload.hiddenTrackerStatuses,
            cardFaceLayout: payload.cardFaceLayout === "minimal" ? "minimal" : "standard",
            completeCheckboxVisibleByDefault: payload.completeCheckboxVisibleByDefault,
            showSubBoardAccentStrip:
              payload.showSubBoardAccentStrip ?? old?.showSubBoardAccentStrip ?? true,
            ...(payload.cardFaceMeta !== undefined ? { cardFaceMeta: payload.cardFaceMeta } : {}),
            updatedAt: new Date().toISOString(),
          };
          return upsertPrefRows(prev, optimistic);
        },
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
        const pinFromOver =
          overId === PIN_DROP_ZONE_ID || (overId != null && overId.startsWith(PIN_PREFIX));
        const pinFromCollisions = (event.collisions ?? []).some(
          (c) => String(c.id) === PIN_DROP_ZONE_ID || String(c.id).startsWith(PIN_PREFIX),
        );
        const pinFromPointer = (() => {
          const pt = pointerEndClient(event);
          if (!pt) return false;
          const section = pinnedSectionRef.current;
          if (section) {
            const r = section.getBoundingClientRect();
            if (pointInClientRect(pt.x, pt.y, r)) return true;
          }
          return false;
        })();
        if (pinFromOver || pinFromCollisions || pinFromPointer) {
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
    [moveMutation, reorderMutation, resolveLaneTarget],
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

  const activeVisibleStatuses = visibleStatusesForSubBoard(activeSub.id, prefBySubBoard, boardUserPref);
  const activeCardColor = cardColorForSubBoard(board, activeSub.id, prefBySubBoard, boardUserPref);
  const editorSubBoard = editorSubBoardId
    ? board.lists.find((l) => l.id === editorSubBoardId) ?? null
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardKanbanCollisionDetection}
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
              <>
                <BoardKanbanBulkToolbar />
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
              </>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground">
                  <EllipsisVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => onAddSubBoard?.()}>
                  <Plus className="mr-2 size-4" />
                  Add sub-board
                </DropdownMenuItem>
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
          sortable
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
                cardColor={activeCardColor}
                subBoardPref={normalizedSubBoardPref(activeSub.id, prefBySubBoard[activeSub.id], boardUserPref)}
                listAccentColor={activeSub.accentColor}
                boardArchived={boardArchived}
              />
            );
          })}
        </div>
      </section>
      <section
        ref={pinnedSectionRef}
        className="w-full min-w-0 space-y-3 rounded-2xl border bg-card/70 p-3 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pinned sub-board views
          </p>
          <span className="text-xs text-muted-foreground">
            {pinnedSubBoardIds.length} pinned
          </span>
        </div>
        <PinnedDropZone draggingSubBoard={draggingSubBoardTab} />
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
                        cardColor={cardColorForSubBoard(board, sb.id, prefBySubBoard, boardUserPref)}
                        subBoardPref={normalizedSubBoardPref(sb.id, prefBySubBoard[sb.id], boardUserPref)}
                        listAccentColor={sb.accentColor}
                        boardArchived={boardArchived}
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
          className={cn(rightAppSheetContentClassName, "!gap-0 min-h-0 overflow-hidden")}
          style={subBoardSheetSizingDnd.sheetWidthStyle}
        >
          <RightAppSheetResizeHandle onMouseDown={subBoardSheetSizingDnd.startResize} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SheetHeader className="border-b px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
              <SheetTitle>Sub-board settings</SheetTitle>
              <SheetDescription>
                {editorSubBoard
                  ? `Settings for ${editorSubBoard.title} mirror project board settings where applicable.`
                  : ""}
              </SheetDescription>
            </SheetHeader>
            {editorSubBoard ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <SubBoardPrefsEditor
                    editorSubBoard={editorSubBoard}
                    board={board}
                    pinnedSubBoardIds={pinnedSubBoardIds}
                    pinSubBoard={pinSubBoard}
                    unpinSubBoard={unpinSubBoard}
                    editorHiddenDraft={editorHiddenDraft}
                    setEditorHiddenDraft={setEditorHiddenDraft}
                    editorCardFaceDraft={editorCardFaceDraft}
                    setEditorCardFaceDraft={setEditorCardFaceDraft}
                    editorCardFaceMetaDraft={editorCardFaceMetaDraft}
                    setEditorCardFaceMetaDraft={setEditorCardFaceMetaDraft}
                    editorCheckboxDefaultDraft={editorCheckboxDefaultDraft}
                    setEditorCheckboxDefaultDraft={setEditorCheckboxDefaultDraft}
                    editorShowStripDraft={editorShowStripDraft}
                    setEditorShowStripDraft={setEditorShowStripDraft}
                    boardUserPref={boardUserPref}
                    savePref={(p) => prefMutation.mutate(p)}
                    patchBoardUserPrefs={(b) => boardUserPrefMutation.mutate(b)}
                    listAccentBusy={listAccentMutation.isPending}
                    onPickListAccent={(hex) =>
                      listAccentMutation.mutate({ subBoardId: editorSubBoard.id, accentColor: hex })
                    }
                    onTitleCommit={(subBoardId, title) => titleMutation.mutate({ subBoardId, title })}
                  />
                </div>
                <div className="shrink-0 border-t border-border bg-card/95 px-10 pt-3 pb-5 sm:px-12 sm:pb-6">
                  <div className="flex w-full flex-wrap items-center justify-start gap-2">
                    <Button type="button" onClick={() => setEditorSubBoardId(null)}>
                      Save & close
                    </Button>
                    {canDeleteSubBoard ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={deleteListMutation.isPending}
                        onClick={() => requestDeleteSubBoard(editorSubBoard)}
                      >
                        <Archive className="mr-1 size-3.5" />
                        Archive Sub-board
                      </Button>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={boardSettingsOpen} onOpenChange={setBoardSettingsOpen}>
        <SheetContent
          side="right"
          className={cn(rightAppSheetContentClassName, "!gap-0 min-h-0 overflow-hidden")}
          style={boardSettingsSheetSizingDnd.sheetWidthStyle}
        >
          <RightAppSheetResizeHandle onMouseDown={boardSettingsSheetSizingDnd.startResize} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SheetHeader className="border-b px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
              <SheetTitle>Project board settings</SheetTitle>
              <SheetDescription>
                Defaults for every sub-board on this project board. Sub-board options can still override these
                settings.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {boardPrefsQuery.isError ? (
                <p className="px-5 py-4 pl-10 pr-6 text-sm text-destructive sm:px-6 sm:pl-12 sm:pr-8">
                  Could not load board preferences. If you recently updated the app, run database migrations
                  (`npx prisma migrate deploy`) and reload.
                </p>
              ) : boardPrefsQuery.data ? (
                <ProjectBoardSettingsPanel board={board} preference={boardPrefsQuery.data} />
              ) : (
                <p className="px-5 py-4 pl-10 pr-6 text-sm text-muted-foreground sm:px-6 sm:pl-12 sm:pr-8">
                  Loading preferences…
                </p>
              )}
            </div>
            <div className="shrink-0 border-t border-border bg-card/95 px-10 pt-3 pb-5 sm:px-12 sm:pb-6">
              <div className="flex flex-wrap items-center justify-start gap-2">
                <Button type="button" onClick={() => setBoardSettingsOpen(false)}>
                  Save & close
                </Button>
              </div>
            </div>
          </div>
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

function BoardKanbanBody(props: BoardKanbanProps) {
  const { dragDisabled, ...rest } = props;
  if (dragDisabled) {
    return <BoardKanbanFiltered {...rest} />;
  }
  return <BoardKanbanDnd {...rest} />;
}

function BoardKanbanShell(props: BoardKanbanProps) {
  const { board, boardArchived = false } = props;
  const queryClient = useQueryClient();
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkSheetOpen, setBulkSheetOpen] = useState(false);
  const [ticketArchiveMenu, setTicketArchiveMenu] = useState<TicketArchiveMenuState>(null);

  useEffect(() => {
    if (!bulkSelectMode) setSelectedTaskIds([]);
  }, [bulkSelectMode]);

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]));
  }, []);

  const archiveTicketMutation = useMutation({
    mutationFn: (task: TaskFlowTask) => patchTask(task.id, { archived: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });

  const openTicketContextMenu = useCallback(
    (e: MouseEvent, task: TaskFlowTask) => {
      if (boardArchived) return;
      e.preventDefault();
      e.stopPropagation();
      setTicketArchiveMenu({ clientX: e.clientX, clientY: e.clientY, task });
    },
    [boardArchived],
  );

  const ui = useMemo(
    (): BoardKanbanUiValue => ({
      bulkSelectMode,
      setBulkSelectMode,
      selectedTaskIds,
      toggleTaskSelection,
      bulkSheetOpen,
      setBulkSheetOpen,
      ticketArchiveMenu,
      setTicketArchiveMenu,
      openTicketContextMenu,
    }),
    [
      bulkSelectMode,
      selectedTaskIds,
      bulkSheetOpen,
      ticketArchiveMenu,
      openTicketContextMenu,
      toggleTaskSelection,
    ],
  );

  return (
    <BoardKanbanUiContext.Provider value={ui}>
      <BoardKanbanBody {...props} />
      <BulkTaskActionsSheet
        board={board}
        boardArchived={boardArchived}
        open={bulkSheetOpen}
        onOpenChange={setBulkSheetOpen}
        selectedTaskIds={selectedTaskIds}
      />
      <TaskTicketArchiveContextMenu
        state={ticketArchiveMenu}
        onClose={() => setTicketArchiveMenu(null)}
        onArchive={(t) => archiveTicketMutation.mutate(t)}
        archivePending={archiveTicketMutation.isPending}
        bulkSelectMode={bulkSelectMode}
        selectedTaskIds={selectedTaskIds}
        onBulkActions={() => setBulkSheetOpen(true)}
        boardArchived={boardArchived}
      />
    </BoardKanbanUiContext.Provider>
  );
}

export function BoardKanban(props: BoardKanbanProps) {
  return <BoardKanbanShell {...props} />;
}
