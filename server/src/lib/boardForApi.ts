/** Prisma Board rows include `projectSpace` for resolving ecosystem `workspaceId` in API responses. */

export type BoardWithWorkspaceRef = {
  projectSpace: { workspaceId: string };
} & Record<string, unknown>;

export function boardJsonForApi<T extends BoardWithWorkspaceRef>(b: T | null) {
  if (!b) return null;
  const { projectSpace, ...rest } = b;
  return {
    ...(rest as object),
    workspaceId: projectSpace.workspaceId,
  } as Omit<T, "projectSpace"> & { workspaceId: string };
}

/** Task list include shape: list.board.projectSpace.workspaceId → list.board.workspaceId */
export function taskJsonForApi<T extends { list?: { board?: BoardWithWorkspaceRef | null } | null }>(
  t: T | null,
): T | null {
  if (!t) return t;
  const lb = t.list?.board;
  if (!lb?.projectSpace) return t;
  const { projectSpace, ...boardRest } = lb;
  return {
    ...t,
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
