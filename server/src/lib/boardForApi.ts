/** Prisma Board rows include `projectSpace` for resolving ecosystem `workspaceId` in API responses. */

import type { TrackerStatus } from "@prisma/client";
import { activityActorDto, type ActivityActorUserFields } from "./activityActorLabel.js";
import { TRACKER_STATUS_ORDER } from "./trackerStatus.js";

type ActivityWithOptionalActor = {
  id: string;
  action: string;
  detail: string;
  createdAt: Date;
  actorUser?: ActivityActorUserFields | null;
};

function mapActivityForApi(a: ActivityWithOptionalActor) {
  const { actorUser, ...rest } = a;
  return {
    ...rest,
    actor: activityActorDto(actorUser ?? null),
  };
}

export type BoardWithWorkspaceRef = {
  projectSpace: { workspaceId: string; workspace?: { brandId: string } };
} & Record<string, unknown>;

function trackerRank(s: TrackerStatus): number {
  const i = TRACKER_STATUS_ORDER.indexOf(s);
  return i === -1 ? 999 : i;
}

/** Sort tasks for a sub-board: tracker column order, then order field. */
function sortTasksForSubBoard<T extends { trackerStatus: TrackerStatus; order: number }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const d = trackerRank(a.trackerStatus) - trackerRank(b.trackerStatus);
    if (d !== 0) return d;
    return a.order - b.order;
  });
}

export function boardJsonForApi<T extends BoardWithWorkspaceRef>(b: T | null) {
  if (!b) return null;
  const { projectSpace, lists, ...rest } = b as T & { lists?: unknown };
  const brandId = projectSpace?.workspace?.brandId;
  const mappedLists = Array.isArray(lists)
    ? lists.map((list: unknown) => {
        if (!list || typeof list !== "object") return list;
        const ls = list as { tasks?: unknown[] };
        if (!Array.isArray(ls.tasks)) return list;
        const sorted = sortTasksForSubBoard(
          ls.tasks as { trackerStatus: TrackerStatus; order: number }[],
        ) as unknown[];
        return {
          ...ls,
          tasks: sorted.map((task) => taskJsonForApi(task as Parameters<typeof taskJsonForApi>[0])),
        };
      })
    : lists;
  return {
    ...(rest as object),
    ...(mappedLists !== undefined ? { lists: mappedLists } : {}),
    workspaceId: projectSpace.workspaceId,
    ...(brandId ? { brandId } : {}),
  } as Omit<T, "projectSpace"> & { workspaceId: string; brandId?: string };
}

type SubBoardWithBoard = {
  id: string;
  title: string;
  key: string | null;
  position: number;
  boardId: string;
  board: BoardWithWorkspaceRef & Record<string, unknown>;
};

/** Task list include shape: subBoard.board.projectSpace.workspaceId → list.board.workspaceId for API compat */
export function taskJsonForApi<
  T extends {
    subBoard?: SubBoardWithBoard | null;
    list?: { board?: BoardWithWorkspaceRef | null } | null;
    activities?: ActivityWithOptionalActor[];
    trackerStatus?: TrackerStatus;
    createdBy?: ActivityActorUserFields | null;
    assignee?: ActivityActorUserFields | null;
    labels?: Array<{ label: { id: string; name: string; color: string } }>;
    /** Junction rows may omit nested `userBrandTicketLabel` depending on Prisma include / unions. */
    userBrandTicketLabels?: Array<{
      taskId?: string;
      userBrandTicketLabelId?: string;
      userBrandTicketLabel?: { id: string; name: string; color: string } | null;
    }>;
  },
>(t: T | null): T | null {
  if (!t) return t;
  const activities =
    t.activities && t.activities.length > 0
      ? t.activities.map((a) => mapActivityForApi(a))
      : t.activities;

  const sub = t.subBoard;
  const lb = sub?.board ?? t.list?.board;
  const mappedActivities = activities !== t.activities ? activities : undefined;

  let withList: T = t;
  if (sub?.board?.projectSpace) {
    const { projectSpace, ...boardRest } = sub.board;
    const listCompat = {
      id: sub.id,
      title: sub.title,
      key: sub.key,
      position: sub.position,
      boardId: sub.boardId,
      board: {
        ...boardRest,
        workspaceId: projectSpace.workspaceId,
      },
    };
    withList = {
      ...t,
      ...(mappedActivities !== undefined ? { activities: mappedActivities } : {}),
      list: listCompat as unknown as T["list"],
    } as T;
  } else if (lb?.projectSpace) {
    const { projectSpace, ...boardRest } = lb;
    withList = {
      ...t,
      ...(mappedActivities !== undefined ? { activities: mappedActivities } : {}),
      list: t.list
        ? {
            ...t.list,
            board: {
              ...boardRest,
              workspaceId: projectSpace.workspaceId,
            },
          }
        : t.list,
    } as T;
  } else if (mappedActivities !== undefined) {
    withList = { ...t, activities: mappedActivities } as T;
  }

  const row = withList as T & { subBoardId?: string; listId?: string };
  const boardLabels = (row.labels ?? []).map((x) => ({ ...x, labelScope: "board" as const }));
  const userLabels = (row.userBrandTicketLabels ?? [])
    .filter((x): x is typeof x & { userBrandTicketLabel: NonNullable<typeof x.userBrandTicketLabel> } =>
      Boolean(x.userBrandTicketLabel),
    )
    .map((x) => ({
      label: {
        id: x.userBrandTicketLabel.id,
        name: x.userBrandTicketLabel.name,
        color: x.userBrandTicketLabel.color,
      },
      labelScope: "user" as const,
    }));
  const { userBrandTicketLabels: _ubl, labels: _lb, ...rowRest } = row as T & {
    userBrandTicketLabels?: unknown;
    labels?: unknown;
  };
  const mergedBase = {
    ...rowRest,
    labels: [...boardLabels, ...userLabels],
  } as unknown as T;

  const m = mergedBase as T & { subBoardId?: string; listId?: string };
  const compatListId = sub?.id ?? m.subBoardId;
  if (compatListId && m.listId === undefined) {
    return { ...mergedBase, listId: compatListId } as T;
  }
  return mergedBase;
}
