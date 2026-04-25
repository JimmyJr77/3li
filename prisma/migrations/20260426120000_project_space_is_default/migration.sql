-- Primary project space per workspace: one row is marked isDefault.
-- Idempotent: `20260201120000_project_space_default_purpose` may already have added `isDefault` + index
-- (migration ordering / history overlap). Safe to re-run on Neon and local.

ALTER TABLE "ProjectSpace" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "ProjectSpace_workspaceId_isDefault_idx" ON "ProjectSpace"("workspaceId", "isDefault");

-- Mark the earliest-created active project space per workspace as the default.
UPDATE "ProjectSpace" ps
SET "isDefault" = true
FROM (
  SELECT DISTINCT ON ("workspaceId") id
  FROM "ProjectSpace"
  WHERE "archivedAt" IS NULL
  ORDER BY "workspaceId", "createdAt" ASC
) d
WHERE ps.id = d.id;
