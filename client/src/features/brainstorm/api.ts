import { api } from "@/lib/api/client";
import type { BrainstormEdge, BrainstormFlowNode } from "@/features/brainstorm/types";

export type BrainstormSessionResponse = {
  project: { id: string; name: string };
  session: { id: string; title: string; updatedAt: string };
  nodes: BrainstormFlowNode[];
  edges: BrainstormEdge[];
};

export type BrainstormSessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  nodeCount: number;
};

export type BrainstormSessionsListResponse = {
  project: { id: string; name: string };
  sessions: BrainstormSessionSummary[];
};

export async function fetchBrainstormSessionsList(workspaceId: string): Promise<BrainstormSessionsListResponse> {
  const { data } = await api.get<BrainstormSessionsListResponse>("/api/brainstorm/sessions", {
    params: { workspaceId },
  });
  return data;
}

export async function fetchBrainstormSessionById(
  sessionId: string,
  workspaceId: string,
): Promise<BrainstormSessionResponse> {
  const { data } = await api.get<BrainstormSessionResponse>(`/api/brainstorm/sessions/${sessionId}`, {
    params: { workspaceId },
  });
  return data;
}

/** @deprecated Prefer `fetchBrainstormSessionById` with workspace id. */
export async function fetchBrainstormSession(workspaceId: string): Promise<BrainstormSessionResponse> {
  const { data } = await api.get<BrainstormSessionResponse>("/api/brainstorm/session", {
    params: { workspaceId },
  });
  return data;
}

export async function createBrainstormSession(
  workspaceId: string,
  title?: string,
): Promise<{
  project: { id: string; name: string };
  session: { id: string; title: string; updatedAt: string };
}> {
  const { data } = await api.post("/api/brainstorm/sessions", { workspaceId, title });
  return data;
}

export async function patchBrainstormSession(
  sessionId: string,
  body: { title: string },
  workspaceId: string,
): Promise<{ session: { id: string; title: string; updatedAt: string } }> {
  const { data } = await api.patch(`/api/brainstorm/sessions/${sessionId}`, body, {
    params: { workspaceId },
  });
  return data;
}

export async function deleteBrainstormSession(sessionId: string, workspaceId: string): Promise<void> {
  await api.delete(`/api/brainstorm/sessions/${sessionId}`, { params: { workspaceId } });
}

export async function saveBrainstormCanvas(
  sessionId: string,
  workspaceId: string,
  payload: { nodes: BrainstormFlowNode[]; edges: BrainstormEdge[] },
): Promise<void> {
  await api.put(
    `/api/brainstorm/sessions/${sessionId}/canvas`,
    {
      nodes: payload.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        ...(n.parentId ? { parentId: n.parentId } : {}),
        ...(typeof n.width === "number" ? { width: n.width } : {}),
        ...(typeof n.height === "number" ? { height: n.height } : {}),
      })),
      edges: payload.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
        ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
        ...(e.data && Object.keys(e.data).length ? { data: e.data } : {}),
      })),
    },
    { params: { workspaceId } },
  );
}

export type ThinkingModeApi = "divergent" | "convergent" | "strategic" | "execution";

export type BrainstormAgentRoleApi = "consultant" | "red_team";

export async function postBrainstormAI(body: {
  prompt: string;
  mode: ThinkingModeApi;
  context?: { selectedNodeSummary?: string; canvasSummary?: string };
  /** Loads saved workspace brand kit on the server when set. */
  workspaceId?: string | null;
  /** AI Consultant (default) vs Red Team Agent overlay. */
  agentRole?: BrainstormAgentRoleApi;
}): Promise<{ result: string }> {
  const { data } = await api.post<{ result: string }>("/api/ai/brainstorm", body);
  return data;
}

export type ConvertPlanTaskDto = {
  id: string;
  title: string;
  completed: boolean;
  listId: string;
  order: number;
  ideaNodeId: string | null;
  ideaNode: { id: string; title: string };
};

export async function convertPlanToTasks(
  sessionId: string,
  ideaNodeId: string,
  workspaceId: string,
): Promise<{ tasks: ConvertPlanTaskDto[] }> {
  const { data } = await api.post<{ tasks: ConvertPlanTaskDto[] }>(
    `/api/brainstorm/sessions/${sessionId}/convert-plan`,
    { ideaNodeId },
    { params: { workspaceId } },
  );
  return data;
}
