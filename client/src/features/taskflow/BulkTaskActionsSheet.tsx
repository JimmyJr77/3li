import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
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
import {
  autoLabelColorFromName,
  mergeFrequentRecentLabelChips,
  searchRankLabelName,
  sortByLabelSearchRelevance,
  type LabelSuggestionChip,
} from "./labelUiUtils";
import type { BoardDto, ProjectSpaceSummaryDto, TaskFlowTask } from "./types";
import { TRACKER_LABELS, TRACKER_STATUSES, type TrackerStatus } from "./trackerMeta";
import { TicketStyleLabelsBlock, type TicketStyleAttachedLabel, type TicketStyleLabelSearchMatch } from "./TicketStyleLabelsBlock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RightAppSheetResizeHandle, rightAppSheetContentClassName, useResizableRightAppSheetWidth } from "@/hooks/useResizableRightAppSheetWidth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-xs font-medium text-muted-foreground">{children}</Label>;
}

function collectTasks(board: BoardDto, ids: string[]): TaskFlowTask[] {
  const want = new Set(ids);
  const out: TaskFlowTask[] = [];
  for (const list of board.lists) {
    for (const t of list.tasks) {
      if (want.has(t.id)) out.push(t);
    }
  }
  return out;
}

function mergeAttachedLabels(tasks: TaskFlowTask[]): TicketStyleAttachedLabel[] {
  const map = new Map<string, TicketStyleAttachedLabel>();
  for (const t of tasks) {
    for (const row of t.labels) {
      const scope = row.labelScope === "user" ? "user" : "board";
      map.set(`${scope}-${row.label.id}`, { label: row.label, labelScope: scope });
    }
  }
  return [...map.values()];
}

export function BulkTaskActionsSheet({
  board,
  boardArchived,
  open,
  onOpenChange,
  selectedTaskIds,
}: {
  board: BoardDto;
  boardArchived?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTaskIds: string[];
}) {
  const queryClient = useQueryClient();
  const { workspaces, activeWorkspace } = useActiveWorkspace();
  const sheetSizing = useResizableRightAppSheetWidth({ open });

  const selectedTasks = useMemo(() => collectTasks(board, selectedTaskIds), [board, selectedTaskIds]);
  const n = selectedTasks.length;

  const brandId = board.brandId ?? null;
  const boardId = board.id;

  const subBoardPrefsQuery = useQuery({
    queryKey: ["sub-board-prefs", boardId],
    queryFn: () => fetchBoardSubBoardPreferences(boardId),
    enabled: Boolean(open && boardId),
  });
  const myTicketLabelsQuery = useQuery({
    queryKey: ["my-ticket-labels", brandId],
    queryFn: () => fetchMyTicketLabels(brandId!),
    enabled: Boolean(open && brandId),
  });
  const labelSuggestQuery = useQuery({
    queryKey: ["label-suggestions", brandId],
    queryFn: () => fetchLabelSuggestions(brandId!),
    enabled: Boolean(open && brandId),
  });
  const brandTeamQuery = useQuery({
    queryKey: ["brand-team", brandId],
    queryFn: () => fetchBrandTeam(brandId!),
    enabled: Boolean(open && brandId),
  });

  const taskWorkspaceId = board.workspaceId ?? null;
  const workspaceForTask = useMemo(() => {
    if (!taskWorkspaceId) return activeWorkspace;
    return workspaces.find((w) => w.id === taskWorkspaceId) ?? activeWorkspace;
  }, [taskWorkspaceId, workspaces, activeWorkspace]);
  const projectSpacesForTask = workspaceForTask?.projectSpaces ?? [];

  const [sendSpaceId, setSendSpaceId] = useState("");
  const [sendBoardId, setSendBoardId] = useState("");
  const [sendSubBoardId, setSendSubBoardId] = useState("");
  const [labelSearch, setLabelSearch] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [archiveTypeConfirm, setArchiveTypeConfirm] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState<string>("__unchanged__");
  const [trackerStatus, setTrackerStatus] = useState<string>("__unchanged__");
  const [priority, setPriority] = useState<string>("__unchanged__");
  const [showCompleteMode, setShowCompleteMode] = useState<string>("__unchanged__");

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
    if (!open) return;
    const sid = resolveSpaceIdForBoard(boardId, projectSpacesForTask);
    setSendSpaceId(sid);
    setSendBoardId(boardId);
    setSendSubBoardId("");
    setLabelSearch("");
    setCommentBody("");
    setArchiveTypeConfirm("");
    setAssigneeUserId("__unchanged__");
    setTrackerStatus("__unchanged__");
    setPriority("__unchanged__");
    setShowCompleteMode("__unchanged__");
  }, [open, boardId, projectSpacesForTask, resolveSpaceIdForBoard]);

  const sendTargetBoardQuery = useQuery({
    queryKey: ["board", sendBoardId],
    queryFn: () => fetchBoard(sendBoardId!),
    enabled: Boolean(open && sendBoardId && sendBoardId !== boardId),
  });
  const sendTargetBoard = sendBoardId === boardId ? board : sendTargetBoardQuery.data;
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

  const mergedAttached = useMemo(() => mergeAttachedLabels(selectedTasks), [selectedTasks]);

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

  const labelQuickTiles = useMemo((): LabelSuggestionChip[] => {
    const frequent = (labelSuggestQuery.data?.frequent ?? []) as LabelSuggestionChip[];
    const recent = (labelSuggestQuery.data?.recent ?? []) as LabelSuggestionChip[];
    return mergeFrequentRecentLabelChips(frequent, recent, 8, 8);
  }, [labelSuggestQuery.data]);

  const labelSearchMatches = useMemo((): TicketStyleLabelSearchMatch[] => {
    const raw = labelSearch.trim();
    const q = raw.toLowerCase();
    if (!q) return [];
    const fromBoard = board.labels.map((l) => ({
      scope: "board" as const,
      id: l.id,
      name: l.name,
      color: l.color,
    }));
    const fromUser = (myTicketLabelsQuery.data ?? []).map((l) => ({
      scope: "user" as const,
      id: l.id,
      name: l.name,
      color: l.color,
    }));
    const seen = new Set<string>();
    const merged: TicketStyleLabelSearchMatch[] = [];
    for (const x of [...fromBoard, ...fromUser]) {
      const k = `${x.scope}:${x.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(x);
    }
    return sortByLabelSearchRelevance(merged, raw).filter((m) => searchRankLabelName(raw, m.name) < 9);
  }, [labelSearch, board.labels, myTicketLabelsQuery.data]);

  const hasLabelEvery = useCallback(
    (scope: "board" | "user", labelId: string) =>
      selectedTasks.length > 0 &&
      selectedTasks.every((t) =>
        t.labels.some(
          (r) =>
            r.label.id === labelId && (scope === "user" ? r.labelScope === "user" : r.labelScope !== "user"),
        ),
      ),
    [selectedTasks],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
  }, [queryClient, boardId]);

  const runSequential = async (label: string, fn: (t: TaskFlowTask) => Promise<unknown>) => {
    let ok = 0;
    let fail = 0;
    for (const t of selectedTasks) {
      try {
        await fn(t);
        ok++;
      } catch {
        fail++;
      }
    }
    invalidate();
    if (fail === 0) toast.success(`${label}: updated ${ok} ticket${ok === 1 ? "" : "s"}.`);
    else toast.message(`${label}: ${ok} ok, ${fail} failed.`);
  };

  const bulkToggleBoardLabel = async (labelId: string, remove: boolean) => {
    if (boardArchived || !selectedTasks.length) return;
    await runSequential(remove ? "Remove board label" : "Add board label", async (t) => {
      const has = t.labels.some((r) => r.label.id === labelId && r.labelScope !== "user");
      if (remove && has) await removeTaskLabel(t.id, labelId);
      if (!remove && !has) await addTaskLabel(t.id, labelId);
    });
    if (brandId) void queryClient.invalidateQueries({ queryKey: ["label-suggestions", brandId] });
  };

  const bulkToggleUserLabel = async (labelId: string, remove: boolean) => {
    if (boardArchived || !selectedTasks.length || !brandId) return;
    await runSequential(remove ? "Remove your label" : "Add your label", async (t) => {
      const has = t.labels.some((r) => r.label.id === labelId && r.labelScope === "user");
      if (remove && has) await removeUserTicketLabelFromTask(t.id, labelId);
      if (!remove && !has) await addUserTicketLabelToTask(t.id, labelId);
    });
    void queryClient.invalidateQueries({ queryKey: ["label-suggestions", brandId] });
  };

  const createMyLabelMutation = useMutation({
    mutationFn: (name: string) => postMyTicketLabel(brandId!, { name, color: autoLabelColorFromName(name) }),
    onSuccess: async (row) => {
      if (!brandId || !selectedTasks.length) return;
      for (const t of selectedTasks) {
        const has = t.labels.some((r) => r.label.id === row.id && r.labelScope === "user");
        if (!has) await addUserTicketLabelToTask(t.id, row.id);
      }
      setLabelSearch("");
      await queryClient.invalidateQueries({ queryKey: ["my-ticket-labels", brandId] });
      await queryClient.invalidateQueries({ queryKey: ["label-suggestions", brandId] });
      invalidate();
      toast.success(`Created label and attached to ${selectedTasks.length} ticket(s).`);
    },
  });

  const applyAssignee = async () => {
    if (boardArchived || assigneeUserId === "__unchanged__" || !brandId) return;
    const v = assigneeUserId === "" ? null : assigneeUserId;
    await runSequential("Assignee", (t) => patchTask(t.id, { assigneeUserId: v }));
  };

  const applyTracker = async () => {
    if (boardArchived || trackerStatus === "__unchanged__") return;
    if (!TRACKER_STATUSES.includes(trackerStatus as TrackerStatus)) return;
    await runSequential("Tracker status", (t) => patchTask(t.id, { trackerStatus }));
  };

  const applyPriority = async () => {
    if (boardArchived || priority === "__unchanged__") return;
    await runSequential("Priority", (t) => patchTask(t.id, { priority }));
  };

  const applyCheckboxVisibility = async () => {
    if (boardArchived || showCompleteMode === "__unchanged__") return;
    const showCompleteCheckbox =
      showCompleteMode === "inherit" ? null : showCompleteMode === "show";
    await runSequential("Checkbox visibility", (t) => patchTask(t.id, { showCompleteCheckbox }));
  };

  const applyComments = async () => {
    if (boardArchived || !commentBody.trim()) return;
    const body = commentBody.trim();
    await runSequential("Comments", (t) => postComment(t.id, body));
    setCommentBody("");
  };

  const applySendTo = async () => {
    if (boardArchived || !sendSubBoardId) return;
    await runSequential("Send to", (t) => patchTask(t.id, { subBoardId: sendSubBoardId }));
  };

  const applyArchiveAll = async () => {
    if (boardArchived || archiveTypeConfirm !== "ARCHIVE") return;
    await runSequential("Archive", (t) => patchTask(t.id, { archived: true }));
    setArchiveTypeConfirm("");
    onOpenChange(false);
  };

  const firstSubPref = subBoardPrefsQuery.data?.[0];
  const subBoardDefaultCheckbox =
    firstSubPref?.completeCheckboxVisibleByDefault !== false;

  const locked = boardArchived || n === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(rightAppSheetContentClassName, "gap-0 overflow-y-auto")}
        style={sheetSizing.sheetWidthStyle}
      >
        <RightAppSheetResizeHandle onMouseDown={sheetSizing.startResize} />
        <SheetHeader className="border-b px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-amber-500" aria-hidden />
            <SheetTitle>Bulk actions</SheetTitle>
          </div>
          <SheetDescription>
            {n === 0
              ? "No tickets selected."
              : `Apply changes to ${n} selected ticket${n === 1 ? "" : "s"}. Each section applies independently when you click its action button.`}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
          {brandId ? (
            <div className="space-y-2">
              <FieldLabel>Labels</FieldLabel>
              <TicketStyleLabelsBlock
                brandId={brandId}
                board={board}
                attachedLabels={mergedAttached}
                locked={locked}
                labelSuggestLoading={labelSuggestQuery.isLoading}
                labelSuggestError={labelSuggestQuery.isError}
                labelSearch={labelSearch}
                onLabelSearchChange={setLabelSearch}
                labelSearchMatches={labelSearchMatches}
                labelQuickTiles={labelQuickTiles}
                hasLabel={(scope, id) => hasLabelEvery(scope, id)}
                toggleBoardLabel={(id, has) => void bulkToggleBoardLabel(id, has)}
                toggleUserLabel={(id, has) => void bulkToggleUserLabel(id, has)}
                onPickSearchMatch={(m, onTask) => {
                  if (onTask) {
                    void (m.scope === "user" ? bulkToggleUserLabel(m.id, true) : bulkToggleBoardLabel(m.id, true));
                  } else {
                    void (async () => {
                      for (const t of selectedTasks) {
                        const has =
                          m.scope === "user"
                            ? t.labels.some((r) => r.label.id === m.id && r.labelScope === "user")
                            : t.labels.some((r) => r.label.id === m.id && r.labelScope !== "user");
                        if (has) continue;
                        if (m.scope === "user") await addUserTicketLabelToTask(t.id, m.id);
                        else await addTaskLabel(t.id, m.id);
                      }
                      invalidate();
                      if (brandId) void queryClient.invalidateQueries({ queryKey: ["label-suggestions", brandId] });
                    })();
                  }
                }}
                createFromSearch={
                  !locked && brandId
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
                          onClick: () => createMyLabelMutation.mutate(t),
                        };
                      })()
                    : null
                }
              />
              <p className="text-xs text-muted-foreground">
                Chips show the union of labels on the selection. Removing a label removes it from every selected ticket
                that has it; adding applies to any ticket missing it.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <FieldLabel>Assigned to</FieldLabel>
            {brandId ? (
              <>
                <select
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
                  aria-label="Assignee"
                  value={assigneeUserId}
                  disabled={locked || brandTeamQuery.isLoading}
                  onChange={(e) => setAssigneeUserId(e.target.value)}
                >
                  <option value="__unchanged__">— No change —</option>
                  <option value="">Unassigned</option>
                  {assignableTeammates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" disabled={locked || assigneeUserId === "__unchanged__"} onClick={() => void applyAssignee()}>
                  Apply assignee
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No brand context for assignee.</p>
            )}
          </div>

          <div className="space-y-2">
            <FieldLabel>Tracker status</FieldLabel>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
              value={trackerStatus}
              disabled={locked}
              onChange={(e) => setTrackerStatus(e.target.value)}
            >
              <option value="__unchanged__">— No change —</option>
              {TRACKER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {TRACKER_LABELS[st]}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" disabled={locked || trackerStatus === "__unchanged__"} onClick={() => void applyTracker()}>
              Apply status
            </Button>
          </div>

          <div className="space-y-2">
            <FieldLabel>Priority</FieldLabel>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
              value={priority}
              disabled={locked}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="__unchanged__">— No change —</option>
              {["none", "low", "medium", "high"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" disabled={locked || priority === "__unchanged__"} onClick={() => void applyPriority()}>
              Apply priority
            </Button>
          </div>

          <div className="space-y-2">
            <FieldLabel>Comment (posted on each ticket)</FieldLabel>
            <textarea
              className="border-input bg-background focus-visible:ring-ring min-h-[5rem] w-full rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
              value={commentBody}
              disabled={locked}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Comment text…"
            />
            <Button type="button" size="sm" disabled={locked || !commentBody.trim()} onClick={() => void applyComments()}>
              Post comment on all
            </Button>
          </div>

          <div className="space-y-2">
            <FieldLabel>Done checkbox on card</FieldLabel>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
              value={showCompleteMode}
              disabled={locked}
              onChange={(e) => setShowCompleteMode(e.target.value)}
            >
              <option value="__unchanged__">— No change —</option>
              <option value="inherit">
                Match sub-board default (example: {subBoardDefaultCheckbox ? "shown" : "hidden"})
              </option>
              <option value="show">Always show on card</option>
              <option value="hide">Always hide on card</option>
            </select>
            <Button
              type="button"
              size="sm"
              disabled={locked || showCompleteMode === "__unchanged__"}
              onClick={() => void applyCheckboxVisibility()}
            >
              Apply checkbox rule
            </Button>
          </div>

          {!locked && projectSpacesForTask.length > 0 ? (
            <Card className="shadow-sm">
              <CardHeader className="border-b border-border/60 pb-3">
                <CardTitle className="text-sm font-semibold">Send to</CardTitle>
                <CardDescription>Move every selected ticket to the same sub-board.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-3">
                <div className="space-y-1">
                  <FieldLabel>Project space</FieldLabel>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={sendSpaceId}
                    onChange={(e) => {
                      const sid = e.target.value;
                      setSendSpaceId(sid);
                      const boards = projectSpacesForTask.find((ps) => ps.id === sid)?.boards ?? [];
                      setSendBoardId(boards[0]?.id ?? "");
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
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={sendBoardId}
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
                  <FieldLabel>Sub-board</FieldLabel>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={sendSubBoardId}
                    disabled={sendTargetBoardQuery.isFetching && sendBoardId !== boardId}
                    onChange={(e) => setSendSubBoardId(e.target.value)}
                  >
                    <option value="">Select sub-board…</option>
                    {listsForSendPicker.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="button" size="sm" disabled={!sendSubBoardId} onClick={() => void applySendTo()}>
                  Send all to sub-board
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <FieldLabel>Archive all</FieldLabel>
            <p className="text-xs text-muted-foreground">
              Type <span className="font-mono font-semibold">ARCHIVE</span> to confirm archiving every selected ticket.
            </p>
            <Input
              value={archiveTypeConfirm}
              disabled={locked}
              onChange={(e) => setArchiveTypeConfirm(e.target.value)}
              placeholder="ARCHIVE"
              className="font-mono"
            />
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={locked || archiveTypeConfirm !== "ARCHIVE"}
              onClick={() => void applyArchiveAll()}
            >
              Archive all selected
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
