import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteMyTicketLabel,
  fetchLabelSuggestions,
  fetchMyTicketLabels,
  patchMyTicketLabel,
  postMyTicketLabel,
} from "./api";
import { NewTicketLabelForm } from "./NewTicketLabelForm";
import {
  autoLabelColorFromName,
  mergeFrequentRecentLabelChips,
  searchRankLabelName,
  sortByLabelSearchRelevance,
  TASK_LABEL_CHIP_CLASS,
  type LabelSuggestionChip,
} from "./labelUiUtils";
import type { UserTicketLabelDto } from "./types";

function invalidateLabelQueries(qc: ReturnType<typeof useQueryClient>, brandId: string, boardId?: string) {
  qc.invalidateQueries({ queryKey: ["my-ticket-labels", brandId] });
  qc.invalidateQueries({ queryKey: ["label-suggestions", brandId] });
  if (boardId) {
    qc.invalidateQueries({ queryKey: ["board", boardId] });
  } else {
    qc.invalidateQueries({ queryKey: ["board"] });
  }
  qc.invalidateQueries({ queryKey: ["tasks", "flat"] });
}

type UserTicketLabelsPanelProps = {
  brandId: string | null | undefined;
  boardId?: string;
  mode: "manage" | "quick";
};

function UserLabelsQuickForm({
  brandId,
  boardId,
}: {
  brandId: string;
  boardId?: string;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const suggestQ = useQuery({
    queryKey: ["label-suggestions", brandId],
    queryFn: () => fetchLabelSuggestions(brandId),
    enabled: Boolean(brandId),
  });
  const allQ = useQuery({
    queryKey: ["my-ticket-labels", brandId],
    queryFn: () => fetchMyTicketLabels(brandId),
  });

  const createMut = useMutation({
    mutationFn: (name: string) => {
      const t = name.trim();
      if (!t) throw new Error("Name is required");
      return postMyTicketLabel(brandId, { name: t, color: autoLabelColorFromName(t) });
    },
    onSuccess: () => {
      setSearch("");
      invalidateLabelQueries(qc, brandId, boardId);
    },
  });

  const quickTiles = useMemo(() => {
    const f = (suggestQ.data?.frequent ?? []) as LabelSuggestionChip[];
    const r = (suggestQ.data?.recent ?? []) as LabelSuggestionChip[];
    return mergeFrequentRecentLabelChips(f, r, 8, 8);
  }, [suggestQ.data]);

  const searchTrim = search.trim();
  const searchMatches = useMemo(() => {
    const src = allQ.data ?? [];
    if (!searchTrim) return [];
    return sortByLabelSearchRelevance(src, searchTrim)
      .filter((l) => searchRankLabelName(searchTrim, l.name) < 9)
      .slice(0, 12);
  }, [allQ.data, searchTrim]);

  const exactNameExists = useMemo(() => {
    if (!searchTrim) return true;
    const lq = searchTrim.toLowerCase();
    return (allQ.data ?? []).some((l) => l.name.toLowerCase() === lq);
  }, [allQ.data, searchTrim]);

  if (!brandId) {
    return (
      <p className="text-sm text-muted-foreground">Brand context is required to use ticket labels here.</p>
    );
  }

  const busy = allQ.isLoading || createMut.isPending;
  return (
    <div className="space-y-2">
      {suggestQ.isLoading || allQ.isLoading ? (
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
          Loading labels…
        </p>
      ) : null}
      {suggestQ.isError || allQ.isError ? (
        <p className="text-xs text-destructive">Could not load label suggestions.</p>
      ) : null}

      {quickTiles.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {quickTiles.map((r) => (
            <span
              key={`${r.scope}-${r.id}`}
              className={TASK_LABEL_CHIP_CLASS + " text-white shadow-sm"}
              style={{ backgroundColor: r.color }}
              title={r.name}
            >
              {r.name}
            </span>
          ))}
        </div>
      ) : null}

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search or create a label…"
        className="h-8 text-sm"
        disabled={busy}
      />

      {searchTrim ? (
        <div className="space-y-2 rounded border border-border/50 bg-muted/20 px-2 py-1.5">
          {searchMatches.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {searchMatches.map((l) => (
                <span
                  key={l.id}
                  className={TASK_LABEL_CHIP_CLASS + " text-white shadow-sm"}
                  style={{ backgroundColor: l.color }}
                  title={l.name}
                >
                  {l.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No close matches. You can create a new label below.</p>
          )}
          {!exactNameExists && !createMut.isPending ? (
            <Button
              type="button"
              className="h-7 w-full text-xs"
              variant="secondary"
              disabled={busy}
              onClick={() => createMut.mutate(searchTrim)}
            >
              Create “{searchTrim}” (color is assigned; edit in Settings)
            </Button>
          ) : null}
          {createMut.isPending ? (
            <p className="text-xs text-muted-foreground">
              <Loader2 className="inline size-3.5 animate-spin" aria-hidden /> Creating…
            </p>
          ) : null}
          {createMut.isError ? (
            <p className="text-xs text-destructive">Name may already exist for this brand.</p>
          ) : null}
        </div>
      ) : null}

      {!suggestQ.isLoading && !allQ.isLoading && quickTiles.length === 0 && !searchTrim ? (
        <p className="text-xs text-muted-foreground">Search or create a label for this brand.</p>
      ) : null}
    </div>
  );
}

function UserLabelsManageList({
  brandId,
  boardId,
}: {
  brandId: string;
  boardId?: string;
}) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
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
      setNewColor("#6366f1");
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

  const rows = q.data ?? [];
  const busy = q.isLoading || createMut.isPending || patchMut.isPending || deleteMut.isPending;

  const rowDraft = (row: UserTicketLabelDto) => edits[row.id] ?? { name: row.name, color: row.color };

  const flushEdit = (row: UserTicketLabelDto) => {
    const d = rowDraft(row);
    if (!d.name.trim()) return;
    if (d.name === row.name && d.color === row.color) return;
    patchMut.mutate({ id: row.id, name: d.name.trim(), color: d.color });
  };

  return (
    <div className="space-y-3">
      {q.isLoading ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          Loading labels…
        </p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load your ticket labels.</p>
      ) : null}

      <NewTicketLabelForm
        title="New label"
        name={newName}
        onNameChange={setNewName}
        color={newColor}
        onColorChange={setNewColor}
        disabled={busy}
        pending={createMut.isPending}
        onSubmit={() => createMut.mutate()}
        submitLabel="Add"
        pendingLabel="Adding…"
        errorMessage={createMut.isError ? "Could not create (duplicate name?)." : null}
      />

      <ul className="space-y-1.5">
        {rows.map((row) => {
          const d = rowDraft(row);
          return (
            <li
              key={row.id}
              className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-card/40 px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center">
                <Input
                  value={d.name}
                  disabled={busy}
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [row.id]: { ...d, name: e.target.value } }))
                  }
                  onBlur={() => flushEdit(row)}
                  className="h-8 sm:max-w-xs"
                />
                <div className="flex items-center gap-2">
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
                    className="size-8 shrink-0 cursor-pointer rounded border border-input bg-background p-0.5"
                  />
                  <span
                    className={TASK_LABEL_CHIP_CLASS + " text-white"}
                    style={{ backgroundColor: d.color }}
                  >
                    {d.name.trim() || "Preview"}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
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

      {rows.length === 0 && !q.isLoading ? <p className="text-sm text-muted-foreground">No custom labels yet.</p> : null}
    </div>
  );
}

export function UserTicketLabelsPanel({ brandId, boardId, mode }: UserTicketLabelsPanelProps) {
  if (!brandId) {
    return (
      <p className="text-sm text-muted-foreground">
        Brand context is unavailable here; open this board from a workspace to manage your ticket labels.
      </p>
    );
  }

  if (mode === "quick") {
    return <UserLabelsQuickForm brandId={brandId} boardId={boardId} />;
  }
  return <UserLabelsManageList brandId={brandId} boardId={boardId} />;
}
