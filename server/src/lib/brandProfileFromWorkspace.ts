import { prisma } from "./db.js";

/** Load the brand kit JSON for a project space (Workspace) via its parent Brand. */
export async function loadBrandProfileJsonForWorkspaceId(workspaceId: string) {
  const row = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { brand: { select: { brandProfile: true } } },
  });
  return row?.brand?.brandProfile ?? null;
}
