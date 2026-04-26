-- AlterTable
ALTER TABLE "Board" ADD COLUMN "accentColor" VARCHAR(32) NOT NULL DEFAULT '#6366f1';

-- Distinct accent per board within each workspace (stable order)
WITH ranked AS (
  SELECT
    b.id,
    (ARRAY['#64748b', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#f97316'])[
      ((ROW_NUMBER() OVER (PARTITION BY ps."workspaceId" ORDER BY b."createdAt", b.id) - 1) % 8) + 1
    ] AS "newColor"
  FROM "Board" b
  INNER JOIN "ProjectSpace" ps ON ps.id = b."projectSpaceId"
)
UPDATE "Board" AS b
SET "accentColor" = ranked."newColor"
FROM ranked
WHERE b.id = ranked.id;

-- AlterTable
ALTER TABLE "BoardUserPreference" ADD COLUMN "showBoardAccentBorder" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "WorkspaceUserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ticketTrackerColorByBoard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceUserPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceUserPreference_userId_workspaceId_key" ON "WorkspaceUserPreference"("userId", "workspaceId");

CREATE INDEX "WorkspaceUserPreference_workspaceId_idx" ON "WorkspaceUserPreference"("workspaceId");

ALTER TABLE "WorkspaceUserPreference" ADD CONSTRAINT "WorkspaceUserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceUserPreference" ADD CONSTRAINT "WorkspaceUserPreference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
