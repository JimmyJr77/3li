import type { BrainstormAgentRole } from "./brainstormPrompts.js";

/** Canonical ids aligned with docs/integrations/CONTEXT_BUNDLE.md */
export type CanonicalAgentId =
  | "consultant"
  | "ai_consultant"
  | "brand_rep"
  | "red_team"
  | "mail_clerk"
  | "notebook_linking"
  | "project_manager";

export const BRAND_REP_BRAINSTORM_ADDON = `Brand Rep Agent overlay: treat the brand kit as authoritative for voice, positioning, and client-facing claims; flag messaging risks and suggest compliant alternatives.`;

export function mapAgentIdToBrainstormRole(
  agentId: string,
  agentRole?: unknown,
): BrainstormAgentRole | null {
  if (agentRole === "red_team") return "red_team";
  if (agentRole === "consultant") return "consultant";
  if (agentId === "red_team") return "red_team";
  if (agentId === "ai_consultant" || agentId === "consultant") return "consultant";
  if (agentId === "brand_rep") return "consultant";
  return null;
}

export function brainstormPersonaAddonForAgentId(agentId: string): string | undefined {
  if (agentId === "brand_rep") {
    return BRAND_REP_BRAINSTORM_ADDON;
  }
  return undefined;
}
