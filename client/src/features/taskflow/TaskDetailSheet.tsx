import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Check, Loader2, Pencil } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fetchMe } from "@/features/auth/api";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { useDebouncedAutosave } from "@/hooks/useDebouncedAutosave";
import { RightAppSheetResizeHandle, useResizableRightAppSheetWidth, rightAppSheetContentClassName } from "@/hooks/useResizableRightAppSheetWidth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RoutingSourceBadge } from "@/components/shared/RoutingSourceBadge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  patchTaskComment,
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
import type { BoardDto, ProjectSpaceSummaryDto, TaskFlowTask } from "./types";
import { TRACKER_LABELS, TRACKER_STATUSES, type TrackerStatus, normalizeTrackerStatus } from "./trackerMeta";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-xs font-medium text-muted-foreground">{children}</Label>;
}

type TicketDetailTab = "main" | "comments" | "other";

type TicketMainFieldsDraft = {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
};

function ticketMainFieldsDirty(task: TaskFlowTask, draft: TicketMainFieldsDraft): boolean {
  const taskDue = task.dueDate ? task.dueDate.slice(0, 16) : "";
  return (
    draft.title !== task.title ||
    !taskDescriptionsEqual(draft.description, task.description) ||
    draft.priority !== task.priority ||
    draft.dueDate !== taskDue
  );
}

const COMMENT_BODY_PREVIEW_CHARS = 220;

type TaskCommentRowModel = NonNullable<TaskFlowTask["comments"]>[number];

function TaskCommentRow({
  comment: c,
  canEdit,
  sheetLocked,
  onUpdated,
}: {
  comment: TaskCommentRowModel;
  canEdit: boolean;
  sheetLocked: boolean;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  useEffect(() => {
    setDraft(c.body);
  }, [c.body]);

  const patchMutation = useMutation({
    mutationFn: () => patchTaskComment(c.id, draft),
    onSuccess: () => {
      setEditing(false);
      onUpdated();
    },
  });

  const authorLabel = c.author?.label?.trim() || "Unknown";
  const long = c.body.length > COMMENT_BODY_PREVIEW_CHARS;
  const text = !long || expanded ? c.body : `${c.body.slice(0, COMMENT_BODY_PREVIEW_CHARS)}…`;

  return (
    <li className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm">
      {editing ? (
        <div className="space-y-2">
          <textarea
            className="border-input bg-background focus-visible:ring-ring min-h-[5rem] w-full rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
            value={draft}
            disabled={sheetLocked || patchMutation.isPending}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Edit comment"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={sheetLocked || patchMutation.isPending || !draft.trim()}
              onClick={() => patchMutation.mutate()}
            >
              {patchMutation.isPending ? (
                <>
                  <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={patchMutation.isPending}
              onClick={() => {
                setDraft(c.body);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
          {patchMutation.isError ? (
            <p className="text-xs text-destructive">Could not save comment.</p>
          ) : null}
        </div>
      ) : (
        <>
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
        </>
      )}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{authorLabel}</span>
          {" · "}
          {new Date(c.createdAt).toLocaleString()}
        </p>
        {!editing && canEdit && !sheetLocked ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3" aria-hidden />
            Edit
          </Button>
        ) : null}
      </div>
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
  const { workspaces, activeWorkspace } = useActiveWorkspace();
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    enabled: Boolean(open && task),
  });
  const currentUserId = meQuery.data?.id ?? null;

  const [sendSpaceId, setSendSpaceId] = useState("");
  const [sendBoardId, setSendBoardId] = useState("");
  const [sendSubBoardId, setSendSubBoardId] = useState("");

  const taskWorkspaceId = task?.list?.board.workspaceId ?? board?.workspaceId ?? null;
  const workspaceForTask = useMemo(() => {
    if (!taskWorkspaceId) return activeWorkspace;
    return workspaces.find((w) => w.id === taskWorkspaceId) ?? activeWorkspace;
  }, [taskWorkspaceId, workspaces, activeWorkspace]);

  const projectSpacesForTask = workspaceForTask?.projectSpaces ?? [];

  const resolveSpaceIdForBoard = useCallback(
    (bid: string | null | undefined, spaces: ProjectSpaceSummaryDto[]) => {
      if (!spaces.length) return "";
      if (!bid) return spaces[0]?.id ?? "";
      for (const ps of spaces) {
        if (ps.boards.some((b) => b.id === bid)) return ps.id;
      }
      return spaces[0]?.id ?? "";
    },
    [],
  );

  useEffect(() => {
    if (!task?.id || !open) return;
    const bid = task.list?.board?.id ?? board?.id ?? "";
    const sid = resolveSpaceIdForBoard(bid, projectSpacesForTask);
    const sub = task.subBoardId ?? task.list?.id ?? "";
    setSendSpaceId(sid);
    setSendBoardId(bid);
    setSendSubBoardId(sub);
  }, [
    task?.id,
    task?.list?.board?.id,
    task?.subBoardId,
    task?.list?.id,
    board?.id,
    open,
    projectSpacesForTask,
    resolveSpaceIdForBoard,
  ]);

  const sendTargetBoardQuery = useQuery({
    queryKey: ["board", sendBoardId],
    queryFn: () => fetchBoard(sendBoardId!),
    enabled: Boolean(open && task && sendBoardId && sendBoardId !== board?.id),
  });
  const sendTargetBoard = sendBoardId === board?.id ? board : sendTargetBoardQuery.data;
  const listsForSendPicker = sendTargetBoard?.lists ?? [];

  const boardsInSendSpace = useMemo(() => {
    const ps = projectSpacesForTask.find((s) => s.id === sendSpaceId);
    return ps?.boards ?? [];
  }, [projectSpacesForTask, sendSpaceId]);

  useEffect(() => {
    if (!listsForSendPicker.length) return;
    if (sendSubBoardId && !listsForSendPicker.some((l) => l.id === sendSubBoardId)) {
      setSendSubBoardId("");
    }
  }, [sendBoardId, listsForSendPicker, sendSubBoardId]);

  useEffect(() => {
    const curBoard = task?.list?.board.id ?? board?.id ?? "";
    if (sendBoardId !== curBoard) return;
    const curSub = task?.subBoardId ?? task?.list?.id ?? "";
    if (!curSub || !listsForSendPicker.some((l) => l.id === curSub)) return;
    setSendSubBoardId((prev) => {
      if (prev === curSub) return prev;
      if (prev === "" || !listsForSendPicker.some((l) => l.id === prev)) return curSub;
      return prev;
    });
  }, [
    task?.list?.board.id,
    board?.id,
    sendBoardId,
    task?.subBoardId,
    task?.list?.id,
    listsForSendPicker,
  ]);

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
    mutationFn: (draft: TicketMainFieldsDraft) =>
      patchTask(task!.id, {
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : null,
      }),
    onSuccess: invalidate,
  });

  const flushMainSave = useCallback(
    (draft?: TicketMainFieldsDraft) => {
      if (!task || boardArchived) return;
      const d = draft ?? { title, description, priority, dueDate };
      if (!ticketMainFieldsDirty(task, d)) return;
      saveMutation.mutate(d);
    },
    [task, boardArchived, title, description, priority, dueDate, saveMutation],
  );

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

  const handleSendToDestination = useCallback(async () => {
    if (!task) return;
    const cur = task.subBoardId ?? task.list?.id;
    if (!sendSubBoardId || sendSubBoardId === cur) return;
    const spaceName =
      projectSpacesForTask.find((ps) => ps.id === sendSpaceId)?.name?.trim() || "Project space";
    const boardName =
      boardsInSendSpace.find((b) => b.id === sendBoardId)?.name?.trim() ||
      sendTargetBoard?.name?.trim() ||
      "Project board";
    const subName =
      listsForSendPicker.find((l) => l.id === sendSubBoardId)?.title?.trim() || "Sub-board";
    try {
      await moveSubBoardMutation.mutateAsync(sendSubBoardId);
      const num = task.brandTicketNumber;
      const ticketLead = num != null ? `Ticket #${num}` : "Ticket";
      toast.success(`${ticketLead} sent to ${spaceName}, ${boardName}, ${subName}`);
    } catch {
      toast.error("Could not move ticket. Try again.");
    }
  }, [
    task,
    sendSubBoardId,
    sendSpaceId,
    sendBoardId,
    projectSpacesForTask,
    boardsInSendSpace,
    listsForSendPicker,
    sendTargetBoard,
    moveSubBoardMutation,
  ]);

  const dirty = useMemo(() => {
    if (!task || boardArchived) return false;
    return ticketMainFieldsDirty(task, { title, description, priority, dueDate });
  }, [task, boardArchived, title, description, priority, dueDate]);

  useDebouncedAutosave({
    enabled: Boolean(task) && !boardArchived,
    dirty,
    isPending: saveMutation.isPending,
    onFlush: () => flushMainSave(),
    resetKey: [title, description, priority, dueDate],
  });

  useEffect(() => {
    if (dirty) saveMutation.reset();
  }, [dirty, saveMutation]);

  const handleSaveAndClose = useCallback(async () => {
    if (!task) return;
    if (boardArchived) {
      onOpenChange(false);
      return;
    }
    const d: TicketMainFieldsDraft = { title, description, priority, dueDate };
    if (ticketMainFieldsDirty(task, d)) {
      try {
        await saveMutation.mutateAsync(d);
      } catch {
        return;
      }
    }
    onOpenChange(false);
  }, [task, boardArchived, title, description, priority, dueDate, saveMutation, onOpenChange]);

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

  const sheetFooter = (
    <div className="shrink-0 border-t border-border bg-card/95 px-10 pt-3 pb-5 sm:px-12 sm:pb-6">
      <div className="flex flex-wrap items-center justify-start gap-2">
        {saveMutation.isPending ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            Saving…
          </span>
        ) : null}
        <Button
          type="button"
          variant={boardArchived ? "secondary" : "default"}
          onClick={handleSaveAndClose}
          disabled={saveMutation.isPending}
        >
          {boardArchived ? "Close" : "Save & close"}
        </Button>
      </div>
    </div>
  );

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
            className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain"
          >
            <div className="flex items-center gap-2 p-6 pl-10 pr-10 text-sm text-muted-foreground sm:pl-12 sm:pr-12">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              Loading board context…
            </div>
          </div>
          {sheetFooter}
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
            <SheetTitle>
              {task.brandTicketNumber != null ? `Ticket #${task.brandTicketNumber}` : "Ticket"}
            </SheetTitle>
            {task.list ? (
              <p className="text-xs text-muted-foreground">
                {task.list.board.name} · {task.list.title} · {trackerLabel}
              </p>
            ) : null}
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
                ["other", "Other"],
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

            <div className="space-y-2">
              <FieldLabel>Title</FieldLabel>
              <Input
                value={title}
                disabled={sheetLocked}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  if (!boardArchived) flushMainSave();
                }}
              />
            </div>

            <TicketDescriptionEditor
              value={description}
              onChange={setDescription}
              disabled={sheetLocked}
              onBlur={() => {
                if (!boardArchived) flushMainSave();
              }}
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
                onChange={(e) => {
                  const v = e.target.value;
                  setDueDate(v);
                  if (!boardArchived) {
                    flushMainSave({ title, description, priority, dueDate: v });
                  }
                }}
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
                onChange={(e) => {
                  const v = e.target.value;
                  setPriority(v);
                  if (!boardArchived) {
                    flushMainSave({ title, description, priority: v, dueDate });
                  }
                }}
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
                  <TaskCommentRow
                    key={c.id}
                    comment={c}
                    canEdit={Boolean(c.author?.id && currentUserId && c.author.id === currentUserId)}
                    sheetLocked={sheetLocked}
                    onUpdated={invalidate}
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

          {detailTab === "other" ? (
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
                  <FieldLabel>Checkbox visibility</FieldLabel>
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
                </div>
              ) : null}

              {!sheetLocked &&
              projectSpacesForTask.length > 0 &&
              boardsInSendSpace.length > 0 &&
              sendBoardId ? (
                <Card size="sm" className="shadow-sm">
                  <CardHeader className="border-b border-border/60 pb-3">
                    <CardTitle className="text-sm font-semibold">Send to</CardTitle>
                    <CardDescription>
                      Choose a project space, board, and sub-board, then send to move this ticket.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <FieldLabel>Project space</FieldLabel>
                      <select
                        className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
                        aria-label="Project space"
                        value={sendSpaceId}
                        disabled={moveSubBoardMutation.isPending}
                        onChange={(e) => {
                          const sid = e.target.value;
                          setSendSpaceId(sid);
                          const boards = projectSpacesForTask.find((ps) => ps.id === sid)?.boards ?? [];
                          const nextBid = boards[0]?.id ?? "";
                          setSendBoardId(nextBid);
                          setSendSubBoardId("");
                        }}
                      >
                        {projectSpacesForTask.map((ps) => (
                          <option key={ps.id} value={ps.id}>
                            {ps.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Project board</FieldLabel>
                      <select
                        className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
                        aria-label="Project board"
                        value={sendBoardId}
                        disabled={moveSubBoardMutation.isPending}
                        onChange={(e) => {
                          setSendBoardId(e.target.value);
                          setSendSubBoardId("");
                        }}
                      >
                        {boardsInSendSpace.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Project sub-board</FieldLabel>
                      <select
                        className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
                        aria-label="Project sub-board"
                        value={sendSubBoardId}
                        disabled={
                          moveSubBoardMutation.isPending ||
                          sendTargetBoardQuery.isFetching ||
                          !listsForSendPicker.length
                        }
                        onChange={(e) => {
                          const next = e.target.value;
                          setSendSubBoardId(next);
                        }}
                      >
                        {(() => {
                          const curBoard = task.list?.board.id ?? board?.id ?? "";
                          const needsPlaceholder =
                            sendBoardId !== curBoard &&
                            (!sendSubBoardId ||
                              !listsForSendPicker.some((l) => l.id === sendSubBoardId));
                          if (!listsForSendPicker.length) {
                            return (
                              <option value="">
                                {sendTargetBoardQuery.isFetching ? "Loading…" : "No sub-boards"}
                              </option>
                            );
                          }
                          return (
                            <>
                              {needsPlaceholder ? (
                                <option value="">
                                  {sendTargetBoardQuery.isFetching ? "Loading…" : "Select sub-board"}
                                </option>
                              ) : null}
                              {listsForSendPicker.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.title}
                                </option>
                              ))}
                            </>
                          );
                        })()}
                      </select>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        moveSubBoardMutation.isPending ||
                        sendTargetBoardQuery.isFetching ||
                        !sendSubBoardId ||
                        !listsForSendPicker.length ||
                        sendSubBoardId === (task.subBoardId ?? task.list?.id)
                      }
                      onClick={() => void handleSendToDestination()}
                    >
                      {moveSubBoardMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                          Sending…
                        </>
                      ) : (
                        "Send"
                      )}
                    </Button>
                    {moveSubBoardMutation.isError ? (
                      <p className="text-xs text-destructive sm:text-right">Could not move ticket. Try again.</p>
                    ) : null}
                  </CardFooter>
                </Card>
              ) : null}

              {!sheetLocked ? (
                <div className="space-y-2">
                  <FieldLabel>Archive task</FieldLabel>
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
                <FieldLabel>Archive Tracker</FieldLabel>
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
        {sheetFooter}
      </SheetContent>
    </Sheet>
  );
}
