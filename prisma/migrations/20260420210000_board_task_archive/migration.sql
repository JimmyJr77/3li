-- AlterTable
ALTER TABLE "Board" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Board_workspaceId_archivedAt_idx" ON "Board"("workspaceId", "archivedAt");

-- CreateIndex
CREATE INDEX "Task_listId_archivedAt_idx" ON "Task"("listId", "archivedAt");
