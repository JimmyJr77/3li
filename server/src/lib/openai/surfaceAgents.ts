import type { OpenAI } from "openai";
import { chatModel } from "../ai/models.js";
import { formatBrandProfileForPrompt } from "../brandProfileFormat.js";
import { loadBrandProfileJsonForWorkspaceId } from "../brandProfileFromWorkspace.js";
import { formatTeamUserBlocksForPrompt, loadContextInstructionsForWorkspace } from "../contextInstructions.js";
import { buildRoutingIndexPayload, routingIndexToPromptText } from "../routingIndexForWorkspace.js";

export type MailroomPlanChunk = {
  summary: string;
  suggestedDestination: "notes" | "boards" | "brainstorm" | "brand_center" | "hold" | "other";
  targetHint: string;
  rationale: string;
  confidence: number;
};

export type MailroomPlanResult = {
  executiveSummary: string;
  chunks: MailroomPlanChunk[];
};

/** One routable action from capture (step 1 — no destination yet). */
export type MailroomActionItemDecomp = {
  summary: string;
  detail: string;
};

export type MailroomDecompositionResult = {
  executiveSummary: string;
  actionItems: MailroomActionItemDecomp[];
};

function pickChunkString(r: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Model sometimes returns JSON-like prose inside string fields or wrong keys. */
function planChunksLookDefective(chunks: MailroomPlanChunk[], executiveSummary: string): boolean {
  if (chunks.length === 0) return true;
  const blob = `${executiveSummary}\n${chunks.map((c) => `${c.summary}\n${c.rationale}\n${c.targetHint}`).join("\n")}`;
  if (/"chunks"\s*:/.test(blob) || /"targetHint"\s*:/.test(blob) || /"summary"\s*:/.test(blob)) return true;
  if (chunks.length === 1 && chunks[0].summary.length > 1400) return true;
  const allEmpty = chunks.every((c) => !c.summary && !c.rationale && !c.targetHint);
  if (allEmpty) return true;
  return false;
}

/**
 * When the model returns one blob or invalid structure, split the original capture into
 * separate actionable cards (holding pen by default) so the UI can route each piece.
 */
function fallbackChunksFromCapture(capture: string): MailroomPlanChunk[] {
  const raw = capture.trim();
  if (!raw) return [];
  const parts = raw.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 12);
  const blocks = parts.length > 0 ? parts : [raw];
  return blocks.slice(0, 12).map((body, i) => {
    const nl = body.indexOf("\n");
    const firstLine = (nl === -1 ? body : body.slice(0, nl)).trim().slice(0, 280);
    const rest =
      nl === -1 ? (body.length > 280 ? body.slice(280).trim() : "") : body.slice(nl + 1).trim();
    return {
      summary: firstLine || `Capture part ${i + 1}`,
      suggestedDestination: "hold",
      targetHint: "",
      rationale:
        rest ||
        (nl === -1 && body.length > 280 ? body.slice(280).trim() : "") ||
        "Split from your capture after the routing model returned an unstructured plan. Use Route as suggested, Draft in Notebooks, or the holding pen for each part.",
      confidence: 0.35,
    };
  });
}

/** PM Agent: planning prose; no tool execution in v1. */
export async function runProjectManagerAgent(
  openai: OpenAI,
  body: {
    workspaceId?: string | null;
    message: string;
    contextText?: string;
  },
): Promise<string> {
  const msg = body.message?.trim();
  if (!msg) {
    throw new Error("MESSAGE_REQUIRED");
  }

  const { team, user } = await loadContextInstructionsForWorkspace(body.workspaceId ?? undefined);
  const { teamBlock, userBlock } = formatTeamUserBlocksForPrompt(team, user);

  let brandBlock = "";
  if (body.workspaceId) {
    try {
      const kit = await loadBrandProfileJsonForWorkspaceId(body.workspaceId);
      brandBlock = formatBrandProfileForPrompt(kit);
    } catch {
      /* ignore */
    }
  }

  const ctx = body.contextText?.trim().slice(0, 14_000) ?? "";

  const system = [
    `You are the Project Manager Agent. Facilitate agile and scrum-style planning: clarify goals, propose agendas, suggest tasks with titles and optional acceptance criteria, and call out risks. Do not invent people, assignees, or capacities not described in the context. If unknown, say what is missing.`,
    teamBlock,
    userBlock,
    brandBlock ? `## Brand kit (summary)\n${brandBlock}` : "",
    ctx ? `## Surface context (tasks/boards/calendar excerpt)\n${ctx}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const completion = await openai.chat.completions.create({
    model: chatModel("primary"),
    messages: [
      { role: "system", content: system },
      { role: "user", content: msg },
    ],
  });

  const out = completion.choices[0]?.message?.content ?? "";
  if (!out) {
    throw new Error("EMPTY_AI");
  }
  return out;
}

/** Brand Rep: review user copy against brand kit. */
export async function runBrandRepReview(
  openai: OpenAI,
  body: {
    workspaceId?: string | null;
    message: string;
  },
): Promise<string> {
  const msg = body.message?.trim();
  if (!msg) {
    throw new Error("MESSAGE_REQUIRED");
  }

  let brandBlock = "";
  if (body.workspaceId) {
    try {
      const kit = await loadBrandProfileJsonForWorkspaceId(body.workspaceId);
      brandBlock = formatBrandProfileForPrompt(kit);
    } catch {
      /* ignore */
    }
  }
  if (!brandBlock.trim()) {
    throw new Error("BRAND_KIT_REQUIRED");
  }

  const { team, user } = await loadContextInstructionsForWorkspace(body.workspaceId ?? undefined);
  const { teamBlock, userBlock } = formatTeamUserBlocksForPrompt(team, user);

  const system = [
    `You are the Brand Rep Agent. The user's PRIMARY DIALOGUE is the copy they pasted below for review — that text alone is what you critique. The brand kit is supporting context for alignment (voice, positioning, claims, audience). Suggest compliant alternatives; flag risky or unsubstantiated claims.`,
    teamBlock,
    userBlock,
    `## Brand kit\n${brandBlock}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const completion = await openai.chat.completions.create({
    model: chatModel("primary"),
    messages: [
      { role: "system", content: system },
      { role: "user", content: msg },
    ],
  });

  const out = completion.choices[0]?.message?.content ?? "";
  if (!out) {
    throw new Error("EMPTY_AI");
  }
  return out;
}

export type BrandRepCenterMode = "ask" | "consult";

export type BrandRepCenterTurnResult = {
  assistantMessage: string;
  /** Partial brand kit fields the user may apply to the editor */
  proposedProfilePatch: Record<string, unknown> | null;
};

const BRAND_CENTER_SECTION_PROMPTS: Record<string, string> = {
  discovery: `You are in DISCOVERY. Open with one broad, inviting question so the founder or marketer explains the brand in their own words: who they serve, the promise, personality, and what makes them different. Listen; you may ask ONE sharp follow-up if critical gaps remain. Offer respectful pushback if positioning sounds fuzzy or self-contradictory. When you have a workable picture, you may optionally include proposedProfilePatch with only fields you are confident about from this conversation (often identity.displayName, identity.industry, audience.summary). Leave proposedProfilePatch null if still too early.`,
  core_identity: `Focus CORE IDENTITY: display/brand name, legal name if relevant, tagline, industry/category. Ask what you still need; then propose concise kit-ready copy in proposedProfilePatch under "identity" (and only keys you are improving). Push back on generic or misleading category labels.`,
  purpose: `Focus PURPOSE: mission, vision, values (array of short strings). Ask clarifying questions; propose proposedProfilePatch with purpose and/or values when ready. Challenge empty platitudes — push for specificity.`,
  audience_positioning: `Focus AUDIENCE & POSITIONING: ideal customer summary, segments/personas, geography, market category, differentiators, competitors. Use industry expertise. proposedProfilePatch may include audience, positioning.`,
  voice_tone: `Focus VOICE & TONE: personality, do/don't lists, vocabulary. proposedProfilePatch uses key "voice". Be opinionated about tone that fits the audience.`,
  visual_system: `Focus VISUAL SYSTEM: primary/secondary/accent hex colors if they have them, typography notes. Never invent logoPrimaryDataUrl or image data — text only. proposedProfilePatch uses key "visual".`,
  goals_outcomes: `Focus GOALS & OUTCOMES: business goals, marketing goals, metrics. proposedProfilePatch uses key "goals".`,
  messaging_proof: `Focus MESSAGING & PROOF: key messages/pillars, proof points, origin narrative, social proof. proposedProfilePatch may include messaging and/or story.`,
  channels_legal: `Focus CHANNELS & LEGAL: channels string, trademark/usage notes, disclaimers. proposedProfilePatch may include channels (string), legal.`,
  assets_logos: `Focus LOGOS & IMAGERY: logo usage notes, secondary lockup notes, photography direction — text only, no binary. proposedProfilePatch uses key "assets" without logoPrimaryDataUrl.`,
  other_considerations: `Focus OTHER BRAND CONSIDERATIONS: a catch-all for sensitivities (topics to avoid), stakeholder politics, naming constraints, partnerships/co-brand rules, regulatory or industry nuances, internal vocabulary, or anything that should influence messaging but does not fit other kit sections. Ask what else matters; propose proposedProfilePatch with top-level key "otherBrandConsiderations" (one cohesive string, bullet lines OK).`,
  recap: `You are in RECAP. Summarize what was captured, call out any remaining risks or inconsistencies, and remind them to Save brand kit. proposedProfilePatch should be null unless fixing a small obvious error.`,
};

function sanitizeBrandProfilePatch(patch: unknown): Record<string, unknown> | null {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return null;
  const o = { ...(patch as Record<string, unknown>) };
  if (o.assets && typeof o.assets === "object" && !Array.isArray(o.assets)) {
    const a = { ...(o.assets as Record<string, unknown>) };
    delete a.logoPrimaryDataUrl;
    o.assets = a;
  }
  return o;
}

/**
 * Brand Center sheet: Q&A or guided consultation with optional partial kit proposals (JSON).
 */
export async function runBrandRepCenterSession(
  openai: OpenAI,
  body: {
    workspaceId: string;
    mode: BrandRepCenterMode;
    consultSectionId: string;
    userMessage: string;
    transcript: string;
    brandProfileDraft?: unknown;
  },
): Promise<BrandRepCenterTurnResult> {
  const wsId = body.workspaceId?.trim();
  if (!wsId) {
    throw new Error("WORKSPACE_REQUIRED");
  }

  let savedKitBlock = "";
  try {
    const kit = await loadBrandProfileJsonForWorkspaceId(wsId);
    savedKitBlock = formatBrandProfileForPrompt(kit);
  } catch {
    /* empty kit ok */
  }

  const { team, user } = await loadContextInstructionsForWorkspace(wsId);
  const { teamBlock, userBlock } = formatTeamUserBlocksForPrompt(team, user);

  const draftJson =
    body.brandProfileDraft !== undefined && body.brandProfileDraft !== null
      ? JSON.stringify(body.brandProfileDraft).slice(0, 24_000)
      : "{}";

  const sectionKey = BRAND_CENTER_SECTION_PROMPTS[body.consultSectionId] ? body.consultSectionId : "discovery";
  const sectionDirective = BRAND_CENTER_SECTION_PROMPTS[sectionKey] ?? BRAND_CENTER_SECTION_PROMPTS.discovery;

  const isAsk = body.mode === "ask";
  const systemParts = [
    `You are the Brand Rep Agent — a senior brand strategist and creative director. You know brand strategy, positioning, naming, narrative, voice, visual identity basics, and go-to-market context across B2B and consumer categories.`,
    `PRIMARY DIALOGUE for this session: Brand Center — the full brand kit the user is editing on that page (JSON draft of all fields below, plus the chat transcript). Treat that kit as the substantive workspace you are helping shape. Do not assume visibility into other apps (boards, captures, notes) unless the user pastes them into the conversation.`,
    `You are direct, expert, and constructive. When the user is vague or off-strategy, say so and explain why; offer a sharper alternative.`,
    isAsk
      ? `Mode: OPEN Q&A. Answer the user's question about brand development, this workspace, or their kit. Do not output proposedProfilePatch — set it to null always.`
      : `Mode: GUIDED CONSULTATION. Current section: "${sectionKey}".\n${sectionDirective}`,
    `Output JSON ONLY with this exact shape: {"assistantMessage":"string","proposedProfilePatch":null or object}`,
    `Rules for proposedProfilePatch (consult mode only):`,
    `- Only include keys you intend to set: identity, purpose, values, audience, positioning, voice, visual, goals, messaging, story, channels, legal, assets, otherBrandConsiderations (string) — nested object partials are OK where applicable.`,
    `- Strings must be kit-ready (concise, professional). Do not include logoPrimaryDataUrl or any base64.`,
    `- If you are only asking questions or need more input, set proposedProfilePatch to null.`,
    teamBlock,
    userBlock,
    savedKitBlock ? `## Saved brand kit on server (authoritative baseline)\n${savedKitBlock}` : `## Saved brand kit on server: (empty — you are helping build it from conversation.)`,
    `## Current draft in the editor (JSON — may differ from saved kit; prefer improving this when proposing patches)\n${draftJson}`,
  ];

  const system = systemParts.filter(Boolean).join("\n\n").trim();

  const userMsg = [
    body.transcript.trim() ? `## Conversation so far\n${body.transcript.trim().slice(0, 12_000)}` : "",
    `## Latest user message\n${body.userMessage.trim().slice(0, 8_000) || "(no message)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: chatModel("primary"),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  if (!raw) {
    throw new Error("EMPTY_AI");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("BAD_JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("BAD_JSON");
  }
  const o = parsed as Record<string, unknown>;
  const assistantMessage =
    typeof o.assistantMessage === "string" && o.assistantMessage.trim()
      ? o.assistantMessage.trim()
      : "I could not format a reply. Please try again with a bit more detail.";

  let proposed: Record<string, unknown> | null = null;
  if (!isAsk && o.proposedProfilePatch !== null && o.proposedProfilePatch !== undefined) {
    proposed = sanitizeBrandProfilePatch(o.proposedProfilePatch);
    if (proposed && Object.keys(proposed).length === 0) proposed = null;
  }

  return { assistantMessage, proposedProfilePatch: proposed };
}

/** Mail Clerk: propose how to split inbound capture across destinations using workspace routing index. */
export async function runMailroomRoutingPlan(
  openai: OpenAI,
  body: {
    workspaceId?: string | null;
    capture: string;
    instruction?: string;
  },
): Promise<MailroomPlanResult> {
  const capture = body.capture?.trim();
  if (!capture) {
    throw new Error("CAPTURE_REQUIRED");
  }
  const wsId = body.workspaceId;
  if (!wsId) {
    throw new Error("WORKSPACE_REQUIRED");
  }

  const idx = await buildRoutingIndexPayload(wsId);
  if (!idx) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }
  const indexText = routingIndexToPromptText(idx);

  const { team, user } = await loadContextInstructionsForWorkspace(wsId);
  const { teamBlock, userBlock } = formatTeamUserBlocksForPrompt(team, user);

  let brandBlock = "";
  try {
    const kit = await loadBrandProfileJsonForWorkspaceId(wsId);
    brandBlock = formatBrandProfileForPrompt(kit);
  } catch {
    /* ignore */
  }

  const instruction = body.instruction?.trim().slice(0, 4000) ?? "";

  const system = [
    `You are the Mail Clerk routing planner. Given raw capture text and a workspace routing index (boards, lists, notebook folders, brainstorm sessions), output a JSON object ONLY with shape:`,
    `{"executiveSummary":"string","chunks":[{"summary":"string","suggestedDestination":"notes|boards|brainstorm|brand_center|hold|other","targetHint":"string","rationale":"string","confidence":0.0}]}`,
    `Rules:`,
    `- Put ONE distinct actionable item or topic per chunks[] entry (e.g. separate legal review, notarization, and drafting if they are separate actions). Prefer multiple chunks when the capture lists several tasks or deadlines.`,
    `- executiveSummary: at most 2 short sentences. Plain English only. Never paste JSON, schema, or key names inside executiveSummary or inside summary/rationale.`,
    `- summary: one short human-readable title for that chunk (not JSON). rationale: why this destination fits. targetHint: cite index ids in brackets when possible (e.g. [board:...]).`,
    `- suggestedDestination: best fit; use "hold" when unclear. confidence: 0–1. Do not invent ids not in the index.`,
    `Example (shape only): {"executiveSummary":"Split legal vs ops tasks.","chunks":[{"summary":"Operating agreement legal review","suggestedDestination":"boards","targetHint":"[board:abc123]","rationale":"Tracked work item.","confidence":0.82},{"summary":"Notarization deadline","suggestedDestination":"notes","targetHint":"[folder:def456]","rationale":"Reference + deadline note.","confidence":0.7}]}`,
    teamBlock,
    userBlock,
    brandBlock ? `## Brand kit (summary)\n${brandBlock}` : "",
    `## Workspace routing index\n${indexText}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const userMsg = [
    "## Capture to route",
    capture,
    instruction ? `## Operator instruction\n${instruction}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: chatModel("primary"),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  if (!raw) {
    throw new Error("EMPTY_AI");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("BAD_JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("BAD_JSON");
  }
  const o = parsed as Record<string, unknown>;
  let executiveSummary = typeof o.executiveSummary === "string" ? o.executiveSummary.trim() : "";
  const chunksRaw = o.chunks;
  const chunks: MailroomPlanChunk[] = [];
  if (Array.isArray(chunksRaw)) {
    for (const c of chunksRaw) {
      if (!c || typeof c !== "object") continue;
      const r = c as Record<string, unknown>;
      const suggestedDestination = r.suggestedDestination;
      const dest =
        suggestedDestination === "notes" ||
        suggestedDestination === "boards" ||
        suggestedDestination === "brainstorm" ||
        suggestedDestination === "brand_center" ||
        suggestedDestination === "hold" ||
        suggestedDestination === "other"
          ? suggestedDestination
          : "other";
      const conf = typeof r.confidence === "number" && Number.isFinite(r.confidence) ? r.confidence : 0.5;
      const summary = pickChunkString(r, ["summary", "title", "heading", "name"]);
      const rationale = pickChunkString(r, ["rationale", "reasoning", "reason", "explanation"]);
      const targetHint = pickChunkString(r, ["targetHint", "target", "destinationHint", "routeHint"]);
      if (!summary && !rationale && !targetHint) continue;
      chunks.push({
        summary,
        suggestedDestination: dest,
        targetHint,
        rationale,
        confidence: Math.min(1, Math.max(0, conf)),
      });
    }
  }

  const defective = planChunksLookDefective(chunks, executiveSummary);
  const finalChunks = defective ? fallbackChunksFromCapture(capture) : chunks;
  if (defective) {
    executiveSummary =
      "The routing model returned an unstructured plan, so your capture was split into separate parts below. Assign each part with Route as suggested, Draft in Notebooks, or the holding pen—or generate a new plan.";
  }

  return {
    executiveSummary: executiveSummary || "Routing plan generated.",
    chunks: finalChunks,
  };
}

function decompositionLooksDefective(items: MailroomActionItemDecomp[], executiveSummary: string): boolean {
  if (items.length === 0) return true;
  const blob = `${executiveSummary}\n${items.map((a) => `${a.summary}\n${a.detail}`).join("\n")}`;
  if (/"actionItems"\s*:/.test(blob) || /"summary"\s*:/.test(blob)) return true;
  const allEmpty = items.every((a) => !a.summary.trim() && !a.detail.trim());
  if (allEmpty) return true;
  return false;
}

function fallbackActionItemsFromCapture(capture: string): MailroomActionItemDecomp[] {
  const raw = capture.trim();
  if (!raw) return [];
  const parts = raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 8);
  const blocks = parts.length > 0 ? parts : [raw];
  return blocks.slice(0, 16).map((body) => {
    const nl = body.indexOf("\n");
    const summary = ((nl === -1 ? body : body.slice(0, nl)).trim().slice(0, 220) || "Capture part").trim();
    const detail = (nl === -1 ? "" : body.slice(nl + 1).trim()).slice(0, 8000);
    return { summary, detail };
  });
}

/**
 * Mail Clerk step 1: list every distinct actionable / routable piece from capture (no destinations).
 */
export async function runMailroomCaptureDecomposition(
  openai: OpenAI,
  body: {
    workspaceId?: string | null;
    capture: string;
    instruction?: string;
  },
): Promise<MailroomDecompositionResult> {
  const capture = body.capture?.trim();
  if (!capture) {
    throw new Error("CAPTURE_REQUIRED");
  }
  const wsId = body.workspaceId;
  if (!wsId) {
    throw new Error("WORKSPACE_REQUIRED");
  }

  const { team, user } = await loadContextInstructionsForWorkspace(wsId);
  const { teamBlock, userBlock } = formatTeamUserBlocksForPrompt(team, user);
  const instruction = body.instruction?.trim().slice(0, 4000) ?? "";

  const system = [
    `You are the Mail Clerk capture analyst. The user will paste unstructured capture text. Your ONLY job is to enumerate EVERY distinct actionable item, task, follow-up, decision, or topic that could be routed separately — be exhaustive; do not merge unrelated actions.`,
    `Do NOT assign destinations, boards, folders, or confidence. Do not output routing hints.`,
    `Output JSON ONLY with shape:`,
    `{"executiveSummary":"string","actionItems":[{"summary":"string","detail":"string"}]}`,
    `Rules:`,
    `- executiveSummary: at most 2 sentences describing what you extracted (plain English, no JSON inside it).`,
    `- actionItems: ordered list. Each entry is one routable unit.`,
    `- summary: short title (one line). detail: supporting context, bullets, or remainder text (can be empty).`,
    `- Split combined lines into separate items when they are clearly different actions (e.g. "Email client" vs "Update contract").`,
    `- If the capture is a single coherent note with no separable actions, return exactly one actionItem.`,
    `- Cap at 24 actionItems; if more exist, merge the smallest related ones.`,
    teamBlock,
    userBlock,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const userMsg = [
    "## Capture text",
    capture,
    instruction ? `## Operator instruction\n${instruction}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: chatModel("primary"),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  if (!raw) {
    throw new Error("EMPTY_AI");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("BAD_JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("BAD_JSON");
  }
  const o = parsed as Record<string, unknown>;
  let executiveSummary = typeof o.executiveSummary === "string" ? o.executiveSummary.trim() : "";
  const itemsRaw = o.actionItems;
  const actionItems: MailroomActionItemDecomp[] = [];
  if (Array.isArray(itemsRaw)) {
    for (const it of itemsRaw) {
      if (!it || typeof it !== "object") continue;
      const r = it as Record<string, unknown>;
      const summary = pickChunkString(r, ["summary", "title", "heading", "name"]);
      const detail = pickChunkString(r, ["detail", "body", "description", "notes", "text"]);
      const single = pickChunkString(r, ["item", "action"]);
      if (!summary && !detail && single) {
        actionItems.push({ summary: single.slice(0, 280), detail: "" });
        continue;
      }
      if (!summary && !detail) continue;
      actionItems.push({
        summary: summary.slice(0, 400),
        detail: detail.slice(0, 8000),
      });
    }
  }

  const defective = decompositionLooksDefective(actionItems, executiveSummary);
  const finalItems = defective ? fallbackActionItemsFromCapture(capture) : actionItems;
  if (defective) {
    executiveSummary =
      "The model could not list actions cleanly, so the capture was split into parts below. Edit or deselect rows, then run Assign destinations.";
  }

  return {
    executiveSummary: executiveSummary || "Actions extracted from capture.",
    actionItems: finalItems,
  };
}

function alignPlanChunksToActionItems(
  items: MailroomActionItemDecomp[],
  rawChunks: MailroomPlanChunk[],
): MailroomPlanChunk[] {
  return items.map((item, i) => {
    const c = rawChunks[i];
    if (c) {
      return {
        ...c,
        summary: c.summary?.trim() || item.summary,
      };
    }
    return {
      summary: item.summary,
      suggestedDestination: "hold",
      targetHint: "",
      rationale:
        "Mail Clerk did not return a routing row for this action; defaulting to holding pen — adjust in Rapid Router.",
      confidence: 0.35,
    };
  });
}

/**
 * Mail Clerk step 2: assign destinations for a fixed list of actions (same order as input).
 */
export async function runMailroomRouteSelectedItems(
  openai: OpenAI,
  body: {
    workspaceId?: string | null;
    actionItems: MailroomActionItemDecomp[];
    instruction?: string;
    originalCapture?: string;
  },
): Promise<MailroomPlanResult> {
  const items = body.actionItems ?? [];
  if (items.length === 0) {
    throw new Error("ACTION_ITEMS_REQUIRED");
  }
  const wsId = body.workspaceId;
  if (!wsId) {
    throw new Error("WORKSPACE_REQUIRED");
  }

  const idx = await buildRoutingIndexPayload(wsId);
  if (!idx) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }
  const indexText = routingIndexToPromptText(idx);

  const { team, user } = await loadContextInstructionsForWorkspace(wsId);
  const { teamBlock, userBlock } = formatTeamUserBlocksForPrompt(team, user);

  let brandBlock = "";
  try {
    const kit = await loadBrandProfileJsonForWorkspaceId(wsId);
    brandBlock = formatBrandProfileForPrompt(kit);
  } catch {
    /* ignore */
  }

  const instruction = body.instruction?.trim().slice(0, 4000) ?? "";
  const original = body.originalCapture?.trim().slice(0, 12_000) ?? "";

  const numbered = items
    .map((a, i) => {
      const d = a.detail?.trim() ? `\n   detail: ${a.detail.trim()}` : "";
      return `${i + 1}. summary: ${a.summary.trim()}${d}`;
    })
    .join("\n\n");

  const system = [
    `You are the Mail Clerk routing planner. You are given a FIXED ordered list of ${items.length} actions (numbered 1..${items.length}).`,
    `Output JSON ONLY with shape:`,
    `{"executiveSummary":"string","chunks":[{"summary":"string","suggestedDestination":"notes|boards|brainstorm|brand_center|hold|other","targetHint":"string","rationale":"string","confidence":0.0}]}`,
    `CRITICAL: chunks.length MUST equal exactly ${items.length}. chunks[k] MUST describe the routing for action item number k+1 only (same order). Never merge or drop items.`,
    `- executiveSummary: at most 2 short sentences summarizing how you routed the batch.`,
    `- summary in each chunk: short label echoing that action (may match the action summary).`,
    `- suggestedDestination, targetHint (bracket ids from index when possible), rationale, confidence as in the standard mail clerk rules.`,
    `- Use "hold" when unclear. Do not invent ids not in the index.`,
    teamBlock,
    userBlock,
    brandBlock ? `## Brand kit (summary)\n${brandBlock}` : "",
    `## Workspace routing index\n${indexText}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const userMsg = [
    "## Numbered actions to route (preserve order in chunks[])",
    numbered,
    original ? `## Original full capture (context only)\n${original}` : "",
    instruction ? `## Operator instruction\n${instruction}` : "",
  ]
    .filter(Boolean)
    .join("\n\n\n");

  const completion = await openai.chat.completions.create({
    model: chatModel("primary"),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  if (!raw) {
    throw new Error("EMPTY_AI");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("BAD_JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("BAD_JSON");
  }
  const o = parsed as Record<string, unknown>;
  let executiveSummary = typeof o.executiveSummary === "string" ? o.executiveSummary.trim() : "";
  const chunksRaw = o.chunks;
  const rawChunks: MailroomPlanChunk[] = [];
  if (Array.isArray(chunksRaw)) {
    for (const c of chunksRaw) {
      if (!c || typeof c !== "object") continue;
      const r = c as Record<string, unknown>;
      const suggestedDestination = r.suggestedDestination;
      const dest =
        suggestedDestination === "notes" ||
        suggestedDestination === "boards" ||
        suggestedDestination === "brainstorm" ||
        suggestedDestination === "brand_center" ||
        suggestedDestination === "hold" ||
        suggestedDestination === "other"
          ? suggestedDestination
          : "other";
      const conf = typeof r.confidence === "number" && Number.isFinite(r.confidence) ? r.confidence : 0.5;
      const summary = pickChunkString(r, ["summary", "title", "heading", "name"]);
      const rationale = pickChunkString(r, ["rationale", "reasoning", "reason", "explanation"]);
      const targetHint = pickChunkString(r, ["targetHint", "target", "destinationHint", "routeHint"]);
      if (!summary && !rationale && !targetHint) continue;
      rawChunks.push({
        summary,
        suggestedDestination: dest,
        targetHint,
        rationale,
        confidence: Math.min(1, Math.max(0, conf)),
      });
    }
  }

  const aligned = alignPlanChunksToActionItems(items, rawChunks);
  const defective = planChunksLookDefective(aligned, executiveSummary);
  const finalChunks = defective
    ? items.map((item) => ({
        summary: item.summary,
        suggestedDestination: "hold" as const,
        targetHint: "",
        rationale:
          "Routing model output was unclear; this part defaults to the holding pen — pick a destination in Rapid Router.",
        confidence: 0.35,
      }))
    : aligned;

  if (defective) {
    executiveSummary =
      "Routing suggestions were repaired: each selected action is listed below with a safe default; adjust destinations before approving.";
  }

  return {
    executiveSummary: executiveSummary || "Routing plan for selected actions.",
    chunks: finalChunks,
  };
}

/**
 * Mail Clerk–style notebook autotag: choose existing workspace tags using the routing index
 * (notebooks, boards, recent notes, etc.) plus the note body. Does not invent new tag names.
 */
export async function runMailClerkNotebookAutotag(
  openai: OpenAI,
  body: {
    workspaceId: string;
    noteTitle: string;
    notePlainText: string;
    /** Current tag names on the note */
    tagsOnNoteNames: string[];
    /** All workspace tags (names only; order preserved) */
    tagVocabulary: { name: string }[];
  },
): Promise<string[]> {
  if (!body.tagVocabulary.length) {
    return [];
  }

  const idx = await buildRoutingIndexPayload(body.workspaceId);
  const routingBlurb = idx ? routingIndexToPromptText(idx).slice(0, 14_000) : "(Workspace index unavailable.)";

  const { team, user } = await loadContextInstructionsForWorkspace(body.workspaceId);
  const { teamBlock, userBlock } = formatTeamUserBlocksForPrompt(team, user);

  const vocabLines = body.tagVocabulary.map((t) => `- ${t.name}`);
  const system = [
    `You are the Mail Clerk's notebook autotag assistant for this workspace.`,
    `Pick tags that already exist in the workspace so this note is discoverable next to related work across notebooks, boards, and brainstorms.`,
    `Rules:`,
    `- Reply with JSON ONLY: {"tags":["tag-a","tag-b"]} with at most 8 entries.`,
    `- Every string in "tags" MUST be one of the vocabulary names below (identical spelling; you may match case-insensitively but output must use the exact casing from the list).`,
    `- Use the workspace activity index to infer cross-cutting themes (e.g. recurring project names, board areas). Do not invent tag names.`,
    `- Prefer precision over volume: omit weak fits. Tags already on the note may appear again only if still strongly relevant.`,
    teamBlock,
    userBlock,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const userMsg = [
    "## Workspace activity index (topics across the app — context only)",
    routingBlurb,
    "",
    "## Allowed tag vocabulary (choose ONLY from these names)",
    vocabLines.join("\n"),
    "",
    "## Note title",
    body.noteTitle || "(untitled)",
    "",
    "## Note body (plain text)",
    body.notePlainText.slice(0, 14_000) || "(empty)",
    "",
    "## Tags already on this note",
    body.tagsOnNoteNames.length ? body.tagsOnNoteNames.map((t) => `- ${t}`).join("\n") : "(none)",
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model: chatModel("mini"),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    temperature: 0.35,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const o = parsed as Record<string, unknown>;
  const arr = Array.isArray(o.tags) ? o.tags : [];
  const canonByLower = new Map(body.tagVocabulary.map((t) => [t.name.toLowerCase(), t.name]));
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item !== "string") continue;
    const n = item.replace(/^#/, "").trim();
    if (!n) continue;
    const canon = canonByLower.get(n.toLowerCase());
    if (canon) out.push(canon);
  }
  return [...new Set(out)].slice(0, 8);
}
