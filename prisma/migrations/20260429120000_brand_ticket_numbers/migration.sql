-- Per-brand sequential ticket numbers
ALTER TABLE "Brand" ADD COLUMN "nextTicketNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Task" ADD COLUMN "brandTicketNumber" INTEGER;

-- Backfill: number tasks per brand in creation order
WITH brand_tasks AS (
  SELECT
    t.id AS "taskId",
    w."brandId" AS "brandId",
    ROW_NUMBER() OVER (PARTITION BY w."brandId" ORDER BY t."createdAt" ASC) AS rn
  FROM "Task" t
  INNER JOIN "BoardList" bl ON bl.id = t."subBoardId"
  INNER JOIN "Board" b ON b.id = bl."boardId"
  INNER JOIN "ProjectSpace" ps ON ps.id = b."projectSpaceId"
  INNER JOIN "Workspace" w ON w.id = ps."workspaceId"
  WHERE w."brandId" IS NOT NULL
)
UPDATE "Task" t
SET "brandTicketNumber" = bt.rn
FROM brand_tasks bt
WHERE t.id = bt."taskId";

-- Set next counter per brand (max + 1)
UPDATE "Brand" br
SET "nextTicketNumber" = COALESCE(sub.mx, 0) + 1
FROM (
  SELECT w."brandId" AS "bid", MAX(t."brandTicketNumber") AS mx
  FROM "Task" t
  INNER JOIN "BoardList" bl ON bl.id = t."subBoardId"
  INNER JOIN "Board" b ON b.id = bl."boardId"
  INNER JOIN "ProjectSpace" ps ON ps.id = b."projectSpaceId"
  INNER JOIN "Workspace" w ON w.id = ps."workspaceId"
  WHERE t."brandTicketNumber" IS NOT NULL
  GROUP BY w."brandId"
) sub
WHERE br.id = sub."bid";
