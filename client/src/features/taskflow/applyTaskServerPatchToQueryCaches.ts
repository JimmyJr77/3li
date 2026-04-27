import type { QueryClient } from "@tanstack/react-query";
import type { BoardDto, TaskFlowTask } from "./types";

/**
 * Merges a task returned from PATCH `/tasks/:id` into React Query caches so the
 * Ticket Tracker, task detail sheet, and project board stay aligned without waiting
 * for a refetch (tracker lane, completed, sub-board placement, title, etc.).
 */
export function applyTaskServerPatchToQueryCaches(
  queryClient: QueryClient,
  updated: TaskFlowTask,
): void {
  queryClient.setQueriesData<TaskFlowTask[]>({ queryKey: ["tasks", "flat"] }, (old) => {
    if (!old) return old;
    const idx = old.findIndex((t) => t.id === updated.id);
    if (idx === -1) return old;
    const next = [...old];
    next[idx] = updated;
    return next;
  });

  const boardId = updated.list?.board?.id ?? updated.list?.boardId;
  const targetListId = updated.subBoardId || updated.list?.id;
  if (!boardId || !targetListId) return;

  queryClient.setQueryData<BoardDto>(["board", boardId], (board) => {
    if (!board?.lists?.length) return board;

    const listIds = new Set(board.lists.map((l) => l.id));
    if (!listIds.has(targetListId)) return board;

    const lists = board.lists.map((list) => {
      const without = list.tasks.filter((t) => t.id !== updated.id);
      if (list.id === targetListId) {
        const merged = [...without, updated].sort((a, b) => a.order - b.order);
        return { ...list, tasks: merged };
      }
      return { ...list, tasks: without };
    });

    return { ...board, lists };
  });
}
