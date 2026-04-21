import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  convertPlanToTasks,
  postBrainstormAI,
  type ConvertPlanTaskDto,
} from "@/features/brainstorm/api";
import {
  BRAINSTORM_LIBRARY_PROMPTS,
  BRAINSTORM_QUICK_ACTIONS,
} from "@/features/brainstorm/promptLibrary";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import { buildCanvasSummary, buildSelectedNodeSummary } from "@/features/brainstorm/utils/canvasContext";

type BrainstormAIPanelProps = {
  sessionId: string | undefined;
};

export function BrainstormAIPanel({ sessionId }: BrainstormAIPanelProps) {
  const thinkingMode = useBrainstormStore((s) => s.thinkingMode);
  const nodes = useBrainstormStore((s) => s.nodes);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const selectedNode = useMemo(() => nodes.find((n) => n.selected), [nodes]);
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
      if (!sessionId || !selectedNode) {
        throw new Error("missing");
      }
      setError(null);
      return convertPlanToTasks(sessionId, selectedNode.id);
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
    onError: () => setError("Could not convert to plan. Select an idea node and ensure AI is configured."),
  });

  const busy = aiMutation.isPending || convertMutation.isPending;

  return (
    <Card className="flex h-full min-h-0 flex-col border bg-card shadow-sm">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-amber-500" aria-hidden />
          AI co-pilot
        </CardTitle>
        <CardDescription>
          Uses the current thinking mode and canvas context. Select a node to focus the assistant.
        </CardDescription>
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
          disabled={busy || !sessionId || !selectedNode}
          onClick={() => convertMutation.mutate()}
          className="gap-2"
        >
          {convertMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Convert to plan (tasks)
        </Button>
        {!selectedNode && (
          <p className="text-xs text-muted-foreground">Select an idea on the canvas to focus AI actions.</p>
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
