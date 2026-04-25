import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { cn } from "@/lib/utils";

/** One width preference for every right-side app sheet (agents, tickets, board settings, etc.). */
export const RIGHT_APP_SHEET_WIDTH_STORAGE_KEY = "appRightSheetWidthPx";
export const RIGHT_APP_SHEET_WIDTH_DEFAULT = 640;
export const RIGHT_APP_SHEET_WIDTH_MIN = 380;
export const RIGHT_APP_SHEET_WIDTH_MAX = 1200;

const LEGACY_SHEET_WIDTH_KEYS = [
  "pmAgentSheetWidthPx",
  "brandRepAgentSheetWidthPx",
  "advisorAgentsSheetWidthPx",
  "brainstormAgentsSheetWidthPx",
] as const;

/** Base layout classes aligned with agent sheets (`!max-w-none` overrides Radix `sm:max-w-sm`). */
export const rightAppSheetContentClassName =
  "flex h-full max-w-none flex-col gap-0 border-l p-0 shadow-xl !max-w-none";

export function readStoredRightAppSheetWidth(): number {
  try {
    const tryParse = (raw: string | null): number | null => {
      if (!raw) return null;
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && n >= RIGHT_APP_SHEET_WIDTH_MIN && n <= RIGHT_APP_SHEET_WIDTH_MAX) {
        return n;
      }
      return null;
    };

    const unified = tryParse(localStorage.getItem(RIGHT_APP_SHEET_WIDTH_STORAGE_KEY));
    if (unified !== null) return unified;

    for (const key of LEGACY_SHEET_WIDTH_KEYS) {
      const w = tryParse(localStorage.getItem(key));
      if (w !== null) {
        try {
          localStorage.setItem(RIGHT_APP_SHEET_WIDTH_STORAGE_KEY, String(w));
        } catch {
          /* ignore */
        }
        return w;
      }
    }
  } catch {
    /* ignore */
  }
  return RIGHT_APP_SHEET_WIDTH_DEFAULT;
}

type UseOptions = {
  /**
   * When provided and `true`, width is re-read from `localStorage` so opening any right sheet
   * picks up the latest width after resizing another sheet.
   */
  open?: boolean;
};

export function useResizableRightAppSheetWidth(options?: UseOptions) {
  const open = options?.open;
  const [panelWidth, setPanelWidth] = useState(readStoredRightAppSheetWidth);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  const panelWidthPx = useMemo(() => {
    const w = Number.isFinite(panelWidth) && panelWidth > 0 ? panelWidth : RIGHT_APP_SHEET_WIDTH_DEFAULT;
    return Math.min(RIGHT_APP_SHEET_WIDTH_MAX, Math.max(RIGHT_APP_SHEET_WIDTH_MIN, w));
  }, [panelWidth]);

  useEffect(() => {
    if (open) setPanelWidth(readStoredRightAppSheetWidth());
  }, [open]);

  const startResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidthRef.current;
    const onMove = (ev: MouseEvent) => {
      const dx = startX - ev.clientX;
      const cap = Math.min(
        RIGHT_APP_SHEET_WIDTH_MAX,
        typeof window !== "undefined" ? window.innerWidth - 24 : RIGHT_APP_SHEET_WIDTH_MAX,
      );
      const next = Math.min(cap, Math.max(RIGHT_APP_SHEET_WIDTH_MIN, startW + dx));
      panelWidthRef.current = next;
      setPanelWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      try {
        localStorage.setItem(RIGHT_APP_SHEET_WIDTH_STORAGE_KEY, String(panelWidthRef.current));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const sheetWidthStyle = useMemo(
    () => ({ width: `min(${panelWidthPx}px, calc(100vw - 12px))` }) as const,
    [panelWidthPx],
  );

  return { panelWidthPx, panelWidthRef, startResize, sheetWidthStyle };
}

export function RightAppSheetResizeHandle({
  onMouseDown,
  className,
}: {
  onMouseDown: (e: ReactMouseEvent) => void;
  className?: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to resize panel"
      title="Drag to resize"
      className={cn(
        "absolute top-0 bottom-0 left-0 z-[60] flex w-4 cursor-col-resize touch-none items-center justify-center border-r border-transparent hover:border-border hover:bg-muted/50 active:bg-muted",
        className,
      )}
      onMouseDown={onMouseDown}
    >
      <GripVertical className="size-4 text-muted-foreground opacity-70" aria-hidden />
    </div>
  );
}
