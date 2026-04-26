-- AlterTable
ALTER TABLE "BoardList" ADD COLUMN "accentColor" VARCHAR(32) NOT NULL DEFAULT '#6366f1';

-- Distinct accent per sub-board within each board (stable order)
WITH ranked AS (
  SELECT
    bl.id,
    (ARRAY['#64748b', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#f97316'])[
      ((ROW_NUMBER() OVER (PARTITION BY bl."boardId" ORDER BY bl."position", bl.id) - 1) % 8) + 1
    ] AS "newColor"
  FROM "BoardList" bl
)
UPDATE "BoardList" AS bl
SET "accentColor" = ranked."newColor"
FROM ranked
WHERE bl.id = ranked.id;

-- AlterTable
ALTER TABLE "SubBoardPreference" ADD COLUMN "showSubBoardAccentStrip" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "WorkspaceUserPreference" ADD COLUMN "ticketTrackerSubBoardStrip" BOOLEAN NOT NULL DEFAULT false;
