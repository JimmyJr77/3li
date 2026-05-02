import { cn } from "@/lib/utils";
import type { AtlasNoteDto } from "@/features/notes/types";
import type { FastTaskMember } from "./fastTaskMetaStore";

export type FastTaskIndexerView = "taskboard" | "owners";

const selectClass =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FastTaskIndexer({
  indexerView,
  onIndexerViewChange,
  labelFilterId,
  onLabelFilterChange,
  labelOptions,
  allNotesSorted,
  membersSorted,
  ownerFilterId,
  onOwnerFilterChange,
  onCenterBoard,
  activeBoardId,
}: {
  indexerView: FastTaskIndexerView;
  onIndexerViewChange: (v: FastTaskIndexerView) => void;
  labelFilterId: string | null;
  onLabelFilterChange: (labelId: string | null) => void;
  labelOptions: readonly { id: string; name: string }[];
  allNotesSorted: readonly AtlasNoteDto[];
  membersSorted: readonly FastTaskMember[];
  ownerFilterId: string | null;
  onOwnerFilterChange: (memberId: string | null) => void;
  onCenterBoard: (noteId: string) => void;
  activeBoardId: string | null;
}) {
  return (
    <nav
      aria-label="Fast Task indexer"
      className="sticky left-0 z-20 flex h-full min-h-[min(72vh,720px)] w-40 shrink-0 snap-none flex-col gap-2 rounded-lg border border-border bg-card/95 py-2.5 pl-2 pr-1.5 shadow-md backdrop-blur-sm supports-[backdrop-filter]:bg-card/80 sm:w-44"
    >
      <div className="flex shrink-0 flex-col gap-1.5">
        <label className="sr-only" htmlFor="fast-task-indexer-view">
          Index layout
        </label>
        <select
          id="fast-task-indexer-view"
          className={selectClass}
          value={indexerView}
          onChange={(e) => onIndexerViewChange(e.target.value as FastTaskIndexerView)}
        >
          <option value="taskboard">By taskboard</option>
          <option value="owners">By task owners</option>
        </select>
        <label className="sr-only" htmlFor="fast-task-label-filter">
          Filter by label
        </label>
        <select
          id="fast-task-label-filter"
          className={selectClass}
          value={labelFilterId ?? ""}
          onChange={(e) => onLabelFilterChange(e.target.value || null)}
        >
          <option value="">All labels</option>
          {labelOptions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch]">
        {indexerView === "taskboard" ? (
          <ul className="flex flex-col gap-1">
            {allNotesSorted.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onCenterBoard(n.id)}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-sm font-medium leading-snug transition-colors",
                    n.id === activeBoardId ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  {n.title?.trim() || "Untitled"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col gap-1">
            <li>
              <button
                type="button"
                onClick={() => onOwnerFilterChange(null)}
                className={cn(
                  "w-full rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors",
                  ownerFilterId === null ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                All owners
              </button>
            </li>
            {membersSorted.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onOwnerFilterChange(m.id)}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors",
                    ownerFilterId === m.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  {m.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
