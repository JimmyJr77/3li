import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteMyTicketLabel,
  fetchMyTicketLabels,
  patchMyTicketLabel,
  postMyTicketLabel,
} from "./api";
import type { UserTicketLabelDto } from "./types";

const DEFAULT_COLOR = "#6366f1";

function invalidateLabelQueries(qc: ReturnType<typeof useQueryClient>, brandId: string, boardId?: string) {
  qc.invalidateQueries({ queryKey: ["my-ticket-labels", brandId] });
  if (boardId) {
    qc.invalidateQueries({ queryKey: ["board", boardId] });
  } else {
    qc.invalidateQueries({ queryKey: ["board"] });
  }
  qc.invalidateQueries({ queryKey: ["tasks", "flat"] });
}

type UserTicketLabelsPanelProps = {
  brandId: string | null | undefined;
  /** When set, board task lists refresh after label changes. */
  boardId?: string;
  /** `manage` — full edit/delete (Settings). `quick` — add + delete only (sub-board sheet). */
  mode: "manage" | "quick";
};

export function UserTicketLabelsPanel({ brandId, boardId, mode }: UserTicketLabelsPanelProps) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [edits, setEdits] = useState<Record<string, { name: string; color: string }>>({});

  const q = useQuery({
    queryKey: ["my-ticket-labels", brandId],
    queryFn: () => fetchMyTicketLabels(brandId!),
    enabled: Boolean(brandId),
  });

  const createMut = useMutation({
    mutationFn: () => postMyTicketLabel(brandId!, { name: newName.trim(), color: newColor }),
    onSuccess: () => {
      setNewName("");
      setNewColor(DEFAULT_COLOR);
      invalidateLabelQueries(qc, brandId!, boardId);
    },
  });

  const patchMut = useMutation({
    mutationFn: (p: { id: string; name: string; color: string }) =>
      patchMyTicketLabel(brandId!, p.id, { name: p.name, color: p.color }),
    onSuccess: () => invalidateLabelQueries(qc, brandId!, boardId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMyTicketLabel(brandId!, id),
    onSuccess: () => invalidateLabelQueries(qc, brandId!, boardId),
  });

  if (!brandId) {
    return (
      <p className="text-sm text-muted-foreground">
        Brand context is unavailable here; open this board from a workspace to manage your ticket labels.
      </p>
    );
  }

  const rows = q.data ?? [];
  const busy = q.isLoading || createMut.isPending || patchMut.isPending || deleteMut.isPending;

  const rowDraft = (row: UserTicketLabelDto) =>
    edits[row.id] ?? { name: row.name, color: row.color };

  const flushEdit = (row: UserTicketLabelDto) => {
    const d = rowDraft(row);
    if (!d.name.trim()) return;
    if (d.name === row.name && d.color === row.color) return;
    patchMut.mutate({ id: row.id, name: d.name.trim(), color: d.color });
  };

  return (
    <div className="space-y-4">
      {q.isLoading ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
          Loading labels…
        </p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load your ticket labels.</p>
      ) : null}

      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">New label</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Name"
            value={newName}
            disabled={busy}
            onChange={(e) => setNewName(e.target.value)}
            className="sm:max-w-xs"
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Label color"
              value={newColor}
              disabled={busy}
              onChange={(e) => setNewColor(e.target.value)}
              className="size-9 cursor-pointer rounded border border-input bg-background p-0.5"
            />
            <Button
              type="button"
              size="sm"
              disabled={busy || !newName.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>
        {createMut.isError ? (
          <p className="text-xs text-destructive">Could not create (duplicate name?).</p>
        ) : null}
      </div>

      {mode === "quick" ? (
        <p className="text-xs text-muted-foreground">
          Rename and fine-tune colors in Settings → Ticket labels (this brand).
        </p>
      ) : null}

      <ul className="space-y-2">
        {rows.map((row) => {
          const d = rowDraft(row);
          return (
            <li
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              {mode === "manage" ? (
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={d.name}
                    disabled={busy}
                    onChange={(e) =>
                      setEdits((prev) => ({ ...prev, [row.id]: { ...d, name: e.target.value } }))
                    }
                    onBlur={() => flushEdit(row)}
                    className="sm:max-w-xs"
                  />
                  <input
                    type="color"
                    aria-label={`Color for ${row.name}`}
                    value={d.color}
                    disabled={busy}
                    onChange={(e) => {
                      const color = e.target.value;
                      setEdits((prev) => ({ ...prev, [row.id]: { ...d, color } }));
                    }}
                    onBlur={() => flushEdit(row)}
                    className="size-9 shrink-0 cursor-pointer rounded border border-input bg-background p-0.5"
                  />
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-3 shrink-0 rounded-sm border border-border"
                    style={{ backgroundColor: row.color }}
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium">{row.name}</span>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                disabled={busy}
                aria-label={`Delete label ${row.name}`}
                onClick={() => {
                  if (window.confirm(`Delete the label “${row.name}”? It will be removed from any tickets.`)) {
                    deleteMut.mutate(row.id);
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && !q.isLoading ? (
        <p className="text-sm text-muted-foreground">No custom labels yet. Add one above.</p>
      ) : null}
    </div>
  );
}
