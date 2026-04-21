import type { Edge, Node } from "@xyflow/react";

export type IdeaStatus = "idea" | "validated" | "executing";
export type IdeaPriority = "low" | "medium" | "high";

export type IdeaNodeData = {
  title: string;
  description: string;
  tags: string[];
  status: IdeaStatus;
  priority: IdeaPriority;
};

export type IdeaFlowNode = Node<IdeaNodeData, "idea">;

export type IdeaNodeDataPatch = Partial<IdeaNodeData>;

export function defaultIdeaData(): IdeaNodeData {
  return {
    title: "New idea",
    description: "",
    tags: [],
    status: "idea",
    priority: "medium",
  };
}

export type SerializedCanvas = {
  nodes: IdeaFlowNode[];
  edges: Edge[];
};
