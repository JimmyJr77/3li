/** Prisma Board rows include `projectSpace` for resolving ecosystem `workspaceId` in API responses. */

import { activityActorDto, type ActivityActorUserFields } from "./activityActorLabel.js";

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
  projectSpace: { workspaceId: string };
} & Record<string, unknown>;

export function boardJsonForApi<T extends BoardWithWorkspaceRef>(b: T | null) {
  if (!b) return null;
  const { projectSpace, lists, ...rest } = b as T & { lists?: unknown };
  const mappedLists = Array.isArray(lists)
    ? lists.map((list: unknown) => {
        if (!list || typeof list !== "object") return list;
        const ls = list as { tasks?: unknown[] };
        if (!Array.isArray(ls.tasks)) return list;
        return {
          ...ls,
          tasks: ls.tasks.map((task) => taskJsonForApi(task as Parameters<typeof taskJsonForApi>[0])),
        };
      })
    : lists;
  return {
    ...(rest as object),
    ...(mappedLists !== undefined ? { lists: mappedLists } : {}),
    workspaceId: projectSpace.workspaceId,
  } as Omit<T, "projectSpace"> & { workspaceId: string };
}

/** Task list include shape: list.board.projectSpace.workspaceId → list.board.workspaceId */
export function taskJsonForApi<
  T extends {
    list?: { board?: BoardWithWorkspaceRef | null } | null;
    activities?: ActivityWithOptionalActor[];
  },
>(t: T | null): T | null {
  if (!t) return t;
  const lb = t.list?.board;
  const activities =
    t.activities && t.activities.length > 0
      ? t.activities.map((a) => mapActivityForApi(a))
      : t.activities;
  if (!lb?.projectSpace) {
    return activities !== t.activities ? { ...t, activities } : t;
  }
  const { projectSpace, ...boardRest } = lb;
  return {
    ...t,
    ...(activities !== undefined ? { activities } : {}),
    list: t.list
      ? {
          ...t.list,
          board: {
            ...boardRest,
            workspaceId: projectSpace.workspaceId,
          },
        }
      : t.list,
  };
}
