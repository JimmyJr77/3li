import type { BoardDto, TaskFlowTask } from "./types";

export type BoardFilterState = {
  q: string;
  labelId: string | null;
  completed: "all" | "open" | "done";
  priority: string | null;
};

export function filterBoard(board: BoardDto, f: BoardFilterState): BoardDto {
  const q = f.q.trim().toLowerCase();
  const matches = (t: TaskFlowTask) => {
    if (q && !t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) {
      return false;
    }
    if (f.labelId && !t.labels.some((x) => x.label.id === f.labelId)) {
      return false;
    }
    if (f.completed === "open" && t.completed) {
      return false;
    }
    if (f.completed === "done" && !t.completed) {
      return false;
    }
    if (f.priority && f.priority !== "all" && t.priority !== f.priority) {
      return false;
    }
    return true;
  };
  return {
    ...board,
    lists: board.lists.map((list) => ({
      ...list,
      tasks: list.tasks.filter(matches),
    })),
  };
}

export function boardFiltersActive(f: BoardFilterState): boolean {
  return Boolean(
    f.q.trim() ||
      f.labelId ||
      f.completed !== "all" ||
      (f.priority && f.priority !== "all"),
  );
}
