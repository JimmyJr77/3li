import { useMutation } from "@tanstack/react-query";
import { ClipboardList, GripVertical, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
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

const SHEET_WIDTH_STORAGE_KEY = "pmAgentSheetWidthPx";
const SHEET_WIDTH_DEFAULT = 640;
const SHEET_WIDTH_MIN = 380;
const SHEET_WIDTH_MAX = 1200;

const textareaClass =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full min-h-[100px] resize-y rounded-lg border bg-transparent px-4 py-3 text-sm leading-relaxed shadow-xs outline-none focus-visible:ring-[3px]";

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
  const [panelWidth, setPanelWidth] = useState(SHEET_WIDTH_DEFAULT);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  const panelWidthPx = useMemo(() => {
    const w = Number.isFinite(panelWidth) && panelWidth > 0 ? panelWidth : SHEET_WIDTH_DEFAULT;
    return Math.min(SHEET_WIDTH_MAX, Math.max(SHEET_WIDTH_MIN, w));
  }, [panelWidth]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHEET_WIDTH_STORAGE_KEY);
      const n = raw ? Number.parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n >= SHEET_WIDTH_MIN && n <= SHEET_WIDTH_MAX) {
        setPanelWidth(n);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const startResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidthRef.current;
    const onMove = (ev: MouseEvent) => {
      const dx = startX - ev.clientX;
      const cap = Math.min(SHEET_WIDTH_MAX, typeof window !== "undefined" ? window.innerWidth - 24 : SHEET_WIDTH_MAX);
      const next = Math.min(cap, Math.max(SHEET_WIDTH_MIN, startW + dx));
      panelWidthRef.current = next;
      setPanelWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      try {
        localStorage.setItem(SHEET_WIDTH_STORAGE_KEY, String(panelWidthRef.current));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

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
      <SheetContent
        side="right"
        className="flex h-full max-w-none flex-col gap-0 overflow-y-auto border-l p-0 shadow-xl !max-w-none"
        style={{
          width: `min(${panelWidthPx}px, calc(100vw - 12px))`,
        }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize panel"
          title="Drag to resize"
          className="absolute top-0 bottom-0 left-0 z-[60] flex w-4 cursor-col-resize touch-none items-center justify-center border-r border-transparent hover:border-border hover:bg-muted/50 active:bg-muted"
          onMouseDown={startResize}
        >
          <GripVertical className="size-4 text-muted-foreground opacity-70" aria-hidden />
        </div>

        <SheetHeader className="gap-2 border-b border-border/60 px-6 pb-5 pl-10 pr-7 pt-6 sm:px-8 sm:pb-6 sm:pl-12 sm:pr-10 sm:pt-7">
          <SheetTitle className="text-lg">PM Agent</SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            Planning and prioritization from your <strong>page context</strong> on this screen — not other workspaces.
            Describe what you want to accomplish; the agent suggests agendas, tasks, and risks. No automatic ticket changes
            in this version.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 px-6 pb-8 pl-10 pr-7 sm:gap-7 sm:px-8 sm:pb-10 sm:pl-12 sm:pr-10">
          <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground">
            <span className="font-medium">Primary dialogue</span>{" "}
            <span className="text-muted-foreground">
              — {surfaceLabel}. The snapshot from this view is sent with your request together with your goal below.
            </span>
          </div>

          <div className="space-y-3">
            <Label htmlFor="pm-goal" className="text-sm">
              Your goal or meeting intent
            </Label>
            <textarea
              id="pm-goal"
              className={textareaClass}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Sprint planning for the launch board; what should we cut?"
              disabled={mut.isPending}
              rows={4}
            />
          </div>

          <Button
            type="button"
            className="w-fit"
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
            <p className="text-sm leading-relaxed text-destructive">Request failed. Check API configuration.</p>
          ) : null}

          {output ? (
            <div className="max-h-[50vh] min-h-[120px] flex-1 overflow-y-auto overscroll-y-contain rounded-xl border border-border bg-muted/20 p-4 text-sm leading-relaxed whitespace-pre-wrap sm:p-5">
              {output}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
