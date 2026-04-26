import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TASK_LABEL_CHIP_CLASS, type LabelSuggestionChip } from "./labelUiUtils";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-xs font-medium text-muted-foreground">{children}</Label>;
}

export type TicketStyleLabelSearchMatch = {
  scope: "board" | "user";
  id: string;
  name: string;
  color: string;
};

export type TicketStyleAttachedLabel = {
  label: { id: string; name: string; color: string };
  labelScope?: "board" | "user";
};

export type TicketStyleLabelsBlockProps = {
  brandId: string | null;
  board: { id: string; labels: { id: string; name: string; color: string }[] } | null;
  attachedLabels: TicketStyleAttachedLabel[];
  locked: boolean;
  labelSuggestLoading: boolean;
  labelSuggestError: boolean;
  labelSearch: string;
  onLabelSearchChange: (value: string) => void;
  labelSearchMatches: TicketStyleLabelSearchMatch[];
  labelQuickTiles: LabelSuggestionChip[];
  hasLabel: (scope: "board" | "user", labelId: string) => boolean;
  toggleBoardLabel: (labelId: string, has: boolean) => void;
  toggleUserLabel: (labelId: string, has: boolean) => void;
  onPickSearchMatch: (m: TicketStyleLabelSearchMatch, onEntity: boolean) => void;
  /** When set, shows “Create … and attach” under search (personal brand labels). */
  createFromSearch:
    | null
    | {
        trimmedName: string;
        pending: boolean;
        error: boolean;
        onClick: () => void;
      };
};

export function TicketStyleLabelsBlock({
  brandId,
  board,
  attachedLabels,
  locked,
  labelSuggestLoading,
  labelSuggestError,
  labelSearch,
  onLabelSearchChange,
  labelSearchMatches,
  labelQuickTiles,
  hasLabel,
  toggleBoardLabel,
  toggleUserLabel,
  onPickSearchMatch,
  createFromSearch,
}: TicketStyleLabelsBlockProps) {
  if (brandId && board) {
    return (
      <div className="space-y-2">
        <FieldLabel>Labels</FieldLabel>
        <div className="flex min-h-[1.75rem] flex-wrap gap-1.5">
          {attachedLabels.length === 0 ? (
            <p className="text-xs text-muted-foreground">None selected.</p>
          ) : (
            attachedLabels.map((x) => {
              const scope = x.labelScope === "user" ? "user" : "board";
              return (
                <button
                  key={`${scope}-${x.label.id}`}
                  type="button"
                  className={cn(
                    TASK_LABEL_CHIP_CLASS,
                    "max-w-full border-0 text-left text-white shadow-sm transition-opacity disabled:opacity-50",
                  )}
                  style={{ backgroundColor: x.label.color }}
                  title={locked ? x.label.name : `${x.label.name} — click to remove`}
                  disabled={locked}
                  onClick={() =>
                    scope === "user" ? toggleUserLabel(x.label.id, true) : toggleBoardLabel(x.label.id, true)
                  }
                >
                  {x.label.name}
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/25 p-3">
          {labelSuggestLoading ? (
            <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
              Loading suggestions…
            </p>
          ) : labelSuggestError ? (
            <p className="text-xs text-destructive">Could not load label suggestions.</p>
          ) : labelQuickTiles.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {labelQuickTiles.map((r) => {
                const has = hasLabel(r.scope, r.id);
                return (
                  <button
                    key={`${r.scope}-${r.id}`}
                    type="button"
                    className={cn(
                      TASK_LABEL_CHIP_CLASS,
                      "max-w-full border-0 text-left text-white transition-opacity disabled:opacity-50",
                      !has && "ring-1 ring-border/50 ring-offset-0",
                    )}
                    style={{ backgroundColor: r.color, opacity: has ? 1 : 0.85 }}
                    title={r.name}
                    disabled={locked}
                    onClick={() =>
                      r.scope === "user" ? toggleUserLabel(r.id, has) : toggleBoardLabel(r.id, has)
                    }
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          ) : null}

          <Input
            value={labelSearch}
            onChange={(e) => onLabelSearchChange(e.target.value)}
            disabled={locked}
            placeholder="Search labels or create…"
            className="h-8 text-sm"
          />

          {labelSearch.trim() ? (
            <div className="space-y-2 rounded-md border border-border/40 bg-background/60 px-2 py-1.5">
              {labelSearchMatches.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {labelSearchMatches.map((m) => {
                    const onEntity = hasLabel(m.scope, m.id);
                    return (
                      <button
                        key={`${m.scope}-${m.id}`}
                        type="button"
                        className={cn(
                          TASK_LABEL_CHIP_CLASS,
                          "max-w-full border-0 text-left text-white transition-opacity disabled:opacity-50",
                          !onEntity && "ring-1 ring-border/50",
                        )}
                        style={{ backgroundColor: m.color, opacity: onEntity ? 1 : 0.9 }}
                        title={m.name}
                        disabled={locked}
                        onClick={() => onPickSearchMatch(m, onEntity)}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              ) : !locked && brandId ? (
                <p className="text-xs text-muted-foreground">No close matches. Create below.</p>
              ) : null}

              {!locked && brandId && createFromSearch ? (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground">
                    Color is auto-assigned; change in Settings.
                  </p>
                  <Button
                    type="button"
                    className="h-7 w-full text-xs"
                    variant="secondary"
                    disabled={!createFromSearch.trimmedName || createFromSearch.pending}
                    onClick={() => createFromSearch.onClick()}
                  >
                    {createFromSearch.pending ? "Creating…" : `Create “${createFromSearch.trimmedName}” and attach`}
                  </Button>
                  {createFromSearch.error ? (
                    <p className="text-xs text-destructive">Could not create (duplicate or error?).</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (brandId && !board) {
    return (
      <div className="space-y-1">
        <FieldLabel>Labels</FieldLabel>
        <p className="text-xs text-muted-foreground">
          Add a project board in this workspace to use shared board labels (personal labels use the same list once a
          board exists).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <FieldLabel>Labels</FieldLabel>
      <p className="text-xs text-muted-foreground">
        Open this workspace from a brand with a project board to add labels.
      </p>
    </div>
  );
}
