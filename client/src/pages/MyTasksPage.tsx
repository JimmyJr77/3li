import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, ListTodo, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PMAgentSheet, buildTasksContextSnapshot } from "@/features/agents/PMAgentSheet";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { fetchAllTasks, fetchBoard, patchTask } from "@/features/taskflow/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MyTasksPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [labelId, setLabelId] = useState("");
  const [completed, setCompleted] = useState<"all" | "true" | "false">("all");
  const [priority, setPriority] = useState("all");
  const [sort, setSort] = useState("dueDate:asc");
  const [archivedOnly, setArchivedOnly] = useState(false);

  const { activeWorkspace, activeWorkspaceId, isLoading: wsLoading } = useActiveWorkspace();
  const defaultBoardId = activeWorkspace?.projectSpaces?.[0]?.boards?.[0]?.id ?? null;

  const boardQuery = useQuery({
    queryKey: ["board", defaultBoardId],
    queryFn: () => fetchBoard(defaultBoardId!),
    enabled: Boolean(defaultBoardId),
  });
  const boardLabels = boardQuery.data?.labels ?? [];
  const workspaceId = activeWorkspaceId;

  const params = useMemo(
    () => ({
      workspaceId: workspaceId!,
      q: q.trim() || undefined,
      labelId: labelId || undefined,
      completed: completed === "all" ? undefined : completed,
      priority: priority === "all" ? undefined : priority,
      sort,
      ...(archivedOnly ? { archived: "true" as const } : {}),
    }),
    [workspaceId, q, labelId, completed, priority, sort, archivedOnly],
  );

  const tasksQuery = useQuery({
    queryKey: ["tasks", "flat", params],
    queryFn: () => fetchAllTasks(params),
    enabled: Boolean(workspaceId) && !wsLoading,
  });

  const tasks = tasksQuery.data ?? [];
  const loading = wsLoading || (Boolean(workspaceId) && tasksQuery.isLoading);

  const tasksPmContext = useMemo(
    () => buildTasksContextSnapshot("Filtered task list (My tasks)", tasks),
    [tasks],
  );

  const restoreTaskMutation = useMutation({
    mutationFn: (taskId: string) => patchTask(taskId, { archived: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">My tasks</h1>
        </div>
        {workspaceId ? (
          <PMAgentSheet
            workspaceId={workspaceId}
            contextText={tasksPmContext}
            surfaceLabel="Current filtered task list"
          />
        ) : null}
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Filter and sort tasks in the active brand workspace. Open the{" "}
        <Link
          to={defaultBoardId ? `/app/boards/${defaultBoardId}` : "/app/boards"}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Board
        </Link>{" "}
        for drag-and-drop, or the{" "}
        <Link to="/app/calendar" className="font-medium text-primary underline-offset-4 hover:underline">
          Calendar
        </Link>{" "}
        for due dates.
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
          <Label className="text-xs text-muted-foreground">Status</Label>
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
            {["none", "low", "medium", "high", "urgent"].map((p) => (
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
            setCompleted("all");
            setPriority("all");
            setSort("dueDate:asc");
            setArchivedOnly(false);
          }}
        >
          Reset
        </Button>
        <label className="flex w-full cursor-pointer items-center gap-2 text-sm lg:ml-2 lg:w-auto">
          <input
            type="checkbox"
            checked={archivedOnly}
            className="size-4 rounded border"
            onChange={(e) => setArchivedOnly(e.target.checked)}
          />
          <span className="text-muted-foreground">Archived tasks only</span>
        </label>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      )}
      {tasksQuery.isError && (
        <p className="text-sm text-destructive">Could not load tasks. Is the API running?</p>
      )}

      <ul className="divide-y rounded-lg border bg-card">
        {tasks.length === 0 && !loading && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            No tasks match. Add cards on a board or convert ideas from{" "}
            <Link to="/app/brainstorm" className="font-medium text-primary underline-offset-4 hover:underline">
              Brainstorm
            </Link>
            .
          </li>
        )}
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
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
                <span className="capitalize">Prio: {task.priority}</span>
                {task.dueDate && (
                  <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                )}
                {task.ideaNode && <span>Idea: {task.ideaNode.title}</span>}
              </div>
            </div>
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
    </div>
  );
}
