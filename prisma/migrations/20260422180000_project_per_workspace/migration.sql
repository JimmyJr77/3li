-- One brainstorm/chat/RAG Project per brand Workspace (was a single global Project).

ALTER TABLE "Project" ADD COLUMN "workspaceId" TEXT;

CREATE UNIQUE INDEX "Project_workspaceId_key" ON "Project"("workspaceId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link the oldest Project to the oldest active Workspace (preserves existing brainstorm + chat data for that brand).
UPDATE "Project" p
SET "workspaceId" = (
  SELECT w.id
  FROM "Workspace" w
  WHERE w."archivedAt" IS NULL
  ORDER BY w."createdAt" ASC
  LIMIT 1
)
WHERE p.id = (SELECT id FROM "Project" ORDER BY "createdAt" ASC LIMIT 1)
  AND EXISTS (SELECT 1 FROM "Workspace" WHERE "archivedAt" IS NULL);

-- Create a Project for every Workspace that does not have one yet.
INSERT INTO "Project" ("id", "name", "createdAt", "workspaceId")
SELECT
  'cm' || substr(md5(random()::text || w.id || clock_timestamp()::text), 1, 22),
  w.name,
  CURRENT_TIMESTAMP,
  w.id
FROM "Workspace" w
WHERE w."archivedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Project" p WHERE p."workspaceId" = w.id);
