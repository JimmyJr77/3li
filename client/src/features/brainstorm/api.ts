import type { Edge } from "@xyflow/react";
import { api } from "@/lib/api/client";
import type { IdeaFlowNode, IdeaNodeData } from "@/features/brainstorm/types";

export type BrainstormSessionResponse = {
  project: { id: string; name: string };
  session: { id: string; title: string; updatedAt: string };
  nodes: Array<{
    id: string;
    type: "idea";
    position: { x: number; y: number };
    data: IdeaNodeData;
  }>;
  edges: Array<{ id: string; source: string; target: string }>;
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

export async function fetchBrainstormSessionsList(): Promise<BrainstormSessionsListResponse> {
  const { data } = await api.get<BrainstormSessionsListResponse>("/api/brainstorm/sessions");
  return data;
}

export async function fetchBrainstormSessionById(sessionId: string): Promise<BrainstormSessionResponse> {
  const { data } = await api.get<BrainstormSessionResponse>(`/api/brainstorm/sessions/${sessionId}`);
  return data;
}

/** @deprecated Prefer `fetchBrainstormSessionById` with an explicit session id. */
export async function fetchBrainstormSession(): Promise<BrainstormSessionResponse> {
  const { data } = await api.get<BrainstormSessionResponse>("/api/brainstorm/session");
  return data;
}

export async function createBrainstormSession(title?: string): Promise<{
  project: { id: string; name: string };
  session: { id: string; title: string; updatedAt: string };
}> {
  const { data } = await api.post("/api/brainstorm/sessions", { title });
  return data;
}

export async function patchBrainstormSession(
  sessionId: string,
  body: { title: string },
): Promise<{ session: { id: string; title: string; updatedAt: string } }> {
  const { data } = await api.patch(`/api/brainstorm/sessions/${sessionId}`, body);
  return data;
}

export async function deleteBrainstormSession(sessionId: string): Promise<void> {
  await api.delete(`/api/brainstorm/sessions/${sessionId}`);
}

export async function saveBrainstormCanvas(
  sessionId: string,
  payload: { nodes: IdeaFlowNode[]; edges: Edge[] },
): Promise<void> {
  await api.put(`/api/brainstorm/sessions/${sessionId}/canvas`, {
    nodes: payload.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
    edges: payload.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
  });
}

export type ThinkingModeApi = "divergent" | "convergent" | "strategic" | "execution";

export async function postBrainstormAI(body: {
  prompt: string;
  mode: ThinkingModeApi;
  context?: { selectedNodeSummary?: string; canvasSummary?: string };
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
): Promise<{ tasks: ConvertPlanTaskDto[] }> {
  const { data } = await api.post<{ tasks: ConvertPlanTaskDto[] }>(
    `/api/brainstorm/sessions/${sessionId}/convert-plan`,
    { ideaNodeId },
  );
  return data;
}
