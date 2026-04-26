import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  fetchBoard,
  fetchLabelSuggestions,
  fetchMyTicketLabels,
  postMyTicketLabel,
} from "@/features/taskflow/api";
import { TicketStyleLabelsBlock } from "@/features/taskflow/TicketStyleLabelsBlock";
import {
  autoLabelColorFromName,
  mergeFrequentRecentLabelChips,
  searchRankLabelName,
  sortByLabelSearchRelevance,
  TASK_LABEL_CHIP_CLASS,
} from "@/features/taskflow/labelUiUtils";
import { cn } from "@/lib/utils";
import {
  addNoteBoardLabel,
  addNoteUserTicketLabel,
  postNoteMailClerkAutotag,
  removeNoteBoardLabel,
  removeNoteUserTicketLabel,
} from "./api";
import type { AtlasNoteDto, MailClerkAutotagSuggestionDto } from "./types";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-xs font-medium text-muted-foreground">{children}</Label>;
}

function autotagSuggestionKey(s: MailClerkAutotagSuggestionDto, index: number) {
  return s.match ? `${s.match.kind}:${s.match.id}` : `new:${index}:${s.name.toLowerCase()}`;
}

export function NoteLabelsSection({
  note,
  brandId,
  defaultLabelBoardId,
  offline,
}: {
  note: AtlasNoteDto;
  brandId: string | null;
  defaultLabelBoardId: string | null;
  /** Browser-only local store — labels need the hosted workspace + task APIs. */
  offline?: boolean;
}) {
  const qc = useQueryClient();
  const [labelSearch, setLabelSearch] = useState("");
  const [autotagSuggestions, setAutotagSuggestions] = useState<MailClerkAutotagSuggestionDto[] | null>(null);
  const [autotagThemes, setAutotagThemes] = useState<string[] | null>(null);
  const [autotagSelected, setAutotagSelected] = useState<Set<string>>(() => new Set());
  const [applyAutotagBusy, setApplyAutotagBusy] = useState(false);

  useEffect(() => {
    setAutotagSuggestions(null);
    setAutotagThemes(null);
    setAutotagSelected(new Set());
  }, [note.id]);

  const boardQuery = useQuery({
    queryKey: ["board", defaultLabelBoardId],
    queryFn: () => fetchBoard(defaultLabelBoardId!),
    enabled: Boolean(!offline && defaultLabelBoardId),
  });
  const board = boardQuery.data ?? null;
  const brandIdForMyLabels = board?.brandId ?? brandId;

  const myTicketLabelsQuery = useQuery({
    queryKey: ["my-ticket-labels", brandIdForMyLabels],
    queryFn: () => fetchMyTicketLabels(brandIdForMyLabels!),
    enabled: Boolean(!offline && brandIdForMyLabels),
  });
  const labelSuggestQuery = useQuery({
    queryKey: ["label-suggestions", brandIdForMyLabels],
    queryFn: () => fetchLabelSuggestions(brandIdForMyLabels!),
    enabled: Boolean(!offline && brandIdForMyLabels),
  });

  const invalidateNotes = () => {
    void qc.invalidateQueries({ queryKey: ["notes-app"] });
  };

  const invalidateSuggestions = () => {
    if (brandIdForMyLabels) {
      void qc.invalidateQueries({ queryKey: ["label-suggestions", brandIdForMyLabels] });
    }
  };

  const hasLabelOnNote = (scope: "board" | "user", labelId: string) =>
    note.labels.some(
      (x) =>
        x.label.id === labelId &&
        (scope === "user" ? x.labelScope === "user" : x.labelScope !== "user"),
    );

  const suggestionAlreadyOnNote = (s: MailClerkAutotagSuggestionDto) => {
    if (s.match) return hasLabelOnNote(s.match.kind, s.match.id);
    return note.labels.some((x) => x.label.name.toLowerCase() === s.name.toLowerCase());
  };

  const toggleBoardLabel = (labelId: string, has: boolean) => {
    const p = has ? removeNoteBoardLabel(note.id, labelId) : addNoteBoardLabel(note.id, labelId);
    void p.then(() => {
      invalidateNotes();
      invalidateSuggestions();
    });
  };

  const toggleUserLabel = (labelId: string, has: boolean) => {
    const p = has ? removeNoteUserTicketLabel(note.id, labelId) : addNoteUserTicketLabel(note.id, labelId);
    void p.then(() => {
      invalidateNotes();
      invalidateSuggestions();
    });
  };

  const createMyLabelMutation = useMutation({
    mutationFn: (p: { name: string }) =>
      postMyTicketLabel(brandIdForMyLabels!, { name: p.name, color: autoLabelColorFromName(p.name) }),
    onSuccess: async (row) => {
      if (!brandIdForMyLabels) return;
      await qc.invalidateQueries({ queryKey: ["my-ticket-labels", brandIdForMyLabels] });
      await qc.invalidateQueries({ queryKey: ["label-suggestions", brandIdForMyLabels] });
      await addNoteUserTicketLabel(note.id, row.id);
      setLabelSearch("");
      invalidateNotes();
    },
  });

  const labelSearchMatches = useMemo(() => {
    if (!board) return [];
    const raw = labelSearch.trim();
    const q = raw.toLowerCase();
    if (!q) return [];
    const fromBoard = board.labels.map((l) => ({
      scope: "board" as const,
      id: l.id,
      name: l.name,
      color: l.color,
    }));
    const fromUser = (myTicketLabelsQuery.data ?? []).map((l) => ({
      scope: "user" as const,
      id: l.id,
      name: l.name,
      color: l.color,
    }));
    const seen = new Set<string>();
    const merged: ((typeof fromBoard)[number] | (typeof fromUser)[number])[] = [];
    for (const x of [...fromBoard, ...fromUser]) {
      const k = `${x.scope}:${x.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(x);
    }
    return sortByLabelSearchRelevance(merged, raw).filter((m) => searchRankLabelName(raw, m.name) < 9);
  }, [board, labelSearch, myTicketLabelsQuery.data]);

  const labelQuickTiles = useMemo(() => {
    const frequent = labelSuggestQuery.data?.frequent ?? [];
    const recent = labelSuggestQuery.data?.recent ?? [];
    return mergeFrequentRecentLabelChips(frequent, recent, 8, 8);
  }, [labelSuggestQuery.data]);

  const mailClerkAutotag = useMutation({
    mutationFn: () => postNoteMailClerkAutotag(note.id),
    onSuccess: (data) => {
      const rows = data.suggestions ?? [];
      setAutotagThemes(data.themes?.length ? data.themes : null);
      setAutotagSuggestions(rows);
      const next = new Set<string>();
      rows.forEach((s, i) => {
        if (!suggestionAlreadyOnNote(s)) next.add(autotagSuggestionKey(s, i));
      });
      setAutotagSelected(next);
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { status?: number; data?: { detail?: string; error?: string } } };
      const d = ax.response?.data?.detail ?? ax.response?.data?.error;
      window.alert(d ?? "Mail Clerk autotag failed. Check AI configuration and try again.");
    },
  });

  const toggleAutotagPick = (key: string) => {
    setAutotagSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const applyAutotagSelections = async () => {
    if (!autotagSuggestions?.length || !brandIdForMyLabels) return;
    const my = myTicketLabelsQuery.data ?? [];
    setApplyAutotagBusy(true);
    try {
      const usedNewLower = new Set<string>();
      for (let i = 0; i < autotagSuggestions.length; i++) {
        const s = autotagSuggestions[i]!;
        const key = autotagSuggestionKey(s, i);
        if (!autotagSelected.has(key)) continue;
        if (suggestionAlreadyOnNote(s)) continue;

        if (s.match) {
          if (s.match.kind === "user") {
            await addNoteUserTicketLabel(note.id, s.match.id);
          } else {
            await addNoteBoardLabel(note.id, s.match.id);
          }
        } else {
          const nk = s.name.toLowerCase();
          if (usedNewLower.has(nk)) continue;
          usedNewLower.add(nk);
          const existingPersonal = my.find((l) => l.name.toLowerCase() === nk);
          if (existingPersonal) {
            await addNoteUserTicketLabel(note.id, existingPersonal.id);
          } else {
            const row = await postMyTicketLabel(brandIdForMyLabels, {
              name: s.name,
              color: autoLabelColorFromName(s.name),
            });
            await addNoteUserTicketLabel(note.id, row.id);
          }
        }
      }
      setAutotagSuggestions(null);
      setAutotagThemes(null);
      setAutotagSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["my-ticket-labels", brandIdForMyLabels] });
      invalidateSuggestions();
      if (defaultLabelBoardId) void qc.invalidateQueries({ queryKey: ["board", defaultLabelBoardId] });
      invalidateNotes();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      window.alert(ax.response?.data?.error ?? "Could not apply one or more labels.");
    } finally {
      setApplyAutotagBusy(false);
    }
  };

  const busy =
    mailClerkAutotag.isPending ||
    createMyLabelMutation.isPending ||
    boardQuery.isFetching ||
    applyAutotagBusy;

  const autotagApplyCount = autotagSuggestions
    ? autotagSuggestions.filter((s, i) => autotagSelected.has(autotagSuggestionKey(s, i))).length
    : 0;

  if (offline) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel>Labels</FieldLabel>
        </div>
        <p className="text-xs text-muted-foreground">
          Ticket-style labels are available when this notebook is connected to your workspace (not browser-only
          mode).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 gap-1 text-xs"
          disabled={busy || !brandIdForMyLabels}
          title="Mail Clerk: suggest labels from your note and workspace activity. Pick which ones to add."
          onClick={() => mailClerkAutotag.mutate()}
        >
          {mailClerkAutotag.isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-3.5" aria-hidden />
          )}
          Autotag
        </Button>
      </div>

      {autotagSuggestions ? (
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Suggested from your note</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={busy}
              onClick={() => {
                setAutotagSuggestions(null);
                setAutotagThemes(null);
                setAutotagSelected(new Set());
              }}
            >
              Dismiss
            </Button>
          </div>
          {autotagThemes && autotagThemes.length > 0 ? (
            <div className="rounded-md border border-border/40 bg-background/50 px-2 py-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Themes from note</p>
              <ul className="mt-1 list-inside list-disc text-xs text-foreground">
                {autotagThemes.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {autotagSuggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No suggestions this run. Add more body text or try again.</p>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground">
                Click to toggle. New names become your personal ticket labels for this brand, then attach to this
                note. Existing board or personal labels attach directly.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {autotagSuggestions.map((s, i) => {
                  const key = autotagSuggestionKey(s, i);
                  const onNote = suggestionAlreadyOnNote(s);
                  const selected = autotagSelected.has(key);
                  const bg = s.match?.color ?? autoLabelColorFromName(s.name);
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={onNote || busy}
                      title={
                        onNote
                          ? "Already on this note"
                          : selected
                            ? "Click to skip applying"
                            : "Click to include when applying"
                      }
                      className={cn(
                        TASK_LABEL_CHIP_CLASS,
                        "max-w-full border-0 text-left text-white transition-opacity disabled:opacity-40",
                        !selected && !onNote && "ring-1 ring-border/50 ring-offset-0 opacity-85",
                        selected && !onNote && "ring-2 ring-primary ring-offset-1",
                      )}
                      style={{ backgroundColor: bg }}
                      onClick={() => {
                        if (onNote || busy) return;
                        toggleAutotagPick(key);
                      }}
                    >
                      {s.name}
                      {onNote ? " · on note" : ""}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={busy || autotagApplyCount === 0}
                  onClick={() => void applyAutotagSelections()}
                >
                  {applyAutotagBusy ? (
                    <>
                      <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                      Applying…
                    </>
                  ) : (
                    `Apply selected (${autotagApplyCount})`
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {defaultLabelBoardId && boardQuery.isLoading ? (
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
          Loading board labels…
        </p>
      ) : defaultLabelBoardId && boardQuery.isError ? (
        <p className="text-xs text-destructive">Could not load the default project board for labels.</p>
      ) : (
        <TicketStyleLabelsBlock
          brandId={brandIdForMyLabels}
          board={board}
          attachedLabels={note.labels}
          locked={false}
          labelSuggestLoading={labelSuggestQuery.isLoading}
          labelSuggestError={labelSuggestQuery.isError}
          labelSearch={labelSearch}
          onLabelSearchChange={setLabelSearch}
          labelSearchMatches={labelSearchMatches}
          labelQuickTiles={labelQuickTiles}
          hasLabel={hasLabelOnNote}
          toggleBoardLabel={toggleBoardLabel}
          toggleUserLabel={toggleUserLabel}
          onPickSearchMatch={(m, onNote) => {
            if (onNote) {
              m.scope === "user" ? toggleUserLabel(m.id, true) : toggleBoardLabel(m.id, true);
            } else {
              const p =
                m.scope === "user"
                  ? addNoteUserTicketLabel(note.id, m.id)
                  : addNoteBoardLabel(note.id, m.id);
              void p.then(() => {
                invalidateNotes();
                invalidateSuggestions();
              });
            }
          }}
          createFromSearch={
            brandIdForMyLabels && board
              ? (() => {
                  const t = labelSearch.trim();
                  const anyExact = [...board.labels, ...(myTicketLabelsQuery.data ?? [])].some(
                    (l) => l.name.toLowerCase() === t.toLowerCase(),
                  );
                  if (!t || anyExact) return null;
                  return {
                    trimmedName: t,
                    pending: createMyLabelMutation.isPending,
                    error: createMyLabelMutation.isError,
                    onClick: () => createMyLabelMutation.mutate({ name: t }),
                  };
                })()
              : null
          }
        />
      )}
    </div>
  );
}
