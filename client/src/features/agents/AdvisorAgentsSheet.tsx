import { Users } from "lucide-react";
import { useState } from "react";
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
import { RightAppSheetResizeHandle, useResizableRightAppSheetWidth, rightAppSheetContentClassName } from "@/hooks/useResizableRightAppSheetWidth";
import { cn } from "@/lib/utils";

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
  const { startResize, sheetWidthStyle } = useResizableRightAppSheetWidth({ open });

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
        className={cn(rightAppSheetContentClassName, "overflow-hidden")}
        style={sheetWidthStyle}
      >
        <RightAppSheetResizeHandle onMouseDown={startResize} />

        <SheetHeader className="shrink-0 gap-2 border-b border-border/60 px-6 pb-5 pl-10 pr-7 pt-6 sm:px-8 sm:pb-6 sm:pl-12 sm:pr-10 sm:pt-7">
          <SheetTitle className="text-lg">Advisor Agents</SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            One panel for this page’s primary dialogue: optional thinking level, context, prompt chips (summarize through
            brand and challenge presets), then <strong>Advise</strong> to run. Routing picks consultant, red team, or both
            from the prompt you chose.
            {captureMaterial !== undefined ?
              " Scope: the Rapid Router Capture field."
            : noteAi ?
              " Scope: the open note in the editor (title + body)."
            : " Open a note or add Rapid Router capture text so there is material to work with."}{" "}
            Nothing here sees the rest of the app unless you paste it.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8 pl-10 pr-7 sm:px-8 sm:pb-10 sm:pl-12 sm:pr-10">
          <RedTeamPanel
            key={[
              workspaceId,
              noteAi?.note.id ?? "",
              noteAi?.offline ? "offline" : "online",
            ].join(":")}
            workspaceId={workspaceId}
            contextHint={contextHint}
            {...(captureMaterial !== undefined ? { captureMaterial } : {})}
            noteAi={noteAi}
            className="w-full"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
