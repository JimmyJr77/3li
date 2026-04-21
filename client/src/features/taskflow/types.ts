export type LabelDto = {
  id: string;
  name: string;
  color: string;
};

export type TaskFlowTask = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  order: number;
  priority: string;
  /** Set when the task is archived (soft-deleted). Omitted on older API responses. */
  archivedAt?: string | null;
  dueDate: string | null;
  startDate: string | null;
  ideaNodeId: string | null;
  listId: string;
  ideaNode: { id: string; title: string } | null;
  labels: { label: LabelDto }[];
  /** Present on flat `/tasks` responses for table/calendar views */
  list?: {
    id: string;
    title: string;
    key: string | null;
    position: number;
    boardId: string;
    board: { id: string; name: string; workspaceId: string };
  };
  comments?: { id: string; body: string; createdAt: string }[];
  checklist?: { id: string; title: string; completed: boolean; position: number }[];
  activities?: { id: string; action: string; detail: string; createdAt: string }[];
};

export type BoardListDto = {
  id: string;
  title: string;
  key: string | null;
  position: number;
  tasks: TaskFlowTask[];
};

export type BoardDto = {
  id: string;
  name: string;
  workspaceId: string;
  /** Set when the board is archived (hidden from default project space lists). */
  archivedAt?: string | null;
  lists: BoardListDto[];
  labels: LabelDto[];
};

export type WorkspaceDto = {
  id: string;
  name: string;
  position?: number;
  boards: { id: string; name: string; position: number }[];
};

export type BootstrapDto = {
  workspace: WorkspaceDto;
  board: BoardDto | null;
};
