import { api } from "@/lib/api/client";

export type AgentSessionListItem = {
  id: string;
  title: string;
  agentKind: string;
  updatedAt: string;
  createdAt: string;
  metadata: unknown;
  preview: string;
};

export type AgentSessionEventDto = {
  id: string;
  seq: number;
  type: string;
  payload: unknown;
  createdAt: string;
};

export async function fetchAgentSessionsList(
  workspaceId: string,
  agentKind: string,
): Promise<AgentSessionListItem[]> {
  const { data } = await api.get<{ sessions: AgentSessionListItem[] }>("/api/agent-sessions", {
    params: { workspaceId, agentKind },
  });
  return data.sessions;
}

export async function fetchAgentSessionDetail(
  workspaceId: string,
  sessionId: string,
): Promise<{ session: { id: string; title: string; agentKind: string; metadata: unknown }; events: AgentSessionEventDto[] }> {
  const { data } = await api.get<{
    session: { id: string; title: string; agentKind: string; metadata: unknown };
    events: AgentSessionEventDto[];
  }>(`/api/agent-sessions/${sessionId}`, {
    params: { workspaceId },
  });
  return data;
}
