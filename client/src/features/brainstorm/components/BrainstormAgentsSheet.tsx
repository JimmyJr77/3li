import { Sparkles } from "lucide-react";
import { BrainstormAIPanel } from "@/features/brainstorm/components/BrainstormAIPanel";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RightAppSheetResizeHandle, useResizableRightAppSheetWidth, rightAppSheetContentClassName } from "@/hooks/useResizableRightAppSheetWidth";
import { cn } from "@/lib/utils";

type BrainstormAgentsSheetProps = {
  sessionId: string;
  workspaceId: string;
};

export function BrainstormAgentsSheet({ sessionId, workspaceId }: BrainstormAgentsSheetProps) {
  const open = useBrainstormStore((s) => s.agentsPanelVisible);
  const setOpen = useBrainstormStore((s) => s.setAgentsPanelVisible);
  const { startResize, sheetWidthStyle } = useResizableRightAppSheetWidth({ open });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className={cn(rightAppSheetContentClassName, "overflow-hidden")}
        style={sheetWidthStyle}
      >
        <RightAppSheetResizeHandle onMouseDown={startResize} />

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
