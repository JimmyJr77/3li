import type { OpenAI } from "openai";
import { chatModel } from "../ai/models.js";
import { coerceBrandProfilePatch } from "../brandProfilePatchCoerce.js";
import { formatBrandProfileForPrompt } from "../brandProfileFormat.js";
import { loadBrandProfileJsonForWorkspaceId } from "../brandProfileFromWorkspace.js";
import { formatTeamUserBlocksForPrompt, loadContextInstructionsForWorkspace } from "../contextInstructions.js";
import {
  buildNotebookAutotagSuggestions,
  parseNotebookAutotagModelJson,
  type NotebookAutotagVocabularyItem,
} from "../notebookLabelAutotag.js";
import {
  buildRoutingIndexPayload,
  routingIndexToPromptText,
  routingIndexToPromptTextCompactForNotebookAutotag,
} from "../routingIndexForWorkspace.js";

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
  /** Legacy; clients use kit Submit instead of in-chat verdict. Prefer false. */
  consultAwaitingVerdict: boolean;
};

const BRAND_CENTER_SECTION_PROMPTS: Record<string, string> = {
  discovery: `DISCOVERY / orientation (Brand OS). Open with one broad question: who you serve, the promise, personality, what makes you different. Also surface lightly: Is this a person brand, company, or hybrid? Founder-led? Sub-brands or programs? New vs rebrand vs established? You may ask ONE sharp follow-up if gaps are critical. Push back on fuzzy positioning. proposedProfilePatch only when confident — often identity.displayName, identity.industry, audience.summary; leave null if still too early.`,
  identity_structure: `IDENTITY & STRUCTURE. Cover: public vs legal name(s); sub-brands/verticals if any; ownership (high level); geography scope (local → global); lifecycle stage (idea → maturity). Ask only what changes the kit. proposedProfilePatch: identity (displayName, legalName, tagline, industry); optionally audience.geography for markets. No invented legal facts.`,
  purpose_mission: `PURPOSE & MISSION CORE. Why exist beyond revenue? Problem solved? Transformation for customers? What does success look like for them? Mission + 5–10y vision? What would the world lose if the brand vanished? Challenge platitudes. proposedProfilePatch: purpose (mission, vision), values (short strings).`,
  audience_positioning: `AUDIENCE & MARKET + NICHE / COMPETITIVE (merged). Primary audience (demographics + psychographics): pains, fears, desires, motivations; where they spend time; brands they trust; secondary audience; perfect vs bad-fit customer. Niche, category, direct/indirect competitors; what competitors do well / fail at; why choose you; UVP; premium vs mid vs mass (as positioning prose). proposedProfilePatch: audience, positioning.`,
  voice_comms: `BRAND DNA + VOICE & COMMS (merged). Core values / principles you will not violate; personality; “if the brand were a person” behavior; emotions to evoke vs avoid; tone (formal/conversational/etc.); words/phrases to use or ban; beginner vs expert register; humor rules. proposedProfilePatch: voice (personality, dos, donts, vocabulary); values if you are refining value statements.`,
  messaging_narrative: `MESSAGING, HOOKS & STORY (merged). Tagline or core hook; 3–5 messaging pillars; proof angles. Narrative: origin, defining moments, challenges overcome, future story, role of the customer in the story. proposedProfilePatch: identity.tagline if refining hook; messaging (keyMessages, proofPoints); story (origin, socialProof).`,
  visual_system: `VISUAL SYSTEM. Logo variations (text notes only), palette (primary/secondary/accent hex if known), typography hierarchy, photography style (e.g. lifestyle vs cinematic), overall design style (minimal/bold/corporate/edgy), iconography; visuals that are forbidden. Never output logoPrimaryDataUrl or base64. proposedProfilePatch: visual; assets.photoDirection or notes fields as text only.`,
  goals_and_metrics: `METRICS, GOALS & GROWTH DIRECTION (merged). Short-term (90d) and long-term (1–5y) goals; KPIs that matter; quantitative success vs failure signals; next milestones; markets to expand; planned offerings; constraints/resources for scale. Do not invent numbers — only capture what the user states. proposedProfilePatch: goals (business, marketing, metrics).`,
  gtm_cx: `OFFERINGS, CX, CONTENT, SALES & CONVERSION (merged). Products/services; flagship; pricing strategy (narrative, not legal advice); customer outcomes; delivery differentiation; journey stages and typical drop-offs. Channels/platforms, content types, cadence, what performs, content goals, key campaigns, paid media if any. How people convert; funnel; objections; closing patterns; ethics around scarcity/urgency/exclusivity. proposedProfilePatch: channels (string, bullet lists OK), goals (marketing/business as needed), messaging if hooks tied to conversion.`,
  partners_ecosystem_ops: `PARTNERSHIPS, ECOSYSTEM & OPERATIONAL MODEL (merged). Key partners; alliances; influencers/ambassadors; aligned orgs; partnerships that would accelerate growth. Internal: how work runs, tools/systems, standardized processes, inefficiencies, what must stay consistent across teams/locations. proposedProfilePatch: otherBrandConsiderations (primary bucket) and optionally channels for partner-facing touchpoints.`,
  governance_risk_legal: `GOVERNANCE, RISK & LEGAL (merged). Brand non-negotiables; what needs brand approval vs can decentralize; past brand mistakes; what would damage the brand long-term. Risks (financial, reputational, operational); regulatory/legal considerations the user mentions; dependencies; external shocks. Not a lawyer — capture user-stated constraints. proposedProfilePatch: legal (trademark, disclaimers), otherBrandConsiderations for governance/risk narrative.`,
  assets_logos: `LOGOS & IMAGERY (usage). Primary/secondary lockup notes, clear space, color variants, photography/illustration direction — text only, no binary. proposedProfilePatch: assets without logoPrimaryDataUrl.`,
  other_considerations: `OTHER / CATCH-ALL. Anything still missing for AI and teams: sensitivities, naming constraints, politics, co-brand rules, internal vocabulary, edge cases not captured above. proposedProfilePatch: otherBrandConsiderations (one cohesive string, bullets OK).`,
  recap: `RECAP. Summarize what was captured across the Brand OS walkthrough, flag inconsistencies or risks, remind them the kit autosaves when edited and feeds agents via the formatted brand block. proposedProfilePatch null unless fixing a small obvious error.`,
};

function sanitizeBrandProfilePatch(patch: unknown): Record<string, unknown> | null {
  let cur: unknown = patch;
  if (typeof cur === "string") {
    const t = cur.trim();
    if (!t) return null;
    try {
      cur = JSON.parse(t) as unknown;
    } catch {
      return null;
    }
  }
  if (!cur || typeof cur !== "object" || Array.isArray(cur)) return null;
  let o = { ...(cur as Record<string, unknown>) };
  if (o.assets && typeof o.assets === "object" && !Array.isArray(o.assets)) {
    const a = { ...(o.assets as Record<string, unknown>) };
    delete a.logoPrimaryDataUrl;
    o.assets = a;
  }
  o = coerceBrandProfilePatch(o);
  if (!Object.keys(o).length) return null;
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
    /** Single-kit-field walk (blank-by-blank); optional section context for related prompts */
    consultFieldId?: string | null;
    consultFieldLabel?: string | null;
    consultFieldSnippet?: string | null;
    consultFieldFilled?: boolean | null;
    /** Per-field scratch from the client; used when compiling `otherBrandConsiderations`. */
    consultScratchLog?: { fieldId: string; fieldLabel: string; note: string }[];
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

  const fieldId = typeof body.consultFieldId === "string" ? body.consultFieldId.trim() : "";
  const fieldLabel = typeof body.consultFieldLabel === "string" ? body.consultFieldLabel.trim() : "";
  const fieldSnippet =
    typeof body.consultFieldSnippet === "string" ? body.consultFieldSnippet.trim().slice(0, 4_000) : "";
  const fieldFilled = body.consultFieldFilled === true;

  const scratchLog = Array.isArray(body.consultScratchLog) ? body.consultScratchLog : [];
  const scratchLogText =
    scratchLog.length > 0
      ? scratchLog
          .map((e) => `- **${e.fieldLabel || e.fieldId}** (\`${e.fieldId}\`): ${e.note || "(no note)"}`)
          .join("\n")
          .slice(0, 8_000)
      : "";

  const isGenerateTurn = body.userMessage.trim() === "__GENERATE_FIELD__";

  const identityNameBranch =
    fieldId === "identity.displayName" || fieldId === "identity.legalName"
      ? fieldFilled
        ? `This is a **name** field with text already present. **Verify** only: ask for a brief affirmation or correction; do **not** re-run a full “what is your name?” interview.`
        : `This **name** field is empty. Ask plainly for the value; when the user answers, propose a concise \`proposedProfilePatch\` for this path only.`
      : "";

  const genericNonNameRules =
    fieldId &&
    fieldId !== "identity.displayName" &&
    fieldId !== "identity.legalName" &&
    fieldId !== "otherBrandConsiderations"
      ? [
          `If this field is **pre-filled**, review the user’s text and ask **at least one** focused follow-up that deepens **this specific field** (not a generic brand question).`,
          `Stay strictly on the **current field**. Read the full transcript and **do not repeat** a question whose intent already appears in an earlier turn of this walk.`,
          `Continue Q&A until you can propose kit-ready copy; then include it in \`proposedProfilePatch\` for this field only.`,
        ].join("\n\n")
      : "";

  const otherConsiderationsBlock =
    fieldId === "otherBrandConsiderations"
      ? scratchLogText
        ? [
            `SPECIAL — "otherBrandConsiderations" (compile from scratch + chat).`,
            `The client sent a **consult scratch log** from earlier fields (notes the user jotted while other kit fields were discussed). Treat it as authoritative context alongside the transcript and the JSON draft.`,
            `## Consult scratch log (earlier fields)\n${scratchLogText}`,
            `Your job: **compile** the scratch log + conversation + existing draft text into one cohesive \`otherBrandConsiderations\` string (bullets or short paragraphs). Merge with themes already in the draft; resolve duplicates; keep tone professional. Prefer a substantive \`proposedProfilePatch.otherBrandConsiderations\` when you can improve or extend the kit.`,
          ].join("\n\n")
        : [
            `SPECIAL — "otherBrandConsiderations" is the kit's open-ended bucket (partnerships, ops, sensitivities, naming constraints, politics, co-brand rules, internal vocabulary, risks, edge cases).`,
            `Spend **more** effort here than on a typical single line: cross-reference themes from the rest of the draft (JSON), ask follow-ups, invite examples and nuance, and help them produce a **longer, amplifying** answer (tight bullets or short paragraphs). If the text is thin or generic, push for specifics.`,
            `proposedProfilePatch: prefer a substantive \`otherBrandConsiderations\` string when you can improve or extend what they have; still null if you only need more input first.`,
          ].join("\n\n")
      : "";

  const fieldByFieldGenerateBlock =
    fieldId && fieldLabel && isGenerateTurn
      ? [
          `FIELD-BY-FIELD — **GENERATE** for this field only (\`${fieldId}\`, "${fieldLabel}"). Latest user message: \`__GENERATE_FIELD__\`.`,
          `The UI **merges your \`proposedProfilePatch\` into the working draft immediately** after this response — this turn is for **materializing kit text**, not conversation.`,
          `**Do not ask the user anything** — no clarifying questions, no follow-up prompts, no numbered lists of questions. **assistantMessage**: at most **2 short sentences** stating what you placed in the patch (or that you inferred from context).`,
          `**First choice:** If your **immediately previous assistant message** already contained concrete suggested wording for this field (even informal), convert it into a valid, nested \`proposedProfilePatch\` for **this field only** (polish; preserve intent).`,
          `**Otherwise:** Produce the best defensible kit-ready \`proposedProfilePatch\` for this field from the transcript, JSON draft, and saved kit — **infer** rather than asking for more input.`,
          `\`proposedProfilePatch\` must be **non-null** whenever any reasonable kit-ready value can be justified from context. Use null only if the field value is literally unknowable from everything provided.`,
          fieldId === "otherBrandConsiderations" && scratchLogText
            ? `## Consult scratch log\n${scratchLogText}\nFold relevant scratch lines into \`otherBrandConsiderations\` in the patch.`
            : fieldId === "otherBrandConsiderations"
              ? `For \`otherBrandConsiderations\`, output a substantive string from chat + draft even when thin — still no questions to the user.`
              : "",
          `**consultAwaitingVerdict** must be **false**.`,
          `Related Brand OS section (tone only): ${sectionDirective}`,
          fieldSnippet
            ? `## Current value in their working draft for this field\n${fieldSnippet}`
            : `## Current value in their working draft for this field\n(empty)`,
        ]
          .filter(Boolean)
          .join("\n\n")
      : "";

  const fieldByFieldBlock =
    fieldId && fieldLabel
      ? isGenerateTurn
        ? fieldByFieldGenerateBlock
        : [
            `FIELD-BY-FIELD CONSULTATION (one kit field only). The user works through the kit in order; you must stay on the single current field.`,
            `SCOPE: Do **not** steer this walk toward visual identity (hex colors, typography, layout), logo lockups or usage mechanics, photography/illustration direction, or any binary/logo assets — users refine those directly in Brand Center. Stay on strategy, audience, narrative, voice, goals, channels, legal text, and the catch-all field.`,
            `Current field id (kit path): "${fieldId}". Human label: "${fieldLabel}".`,
            fieldFilled
              ? `This field is **pre-filled** in their draft. Use their text to ask sharper questions: refine, deepen, challenge gently, or help them articulate more clearly.`
              : `This field is **empty** in their draft. Collaborate with the user to develop a strong answer through questions; then propose concise kit-ready text when appropriate.`,
            identityNameBranch,
            genericNonNameRules,
            otherConsiderationsBlock,
            `proposedProfilePatch: include only keys relevant to THIS field (partial nested objects OK). Use null if you are only asking questions or no concrete change yet.`,
            `**consultAwaitingVerdict** must be **false** on every turn. The user approves copy with **Submit to Brand Center** in the UI (not Accept / Try again / Skip in chat).`,
            `Related Brand OS section context (for tone only; stay scoped to this one field): ${sectionDirective}`,
            fieldSnippet
              ? `## Current value in their working draft for this field\n${fieldSnippet}`
              : `## Current value in their working draft for this field\n(empty)`,
          ]
            .filter(Boolean)
            .join("\n\n")
        : "";

  const isAsk = body.mode === "ask";
  const systemParts = [
    `You are the Brand Rep Agent — a senior brand strategist and creative director. You know brand strategy, positioning, naming, narrative, voice, visual identity basics, and go-to-market context across B2B and consumer categories.`,
    `PRIMARY DIALOGUE for this session: Brand Center — the full brand kit the user is editing on that page (JSON draft of all fields below, plus the chat transcript). Treat that kit as the substantive workspace you are helping shape. Do not assume visibility into other apps (boards, captures, notes) unless the user pastes them into the conversation.`,
    `You are direct, expert, and constructive. When the user is vague or off-strategy, say so and explain why; offer a sharper alternative.`,
    isAsk
      ? `Mode: OPEN Q&A. Answer the user's question about brand development, this workspace, or their kit. Do not output proposedProfilePatch — set it to null always. consultAwaitingVerdict must be false or omitted.`
      : fieldByFieldBlock
        ? `Mode: GUIDED CONSULTATION — FIELD-BY-FIELD.\n\n${fieldByFieldBlock}`
        : `Mode: GUIDED CONSULTATION (legacy section-wide). Current section: "${sectionKey}".\n${sectionDirective}`,
    `Output JSON ONLY with this exact shape: {"assistantMessage":"string","proposedProfilePatch":null or object,"consultAwaitingVerdict":false}`,
    `Rules for proposedProfilePatch (consult mode only):`,
    `- Only include keys you intend to set: identity, purpose, values, audience, positioning, voice, visual, goals, messaging, story, channels, legal, assets, otherBrandConsiderations (string) — nested object partials are OK where applicable.`,
    `- Nest fields correctly: e.g. mission and vision go under "purpose" (not top-level); displayName under "identity". Wrong shapes may be dropped on apply.`,
    `- Strings must be kit-ready (concise, professional). Do not include logoPrimaryDataUrl or any base64.`,
    !isAsk && isGenerateTurn && fieldId
      ? `- **GENERATE (\`__GENERATE_FIELD__\`):** \`proposedProfilePatch\` must be non-null whenever a defensible kit value exists; prioritize crystallizing your **last assistant turn’s concrete suggestion** into valid patch shape. \`assistantMessage\`: no questions to the user. Null only if the field is unknowable from all context.`
      : !isAsk
        ? `- If you are only asking questions or need more input, set proposedProfilePatch to null.`
        : null,
    `- consultAwaitingVerdict: always **false** in consult mode (field-by-field or legacy).`,
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

  const consultAwaitingVerdict = false;

  return { assistantMessage, proposedProfilePatch: proposed, consultAwaitingVerdict };
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

export type NotebookAutotagLlmResult = {
  themes: string[];
  suggestions: { name: string; match: { kind: "board" | "user"; id: string; color: string } | null }[];
};

const NOTEBOOK_BODY_PROMPT_CHARS = 24_000;

/**
 * Theme-first notebook autotag: model returns themes + reuseExisting (verbatim vocab) + proposeNew;
 * server validates, reconciles near-misses to existing labels, and returns suggestion rows for the client.
 */
export async function runMailClerkNotebookAutotag(
  openai: OpenAI,
  body: {
    workspaceId: string;
    noteTitle: string;
    notePlainText: string;
    labelsOnNoteNames: string[];
    vocabularyItems: NotebookAutotagVocabularyItem[];
  },
): Promise<NotebookAutotagLlmResult> {
  const idx = await buildRoutingIndexPayload(body.workspaceId);
  const routingBlurb = idx
    ? routingIndexToPromptTextCompactForNotebookAutotag(idx)
    : "(Workspace index unavailable.)";

  const { team, user } = await loadContextInstructionsForWorkspace(body.workspaceId);
  const { teamBlock, userBlock } = formatTeamUserBlocksForPrompt(team, user);

  const vocabLines =
    body.vocabularyItems.length > 0
      ? body.vocabularyItems.map((t) => t.lineForPrompt)
      : ["(none — you may still propose a few new short labels from the note only.)"];

  const system = [
    `You are the Mail Clerk notebook label assistant. The ACTIVE NOTE is the primary source of truth.`,
    `Your job:`,
    `1) Read the note title and body. List 3–7 key themes as short phrases in "themes" (derive only from the note; if the body is empty, themes may only reference the title).`,
    `2) In "reuseExisting", list up to 6 labels from the provided vocabulary lines whose EXACT printed name you are copying verbatim (same spelling and casing as the line shows). Only include a reuse when a theme clearly supports it.`,
    `3) In "proposeNew", list up to 4 NEW label names only when a theme is important and not adequately covered by any reuse. Prefer an empty "proposeNew" when a reuse fits. New names: concise (words, Title Case, or kebab-case), no sentences.`,
    `4) Do not duplicate the same concept in reuse and proposeNew.`,
    `Reply with JSON ONLY in this exact shape:`,
    `{"themes":["…"],"reuseExisting":["Exact Vocab Name"],"proposeNew":["…"]}`,
    `Use [] for any array that has no items.`,
    teamBlock,
    userBlock,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const noteBody = body.notePlainText.slice(0, NOTEBOOK_BODY_PROMPT_CHARS) || "(empty)";

  const userMsg = [
    "## Active note (PRIMARY — read this first)",
    "### Title",
    body.noteTitle || "(untitled)",
    "",
    "### Body (plain text)",
    noteBody,
    "",
    "## Labels already on this note",
    body.labelsOnNoteNames.length ? body.labelsOnNoteNames.map((t) => `- ${t}`).join("\n") : "(none)",
    "",
    "## Existing labels for this brand (reuse only when themes justify; copy names exactly as shown)",
    vocabLines.join("\n"),
    "",
    "## Workspace context (secondary — for naming alignment only)",
    routingBlurb,
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model: chatModel("primary"),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  const { themes, reuseExisting, proposeNew } = parseNotebookAutotagModelJson(raw);
  const suggestions = buildNotebookAutotagSuggestions(body.vocabularyItems, reuseExisting, proposeNew);
  return { themes, suggestions };
}
