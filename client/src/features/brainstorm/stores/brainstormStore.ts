import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import type { IdeaFlowNode, IdeaNodeDataPatch } from "@/features/brainstorm/types";
import { defaultIdeaData } from "@/features/brainstorm/types";

export type ThinkingMode = "divergent" | "convergent" | "strategic" | "execution";

type BrainstormState = {
  thinkingMode: ThinkingMode;
  nodes: IdeaFlowNode[];
  edges: Edge[];
  setThinkingMode: (mode: ThinkingMode) => void;
  setNodes: (nodes: IdeaFlowNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<IdeaFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addIdeaNode: (position?: { x: number; y: number }) => void;
  updateIdeaData: (id: string, patch: IdeaNodeDataPatch) => void;
  resetCanvas: (nodes: IdeaFlowNode[], edges: Edge[]) => void;
};

export const useBrainstormStore = create<BrainstormState>((set, get) => ({
  thinkingMode: "divergent",
  nodes: [],
  edges: [],

  setThinkingMode: (thinkingMode) => set({ thinkingMode }),

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },

  addIdeaNode: (position) => {
    const id = crypto.randomUUID();
    set({
      nodes: [
        ...get().nodes,
        {
          id,
          type: "idea",
          position: position ?? { x: 120 + Math.random() * 60, y: 80 + Math.random() * 60 },
          data: defaultIdeaData(),
        },
      ],
    });
  },

  updateIdeaData: (id, patch) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    });
  },

  resetCanvas: (nodes, edges) => set({ nodes, edges }),
}));
