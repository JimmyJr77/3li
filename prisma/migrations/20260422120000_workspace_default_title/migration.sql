-- Backfill generic workspace titles to "{first project space name} Workspace" (64 char max).

UPDATE "Workspace" AS w
SET name = LEFT(TRIM(ps.name) || ' Workspace', 64)
FROM (
  SELECT DISTINCT ON ("workspaceId") "workspaceId", name
  FROM "ProjectSpace"
  WHERE "archivedAt" IS NULL
  ORDER BY "workspaceId", position ASC, "createdAt" ASC
) AS ps
WHERE w.id = ps."workspaceId"
  AND w.name = 'Workspace';
