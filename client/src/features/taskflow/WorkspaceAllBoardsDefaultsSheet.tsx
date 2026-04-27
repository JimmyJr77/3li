import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  RightAppSheetResizeHandle,
  useResizableRightAppSheetWidth,
  rightAppSheetContentClassName,
} from "@/hooks/useResizableRightAppSheetWidth";
import { cn } from "@/lib/utils";
import type { BoardUserPreferenceDto } from "./types";
import {
  applyUserBoardDefaultsForWorkspace,
  clearWorkspaceTaskCheckboxOverrides,
  fetchBoard,
  fetchBoardUserPreferences,
  patchSubBoardPreference,
} from "./api";
import {
  CARD_FACE_META_KEYS,
  CARD_FACE_META_LABELS,
  DEFAULT_CARD_FACE_META,
  normalizeCardFaceMetaInput,
  type CardFaceMeta,
} from "./cardFaceMeta";
import { TRACKER_LABELS, TRACKER_STATUSES, type TrackerStatus } from "./trackerMeta";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  boardCount: number;
  boardIds: string[];
};

function applyBodyFromState(args: {
  showBorder: boolean;
  showStrip: boolean;
  completeCb: boolean;
  hidden: TrackerStatus[];
  cardFaceLayout: "standard" | "minimal";
  cardFaceMeta: CardFaceMeta;
}) {
  return {
    showBoardAccentBorder: args.showBorder,
    showSubBoardAccentStrip: args.showStrip,
    defaultCompleteCheckboxVisible: args.completeCb,
    defaultHiddenTrackerStatuses: args.hidden,
    defaultCardFaceLayout: args.cardFaceLayout,
    defaultCardFaceMeta: args.cardFaceMeta,
  };
}

export function WorkspaceAllBoardsDefaultsSheet({
  open,
  onOpenChange,
  workspaceId,
  boardCount,
  boardIds,
}: Props) {
  const queryClient = useQueryClient();
  const sheetSizing = useResizableRightAppSheetWidth({ open });

  const [showBorder, setShowBorder] = useState(true);
  const [showStrip, setShowStrip] = useState(true);
  const [completeCb, setCompleteCb] = useState(true);
  const [hidden, setHidden] = useState<TrackerStatus[]>([]);
  const [cardFaceLayout, setCardFaceLayout] = useState<"standard" | "minimal">("standard");
  const [cardFaceMeta, setCardFaceMeta] = useState<CardFaceMeta>(() => ({ ...DEFAULT_CARD_FACE_META }));

  const seededKeyRef = useRef<string | null>(null);

  const prefQueries = useQueries({
    queries: boardIds.map((id) => ({
      queryKey: ["board-user-prefs", id] as const,
      queryFn: () => fetchBoardUserPreferences(id),
      enabled: open && boardIds.length > 0,
      staleTime: 30_000,
    })),
  });

  const prefLoadError = prefQueries.some((q) => q.isError);
  const allPrefsLoaded =
    boardIds.length === 0 ||
    (prefQueries.length > 0 &&
      prefQueries.every((q) => q.isFetched && !q.isPending) &&
      prefQueries.every((q) => q.isSuccess && q.data !== undefined));

  useEffect(() => {
    if (!open) {
      seededKeyRef.current = null;
      return;
    }
    if (!allPrefsLoaded || boardIds.length === 0) return;
    const rows = prefQueries.map((q) => q.data).filter(Boolean) as BoardUserPreferenceDto[];
    if (rows.length === 0) return;
    const seedKey = `${workspaceId}:${boardIds.join(",")}`;
    if (seededKeyRef.current === seedKey) return;
    seededKeyRef.current = seedKey;

    setShowBorder(rows.every((r) => r.showBoardAccentBorder !== false));
    setShowStrip(rows.every((r) => r.showSubBoardAccentStrip !== false));
    const r0 = rows[0]!;
    setCompleteCb(r0.defaultCompleteCheckboxVisible !== false);
    setHidden([...(r0.defaultHiddenTrackerStatuses ?? [])]);
    setCardFaceLayout(r0.defaultCardFaceLayout === "minimal" ? "minimal" : "standard");
    setCardFaceMeta(normalizeCardFaceMetaInput(r0.defaultCardFaceMeta));
  }, [open, workspaceId, boardIds, allPrefsLoaded, prefQueries]);

  const applyMutation = useMutation({
    mutationFn: (body: ReturnType<typeof applyBodyFromState>) =>
      applyUserBoardDefaultsForWorkspace(workspaceId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-user-prefs"] });
      queryClient.invalidateQueries({ queryKey: ["sub-board-prefs"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });

  const pushApply = (
    overrides: Partial<{
      showBorder: boolean;
      showStrip: boolean;
      completeCb: boolean;
      hidden: TrackerStatus[];
      cardFaceLayout: "standard" | "minimal";
      cardFaceMeta: CardFaceMeta;
    }>,
  ) => {
    const snap = {
      showBorder,
      showStrip,
      completeCb,
      hidden,
      cardFaceLayout,
      cardFaceMeta,
      ...overrides,
    };
    applyMutation.mutate(
      applyBodyFromState({
        showBorder: snap.showBorder,
        showStrip: snap.showStrip,
        completeCb: snap.completeCb,
        hidden: snap.hidden,
        cardFaceLayout: snap.cardFaceLayout,
        cardFaceMeta: snap.cardFaceMeta,
      }),
    );
  };

  async function allSubBoardListIds(): Promise<string[]> {
    const boards = await Promise.all(boardIds.map((id) => fetchBoard(id)));
    return boards.flatMap((b) => b.lists.map((l) => l.id));
  }

  const resetBorderSubordinatesMutation = useMutation({
    mutationFn: async () => {
      const ids = await allSubBoardListIds();
      await Promise.all(ids.map((id) => patchSubBoardPreference(id, { ticketCardColor: null })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-board-prefs"] });
    },
  });

  const resetStripSubordinatesMutation = useMutation({
    mutationFn: async () => {
      const ids = await allSubBoardListIds();
      await Promise.all(ids.map((id) => patchSubBoardPreference(id, { showSubBoardAccentStrip: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-board-prefs"] });
    },
  });

  const resetCardFaceCascadeMutation = useMutation({
    mutationFn: async () => {
      await applyUserBoardDefaultsForWorkspace(
        workspaceId,
        applyBodyFromState({
          showBorder,
          showStrip,
          completeCb,
          hidden,
          cardFaceLayout,
          cardFaceMeta,
        }),
      );
      const layout = cardFaceLayout;
      const checkbox = completeCb;
      const ids = await allSubBoardListIds();
      await Promise.all(
        ids.map((id) =>
          patchSubBoardPreference(id, {
            completeCheckboxVisibleByDefault: checkbox,
            cardFaceLayout: layout,
            cardFaceMeta: null,
          }),
        ),
      );
      await clearWorkspaceTaskCheckboxOverrides(workspaceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-user-prefs"] });
      queryClient.invalidateQueries({ queryKey: ["sub-board-prefs"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
    },
  });

  const resetTrackerSubordinatesMutation = useMutation({
    mutationFn: async () => {
      const hiddenCopy = [...hidden];
      await applyUserBoardDefaultsForWorkspace(
        workspaceId,
        applyBodyFromState({
          showBorder,
          showStrip,
          completeCb,
          hidden: hiddenCopy,
          cardFaceLayout,
          cardFaceMeta,
        }),
      );
      const ids = await allSubBoardListIds();
      await Promise.all(
        ids.map((id) =>
          patchSubBoardPreference(id, {
            hiddenTrackerStatuses: hiddenCopy,
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-user-prefs"] });
      queryClient.invalidateQueries({ queryKey: ["sub-board-prefs"] });
    },
  });

  const resetBusy =
    resetBorderSubordinatesMutation.isPending ||
    resetStripSubordinatesMutation.isPending ||
    resetCardFaceCascadeMutation.isPending ||
    resetTrackerSubordinatesMutation.isPending;

  const onTrackerChange = (st: TrackerStatus, checked: boolean) => {
    const nextHidden: TrackerStatus[] = checked
      ? hidden.filter((x) => x !== st)
      : [...hidden, st];
    const normalized =
      nextHidden.length >= TRACKER_STATUSES.length
        ? TRACKER_STATUSES.filter((x) => x !== "BACKLOG")
        : nextHidden;
    setHidden(normalized);
    pushApply({ hidden: normalized });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(rightAppSheetContentClassName, "!gap-0 min-h-0 overflow-hidden")}
        style={sheetSizing.sheetWidthStyle}
      >
        <RightAppSheetResizeHandle onMouseDown={sheetSizing.startResize} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SheetHeader className="border-b px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
            <SheetTitle>Project Area settings</SheetTitle>
            <SheetDescription>
              These settings apply to your view on every non-archived project board in this brand&apos;s workspace
              {boardCount > 0 ? ` (${boardCount} board${boardCount === 1 ? "" : "s"})` : ""}. Per-board and per-sub-board
              settings can still override where the app allows.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-6 px-5 py-4 pl-10 pr-6 sm:px-6 sm:pl-12 sm:pr-8">
              {applyMutation.isError ? (
                <p className="text-sm text-destructive">
                  Could not save settings. Check your connection and try again.
                </p>
              ) : null}
              {boardCount === 0 ? (
                <p className="text-sm text-muted-foreground">Add a project board first, then you can set defaults here.</p>
              ) : prefLoadError ? (
                <p className="text-sm text-destructive">
                  Could not load board preferences for this workspace. Check your connection and try closing and
                  reopening this panel.
                </p>
              ) : !allPrefsLoaded ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  Loading workspace board settings…
                </div>
              ) : (
                <>
                  <div className="space-y-2 border-b border-border/60 pb-6">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showBorder}
                        disabled={applyMutation.isPending || resetBusy}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setShowBorder(v);
                          pushApply({ showBorder: v });
                        }}
                      />
                      <span>Show colored border on tickets</span>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={applyMutation.isPending || resetBusy || boardIds.length === 0}
                      onClick={() => resetBorderSubordinatesMutation.mutate()}
                    >
                      Reset subordinates
                    </Button>
                    {resetBorderSubordinatesMutation.isError ? (
                      <p className="text-xs text-destructive">Could not reset per-sub-board card colors. Try again.</p>
                    ) : null}
                  </div>

                  <div className="space-y-2 border-b border-border/60 pb-6">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showStrip}
                        disabled={applyMutation.isPending || resetBusy}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setShowStrip(v);
                          pushApply({ showStrip: v });
                        }}
                      />
                      <span>Show colored strip on ticket cards (right edge)</span>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={applyMutation.isPending || resetBusy || boardIds.length === 0}
                      onClick={() => resetStripSubordinatesMutation.mutate()}
                    >
                      Reset subordinates
                    </Button>
                    {resetStripSubordinatesMutation.isError ? (
                      <p className="text-xs text-destructive">Could not reset sub-board strip preferences. Try again.</p>
                    ) : null}
                  </div>

                  <div className="border-b border-border/60 pb-6">
                    <p className="mb-2 text-sm font-medium">Default ticket view</p>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={completeCb}
                        disabled={applyMutation.isPending || resetBusy}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setCompleteCb(v);
                          pushApply({ completeCb: v });
                        }}
                      />
                      <span>Enable &quot;Done&quot; checkmark</span>
                    </label>
                    <select
                      className="border-input bg-background mt-3 h-9 max-w-md rounded-md border px-2 text-sm"
                      value={cardFaceLayout}
                      disabled={applyMutation.isPending || resetBusy}
                      onChange={(e) => {
                        const v = e.target.value === "minimal" ? "minimal" : "standard";
                        setCardFaceLayout(v);
                        pushApply({ cardFaceLayout: v });
                      }}
                    >
                      <option value="standard">Standard (title + meta)</option>
                      <option value="minimal">Title only</option>
                    </select>
                    {cardFaceLayout === "standard" ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Include on standard cards</p>
                        {CARD_FACE_META_KEYS.map((key) => (
                          <label key={key} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={cardFaceMeta[key]}
                              disabled={applyMutation.isPending || resetBusy}
                              onChange={(e) => {
                                const next = { ...cardFaceMeta, [key]: e.target.checked };
                                setCardFaceMeta(next);
                                pushApply({ cardFaceMeta: next });
                              }}
                            />
                            {CARD_FACE_META_LABELS[key]}
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      disabled={applyMutation.isPending || resetBusy || boardIds.length === 0}
                      onClick={() => resetCardFaceCascadeMutation.mutate()}
                    >
                      Reset subordinates
                    </Button>
                    {resetCardFaceCascadeMutation.isError ? (
                      <p className="text-xs text-destructive">
                        Could not cascade-reset card faces and ticket checkbox overrides. Try again.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2 border-b border-border/60 pb-6">
                    <p className="text-sm font-medium">Default visible tracker lanes</p>
                    <div className="space-y-2">
                      {TRACKER_STATUSES.map((st) => {
                        const checked = !hidden.includes(st);
                        return (
                          <label key={st} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={applyMutation.isPending || resetBusy}
                              onChange={(e) => onTrackerChange(st, e.target.checked)}
                            />
                            {TRACKER_LABELS[st]}
                          </label>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={applyMutation.isPending || resetBusy || boardIds.length === 0}
                      onClick={() => resetTrackerSubordinatesMutation.mutate()}
                    >
                      Reset subordinates
                    </Button>
                    {resetTrackerSubordinatesMutation.isError ? (
                      <p className="text-xs text-destructive">Could not reset sub-board tracker lanes. Try again.</p>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="shrink-0 border-t border-border bg-card/95 px-10 pt-3 pb-5 sm:px-12 sm:pb-6">
            <div className="flex flex-wrap items-center justify-start gap-2">
              <Button type="button" onClick={() => onOpenChange(false)} disabled={applyMutation.isPending}>
                Save & close
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
