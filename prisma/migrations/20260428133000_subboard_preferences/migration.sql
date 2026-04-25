-- Create table for per-user sub-board display preferences
CREATE TABLE "SubBoardPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subBoardId" TEXT NOT NULL,
  "ticketCardColor" VARCHAR(32),
  "cardFaceLayout" VARCHAR(64) NOT NULL DEFAULT 'standard',
  "completeCheckboxVisibleByDefault" BOOLEAN NOT NULL DEFAULT true,
  "hiddenTrackerStatuses" "TrackerStatus"[] DEFAULT ARRAY[]::"TrackerStatus"[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubBoardPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubBoardPreference_userId_subBoardId_key"
ON "SubBoardPreference"("userId", "subBoardId");

CREATE INDEX "SubBoardPreference_subBoardId_idx"
ON "SubBoardPreference"("subBoardId");

ALTER TABLE "SubBoardPreference"
ADD CONSTRAINT "SubBoardPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubBoardPreference"
ADD CONSTRAINT "SubBoardPreference_subBoardId_fkey"
FOREIGN KEY ("subBoardId") REFERENCES "BoardList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
