import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useHtmlColorSchemeDark } from "@/lib/useHtmlColorSchemeDark";
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BrainstormCanvasContextMenu } from "@/features/brainstorm/components/BrainstormCanvasContextMenu";
import {
  BrainstormNodeContextMenuRequestContext,
} from "@/features/brainstorm/components/brainstormNodeContextMenu";
import { BrainstormCanvasInspector } from "@/features/brainstorm/components/BrainstormCanvasInspector";
import { BrainstormShapePicker } from "@/features/brainstorm/components/BrainstormShapePicker";
import { HierarchyNode } from "@/features/brainstorm/components/HierarchyNode";
import { IdeaNode } from "@/features/brainstorm/components/IdeaNode";
import { ImageNode } from "@/features/brainstorm/components/ImageNode";
import { ShapeNode } from "@/features/brainstorm/components/ShapeNode";
import { TableNode } from "@/features/brainstorm/components/TableNode";
import { TextNode } from "@/features/brainstorm/components/TextNode";
import { ContainerNode } from "@/features/brainstorm/components/ContainerNode";
import { readImageFileAsDataUrl } from "@/features/brainstorm/readImageDataUrl";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import type { BrainstormEdge, BrainstormFlowNode } from "@/features/brainstorm/types";
import { lineStyleToStroke } from "@/features/brainstorm/utils/edgeStyles";

const nodeTypes: NodeTypes = {
  idea: IdeaNode,
  shape: ShapeNode,
  text: TextNode,
  hierarchy: HierarchyNode,
  image: ImageNode,
  table: TableNode,
  container: ContainerNode,
};

/** MiniMap artifact fills — follow the active theme primary (accent palette + light/vibrant/dark). */
function minimapNodeColor(_node: BrainstormFlowNode): string {
  return "var(--primary)";
}

function BrainstormCanvasInner() {
  const colorSchemeDark = useHtmlColorSchemeDark();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const rfRef = useRef<ReactFlowInstance<BrainstormFlowNode, BrainstormEdge> | null>(null);
  const nodes = useBrainstormStore((s) => s.nodes);
  const edges = useBrainstormStore((s) => s.edges);
  const onNodesChange = useBrainstormStore((s) => s.onNodesChange);
  const onEdgesChange = useBrainstormStore((s) => s.onEdgesChange);
  const onConnect = useBrainstormStore((s) => s.onConnect);
  const addImageNode = useBrainstormStore((s) => s.addImageNode);
  const setSelectedEdgeId = useBrainstormStore((s) => s.setSelectedEdgeId);
  const clearNodeSelection = useBrainstormStore((s) => s.clearNodeSelection);
  const setShapePickerOpen = useBrainstormStore((s) => s.setShapePickerOpen);
  const selectSingleNode = useBrainstormStore((s) => s.selectSingleNode);
  const reparentAfterNodeDrag = useBrainstormStore((s) => s.reparentAfterNodeDrag);

  const styledEdges = useMemo(
    () =>
      edges.map((e) => {
        const labelText = e.data?.label?.trim();
        return {
          ...e,
          style: { ...lineStyleToStroke(e.data?.lineStyle) },
          ...(labelText
            ? {
                label: labelText,
                labelStyle: { fontSize: 11, fill: "var(--foreground)" },
                labelShowBg: true,
                labelBgStyle: { fill: "var(--card)" },
                labelBgPadding: [4, 2] as [number, number],
                labelBgBorderRadius: 4,
              }
            : {}),
        };
      }),
    [edges],
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: false,
      style: { strokeWidth: 1.5 },
    }),
    [],
  );

  const isValidConnection = useCallback(() => true, []);

  const onEdgeClick = useCallback(
    (_: ReactMouseEvent, edge: BrainstormEdge) => {
      setShapePickerOpen(false);
      clearNodeSelection();
      setSelectedEdgeId(edge.id);
    },
    [clearNodeSelection, setSelectedEdgeId, setShapePickerOpen],
  );

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null);
    setShapePickerOpen(false);
    setContextMenu(null);
  }, [setSelectedEdgeId, setShapePickerOpen]);

  const onPaneContextMenu = useCallback((e: ReactMouseEvent | globalThis.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const requestNodeContextMenu = useCallback(
    (e: ReactMouseEvent<Element> | globalThis.MouseEvent, nodeId: string) => {
      const node = useBrainstormStore.getState().nodes.find((n) => n.id === nodeId);
      if (!node) return;
      e.preventDefault();
      const selected = useBrainstormStore.getState().nodes.filter((n) => n.selected);
      const keepMulti = node.selected && selected.length > 1;
      if (!keepMulti) {
        selectSingleNode(node.id);
      }
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [selectSingleNode],
  );

  const onNodeContextMenu = useCallback(
    (e: ReactMouseEvent, node: BrainstormFlowNode) => {
      requestNodeContextMenu(e, node.id);
    },
    [requestNodeContextMenu],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onNodeDragStop = useCallback(
    (_e: ReactMouseEvent, _dragged: BrainstormFlowNode | BrainstormFlowNode[]) => {
      reparentAfterNodeDrag();
    },
    [reparentAfterNodeDrag],
  );

  const onDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      const inst = rfRef.current;
      if (!inst) return;
      const files = Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      const pos = inst.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        try {
          const src = await readImageFileAsDataUrl(file);
          addImageNode({
            position: { x: pos.x + i * 28, y: pos.y + i * 28 },
            src,
            alt: file.name.replace(/\.[^/.]+$/, ""),
          });
        } catch (err) {
          window.alert(err instanceof Error ? err.message : "Could not add image.");
        }
      }
    },
    [addImageNode],
  );

  // React Flow defaults multi-select to Meta/Ctrl+click only; include Shift so Shift+click matches Shift+marquee.
  return (
    <div className="relative h-full w-full min-h-0 bg-white dark:bg-background">
    <BrainstormNodeContextMenuRequestContext.Provider value={requestNodeContextMenu}>
    <ReactFlow<BrainstormFlowNode, BrainstormEdge>
      className="h-full w-full bg-white dark:bg-background [&_.react-flow__node]:overflow-visible"
      multiSelectionKeyCode={["Shift", "Meta", "Control"]}
      nodes={nodes}
      edges={styledEdges}
      onInit={(instance) => {
        rfRef.current = instance;
      }}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onEdgeClick={onEdgeClick}
      onPaneClick={onPaneClick}
      onPaneContextMenu={onPaneContextMenu}
      onNodeContextMenu={onNodeContextMenu}
      onNodeDragStop={onNodeDragStop}
      onDragOver={onDragOver}
      onDrop={onDrop}
      deleteKeyCode={["Backspace", "Delete"]}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      fitView
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      isValidConnection={isValidConnection}
    >
      <Background gap={16} size={1} color={colorSchemeDark ? "rgba(255,255,255,0.14)" : undefined} />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        ariaLabel="Studio board overview — shaded area is off-screen; outlined rectangle is the current view"
        className="rounded-md border-2 border-slate-400/75 shadow-md dark:border-border"
        bgColor="var(--muted)"
        maskColor={colorSchemeDark ? "rgba(0,0,0,0.55)" : "rgba(15, 23, 42, 0.58)"}
        maskStrokeColor="var(--primary)"
        maskStrokeWidth={2.5}
        nodeColor={minimapNodeColor}
        nodeStrokeColor="var(--primary-foreground)"
        nodeStrokeWidth={1.5}
        nodeBorderRadius={4}
      />
      <Panel position="top-right" className="m-2">
        <BrainstormCanvasInspector />
      </Panel>
      <Panel position="top-left" className="m-2 max-w-[min(288px,calc(100vw-2rem))]">
        <BrainstormShapePicker />
      </Panel>
    </ReactFlow>
    <BrainstormCanvasContextMenu
      open={contextMenu !== null}
      x={contextMenu?.x ?? 0}
      y={contextMenu?.y ?? 0}
      onClose={() => setContextMenu(null)}
    />
    </BrainstormNodeContextMenuRequestContext.Provider>
    </div>
  );
}

export function BrainstormCanvas() {
  return (
    <div className="h-full min-h-[min(480px,calc(100vh-13rem))] w-full min-w-0 bg-white dark:bg-background">
      <ReactFlowProvider>
        <BrainstormCanvasInner />
      </ReactFlowProvider>
    </div>
  );
}
