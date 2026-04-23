-- ProjectSpace: project spaces (delivery groupings); Board moves from Workspace to ProjectSpace; exactly one Workspace per Brand.

CREATE TABLE "ProjectSpace" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSpace_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectSpace_workspaceId_idx" ON "ProjectSpace"("workspaceId");
CREATE INDEX "ProjectSpace_workspaceId_archivedAt_idx" ON "ProjectSpace"("workspaceId", "archivedAt");

ALTER TABLE "ProjectSpace" ADD CONSTRAINT "ProjectSpace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One ProjectSpace per existing Workspace (preserves former “project space” names as project spaces).
INSERT INTO "ProjectSpace" ("id", "workspaceId", "name", "position", "archivedAt", "createdAt", "updatedAt")
SELECT
  'ps' || substr(md5(w."id" || 'ps'), 1, 22),
  w."id",
  w."name",
  w."position",
  w."archivedAt",
  w."createdAt",
  w."updatedAt"
FROM "Workspace" w;

ALTER TABLE "Board" ADD COLUMN "projectSpaceId" TEXT;

UPDATE "Board" b
SET "projectSpaceId" = ps."id"
FROM "ProjectSpace" ps
WHERE ps."workspaceId" = b."workspaceId";

-- Merge multiple workspaces per brand into one ecosystem Workspace.
DO $$
DECLARE
  r RECORD;
  primary_id TEXT;
  secondary_id TEXT;
  ids TEXT[];
  i INT;
BEGIN
  FOR r IN
    SELECT "brandId", array_agg("id" ORDER BY "position" ASC, "createdAt" ASC) AS ids
    FROM "Workspace"
    GROUP BY "brandId"
    HAVING COUNT(*) > 1
  LOOP
    ids := r.ids;
    primary_id := ids[1];
    FOR i IN 2..array_length(ids, 1) LOOP
      secondary_id := ids[i];
      UPDATE "Note" SET "workspaceId" = primary_id WHERE "workspaceId" = secondary_id;
      UPDATE "NotesFolder" SET "workspaceId" = primary_id WHERE "workspaceId" = secondary_id;
      UPDATE "NoteTag" SET "workspaceId" = primary_id WHERE "workspaceId" = secondary_id;
      UPDATE "ChatThread" SET "workspaceId" = primary_id WHERE "workspaceId" = secondary_id;
      UPDATE "CustomBoardTemplate" SET "workspaceId" = primary_id WHERE "workspaceId" = secondary_id;
      UPDATE "ProjectSpace" SET "workspaceId" = primary_id WHERE "workspaceId" = secondary_id;
      DELETE FROM "Workspace" WHERE "id" = secondary_id;
    END LOOP;
  END LOOP;
END $$;

-- Boards must reference ProjectSpace
DELETE FROM "Board" WHERE "projectSpaceId" IS NULL;

ALTER TABLE "Board" DROP CONSTRAINT "Board_workspaceId_fkey";
DROP INDEX IF EXISTS "Board_workspaceId_idx";
DROP INDEX IF EXISTS "Board_workspaceId_archivedAt_idx";

ALTER TABLE "Board" DROP COLUMN "workspaceId";

ALTER TABLE "Board" ALTER COLUMN "projectSpaceId" SET NOT NULL;

ALTER TABLE "Board" ADD CONSTRAINT "Board_projectSpaceId_fkey" FOREIGN KEY ("projectSpaceId") REFERENCES "ProjectSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Board_projectSpaceId_idx" ON "Board"("projectSpaceId");
CREATE INDEX "Board_projectSpaceId_archivedAt_idx" ON "Board"("projectSpaceId", "archivedAt");

ALTER TABLE "Workspace" DROP COLUMN "position";

DROP INDEX IF EXISTS "Workspace_brandId_idx";

CREATE UNIQUE INDEX "Workspace_brandId_key" ON "Workspace"("brandId");
