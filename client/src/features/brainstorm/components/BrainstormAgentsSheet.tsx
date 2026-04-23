import { GripVertical, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { BrainstormAIPanel } from "@/features/brainstorm/components/BrainstormAIPanel";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const SHEET_WIDTH_STORAGE_KEY = "brainstormAgentsSheetWidthPx";
const SHEET_WIDTH_DEFAULT = 640;
const SHEET_WIDTH_MIN = 380;
const SHEET_WIDTH_MAX = 1200;

function readStoredSheetWidth(): number {
  try {
    const raw = localStorage.getItem(SHEET_WIDTH_STORAGE_KEY);
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= SHEET_WIDTH_MIN && n <= SHEET_WIDTH_MAX) {
      return n;
    }
  } catch {
    /* ignore */
  }
  return SHEET_WIDTH_DEFAULT;
}

type BrainstormAgentsSheetProps = {
  sessionId: string;
  workspaceId: string;
};

export function BrainstormAgentsSheet({ sessionId, workspaceId }: BrainstormAgentsSheetProps) {
  const open = useBrainstormStore((s) => s.agentsPanelVisible);
  const setOpen = useBrainstormStore((s) => s.setAgentsPanelVisible);
  const [panelWidth, setPanelWidth] = useState(readStoredSheetWidth);
  const panelWidthRef = useRef(panelWidth);

  const panelWidthPx = useMemo(() => {
    const w = Number.isFinite(panelWidth) && panelWidth > 0 ? panelWidth : SHEET_WIDTH_DEFAULT;
    return Math.min(SHEET_WIDTH_MAX, Math.max(SHEET_WIDTH_MIN, w));
  }, [panelWidth]);

  useEffect(() => {
    panelWidthRef.current = panelWidth;
  }, [panelWidth]);

  const startResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidthRef.current;
    const onMove = (ev: MouseEvent) => {
      const dx = startX - ev.clientX;
      const cap = Math.min(SHEET_WIDTH_MAX, typeof window !== "undefined" ? window.innerWidth - 24 : SHEET_WIDTH_MAX);
      const next = Math.min(cap, Math.max(SHEET_WIDTH_MIN, startW + dx));
      panelWidthRef.current = next;
      setPanelWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      try {
        localStorage.setItem(SHEET_WIDTH_STORAGE_KEY, String(panelWidthRef.current));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex h-full max-w-none flex-col gap-0 overflow-hidden border-l p-0 shadow-xl !max-w-none"
        style={{
          width: `min(${panelWidthPx}px, calc(100vw - 12px))`,
        }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize panel"
          title="Drag to resize"
          className="absolute top-0 bottom-0 left-0 z-[60] flex w-4 cursor-col-resize touch-none items-center justify-center border-r border-transparent hover:border-border hover:bg-muted/50 active:bg-muted"
          onMouseDown={startResize}
        >
          <GripVertical className="size-4 text-muted-foreground opacity-70" aria-hidden />
        </div>

        <SheetHeader className="gap-2 border-b border-border/60 px-6 pb-5 pl-10 pr-7 pt-6 sm:px-8 sm:pb-6 sm:pl-12 sm:pr-10 sm:pt-7">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-amber-500" aria-hidden />
            Brainstorm Agents
          </SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            Three tabs: <strong>Brainstorm a thought</strong>, <strong>Guided studio session</strong>, and{" "}
            <strong>Next steps</strong> (consultant synthesis, MVP-style summaries, and converting idea cards to tasks).
            Uses <strong>canvas context</strong>, team and user agent context, and your <strong>Brand Center</strong> kit.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6 pb-8 pl-10 pr-7 sm:px-8 sm:pb-10 sm:pl-12 sm:pr-10">
          <BrainstormAIPanel
            sessionId={sessionId}
            workspaceId={workspaceId}
            embeddedInSheet
            suppressIntro
            className="min-h-0 w-full flex-1"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
