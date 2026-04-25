import { useId } from "react";
import type { ShapeNodeData, ShapeVariant } from "@/features/brainstorm/types";
import { nodeChromeToStyle } from "@/features/brainstorm/utils/nodeChrome";

/** 2D shapes drawn as SVG so stroke/fill match rectangles and ellipses (clip-path + CSS border do not). */
export const BASIC_SVG_POLYGON_VARIANTS = [
  "diamond",
  "triangle",
  "hexagon",
  "pentagon",
  "octagon",
  "star",
  "parallelogram",
] as const satisfies readonly ShapeVariant[];

/** Stylized 3D primitives (same chrome keys as flat shapes). */
export const BASIC_SVG_3D_VARIANTS = [
  "cube",
  "block_3d",
  "cylinder",
  "cone",
  "sphere",
  "pyramid",
] as const satisfies readonly ShapeVariant[];

export function basicShapeUsesSvgBackground(variant: ShapeVariant): boolean {
  return (
    (BASIC_SVG_POLYGON_VARIANTS as readonly string[]).includes(variant) ||
    (BASIC_SVG_3D_VARIANTS as readonly string[]).includes(variant)
  );
}

function starPolygonPoints(cx: number, cy: number, outer: number, inner: number, spikes: number): string {
  const pts: string[] = [];
  const step = Math.PI / spikes;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + i * step;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(" ");
}

function resolveSvgPaint(data: ShapeNodeData) {
  const s = nodeChromeToStyle(data);
  const fill =
    typeof s.backgroundColor === "string" && s.backgroundColor.trim()
      ? s.backgroundColor.trim()
      : "var(--card)";
  const stroke =
    typeof s.borderColor === "string" && s.borderColor.trim() ? s.borderColor.trim() : "var(--border)";
  const strokeW =
    typeof s.borderWidth === "number" && Number.isFinite(s.borderWidth) && s.borderWidth > 0
      ? s.borderWidth
      : 2;
  return { fill, stroke, strokeW };
}

const VB = "0 0 100 100";

/** Full-bleed SVG behind caption content for polygon / 3D basic shapes. */
export function BasicShapeSvgBackground({ variant, data }: { variant: ShapeVariant; data: ShapeNodeData }) {
  const uid = useId().replace(/:/g, "");
  const { fill, stroke, strokeW } = resolveSvgPaint(data);
  const radId = `bssh-${uid}-r`;

  const outline = {
    stroke,
    strokeWidth: strokeW,
    vectorEffect: "non-scaling-stroke" as const,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };

  switch (variant) {
    case "diamond":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <polygon points="50,3 97,50 50,97 3,50" fill={fill} {...outline} />
        </svg>
      );
    case "triangle":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <polygon points="50,5 95,93 5,93" fill={fill} {...outline} />
        </svg>
      );
    case "hexagon":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <polygon points="50,4 88,26 88,74 50,96 12,74 12,26" fill={fill} {...outline} />
        </svg>
      );
    case "pentagon":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <polygon points="50,6 90,38 74,90 26,90 10,38" fill={fill} {...outline} />
        </svg>
      );
    case "octagon":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <polygon points="32,4 68,4 96,32 96,68 68,96 32,96 4,68 4,32" fill={fill} {...outline} />
        </svg>
      );
    case "star":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <polygon points={starPolygonPoints(50, 52, 44, 18, 5)} fill={fill} {...outline} />
        </svg>
      );
    case "parallelogram":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <polygon points="10,8 92,8 82,92 0,92" fill={fill} {...outline} />
        </svg>
      );

    case "cube":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <polygon points="50,12 82,32 50,52 18,32" fill={fill} fillOpacity={1} />
          <polygon points="18,32 50,52 50,88 18,68" fill={fill} fillOpacity={0.72} />
          <polygon points="50,52 82,32 82,68 50,88" fill={fill} fillOpacity={0.86} />
          <path d="M 50 12 L 82 32 L 82 68 L 50 88 L 18 68 L 18 32 Z" fill="none" {...outline} />
        </svg>
      );
    case "block_3d":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <polygon points="50,14 88,36 50,58 12,36" fill={fill} fillOpacity={1} />
          <polygon points="12,36 50,58 50,92 12,70" fill={fill} fillOpacity={0.7} />
          <polygon points="50,58 88,36 88,70 50,92" fill={fill} fillOpacity={0.82} />
          <path d="M 50 14 L 88 36 L 88 70 L 50 92 L 12 70 L 12 36 Z" fill="none" {...outline} />
        </svg>
      );
    case "cylinder":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <ellipse cx="50" cy="24" rx="34" ry="12" fill={fill} fillOpacity={0.95} />
          <rect x="16" y="24" width="68" height="50" fill={fill} fillOpacity={0.85} />
          <ellipse cx="50" cy="74" rx="34" ry="12" fill={fill} fillOpacity={0.62} />
          <path
            d="M 16 24 A 34 12 0 0 1 84 24 L 84 74 A 34 12 0 0 1 16 74 Z"
            fill="none"
            {...outline}
          />
        </svg>
      );
    case "cone":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <polygon points="50,8 90,78 10,78" fill={fill} fillOpacity={0.9} />
          <ellipse cx="50" cy="78" rx="40" ry="11" fill={fill} fillOpacity={0.72} />
          <path d="M 50 8 L 90 78 A 40 11 0 0 1 10 78 Z" fill="none" {...outline} />
        </svg>
      );
    case "sphere":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <defs>
            <radialGradient id={radId} cx="32%" cy="30%" r="65%">
              <stop offset="0%" stopColor="var(--background)" stopOpacity="0.45" />
              <stop offset="55%" stopColor={fill} stopOpacity="1" />
              <stop offset="100%" stopColor={fill} stopOpacity="0.55" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="40" fill={`url(#${radId})`} {...outline} />
        </svg>
      );
    case "pyramid":
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={VB} preserveAspectRatio="none" aria-hidden>
          <polygon points="50,10 88,82 12,82" fill={fill} fillOpacity={0.88} />
          <polygon points="50,10 12,82 50,82" fill={fill} fillOpacity={0.52} />
          <path d="M 50 10 L 88 82 L 12 82 Z" fill="none" {...outline} />
        </svg>
      );
    default:
      return null;
  }
}
