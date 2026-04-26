import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row as TanstackRow,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import {
  clearRoutedGlow,
  useRoutedTaskGlow,
} from "@/features/rapidRouter/routedHighlightStore";
import type { TaskFlowTask } from "./types";
import { TRACKER_LABELS, normalizeTrackerStatus } from "./trackerMeta";
import { cn } from "@/lib/utils";

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
}: {
  row: TanstackRow<Row>;
  onRowClick: (task: TaskFlowTask) => void;
  colorByBoard?: boolean;
}) {
  const { activeWorkspaceId } = useActiveWorkspace();
  const taskWs = row.original.list?.board?.workspaceId ?? activeWorkspaceId ?? undefined;
  const glow = useRoutedTaskGlow(row.original.id, taskWs);
  const accent = row.original.list?.board?.accentColor;
  const accentRow = Boolean(colorByBoard && accent);
  return (
    <tr
      className={cn(
        "cursor-pointer border-t transition-colors hover:bg-muted/30",
        row.original.completed && "opacity-70",
        glow &&
          "bg-yellow-500/5 shadow-[inset_0_0_0_2px_rgba(234,179,8,0.55)] dark:bg-yellow-500/10",
      )}
      style={accentRow ? { boxShadow: `inset 3px 0 0 0 ${accent}` } : undefined}
      onClick={() => {
        if (taskWs) clearRoutedGlow("task", row.original.id, taskWs);
        onRowClick(row.original);
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-3 py-2 align-top">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

export function BoardTable({
  tasks,
  onRowClick,
  colorByBoard,
}: {
  tasks: TaskFlowTask[];
  onRowClick: (task: TaskFlowTask) => void;
  /** When true, rows show a left accent from each ticket’s project board color. */
  colorByBoard?: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

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

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "brandTicket",
        header: "Ticket",
        size: 70,
        cell: (info) => <span className="font-mono tabular-nums">{String(info.getValue())}</span>,
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: (info) => <span className="font-medium">{String(info.getValue())}</span>,
      },
      {
        accessorKey: "boardName",
        header: "Board",
      },
      {
        accessorKey: "listTitle",
        header: "Sub-board",
      },
      {
        accessorKey: "trackerLabel",
        header: "Tracker",
      },
      {
        accessorKey: "priority",
        header: "Priority",
      },
      {
        accessorKey: "dueDate",
        header: "Due",
        cell: (info) => {
          const v = info.getValue() as string | null;
          return v ? new Date(v).toLocaleDateString() : "—";
        },
      },
      {
        accessorKey: "completed",
        header: "Done",
        cell: (info) => (info.getValue() ? "Yes" : "No"),
      },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-muted/40">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="px-3 py-2 font-semibold">
                  {h.isPlaceholder ? null : h.column.getCanSort() ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getIsSorted() === "asc" ? (
                        <ArrowUp className="size-3.5" />
                      ) : h.column.getIsSorted() === "desc" ? (
                        <ArrowDown className="size-3.5" />
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    flexRender(h.column.columnDef.header, h.getContext())
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <BoardTableRow key={row.id} row={row} onRowClick={onRowClick} colorByBoard={colorByBoard} />
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tasks in this view.</p>
      )}
    </div>
  );
}
