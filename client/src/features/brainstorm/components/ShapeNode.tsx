import { Handle, NodeResizer, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { useLayoutEffect, useRef } from "react";
import type { ShapeFlowNode, StencilLibrary } from "@/features/brainstorm/types";
import { findWireframePreset } from "@/features/brainstorm/wireframePresets";
import { NodeCaptionWrapper } from "@/features/brainstorm/components/NodeCaptionWrapper";
import { nodeCaptionPropsFromData } from "@/features/brainstorm/types";
import { nodeChromeToStyle } from "@/features/brainstorm/utils/nodeChrome";
import { cn } from "@/lib/utils";

function isWireframeLibrary(lib: StencilLibrary): lib is "wireframe_backend" | "wireframe_frontend" {
  return lib === "wireframe_backend" || lib === "wireframe_frontend";
}

export function ShapeNode({ id, data, selected }: NodeProps<ShapeFlowNode>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();

  const stencilLibrary: StencilLibrary = data.stencilLibrary ?? "basic";
  const isBasic = stencilLibrary === "basic";
  const variant = data.variant ?? "rectangle";
  const isEllipse = variant === "ellipse";
  const isCircle = variant === "circle";
  const isRoundedRect = variant === "rectangle_rounded" || variant === "square_rounded";
  const isSharpQuad = variant === "rectangle" || variant === "square";
  const isDiamond = variant === "diamond";
  const isTriangle = variant === "triangle";
  const wireLib = isWireframeLibrary(stencilLibrary) ? stencilLibrary : null;
  const wirePreset = wireLib ? findWireframePreset(wireLib, data.presetId) : undefined;
  const WireIcon = wirePreset?.Icon;

  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [
    id,
    selected,
    variant,
    stencilLibrary,
    data.presetId,
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

  const chromeBox = (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col px-2 pb-1.5 pt-2",
        isBasic && isDiamond && "px-5",
      )}
    >
      {isBasic ? (
        <div className="min-h-0 flex-1" aria-hidden />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 select-none">
          {WireIcon ? (
            <WireIcon className="size-14 shrink-0 text-muted-foreground" aria-hidden />
          ) : null}
        </div>
      )}
    </div>
  );

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={72}
        lineClassName="!border-primary"
        handleClassName="!size-2.5 !rounded-sm !border !border-primary !bg-background"
      />
      <div
        ref={rootRef}
        className={cn(
          "flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden",
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
              "flex min-h-0 w-full flex-1 flex-col overflow-hidden",
              isBasic
                ? cn(
                    "border-2 border-border bg-card/95 shadow-sm",
                    isEllipse || isCircle ? "rounded-[50%]" : null,
                    isRoundedRect ? "rounded-2xl" : null,
                    isSharpQuad ? "rounded-none" : null,
                    isDiamond && "rounded-none [clip-path:polygon(50%_2%,98%_50%,50%_98%,2%_50%)]",
                    isTriangle && "rounded-none border-0 [clip-path:polygon(50%_6%,100%_90%,0%_90%)]",
                    !isEllipse &&
                      !isCircle &&
                      !isRoundedRect &&
                      !isSharpQuad &&
                      !isDiamond &&
                      !isTriangle &&
                      "rounded-lg",
                  )
                : "rounded-lg border-2 border-border bg-card/95 shadow-sm",
            )}
            style={nodeChromeToStyle(data)}
          >
            {chromeBox}
          </div>
        </NodeCaptionWrapper>

        <Handle type="source" position={Position.Bottom} id="out" className="!size-2.5 !bg-muted-foreground" />
      </div>
    </>
  );
}
