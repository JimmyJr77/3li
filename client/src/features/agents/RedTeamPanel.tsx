import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  CheckSquare,
  Expand,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minimize2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  postBrainstormAI,
  type BrainstormAgentRoleApi,
  type ThinkingModeApi,
} from "@/features/brainstorm/api";
import { fetchNotesBootstrap, patchNote, postNoteAi } from "@/features/notes/api";
import { extractPreviewFromDoc } from "@/features/notes/extractPreview";
import { plainTextToTipTapDoc } from "@/features/notes/noteUtils";
import type { AtlasNoteDto } from "@/features/notes/types";
import { cn } from "@/lib/utils";

const AGENT_PROMPT_TEXTAREA_CLASS =
  "min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type QuickBlueId =
  | "summarize"
  | "rewrite"
  | "linking"
  | "bullets"
  | "concise"
  | "expound"
  | "outline"
  | "actionItems";

const CAPTURE_AI_MODE: Record<QuickBlueId, ThinkingModeApi> = {
  summarize: "convergent",
  rewrite: "execution",
  linking: "strategic",
  bullets: "execution",
  concise: "convergent",
  expound: "divergent",
  outline: "strategic",
  actionItems: "execution",
};

type PostNoteAiQuickId = Extract<QuickBlueId, "summarize" | "rewrite" | "linking">;

/** Quick prompts that use the dedicated notes `/ai` endpoint (online notes only). */
function isPostNoteAiQuick(id: QuickBlueId): id is PostNoteAiQuickId {
  return id === "summarize" || id === "rewrite" || id === "linking";
}

function buildBrainstormQuickCoreBlock(
  id: QuickBlueId,
  material: string,
  opts: { materialLabel: string; neighborLines?: string },
): string {
  const { materialLabel, neighborLines } = opts;
  const body = `${materialLabel}:\n${material}`;

  switch (id) {
    case "summarize":
      return `Summarize the following in 2–5 sentences for quick scanning.\n\n${body}`;
    case "rewrite":
      return `Rewrite the following for clarity and scannability. Keep the author's meaning. Output plain text only; use blank lines between paragraphs.\n\n${body}`;
    case "linking":
      return [
        `You are helping with notebook linking ideas for this material.`,
        body,
        neighborLines
          ? `Existing notes in this workspace (for connection ideas only):\n${neighborLines}`
          : "Existing notes in this workspace: (none listed yet)",
        `Output plain text with short sections: Connections, Implications, Suggested next links (name possible notes or themes to create or link later). Be concise.`,
      ].join("\n\n");
    case "bullets":
      return `Convert the following into a clear bullet list. Preserve meaning; group related points; use nested bullets only when it helps. Output plain text.\n\n${body}`;
    case "concise":
      return `Make the following significantly more concise without losing essential meaning or commitments. Cut filler and repetition; keep critical names, dates, and numbers. Output plain text.\n\n${body}`;
    case "expound":
      return `Expound on the following: add helpful context, implications, and examples the author can paste back into a note. Stay grounded in the text—mark speculation clearly. Output plain text with short sections.\n\n${body}`;
    case "outline":
      return `Create a structured outline of the following using numbered top-level sections and bullet sub-points where useful. Output plain text only.\n\n${body}`;
    case "actionItems":
      return `Extract concrete action items from the following. For each item: what to do, owner role if inferable, and deadline or urgency if mentioned. Output a plain-text checklist.\n\n${body}`;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export type FocusLens = "strategic" | "operational" | "tactical" | null;

type AdviseAgentRoute = BrainstormAgentRoleApi | "both";

type AdvisePresetKind = "red" | "blue" | "both";

/** Shown in the Prompt Description & Context Box when a quick chip is selected. */
const QUICK_PROMPT_CONTEXT_PRESETS: Record<QuickBlueId, string> = {
  summarize: `Quick prompt: Summarize

What this does: Produces a short 2–5 sentence overview of the primary dialogue on this page (your open note or Rapid Router capture—whichever you opened Advisor Agents from) so you or teammates can scan the gist quickly. You do not need to paste the note or capture here.

Your additional context or instructions (optional):
e.g. audience (exec / technical / customer), tone, what to emphasize or omit, or how you will use the summary.
`,

  rewrite: `Quick prompt: Rewrite

What this does: Clarifies and tightens wording while keeping the author’s meaning. Output is plain text with spacing you can paste back into a note. The model works from the primary dialogue on this page.

Your additional context or instructions (optional):
e.g. audience, voice (formal / casual), length limits, bullets vs paragraphs, words to avoid, or structural preferences.
`,

  linking: `Quick prompt: Linking ideas

What this does: Suggests how this material could connect to other themes or notes in the workspace—connections, implications, and ideas for future links. In Rapid Router, the model can see a list of existing note titles from this workspace when suggesting links.

Your additional context or instructions (optional):
e.g. themes, projects, or note titles to prioritize; what “linking” should mean for you (backlog, wiki cross-refs, follow-up notes).
`,

  bullets: `Quick prompt: Bullet list

What this does: Restructures the primary dialogue into a scannable bullet list while preserving meaning and grouping related ideas.

Your additional context or instructions (optional):
e.g. max depth of nesting, audience, or sections to emphasize.
`,

  concise: `Quick prompt: Make concise

What this does: Tightens wording and removes filler while keeping commitments, names, dates, and numbers that matter.

Your additional context or instructions (optional):
e.g. target length, tone, or phrases to preserve verbatim.
`,

  expound: `Quick prompt: Expound

What this does: Expands on the material with context, implications, and examples you can fold back into a note—without inventing facts.

Your additional context or instructions (optional):
e.g. reader expertise level, industry lens, or questions you want answered.
`,

  outline: `Quick prompt: Outline

What this does: Builds a numbered outline with sub-bullets so you can reorganize or promote sections in a longer note.

Your additional context or instructions (optional):
e.g. depth, parallel structure for slide decks, or naming convention for sections.
`,

  actionItems: `Quick prompt: Action items

What this does: Pulls explicit and implied tasks into a checklist with owners and timing when the text supports it.

Your additional context or instructions (optional):
e.g. RACI-style owners, tool names, or how granular each task should be.
`,
};

const QUICK_CONSULTANT_CHIPS: { id: QuickBlueId; label: string; Icon: LucideIcon }[] = [
  { id: "summarize", label: "Summarize", Icon: Sparkles },
  { id: "rewrite", label: "Rewrite", Icon: Wand2 },
  { id: "linking", label: "Linking ideas", Icon: Link2 },
  { id: "bullets", label: "Bullet list", Icon: List },
  { id: "concise", label: "Make concise", Icon: Minimize2 },
  { id: "expound", label: "Expound", Icon: Expand },
  { id: "outline", label: "Outline", Icon: ListOrdered },
  { id: "actionItems", label: "Action items", Icon: CheckSquare },
];

type SelectedPrompt =
  | { kind: "quick"; id: QuickBlueId }
  | { kind: "exercise"; presetId: string; agentRoute: AdviseAgentRoute; agentKind: AdvisePresetKind };

type AdviseExercisePreset = {
  id: string;
  label: string;
  agentRoute: AdviseAgentRoute;
  agentKind: AdvisePresetKind;
  textareaPreset: string;
};

const FOCUS_LENS_OPTIONS: { value: Exclude<FocusLens, null>; label: string }[] = [
  { value: "strategic", label: "Strategic" },
  { value: "operational", label: "Operational" },
  { value: "tactical", label: "Tactical" },
];

const ADVISE_EXERCISE_PRESETS: AdviseExercisePreset[] = [
  {
    id: "pre-mortem",
    label: "Pre-mortem",
    agentRoute: "red_team",
    agentKind: "red",
    textareaPreset: `Exercise: Pre-mortem

What this does: Assume the work described in the capture failed about six months from now. Work backward from that failure to expose risks, blind spots, and weak links.

Instruction you are asking the model to run (edit freely):
Pre-mortem: assume this failed in six months—what went wrong?

Your additional notes or constraints for this run (optional):
`,
  },
  {
    id: "contrary-views",
    label: "Contrary views",
    agentRoute: "red_team",
    agentKind: "red",
    textareaPreset: `Exercise: Contrary views

What this does: Surfaces alternative framings and opposing angles so you are not anchored on a single narrative.

Instruction you are asking the model to run (edit freely):
Give three contrary framings of the same idea.

Your additional notes or constraints for this run (optional):
`,
  },
  {
    id: "weakest-assumption",
    label: "Weakest assumption",
    agentRoute: "red_team",
    agentKind: "red",
    textareaPreset: `Exercise: Weakest assumption

What this does: Makes explicit what must be true for the capture to work, then stresses the weakest link.

Instruction you are asking the model to run (edit freely):
What must be true for this to work? Flag the weakest assumption.

Your additional notes or constraints for this run (optional):
`,
  },
  {
    id: "voice-fit",
    label: "Voice fit",
    agentRoute: "consultant",
    agentKind: "blue",
    textareaPreset: `Exercise: Voice fit

What this does: Assesses the capture (copy, claims, tone) against the active brand kit and Brand Center voice and positioning. Surfaces phrasing risks and suggests on-brand alternatives the team can adopt.

Brand context: The assistant receives your workspace brand profile with this request—use it as authoritative for voice and positioning.

What you are asking the consultant to do (edit freely):
Review the capture for voice and positioning fit against our brand kit. Call out mismatches, risky claims, and concrete rewrite suggestions that stay on-brand.

Your additional context or constraints (optional):
`,
  },
  {
    id: "message-clarity",
    label: "Message clarity",
    agentRoute: "consultant",
    agentKind: "blue",
    textareaPreset: `Exercise: Message clarity

What this does: Distills the core message, intended audience, proof, and call-to-action. Flags confusion, jargon, or over-claiming relative to brand standards so the narrative is clear and defensible.

Brand context: The assistant receives your workspace brand profile with this request—use it to judge clarity and credibility against how we present the brand.

What you are asking the consultant to do (edit freely):
Break down the capture’s core message, audience, proof, and CTA. Note what is unclear or overstated and suggest a tighter, clearer version aligned with our brand standards.

Your additional context or constraints (optional):
`,
  },
  {
    id: "goal-alignment",
    label: "Goal alignment",
    agentRoute: "consultant",
    agentKind: "blue",
    textareaPreset: `Exercise: Goal alignment

What this does: Maps the capture to mission, values, and stated business goals from the brand kit. Names gaps, tradeoffs, and sequencing so the work strengthens strategic alignment.

Brand context: The assistant receives your workspace brand profile with this request—explicitly tie recommendations to mission, values, and goals documented there.

What you are asking the consultant to do (edit freely):
Connect this capture to our stated mission, values, and business goals. Identify misalignment, missing links, and the next 2–3 moves to strengthen alignment.

Your additional context or constraints (optional):
`,
  },
  {
    id: "brand-plus-challenge",
    label: "Brand + challenge",
    agentRoute: "both",
    agentKind: "both",
    textareaPreset: `Exercise: Brand alignment and stress-test

What this does: First pass — brand/voice/clarity against the workspace brand kit. Second pass — red-team challenge on assumptions, risks, and what could fail.

Instruction you are asking the models to run (edit freely):
(1) How well does this capture fit our brand voice, claims, and goals? (2) What are the strongest objections, hidden assumptions, and failure modes?

Your additional context or constraints (optional):
`,
  },
  {
    id: "stakeholder-readout",
    label: "Stakeholder readout",
    agentRoute: "consultant",
    agentKind: "blue",
    textareaPreset: `Exercise: Stakeholder readout

What this does: Surfaces who is affected or decides on this work, what each group needs from the narrative, and where tone or emphasis should shift between audiences.

Brand context: The assistant receives your workspace brand profile with this request—use it where voice or positioning should stay consistent for external-facing stakeholders.

What you are asking the consultant to do (edit freely):
Map stakeholders (internal and external), their incentives, and what they must take away from this material. Flag where the copy serves one audience but weakens trust with another, and suggest concrete adjustments.

Your additional context or constraints (optional):
`,
  },
  {
    id: "decision-memo",
    label: "Decision memo",
    agentRoute: "consultant",
    agentKind: "blue",
    textareaPreset: `Exercise: Decision memo

What this does: Structures the capture as a decision document: options, decision criteria, tradeoffs, a recommended path, and what would change your mind.

What you are asking the consultant to do (edit freely):
Turn this into a concise decision memo: list viable options, score against explicit criteria, state a recommendation, and list open questions or missing data.

Your additional context or constraints (optional):
`,
  },
  {
    id: "exec-briefing",
    label: "Exec briefing",
    agentRoute: "consultant",
    agentKind: "blue",
    textareaPreset: `Exercise: Exec briefing

What this does: Produces a scannable executive read: tight bullets, risks, asks, and a clear “so what” without burying the lead.

What you are asking the consultant to do (edit freely):
Draft an exec briefing from this material: context in one line, 5–7 bullets max, explicit decision or ask, top risks, and what success looks like next week.

Your additional context or constraints (optional):
`,
  },
  {
    id: "next-steps-raci",
    label: "Next steps RACI",
    agentRoute: "consultant",
    agentKind: "blue",
    textareaPreset: `Exercise: Next steps RACI

What this does: Extracts concrete actions from the capture, assigns Responsible / Accountable / Consulted / Informed where possible, and surfaces dependencies and deadlines.

What you are asking the consultant to do (edit freely):
List the next actions implied by this capture in RACI form. Call out blockers, sequencing, and anything still ambiguous about ownership or timing.

Your additional context or constraints (optional):
`,
  },
  {
    id: "faq-from-material",
    label: "FAQ from material",
    agentRoute: "consultant",
    agentKind: "blue",
    textareaPreset: `Exercise: FAQ from material

What this does: Anticipates the questions readers or reviewers will ask and answers them crisply from the material—gaps become explicit follow-ups.

What you are asking the consultant to do (edit freely):
Produce 8–12 FAQ pairs: likely questions (including skeptical ones) and short answers grounded in the capture. Mark items that need data or a decision from leadership.

Your additional context or constraints (optional):
`,
  },
  {
    id: "steel-man-stress",
    label: "Steel-man then stress",
    agentRoute: "red_team",
    agentKind: "red",
    textareaPreset: `Exercise: Steel-man then stress

What this does: Builds the strongest charitable version of the idea, then stress-tests assumptions, dependencies, and single points of failure.

Instruction you are asking the model to run (edit freely):
Steel-man this plan or proposal, then attack the steel man: where would a well-informed critic still say no?

Your additional notes or constraints for this run (optional):
`,
  },
  {
    id: "second-order-effects",
    label: "Second-order effects",
    agentRoute: "red_team",
    agentKind: "red",
    textareaPreset: `Exercise: Second-order effects

What this does: Traces unintended consequences, feedback loops, and who gets squeezed when the first-order plan works as written.

Instruction you are asking the model to run (edit freely):
What second- and third-order effects appear if we execute this? Name incentives that shift, teams overloaded, and metrics that could game behavior.

Your additional notes or constraints for this run (optional):
`,
  },
  {
    id: "kill-stop-criteria",
    label: "Kill / stop criteria",
    agentRoute: "red_team",
    agentKind: "red",
    textareaPreset: `Exercise: Kill / stop criteria

What this does: Defines observable signals to pause, pivot, or abandon—so the team does not rationalize sunk cost.

Instruction you are asking the model to run (edit freely):
What kill or stop criteria should we publish for this initiative? List leading indicators, lagging proof points, and who pulls the cord.

Your additional notes or constraints for this run (optional):
`,
  },
  {
    id: "five-whys",
    label: "Five whys",
    agentRoute: "red_team",
    agentKind: "red",
    textareaPreset: `Exercise: Five whys

What this does: Walks a structured root-cause chain from the stated problem or goal down to underlying drivers and organizational fixes.

Instruction you are asking the model to run (edit freely):
Run a five-whys analysis on the core problem or risk described here. End with systemic causes and what would actually change outcomes—not band-aids.

Your additional notes or constraints for this run (optional):
`,
  },
  {
    id: "launch-readiness",
    label: "Launch readiness",
    agentRoute: "both",
    agentKind: "both",
    textareaPreset: `Exercise: Launch readiness

What this does: Combines a brand- and clarity-oriented checklist with a red-team pass on launch risks, edge cases, and rollback.

Instruction you are asking the models to run (edit freely):
(1) Consultant: Is messaging, audience fit, and proof ready for external launch against our brand standards? (2) Red team: What breaks at scale, in support, or in compliance—and what is our rollback or comms plan?

Your additional context or constraints (optional):
`,
  },
  {
    id: "upside-downside",
    label: "Upside vs downside",
    agentRoute: "both",
    agentKind: "both",
    textareaPreset: `Exercise: Upside vs downside

What this does: First frames the upside case and best path to value; then delivers an adversarial critique of downside, tail risks, and what must go right.

Instruction you are asking the models to run (edit freely):
(1) Make the strongest upside case with evidence from the capture. (2) Tear it down: failure modes, competitive response, and hidden assumptions—then reconcile with a balanced view.

Your additional context or constraints (optional):
`,
  },
];

function focusLensToApiMode(lens: FocusLens): ThinkingModeApi {
  if (lens === "strategic") return "strategic";
  if (lens === "operational") return "execution";
  if (lens === "tactical") return "convergent";
  return "strategic";
}

function focusLensInstructionBlock(lens: FocusLens): string {
  if (!lens) return "";
  const lines: Record<Exclude<FocusLens, null>, string> = {
    strategic:
      "Focus lens: **Strategic** — emphasize goals, stakeholders, portfolio risks, sequencing, and coherent outcomes.",
    operational:
      "Focus lens: **Operational** — emphasize how this gets done in practice: owners, cadence, dependencies, handoffs, and near-term execution risks.",
    tactical:
      "Focus lens: **Tactical** — emphasize concrete choices, tradeoffs, immediate next moves, and crisp decision criteria.",
  };
  return `${lines[lens]}\n\n`;
}

function presetChipButtonClass(kind: AdvisePresetKind, disabled: boolean, selected: boolean): string {
  const base =
    "text-xs border transition-colors disabled:opacity-50 disabled:pointer-events-none bg-background hover:bg-accent/80";
  const ring = selected ? "ring-2 ring-primary/50 ring-offset-1 ring-offset-background" : "";
  if (kind === "red") {
    return cn(
      base,
      ring,
      "border-rose-600/45 text-rose-950 hover:border-rose-600/70 dark:border-rose-500/45 dark:bg-rose-950/35 dark:text-rose-50 dark:hover:bg-rose-950/55",
      disabled && "opacity-50",
    );
  }
  if (kind === "blue") {
    return cn(
      base,
      ring,
      "border-sky-600/45 text-sky-950 hover:border-sky-600/70 dark:border-sky-500/45 dark:bg-sky-950/35 dark:text-sky-50 dark:hover:bg-sky-950/55",
      disabled && "opacity-50",
    );
  }
  return cn(
    base,
    ring,
    "border-violet-600/45 text-violet-950 hover:border-violet-600/70 dark:border-violet-500/45 dark:bg-violet-950/35 dark:text-violet-50 dark:hover:bg-violet-950/55",
    disabled && "opacity-50",
  );
}

const RED_HINT =
  /\b(pre-?mortem|premortem|contrary|weakest\s+assumption|devil|attack|risk|red\s*team|stress[- ]?test|falsif|blind\s*spot|failure\s*mode|challenge|assumption|steel[- ]?man|second[- ]?order|kill\s*criteria|stop\s*criteria|five\s+whys|root\s*cause)\b/i;
const BLUE_HINT =
  /\b(voice|brand\s*kit|message\s*clarity|goal\s*alignment|mission|positioning|cta|audience|on[- ]?brand|values|tone|summarize|rewrite|linking|bullet|concise|expound|outline|action\s*items?|stakeholder|decision\s*memo|exec\s*brief|raci|faq|next\s*steps)\b/i;

function resolveAdviseRouteFromText(text: string): AdviseAgentRoute {
  const t = text.trim();
  if (!t) return "consultant";
  const red = RED_HINT.test(t);
  const blue = BLUE_HINT.test(t);
  if (red && blue) return "both";
  if (red) return "red_team";
  if (blue) return "consultant";
  return "consultant";
}

function buildExtraContextForNotes(requestText: string, focusLens: FocusLens): string | undefined {
  const lens = focusLensInstructionBlock(focusLens).trim();
  const ctx = requestText.trim();
  const merged = [lens || null, ctx || null].filter(Boolean).join("\n\n").slice(0, 4000);
  return merged || undefined;
}

type RedTeamPanelProps = {
  workspaceId: string;
  contextHint?: string;
  captureMaterial?: string;
  className?: string;
  noteAi?: {
    note: AtlasNoteDto;
    onUpdated: () => void;
    offline?: boolean;
  };
  /** When set with workspaceId, turns are logged to the agent hub (dashboard). */
  hubAgentKind?: "brainstorm_ai" | "advisor_agents";
  brainstormCanvasSessionId?: string | null;
};

function primaryDialoguePreamble(
  usesCaptureMaterial: boolean,
  hasOpenNote: boolean,
  contextHintNonEmpty: boolean,
): string {
  if (usesCaptureMaterial) {
    return (
      "PRIMARY DIALOGUE (mandatory scope): Base your answer ONLY on the Captured material block in this message (the Rapid Router Capture field on this page). " +
      "Do not assume other captures, mailroom plans, routing destinations, or UI state unless the user pasted them into the operator request.\n\n"
    );
  }
  if (hasOpenNote) {
    return (
      "PRIMARY DIALOGUE (mandatory scope): Base your answer ONLY on the open note in the Capture context below (active Notebooks note — title and body text provided there). " +
      "Do not treat other notes, the folder list, or notebook chrome as the subject of your answer unless they appear in that capture text.\n\n"
    );
  }
  if (contextHintNonEmpty) {
    return "PRIMARY DIALOGUE (mandatory scope): Base your answer on the Capture context block below.\n\n";
  }
  return "";
}

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

function composeAdviseOperatorBody(requestBody: string, focusLens: FocusLens): string {
  const lens = focusLensInstructionBlock(focusLens);
  return `${lens}${requestBody.trim()}`;
}

export function RedTeamPanel({
  workspaceId,
  contextHint = "",
  captureMaterial,
  className,
  noteAi,
  hubAgentKind = "advisor_agents",
  brainstormCanvasSessionId = null,
}: RedTeamPanelProps) {
  const qc = useQueryClient();
  const usesCaptureMaterial = captureMaterial !== undefined;
  const showBrainstormAgents = !noteAi || !noteAi.offline;
  const hubSessionIdRef = useRef<string | null>(null);
  const canvasSid = brainstormCanvasSessionId ?? undefined;

  useEffect(() => {
    hubSessionIdRef.current = null;
  }, [workspaceId, hubAgentKind, canvasSid]);

  const { data: notesBootstrap } = useQuery({
    queryKey: ["notes-app", "bootstrap", workspaceId],
    queryFn: () => fetchNotesBootstrap(workspaceId),
    enabled: Boolean(workspaceId) && noteAi != null && !noteAi.offline,
  });

  const { data: captureBootstrap } = useQuery({
    queryKey: ["notes-app", "bootstrap", workspaceId],
    queryFn: () => fetchNotesBootstrap(workspaceId),
    enabled: Boolean(workspaceId) && usesCaptureMaterial && !noteAi,
  });

  const [focusLens, setFocusLens] = useState<FocusLens>(null);
  const [requestBody, setRequestBody] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<SelectedPrompt | null>(null);

  const [panelOutput, setPanelOutput] = useState("");
  const [panelError, setPanelError] = useState<string | null>(null);
  const [lastNoteAction, setLastNoteAction] = useState<"summarize" | "rewrite" | "notebookLinking" | null>(null);

  const apiMode = useMemo(() => focusLensToApiMode(focusLens), [focusLens]);

  const composedExerciseBody = useMemo(
    () => composeAdviseOperatorBody(requestBody, focusLens),
    [requestBody, focusLens],
  );

  const adviseMessage = buildAgentUserMessage(composedExerciseBody, contextHint, captureMaterial);
  const agentPreamble = primaryDialoguePreamble(
    usesCaptureMaterial,
    Boolean(noteAi),
    contextHint.trim().length > 0,
  );

  const captureReady = Boolean(captureMaterial?.trim());
  const noteReady = Boolean(noteAi && (contextHint.trim().length > 0 || noteAi.note.id));
  const primaryDialogueReady = usesCaptureMaterial ? captureReady : noteAi ? noteReady : contextHint.trim().length > 0;

  const canSubmitQuick =
    selectedPrompt?.kind === "quick" &&
    primaryDialogueReady &&
    (usesCaptureMaterial ? captureReady : noteAi != null && !noteAi.offline);

  const canSubmitExercise =
    selectedPrompt?.kind === "exercise" &&
    Boolean(adviseMessage) &&
    primaryDialogueReady &&
    (usesCaptureMaterial ? captureReady : Boolean(noteAi));

  const canSubmitFreeform =
    selectedPrompt === null &&
    requestBody.trim().length > 0 &&
    Boolean(adviseMessage) &&
    primaryDialogueReady &&
    (usesCaptureMaterial ? captureReady : Boolean(noteAi));

  const applyPresetExercise = (p: AdviseExercisePreset) => {
    setSelectedPrompt({ kind: "exercise", presetId: p.id, agentRoute: p.agentRoute, agentKind: p.agentKind });
    setRequestBody(p.textareaPreset);
  };

  const selectQuick = (id: QuickBlueId) => {
    setSelectedPrompt({ kind: "quick", id });
    setRequestBody(QUICK_PROMPT_CONTEXT_PRESETS[id]);
  };

  const runPanel = useMutation({
    mutationFn: async () => {
      setPanelError(null);
      setLastNoteAction(null);

      if (selectedPrompt?.kind === "quick") {
        const extraOpts = buildExtraContextForNotes(requestBody, focusLens);
        if (noteAi && !noteAi.offline && isPostNoteAiQuick(selectedPrompt.id)) {
          const action =
            selectedPrompt.id === "linking" ? "notebookLinking" : selectedPrompt.id;
          const data = await postNoteAi(noteAi.note.id, action, extraOpts ? { extraContext: extraOpts } : undefined);
          return {
            kind: "text" as const,
            text: data.result ?? "",
            noteAction: action as "summarize" | "rewrite" | "notebookLinking",
            partialErrors: null as string[] | null,
          };
        }

        if (!showBrainstormAgents) {
          throw new Error("Connect to the server to run this prompt.");
        }

        const material = usesCaptureMaterial
          ? (captureMaterial?.trim().slice(0, 7500) ?? "")
          : contextHint.trim().slice(0, 7500);
        if (!material) {
          throw new Error("Add capture text or open a note with content to run this prompt.");
        }

        const materialLabel = usesCaptureMaterial ? "Captured material" : "Open note (title and body)";
        const neighborLines =
          usesCaptureMaterial && selectedPrompt.id === "linking"
            ? (captureBootstrap?.notes ?? [])
                .slice(0, 50)
                .map((n) => {
                  const prev = (n.previewText ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
                  return `- ${n.title}${prev ? ` — ${prev}` : ""} (id: ${n.id})`;
                })
                .join("\n")
            : undefined;

        const lensPrefix = focusLensInstructionBlock(focusLens);
        const coreBlock = buildBrainstormQuickCoreBlock(selectedPrompt.id, material, {
          materialLabel,
          ...(neighborLines ? { neighborLines } : {}),
        });
        const userBlock = withCaptureAiExtraContext(lensPrefix + coreBlock, requestBody);
        const scope = usesCaptureMaterial
          ? "PRIMARY DIALOGUE (mandatory scope): Base your answer ONLY on the Captured material in this message (Rapid Router Capture field on this page). Ignore mailroom, routing UI, and other page chrome.\n\n"
          : "PRIMARY DIALOGUE (mandatory scope): Base your answer ONLY on the open note in the Capture context below (active Notebooks note — title and body text provided there). Do not treat other notes, the folder list, or notebook chrome as the subject of your answer unless they appear in that capture text.\n\n";

        const data = await postBrainstormAI({
          prompt: scope + userBlock,
          mode: CAPTURE_AI_MODE[selectedPrompt.id],
          workspaceId,
          agentRole: "consultant",
          hubAgentKind,
          agentSessionId: hubSessionIdRef.current,
          ...(canvasSid ? { brainstormCanvasSessionId: canvasSid } : {}),
        });
        if (data.agentSessionId) hubSessionIdRef.current = data.agentSessionId;
        return { kind: "text" as const, text: data.result ?? "", noteAction: null, partialErrors: null as string[] | null };
      }

      const fullPrompt = agentPreamble + (adviseMessage ?? "");
      let route: AdviseAgentRoute;
      if (selectedPrompt?.kind === "exercise") {
        route = selectedPrompt.agentRoute;
      } else {
        route = resolveAdviseRouteFromText(requestBody);
      }

      if (route === "both") {
        const parts: string[] = [];
        const errs: string[] = [];
        try {
          const d1 = await postBrainstormAI({
            prompt: fullPrompt,
            mode: apiMode,
            workspaceId,
            agentRole: "red_team",
            hubAgentKind,
            agentSessionId: hubSessionIdRef.current,
            ...(canvasSid ? { brainstormCanvasSessionId: canvasSid } : {}),
          });
          if (d1.agentSessionId) hubSessionIdRef.current = d1.agentSessionId;
          parts.push("## Red team\n\n" + (d1.result ?? ""));
        } catch (e) {
          errs.push(e instanceof Error ? e.message : "Red team request failed.");
        }
        try {
          const d2 = await postBrainstormAI({
            prompt: fullPrompt,
            mode: apiMode,
            workspaceId,
            agentRole: "consultant",
            hubAgentKind,
            agentSessionId: hubSessionIdRef.current,
            ...(canvasSid ? { brainstormCanvasSessionId: canvasSid } : {}),
          });
          if (d2.agentSessionId) hubSessionIdRef.current = d2.agentSessionId;
          parts.push("## Consultant\n\n" + (d2.result ?? ""));
        } catch (e) {
          errs.push(e instanceof Error ? e.message : "Consultant request failed.");
        }
        if (parts.length === 0) throw new Error(errs.join(" "));
        return {
          kind: "text" as const,
          text: parts.join("\n\n---\n\n"),
          partialErrors: errs.length ? errs : null,
          noteAction: null,
        };
      }

      const role: BrainstormAgentRoleApi = route === "red_team" ? "red_team" : "consultant";
      const data = await postBrainstormAI({
        prompt: fullPrompt,
        mode: apiMode,
        workspaceId,
        agentRole: role,
        hubAgentKind,
        agentSessionId: hubSessionIdRef.current,
        ...(canvasSid ? { brainstormCanvasSessionId: canvasSid } : {}),
      });
      if (data.agentSessionId) hubSessionIdRef.current = data.agentSessionId;
      return {
        kind: "text" as const,
        text: data.result ?? "",
        partialErrors: null as string[] | null,
        noteAction: null,
      };
    },
    onSuccess: (data) => {
      setPanelOutput(data.text);
      if (data.partialErrors?.length) {
        setPanelError(data.partialErrors.join(" "));
      } else {
        setPanelError(null);
      }
      if (data.noteAction) {
        setLastNoteAction(data.noteAction);
      } else {
        setLastNoteAction(null);
      }
    },
    onError: (e: unknown) => {
      setPanelOutput("");
      setPanelError(e instanceof Error ? e.message : "Request failed. Check API configuration.");
      setLastNoteAction(null);
    },
  });

  const applyRewrite = useMutation({
    mutationFn: async () => {
      if (!noteAi || !panelOutput.trim()) return;
      const doc = plainTextToTipTapDoc(panelOutput);
      const preview = extractPreviewFromDoc(doc);
      await patchNote(noteAi.note.id, { contentJson: doc, previewText: preview || null });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notes-app"] });
      setPanelOutput("");
      setLastNoteAction(null);
      noteAi?.onUpdated();
    },
  });

  const busy = runPanel.isPending;

  const canRun =
    showBrainstormAgents && (canSubmitQuick || canSubmitExercise || canSubmitFreeform);

  const redPresets = ADVISE_EXERCISE_PRESETS.filter((p) => p.agentKind === "red");
  const bluePresets = ADVISE_EXERCISE_PRESETS.filter((p) => p.agentKind === "blue");
  const bothPresets = ADVISE_EXERCISE_PRESETS.filter((p) => p.agentKind === "both");

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="space-y-4 pt-6">
          {noteAi && !showBrainstormAgents ? (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                Summarize, Rewrite, and Linking ideas use the notes API when online. Other quick tools use the
                workspace consultant. Connect to the server when local notes sync.
              </p>
              <p>AI prompts need the Notebooks API. Edit locally, then sync when the server is available.</p>
            </div>
          ) : (
            <>
              <div className="mt-2 space-y-2">
                <Label id="focus-lens-label">Thinking level (optional)</Label>
                <div role="group" aria-labelledby="focus-lens-label" className="flex flex-wrap gap-2">
                  {FOCUS_LENS_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className={cn(
                        "text-xs",
                        focusLens === opt.value &&
                          "border-primary/60 bg-primary/10 text-foreground ring-1 ring-primary/40",
                      )}
                      disabled={busy}
                      onClick={() => setFocusLens(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={cn(
                      "text-xs",
                      focusLens === null &&
                        "border-primary/60 bg-primary/10 text-foreground ring-1 ring-primary/40",
                    )}
                    disabled={busy}
                    onClick={() => setFocusLens(null)}
                  >
                    None
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="request-body">Prompt Description & Context Box</Label>
                <p className="text-xs text-muted-foreground">
                  Optional audience, constraints, or edits to a seeded exercise. Included with quick prompts (with the
                  thinking level) and with Advise. Pick a prompt below, or leave presets unset and type a freeform
                  request for keyword routing.
                </p>
                <textarea
                  id="request-body"
                  className={AGENT_PROMPT_TEXTAREA_CLASS}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder='e.g. "Executive reader" or paste a seeded exercise after choosing a prompt…'
                  maxLength={8000}
                  disabled={busy}
                />
              </div>

              <div className="space-y-3">
                <Label id="prompt-picks-label">Prompts</Label>
                <p id="prompt-picks-hint" className="text-xs text-muted-foreground">
                  Select one prompt, adjust the prompt description and context box above if needed, then press Advise.
                  Clear prompt resets
                  selection; freeform routing uses keywords in the request when no chip is selected.
                </p>

                <div role="group" aria-labelledby="prompt-picks-label" aria-describedby="prompt-picks-hint" className="space-y-3">
                  {(noteAi || usesCaptureMaterial) ?
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-sky-800 dark:text-sky-300">Quick — consultant</p>
                      <div className="flex flex-wrap gap-2">
                        {QUICK_CONSULTANT_CHIPS.map(({ id, label, Icon }) => (
                          <Button
                            key={id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={presetChipButtonClass(
                              "blue",
                              busy,
                              selectedPrompt?.kind === "quick" && selectedPrompt.id === id,
                            )}
                            disabled={busy || (!usesCaptureMaterial && !noteAi)}
                            onClick={() => selectQuick(id)}
                          >
                            <Icon className="mr-1 size-3.5 opacity-80" aria-hidden />
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  : null}

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-sky-800 dark:text-sky-300">Brand & clarity — consultant</p>
                    <div className="flex flex-wrap gap-2">
                      {bluePresets.map((q) => (
                        <Button
                          key={q.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          className={presetChipButtonClass(
                            "blue",
                            busy,
                            selectedPrompt?.kind === "exercise" && selectedPrompt.presetId === q.id,
                          )}
                          disabled={busy || !showBrainstormAgents}
                          onClick={() => applyPresetExercise(q)}
                        >
                          {q.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-rose-700 dark:text-rose-300">Challenge — red team</p>
                    <div className="flex flex-wrap gap-2">
                      {redPresets.map((q) => (
                        <Button
                          key={q.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          className={presetChipButtonClass(
                            "red",
                            busy,
                            selectedPrompt?.kind === "exercise" && selectedPrompt.presetId === q.id,
                          )}
                          disabled={busy || !showBrainstormAgents}
                          onClick={() => applyPresetExercise(q)}
                        >
                          {q.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {bothPresets.length > 0 ?
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-violet-800 dark:text-violet-300">Both perspectives</p>
                      <div className="flex flex-wrap gap-2">
                        {bothPresets.map((q) => (
                          <Button
                            key={q.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={presetChipButtonClass(
                              "both",
                              busy,
                              selectedPrompt?.kind === "exercise" && selectedPrompt.presetId === q.id,
                            )}
                            disabled={busy || !showBrainstormAgents}
                            onClick={() => applyPresetExercise(q)}
                          >
                            {q.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="default"
                  disabled={!canRun || busy}
                  onClick={() => runPanel.mutate()}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  {busy ? "Running…" : "Advise"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={busy}
                  onClick={() => {
                    setSelectedPrompt(null);
                    setRequestBody("");
                  }}
                >
                  Clear prompt
                </Button>
                {lastNoteAction === "rewrite" && panelOutput.trim() && noteAi && !noteAi.offline ?
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={applyRewrite.isPending}
                    onClick={() => applyRewrite.mutate()}
                  >
                    {applyRewrite.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Apply rewrite to note
                  </Button>
                : null}
              </div>

              {panelError && panelOutput ?
                <p className="text-sm text-amber-700 dark:text-amber-400">{panelError}</p>
              : panelError ?
                <p className="text-sm text-destructive">{panelError}</p>
              : null}

              {panelOutput ?
                <div className="border-t border-border/60 pt-4 text-sm whitespace-pre-wrap text-foreground">
                  {panelOutput}
                </div>
              : notesBootstrap && noteAi && !noteAi.offline ?
                <p className="text-xs text-muted-foreground">
                  {notesBootstrap.ai?.backend === "ollama" ?
                    <>
                      Note AI uses local <code className="rounded bg-muted px-1">Ollama</code>. After Rewrite, use{" "}
                      <strong>Apply rewrite to note</strong> when ready.
                    </>
                  : notesBootstrap.ai?.backend === "groq" ?
                    <>
                      Note AI uses <code className="rounded bg-muted px-1">Groq</code> on the server. After Rewrite,
                      use <strong>Apply rewrite to note</strong> when ready.
                    </>
                  : notesBootstrap.ai?.backend === "openai" ?
                    <>
                      Requires <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> on the API. After Rewrite,
                      use <strong>Apply rewrite to note</strong> when ready.
                    </>
                  : "Connect the API with AI enabled to run prompts from this panel."}
                </p>
              : !panelOutput ?
                <p className="text-xs text-muted-foreground">
                  {usesCaptureMaterial ?
                    "Quick tools (except Summarize, Rewrite, and Linking on online notes) use the workspace consultant. Exercises use internal red/consultant routing."
                  : "Open a note with body text, or use Rapid Router capture, so Advise has primary dialogue to read."}
                </p>
              : null}
            </>
          )}
      </div>
    </div>
  );
}
