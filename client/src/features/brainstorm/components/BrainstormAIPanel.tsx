import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ClassValue } from "clsx";
import { GripHorizontal, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BRAINSTORM_SESSION_BLUEPRINTS,
  buildFacilitatorPrompt,
  type BrainstormSessionBlueprint,
} from "@/features/brainstorm/brainstormSessionBlueprints";
import {
  BRAINSTORM_SESSION_SYNTHESIS_PROMPTS,
  BRAINSTORM_THOUGHT_ACTIONS,
  buildThoughtWorkPrompt,
} from "@/features/brainstorm/promptLibrary";
import { convertPlanToTasks, postBrainstormAI, type ConvertPlanTaskDto } from "@/features/brainstorm/api";
import { useBrainstormStore, type ThinkingMode } from "@/features/brainstorm/stores/brainstormStore";
import { isIdeaNode } from "@/features/brainstorm/types";
import { applyStudioCanvasProposals } from "@/features/brainstorm/utils/applyStudioCanvasProposals";
import { buildCanvasSummary, buildSelectedNodeSummary } from "@/features/brainstorm/utils/canvasContext";
import {
  parseStudioCanvasProposal,
  type StudioCanvasProposalItem,
} from "@/features/brainstorm/utils/parseStudioCanvasProposal";

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

const textareaClass =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full min-h-[88px] resize-y rounded-lg border bg-transparent px-3 py-2.5 text-sm leading-relaxed shadow-xs outline-none focus-visible:ring-[3px]";

type RedBrainstormVars = {
  prompt: string;
  context: {
    canvasSummary: string;
    sessionPanelLog?: string;
    selectedNodeSummary?: string;
  };
  logUserEntry?: { heading: string; text: string };
};

type ConsultantBrainstormVars = {
  prompt: string;
  label: string;
  context: { canvasSummary: string; sessionPanelLog: string };
};

type BrainstormAIPanelProps = {
  sessionId: string | undefined;
  workspaceId: string;
  embeddedInSheet?: boolean;
  suppressIntro?: boolean;
  className?: ClassValue;
};

type BrainstormAgentTab = "thought" | "guided" | "next";

const tabBtnClass =
  "relative shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-4 sm:text-sm";

const tabBtnActiveClass =
  "border-primary text-foreground";

const OUTPUT_PANE_HEIGHT_STORAGE_KEY = "brainstormAgentOutputPaneHeightPx";
const OUTPUT_PANE_DEFAULT = 220;
const OUTPUT_PANE_MIN = 120;
const OUTPUT_PANE_MAX = 560;

function readStoredOutputPaneHeight(): number {
  try {
    const raw = localStorage.getItem(OUTPUT_PANE_HEIGHT_STORAGE_KEY);
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= OUTPUT_PANE_MIN && n <= OUTPUT_PANE_MAX) {
      return n;
    }
  } catch {
    /* ignore */
  }
  return OUTPUT_PANE_DEFAULT;
}

export function BrainstormAIPanel({
  sessionId,
  workspaceId,
  embeddedInSheet = false,
  suppressIntro = false,
  className,
}: BrainstormAIPanelProps) {
  const thinkingMode = useBrainstormStore((s) => s.thinkingMode);
  const setThinkingMode = useBrainstormStore((s) => s.setThinkingMode);
  const nodes = useBrainstormStore((s) => s.nodes);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionLog, setSessionLog] = useState("");
  const [thoughtInput, setThoughtInput] = useState("");
  const [userGoal, setUserGoal] = useState("");
  const [blueprint, setBlueprint] = useState<BrainstormSessionBlueprint | null>(
    BRAINSTORM_SESSION_BLUEPRINTS[0] ?? null,
  );
  const [freeformMessage, setFreeformMessage] = useState("");
  const [pendingProposals, setPendingProposals] = useState<StudioCanvasProposalItem[] | null>(null);
  const [agentTab, setAgentTab] = useState<BrainstormAgentTab>("thought");
  const [outputPaneHeight, setOutputPaneHeight] = useState(readStoredOutputPaneHeight);
  const outputPaneHeightRef = useRef(outputPaneHeight);
  const layoutRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    outputPaneHeightRef.current = outputPaneHeight;
  }, [outputPaneHeight]);

  const outputPaneHeightDisplay = useMemo(() => {
    const winCap = typeof window !== "undefined" ? window.innerHeight * 0.65 : OUTPUT_PANE_MAX;
    const cap = Math.min(OUTPUT_PANE_MAX, winCap);
    return Math.min(cap, Math.max(OUTPUT_PANE_MIN, outputPaneHeight));
  }, [outputPaneHeight]);

  const clampOutputHeightDuringDrag = useCallback((h: number) => {
    const el = layoutRef.current;
    const layoutH = el?.clientHeight ?? 0;
    const maxFromLayout =
      layoutH > 120 ? Math.max(OUTPUT_PANE_MIN, layoutH - 140) : OUTPUT_PANE_MAX;
    const winCap = typeof window !== "undefined" ? window.innerHeight * 0.65 : OUTPUT_PANE_MAX;
    const cap = Math.min(OUTPUT_PANE_MAX, maxFromLayout, winCap);
    return Math.min(cap, Math.max(OUTPUT_PANE_MIN, h));
  }, []);

  const startOutputPaneResize = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = outputPaneHeightRef.current;
      const onMove = (ev: MouseEvent) => {
        const dy = ev.clientY - startY;
        const raw = startH + dy;
        const next = clampOutputHeightDuringDrag(raw);
        outputPaneHeightRef.current = next;
        setOutputPaneHeight(next);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        try {
          localStorage.setItem(OUTPUT_PANE_HEIGHT_STORAGE_KEY, String(outputPaneHeightRef.current));
        } catch {
          /* ignore */
        }
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [clampOutputHeightDuringDrag],
  );

  const selectedNode = useMemo(() => nodes.find((n) => n.selected), [nodes]);
  const selectedIdea = useMemo(
    () => (selectedNode && isIdeaNode(selectedNode) ? selectedNode : undefined),
    [selectedNode],
  );
  const canvasSummary = useMemo(() => buildCanvasSummary(nodes), [nodes]);
  const selectedSummary = useMemo(
    () => buildSelectedNodeSummary(selectedNode, nodes),
    [selectedNode, nodes],
  );

  const appendSessionExchange = useCallback((heading: string, body: string) => {
    const chunk = body.trim().slice(0, 7000);
    if (!chunk) return;
    setSessionLog((prev) => {
      const next = `${prev.trim()}\n\n### ${heading}\n${chunk}`.trim();
      return next.length > 24_000 ? next.slice(-24_000) : next;
    });
  }, []);

  const consumeModelReply = useCallback((raw: string) => {
    const { visibleText, proposals } = parseStudioCanvasProposal(raw);
    setOutput(visibleText);
    setPendingProposals(proposals.length > 0 ? proposals : null);
    return visibleText;
  }, []);

  const redMutation = useMutation({
    mutationFn: async (vars: RedBrainstormVars) => {
      setError(null);
      setPendingProposals(null);
      return postBrainstormAI({
        prompt: vars.prompt,
        mode: thinkingMode,
        workspaceId,
        agentRole: "red_team",
        context: vars.context,
      });
    },
    onSuccess: (data, vars) => {
      const visible = consumeModelReply(data.result);
      if (vars.logUserEntry) {
        appendSessionExchange(vars.logUserEntry.heading, vars.logUserEntry.text);
      }
      appendSessionExchange("Red team", visible);
    },
    onError: () => setError("AI request failed. Check API key and try again."),
  });

  const consultantMutation = useMutation({
    mutationFn: async (vars: ConsultantBrainstormVars) => {
      setError(null);
      setPendingProposals(null);
      return postBrainstormAI({
        prompt: vars.prompt,
        mode: thinkingMode,
        workspaceId,
        agentRole: "consultant",
        sessionSynthesis: true,
        context: vars.context,
      });
    },
    onSuccess: (data, vars) => {
      const visible = consumeModelReply(data.result);
      appendSessionExchange(`User — consultant (${vars.label})`, vars.prompt.slice(0, 2000));
      appendSessionExchange("Consultant (business case)", visible);
    },
    onError: () => setError("Consultant synthesis failed. Check API key and try again."),
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
      setPendingProposals(null);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: () =>
      setError("Could not convert to plan. Select an idea card (not a shape or text block) and ensure AI is configured."),
  });

  const busy = redMutation.isPending || consultantMutation.isPending || convertMutation.isPending;

  const onSelectBlueprint = (bp: BrainstormSessionBlueprint) => {
    setBlueprint(bp);
    setThinkingMode(bp.thinkingMode);
  };

  const runGuidedSession = () => {
    if (!blueprint) return;
    const prompt = buildFacilitatorPrompt(userGoal, blueprint);
    redMutation.mutate({
      prompt,
      context: {
        canvasSummary,
        ...(sessionLog.trim() ? { sessionPanelLog: sessionLog } : {}),
        ...(selectedSummary ? { selectedNodeSummary: selectedSummary } : {}),
      },
      logUserEntry: {
        heading: `Guided session — ${blueprint.label}`,
        text: userGoal.trim() || "(No goal text — agent may ask a clarifying question.)",
      },
    });
  };

  const runThoughtAction = (label: string, instruction: string) => {
    const t = thoughtInput.trim();
    if (!t) return;
    redMutation.mutate({
      prompt: buildThoughtWorkPrompt(t, instruction),
      context: { canvasSummary },
      logUserEntry: { heading: `Thought — ${label}`, text: t },
    });
  };

  const runFreeform = () => {
    const t = freeformMessage.trim();
    if (!t) return;
    const wrapped = `${t}

If proposing concrete idea or text nodes for the board, use the STUDIO_CANVAS_JSON block described in your instructions.`;
    redMutation.mutate({
      prompt: wrapped,
      context: {
        canvasSummary,
        ...(sessionLog.trim() ? { sessionPanelLog: sessionLog } : {}),
        ...(selectedSummary ? { selectedNodeSummary: selectedSummary } : {}),
      },
      logUserEntry: { heading: "Message to red team", text: t },
    });
    setFreeformMessage("");
  };

  const runSessionSynthesis = (label: string, prompt: string) => {
    consultantMutation.mutate({
      prompt,
      label,
      context: {
        canvasSummary,
        sessionPanelLog: sessionLog.trim() || "(Panel session log is empty — rely on the canvas snapshot.)",
      },
    });
  };

  const applyPendingToBoard = () => {
    if (!pendingProposals?.length) return;
    const n = applyStudioCanvasProposals(pendingProposals);
    setPendingProposals(null);
    setOutput((prev) =>
      prev.trim()
        ? `${prev}\n\n— Added ${n} item(s) from the agent’s last suggestion below existing canvas content.`
        : `Added ${n} item(s) to the board.`,
    );
  };

  const thoughtReady = thoughtInput.trim().length > 0;

  return (
    <Card
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden border bg-card shadow-sm",
        embeddedInSheet && "border-0 bg-transparent shadow-none",
        className,
      )}
    >
      <CardHeader className="shrink-0 pb-2">
        {!suppressIntro ? (
          <>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-amber-500" aria-hidden />
              Brainstorm agents
            </CardTitle>
            <CardDescription>
              Use the tabs: <strong>Brainstorm a thought</strong> for one-line red-team passes,{" "}
              <strong>Guided studio session</strong> for structured workshops, and <strong>Next steps</strong> for
              consultant synthesis, MVP-style summaries, and converting idea cards to tasks.
            </CardDescription>
          </>
        ) : null}
        <div className={cn("mt-3 space-y-2", suppressIntro && "mt-0")}>
          <p className="text-xs font-medium text-muted-foreground">Thinking mode (red team pacing)</p>
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
      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden px-0 pb-0 pt-2 sm:pt-3">
        <div ref={layoutRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          role="tablist"
          aria-label="Brainstorm agent sections"
          className="flex shrink-0 flex-wrap gap-0 border-b border-border px-2 sm:px-4"
        >
          {(
            [
              { id: "thought" as const, label: "Brainstorm a thought" },
              { id: "guided" as const, label: "Guided studio session" },
              { id: "next" as const, label: "Next steps" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={agentTab === id}
              id={`brainstorm-tab-${id}`}
              aria-controls={`brainstorm-panel-${id}`}
              className={cn(tabBtnClass, agentTab === id && tabBtnActiveClass)}
              onClick={() => setAgentTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
          {agentTab === "thought" ? (
            <div
              role="tabpanel"
              id="brainstorm-panel-thought"
              aria-labelledby="brainstorm-tab-thought"
              className="flex flex-col gap-3"
            >
              <div className="rounded-lg border border-border/80 bg-muted/15 p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Red team</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter one thought. Buttons run prompts on that text only. The board snapshot is optional background — a
                  selected canvas node is not required.
                </p>
                <label htmlFor="brainstorm-thought-input" className="mt-3 block text-sm font-medium text-foreground">
                  Your thought
                </label>
                <textarea
                  id="brainstorm-thought-input"
                  className={cn(textareaClass, "mt-1.5 min-h-[80px]")}
                  value={thoughtInput}
                  onChange={(e) => setThoughtInput(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. We should sunset the legacy SKU and move everyone to the new bundle…"
                  rows={3}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {BRAINSTORM_THOUGHT_ACTIONS.map((a) => (
                    <Button
                      key={a.label}
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy || !thoughtReady}
                      className="text-xs"
                      onClick={() => runThoughtAction(a.label, a.prompt)}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {agentTab === "guided" ? (
            <div
              role="tabpanel"
              id="brainstorm-panel-guided"
              aria-labelledby="brainstorm-tab-guided"
              className="flex flex-col gap-4"
            >
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guided studio session</p>
                <label htmlFor="brainstorm-user-goal" className="mt-2 block text-sm font-medium text-foreground">
                  What do you want to achieve?
                </label>
                <textarea
                  id="brainstorm-user-goal"
                  className={cn(textareaClass, "mt-1.5")}
                  value={userGoal}
                  onChange={(e) => setUserGoal(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. Decide whether to expand into a new region before Q3."
                  rows={2}
                />
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session shape</p>
                <div className="mt-2 grid max-h-[min(220px,36vh)] gap-2 overflow-y-auto sm:grid-cols-2">
                  {BRAINSTORM_SESSION_BLUEPRINTS.map((bp) => {
                    const selected = blueprint?.id === bp.id;
                    return (
                      <button
                        key={bp.id}
                        type="button"
                        disabled={busy}
                        onClick={() => onSelectBlueprint(bp)}
                        className={cn(
                          "rounded-lg border px-3 py-2.5 text-left text-xs leading-snug transition-colors sm:text-[13px]",
                          selected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-background hover:bg-muted/50",
                        )}
                      >
                        <span className="font-medium">{bp.label}</span>
                        <span className="mt-1 block text-muted-foreground">{bp.summary}</span>
                      </button>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  className="mt-3 w-full gap-2 sm:w-auto"
                  disabled={busy || !blueprint}
                  onClick={runGuidedSession}
                >
                  {redMutation.isPending ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
                  Start this session
                </Button>
              </div>

              <div className="rounded-lg border border-dashed border-border/80 p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Free message to red team</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Uses the canvas snapshot, optional selected node, and this panel&apos;s log for context.
                </p>
                <textarea
                  id="brainstorm-freeform"
                  className={cn(textareaClass, "mt-2 min-h-[72px]")}
                  value={freeformMessage}
                  onChange={(e) => setFreeformMessage(e.target.value)}
                  disabled={busy}
                  placeholder="Anything else for the red team…"
                  rows={2}
                />
                <Button type="button" size="sm" className="mt-2" disabled={busy || !freeformMessage.trim()} onClick={runFreeform}>
                  Send
                </Button>
              </div>

              {!selectedNode ? (
                <p className="text-xs text-muted-foreground">
                  Optional: select a canvas node to attach extra context for guided sessions and free messages.
                </p>
              ) : null}
            </div>
          ) : null}

          {agentTab === "next" ? (
            <div
              role="tabpanel"
              id="brainstorm-panel-next"
              aria-labelledby="brainstorm-tab-next"
              className="flex flex-col gap-4"
            >
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consultant synthesis</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Compress the <strong>whole board</strong> and <strong>panel log</strong> into business-case outputs (exec
                  summary, MVP framing, 30/90-day moves, etc.). Does not use the thought box as the primary input.
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Panel log:{" "}
                  {sessionLog.trim() ? `${sessionLog.length} characters` : "empty (canvas-only synthesis)"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {BRAINSTORM_SESSION_SYNTHESIS_PROMPTS.map((a) => (
                    <Button
                      key={a.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      className="border-primary/30 bg-background text-xs hover:bg-primary/10"
                      onClick={() => runSessionSynthesis(a.label, a.prompt)}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-muted/20 p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Create tasks</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Turn a single <strong>idea card</strong> on the board into backlog tasks (after you are ready from the
                  synthesis above).
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 gap-2"
                  disabled={busy || !sessionId || !selectedIdea}
                  onClick={() => convertMutation.mutate()}
                >
                  {convertMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Convert to plan (tasks)
                </Button>
                {selectedNode && !selectedIdea ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Select an <strong>idea</strong> card on the canvas — convert is not available for shapes or text
                    blocks.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Drag to resize output area"
          title="Drag to resize — output vs inputs"
          className="group relative z-10 flex h-7 shrink-0 cursor-row-resize touch-none items-center justify-center border-y border-border/60 bg-muted/30 hover:bg-muted/60"
          onMouseDown={startOutputPaneResize}
        >
          <div className="pointer-events-none flex items-center gap-1.5 text-muted-foreground">
            <GripHorizontal className="size-4 opacity-70 group-hover:opacity-100" aria-hidden />
            <span className="hidden text-[10px] font-medium uppercase tracking-wide sm:inline">Resize</span>
          </div>
        </div>

        <div
          className="flex min-h-0 shrink-0 flex-col overflow-hidden bg-card/95"
          style={{ height: outputPaneHeightDisplay }}
        >
          <div className="shrink-0 space-y-2 px-3 pt-2 sm:px-4">
            {error && <p className="text-xs text-destructive">{error}</p>}
            {pendingProposals && pendingProposals.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="text-foreground">
                  The red team suggested <strong>{pendingProposals.length}</strong> board item(s) (idea cards or text
                  blocks).
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={applyPendingToBoard}>
                    Add to board
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPendingProposals(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Latest output</p>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-3 pb-3 sm:px-4 sm:pb-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap">
              {busy && !output ? (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Thinking…
                </span>
              ) : (
                output || (
                  <span className="text-muted-foreground">
                    Responses from the red team and consultant appear here across all tabs.
                  </span>
                )
              )}
            </div>
          </div>
        </div>
        </div>
      </CardContent>
    </Card>
  );
}
