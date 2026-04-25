-- Tickets: sub-board placement + tracker status; migrate from listId → subBoardId + BACKLOG.

CREATE TYPE "TrackerStatus" AS ENUM (
  'FREE_SPACE',
  'CONTEXT',
  'BRAINSTORM',
  'BACKLOG',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE'
);

ALTER TABLE "Task" ADD COLUMN "subBoardId" TEXT;
ALTER TABLE "Task" ADD COLUMN "trackerStatus" "TrackerStatus" NOT NULL DEFAULT 'BACKLOG';
ALTER TABLE "Task" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Task" ADD COLUMN "assigneeUserId" TEXT;
ALTER TABLE "Task" ADD COLUMN "lastAssignedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "cardFaceLayout" TEXT NOT NULL DEFAULT 'standard';

UPDATE "Task" SET "subBoardId" = "listId" WHERE "subBoardId" IS NULL;

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_listId_fkey";

DROP INDEX IF EXISTS "Task_listId_idx";
DROP INDEX IF EXISTS "Task_listId_archivedAt_idx";

ALTER TABLE "Task" DROP COLUMN "listId";

ALTER TABLE "Task" ALTER COLUMN "subBoardId" SET NOT NULL;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_subBoardId_fkey" FOREIGN KEY ("subBoardId") REFERENCES "BoardList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TicketAssignmentEvent" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "fromUserId" TEXT,
  "toUserId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketAssignmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TicketAssignmentEvent_taskId_idx" ON "TicketAssignmentEvent"("taskId");
CREATE INDEX "TicketAssignmentEvent_actorUserId_idx" ON "TicketAssignmentEvent"("actorUserId");

ALTER TABLE "TicketAssignmentEvent"
  ADD CONSTRAINT "TicketAssignmentEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketAssignmentEvent"
  ADD CONSTRAINT "TicketAssignmentEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Task_subBoardId_idx" ON "Task"("subBoardId");
CREATE INDEX "Task_subBoardId_trackerStatus_idx" ON "Task"("subBoardId", "trackerStatus");
CREATE INDEX "Task_subBoardId_trackerStatus_archivedAt_idx" ON "Task"("subBoardId", "trackerStatus", "archivedAt");
CREATE INDEX "Task_assigneeUserId_idx" ON "Task"("assigneeUserId");
CREATE INDEX "Task_createdByUserId_idx" ON "Task"("createdByUserId");
