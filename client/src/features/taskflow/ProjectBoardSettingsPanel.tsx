import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { BoardDto, BoardUserPreferenceDto } from "./types";
import {
  fetchBoard,
  patchBoard,
  patchBoardList,
  patchBoardUserPreferences,
  patchSubBoardPreference,
} from "./api";
import {
  CARD_FACE_META_KEYS,
  CARD_FACE_META_LABELS,
  normalizeCardFaceMetaInput,
} from "./cardFaceMeta";
import { SUB_BOARD_ACCENT_PALETTE } from "./subBoardAccentPalette";
import { TRACKER_LABELS, TRACKER_STATUSES, type TrackerStatus } from "./trackerMeta";

type PatchBody = Parameters<typeof patchBoardUserPreferences>[1];

export function ProjectBoardSettingsPanel({
  board,
  preference,
}: {
  board: BoardDto;
  preference: BoardUserPreferenceDto;
}) {
  const queryClient = useQueryClient();
  const [nameDraft, setNameDraft] = useState(board.name);

  const boardQuery = useQuery({
    queryKey: ["board", board.id],
    queryFn: () => fetchBoard(board.id),
    staleTime: 60_000,
  });
  const liveBoard = boardQuery.data ?? board;

  const listsByPosition = useMemo(
    () => [...liveBoard.lists].sort((a, b) => a.position - b.position),
    [liveBoard.lists],
  );

  useEffect(() => {
    setNameDraft(board.name);
  }, [board.id, board.name]);

  const renameMutation = useMutation({
    mutationFn: (name: string) => patchBoard(board.id, { name }),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", next.id], next);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });

  const accentMutation = useMutation({
    mutationFn: (accentColor: string) => patchBoard(board.id, { accentColor }),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", next.id], next);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });

  const listAccentMutation = useMutation({
    mutationFn: ({ listId, accentColor }: { listId: string; accentColor: string }) =>
      patchBoardList(board.id, listId, { accentColor }),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", next.id], next);
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
    },
  });

  const resetCardFaceSubordinatesMutation = useMutation({
    mutationFn: async () => {
      const layout = preference.defaultCardFaceLayout === "minimal" ? "minimal" : "standard";
      const checkbox = preference.defaultCompleteCheckboxVisible !== false;
      await Promise.all(
        listsByPosition.map((list) =>
          patchSubBoardPreference(list.id, {
            completeCheckboxVisibleByDefault: checkbox,
            cardFaceLayout: layout,
            cardFaceMeta: null,
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-board-prefs", board.id] });
    },
  });

  const resetTrackerSubordinatesMutation = useMutation({
    mutationFn: async () => {
      const hidden = [...(preference.defaultHiddenTrackerStatuses ?? [])];
      await Promise.all(
        listsByPosition.map((list) =>
          patchSubBoardPreference(list.id, {
            hiddenTrackerStatuses: hidden,
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-board-prefs", board.id] });
    },
  });

  const resetSubBoardColorsMutation = useMutation({
    mutationFn: async () => {
      const palette = SUB_BOARD_ACCENT_PALETTE;
      const results = await Promise.all(
        listsByPosition.map((list, i) =>
          patchBoardList(board.id, list.id, {
            accentColor: palette[i % palette.length]!,
          }),
        ),
      );
      const last = results[results.length - 1];
      if (last) queryClient.setQueryData(["board", board.id], last);
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
    },
  });

  /** Clears per-sub-board ticket card color overrides so cards use this board accent (when border is on). */
  const resetBoardAccentSubordinatesMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        listsByPosition.map((list) =>
          patchSubBoardPreference(list.id, {
            ticketCardColor: null,
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-board-prefs", board.id] });
    },
  });

  const commitBoardName = () => {
    const next = nameDraft.trim();
    if (!next) {
      setNameDraft(board.name);
      return;
    }
    if (next === board.name) return;
    renameMutation.mutate(next);
  };

  const mutation = useMutation({
    mutationFn: (body: PatchBody) => patchBoardUserPreferences(board.id, body),
    onSuccess: (next) => {
      queryClient.setQueryData(["board-user-prefs", board.id], next);
    },
  });

  const flush = (body: PatchBody) => {
    mutation.mutate(body);
  };

  const hiddenBoard = new Set(preference.defaultHiddenTrackerStatuses ?? []);
  const hiddenSubIds = new Set(preference.hiddenSubBoardIds ?? []);

  const resetSubordinatesBusy =
    resetCardFaceSubordinatesMutation.isPending ||
    resetTrackerSubordinatesMutation.isPending ||
    resetSubBoardColorsMutation.isPending ||
    resetBoardAccentSubordinatesMutation.isPending;

  return (
    <div className="space-y-6 px-5 py-2 pb-10 pl-10 pr-6 sm:px-7 sm:pl-12 sm:pr-8">
      <div className="space-y-2 border-b border-border/60 pb-4">
        <Label htmlFor="project-board-name" className="text-sm font-medium">
          Board name
        </Label>
        <Input
          id="project-board-name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitBoardName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          disabled={renameMutation.isPending}
          className="max-w-md"
          aria-label="Board name"
        />
        {renameMutation.isError ? (
          <p className="text-xs text-destructive">Could not rename. Try a different name or try again.</p>
        ) : null}
      </div>

      <div className="space-y-2 border-b border-border/60 pb-6">
        <p className="text-sm font-medium">Project board accent color</p>
        <div className="flex flex-wrap gap-2">
          {SUB_BOARD_ACCENT_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "size-7 rounded-md border-2",
                (liveBoard.accentColor ?? "").toLowerCase() === color.toLowerCase()
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border",
              )}
              style={{ backgroundColor: color }}
              aria-label={`Board accent ${color}`}
              disabled={accentMutation.isPending || resetSubordinatesBusy}
              onClick={() => accentMutation.mutate(color)}
            />
          ))}
        </div>
        {accentMutation.isError ? (
          <p className="text-xs text-destructive">Could not update accent. Try again.</p>
        ) : null}
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={preference.showBoardAccentBorder !== false}
            onChange={(e) => flush({ showBoardAccentBorder: e.target.checked })}
          />
          <span>Show colored border on tickets</span>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={resetSubordinatesBusy || listsByPosition.length === 0}
          onClick={() => resetBoardAccentSubordinatesMutation.mutate()}
        >
          Reset subordinates
        </Button>
        {resetBoardAccentSubordinatesMutation.isError ? (
          <p className="text-xs text-destructive">Could not reset per-sub-board card colors. Try again.</p>
        ) : null}
      </div>

      <div className="space-y-2 border-b border-border/60 pb-6">
        <p className="text-sm font-medium">Sub-board accent strip colors</p>
        <div className="space-y-3">
          {listsByPosition.map((list) => (
            <div key={list.id} className="space-y-1.5">
              <p className="truncate text-xs font-medium text-muted-foreground">{list.title}</p>
              <div className="flex flex-wrap gap-2">
                {SUB_BOARD_ACCENT_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "size-7 rounded-md border-2",
                      String(list.accentColor ?? "").toLowerCase() === color.toLowerCase()
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border",
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`${list.title} accent ${color}`}
                    disabled={listAccentMutation.isPending || resetSubBoardColorsMutation.isPending}
                    onClick={() => listAccentMutation.mutate({ listId: list.id, accentColor: color })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={resetSubordinatesBusy || listsByPosition.length === 0}
          onClick={() => resetSubBoardColorsMutation.mutate()}
        >
          Reset subordinates
        </Button>
        {resetSubBoardColorsMutation.isError ? (
          <p className="text-xs text-destructive">Could not reset sub-board colors. Try again.</p>
        ) : null}
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={preference.showSubBoardAccentStrip !== false}
            onChange={(e) => flush({ showSubBoardAccentStrip: e.target.checked })}
          />
          <span>Show colored strip on ticket cards (right edge)</span>
        </label>
      </div>

      <div className="border-b border-border/60 pb-6">
        <p className="mb-2 text-sm font-medium">Default ticket view</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={preference.defaultCompleteCheckboxVisible !== false}
            onChange={(e) => flush({ defaultCompleteCheckboxVisible: e.target.checked })}
          />
          <span>Enable &quot;Done&quot; checkmark</span>
        </label>
        <select
          className="border-input bg-background mt-3 h-9 max-w-md rounded-md border px-2 text-sm"
          value={preference.defaultCardFaceLayout === "minimal" ? "minimal" : "standard"}
          onChange={(e) =>
            flush({ defaultCardFaceLayout: e.target.value === "minimal" ? "minimal" : "standard" })
          }
        >
          <option value="standard">Standard (title + meta)</option>
          <option value="minimal">Title only</option>
        </select>
        {(preference.defaultCardFaceLayout ?? "standard") !== "minimal" ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Include on standard cards</p>
            {CARD_FACE_META_KEYS.map((key) => {
              const meta = normalizeCardFaceMetaInput(preference.defaultCardFaceMeta);
              return (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={meta[key]}
                    onChange={(e) =>
                      flush({
                        defaultCardFaceMeta: { ...meta, [key]: e.target.checked },
                      })
                    }
                  />
                  {CARD_FACE_META_LABELS[key]}
                </label>
              );
            })}
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={resetSubordinatesBusy || listsByPosition.length === 0}
          onClick={() => resetCardFaceSubordinatesMutation.mutate()}
        >
          Reset subordinates
        </Button>
        {resetCardFaceSubordinatesMutation.isError ? (
          <p className="text-xs text-destructive">Could not reset sub-board card faces. Try again.</p>
        ) : null}
      </div>

      <div className="space-y-2 border-b border-border/60 pb-6">
        <p className="text-sm font-medium">Default visible tracker lanes</p>
        <div className="space-y-2">
          {TRACKER_STATUSES.map((st) => {
            const checked = !hiddenBoard.has(st);
            return (
              <label key={st} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const nextHidden: TrackerStatus[] = e.target.checked
                      ? preference.defaultHiddenTrackerStatuses.filter((x) => x !== st)
                      : [...preference.defaultHiddenTrackerStatuses, st];
                    const normalized =
                      nextHidden.length >= TRACKER_STATUSES.length
                        ? TRACKER_STATUSES.filter((x) => x !== "BACKLOG")
                        : nextHidden;
                    flush({ defaultHiddenTrackerStatuses: normalized });
                  }}
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
          disabled={resetSubordinatesBusy || listsByPosition.length === 0}
          onClick={() => resetTrackerSubordinatesMutation.mutate()}
        >
          Reset subordinates
        </Button>
        {resetTrackerSubordinatesMutation.isError ? (
          <p className="text-xs text-destructive">Could not reset sub-board tracker lanes. Try again.</p>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-border/60 pt-4">
        <p className="text-sm font-medium">Sub-boards visible in the tab strip</p>
        <div className="space-y-2">
          {board.lists.map((list) => {
            const visible = !hiddenSubIds.has(list.id);
            return (
              <label key={list.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={visible}
                  disabled={visible && board.lists.filter((l) => !hiddenSubIds.has(l.id)).length <= 1}
                  onChange={(e) => {
                    const next = new Set(hiddenSubIds);
                    if (e.target.checked) next.delete(list.id);
                    else next.add(list.id);
                    const hidden = [...next];
                    const visibleCount = board.lists.length - hidden.length;
                    if (visibleCount < 1) return;
                    flush({ hiddenSubBoardIds: hidden });
                  }}
                />
                <span className="min-w-0 truncate">{list.title}</span>
              </label>
            );
          })}
        </div>
      </div>

      {mutation.isPending ? <p className="text-xs text-muted-foreground">Saving…</p> : null}
      {mutation.isError ? (
        <p className="text-xs text-destructive">Could not save. Try again.</p>
      ) : null}
    </div>
  );
}
