import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  convertPlanToTasks,
  postBrainstormAI,
  type ConvertPlanTaskDto,
} from "@/features/brainstorm/api";
import {
  BRAINSTORM_LIBRARY_PROMPTS,
  BRAINSTORM_QUICK_ACTIONS,
} from "@/features/brainstorm/promptLibrary";
import { useBrainstormStore, type ThinkingMode } from "@/features/brainstorm/stores/brainstormStore";
import { isIdeaNode } from "@/features/brainstorm/types";
import { buildCanvasSummary, buildSelectedNodeSummary } from "@/features/brainstorm/utils/canvasContext";

const thinkingModes: { id: ThinkingMode; label: string }[] = [
  { id: "divergent", label: "Divergent" },
  { id: "convergent", label: "Convergent" },
  { id: "strategic", label: "Strategic" },
  { id: "execution", label: "Execution" },
];

const modeAccent: Record<ThinkingMode, string> = {
  divergent:
    "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300 vibrant:border-violet-500/65 vibrant:bg-violet-500/16 vibrant:text-violet-800 rainbow-explosion:border-violet-500/85 rainbow-explosion:bg-violet-500/26 rainbow-explosion:text-violet-900",
  convergent:
    "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 vibrant:border-emerald-500/60 vibrant:bg-emerald-500/14 vibrant:text-emerald-900 rainbow-explosion:border-emerald-500/85 rainbow-explosion:bg-emerald-500/24 rainbow-explosion:text-emerald-950",
  strategic:
    "border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300 vibrant:border-sky-500/60 vibrant:bg-sky-500/14 vibrant:text-sky-900 rainbow-explosion:border-sky-500/85 rainbow-explosion:bg-sky-500/24 rainbow-explosion:text-sky-950",
  execution:
    "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 vibrant:border-amber-500/60 vibrant:bg-amber-500/14 vibrant:text-amber-950 rainbow-explosion:border-amber-500/85 rainbow-explosion:bg-amber-500/24 rainbow-explosion:text-amber-950",
};

type BrainstormAIPanelProps = {
  sessionId: string | undefined;
  workspaceId: string;
};

export function BrainstormAIPanel({ sessionId, workspaceId }: BrainstormAIPanelProps) {
  const thinkingMode = useBrainstormStore((s) => s.thinkingMode);
  const setThinkingMode = useBrainstormStore((s) => s.setThinkingMode);
  const nodes = useBrainstormStore((s) => s.nodes);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [agentRole, setAgentRole] = useState<"consultant" | "red_team">("consultant");
  const queryClient = useQueryClient();

  const selectedNode = useMemo(() => nodes.find((n) => n.selected), [nodes]);
  const selectedIdea = useMemo(
    () => (selectedNode && isIdeaNode(selectedNode) ? selectedNode : undefined),
    [selectedNode],
  );
  const canvasSummary = useMemo(() => buildCanvasSummary(nodes), [nodes]);
  const selectedSummary = useMemo(
    () => buildSelectedNodeSummary(selectedNode),
    [selectedNode],
  );

  const aiMutation = useMutation({
    mutationFn: async (prompt: string) => {
      setError(null);
      return postBrainstormAI({
        prompt,
        mode: thinkingMode,
        workspaceId,
        agentRole,
        context: {
          canvasSummary,
          selectedNodeSummary: selectedSummary,
        },
      });
    },
    onSuccess: (data) => setOutput(data.result),
    onError: () => setError("AI request failed. Check API key and try again."),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId || !selectedIdea) {
        throw new Error("missing");
      }
      setError(null);
      return convertPlanToTasks(sessionId, selectedIdea.id, workspaceId);
    },
    onSuccess: (data: { tasks: ConvertPlanTaskDto[] }) => {
      setOutput(
        `Created ${data.tasks.length} task(s) on the backlog. Open Tasks or Board to manage them.`,
      );
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: () =>
      setError("Could not convert to plan. Select an idea card (not a shape or text block) and ensure AI is configured."),
  });

  const busy = aiMutation.isPending || convertMutation.isPending;

  return (
    <Card className="flex h-full min-h-0 flex-col border bg-card shadow-sm">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-amber-500" aria-hidden />
          AI Consultant &amp; Red Team
        </CardTitle>
        <CardDescription>
          Choose a thinking mode, then toggle AI Consultant (structure) vs Red Team (challenge). Uses canvas context,
          team/user agent context, and your Brand Center kit. Select a node to focus the assistant.
        </CardDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={agentRole === "consultant" ? "default" : "outline"}
            className="text-xs"
            onClick={() => setAgentRole("consultant")}
          >
            AI Consultant
          </Button>
          <Button
            type="button"
            size="sm"
            variant={agentRole === "red_team" ? "default" : "outline"}
            className="text-xs"
            onClick={() => setAgentRole("red_team")}
          >
            Red Team Agent
          </Button>
        </div>
        <div className="mt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Mode</p>
          <div className="flex flex-wrap gap-2">
            {thinkingModes.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setThinkingMode(id)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  thinkingMode === id
                    ? modeAccent[id]
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Quick actions</p>
          <div className="flex flex-wrap gap-2">
            {BRAINSTORM_QUICK_ACTIONS.map((a) => (
              <Button
                key={a.label}
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                className="text-xs"
                onClick={() => aiMutation.mutate(a.prompt)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Prompt library</p>
          <div className="flex flex-wrap gap-2">
            {BRAINSTORM_LIBRARY_PROMPTS.map((a) => (
              <Button
                key={a.label}
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="text-xs"
                onClick={() => aiMutation.mutate(a.prompt)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={busy || !sessionId || !selectedIdea}
          onClick={() => convertMutation.mutate()}
          className="gap-2"
        >
          {convertMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Convert to plan (tasks)
        </Button>
        {!selectedNode && (
          <p className="text-xs text-muted-foreground">Select a node on the canvas to focus AI actions.</p>
        )}
        {selectedNode && !selectedIdea && (
          <p className="text-xs text-muted-foreground">
            Convert to plan only works on <strong>idea</strong> cards. Select an idea card to create tasks.
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="min-h-[200px] flex-1 overflow-auto rounded-md border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap">
          {busy && !output ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Thinking…
            </span>
          ) : (
            output || <span className="text-muted-foreground">AI output appears here.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
