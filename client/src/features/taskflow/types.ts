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
  /** When set, task originated from Rapid Router / Mailroom-style capture. */
  routingSource?: string | null;
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

export type ProjectSpaceSummaryDto = {
  id: string;
  name: string;
  position: number;
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
