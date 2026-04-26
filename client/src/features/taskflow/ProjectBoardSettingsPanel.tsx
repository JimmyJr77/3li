import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { BoardDto, BoardUserPreferenceDto } from "./types";
import { NewTicketLabelForm } from "./NewTicketLabelForm";
import { patchBoard, patchBoardUserPreferences, postBoardLabel } from "./api";
import { UserTicketLabelsPanel } from "./UserTicketLabelsPanel";
import {
  CARD_FACE_META_KEYS,
  CARD_FACE_META_LABELS,
  normalizeCardFaceMetaInput,
} from "./cardFaceMeta";
import { TRACKER_LABELS, TRACKER_STATUSES, type TrackerStatus } from "./trackerMeta";

const DEFAULT_CARD_COLORS = [
  "#64748b",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#f97316",
] as const;

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
  const [newBoardLabelName, setNewBoardLabelName] = useState("");
  const [newBoardLabelColor, setNewBoardLabelColor] = useState("#6366f1");

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

  const createBoardLabelMutation = useMutation({
    mutationFn: () =>
      postBoardLabel(board.id, { name: newBoardLabelName.trim(), color: newBoardLabelColor }),
    onSuccess: (next) => {
      queryClient.setQueryData(["board", next.id], next);
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      setNewBoardLabelName("");
      setNewBoardLabelColor("#6366f1");
    },
  });

  const hiddenBoard = new Set(preference.defaultHiddenTrackerStatuses ?? []);
  const hiddenSubIds = new Set(preference.hiddenSubBoardIds ?? []);

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
        <p className="text-xs text-muted-foreground">
          Renames this project board everywhere it appears. Edit here instead of on the board page.
        </p>
        {renameMutation.isError ? (
          <p className="text-xs text-destructive">Could not rename. Try a different name or try again.</p>
        ) : null}
      </div>

      <div className="space-y-3 border-b border-border/60 pb-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Board labels (this board)</p>
          <p className="text-xs text-muted-foreground">
            Shared on every ticket on this board. Add labels here or from a ticket; creation looks the same everywhere.
          </p>
          {board.labels.length ? (
            <div className="flex flex-wrap gap-2">
              {board.labels.map((lb) => (
                <span
                  key={lb.id}
                  className="inline-flex h-8 items-center rounded-md border border-border/80 px-2.5 text-xs font-medium"
                  style={{ backgroundColor: `${lb.color}22`, borderColor: lb.color }}
                >
                  {lb.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No board labels yet.</p>
          )}
        </div>
        <NewTicketLabelForm
          title="New board label"
          hint="Creates a label on this project board. Attach it to tickets from each ticket’s Labels section."
          name={newBoardLabelName}
          onNameChange={setNewBoardLabelName}
          color={newBoardLabelColor}
          onColorChange={setNewBoardLabelColor}
          disabled={createBoardLabelMutation.isPending}
          pending={createBoardLabelMutation.isPending}
          onSubmit={() => createBoardLabelMutation.mutate()}
          submitLabel="Create"
          errorMessage={
            createBoardLabelMutation.isError
              ? "Could not create (duplicate name on this board?)."
              : null
          }
        />
      </div>

      {board.brandId ? (
        <div className="space-y-2 border-b border-border/60 pb-6">
          <p className="text-sm font-medium">Your ticket labels (this brand)</p>
          <p className="text-xs text-muted-foreground">
            Reusable across all project boards in this brand. Same create flow as on a ticket.
          </p>
          <UserTicketLabelsPanel brandId={board.brandId} boardId={board.id} mode="quick" />
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">Default ticket color (all sub-boards)</p>
        <p className="text-xs text-muted-foreground">
          Used when a sub-board does not set its own card color. Sub-board settings can still override.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              !preference.defaultTicketCardColor ? "border-primary text-foreground" : "text-muted-foreground",
            )}
            onClick={() => flush({ defaultTicketCardColor: null })}
          >
            None
          </button>
          {DEFAULT_CARD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "size-7 rounded-md border-2",
                preference.defaultTicketCardColor === color
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border",
              )}
              style={{ backgroundColor: color }}
              aria-label={`Default color ${color}`}
              onClick={() => flush({ defaultTicketCardColor: color })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2 border-b border-border/60 pb-6">
        <p className="text-sm font-medium">Default ticket card face</p>
        <p className="text-xs text-muted-foreground">
          Sub-boards you have not opened in options inherit this. Sub-board options can override layout and meta.
        </p>
        <select
          className="border-input bg-background h-9 max-w-md rounded-md border px-2 text-sm"
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
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Default visible tracker lanes</p>
        <p className="text-xs text-muted-foreground">
          Applies everywhere on this board until a sub-board sets its own lanes. Hidden sets are merged.
        </p>
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
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={preference.defaultCompleteCheckboxVisible !== false}
            onChange={(e) => flush({ defaultCompleteCheckboxVisible: e.target.checked })}
          />
          <span>Show complete checkbox on ticket cards by default</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Sub-board and per-ticket settings can still override.
        </p>
      </div>

      <div className="space-y-2 border-t border-border/60 pt-4">
        <p className="text-sm font-medium">Sub-boards visible in the tab strip</p>
        <p className="text-xs text-muted-foreground">
          Uncheck to hide a sub-board from your tabs on this board. At least one should stay visible.
        </p>
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
