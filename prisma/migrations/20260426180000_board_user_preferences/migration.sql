-- Per-user project board defaults (tickets, lanes, sub-board tab visibility).
CREATE TABLE "BoardUserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "defaultTicketCardColor" VARCHAR(32),
    "defaultHiddenTrackerStatuses" "TrackerStatus"[] DEFAULT ARRAY[]::"TrackerStatus"[],
    "defaultCompleteCheckboxVisible" BOOLEAN NOT NULL DEFAULT true,
    "hiddenSubBoardIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardUserPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoardUserPreference_userId_boardId_key" ON "BoardUserPreference"("userId", "boardId");

CREATE INDEX "BoardUserPreference_boardId_idx" ON "BoardUserPreference"("boardId");

ALTER TABLE "BoardUserPreference" ADD CONSTRAINT "BoardUserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoardUserPreference" ADD CONSTRAINT "BoardUserPreference_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
