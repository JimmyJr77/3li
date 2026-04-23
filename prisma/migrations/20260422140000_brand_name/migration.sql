-- Canonical brand name on Brand; workspace chrome title remains on Workspace.name.

ALTER TABLE "Brand" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Brand';

UPDATE "Brand" b
SET name = LEFT(TRIM(sub.ps_name), 64)
FROM (
  SELECT DISTINCT ON (b2.id)
    b2.id AS bid,
    ps.name AS ps_name
  FROM "Brand" b2
  INNER JOIN "Workspace" w ON w."brandId" = b2.id
  INNER JOIN "ProjectSpace" ps ON ps."workspaceId" = w.id AND ps."archivedAt" IS NULL
  ORDER BY b2.id ASC, w."createdAt" ASC, ps.position ASC, ps."createdAt" ASC
) AS sub
WHERE b.id = sub.bid
  AND TRIM(sub.ps_name) <> '';
