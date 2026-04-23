import { useMutation } from "@tanstack/react-query";
import { ClipboardList, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { postProjectManagerAgent } from "@/features/agents/api";
import type { BoardDto, TaskFlowTask } from "@/features/taskflow/types";

export function buildBoardContextSnapshot(board: BoardDto): string {
  const lines: string[] = [`Board: ${board.name}`, `Board id: ${board.id}`];
  for (const list of board.lists) {
    lines.push(`\n## ${list.title} (${list.key ?? "list"})`);
    for (const t of list.tasks) {
      const due = t.dueDate ? t.dueDate.slice(0, 10) : "none";
      lines.push(
        `- [${t.completed ? "x" : " "}] ${t.title} | priority: ${t.priority} | due: ${due}`,
      );
    }
  }
  return lines.join("\n").slice(0, 14_000);
}

export function buildTasksContextSnapshot(title: string, tasks: TaskFlowTask[]): string {
  const lines = [
    title,
    ...tasks.map((t) => {
      const due = t.dueDate ? t.dueDate.slice(0, 10) : "none";
      const boardName = t.list?.board?.name ?? "?";
      return `- ${t.title} | ${boardName} | due: ${due} | done: ${t.completed}`;
    }),
  ];
  return lines.join("\n").slice(0, 14_000);
}

export function buildWorkspaceBoardsIndex(contextLabel: string, text: string): string {
  return `${contextLabel}\n\n${text}`.slice(0, 14_000);
}

type PMAgentSheetProps = {
  workspaceId: string | null | undefined;
  contextText: string;
  /** Shown in sheet description */
  surfaceLabel: string;
};

export function PMAgentSheet({ workspaceId, contextText, surfaceLabel }: PMAgentSheetProps) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [output, setOutput] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      postProjectManagerAgent({
        workspaceId: workspaceId!,
        message: goal.trim() || "Help me plan the next steps for this workspace context.",
        contextText,
      }),
    onSuccess: (d) => setOutput(d.result),
  });

  if (!workspaceId) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <ClipboardList className="size-4" aria-hidden />
          PM Agent
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Plan with PM Agent</SheetTitle>
          <SheetDescription>
            {surfaceLabel}. Describe what you want to accomplish; the agent suggests agendas, tasks, and risks. No
            automatic ticket changes in this version.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2">
          <Label htmlFor="pm-goal">Your goal or meeting intent</Label>
          <textarea
            id="pm-goal"
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Sprint planning for the launch board; what should we cut?"
            disabled={mut.isPending}
          />
        </div>
        <Button
          type="button"
          disabled={mut.isPending}
          onClick={() => {
            setOutput("");
            mut.mutate();
          }}
        >
          {mut.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Working…
            </>
          ) : (
            "Run PM Agent"
          )}
        </Button>
        {mut.isError ? (
          <p className="text-sm text-destructive">Request failed. Check API configuration.</p>
        ) : null}
        {output ? (
          <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
            {output}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
