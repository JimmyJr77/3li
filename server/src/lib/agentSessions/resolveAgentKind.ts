import {
  AGENT_KIND_BRAND_REP,
  AGENT_KIND_MAIL_CLERK,
  AGENT_KIND_PROJECT_MANAGER,
} from "./constants.js";

/** Map /api/ai/agent surface + agentId to hub agentKind, or null if we do not log this surface. */
export function agentKindForAgentSurface(_agentId: string | undefined, surfaceType: string): string | null {
  const surface = surfaceType ?? "";
  if (surface === "task_popup" || surface === "generic") {
    return AGENT_KIND_PROJECT_MANAGER;
  }
  if (surface === "brand_rep_review" || surface === "brand_rep_center") {
    return AGENT_KIND_BRAND_REP;
  }
  if (surface === "mail_clerk_decompose" || surface === "mail_clerk_route" || surface === "mail_clerk_plan") {
    return AGENT_KIND_MAIL_CLERK;
  }
  if (surface === "brainstorm") {
    return null;
  }
  return null;
}
