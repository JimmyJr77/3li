import { useMutation, useQuery } from "@tanstack/react-query";
import { Link2, Loader2, ShieldAlert, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { postBrainstormAI, type ThinkingModeApi } from "@/features/brainstorm/api";
import { fetchNotesBootstrap } from "@/features/notes/api";
import { NoteAIActions } from "@/features/notes/NoteAIActions";
import type { AtlasNoteDto } from "@/features/notes/types";
import { cn } from "@/lib/utils";

/** Matches Red Team / AI Consultant prompt fields for a consistent agent surface. */
const AGENT_PROMPT_TEXTAREA_CLASS =
  "min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * API `mode` passed only for Red Team requests. Thought framing buttons apply to the AI Consultant only;
 * Red Team uses this fixed system prompt layer so challenge behavior is not tied to consultant framing.
 */
const RED_TEAM_BRAINSTORM_MODE: ThinkingModeApi = "strategic";

/** Consultant modes for capture-only AI tools (Rapid Router); aligned with summarize / rewrite / linking tone. */
const CAPTURE_AI_MODE: Record<"summarize" | "rewrite" | "linking", ThinkingModeApi> = {
  summarize: "convergent",
  rewrite: "execution",
  linking: "strategic",
};

/** Labels for thought framing (AI Consultant tab only). */
export const THINKING_FRAMING_MODES: { value: ThinkingModeApi; label: string }[] = [
  { value: "divergent", label: "Divergent" },
  { value: "convergent", label: "Convergent" },
  { value: "strategic", label: "Strategic" },
  { value: "execution", label: "Execution" },
];

const CONSULTANT_MODE_TEXTAREA_PRESETS: Record<ThinkingModeApi, string> = {
  divergent: `Thought framing: Divergent

What this does: The consultant maximizes variety, quantity, and creative angles. It should encourage exploration, avoid shutting ideas down, and offer many options and “what if” angles grounded in your capture.

What you are asking the consultant to do (edit freely):
Review the capture below in divergent style—surface many options, tangents, and creative angles before any narrowing.

Your additional context or constraints (optional):
`,
  convergent: `Thought framing: Convergent

What this does: The consultant narrows down, prioritizes, and finds the best path—comparing tradeoffs, eliminating weak options, and stating clear recommendations tied to your capture.

What you are asking the consultant to do (edit freely):
Review the capture below in convergent style—compare options, cut weak paths, and recommend what to do next.

Your additional context or constraints (optional):
`,
  strategic: `Thought framing: Strategic

What this does: The consultant connects ideas to goals, stakeholders, risks, and sequencing—framing outcomes, constraints, and a coherent plan of attack from your capture.

What you are asking the consultant to do (edit freely):
Review the capture below in strategic style—tie it to goals, stakeholders, risks, and a sensible sequence.

Your additional context or constraints (optional):
`,
  execution: `Thought framing: Execution

What this does: The consultant turns ideas into concrete next steps, owners, and order—favoring checklists, timelines, and actionable tasks over abstract discussion.

What you are asking the consultant to do (edit freely):
Review the capture below in execution style—turn it into ordered, actionable next steps (and owners where possible).

Your additional context or constraints (optional):
`,
};

/**
 * Quick picks only fill the operator textarea (what the exercise is + optional notes).
 * Run Red Team sends capture + this text to the model.
 */
const RED_TEAM_EXERCISE_PRESETS: { label: string; textareaPreset: string }[] = [
  {
    label: "Pre-mortem",
    textareaPreset: `Exercise: Pre-mortem

What this does: Assume the work described in the capture failed about six months from now. The Red Team works backward from that failure to expose risks, blind spots, and weak links.

Instruction you are asking the model to run (edit freely):
Pre-mortem: assume this failed in six months—what went wrong?

Your additional notes or constraints for this run (optional):
`,
  },
  {
    label: "Contrary views",
    textareaPreset: `Exercise: Contrary views

What this does: Surfaces alternative framings and opposing angles so you are not anchored on a single narrative.

Instruction you are asking the model to run (edit freely):
Give three contrary framings of the same idea.

Your additional notes or constraints for this run (optional):
`,
  },
  {
    label: "Weakest assumption",
    textareaPreset: `Exercise: Weakest assumption

What this does: Makes explicit what must be true for the capture to work, then stresses the weakest link.

Instruction you are asking the model to run (edit freely):
What must be true for this to work? Flag the weakest assumption.

Your additional notes or constraints for this run (optional):
`,
  },
];

/**
 * Brand-oriented consultant presets — same interaction as Red Team exercise buttons:
 * fill the operator textarea only; Run AI Consultant sends capture + text; brand kit is injected server-side when workspaceId is set.
 */
const CONSULTANT_BRAND_EXERCISE_PRESETS: { label: string; textareaPreset: string }[] = [
  {
    label: "Voice fit",
    textareaPreset: `Exercise: Voice fit

What this does: Assesses the capture (copy, claims, tone) against the active brand kit and Brand Center voice and positioning. Surfaces phrasing risks and suggests on-brand alternatives the team can adopt.

Brand context: The assistant receives your workspace brand profile with this request—use it as authoritative for voice and positioning.

What you are asking the consultant to do (edit freely):
Review the capture for voice and positioning fit against our brand kit. Call out mismatches, risky claims, and concrete rewrite suggestions that stay on-brand.

Your additional context or constraints (optional):
`,
  },
  {
    label: "Message clarity",
    textareaPreset: `Exercise: Message clarity

What this does: Distills the core message, intended audience, proof, and call-to-action. Flags confusion, jargon, or over-claiming relative to brand standards so the narrative is clear and defensible.

Brand context: The assistant receives your workspace brand profile with this request—use it to judge clarity and credibility against how we present the brand.

What you are asking the consultant to do (edit freely):
Break down the capture’s core message, audience, proof, and CTA. Note what is unclear or overstated and suggest a tighter, clearer version aligned with our brand standards.

Your additional context or constraints (optional):
`,
  },
  {
    label: "Goal alignment",
    textareaPreset: `Exercise: Goal alignment

What this does: Maps the capture to mission, values, and stated business goals from the brand kit. Names gaps, tradeoffs, and sequencing so the work strengthens strategic alignment.

Brand context: The assistant receives your workspace brand profile with this request—explicitly tie recommendations to mission, values, and goals documented there.

What you are asking the consultant to do (edit freely):
Connect this capture to our stated mission, values, and business goals. Identify misalignment, missing links, and the next 2–3 moves to strengthen alignment.

Your additional context or constraints (optional):
`,
  },
];

type AgentTab = "ai_tools" | "red_team" | "consultant";

type RedTeamPanelProps = {
  workspaceId: string;
  /** Legacy: full context string (e.g. note body). Used when \`captureMaterial\` is not passed. */
  contextHint?: string;
  /**
   * Main Rapid Router capture text only. When passed, the user message sent to the API uses this
   * as "Captured material" and the textarea as "Operator request", so agents focus on the capture box.
   */
  captureMaterial?: string;
  className?: string;
  /**
   * When set, notebook AI tools (summarize, rewrite, linking) appear on the **AI Tools** tab.
   * Red Team / AI Consultant tabs are hidden when `offline` is true (browser-only notes); only AI tools show.
   */
  noteAi?: {
    note: AtlasNoteDto;
    onUpdated: () => void;
    offline?: boolean;
  };
};

function buildAgentUserMessage(
  operatorRequest: string,
  contextHint: string,
  captureMaterial: string | undefined,
): string | null {
  const op = operatorRequest.trim();
  const cap =
    captureMaterial !== undefined
      ? captureMaterial.trim().slice(0, 7500)
      : contextHint.trim().slice(0, 7500);

  if (captureMaterial !== undefined) {
    if (!cap) return null;
    if (!op) return null;
    return `Captured material:\n${cap}\n\n---\n\nOperator request (exercise + your notes):\n${op}`;
  }

  if (!cap && !op) return null;
  if (!cap) return op;
  if (!op) return `Capture context:\n${cap}`;
  return `Capture context:\n${cap}\n\n---\n\n${op}`;
}

function withCaptureAiExtraContext(base: string, extraContext: string): string {
  const t = extraContext.trim();
  if (!t) return base;
  return `${base}\n\n---\n\nAdditional instructions / context from the author:\n${t.slice(0, 4000)}`;
}

/**
 * Rapid Router: summarize / rewrite / linking-style suggestions on the capture field only (no note id).
 * Uses the same Brainstorm consultant endpoint as the AI Consultant tab.
 */
function CaptureAITools({
  workspaceId,
  captureText,
  extraContext,
}: {
  workspaceId: string;
  captureText: string;
  extraContext: string;
}) {
  const { data: bootstrap } = useQuery({
    queryKey: ["notes-app", "bootstrap", workspaceId],
    queryFn: () => fetchNotesBootstrap(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const captureMut = useMutation({
    mutationFn: async (kind: "summarize" | "rewrite" | "linking") => {
      setError(null);
      const cap = captureText.trim().slice(0, 7500);
      if (!cap) {
        throw new Error("Add text to Capture first.");
      }
      const neighborLines = (bootstrap?.notes ?? [])
        .slice(0, 50)
        .map((n) => {
          const prev = (n.previewText ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
          return `- ${n.title}${prev ? ` — ${prev}` : ""} (id: ${n.id})`;
        })
        .join("\n");

      let userBlock: string;
      if (kind === "summarize") {
        userBlock = withCaptureAiExtraContext(
          `Summarize this capture in 2-5 sentences for quick scanning.\n\nCaptured material:\n${cap}`,
          extraContext,
        );
      } else if (kind === "rewrite") {
        userBlock = withCaptureAiExtraContext(
          `Rewrite the following capture for clarity and scannability. Keep the author's meaning. Output plain text only; use blank lines between paragraphs.\n\nCaptured material:\n${cap}`,
          extraContext,
        );
      } else {
        userBlock = withCaptureAiExtraContext(
          [
            `You are helping with notebook linking ideas for a Rapid Router capture (not yet saved as a note).`,
            `Capture:\n${cap}`,
            neighborLines
              ? `Existing notes in this workspace (for connection ideas only):\n${neighborLines}`
              : "Existing notes in this workspace: (none listed yet)",
            `Output plain text with short sections: Connections, Implications, Suggested next links (name possible notes or themes to create or link later). Be concise.`,
          ].join("\n\n"),
          extraContext,
        );
      }

      return postBrainstormAI({
        prompt: userBlock,
        mode: CAPTURE_AI_MODE[kind],
        workspaceId,
        agentRole: "consultant",
      });
    },
    onSuccess: (data) => setOutput(data.result ?? ""),
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "AI tools request failed. Check API configuration."),
  });

  const busy = captureMut.isPending;
  const capEmpty = !captureText.trim();

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Runs on the Capture field only (read-only). After routing to a note, use Notebooks for summarize / rewrite / apply
        to the note body.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5"
          disabled={busy || capEmpty}
          onClick={() => captureMut.mutate("summarize")}
        >
          {busy && captureMut.variables === "summarize" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Summarize
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5"
          disabled={busy || capEmpty}
          onClick={() => captureMut.mutate("rewrite")}
        >
          {busy && captureMut.variables === "rewrite" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Wand2 className="size-3.5" />
          )}
          Rewrite
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5"
          disabled={busy || capEmpty}
          onClick={() => captureMut.mutate("linking")}
        >
          {busy && captureMut.variables === "linking" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Link2 className="size-3.5" />
          )}
          Linking ideas
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {output ? (
        <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-background p-3 text-sm whitespace-pre-wrap text-foreground">
          {output}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Summarize, rewrite, or suggest how this capture could tie into your notebooks. Uses the Brainstorm AI Consultant
          engine with your workspace brand context when available.
        </p>
      )}
    </div>
  );
}

export function RedTeamPanel({
  workspaceId,
  contextHint = "",
  captureMaterial,
  className,
  noteAi,
}: RedTeamPanelProps) {
  const usesCaptureMaterial = captureMaterial !== undefined;
  const showBrainstormAgents = !noteAi || !noteAi.offline;

  const [consultantFramingMode, setConsultantFramingMode] = useState<ThinkingModeApi>("divergent");

  const [agentTab, setAgentTab] = useState<AgentTab>("ai_tools");

  const [redPrompt, setRedPrompt] = useState("");
  const [redOutput, setRedOutput] = useState("");
  const [redError, setRedError] = useState<string | null>(null);

  const [consultantPrompt, setConsultantPrompt] = useState("");
  const [consultantOutput, setConsultantOutput] = useState("");
  const [consultantError, setConsultantError] = useState<string | null>(null);

  const [aiToolsContext, setAiToolsContext] = useState("");

  useEffect(() => {
    setConsultantFramingMode("divergent");
    setRedPrompt("");
    setRedOutput("");
    setRedError(null);
    setConsultantPrompt("");
    setConsultantOutput("");
    setConsultantError(null);
    setAiToolsContext("");
    setAgentTab("ai_tools");
  }, [workspaceId, noteAi?.note.id, noteAi?.offline]);

  const redMessage = buildAgentUserMessage(redPrompt, contextHint, captureMaterial);
  const consultantMessage = buildAgentUserMessage(consultantPrompt, contextHint, captureMaterial);

  const redMut = useMutation({
    mutationFn: async (prompt: string) => {
      setRedError(null);
      return postBrainstormAI({
        prompt,
        mode: RED_TEAM_BRAINSTORM_MODE,
        workspaceId,
        agentRole: "red_team",
      });
    },
    onSuccess: (data) => setRedOutput(data.result),
    onError: () => setRedError("Red Team request failed. Check API configuration."),
  });

  const consultantMut = useMutation({
    mutationFn: async (prompt: string) => {
      setConsultantError(null);
      return postBrainstormAI({
        prompt,
        mode: consultantFramingMode,
        workspaceId,
        agentRole: "consultant",
      });
    },
    onSuccess: (data) => setConsultantOutput(data.result),
    onError: () => setConsultantError("AI Consultant request failed. Check API configuration."),
  });

  const redBusy = redMut.isPending;
  const consultantBusy = consultantMut.isPending;

  const runRed = () => {
    if (!redMessage) return;
    redMut.mutate(redMessage);
  };

  const runConsultant = () => {
    if (!consultantMessage) return;
    consultantMut.mutate(consultantMessage);
  };

  const applyConsultantFraming = (m: ThinkingModeApi) => {
    setConsultantFramingMode(m);
    setConsultantPrompt(CONSULTANT_MODE_TEXTAREA_PRESETS[m]);
  };

  const tabTriggerClass = (active: boolean) =>
    cn(
      "relative flex flex-1 items-center justify-center gap-2 rounded-none border-0 border-b-2 bg-transparent px-3 py-2.5 text-sm font-medium transition-colors",
      active
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    <div className={cn("flex min-h-[24rem] flex-col gap-3", className)}>
      <Card className="min-h-0 flex-1 border bg-card shadow-sm">
        <CardHeader className="gap-0 space-y-0 pb-0">
          {showBrainstormAgents || !noteAi ? (
            <div
              role="tablist"
              aria-label="Agent tools"
              className="-mx-4 flex min-w-0 border-b border-border group-data-[size=sm]/card:-mx-3"
            >
              <button
                type="button"
                role="tab"
                aria-selected={agentTab === "ai_tools"}
                aria-controls="ai-tools-tabpanel"
                id="ai-tools-agent-tab"
                className={tabTriggerClass(agentTab === "ai_tools")}
                onClick={() => setAgentTab("ai_tools")}
              >
                <Wand2
                  className={cn(
                    "size-4 shrink-0",
                    agentTab === "ai_tools" ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                AI Tools
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={agentTab === "red_team"}
                aria-controls="red-team-tabpanel"
                id="red-team-agent-tab"
                className={tabTriggerClass(agentTab === "red_team")}
                onClick={() => setAgentTab("red_team")}
              >
                <ShieldAlert
                  className={cn(
                    "size-4 shrink-0",
                    agentTab === "red_team" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                Red Team Agent
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={agentTab === "consultant"}
                aria-controls="ai-consultant-tabpanel"
                id="ai-consultant-agent-tab"
                className={tabTriggerClass(agentTab === "consultant")}
                onClick={() => setAgentTab("consultant")}
              >
                <Sparkles
                  className={cn(
                    "size-4 shrink-0",
                    agentTab === "consultant" ? "text-amber-500" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                AI Consultant
              </button>
            </div>
          ) : null}
          <CardDescription className="pt-3 pb-0">
            {noteAi && !showBrainstormAgents ?
              "Summarize, rewrite, and suggest notebook links for this note. Uses the notes AI API (not the Brainstorm agent engine)."
            : agentTab === "ai_tools" ?
              noteAi ?
                "Summarize, rewrite, and linking ideas for the open note. Uses the notes AI API."
              : usesCaptureMaterial ?
                "Summarize, rewrite, and linking-style suggestions on the Capture field (read-only). Uses the Brainstorm AI Consultant engine."
              : "Summarize, rewrite, and linking ideas using your note context."
            : agentTab === "red_team" ?
              noteAi ?
                "Pre-mortem, contrary views, and weakest-assumption exercises on your note context. Uses the Brainstorm Red Team engine."
              : usesCaptureMaterial ?
                "Uses the main capture text. Presets fill the exercise box; thought framing does not apply to Red Team."
              : "Stress-test assumptions and explore alternatives. Uses the same engine as Brainstorm Studio."
            : usesCaptureMaterial ?
              "Seed the text area with the buttons below, edit, then run. Uses the main capture text and the selected framing mode."
            : "Seed the text area with the buttons below, edit, then run. Uses the same engine as Brainstorm Studio."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {noteAi && !showBrainstormAgents ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ai-tools-extra-context">Context for AI tools</Label>
                <p className="text-xs text-muted-foreground">
                  Optional. This text is sent with summarize, rewrite, and linking ideas so you can steer tone, audience,
                  or constraints.
                </p>
                <textarea
                  id="ai-tools-extra-context"
                  className={AGENT_PROMPT_TEXTAREA_CLASS}
                  value={aiToolsContext}
                  onChange={(e) => setAiToolsContext(e.target.value)}
                  placeholder='e.g. "Assume an executive reader" or "Relate suggestions to the Q4 launch theme."'
                  maxLength={4000}
                />
              </div>
              <NoteAIActions
                embedded
                note={noteAi.note}
                workspaceId={workspaceId}
                offline={noteAi.offline}
                onUpdated={noteAi.onUpdated}
                extraContext={aiToolsContext}
              />
            </div>
          ) : agentTab === "ai_tools" ? (
            <div
              id="ai-tools-tabpanel"
              role="tabpanel"
              aria-labelledby="ai-tools-agent-tab"
              className="space-y-3"
            >
              {noteAi ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ai-tools-extra-context">Context for AI tools</Label>
                    <p className="text-xs text-muted-foreground">
                      Optional. This text is sent with summarize, rewrite, and linking ideas so you can steer tone,
                      audience, or constraints.
                    </p>
                    <textarea
                      id="ai-tools-extra-context"
                      className={AGENT_PROMPT_TEXTAREA_CLASS}
                      value={aiToolsContext}
                      onChange={(e) => setAiToolsContext(e.target.value)}
                      placeholder='e.g. "Assume an executive reader" or "Relate suggestions to the Q4 launch theme."'
                      maxLength={4000}
                    />
                  </div>
                  <NoteAIActions
                    embedded
                    note={noteAi.note}
                    workspaceId={workspaceId}
                    offline={noteAi.offline}
                    onUpdated={noteAi.onUpdated}
                    extraContext={aiToolsContext}
                  />
                </>
              ) : usesCaptureMaterial ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ai-tools-extra-context">Context for AI tools</Label>
                    <p className="text-xs text-muted-foreground">
                      Optional. Steer tone, audience, or constraints for summarize, rewrite, and linking ideas.
                    </p>
                    <textarea
                      id="ai-tools-extra-context"
                      className={AGENT_PROMPT_TEXTAREA_CLASS}
                      value={aiToolsContext}
                      onChange={(e) => setAiToolsContext(e.target.value)}
                      placeholder='e.g. "Assume an executive reader" or "Relate suggestions to the Q4 launch theme."'
                      maxLength={4000}
                    />
                  </div>
                  <CaptureAITools
                    workspaceId={workspaceId}
                    captureText={captureMaterial ?? ""}
                    extraContext={aiToolsContext}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Open a note or use Rapid Router with capture text to use AI Tools here.
                </p>
              )}
            </div>
          ) : agentTab === "red_team" ? (
            <div
              id="red-team-tabpanel"
              role="tabpanel"
              aria-labelledby="red-team-agent-tab"
              className="space-y-3"
            >
              {showBrainstormAgents ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="red-team-prompt">
                      {usesCaptureMaterial ? "Exercise & your notes" : "Your prompt"}
                    </Label>
                    {usesCaptureMaterial ? (
                      <p className="text-xs text-muted-foreground">
                        Presets only fill this box—edit freely, then Run Red Team. The model receives your capture, this
                        text, and the Red Team system prompt (thought framing does not change Red Team).
                      </p>
                    ) : null}
                    <textarea
                      id="red-team-prompt"
                      className={AGENT_PROMPT_TEXTAREA_CLASS}
                      value={redPrompt}
                      onChange={(e) => setRedPrompt(e.target.value)}
                      placeholder={
                        usesCaptureMaterial
                          ? "Choose a preset or describe what you want the Red Team to stress-test…"
                          : "What should the Red Team challenge?"
                      }
                      disabled={redBusy}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {RED_TEAM_EXERCISE_PRESETS.map((q) => (
                      <Button
                        key={q.label}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        disabled={redBusy}
                        onClick={() => setRedPrompt(q.textareaPreset)}
                      >
                        {q.label}
                      </Button>
                    ))}
                    <Button type="button" size="sm" disabled={redBusy || !redMessage} onClick={runRed}>
                      {redBusy ? <Loader2 className="size-4 animate-spin" /> : "Run Red Team"}
                    </Button>
                  </div>
                  {redError ? <p className="text-sm text-destructive">{redError}</p> : null}
                  {redOutput ? (
                    <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                      {redOutput}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : (
            <div
              id="ai-consultant-tabpanel"
              role="tabpanel"
              aria-labelledby="ai-consultant-agent-tab"
              className="space-y-3"
            >
              <div className="space-y-2">
                <Label htmlFor="ai-consultant-prompt">
                  {usesCaptureMaterial ? "Request & your notes" : "Your prompt"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {usesCaptureMaterial
                    ? "Use any button below to seed this box (thought framing sets API mode + starter text; brand presets focus on kit alignment)—edit freely, then Run AI Consultant. Brand presets assume the active brand kit from Brand Center is sent with the request."
                    : "Use any button below to seed this box—edit freely, then run. Brand presets assume your workspace brand kit is sent with the request."}
                </p>
                <textarea
                  id="ai-consultant-prompt"
                  className={AGENT_PROMPT_TEXTAREA_CLASS}
                  value={consultantPrompt}
                  onChange={(e) => setConsultantPrompt(e.target.value)}
                  placeholder="Use the buttons below to seed this box, or type your request…"
                  disabled={consultantBusy}
                />
              </div>
              <div
                role="group"
                aria-label="Thought framing, brand tools, and run"
                className="flex flex-wrap gap-2"
              >
                {THINKING_FRAMING_MODES.map((m) => (
                  <Button
                    key={m.value}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={cn(
                      "text-xs",
                      consultantFramingMode === m.value &&
                        "border-primary/60 bg-primary/10 text-foreground ring-1 ring-primary/40",
                    )}
                    disabled={consultantBusy}
                    onClick={() => applyConsultantFraming(m.value)}
                  >
                    {m.label}
                  </Button>
                ))}
                {CONSULTANT_BRAND_EXERCISE_PRESETS.map((q) => (
                  <Button
                    key={q.label}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                    disabled={consultantBusy}
                    onClick={() => setConsultantPrompt(q.textareaPreset)}
                  >
                    {q.label}
                  </Button>
                ))}
                <Button type="button" size="sm" disabled={consultantBusy || !consultantMessage} onClick={runConsultant}>
                  {consultantBusy ? <Loader2 className="size-4 animate-spin" /> : "Run AI Consultant"}
                </Button>
              </div>
              {consultantError ? <p className="text-sm text-destructive">{consultantError}</p> : null}
              {consultantOutput ? (
                <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {consultantOutput}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
