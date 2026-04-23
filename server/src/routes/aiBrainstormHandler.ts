import { formatBrandProfileForPrompt } from "../lib/brandProfileFormat.js";
import { loadBrandProfileJsonForWorkspaceId } from "../lib/brandProfileFromWorkspace.js";
import {
  brainstormPersonaAddonForAgentId,
  mapAgentIdToBrainstormRole,
} from "../lib/openai/agentCompose.js";
import { runBrainstormAI } from "../lib/openai/orchestrator.js";
import { parseThinkingMode } from "../lib/openai/thinkingMode.js";

type BrainstormBody = {
  prompt?: string;
  mode?: unknown;
  context?: { selectedNodeSummary?: string; canvasSummary?: string; sessionPanelLog?: string };
  workspaceId?: string | null;
  agentRole?: unknown;
  /** When set (e.g. CONTEXT_BUNDLE), overrides `agentRole` mapping except explicit agentRole. */
  agentId?: unknown;
  /** Whole-board + panel synthesis: forces consultant stack on the server. */
  sessionSynthesis?: unknown;
};

export async function executeBrainstormCompletion(body: BrainstormBody): Promise<{ result: string }> {
  const { prompt, mode, context, workspaceId, agentRole, agentId } = body;
  const sessionSynthesis = body.sessionSynthesis === true;

  if (!prompt || typeof prompt !== "string") {
    throw new Error("PROMPT_REQUIRED");
  }

  const thinkingMode = parseThinkingMode(mode);
  if (!thinkingMode) {
    throw new Error("BAD_MODE");
  }

  let brandBlock = "";
  if (workspaceId && typeof workspaceId === "string") {
    const kit = await loadBrandProfileJsonForWorkspaceId(workspaceId);
    brandBlock = formatBrandProfileForPrompt(kit);
  }

  const idStr = typeof agentId === "string" ? agentId : undefined;
  let role: "consultant" | "red_team";
  let personaAddon: string | undefined;

  if (sessionSynthesis) {
    role = "consultant";
    personaAddon = undefined;
  } else {
    const mapped =
      idStr ? mapAgentIdToBrainstormRole(idStr, agentRole)
      : agentRole === "red_team" ? "red_team"
      : agentRole === "consultant" || agentRole === undefined ? "consultant"
      : null;
    if (mapped === null) {
      throw new Error("BAD_AGENT_ROLE");
    }
    role = mapped;
    personaAddon = idStr ? brainstormPersonaAddonForAgentId(idStr) : undefined;
  }

  const result = await runBrainstormAI(thinkingMode, prompt, context, brandBlock, role, {
    workspaceId: typeof workspaceId === "string" ? workspaceId : null,
    personaAddon,
    sessionSynthesis,
  });
  return { result };
}
