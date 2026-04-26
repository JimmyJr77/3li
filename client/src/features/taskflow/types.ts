import type { TrackerStatus } from "./trackerMeta";

export type LabelDto = {
  id: string;
  name: string;
  color: string;
};

/** Your reusable labels for tickets in this brand (API: `/brands/:brandId/my-ticket-labels`). */
export type UserTicketLabelDto = {
  id: string;
  name: string;
  color: string;
  updatedAt?: string | null;
};

export type TaskFlowTask = {
  id: string;
  /** Per-brand human ticket # (1, 2, 3, …) when the API has assigned it. */
  brandTicketNumber?: number | null;
  title: string;
  description: string;
  completed: boolean;
  order: number;
  priority: string;
  /** ISO creation time from API (task row). */
  createdAt?: string;
  /** Set when the task is archived (soft-deleted). Omitted on older API responses. */
  archivedAt?: string | null;
  dueDate: string | null;
  startDate: string | null;
  ideaNodeId: string | null;
  /** When set, task originated from Rapid Router / Mailroom-style capture. */
  routingSource?: string | null;
  /** Placement: project sub-board (`BoardList` id). */
  subBoardId: string;
  trackerStatus: TrackerStatus;
  createdByUserId?: string | null;
  assigneeUserId?: string | null;
  /** Display ref from API (`activityActorDto`); pair with `createdByUserId`. */
  createdBy?: { id: string; label: string } | null;
  assignee?: { id: string; label: string } | null;
  lastAssignedAt?: string | null;
  /** @deprecated Use sub-board preference `cardFaceLayout`. */
  cardFaceLayout?: string;
  /** null = use sub-board `completeCheckboxVisibleByDefault`. */
  showCompleteCheckbox?: boolean | null;
  /** @deprecated Same as `subBoardId`; kept while API may send both. */
  listId?: string;
  ideaNode: { id: string; title: string } | null;
  labels: { label: LabelDto; labelScope?: "board" | "user" }[];
  /** Present on flat `/tasks` responses for table/calendar views */
  list?: {
    id: string;
    title: string;
    key: string | null;
    position: number;
    boardId: string;
    board: { id: string; name: string; workspaceId: string };
  };
  comments?: {
    id: string;
    body: string;
    createdAt: string;
    author?: { id: string; label: string } | null;
  }[];
  checklist?: { id: string; title: string; completed: boolean; position: number }[];
  activities?: {
    id: string;
    action: string;
    detail: string;
    createdAt: string;
    actor: { id: string; label: string } | null;
  }[];
};

export type BoardListDto = {
  id: string;
  title: string;
  key: string | null;
  position: number;
  tasks: TaskFlowTask[];
};

export type SubBoardPreferenceDto = {
  subBoardId: string;
  ticketCardColor: string | null;
  /** standard | minimal — ticket cards on this sub-board for this user. */
  cardFaceLayout: string;
  /** Optional JSON overrides for “title + meta” on standard cards; merged with board defaults. */
  cardFaceMeta?: unknown | null;
  /** When true, kanban cards show the done checkbox unless a ticket overrides. */
  completeCheckboxVisibleByDefault: boolean;
  hiddenTrackerStatuses: TrackerStatus[];
  updatedAt: string | null;
};

/** Per-user defaults for an entire project board (`/boards/:boardId/user-board-preferences`). */
export type BoardUserPreferenceDto = {
  boardId: string;
  defaultTicketCardColor: string | null;
  defaultHiddenTrackerStatuses: TrackerStatus[];
  defaultCompleteCheckboxVisible: boolean;
  /** standard | minimal — default for sub-boards with no saved layout preference row. */
  defaultCardFaceLayout?: string;
  /** Default “title + meta” fields for standard cards (`{}` = all on). */
  defaultCardFaceMeta?: unknown;
  hiddenSubBoardIds: string[];
  updatedAt: string | null;
};

export type BoardDto = {
  id: string;
  name: string;
  workspaceId: string;
  /** Parent brand for this board’s workspace (for personal ticket labels, etc.). */
  brandId?: string;
  /** Set when the board is archived (hidden from default project space lists). */
  archivedAt?: string | null;
  lists: BoardListDto[];
  labels: LabelDto[];
};

export type ProjectSpaceSummaryDto = {
  id: string;
  name: string;
  position: number;
  /** True for the one primary project space per brand workspace (created on first use); cannot be archived. */
  isDefault?: boolean;
  /** Optional delivery-thread / PM context. */
  purpose?: string | null;
  boards: { id: string; name: string; position: number }[];
};

/** One ecosystem row per brand (notes, notebooks, …). Project spaces live in `projectSpaces`. */
export type WorkspaceDto = {
  id: string;
  /** Workspace row label (Settings). Sidebar chrome prefers brand name / kit display name when set. */
  name: string;
  /** Parent brand; kit and sidebar label come from the brand. */
  brandId: string;
  /** Canonical brand name from Settings (lists, “My brands”, copy that refers to the brand). */
  brandName: string;
  /** Brand Center `identity.displayName` when set (kit / AI context). */
  brandDisplayName?: string | null;
  projectSpaces: ProjectSpaceSummaryDto[];
};

/** Brand with nested workspace and project spaces (settings / admin API). */
export type BrandTreeDto = {
  id: string;
  /** Canonical brand name (editable in Settings). */
  name: string;
  position: number;
  /** Shareable join key for this brand (rotatable; not the internal database id). */
  brandIdentifier: string;
  ownerUserId: string | null;
  /** True when the signed-in account owns the brand, is an admin, or otherwise has owner-level control in the UI. */
  youAreOwner: boolean;
  brandDisplayName?: string | null;
  workspaces: {
    id: string;
    name: string;
    projectSpaces: ProjectSpaceSummaryDto[];
  }[];
};

export type BrandTeamMemberDto = {
  membershipId: string;
  userId: string;
  username: string;
  email: string;
  label: string;
  invitedByUserId: string | null;
};

export type BrandTeamPendingInviteDto = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
};

export type BrandTeamDto = {
  brandId: string;
  brandName: string;
  brandIdentifier: string;
  ownerUserId: string | null;
  owner: { id: string; username: string; email: string; label: string };
  members: BrandTeamMemberDto[];
  pendingInvites: BrandTeamPendingInviteDto[];
};

export type BrandInviteCreatedDto = {
  email: string;
  registerUrl: string;
  landingUrl: string;
};

export type BootstrapDto = {
  workspace: WorkspaceDto;
  board: BoardDto | null;
};
