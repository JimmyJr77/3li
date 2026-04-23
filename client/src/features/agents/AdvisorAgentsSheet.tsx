import { GripVertical, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RedTeamPanel } from "@/features/agents/RedTeamPanel";
import type { AtlasNoteDto } from "@/features/notes/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const SHEET_WIDTH_STORAGE_KEY = "advisorAgentsSheetWidthPx";
const SHEET_WIDTH_DEFAULT = 640;
const SHEET_WIDTH_MIN = 380;
const SHEET_WIDTH_MAX = 1200;

export type AdvisorAgentsSheetNoteAi = {
  note: AtlasNoteDto;
  onUpdated: () => void;
  offline?: boolean;
};

export type AdvisorAgentsSheetProps = {
  workspaceId: string | null | undefined;
  /** Rapid Router: agents use this as captured material. */
  captureMaterial?: string;
  /** Notebooks: title + preview as agent context when not using capture mode. */
  contextHint?: string;
  noteAi?: AdvisorAgentsSheetNoteAi;
};

export function AdvisorAgentsSheet({
  workspaceId,
  captureMaterial,
  contextHint = "",
  noteAi,
}: AdvisorAgentsSheetProps) {
  const [open, setOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(SHEET_WIDTH_DEFAULT);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  const panelWidthPx = useMemo(() => {
    const w = Number.isFinite(panelWidth) && panelWidth > 0 ? panelWidth : SHEET_WIDTH_DEFAULT;
    return Math.min(SHEET_WIDTH_MAX, Math.max(SHEET_WIDTH_MIN, w));
  }, [panelWidth]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHEET_WIDTH_STORAGE_KEY);
      const n = raw ? Number.parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n >= SHEET_WIDTH_MIN && n <= SHEET_WIDTH_MAX) {
        setPanelWidth(n);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
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

  if (!workspaceId) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Users className="size-4" aria-hidden />
          Advisor Agents
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full max-w-none flex-col gap-0 overflow-y-auto border-l p-0 shadow-xl !max-w-none"
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
          <SheetTitle className="text-lg">Advisor Agents</SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            AI Tools, Red Team, and AI Consultant each respond to the <strong>primary dialogue on this page only</strong>
            {captureMaterial !== undefined ?
              " — the Rapid Router Capture field."
            : noteAi ?
              " — the open note in the editor (title + body)."
            : " — open a note or use Rapid Router with capture text so the agents have material to work with."}{" "}
            They do not see the rest of the app unless you paste it here.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6 pb-8 pl-10 pr-7 sm:px-8 sm:pb-10 sm:pl-12 sm:pr-10">
          <RedTeamPanel
            workspaceId={workspaceId}
            contextHint={contextHint}
            {...(captureMaterial !== undefined ? { captureMaterial } : {})}
            noteAi={noteAi}
            className="min-h-0 w-full flex-1"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
