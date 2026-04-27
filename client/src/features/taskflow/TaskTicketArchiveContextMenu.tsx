import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Archive, Zap } from "lucide-react";
import type { TaskFlowTask } from "./types";

export type TicketArchiveMenuState = { clientX: number; clientY: number; task: TaskFlowTask } | null;

const CONFIRM_ARCHIVE =
  "Archive this ticket? It will leave the board until you restore it from the Ticket Tracker (archived view).";

export function TaskTicketArchiveContextMenu({
  state,
  onClose,
  onArchive,
  archivePending,
  bulkSelectMode,
  selectedTaskIds,
  onBulkActions,
  boardArchived,
}: {
  state: TicketArchiveMenuState;
  onClose: () => void;
  onArchive: (task: TaskFlowTask) => void;
  archivePending: boolean;
  /** When set, shows “Bulk actions” for the right-clicked ticket if it is part of the current selection. */
  bulkSelectMode?: boolean;
  selectedTaskIds?: string[];
  onBulkActions?: () => void;
  boardArchived?: boolean;
}) {
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;

  const maxX = typeof window !== "undefined" ? window.innerWidth - 200 : state.clientX;
  const left = Math.max(8, Math.min(state.clientX, maxX));
  const top = Math.max(8, state.clientY);

  const sel = selectedTaskIds ?? [];
  const showBulkEntry =
    !boardArchived &&
    Boolean(bulkSelectMode && onBulkActions && sel.length > 0 && sel.includes(state.task.id));

  const menu = (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default bg-transparent"
        aria-label="Dismiss menu"
        onClick={onClose}
      />
      <div
        role="menu"
        className="fixed z-[70] min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        style={{ left, top }}
      >
        {showBulkEntry ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              onBulkActions?.();
              onClose();
            }}
          >
            <Zap className="size-4 shrink-0 text-amber-500" aria-hidden />
            Bulk actions…
          </button>
        ) : null}
        {!boardArchived ? (
          <button
            type="button"
            role="menuitem"
            disabled={archivePending || Boolean(state.task.archivedAt)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              if (state.task.archivedAt) return;
              if (!window.confirm(CONFIRM_ARCHIVE)) return;
              onArchive(state.task);
              onClose();
            }}
          >
            <Archive className="size-4 shrink-0 opacity-70" aria-hidden />
            Archive ticket
          </button>
        ) : null}
      </div>
    </>
  );

  return createPortal(menu, document.body);
}
