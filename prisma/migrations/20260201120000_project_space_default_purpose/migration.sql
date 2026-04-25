-- Default project space flag + optional purpose; backfill one default per workspace.
ALTER TABLE "ProjectSpace" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectSpace" ADD COLUMN "purpose" TEXT;

CREATE INDEX "ProjectSpace_workspaceId_isDefault_idx" ON "ProjectSpace"("workspaceId", "isDefault");

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "workspaceId" ORDER BY "position" ASC, "createdAt" ASC) AS rn
  FROM "ProjectSpace"
  WHERE "archivedAt" IS NULL
)
UPDATE "ProjectSpace" p
SET "isDefault" = true
FROM ranked r
WHERE p.id = r.id AND r.rn = 1;
