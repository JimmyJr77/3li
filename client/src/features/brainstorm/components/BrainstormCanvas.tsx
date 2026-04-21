import { useCallback, useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { IdeaNode } from "@/features/brainstorm/components/IdeaNode";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import type { IdeaFlowNode } from "@/features/brainstorm/types";

const nodeTypes: NodeTypes = {
  idea: IdeaNode,
};

function BrainstormCanvasInner() {
  const nodes = useBrainstormStore((s) => s.nodes);
  const edges = useBrainstormStore((s) => s.edges);
  const onNodesChange = useBrainstormStore((s) => s.onNodesChange);
  const onEdgesChange = useBrainstormStore((s) => s.onEdgesChange);
  const onConnect = useBrainstormStore((s) => s.onConnect);

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: true,
      style: { strokeWidth: 1.5 },
    }),
    [],
  );

  const isValidConnection = useCallback(() => true, []);

  return (
    <ReactFlow<IdeaFlowNode>
      className="h-full w-full bg-background"
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      fitView
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      isValidConnection={isValidConnection}
    >
      <Background gap={16} size={1} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable className="!bg-muted" />
    </ReactFlow>
  );
}

export function BrainstormCanvas() {
  return (
    <div className="h-full min-h-[min(480px,calc(100vh-13rem))] w-full min-w-0">
      <ReactFlowProvider>
        <BrainstormCanvasInner />
      </ReactFlowProvider>
    </div>
  );
}
