import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Check, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedAutosave } from "@/hooks/useDebouncedAutosave";
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
import { Separator } from "@/components/ui/separator";
import {
  addTaskLabel,
  addUserTicketLabelToTask,
  fetchBoard,
  fetchBoardSubBoardPreferences,
  fetchMyTicketLabels,
  patchChecklistItem,
  patchTask,
  postChecklistItem,
  postComment,
  postMyTicketLabel,
  removeTaskLabel,
  removeUserTicketLabelFromTask,
} from "./api";
import type { BoardDto, TaskFlowTask } from "./types";
import { TRACKER_LABELS, normalizeTrackerStatus } from "./trackerMeta";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-xs font-medium text-muted-foreground">{children}</Label>;
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
  const subBoardIdForPrefs = task?.subBoardId ?? task?.list?.id ?? null;
  const prefRowForTask = useMemo(
    () => subBoardPrefsQuery.data?.find((r) => r.subBoardId === subBoardIdForPrefs),
    [subBoardPrefsQuery.data, subBoardIdForPrefs],
  );
  const subBoardDefaultCheckboxOnCard = prefRowForTask?.completeCheckboxVisibleByDefault !== false;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [comment, setComment] = useState("");
  const [checkItem, setCheckItem] = useState("");
  const [newCustomLabelName, setNewCustomLabelName] = useState("");
  const [newCustomLabelColor, setNewCustomLabelColor] = useState("#6366f1");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setDueDate(task.dueDate ? task.dueDate.slice(0, 16) : "");
  }, [task]);

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

  const checklistMutation = useMutation({
    mutationFn: () => postChecklistItem(task!.id, checkItem),
    onSuccess: () => {
      setCheckItem("");
      invalidate();
    },
  });

  const toggleBoardLabel = (labelId: string, has: boolean) => {
    if (!task) return;
    const p = has ? removeTaskLabel(task.id, labelId) : addTaskLabel(task.id, labelId);
    p.then(invalidate);
  };

  const toggleUserLabel = (labelId: string, has: boolean) => {
    if (!task) return;
    const p = has
      ? removeUserTicketLabelFromTask(task.id, labelId)
      : addUserTicketLabelToTask(task.id, labelId);
    p.then(invalidate);
  };

  const createMyLabelMutation = useMutation({
    mutationFn: (p: { name: string; color: string }) => postMyTicketLabel(brandIdForMyLabels!, p),
    onSuccess: async (row) => {
      if (!task || !brandIdForMyLabels) return;
      await queryClient.invalidateQueries({ queryKey: ["my-ticket-labels", brandIdForMyLabels] });
      await addUserTicketLabelToTask(task.id, row.id);
      setNewCustomLabelName("");
      setNewCustomLabelColor("#6366f1");
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

  const dirty = useMemo(() => {
    if (!task || boardArchived) return false;
    const taskDue = task.dueDate ? task.dueDate.slice(0, 16) : "";
    return (
      title !== task.title ||
      description !== (task.description ?? "") ||
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

  if (!task) return null;

  if (!board) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
            Loading board context…
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const taskArchived = Boolean(task.archivedAt);
  const sheetLocked = boardArchived;
  const trackerLabel = TRACKER_LABELS[normalizeTrackerStatus(task.trackerStatus)];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>Ticket</SheetTitle>
          <SheetDescription>
            Details, checklist, comments, and Activity Tracker entries for this ticket.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {sheetLocked ? (
            <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
              This board is archived. Restore the board to edit tasks here.
            </p>
          ) : null}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={task.completed}
              disabled={sheetLocked}
              className="size-4 rounded border"
              onChange={(e) =>
                patchTask(task.id, { completed: e.target.checked }).then(invalidate)
              }
            />
            <span>Mark complete</span>
          </label>
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
                  Match sub-board ({subBoardDefaultCheckboxOnCard ? "shown" : "hidden"} by default on
                  cards)
                </option>
                <option value="show">Always show on board card</option>
                <option value="hide">Always hide on board card</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Card face layout and the sub-board default for this checkbox are in board view →
                sub-board options (gear on the sub-board tab).
              </p>
            </div>
          ) : null}
          <div className="space-y-2">
            <FieldLabel>Title</FieldLabel>
            <Input
              value={title}
              disabled={sheetLocked}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>Description</FieldLabel>
            <textarea
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
              value={description}
              disabled={sheetLocked}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2">
              <FieldLabel>Due</FieldLabel>
              <Input
                type="datetime-local"
                value={dueDate}
                disabled={sheetLocked}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <FieldLabel>Board labels</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {board.labels.map((lb) => {
                  const has = task.labels.some((x) => x.label.id === lb.id && x.labelScope !== "user");
                  return (
                    <Button
                      key={lb.id}
                      type="button"
                      size="sm"
                      variant={has ? "default" : "outline"}
                      className="h-8 rounded-md"
                      style={has ? { backgroundColor: lb.color, borderColor: lb.color } : undefined}
                      disabled={sheetLocked}
                      onClick={() => toggleBoardLabel(lb.id, has)}
                    >
                      {lb.name}
                    </Button>
                  );
                })}
              </div>
            </div>
            {brandIdForMyLabels ? (
              <>
                <div className="space-y-2">
                  <FieldLabel>Your labels (this brand)</FieldLabel>
                  <p className="text-xs text-muted-foreground">
                    Shared across all project boards in this brand. Manage in Settings → Ticket labels.
                  </p>
                  {myTicketLabelsQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">Loading your labels…</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(myTicketLabelsQuery.data ?? []).map((lb) => {
                        const has = task.labels.some((x) => x.label.id === lb.id && x.labelScope === "user");
                        return (
                          <Button
                            key={lb.id}
                            type="button"
                            size="sm"
                            variant={has ? "default" : "outline"}
                            className="h-8 rounded-md"
                            style={has ? { backgroundColor: lb.color, borderColor: lb.color } : undefined}
                            disabled={sheetLocked}
                            onClick={() => toggleUserLabel(lb.id, has)}
                          >
                            {lb.name}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="space-y-2 rounded-md border border-border/70 bg-muted/15 p-3">
                  <FieldLabel>New custom label</FieldLabel>
                  <p className="text-xs text-muted-foreground">
                    Creates the label for this brand and attaches it to this ticket.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      placeholder="Name"
                      value={newCustomLabelName}
                      disabled={sheetLocked || createMyLabelMutation.isPending}
                      onChange={(e) => setNewCustomLabelName(e.target.value)}
                      className="sm:max-w-xs"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="New label color"
                        value={newCustomLabelColor}
                        disabled={sheetLocked || createMyLabelMutation.isPending}
                        onChange={(e) => setNewCustomLabelColor(e.target.value)}
                        className="size-9 cursor-pointer rounded border border-input bg-background p-0.5"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          sheetLocked || createMyLabelMutation.isPending || !newCustomLabelName.trim()
                        }
                        onClick={() =>
                          createMyLabelMutation.mutate({
                            name: newCustomLabelName.trim(),
                            color: newCustomLabelColor,
                          })
                        }
                      >
                        {createMyLabelMutation.isPending ? "Creating…" : "Create & attach"}
                      </Button>
                    </div>
                  </div>
                  {createMyLabelMutation.isError ? (
                    <p className="text-xs text-destructive">Could not create (duplicate name?).</p>
                  ) : null}
                </div>
              </>
            ) : null}
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

          {!sheetLocked ? (
            <>
              <Separator />
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
            </>
          ) : null}

          <Separator />

          <div className="space-y-2">
            <FieldLabel>Checklist</FieldLabel>
            <ul className="space-y-2">
              {(task.checklist ?? []).map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border"
                    checked={item.completed}
                    disabled={sheetLocked}
                    onChange={(e) =>
                      patchChecklistItem(item.id, { completed: e.target.checked }).then(invalidate)
                    }
                  />
                  <span className={item.completed ? "text-muted-foreground line-through" : ""}>
                    {item.title}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                placeholder="Add checklist item"
                value={checkItem}
                disabled={sheetLocked}
                onChange={(e) => setCheckItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkItem.trim() && checklistMutation.mutate()}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => checkItem.trim() && checklistMutation.mutate()}
                disabled={sheetLocked || checklistMutation.isPending}
              >
                Add
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <FieldLabel>Comments</FieldLabel>
            <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
              {(task.comments ?? []).map((c) => (
                <li key={c.id} className="rounded-md bg-muted/40 px-3 py-2">
                  {c.body}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </li>
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

          <Separator />

          <div className="space-y-2">
            <FieldLabel>Activity Tracker</FieldLabel>
            <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {(task.activities ?? []).map((a) => (
                <li key={a.id}>
                  <span className="font-medium text-foreground">{a.actor?.label ?? "System"}</span>
                  {": "}
                  <span className="font-medium text-foreground">{a.action}</span>
                  {a.detail ? ` — ${a.detail}` : ""}{" "}
                  <span className="text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
