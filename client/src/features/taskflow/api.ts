import { api } from "@/lib/api/client";
import type { BoardDto, BootstrapDto, TaskFlowTask, WorkspaceDto } from "./types";

export type TaskListParams = {
  workspaceId?: string;
  boardId?: string;
  q?: string;
  labelId?: string;
  priority?: string;
  completed?: "true" | "false";
  sort?: string;
  chatThreadId?: string;
  /** Omit = active tasks only; `true` = archived only; `all` = both */
  archived?: "true" | "all";
};

export async function fetchBootstrap(): Promise<BootstrapDto> {
  const { data } = await api.get<BootstrapDto>("/api/task-app/bootstrap");
  return data;
}

export async function fetchBoard(boardId: string): Promise<BoardDto> {
  const { data } = await api.get<BoardDto>(`/api/task-app/boards/${boardId}`);
  return data;
}

export async function fetchWorkspaces(): Promise<WorkspaceDto[]> {
  const { data } = await api.get<WorkspaceDto[]>("/api/task-app/workspaces");
  return data;
}

export type ArchivedBoardSummary = {
  id: string;
  name: string;
  position: number;
  archivedAt: string;
};

export async function fetchArchivedBoards(workspaceId: string): Promise<ArchivedBoardSummary[]> {
  const { data } = await api.get<{ boards: ArchivedBoardSummary[] }>(
    `/api/task-app/workspaces/${workspaceId}/archived-boards`,
  );
  return data.boards;
}

export async function fetchAllTasks(params?: TaskListParams): Promise<TaskFlowTask[]> {
  const { data } = await api.get<TaskFlowTask[]>("/api/task-app/tasks", {
    params: params && Object.keys(params).length ? params : undefined,
  });
  return data;
}

export type ActivityFeedItem = {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
  task: {
    id: string;
    title: string;
    list: { title: string; board: { id: string; name: string } };
  };
};

export async function fetchActivityFeed(workspaceId: string): Promise<ActivityFeedItem[]> {
  const { data } = await api.get<ActivityFeedItem[]>(
    `/api/task-app/workspaces/${workspaceId}/activity-feed`,
  );
  return data;
}

export type BoardTemplateSummary = {
  id: string;
  name: string;
  description: string;
  listCount: number;
  isBuiltin: boolean;
  workspaceId: string | null;
  workspaceName: string | null;
};

export async function fetchBoardTemplates(): Promise<BoardTemplateSummary[]> {
  const { data } = await api.get<BoardTemplateSummary[]>("/api/task-app/board-templates");
  return data;
}

export async function createCustomBoardTemplate(body: {
  name: string;
  description?: string;
  lists: { title: string; key?: string | null }[];
}): Promise<BoardTemplateSummary> {
  const { data } = await api.post<BoardTemplateSummary>("/api/task-app/board-templates", body);
  return data;
}

export async function createWorkspace(name: string): Promise<WorkspaceDto> {
  const { data } = await api.post<WorkspaceDto>("/api/task-app/workspaces", { name });
  return data;
}

export type ArchivedWorkspaceSummary = {
  id: string;
  name: string;
  archivedAt: string;
};

export async function fetchArchivedWorkspaces(): Promise<ArchivedWorkspaceSummary[]> {
  const { data } = await api.get<ArchivedWorkspaceSummary[]>("/api/task-app/workspaces/archived");
  return data;
}

export async function patchWorkspace(
  workspaceId: string,
  body: { name?: string; archived?: boolean },
): Promise<WorkspaceDto> {
  const { data } = await api.patch<WorkspaceDto>(`/api/task-app/workspaces/${workspaceId}`, body);
  return data;
}

export async function reorderWorkspaces(orderedIds: string[]): Promise<void> {
  await api.post("/api/task-app/workspaces/reorder", { orderedIds });
}

export async function deleteBoardTemplate(templateId: string): Promise<void> {
  await api.delete(`/api/task-app/board-templates/${templateId}`);
}

export async function createBoardFromTemplate(
  workspaceId: string,
  body: { templateId: string; name?: string },
): Promise<BoardDto> {
  const { data } = await api.post<BoardDto>(
    `/api/task-app/workspaces/${workspaceId}/boards/from-template`,
    body,
  );
  return data;
}

export async function applyBoardPositions(
  boardId: string,
  positions: Record<string, string[]>,
): Promise<BoardDto> {
  const { data } = await api.post<BoardDto>(`/api/task-app/boards/${boardId}/positions`, {
    positions,
  });
  return data;
}

export async function createBoardTask(
  boardId: string,
  body: { title: string; description?: string; listId?: string; priority?: string },
): Promise<TaskFlowTask> {
  const { data } = await api.post<TaskFlowTask>(`/api/task-app/boards/${boardId}/tasks`, body);
  return data;
}

export async function createBoardList(boardId: string, title: string): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/api/task-app/boards/${boardId}/lists`, {
    title,
  });
  return data;
}

export async function patchBoard(
  boardId: string,
  body: { name?: string; archived?: boolean },
): Promise<BoardDto> {
  const { data } = await api.patch<BoardDto>(`/api/task-app/boards/${boardId}`, body);
  return data;
}

export async function patchBoardList(
  boardId: string,
  listId: string,
  body: { title: string },
): Promise<BoardDto> {
  const { data } = await api.patch<BoardDto>(
    `/api/task-app/boards/${boardId}/lists/${listId}`,
    body,
  );
  return data;
}

export async function deleteBoardList(boardId: string, listId: string): Promise<BoardDto> {
  const { data } = await api.delete<BoardDto>(`/api/task-app/boards/${boardId}/lists/${listId}`);
  return data;
}

export async function reorderBoardLists(
  boardId: string,
  orderedListIds: string[],
): Promise<BoardDto> {
  const { data } = await api.post<BoardDto>(`/api/task-app/boards/${boardId}/reorder-lists`, {
    orderedListIds,
  });
  return data;
}

export async function patchTask(
  taskId: string,
  body: Partial<{
    title: string;
    description: string;
    completed: boolean;
    priority: string;
    dueDate: string | null;
    startDate: string | null;
    listId: string;
    archived: boolean;
  }>,
): Promise<TaskFlowTask> {
  const { data } = await api.patch<TaskFlowTask>(`/api/task-app/tasks/${taskId}`, body);
  return data;
}

export async function postComment(taskId: string, body: string): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/api/task-app/tasks/${taskId}/comments`, {
    body,
  });
  return data;
}

export async function postChecklistItem(taskId: string, title: string): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/api/task-app/tasks/${taskId}/checklist`, {
    title,
  });
  return data;
}

export async function patchChecklistItem(
  itemId: string,
  body: Partial<{ title: string; completed: boolean }>,
): Promise<{ id: string }> {
  const { data } = await api.patch<{ id: string }>(`/api/task-app/checklist-items/${itemId}`, body);
  return data;
}

export async function addTaskLabel(taskId: string, labelId: string): Promise<TaskFlowTask> {
  const { data } = await api.post<TaskFlowTask>(`/api/task-app/tasks/${taskId}/labels`, {
    labelId,
  });
  return data;
}

export async function removeTaskLabel(taskId: string, labelId: string): Promise<TaskFlowTask> {
  const { data } = await api.delete<TaskFlowTask>(`/api/task-app/tasks/${taskId}/labels/${labelId}`);
  return data;
}
