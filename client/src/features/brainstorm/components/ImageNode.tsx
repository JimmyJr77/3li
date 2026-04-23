import { Handle, NodeResizer, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { useLayoutEffect, useRef } from "react";
import type { ImageFlowNode } from "@/features/brainstorm/types";
import { NodeCaptionWrapper } from "@/features/brainstorm/components/NodeCaptionWrapper";
import { nodeCaptionPropsFromData } from "@/features/brainstorm/types";
import { nodeChromeToStyle } from "@/features/brainstorm/utils/nodeChrome";
import { cn } from "@/lib/utils";

export function ImageNode({ id, data, selected }: NodeProps<ImageFlowNode>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [
    id,
    data.src,
    data.captionText,
    data.captionAlign,
    data.captionVerticalAlign,
    data.outsideCaptionText,
    data.outsideCaptionAlign,
    data.outsideCaptionPlacement,
    selected,
    updateNodeInternals,
  ]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => updateNodeInternals(id));
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, updateNodeInternals]);

  const media = (
    <div className="relative flex min-h-[48px] flex-1 items-center justify-center bg-background/40 p-1">
      {data.src ? (
        <img
          src={data.src}
          alt={data.alt || ""}
          className="max-h-full max-w-full object-contain select-none"
          draggable={false}
        />
      ) : (
        <span className="px-2 text-center text-[10px] text-muted-foreground select-none">No image</span>
      )}
    </div>
  );

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={60}
        lineClassName="!border-primary"
        handleClassName="!size-2.5 !rounded-sm !border !border-primary !bg-background"
      />
      <div
        ref={rootRef}
        className={cn(
          "flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg",
          selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
      >
        <Handle type="target" position={Position.Top} id="in" className="!size-2.5 !bg-muted-foreground" />
        <Handle
          type="target"
          position={Position.Left}
          id="lat-l-in"
          className="nodrag nopan !size-2.5 !bg-muted-foreground"
          style={{ top: "30%" }}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="lat-l-out"
          className="nodrag nopan !size-2.5 !bg-muted-foreground"
          style={{ top: "70%" }}
        />
        <Handle
          type="target"
          position={Position.Right}
          id="lat-r-in"
          className="nodrag nopan !size-2.5 !bg-muted-foreground"
          style={{ top: "30%" }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="lat-r-out"
          className="nodrag nopan !size-2.5 !bg-muted-foreground"
          style={{ top: "70%" }}
        />

        <NodeCaptionWrapper {...nodeCaptionPropsFromData(data)} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border-2 border-border bg-muted/20 shadow-sm",
            )}
            style={nodeChromeToStyle(data)}
          >
            {media}
          </div>
        </NodeCaptionWrapper>

        <Handle type="source" position={Position.Bottom} id="out" className="!size-2.5 !bg-muted-foreground" />
      </div>
    </>
  );
}
