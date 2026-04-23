import type { ReactNode } from "react";
import type { CaptionAlignOption, CaptionPlacementOption } from "@/features/brainstorm/types";
import { cn } from "@/lib/utils";

type Props = {
  captionText?: string;
  captionAlign?: CaptionAlignOption;
  captionPlacement?: CaptionPlacementOption;
  children: ReactNode;
  className?: string;
};

/** Renders optional caption around content; pointer-events none so the node stays easy to drag. */
export function NodeCaptionWrapper({
  captionText,
  captionAlign,
  captionPlacement,
  children,
  className,
}: Props) {
  const align = captionAlign ?? "left";
  const place = captionPlacement ?? "below";
  const t = captionText?.trim();
  const caption = t ? (
    <div
      className="pointer-events-none max-w-full select-none whitespace-pre-wrap break-words text-xs leading-snug text-foreground"
      style={{ textAlign: align }}
    >
      {captionText}
    </div>
  ) : null;

  if (place === "above") {
    return (
      <div className={cn("flex min-h-0 min-w-0 flex-col gap-1", className)}>
        {caption}
        {children}
      </div>
    );
  }
  if (place === "below") {
    return (
      <div className={cn("flex min-h-0 min-w-0 flex-col gap-1", className)}>
        {children}
        {caption}
      </div>
    );
  }
  return (
    <div className={cn("relative min-h-0 min-w-0", className)}>
      {children}
      {caption ? (
        <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center px-2">
          <div
            className="max-h-[90%] max-w-[95%] overflow-hidden rounded-md bg-card/90 px-2 py-1 text-xs leading-snug text-foreground shadow-sm"
            style={{ textAlign: align }}
          >
            {captionText}
          </div>
        </div>
      ) : null}
    </div>
  );
}
