import { api } from "@/lib/api/client";
import type { TrackerStatus } from "./trackerMeta";
import type {
  BoardDto,
  BoardUserPreferenceDto,
  BootstrapDto,
  BrandInviteCreatedDto,
  BrandTeamDto,
  BrandTreeDto,
  SubBoardPreferenceDto,
  TaskFlowTask,
  UserTicketLabelDto,
  WorkspaceDto,
} from "./types";

export type TaskListParams = {
  workspaceId?: string;
  boardId?: string;
  projectSpaceId?: string;
  subBoardId?: string;
  trackerStatus?: string;
  assigneeUserId?: string;
  createdByUserId?: string;
  dueBefore?: string;
  dueAfter?: string;
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

export async function fetchBoardSubBoardPreferences(boardId: string): Promise<SubBoardPreferenceDto[]> {
  const { data } = await api.get<SubBoardPreferenceDto[]>(
    `/api/task-app/boards/${boardId}/sub-board-preferences`,
  );
  return data;
}

export async function fetchBoardUserPreferences(boardId: string): Promise<BoardUserPreferenceDto> {
  const { data } = await api.get<BoardUserPreferenceDto>(
    `/api/task-app/boards/${boardId}/user-board-preferences`,
  );
  return data;
}

export async function patchBoardUserPreferences(
  boardId: string,
  body: Partial<{
    defaultTicketCardColor: string | null;
    defaultHiddenTrackerStatuses: string[];
    defaultCompleteCheckboxVisible: boolean;
    defaultCardFaceLayout: string;
    defaultCardFaceMeta: unknown;
    hiddenSubBoardIds: string[];
  }>,
): Promise<BoardUserPreferenceDto> {
  const { data } = await api.patch<BoardUserPreferenceDto>(
    `/api/task-app/boards/${boardId}/user-board-preferences`,
    body,
  );
  return data;
}

/** Apply the same per-user board defaults to every project board in the workspace. */
export async function applyUserBoardDefaultsForWorkspace(
  workspaceId: string,
  body: {
    defaultCompleteCheckboxVisible: boolean;
    defaultHiddenTrackerStatuses: TrackerStatus[];
    subBoardTabVisibility?: "show_all";
    defaultCardFaceLayout?: string;
    defaultCardFaceMeta?: unknown;
  },
): Promise<{ ok: boolean; boardCount: number }> {
  const { data } = await api.post<{ ok: boolean; boardCount: number }>(
    `/api/task-app/workspaces/${workspaceId}/apply-user-board-defaults`,
    body,
  );
  return data;
}

export async function fetchSubBoardPreference(subBoardId: string): Promise<SubBoardPreferenceDto> {
  const { data } = await api.get<SubBoardPreferenceDto>(
    `/api/task-app/sub-boards/${subBoardId}/preferences`,
  );
  return data;
}

export async function patchSubBoardPreference(
  subBoardId: string,
  body: Partial<{
    ticketCardColor: string | null;
    hiddenTrackerStatuses: string[];
    cardFaceLayout: string;
    cardFaceMeta: unknown | null;
    completeCheckboxVisibleByDefault: boolean;
  }>,
): Promise<SubBoardPreferenceDto> {
  const { data } = await api.patch<SubBoardPreferenceDto>(
    `/api/task-app/sub-boards/${subBoardId}/preferences`,
    body,
  );
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
      subBoards: {
        id: string;
        title: string;
        key: string | null;
        tasksByTracker: Partial<Record<string, string[]>>;
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

export async function fetchBrandTeam(brandId: string): Promise<BrandTeamDto> {
  const { data } = await api.get<BrandTeamDto>(`/api/task-app/brands/${brandId}/team`);
  return data;
}

export async function createBrandInvites(
  brandId: string,
  emails: string[],
): Promise<{ created: BrandInviteCreatedDto[]; skipped?: string[] }> {
  const { data } = await api.post<{ created: BrandInviteCreatedDto[]; skipped?: string[] }>(
    `/api/task-app/brands/${brandId}/invites`,
    { emails },
  );
  return data;
}

export async function revokeBrandInvite(brandId: string, inviteId: string): Promise<void> {
  await api.delete(`/api/task-app/brands/${brandId}/invites/${inviteId}`);
}

export async function removeBrandMember(brandId: string, userId: string): Promise<void> {
  await api.delete(`/api/task-app/brands/${brandId}/members/${userId}`);
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
  actorUserId: string | null;
  action: string;
  detail: string;
  createdAt: string;
  /** Who performed the action; null when legacy/system (no attributed user). */
  actor: { id: string; label: string } | null;
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

/** Built-in templates are always returned; pass `workspaceId` to also load custom templates for that brand. */
export async function fetchBoardTemplates(
  workspaceId: string | null | undefined,
): Promise<BoardTemplateSummary[]> {
  const { data } = await api.get<BoardTemplateSummary[]>("/api/task-app/board-templates", {
    params: workspaceId ? { workspaceId } : undefined,
  });
  return data;
}

export async function createCustomBoardTemplate(body: {
  workspaceId: string;
  name: string;
  description?: string;
  lists: { title: string; key?: string | null }[];
}): Promise<BoardTemplateSummary> {
  const { data } = await api.post<BoardTemplateSummary>("/api/task-app/board-templates", body);
  return data;
}

export type BoardTemplateDetail = {
  id: string;
  name: string;
  description: string;
  isBuiltin: boolean;
  lists: { title: string; key: string | null }[];
  workspaceId: string | null;
};

export async function fetchBoardTemplate(templateId: string): Promise<BoardTemplateDetail> {
  const { data } = await api.get<BoardTemplateDetail>(`/api/task-app/board-templates/${templateId}`);
  return data;
}

export async function patchCustomBoardTemplate(
  templateId: string,
  body: { name?: string; description?: string; lists?: { title: string; key?: string | null }[] },
): Promise<BoardTemplateSummary> {
  const { data } = await api.patch<BoardTemplateSummary>(`/api/task-app/board-templates/${templateId}`, body);
  return data;
}

export type ProjectSpaceDto = {
  id: string;
  name: string;
  position: number;
  isDefault?: boolean;
  purpose?: string | null;
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
  body: { name?: string; archived?: boolean; purpose?: string | null },
): Promise<ProjectSpaceDto> {
  const { data } = await api.patch<ProjectSpaceDto>(`/api/task-app/project-spaces/${projectSpaceId}`, body);
  return data;
}

export type CloseProjectSpaceDisposition = "transferBoardsToDefault" | "archiveBoards";

export async function deleteProjectSpace(
  projectSpaceId: string,
  disposition: CloseProjectSpaceDisposition,
): Promise<void> {
  await api.delete(`/api/task-app/project-spaces/${projectSpaceId}`, { data: { disposition } });
}

export async function createBrand(name: string): Promise<BrandTreeDto> {
  const { data } = await api.post<BrandTreeDto>("/api/task-app/brands", { name });
  return data;
}

export type JoinBrandWithKeyResult = {
  ok: boolean;
  brandId: string;
  workspaceId: string | null;
  alreadyHadAccess: boolean;
};

export async function joinBrandWithKey(joinKey: string): Promise<JoinBrandWithKeyResult> {
  const { data } = await api.post<JoinBrandWithKeyResult>("/api/task-app/brands/join-with-key", { joinKey });
  return data;
}

export async function regenerateBrandJoinKey(brandId: string): Promise<{ joinKey: string }> {
  const { data } = await api.post<{ joinKey: string }>(
    `/api/task-app/brands/${encodeURIComponent(brandId)}/regenerate-join-key`,
  );
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

export type ArchivedProjectSpaceSummary = {
  id: string;
  name: string;
  archivedAt: string;
};

/** Archived delivery threads for the given brand workspace only. */
export async function fetchArchivedProjectSpaces(
  workspaceId: string,
): Promise<ArchivedProjectSpaceSummary[]> {
  const { data } = await api.get<{ projectSpaces: ArchivedProjectSpaceSummary[] }>(
    `/api/task-app/workspaces/${workspaceId}/archived-project-spaces`,
  );
  return data.projectSpaces;
}

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
    subBoardId?: string;
    /** @deprecated Use `subBoardId`. */
    listId?: string;
    trackerStatus?: string;
    priority?: string;
    routingSource?: string | null;
  },
): Promise<TaskFlowTask> {
  const { subBoardId, listId, ...rest } = body;
  const { data } = await api.post<TaskFlowTask>(`/api/task-app/boards/${boardId}/tasks`, {
    ...rest,
    ...(subBoardId ? { subBoardId } : listId ? { subBoardId: listId } : {}),
  });
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

export async function postBoardLabel(
  boardId: string,
  body: { name: string; color: string },
): Promise<BoardDto> {
  const { data } = await api.post<BoardDto>(`/api/task-app/boards/${boardId}/labels`, body);
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
    subBoardId: string;
    trackerStatus: string;
    assigneeUserId: string | null;
    cardFaceLayout: string;
    showCompleteCheckbox: boolean | null;
    archived: boolean;
  }>,
): Promise<TaskFlowTask> {
  const { listId, subBoardId, ...rest } = body;
  const { data } = await api.patch<TaskFlowTask>(`/api/task-app/tasks/${taskId}`, {
    ...rest,
    ...(subBoardId !== undefined ? { subBoardId } : listId !== undefined ? { subBoardId: listId } : {}),
  });
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

export type LabelSuggestion = {
  scope: "board" | "user";
  id: string;
  name: string;
  color: string;
  boardId?: string;
};

export async function fetchLabelSuggestions(brandId: string): Promise<{
  frequent: LabelSuggestion[];
  recent: LabelSuggestion[];
}> {
  const { data } = await api.get<{ frequent: LabelSuggestion[]; recent: LabelSuggestion[] }>(
    `/api/task-app/brands/${brandId}/label-suggestions`,
  );
  return data;
}

export async function fetchMyTicketLabels(brandId: string): Promise<UserTicketLabelDto[]> {
  const { data } = await api.get<UserTicketLabelDto[]>(`/api/task-app/brands/${brandId}/my-ticket-labels`);
  return data;
}

export async function postMyTicketLabel(
  brandId: string,
  body: { name: string; color?: string },
): Promise<UserTicketLabelDto> {
  const { data } = await api.post<UserTicketLabelDto>(`/api/task-app/brands/${brandId}/my-ticket-labels`, body);
  return data;
}

export async function patchMyTicketLabel(
  brandId: string,
  labelId: string,
  body: Partial<{ name: string; color: string }>,
): Promise<UserTicketLabelDto> {
  const { data } = await api.patch<UserTicketLabelDto>(
    `/api/task-app/brands/${brandId}/my-ticket-labels/${labelId}`,
    body,
  );
  return data;
}

export async function deleteMyTicketLabel(brandId: string, labelId: string): Promise<void> {
  await api.delete(`/api/task-app/brands/${brandId}/my-ticket-labels/${labelId}`);
}

export async function addUserTicketLabelToTask(
  taskId: string,
  userBrandTicketLabelId: string,
): Promise<TaskFlowTask> {
  const { data } = await api.post<TaskFlowTask>(`/api/task-app/tasks/${taskId}/my-ticket-labels`, {
    userBrandTicketLabelId,
  });
  return data;
}

export async function removeUserTicketLabelFromTask(
  taskId: string,
  userBrandTicketLabelId: string,
): Promise<TaskFlowTask> {
  const { data } = await api.delete<TaskFlowTask>(
    `/api/task-app/tasks/${taskId}/my-ticket-labels/${userBrandTicketLabelId}`,
  );
  return data;
}
