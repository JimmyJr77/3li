import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Check, Loader2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDebouncedAutosave } from "@/hooks/useDebouncedAutosave";
import { RightAppSheetResizeHandle, useResizableRightAppSheetWidth, rightAppSheetContentClassName } from "@/hooks/useResizableRightAppSheetWidth";
import { cn } from "@/lib/utils";
import { RoutingSourceBadge } from "@/components/shared/RoutingSourceBadge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addTaskLabel,
  addUserTicketLabelToTask,
  fetchBoard,
  fetchBoardSubBoardPreferences,
  fetchBrandTeam,
  fetchLabelSuggestions,
  fetchMyTicketLabels,
  patchTask,
  postComment,
  postMyTicketLabel,
  removeTaskLabel,
  removeUserTicketLabelFromTask,
} from "./api";
import { TicketDescriptionEditor } from "./TicketDescriptionEditor";
import { TicketStyleLabelsBlock } from "./TicketStyleLabelsBlock";
import {
  autoLabelColorFromName,
  mergeFrequentRecentLabelChips,
  searchRankLabelName,
  sortByLabelSearchRelevance,
  type LabelSuggestionChip,
} from "./labelUiUtils";
import { taskDescriptionStringToHTML, taskDescriptionsEqual } from "./taskDescriptionHtml";
import type { BoardDto, TaskFlowTask } from "./types";
import { TRACKER_LABELS, TRACKER_STATUSES, type TrackerStatus, normalizeTrackerStatus } from "./trackerMeta";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-xs font-medium text-muted-foreground">{children}</Label>;
}

type TicketDetailTab = "main" | "comments" | "settings";

const COMMENT_BODY_PREVIEW_CHARS = 220;

function CommentListItem({
  body,
  authorLabel,
  createdAt,
}: {
  body: string;
  authorLabel: string;
  createdAt: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = body.length > COMMENT_BODY_PREVIEW_CHARS;
  const text = !long || expanded ? body : `${body.slice(0, COMMENT_BODY_PREVIEW_CHARS)}…`;

  return (
    <li className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm">
      <p className="whitespace-pre-wrap break-words text-foreground">{text}</p>
      {long ? (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
      <p className="mt-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{authorLabel}</span>
        {" · "}
        {new Date(createdAt).toLocaleString()}
      </p>
    </li>
  );
}

export function TaskDetailSheet({
  board: boardProp,
  boardArchived = false,
  task,
  open,
  onOpenChange,
}: {
  /** When omitted, the sheet loads the board from `task.list.board.id` (e.g. Ticket Tracker). */
  board?: BoardDto | null;
  /** When the parent board is archived, editing actions that hit the API are limited. */
  boardArchived?: boolean;
  task: TaskFlowTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { startResize, sheetWidthStyle } = useResizableRightAppSheetWidth({ open });
  const queryClient = useQueryClient();
  const inferredBoardId = task?.list?.board?.id ?? null;
  const boardQuery = useQuery({
    queryKey: ["board", inferredBoardId],
    queryFn: () => fetchBoard(inferredBoardId!),
    enabled: Boolean(open && task && !boardProp && inferredBoardId),
  });
  const board = boardProp ?? boardQuery.data ?? null;
  const boardIdForPrefs = board?.id ?? null;
  const brandIdForMyLabels = board?.brandId ?? null;
  const subBoardPrefsQuery = useQuery({
    queryKey: ["sub-board-prefs", boardIdForPrefs],
    queryFn: () => fetchBoardSubBoardPreferences(boardIdForPrefs!),
    enabled: Boolean(open && task && boardIdForPrefs),
  });
  const myTicketLabelsQuery = useQuery({
    queryKey: ["my-ticket-labels", brandIdForMyLabels],
    queryFn: () => fetchMyTicketLabels(brandIdForMyLabels!),
    enabled: Boolean(open && task && brandIdForMyLabels),
  });
  const labelSuggestQuery = useQuery({
    queryKey: ["label-suggestions", brandIdForMyLabels],
    queryFn: () => fetchLabelSuggestions(brandIdForMyLabels!),
    enabled: Boolean(open && task && brandIdForMyLabels),
  });
  const brandTeamQuery = useQuery({
    queryKey: ["brand-team", brandIdForMyLabels],
    queryFn: () => fetchBrandTeam(brandIdForMyLabels!),
    enabled: Boolean(open && task && brandIdForMyLabels),
  });
  const subBoardIdForPrefs = task?.subBoardId ?? task?.list?.id ?? null;
  const prefRowForTask = useMemo(
    () => subBoardPrefsQuery.data?.find((r) => r.subBoardId === subBoardIdForPrefs),
    [subBoardPrefsQuery.data, subBoardIdForPrefs],
  );
  const subBoardDefaultCheckboxOnCard = prefRowForTask?.completeCheckboxVisibleByDefault !== false;

  const assignableTeammates = useMemo(() => {
    const data = brandTeamQuery.data;
    if (!data) return [];
    const byId = new Map<string, { id: string; label: string }>();
    byId.set(data.owner.id, { id: data.owner.id, label: data.owner.label });
    for (const m of data.members) {
      byId.set(m.userId, { id: m.userId, label: m.label });
    }
    return [...byId.values()].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }, [brandTeamQuery.data]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [comment, setComment] = useState("");
  const [labelSearch, setLabelSearch] = useState("");
  const ticketPanelScrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    ticketPanelScrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [open, task?.id]);
  const [detailTab, setDetailTab] = useState<TicketDetailTab>("main");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(taskDescriptionStringToHTML(task.description ?? "") || "");
    setPriority(task.priority);
    setDueDate(task.dueDate ? task.dueDate.slice(0, 16) : "");
  }, [task]);

  useEffect(() => {
    if (task?.id) setDetailTab("main");
  }, [task?.id]);

  const invalidate = () => {
    if (board?.id) {
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
    }
    queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      patchTask(task!.id, {
        title,
        description,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      }),
    onSuccess: invalidate,
  });

  const commentMutation = useMutation({
    mutationFn: () => postComment(task!.id, comment),
    onSuccess: () => {
      setComment("");
      invalidate();
    },
  });

  const trackerStatusMutation = useMutation({
    mutationFn: (next: TrackerStatus) => patchTask(task!.id, { trackerStatus: next }),
    onSuccess: invalidate,
  });

  const toggleBoardLabel = (labelId: string, has: boolean) => {
    if (!task) return;
    const p = has ? removeTaskLabel(task.id, labelId) : addTaskLabel(task.id, labelId);
    p.then(() => {
      invalidate();
      if (brandIdForMyLabels) {
        void queryClient.invalidateQueries({ queryKey: ["label-suggestions", brandIdForMyLabels] });
      }
    });
  };

  const toggleUserLabel = (labelId: string, has: boolean) => {
    if (!task) return;
    const p = has
      ? removeUserTicketLabelFromTask(task.id, labelId)
      : addUserTicketLabelToTask(task.id, labelId);
    p.then(() => {
      invalidate();
      if (brandIdForMyLabels) {
        void queryClient.invalidateQueries({ queryKey: ["label-suggestions", brandIdForMyLabels] });
      }
    });
  };

  const createMyLabelMutation = useMutation({
    mutationFn: (p: { name: string }) =>
      postMyTicketLabel(brandIdForMyLabels!, { name: p.name, color: autoLabelColorFromName(p.name) }),
    onSuccess: async (row) => {
      if (!task || !brandIdForMyLabels) return;
      await queryClient.invalidateQueries({ queryKey: ["my-ticket-labels", brandIdForMyLabels] });
      await queryClient.invalidateQueries({ queryKey: ["label-suggestions", brandIdForMyLabels] });
      await addUserTicketLabelToTask(task.id, row.id);
      setLabelSearch("");
      invalidate();
    },
  });

  const archiveTaskMutation = useMutation({
    mutationFn: (archived: boolean) => patchTask(task!.id, { archived }),
    onSuccess: (_data, archived) => {
      invalidate();
      if (archived) onOpenChange(false);
    },
  });

  const assigneeMutation = useMutation({
    mutationFn: (assigneeUserId: string | null) => patchTask(task!.id, { assigneeUserId }),
    onSuccess: invalidate,
  });

  const moveSubBoardMutation = useMutation({
    mutationFn: (subBoardId: string) => patchTask(task!.id, { subBoardId }),
    onSuccess: invalidate,
  });

  const dirty = useMemo(() => {
    if (!task || boardArchived) return false;
    const taskDue = task.dueDate ? task.dueDate.slice(0, 16) : "";
    return (
      title !== task.title ||
      !taskDescriptionsEqual(description, task.description) ||
      priority !== task.priority ||
      dueDate !== taskDue
    );
  }, [task, boardArchived, title, description, priority, dueDate]);

  useDebouncedAutosave({
    enabled: Boolean(task) && !boardArchived,
    dirty,
    isPending: saveMutation.isPending,
    onFlush: () => saveMutation.mutate(),
    resetKey: [title, description, priority, dueDate],
  });

  useEffect(() => {
    if (dirty) saveMutation.reset();
  }, [dirty, saveMutation]);

  const labelSearchMatches = useMemo(() => {
    if (!task || !board) return [];
    const raw = labelSearch.trim();
    const q = raw.toLowerCase();
    if (!q) return [];
    const fromBoard = board.labels.map((l) => ({
      scope: "board" as const,
      id: l.id,
      name: l.name,
      color: l.color,
      boardId: board.id,
    }));
    const fromUser = (myTicketLabelsQuery.data ?? []).map((l) => ({
      scope: "user" as const,
      id: l.id,
      name: l.name,
      color: l.color,
    }));
    const seen = new Set<string>();
    const merged: ((typeof fromBoard)[number] | (typeof fromUser)[number])[] = [];
    for (const x of [...fromBoard, ...fromUser]) {
      const k = `${x.scope}:${x.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(x);
    }
    return sortByLabelSearchRelevance(merged, raw).filter(
      (m) => searchRankLabelName(raw, m.name) < 9,
    );
  }, [task, board, labelSearch, myTicketLabelsQuery.data]);

  const labelQuickTiles = useMemo(() => {
    const frequent = (labelSuggestQuery.data?.frequent ?? []) as LabelSuggestionChip[];
    const recent = (labelSuggestQuery.data?.recent ?? []) as LabelSuggestionChip[];
    return mergeFrequentRecentLabelChips(frequent, recent, 8, 8);
  }, [labelSuggestQuery.data]);

  if (!task) return null;

  if (!board) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn(rightAppSheetContentClassName, "!gap-0 min-h-0 overflow-hidden")}
          style={sheetWidthStyle}
        >
          <RightAppSheetResizeHandle onMouseDown={startResize} />
          <div
            ref={ticketPanelScrollRef}
            className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain"
          >
            <div className="flex items-center gap-2 p-6 pl-10 pr-10 text-sm text-muted-foreground sm:pl-12 sm:pr-12">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              Loading board context…
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const taskArchived = Boolean(task.archivedAt);
  const sheetLocked = boardArchived;
  const trackerLabel = TRACKER_LABELS[normalizeTrackerStatus(task.trackerStatus)];

  const currentAssigneeId = task.assigneeUserId ?? "";
  const teamListReady = !brandIdForMyLabels || brandTeamQuery.isFetched;
  const assigneeOrphanOption =
    currentAssigneeId &&
    teamListReady &&
    !assignableTeammates.some((x) => x.id === currentAssigneeId)
      ? {
          id: currentAssigneeId,
          label: (task.assignee?.label ?? "").trim() || "Former teammate",
        }
      : null;
  const assigneeSelectDisabled =
    sheetLocked || assigneeMutation.isPending || (Boolean(brandIdForMyLabels) && !teamListReady);

  const creationDateDisplay =
    task.createdAt && !Number.isNaN(new Date(task.createdAt).getTime())
      ? new Date(task.createdAt).toLocaleString()
      : "—";

  const hasLabelOnTask = (scope: "board" | "user", labelId: string) =>
    task.labels.some(
      (x) =>
        x.label.id === labelId &&
        (scope === "user" ? x.labelScope === "user" : x.labelScope !== "user"),
    );

  const currentTracker = normalizeTrackerStatus(task.trackerStatus);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(rightAppSheetContentClassName, "!gap-0 min-h-0 overflow-hidden")}
        style={sheetWidthStyle}
      >
        <RightAppSheetResizeHandle onMouseDown={startResize} />
        <div
          ref={ticketPanelScrollRef}
          className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain"
        >
          <SheetHeader className="border-b shrink-0 p-0 pb-4 pl-10 pr-16 pt-3 sm:pl-12 sm:pr-20">
            <SheetTitle>Ticket</SheetTitle>
            <SheetDescription>
              Use the tabs below to switch between main ticket fields, comments, and ticket settings.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 py-4 pl-10 pr-10 pb-10 sm:gap-6 sm:pl-12 sm:pr-12 sm:pb-12">
          {sheetLocked ? (
            <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
              This board is archived. Restore the board to edit tasks here.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-2 sm:p-2.5">
            {(
              [
                ["main", "Main"],
                ["comments", "Comments"],
                ["settings", "Settings"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDetailTab(id)}
                className={
                  detailTab === id
                    ? "rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                    : "rounded-md px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                }
              >
                {label}
              </button>
            ))}
          </div>

          {detailTab === "main" ? (
          <div className="space-y-4">
            {task.routingSource ? (
              <div className="flex flex-wrap items-center gap-2">
                <RoutingSourceBadge source={task.routingSource} />
              </div>
            ) : null}
            {task.list ? (
              <p className="text-xs text-muted-foreground">
                {task.list.board.name} · {task.list.title} · {trackerLabel}
              </p>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <FieldLabel>Title</FieldLabel>
                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {task.brandTicketNumber != null ? `Ticket #${task.brandTicketNumber}` : "—"}
                </span>
              </div>
              <Input
                value={title}
                disabled={sheetLocked}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <TicketDescriptionEditor
              value={description}
              onChange={setDescription}
              disabled={sheetLocked}
            />

            {task ? (
              <TicketStyleLabelsBlock
                brandId={brandIdForMyLabels}
                board={board}
                attachedLabels={task.labels}
                locked={sheetLocked}
                labelSuggestLoading={labelSuggestQuery.isLoading}
                labelSuggestError={labelSuggestQuery.isError}
                labelSearch={labelSearch}
                onLabelSearchChange={setLabelSearch}
                labelSearchMatches={labelSearchMatches}
                labelQuickTiles={labelQuickTiles}
                hasLabel={hasLabelOnTask}
                toggleBoardLabel={toggleBoardLabel}
                toggleUserLabel={toggleUserLabel}
                onPickSearchMatch={(m, onTask) => {
                  if (onTask) {
                    m.scope === "user" ? toggleUserLabel(m.id, true) : toggleBoardLabel(m.id, true);
                  } else {
                    const p =
                      m.scope === "user"
                        ? addUserTicketLabelToTask(task.id, m.id)
                        : addTaskLabel(task.id, m.id);
                    void p.then(() => {
                      invalidate();
                      if (brandIdForMyLabels) {
                        void queryClient.invalidateQueries({
                          queryKey: ["label-suggestions", brandIdForMyLabels],
                        });
                      }
                    });
                  }
                }}
                createFromSearch={
                  !sheetLocked && brandIdForMyLabels
                    ? (() => {
                        const t = labelSearch.trim();
                        const lq = t.toLowerCase();
                        const anyExact = [...board.labels, ...(myTicketLabelsQuery.data ?? [])].some(
                          (l) => l.name.toLowerCase() === lq,
                        );
                        if (!t || anyExact) return null;
                        return {
                          trimmedName: t,
                          pending: createMyLabelMutation.isPending,
                          error: createMyLabelMutation.isError,
                          onClick: () => createMyLabelMutation.mutate({ name: t }),
                        };
                      })()
                    : null
                }
              />
            ) : null}

            <div className="space-y-1">
              <FieldLabel>Assigned to</FieldLabel>
              {brandIdForMyLabels ? (
                <>
                  {brandTeamQuery.isError ? (
                    <p className="text-xs text-destructive">Could not load teammates for this board.</p>
                  ) : null}
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
                    aria-label="Assigned to"
                    value={currentAssigneeId}
                    disabled={assigneeSelectDisabled}
                    onChange={(e) => {
                      const v = e.target.value;
                      assigneeMutation.mutate(v === "" ? null : v);
                    }}
                  >
                    <option value="">Unassigned</option>
                    {assigneeOrphanOption ? (
                      <option value={assigneeOrphanOption.id}>
                        {assigneeOrphanOption.label} (no longer on team)
                      </option>
                    ) : null}
                    {assignableTeammates.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Only the brand owner and collaborators who accepted an invite or joined with the team key can be
                    assigned.
                  </p>
                  {assigneeMutation.isError ? (
                    <p className="text-xs text-destructive">Could not update assignee.</p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Open this ticket from a project board to choose an assignee.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <FieldLabel>Due date</FieldLabel>
              <Input
                type="datetime-local"
                value={dueDate}
                disabled={sheetLocked}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel>Status (tracker)</FieldLabel>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
                value={currentTracker}
                disabled={sheetLocked || trackerStatusMutation.isPending}
                onChange={(e) => {
                  const next = e.target.value as TrackerStatus;
                  if (TRACKER_STATUSES.includes(next)) trackerStatusMutation.mutate(next);
                }}
              >
                {TRACKER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {TRACKER_LABELS[st]}
                  </option>
                ))}
              </select>
              {task.completed && currentTracker !== "DONE" ? (
                <p className="text-xs text-muted-foreground">
                  Marked complete on the board; still counts as done while in this status column.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <FieldLabel>Priority</FieldLabel>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
                value={priority}
                disabled={sheetLocked}
                onChange={(e) => setPriority(e.target.value)}
              >
                {["none", "low", "medium", "high"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {!sheetLocked ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {saveMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                    Saving…
                  </span>
                ) : null}
                {!saveMutation.isPending && dirty ? <span>Unsaved changes — will save automatically.</span> : null}
                {!dirty && !saveMutation.isPending && saveMutation.isSuccess ? (
                  <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <Check className="size-4 shrink-0" aria-hidden />
                    All changes saved
                  </span>
                ) : null}
                {saveMutation.isError ? (
                  <span className="text-destructive">Could not save. Check your connection.</span>
                ) : null}
              </div>
            ) : null}
          </div>
          ) : null}

          {detailTab === "comments" ? (
            <div className="space-y-4">
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {(task.comments ?? []).map((c) => (
                  <CommentListItem
                    key={c.id}
                    body={c.body}
                    authorLabel={c.author?.label?.trim() || "Unknown"}
                    createdAt={c.createdAt}
                  />
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  placeholder="Write a comment"
                  value={comment}
                  disabled={sheetLocked}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && comment.trim() && commentMutation.mutate()}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => comment.trim() && commentMutation.mutate()}
                  disabled={sheetLocked || commentMutation.isPending}
                >
                  Post
                </Button>
              </div>
            </div>
          ) : null}

          {detailTab === "settings" ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <FieldLabel>Created by</FieldLabel>
                <p className="text-sm text-foreground">{task.createdBy?.label?.trim() || "Unknown"}</p>
              </div>
              <div className="space-y-1">
                <FieldLabel>Creation date</FieldLabel>
                <p className="text-sm text-foreground">{creationDateDisplay}</p>
              </div>
              {boardIdForPrefs ? (
                <div className="space-y-2">
                  <FieldLabel>Complete checkbox on board card</FieldLabel>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
                    value={
                      task.showCompleteCheckbox === true
                        ? "show"
                        : task.showCompleteCheckbox === false
                          ? "hide"
                          : "inherit"
                    }
                    disabled={sheetLocked}
                    onChange={(e) => {
                      const v = e.target.value;
                      patchTask(task.id, {
                        showCompleteCheckbox: v === "inherit" ? null : v === "show",
                      }).then(invalidate);
                    }}
                  >
                    <option value="inherit">
                      Match sub-board ({subBoardDefaultCheckboxOnCard ? "shown" : "hidden"} by default on cards)
                    </option>
                    <option value="show">Always show on board card</option>
                    <option value="hide">Always hide on board card</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Card face layout and the sub-board default for this checkbox are in board view → sub-board options
                    (gear on the sub-board tab).
                  </p>
                </div>
              ) : null}

              {board && board.lists.length > 1 && !sheetLocked ? (
                (() => {
                  const curSub = task.subBoardId ?? task.list?.id;
                  if (!curSub) return null;
                  return (
                    <div className="space-y-2">
                      <FieldLabel>Send to sub-board</FieldLabel>
                      <p className="text-xs text-muted-foreground">
                        Move this ticket to another sub-board on the same project board.
                      </p>
                      <select
                        className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
                        aria-label="Sub-board for this ticket"
                        value={curSub}
                        disabled={moveSubBoardMutation.isPending}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next && next !== curSub) moveSubBoardMutation.mutate(next);
                        }}
                      >
                        {board.lists.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
                          </option>
                        ))}
                      </select>
                      {moveSubBoardMutation.isError ? (
                        <p className="text-xs text-destructive">Could not move ticket. Try again.</p>
                      ) : null}
                    </div>
                  );
                })()
              ) : null}

              {!sheetLocked ? (
                <div className="space-y-2">
                  <FieldLabel>Archive</FieldLabel>
                  {taskArchived ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      disabled={archiveTaskMutation.isPending}
                      onClick={() => archiveTaskMutation.mutate(false)}
                    >
                      <ArchiveRestore className="size-4" />
                      Restore task
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 text-muted-foreground"
                      disabled={archiveTaskMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Archive this ticket? It will leave the board until you restore it from the Ticket Tracker (archived view).",
                          )
                        ) {
                          archiveTaskMutation.mutate(true);
                        }
                      }}
                    >
                      <Archive className="size-4" />
                      Archive task
                    </Button>
                  )}
                </div>
              ) : null}

              <div className="space-y-2">
                <FieldLabel>Activity Tracker</FieldLabel>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {(task.activities ?? []).map((a) => (
                    <li key={a.id}>
                      <span className="font-medium text-foreground">{a.actor?.label ?? "System"}</span>
                      {": "}
                      <span className="font-medium text-foreground">{a.action}</span>
                      {a.detail ? ` — ${a.detail}` : ""}{" "}
                      <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
