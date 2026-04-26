import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

type NotesColumnResizeHandleProps = {
  /** Called with horizontal delta (px) for each pointer move while dragging. */
  onDelta: (dx: number) => void;
  className?: string;
  disabled?: boolean;
};

/**
 * Vertical drag handle between Notebooks panes (desktop). Uses pointer capture.
 */
export function NotesColumnResizeHandle({ onDelta, className, disabled }: NotesColumnResizeHandleProps) {
  const lastX = useRef<number | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      lastX.current = e.clientX;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId || lastX.current === null) return;
        const dx = ev.clientX - lastX.current;
        lastX.current = ev.clientX;
        if (dx !== 0) onDelta(dx);
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        lastX.current = null;
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [disabled, onDelta],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      tabIndex={disabled ? -1 : 0}
      onPointerDown={onPointerDown}
      className={cn(
        "group relative z-20 flex w-2 shrink-0 cursor-col-resize justify-center self-stretch outline-none",
        "hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "pointer-events-none opacity-0",
        className,
      )}
    >
      <div
        className="h-full w-px shrink-0 bg-border group-hover:bg-primary/50 group-focus-visible:bg-primary/50"
        aria-hidden
      />
    </div>
  );
}
