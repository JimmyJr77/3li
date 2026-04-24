import type { MailroomDecompositionResult, MailroomPlanResult } from "../openai/surfaceAgents.js";

export function mailLogDetail(
  surface: "mail_clerk_decompose" | "mail_clerk_route" | "mail_clerk_plan",
  decomposition?: MailroomDecompositionResult,
  plan?: MailroomPlanResult,
): Record<string, unknown> {
  if (surface === "mail_clerk_decompose" && decomposition) {
    return {
      actionItemCount: decomposition.actionItems?.length ?? 0,
    };
  }
  if (plan) {
    return {
      chunkCount: plan.chunks?.length ?? 0,
    };
  }
  return {};
}
