import type { CSSProperties, ReactNode } from "react";
import type {
  CaptionAlignOption,
  CaptionVerticalOption,
  OutsideCaptionPlacementOption,
} from "@/features/brainstorm/types";
import { cn } from "@/lib/utils";

export type NodeCaptionWrapperProps = {
  insideCaptionText?: string;
  insideCaptionAlign?: CaptionAlignOption;
  insideCaptionVerticalAlign?: CaptionVerticalOption;
  /** Appearance text color (inside artifact only). */
  insideCaptionColor?: string;
  outsideCaptionText?: string;
  outsideCaptionAlign?: CaptionAlignOption;
  outsideCaptionPlacement?: OutsideCaptionPlacementOption;
  children: ReactNode;
  className?: string;
};

function justifyClass(align: CaptionAlignOption): string {
  if (align === "right") return "justify-end";
  if (align === "center") return "justify-center";
  return "justify-start";
}

function itemsClass(vertical: CaptionVerticalOption): string {
  if (vertical === "bottom") return "items-end";
  if (vertical === "top") return "items-start";
  return "items-center";
}

/**
 * Inside text overlays the artifact; outside text is absolutely positioned with margin offset
 * so it does not participate in flex sizing of the artifact.
 */
const defaultOutsideLabelColor: CSSProperties = { color: "var(--foreground)" };

export function NodeCaptionWrapper({
  insideCaptionText,
  insideCaptionAlign = "left",
  insideCaptionVerticalAlign = "middle",
  insideCaptionColor,
  outsideCaptionText,
  outsideCaptionAlign = "center",
  outsideCaptionPlacement = "below",
  children,
  className,
}: NodeCaptionWrapperProps) {
  const insideTrim = insideCaptionText?.trim();
  const outsideTrim = outsideCaptionText?.trim();

  const insideOverlay = insideTrim ? (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] flex p-3",
        itemsClass(insideCaptionVerticalAlign),
        justifyClass(insideCaptionAlign),
      )}
    >
      <div
        className={cn(
          "max-h-[88%] max-w-full overflow-hidden whitespace-pre-wrap break-words text-xs leading-snug",
          !insideCaptionColor?.trim() && "text-foreground",
        )}
        style={{
          textAlign: insideCaptionAlign,
          ...(insideCaptionColor?.trim() ? { color: insideCaptionColor.trim() } : {}),
        }}
      >
        {insideCaptionText}
      </div>
    </div>
  ) : null;

  const outsideBlock = outsideTrim ? (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-[2] flex px-0.5",
        outsideCaptionPlacement === "above" ? "bottom-full mb-2" : "top-full mt-2",
        justifyClass(outsideCaptionAlign),
      )}
    >
      <div
        className="max-w-full whitespace-pre-wrap break-words text-xs leading-snug"
        style={{ textAlign: outsideCaptionAlign, ...defaultOutsideLabelColor }}
      >
        {outsideCaptionText}
      </div>
    </div>
  ) : null;

  return (
    <div className={cn("relative min-h-0 min-w-0", className)}>
      {children}
      {insideOverlay}
      {outsideBlock}
    </div>
  );
}
