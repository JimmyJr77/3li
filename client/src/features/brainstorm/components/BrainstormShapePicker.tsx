import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  BasicShapeSvgBackground,
  basicShapeUsesSvgBackground,
} from "@/features/brainstorm/components/BasicShapeSvgBackground";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import {
  BASIC_2D_SHAPE_VARIANTS,
  BASIC_3D_SHAPE_VARIANTS,
  defaultShapeData,
  type ShapeVariant,
  type StencilLibrary,
} from "@/features/brainstorm/types";
import { presetsForWireframeLibrary, type WireframeLibrary } from "@/features/brainstorm/wireframePresets";
import { cn } from "@/lib/utils";

const BASIC_LABELS: Record<ShapeVariant, string> = {
  rectangle: "Rectangle",
  rectangle_rounded: "Rounded rectangle",
  square: "Square",
  square_rounded: "Rounded square",
  ellipse: "Ellipse",
  circle: "Circle",
  diamond: "Diamond",
  triangle: "Triangle",
  hexagon: "Hexagon",
  pentagon: "Pentagon",
  octagon: "Octagon",
  star: "Star",
  parallelogram: "Parallelogram",
  cube: "Cube",
  block_3d: "3D block",
  cylinder: "Cylinder",
  cone: "Cone",
  sphere: "Sphere",
  pyramid: "Pyramid",
};

function BasicShapePreview({ variant }: { variant: ShapeVariant }) {
  const previewData = { ...defaultShapeData(), variant, stencilLibrary: "basic" as const };

  if (basicShapeUsesSvgBackground(variant)) {
    return (
      <span
        className="relative inline-block h-9 w-12 shrink-0 overflow-hidden rounded-sm border border-muted-foreground/40 bg-muted/25"
        aria-hidden
      >
        <BasicShapeSvgBackground variant={variant} data={previewData} />
      </span>
    );
  }

  const base = "inline-block shrink-0 border-2 border-muted-foreground bg-muted/40";
  switch (variant) {
    case "rectangle":
      return <span className={cn(base, "h-6 w-10 rounded-none")} aria-hidden />;
    case "rectangle_rounded":
      return <span className={cn(base, "h-6 w-10 rounded-lg")} aria-hidden />;
    case "square":
      return <span className={cn(base, "size-7 rounded-none")} aria-hidden />;
    case "square_rounded":
      return <span className={cn(base, "size-7 rounded-lg")} aria-hidden />;
    case "ellipse":
      return <span className={cn(base, "h-7 w-11 rounded-[50%]")} aria-hidden />;
    case "circle":
      return <span className={cn(base, "size-8 rounded-[50%]")} aria-hidden />;
    default:
      return <span className={cn(base, "h-6 w-10 rounded-md")} aria-hidden />;
  }
}

/** Side panel: pick a shape type before it is placed on the canvas (mirrors edge-toolbar pattern). */
export function BrainstormShapePicker() {
  const shapePickerOpen = useBrainstormStore((s) => s.shapePickerOpen);
  const setShapePickerOpen = useBrainstormStore((s) => s.setShapePickerOpen);
  const addShapeNode = useBrainstormStore((s) => s.addShapeNode);
  const [library, setLibrary] = useState<StencilLibrary>("basic");

  if (!shapePickerOpen) return null;

  const addBasic = (variant: ShapeVariant) => {
    addShapeNode({ data: { stencilLibrary: "basic", variant, html: "<p></p>" } });
  };

  const addWireframe = (lib: WireframeLibrary, presetId: string) => {
    addShapeNode({
      data: {
        stencilLibrary: lib,
        presetId,
        caption: "",
        html: "<p></p>",
      },
    });
  };

  return (
    <div
      className="nodrag nopan flex max-h-[min(520px,calc(100vh-8rem))] w-[min(280px,calc(100vw-2rem))] flex-col gap-2 rounded-md border bg-card/95 p-2 shadow-md backdrop-blur-sm"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2 border-b border-border pb-2">
        <div>
          <p className="text-xs font-semibold">Add shape</p>
          <p className="text-[10px] text-muted-foreground">Choose a type, then it appears on the board.</p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="nodrag nopan size-7 shrink-0"
          aria-label="Close shape picker"
          onClick={() => setShapePickerOpen(false)}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex gap-1">
        {(
          [
            ["basic", "Basic"],
            ["wireframe_backend", "Backend"],
            ["wireframe_frontend", "Frontend"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={cn(
              "h-7 flex-1 rounded-md border px-1 text-[10px] font-medium",
              library === key
                ? "border-primary bg-primary/10 text-foreground"
                : "border-input bg-background text-muted-foreground",
            )}
            onClick={() => setLibrary(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {library === "basic" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground">2D shapes</Label>
              <div className="grid grid-cols-2 gap-2">
                {BASIC_2D_SHAPE_VARIANTS.map((variant) => (
                  <Button
                    key={variant}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="nodrag nopan flex h-auto min-h-[4.25rem] flex-col gap-1 px-1 py-2 text-[9px] font-normal leading-tight"
                    title={BASIC_LABELS[variant]}
                    onClick={() => addBasic(variant)}
                  >
                    <BasicShapePreview variant={variant} />
                    {BASIC_LABELS[variant]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground">3D shapes</Label>
              <div className="grid grid-cols-2 gap-2">
                {BASIC_3D_SHAPE_VARIANTS.map((variant) => (
                  <Button
                    key={variant}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="nodrag nopan flex h-auto min-h-[4.25rem] flex-col gap-1 px-1 py-2 text-[9px] font-normal leading-tight"
                    title={BASIC_LABELS[variant]}
                    onClick={() => addBasic(variant)}
                  >
                    <BasicShapePreview variant={variant} />
                    {BASIC_LABELS[variant]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {library === "wireframe_backend" ? (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Software / backend</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {presetsForWireframeLibrary("wireframe_backend").map((p) => {
                const Icon = p.Icon;
                return (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    title={p.label}
                    className="nodrag nopan flex h-auto flex-col gap-1 px-1 py-2 text-[9px] font-normal leading-tight"
                    onClick={() => addWireframe("wireframe_backend", p.id)}
                  >
                    <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    {p.label}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}

        {library === "wireframe_frontend" ? (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">UI / frontend</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {presetsForWireframeLibrary("wireframe_frontend").map((p) => {
                const Icon = p.Icon;
                return (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    title={p.label}
                    className="nodrag nopan flex h-auto flex-col gap-1 px-1 py-2 text-[9px] font-normal leading-tight"
                    onClick={() => addWireframe("wireframe_frontend", p.id)}
                  >
                    <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    {p.label}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
