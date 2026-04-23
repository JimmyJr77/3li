import { prisma } from "./db.js";

/** Brainstorm + consulting chat + RAG: exactly one `Project` per brand workspace. */
export async function ensureBrainstormProjectForWorkspace(workspaceId: string) {
  const existing = await prisma.project.findFirst({
    where: { workspaceId },
  });
  if (existing) {
    return existing;
  }
  const ws = await prisma.workspace.findFirst({
    where: { id: workspaceId, archivedAt: null },
  });
  if (!ws) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }
  return prisma.project.create({
    data: { name: ws.name, workspaceId },
  });
}
