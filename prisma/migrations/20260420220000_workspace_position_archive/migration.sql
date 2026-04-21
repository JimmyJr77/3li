-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Workspace" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Workspace_archivedAt_idx" ON "Workspace"("archivedAt");

-- Backfill position from creation order (0-based)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) - 1 AS rn
  FROM "Workspace"
)
UPDATE "Workspace" w
SET "position" = o.rn
FROM ordered o
WHERE w.id = o.id;
