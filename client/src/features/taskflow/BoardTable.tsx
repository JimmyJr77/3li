import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { TaskFlowTask } from "./types";
import { cn } from "@/lib/utils";

type Row = TaskFlowTask & {
  listTitle: string;
  boardName: string;
};

export function BoardTable({
  tasks,
  onRowClick,
}: {
  tasks: TaskFlowTask[];
  onRowClick: (task: TaskFlowTask) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const data = useMemo<Row[]>(
    () =>
      tasks.map((t) => ({
        ...t,
        listTitle: t.list?.title ?? "—",
        boardName: t.list?.board?.name ?? "—",
      })),
    [tasks],
  );

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
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
        header: "List",
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
            <tr
              key={row.id}
              className={cn(
                "cursor-pointer border-t transition-colors hover:bg-muted/30",
                row.original.completed && "opacity-70",
              )}
              onClick={() => onRowClick(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tasks in this view.</p>
      )}
    </div>
  );
}
