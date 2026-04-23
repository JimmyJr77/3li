import { api } from "@/lib/api/client";
import type { BoardDto, BootstrapDto, BrandTreeDto, TaskFlowTask, WorkspaceDto } from "./types";

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

export type RoutingIndexDto = {
  workspaceId: string;
  workspaceName: string;
  brandDisplayName: string | null;
  notesFolders: { id: string; title: string }[];
  recentNoteTitles: string[];
  brainstormSessions: { id: string; title: string }[];
  projectSpaces: {
    id: string;
    name: string;
    boards: {
      id: string;
      name: string;
      lists: {
        id: string;
        title: string;
        key: string | null;
        taskTitles: string[];
      }[];
    }[];
  }[];
};

export async function fetchRoutingIndex(workspaceId: string): Promise<RoutingIndexDto> {
  const { data } = await api.get<RoutingIndexDto>(`/api/task-app/workspaces/${workspaceId}/routing-index`);
  return data;
}

export type RoutingHoldDto = {
  id: string;
  workspaceId: string;
  body: string;
  meta: unknown;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchRoutingHolds(
  workspaceId: string,
  params?: { status?: "pending" | "routed" | "dismissed" },
): Promise<RoutingHoldDto[]> {
  const { data } = await api.get<RoutingHoldDto[]>(`/api/task-app/workspaces/${workspaceId}/routing-holds`, {
    params: params?.status ? { status: params.status } : undefined,
  });
  return data;
}

export async function createRoutingHold(
  workspaceId: string,
  body: { body: string; source?: string; meta?: unknown },
): Promise<RoutingHoldDto> {
  const { data } = await api.post<RoutingHoldDto>(
    `/api/task-app/workspaces/${workspaceId}/routing-holds`,
    body,
  );
  return data;
}

export async function patchRoutingHold(
  workspaceId: string,
  holdId: string,
  body: { status: "pending" | "routed" | "dismissed" },
): Promise<RoutingHoldDto> {
  const { data } = await api.patch<RoutingHoldDto>(
    `/api/task-app/workspaces/${workspaceId}/routing-holds/${holdId}`,
    body,
  );
  return data;
}

export async function deleteRoutingHold(workspaceId: string, holdId: string): Promise<void> {
  await api.delete(`/api/task-app/workspaces/${workspaceId}/routing-holds/${holdId}`);
}

export async function fetchBrandTree(): Promise<BrandTreeDto[]> {
  const { data } = await api.get<BrandTreeDto[]>("/api/task-app/brands");
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

export type ProjectSpaceDto = {
  id: string;
  name: string;
  position: number;
  boards: { id: string; name: string; position: number }[];
};

export async function createProjectSpace(workspaceId: string, name: string): Promise<ProjectSpaceDto> {
  const { data } = await api.post<ProjectSpaceDto>(
    `/api/task-app/workspaces/${workspaceId}/project-spaces`,
    { name },
  );
  return data;
}

export async function patchProjectSpace(
  projectSpaceId: string,
  body: { name?: string; archived?: boolean },
): Promise<ProjectSpaceDto> {
  const { data } = await api.patch<ProjectSpaceDto>(`/api/task-app/project-spaces/${projectSpaceId}`, body);
  return data;
}

export async function createBrand(name: string): Promise<BrandTreeDto> {
  const { data } = await api.post<BrandTreeDto>("/api/task-app/brands", { name });
  return data;
}

export async function patchBrand(
  brandId: string,
  body: { archived?: boolean; name?: string },
): Promise<void> {
  await api.patch(`/api/task-app/brands/${brandId}`, body);
}

export async function reorderBrands(orderedIds: string[]): Promise<void> {
  await api.post("/api/task-app/brands/reorder", { orderedIds });
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

export type ContextInstructionsDto = {
  workspaceId: string;
  brandId: string;
  teamContextInstructions: string;
  userContextInstructions: string;
};

export async function fetchContextInstructions(workspaceId: string): Promise<ContextInstructionsDto> {
  const { data } = await api.get<ContextInstructionsDto>(
    `/api/task-app/workspaces/${workspaceId}/context-instructions`,
  );
  return data;
}

export async function patchContextInstructions(
  workspaceId: string,
  body: { teamContextInstructions?: string; userContextInstructions?: string },
): Promise<ContextInstructionsDto> {
  const { data } = await api.put<ContextInstructionsDto>(
    `/api/task-app/workspaces/${workspaceId}/context-instructions`,
    body,
  );
  return data;
}

export async function reorderProjectSpaces(workspaceId: string, orderedIds: string[]): Promise<void> {
  await api.post(`/api/task-app/workspaces/${workspaceId}/project-spaces/reorder`, { orderedIds });
}

export async function deleteBoardTemplate(templateId: string): Promise<void> {
  await api.delete(`/api/task-app/board-templates/${templateId}`);
}

export async function createBoardFromTemplate(
  workspaceId: string,
  body: { templateId: string; name?: string; projectSpaceId?: string },
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
  body: {
    title: string;
    description?: string;
    listId?: string;
    priority?: string;
    routingSource?: string | null;
  },
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
