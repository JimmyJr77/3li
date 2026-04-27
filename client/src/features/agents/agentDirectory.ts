import type { LucideIcon } from "lucide-react";
import { Bot, Goal, Lightbulb, Mail, MessageSquare, Users } from "lucide-react";

/** Hub keys — must match server `agentKind` for logged sessions (except `consultant`). */
export type AgentHubKind =
  | "consultant"
  | "brand_rep"
  | "project_manager"
  | "advisor_agents"
  | "brainstorm_ai"
  | "mail_clerk";

export type AgentSessionSource = "chat_threads" | "agent_sessions";

export type AgentDirectoryEntry = {
  kind: AgentHubKind;
  label: string;
  description: string;
  /** Open the live agent / primary surface. */
  livePath: string;
  sessionSource: AgentSessionSource;
  /** Query param `agentKind` for `/api/agent-sessions` when sessionSource is agent_sessions. */
  listAgentKind?: AgentHubKind;
  icon: LucideIcon;
};

export const agentDirectory: AgentDirectoryEntry[] = [
  {
    kind: "mail_clerk",
    label: "Mail Clerk",
    description: "Decompose captures, assign routes, and apply destinations from Rapid Router (holding pen handoffs).",
    livePath: "/app/rapid-router",
    sessionSource: "agent_sessions",
    listAgentKind: "mail_clerk",
    icon: Mail,
  },
  {
    kind: "advisor_agents",
    label: "Advisor agents",
    description: "Consultant and Red Team runs from Rapid Router capture or Notebooks note context.",
    livePath: "/app/rapid-router",
    sessionSource: "agent_sessions",
    listAgentKind: "advisor_agents",
    icon: Users,
  },
  {
    kind: "consultant",
    label: "Consultant",
    description: "Retrieval-aware workspace chat with saved threads and documents.",
    livePath: "/app/chat",
    sessionSource: "chat_threads",
    icon: MessageSquare,
  },
  {
    kind: "brand_rep",
    label: "Brand Rep",
    description: "Brand Center copilot for kit review and guided consultation.",
    livePath: "/app/brand-center",
    sessionSource: "agent_sessions",
    listAgentKind: "brand_rep",
    icon: Goal,
  },
  {
    kind: "project_manager",
    label: "PM Agent",
    description: "Planning and next-step suggestions from boards, calendar, or task context.",
    livePath: "/app/boards",
    sessionSource: "agent_sessions",
    listAgentKind: "project_manager",
    icon: Bot,
  },
  {
    kind: "brainstorm_ai",
    label: "Brainstorm AI",
    description: "Studio AI panel: thinking modes, guided exercises, and canvas-aware prompts.",
    livePath: "/app/brainstorm",
    sessionSource: "agent_sessions",
    listAgentKind: "brainstorm_ai",
    icon: Lightbulb,
  },
];
