import {
  Handle,
  NodeResizer,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { nodeCaptionPropsFromData, type TextFlowNode } from "@/features/brainstorm/types";
import { NodeCaptionWrapper } from "@/features/brainstorm/components/NodeCaptionWrapper";
import { nodeChromeToStyle } from "@/features/brainstorm/utils/nodeChrome";
import { cn } from "@/lib/utils";

export function TextNode({ id, data, selected, width, height }: NodeProps<TextFlowNode>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();

  const outerStyle: CSSProperties = {};
  if (typeof width === "number") outerStyle.width = width;
  if (typeof height === "number") outerStyle.height = height;

  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [
    id,
    selected,
    width,
    height,
    data.captionText,
    data.captionAlign,
    data.captionVerticalAlign,
    data.outsideCaptionText,
    data.outsideCaptionAlign,
    data.outsideCaptionPlacement,
    data.backgroundColor,
    data.color,
    data.borderColor,
    data.borderWidthPx,
    updateNodeInternals,
  ]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      updateNodeInternals(id);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, updateNodeInternals]);

  const artifact = (
    <div
      className="relative box-border min-h-[3.5rem] w-full min-w-0 flex-1 rounded-md border-2 border-border bg-card shadow-sm"
      style={nodeChromeToStyle(data)}
      aria-hidden
    />
  );

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={176}
        minHeight={72}
        lineClassName="!border-primary"
        handleClassName="!size-2.5 !rounded-sm !border !border-primary !bg-background"
      />
      <div
        ref={rootRef}
        className={cn(
          "flex min-h-[72px] min-w-[176px] flex-col",
          selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
        style={outerStyle}
      >
        <Handle type="target" position={Position.Top} className="!size-2.5 !bg-muted-foreground" />
        <NodeCaptionWrapper
          {...nodeCaptionPropsFromData(data)}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {artifact}
        </NodeCaptionWrapper>
        <Handle type="source" position={Position.Bottom} className="!size-2.5 !bg-muted-foreground" />
      </div>
    </>
  );
}
