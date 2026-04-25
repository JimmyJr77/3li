-- Primary project space per brand workspace: one row is marked isDefault; it cannot be archived.
ALTER TABLE "ProjectSpace" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ProjectSpace_workspaceId_isDefault_idx" ON "ProjectSpace"("workspaceId", "isDefault");

-- Mark the earliest-created active project space per workspace as the default (matches first-time brand setup).
UPDATE "ProjectSpace" ps
SET "isDefault" = true
FROM (
  SELECT DISTINCT ON ("workspaceId") id
  FROM "ProjectSpace"
  WHERE "archivedAt" IS NULL
  ORDER BY "workspaceId", "createdAt" ASC
) d
WHERE ps.id = d.id;
