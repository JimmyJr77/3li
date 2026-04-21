import type { Edge } from "@xyflow/react";
import {
  createBrainstormSession,
  fetchBrainstormSessionById,
  fetchBrainstormSessionsList,
  saveBrainstormCanvas,
} from "@/features/brainstorm/api";
import type { IdeaFlowNode } from "@/features/brainstorm/types";
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

/** Adds a new idea card to a brainstorm session (creates one if none exist). */
export async function appendIdeaToBrainstorm(text: string, preferredSessionId?: string | null): Promise<void> {
  let sessionId = preferredSessionId?.trim() || null;
  if (!sessionId) {
    const list = await fetchBrainstormSessionsList();
    sessionId = list.sessions[0]?.id ?? null;
  }
  if (!sessionId) {
    const created = await createBrainstormSession("Main");
    sessionId = created.session.id;
  }
  const session = await fetchBrainstormSessionById(sessionId);
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
  const nodes: IdeaFlowNode[] = [
    ...session.nodes.map((n) => ({
      id: n.id,
      type: "idea" as const,
      position: n.position,
      data: n.data,
    })),
    newNode,
  ];
  const edges: Edge[] = session.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
  }));
  await saveBrainstormCanvas(sessionId, { nodes, edges });
}
