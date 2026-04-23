import {
  createBrainstormSession,
  fetchBrainstormSessionById,
  fetchBrainstormSessionsList,
  saveBrainstormCanvas,
} from "@/features/brainstorm/api";
import type { BrainstormEdge, BrainstormFlowNode, IdeaFlowNode } from "@/features/brainstorm/types";
import { defaultIdeaData } from "@/features/brainstorm/types";

function splitTitleBody(text: string): { title: string; description: string } {
  const trimmed = text.trim();
  const nl = trimmed.indexOf("\n");
  if (nl === -1) {
    return {
      title: trimmed.slice(0, 240) || "Idea",
      description: trimmed.length > 240 ? trimmed.slice(240).slice(0, 8000) : "",
    };
  }
  return {
    title: trimmed.slice(0, nl).slice(0, 240) || "Idea",
    description: trimmed.slice(nl + 1).trim().slice(0, 8000),
  };
}

/** Adds a new idea card to a brainstorm session (creates one if none exist). Scoped to the active brand workspace. */
export async function appendIdeaToBrainstorm(
  text: string,
  workspaceId: string,
  preferredSessionId?: string | null,
): Promise<{ sessionId: string; nodeId: string }> {
  let sessionId = preferredSessionId?.trim() || null;
  if (!sessionId) {
    const list = await fetchBrainstormSessionsList(workspaceId);
    sessionId = list.sessions[0]?.id ?? null;
  }
  if (!sessionId) {
    const created = await createBrainstormSession(workspaceId, "Main");
    sessionId = created.session.id;
  }
  const session = await fetchBrainstormSessionById(sessionId, workspaceId);
  const { title, description } = splitTitleBody(text);
  const maxX = session.nodes.reduce((m, n) => Math.max(m, n.position.x), 0);
  const newNode: IdeaFlowNode = {
    id: crypto.randomUUID(),
    type: "idea",
    position: { x: maxX + 40, y: 28 + (session.nodes.length % 7) * 44 },
    data: {
      ...defaultIdeaData(),
      title,
      description,
      tags: ["rapid-router"],
    },
  };
  const nodes: BrainstormFlowNode[] = [...session.nodes, newNode];
  const edges: BrainstormEdge[] = session.edges.map((e) => ({
    ...e,
    data: {
      lineStyle: e.data?.lineStyle ?? "solid",
      label: typeof e.data?.label === "string" ? e.data.label : "",
    },
  }));
  await saveBrainstormCanvas(sessionId, workspaceId, { nodes, edges });
  return { sessionId, nodeId: newNode.id };
}

/** Removes a single idea node added by Rapid Router (undo). */
export async function removeBrainstormIdeaNode(
  workspaceId: string,
  sessionId: string,
  nodeId: string,
): Promise<void> {
  const session = await fetchBrainstormSessionById(sessionId, workspaceId);
  const nodes = session.nodes.filter((n) => n.id !== nodeId);
  const edges = session.edges
    .filter((e) => e.source !== nodeId && e.target !== nodeId)
    .map((e) => ({
      ...e,
      data: {
        lineStyle: e.data?.lineStyle ?? "solid",
        label: typeof e.data?.label === "string" ? e.data.label : "",
      },
    }));
  await saveBrainstormCanvas(sessionId, workspaceId, { nodes, edges });
}
