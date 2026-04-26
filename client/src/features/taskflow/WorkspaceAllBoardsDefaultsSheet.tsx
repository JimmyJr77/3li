import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  RightAppSheetResizeHandle,
  useResizableRightAppSheetWidth,
  rightAppSheetContentClassName,
} from "@/hooks/useResizableRightAppSheetWidth";
import { cn } from "@/lib/utils";
import { applyUserBoardDefaultsForWorkspace } from "./api";
import { TRACKER_LABELS, TRACKER_STATUSES, type TrackerStatus } from "./trackerMeta";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  boardCount: number;
};

export function WorkspaceAllBoardsDefaultsSheet({ open, onOpenChange, workspaceId, boardCount }: Props) {
  const queryClient = useQueryClient();
  const [completeCb, setCompleteCb] = useState(true);
  const [hidden, setHidden] = useState<TrackerStatus[]>([]);
  const [showAllSubTabs, setShowAllSubTabs] = useState(false);
  const sheetSizing = useResizableRightAppSheetWidth({ open });

  useEffect(() => {
    if (!open) return;
    setCompleteCb(true);
    setHidden([]);
    setShowAllSubTabs(false);
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      applyUserBoardDefaultsForWorkspace(workspaceId, {
        defaultCompleteCheckboxVisible: completeCb,
        defaultHiddenTrackerStatuses: hidden,
        subBoardTabVisibility: showAllSubTabs ? "show_all" : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-user-prefs"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      onOpenChange(false);
    },
  });

  const onTrackerChange = (st: TrackerStatus, checked: boolean) => {
    setHidden((prev) => {
      const nextHidden: TrackerStatus[] = checked
        ? prev.filter((x) => x !== st)
        : [...prev, st];
      return nextHidden.length >= TRACKER_STATUSES.length
        ? TRACKER_STATUSES.filter((x) => x !== "BACKLOG")
        : nextHidden;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(rightAppSheetContentClassName, "overflow-y-auto")}
        style={sheetSizing.sheetWidthStyle}
      >
        <RightAppSheetResizeHandle onMouseDown={sheetSizing.startResize} />
        <SheetHeader className="border-b px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
          <SheetTitle>Defaults for all project boards</SheetTitle>
          <SheetDescription>
            These settings apply to your view on every non-archived project board in this brand&apos;s workspace
            {boardCount > 0 ? ` (${boardCount} board${boardCount === 1 ? "" : "s"})` : ""}. Per-board and per-sub-board
            options can still override where the app allows.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
          {mutation.isError ? (
            <p className="text-sm text-destructive">Could not apply defaults. Check your connection and try again.</p>
          ) : null}
          {boardCount === 0 ? (
            <p className="text-sm text-muted-foreground">Add a project board first, then you can set defaults here.</p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={completeCb}
                    onChange={(e) => setCompleteCb(e.target.checked)}
                  />
                  <span>Show complete checkbox on ticket cards by default</span>
                </label>
                <p className="text-xs text-muted-foreground">Matches the &quot;complete checkbox&quot; default in each project board&apos;s settings (sliders icon).</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Default visible tracker lanes</p>
                <p className="text-xs text-muted-foreground">
                  These are the status columns on each sub-board. Uncheck a lane to hide it by default; sub-board settings
                  can still override.
                </p>
                <div className="space-y-2">
                  {TRACKER_STATUSES.map((st) => {
                    const isVisible = !hidden.includes(st);
                    return (
                      <label key={st} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={(e) => onTrackerChange(st, e.target.checked)}
                        />
                        {TRACKER_LABELS[st]}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2 border-t border-border/60 pt-4">
                <p className="text-sm font-medium">Sub-board tabs (task lists)</p>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showAllSubTabs}
                    onChange={(e) => setShowAllSubTabs(e.target.checked)}
                  />
                  <span>Show all sub-board tabs on every project board</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Clears which sub-boards you had hidden in the horizontal tab strip, on every board at once. You can hide
                  tabs again in each project board&apos;s settings.
                </p>
              </div>
            </>
          )}
        </div>
        <SheetFooter className="border-t px-5 py-4 sm:px-6">
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={boardCount === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Applying…
                </>
              ) : (
                "Apply to all boards"
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
