import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore } from "lucide-react";
import { useEffect, useState } from "react";
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
  patchChecklistItem,
  patchTask,
  postChecklistItem,
  postComment,
  removeTaskLabel,
} from "./api";
import type { BoardDto, TaskFlowTask } from "./types";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-xs font-medium text-muted-foreground">{children}</Label>;
}

export function TaskDetailSheet({
  board,
  boardArchived = false,
  task,
  open,
  onOpenChange,
}: {
  board: BoardDto;
  /** When the parent board is archived, editing actions that hit the API are limited. */
  boardArchived?: boolean;
  task: TaskFlowTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [comment, setComment] = useState("");
  const [checkItem, setCheckItem] = useState("");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setDueDate(task.dueDate ? task.dueDate.slice(0, 16) : "");
  }, [task]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["board", board.id] });
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

  const toggleLabel = (labelId: string, has: boolean) => {
    if (!task) return;
    const p = has ? removeTaskLabel(task.id, labelId) : addTaskLabel(task.id, labelId);
    p.then(invalidate);
  };

  const archiveTaskMutation = useMutation({
    mutationFn: (archived: boolean) => patchTask(task!.id, { archived }),
    onSuccess: (_data, archived) => {
      invalidate();
      if (archived) onOpenChange(false);
    },
  });

  if (!task) return null;

  const taskArchived = Boolean(task.archivedAt);
  const sheetLocked = boardArchived;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>Task</SheetTitle>
          <SheetDescription>Details, checklist, comments, and Activity Tracker entries.</SheetDescription>
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
                {["none", "low", "medium", "high", "urgent"].map((p) => (
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

          <div className="space-y-2">
            <FieldLabel>Labels</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {board.labels.map((lb) => {
                const has = task.labels.some((x) => x.label.id === lb.id);
                return (
                  <Button
                    key={lb.id}
                    type="button"
                    size="sm"
                    variant={has ? "default" : "outline"}
                    className="h-8 rounded-full"
                    style={has ? { backgroundColor: lb.color, borderColor: lb.color } : undefined}
                    disabled={sheetLocked}
                    onClick={() => toggleLabel(lb.id, has)}
                  >
                    {lb.name}
                  </Button>
                );
              })}
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            className="w-fit"
            onClick={() => saveMutation.mutate()}
            disabled={sheetLocked || saveMutation.isPending}
          >
            Save changes
          </Button>

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
                          "Archive this task? It will leave the board and lists until you restore it from My tasks (archived view).",
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
