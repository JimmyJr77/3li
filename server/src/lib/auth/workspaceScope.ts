import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

export type AppUserPrincipal = { id: string; role: string };

/** Brands this user may open: owned, or shared via `BrandMember`. */
export function brandAccessWhereForUserId(userId: string): Prisma.BrandWhereInput {
  return {
    OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
  };
}

export function workspaceWhereForAppUser(user: AppUserPrincipal): Prisma.WorkspaceWhereInput {
  if (user.role === "admin") {
    return { archivedAt: null, brand: { archivedAt: null } };
  }
  return {
    archivedAt: null,
    brand: { archivedAt: null, ...brandAccessWhereForUserId(user.id) },
  };
}

export function brandWhereForAppUser(user: AppUserPrincipal): Prisma.BrandWhereInput {
  if (user.role === "admin") {
    return { archivedAt: null };
  }
  return { archivedAt: null, ...brandAccessWhereForUserId(user.id) };
}

export async function assertBrandOwnerAccess(
  user: AppUserPrincipal,
  brandId: string,
): Promise<boolean> {
  if (user.role === "admin") {
    const n = await prisma.brand.count({ where: { id: brandId } });
    return n > 0;
  }
  const n = await prisma.brand.count({
    where: { id: brandId, archivedAt: null, ownerUserId: user.id },
  });
  return n > 0;
}

export async function assertWorkspaceAccess(
  user: AppUserPrincipal,
  workspaceId: string | null | undefined,
): Promise<boolean> {
  if (!workspaceId) return false;
  const n = await prisma.workspace.count({
    where: { id: workspaceId, ...workspaceWhereForAppUser(user) },
  });
  return n > 0;
}

export async function listAccessibleWorkspaceIds(user: AppUserPrincipal): Promise<string[]> {
  const rows = await prisma.workspace.findMany({
    where: workspaceWhereForAppUser(user),
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function assertBrandAccess(user: AppUserPrincipal, brandId: string): Promise<boolean> {
  const n = await prisma.brand.count({
    where: { id: brandId, ...brandWhereForAppUser(user) },
  });
  return n > 0;
}

export async function getBoardWorkspaceId(boardId: string): Promise<string | null> {
  const b = await prisma.board.findUnique({
    where: { id: boardId },
    select: { projectSpace: { select: { workspaceId: true } } },
  });
  return b?.projectSpace.workspaceId ?? null;
}

export async function assertBoardAccess(user: AppUserPrincipal, boardId: string): Promise<boolean> {
  const wsId = await getBoardWorkspaceId(boardId);
  if (!wsId) return false;
  return assertWorkspaceAccess(user, wsId);
}

export async function getTaskWorkspaceId(taskId: string): Promise<string | null> {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      subBoard: { select: { board: { select: { projectSpace: { select: { workspaceId: true } } } } } },
    },
  });
  return t?.subBoard?.board?.projectSpace?.workspaceId ?? null;
}

export async function assertTaskAccess(user: AppUserPrincipal, taskId: string): Promise<boolean> {
  const wsId = await getTaskWorkspaceId(taskId);
  if (!wsId) return false;
  return assertWorkspaceAccess(user, wsId);
}

export async function getProjectSpaceWorkspaceId(projectSpaceId: string): Promise<string | null> {
  const ps = await prisma.projectSpace.findUnique({
    where: { id: projectSpaceId },
    select: { workspaceId: true },
  });
  return ps?.workspaceId ?? null;
}

export async function assertProjectSpaceAccess(
  user: AppUserPrincipal,
  projectSpaceId: string,
): Promise<boolean> {
  const wsId = await getProjectSpaceWorkspaceId(projectSpaceId);
  if (!wsId) return false;
  return assertWorkspaceAccess(user, wsId);
}

export async function assertProjectAccess(user: AppUserPrincipal, projectId: string): Promise<boolean> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!p?.workspaceId) {
    return false;
  }
  return assertWorkspaceAccess(user, p.workspaceId);
}
