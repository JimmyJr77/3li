import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type Row as TanstackRow,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import {
  clearRoutedGlow,
  useRoutedTaskGlow,
} from "@/features/rapidRouter/routedHighlightStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TaskFlowTask } from "./types";
import { TRACKER_LABELS, TRACKER_STATUSES, normalizeTrackerStatus, type TrackerStatus } from "./trackerMeta";
import { cn } from "@/lib/utils";

const POPOVER_Z = 10052;

const popoverPanelClass =
  "max-h-64 overflow-y-auto overflow-x-hidden rounded-md border border-border bg-background text-sm text-foreground shadow-lg";

const popoverListBtnClass =
  "flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-muted";

const fieldInputClass =
  "border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm disabled:opacity-60";

export type BoardTableTaskPatch = Partial<{
  trackerStatus: TrackerStatus;
  priority: string;
  dueDate: string | null;
  completed: boolean;
}>;

const PRIORITY_OPTIONS = ["none", "low", "medium", "high", "urgent"] as const;

function doneForDisplay(task: TaskFlowTask): boolean {
  return task.completed || normalizeTrackerStatus(task.trackerStatus) === "DONE";
}

function StopRowClick({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-w-0"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function TableFieldPopover({
  open,
  anchorRef,
  onClose,
  children,
}: {
  open: boolean;
  anchorRef: React.MutableRefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const sync = useCallback(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const el = anchorRef.current;
    if (!el) {
      setPos(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) });
  }, [open, anchorRef]);

  useLayoutEffect(() => {
    sync();
  }, [sync, open]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => sync();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, sync]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={cn("fixed shadow-lg", popoverPanelClass)}
      style={{ top: pos.top, left: pos.left, width: pos.width, zIndex: POPOVER_Z }}
    >
      {children}
    </div>,
    document.body,
  );
}

type Row = TaskFlowTask & {
  listTitle: string;
  boardName: string;
  trackerLabel: string;
  brandTicket: string;
};

function BoardTableRow({
  row,
  onRowClick,
  colorByBoard,
  subBoardStrip,
  boardArchived,
  onTicketContextMenu,
}: {
  row: TanstackRow<Row>;
  onRowClick: (task: TaskFlowTask) => void;
  colorByBoard?: boolean;
  subBoardStrip?: boolean;
  boardArchived?: boolean;
  onTicketContextMenu?: (e: MouseEvent<HTMLTableRowElement>, task: TaskFlowTask) => void;
}) {
  const { activeWorkspaceId } = useActiveWorkspace();
  const taskWs = row.original.list?.board?.workspaceId ?? activeWorkspaceId ?? undefined;
  const glow = useRoutedTaskGlow(row.original.id, taskWs);
  const boardAccent = row.original.list?.board?.accentColor;
  const listAccent = row.original.list?.accentColor;
  const accentRow = Boolean(colorByBoard && boardAccent);
  const subBoardStripRow = Boolean(subBoardStrip && listAccent);
  const dimDone = doneForDisplay(row.original);

  const shadows: string[] = [];
  if (glow) shadows.push("inset 0 0 0 2px rgba(234, 179, 8, 0.55)");
  if (accentRow && boardAccent) shadows.push(`inset 3px 0 0 0 ${boardAccent}`);
  if (subBoardStripRow && listAccent) shadows.push(`inset -3px 0 0 0 ${listAccent}`);
  const boxShadow = shadows.length > 0 ? shadows.join(", ") : undefined;

  return (
    <tr
      className={cn(
        "min-h-[1.875rem] cursor-pointer border-t transition-colors hover:bg-muted/30",
        dimDone && "opacity-70",
        glow && "bg-yellow-500/5 dark:bg-yellow-500/10",
      )}
      style={boxShadow ? { boxShadow } : undefined}
      onContextMenu={(e) => {
        if (boardArchived || !onTicketContextMenu) return;
        e.preventDefault();
        e.stopPropagation();
        onTicketContextMenu(e, row.original);
      }}
      onClick={() => {
        if (taskWs) clearRoutedGlow("task", row.original.id, taskWs);
        onRowClick(row.original);
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="border-border/40 min-w-0 border-r px-1.5 py-px align-middle last:border-r-0">
          <div className="flex min-h-[1.625rem] min-w-0 items-center">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
        </td>
      ))}
    </tr>
  );
}

function DuePickerPanel({
  task,
  onApply,
  onClose,
}: {
  task: Row;
  onApply: (iso: string | null) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => (task.dueDate ? task.dueDate.slice(0, 16) : ""));
  useEffect(() => {
    setDraft(task.dueDate ? task.dueDate.slice(0, 16) : "");
  }, [task.dueDate, task.id]);

  return (
    <div className="space-y-2 p-2" role="dialog" aria-label="Set due date">
      <label className="block text-xs font-medium text-muted-foreground">Due</label>
      <input
        type="datetime-local"
        className={fieldInputClass}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            const iso = draft ? new Date(draft).toISOString() : null;
            onApply(iso);
            onClose();
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

export function BoardTable({
  tasks,
  onRowClick,
  colorByBoard,
  subBoardStrip,
  boardArchived,
  onTicketContextMenu,
  inlineEditTrackerPriorityDue = false,
  onTaskPatch,
}: {
  tasks: TaskFlowTask[];
  onRowClick: (task: TaskFlowTask) => void;
  colorByBoard?: boolean;
  subBoardStrip?: boolean;
  boardArchived?: boolean;
  onTicketContextMenu?: (e: MouseEvent<HTMLTableRowElement>, task: TaskFlowTask) => void;
  inlineEditTrackerPriorityDue?: boolean;
  onTaskPatch?: (taskId: string, patch: BoardTableTaskPatch) => Promise<void>;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [picker, setPicker] = useState<
    { kind: "tracker" | "priority" | "due"; taskId: string } | null
  >(null);
  const [dueClearTaskId, setDueClearTaskId] = useState<string | null>(null);
  const pickerAnchorRef = useRef<HTMLElement | null>(null);

  const editable = Boolean(inlineEditTrackerPriorityDue && onTaskPatch && !boardArchived);

  const runPatch = useCallback(
    async (taskId: string, fieldKey: string, patch: BoardTableTaskPatch) => {
      if (!onTaskPatch) return;
      const key = `${taskId}:${fieldKey}`;
      setSavingKey(key);
      try {
        await onTaskPatch(taskId, patch);
      } finally {
        setSavingKey((k) => (k === key ? null : k));
      }
    },
    [onTaskPatch],
  );

  const openPicker = useCallback(
    (kind: "tracker" | "priority" | "due", taskId: string, anchor: HTMLElement) => {
      pickerAnchorRef.current = anchor;
      setPicker({ kind, taskId });
    },
    [],
  );

  const closePicker = useCallback(() => {
    setPicker(null);
    pickerAnchorRef.current = null;
  }, []);

  const data = useMemo<Row[]>(
    () =>
      tasks.map((t) => ({
        ...t,
        listTitle: t.list?.title ?? "—",
        boardName: t.list?.board?.name ?? "—",
        trackerLabel: TRACKER_LABELS[normalizeTrackerStatus(t.trackerStatus)],
        brandTicket: t.brandTicketNumber != null ? String(t.brandTicketNumber) : "—",
      })),
    [tasks],
  );

  const pickerTask = picker ? data.find((t) => t.id === picker.taskId) : undefined;

  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const sortableWhenReadOnly = !editable;
    return [
      {
        accessorKey: "brandTicket",
        header: "Ticket",
        size: 70,
        minSize: 70,
        maxSize: 320,
        cell: (info) => {
          const row = info.row.original;
          const num = String(info.getValue());
          if (!editable) {
            return <span className="block min-w-0 truncate font-mono tabular-nums">{num}</span>;
          }
          const busy = savingKey === `${row.id}:completed`;
          return (
            <div className="flex w-full min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate font-mono tabular-nums">{num}</span>
              <StopRowClick>
                <div className="flex shrink-0 items-center gap-1">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer rounded border"
                    checked={row.completed}
                    disabled={busy}
                    title="Mark complete"
                    aria-label="Mark ticket complete"
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (next === row.completed) return;
                      void runPatch(row.id, "completed", { completed: next });
                    }}
                  />
                  {busy ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
                </div>
              </StopRowClick>
            </div>
          );
        },
      },
      {
        id: "title",
        accessorKey: "title",
        header: "Title",
        size: 200,
        minSize: 100,
        maxSize: 4000,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="block min-w-0 truncate font-medium">
              {row.title ? row.title : "\u00a0"}
            </span>
          );
        },
      },
      {
        accessorKey: "boardName",
        header: "Board",
        size: 200,
        minSize: 100,
        maxSize: 4000,
        cell: (info) => <span className="block min-w-0 truncate">{String(info.getValue())}</span>,
      },
      {
        accessorKey: "listTitle",
        header: "Sub-board",
        size: 200,
        minSize: 100,
        maxSize: 4000,
        cell: (info) => <span className="block min-w-0 truncate">{String(info.getValue())}</span>,
      },
      {
        accessorKey: "trackerLabel",
        header: "Tracker",
        size: 100,
        minSize: 100,
        maxSize: 320,
        enableSorting: sortableWhenReadOnly,
        cell: (info) => {
          const row = info.row.original;
          if (!editable) {
            return <span className="block min-w-0 truncate">{row.trackerLabel}</span>;
          }
          const st = normalizeTrackerStatus(row.trackerStatus);
          const busy = savingKey === `${row.id}:tracker`;
          return (
            <StopRowClick>
              <div className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  disabled={busy}
                  className="block min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left hover:bg-muted/80 disabled:opacity-50"
                  aria-haspopup="listbox"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPicker("tracker", row.id, e.currentTarget);
                  }}
                >
                  {TRACKER_LABELS[st]}
                </button>
                {busy ? <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : null}
              </div>
            </StopRowClick>
          );
        },
      },
      {
        accessorKey: "priority",
        header: "Priority",
        size: 100,
        minSize: 100,
        maxSize: 280,
        enableSorting: sortableWhenReadOnly,
        cell: (info) => {
          const row = info.row.original;
          if (!editable) {
            return <span className="block min-w-0 truncate capitalize">{row.priority}</span>;
          }
          const label = row.priority === "none" ? "None" : row.priority.charAt(0).toUpperCase() + row.priority.slice(1);
          const busy = savingKey === `${row.id}:priority`;
          return (
            <StopRowClick>
              <div className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  disabled={busy}
                  className="block min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left capitalize hover:bg-muted/80 disabled:opacity-50"
                  aria-haspopup="listbox"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPicker("priority", row.id, e.currentTarget);
                  }}
                >
                  {label}
                </button>
                {busy ? <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : null}
              </div>
            </StopRowClick>
          );
        },
      },
      {
        accessorKey: "dueDate",
        header: "Due",
        size: 120,
        minSize: 100,
        maxSize: 400,
        enableSorting: sortableWhenReadOnly,
        cell: (info) => {
          const row = info.row.original;
          const v = row.dueDate;
          if (!editable) {
            return (
              <span className="block min-w-0 truncate">{v ? new Date(v).toLocaleDateString() : "—"}</span>
            );
          }
          const busy = savingKey === `${row.id}:due`;
          const label = v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
          return (
            <StopRowClick>
              <div className="flex min-w-0 items-center gap-0.5">
                <button
                  type="button"
                  disabled={busy}
                  className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left hover:bg-muted/80 disabled:opacity-50"
                  aria-haspopup="dialog"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPicker("due", row.id, e.currentTarget);
                  }}
                >
                  {label}
                </button>
                {v ? (
                  <button
                    type="button"
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                    disabled={busy}
                    title="Remove due date"
                    aria-label="Remove due date"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDueClearTaskId(row.id);
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
                {busy ? <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : null}
              </div>
            </StopRowClick>
          );
        },
      },
      {
        id: "doneDisplay",
        header: "Done",
        size: 70,
        minSize: 70,
        maxSize: 200,
        enableSorting: sortableWhenReadOnly,
        accessorFn: (row) => (doneForDisplay(row) ? 1 : 0),
        cell: (info) => (
          <span className="block min-w-0 truncate">{doneForDisplay(info.row.original) ? "Yes" : "No"}</span>
        ),
      },
    ];
  }, [editable, savingKey, runPatch, openPicker]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnSizing },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    defaultColumn: {
      minSize: 60,
      maxSize: 4000,
      size: 100,
    },
  });

  const leafCols = table.getVisibleLeafColumns();
  const layoutTotal = table.getTotalSize() || 1;
  const rawColPct = leafCols.map((c) => (c.getSize() / layoutTotal) * 100);
  const pctDrift =
    rawColPct.length > 0 ? 100 - rawColPct.reduce((a, b) => a + b, 0) : 0;
  const colPercents =
    rawColPct.length === 0
      ? []
      : rawColPct.map((p, i) => (i === rawColPct.length - 1 ? p + pctDrift : p));

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border">
      <table className="w-full min-w-0 table-fixed border-collapse text-left text-sm">
        <colgroup>
          {leafCols.map((c, i) => (
            <col key={c.id} style={{ width: `${colPercents[i] ?? 100 / leafCols.length}%` }} />
          ))}
        </colgroup>
        <thead className="bg-muted/40">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="min-h-[2.5rem]">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="relative min-w-0 border-b border-border/60 px-1.5 py-[0.1875rem] text-left font-semibold"
                >
                  {h.isPlaceholder ? null : h.column.getCanSort() ? (
                    <button
                      type="button"
                      className="inline-flex max-w-full items-center gap-1 truncate hover:text-foreground"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      <span className="truncate">{flexRender(h.column.columnDef.header, h.getContext())}</span>
                      {h.column.getIsSorted() === "asc" ? (
                        <ArrowUp className="size-3.5 shrink-0" />
                      ) : h.column.getIsSorted() === "desc" ? (
                        <ArrowDown className="size-3.5 shrink-0" />
                      ) : (
                        <ArrowUpDown className="size-3.5 shrink-0 opacity-40" />
                      )}
                    </button>
                  ) : (
                    <span className="block truncate">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </span>
                  )}
                  {h.column.getCanResize() ? (
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${h.column.id} column`}
                      onMouseDown={h.getResizeHandler()}
                      onTouchStart={h.getResizeHandler()}
                      className={cn(
                        "absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none rounded-sm",
                        h.column.getIsResizing() ? "bg-primary/70" : "bg-transparent hover:bg-primary/25",
                      )}
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <BoardTableRow
              key={row.id}
              row={row}
              onRowClick={onRowClick}
              colorByBoard={colorByBoard}
              subBoardStrip={subBoardStrip}
              boardArchived={boardArchived}
              onTicketContextMenu={onTicketContextMenu}
            />
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tasks in this view.</p>
      )}

      <TableFieldPopover open={picker !== null} anchorRef={pickerAnchorRef} onClose={closePicker}>
        {picker?.kind === "tracker" && pickerTask ? (
          <ul role="listbox" className="m-0 list-none p-0">
            {TRACKER_STATUSES.map((st) => (
              <li key={st} className="border-b border-border/60 last:border-0">
                <button
                  type="button"
                  className={popoverListBtnClass}
                  onClick={() => {
                    if (st === normalizeTrackerStatus(pickerTask.trackerStatus)) {
                      closePicker();
                      return;
                    }
                    void runPatch(pickerTask.id, "tracker", { trackerStatus: st }).finally(closePicker);
                  }}
                >
                  <span className="truncate font-medium">{TRACKER_LABELS[st]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {picker?.kind === "priority" && pickerTask ? (
          <ul role="listbox" className="m-0 list-none p-0">
            {PRIORITY_OPTIONS.map((p) => (
              <li key={p} className="border-b border-border/60 last:border-0">
                <button
                  type="button"
                  className={popoverListBtnClass}
                  onClick={() => {
                    if (p === pickerTask.priority) {
                      closePicker();
                      return;
                    }
                    void runPatch(pickerTask.id, "priority", { priority: p }).finally(closePicker);
                  }}
                >
                  <span className="truncate font-medium">
                    {p === "none" ? "None" : p.charAt(0).toUpperCase() + p.slice(1)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {picker?.kind === "due" && pickerTask ? (
          <DuePickerPanel
            task={pickerTask}
            onClose={closePicker}
            onApply={(iso) => {
              const prev = pickerTask.dueDate;
              if (iso === prev || (!iso && !prev)) {
                closePicker();
                return;
              }
              void runPatch(pickerTask.id, "due", { dueDate: iso });
            }}
          />
        ) : null}
      </TableFieldPopover>

      <Dialog
        open={dueClearTaskId !== null}
        onOpenChange={(o) => {
          if (!o) setDueClearTaskId(null);
        }}
      >
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove due date?</DialogTitle>
            <DialogDescription>This ticket will no longer show a due date.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDueClearTaskId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!dueClearTaskId) return;
                const id = dueClearTaskId;
                setDueClearTaskId(null);
                void runPatch(id, "due", { dueDate: null });
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
