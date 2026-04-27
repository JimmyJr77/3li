-- CreateTable
CREATE TABLE "PagePresence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomKey" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagePresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagePresence_roomKey_lastSeenAt_idx" ON "PagePresence"("roomKey", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "PagePresence_userId_roomKey_tabId_key" ON "PagePresence"("userId", "roomKey", "tabId");

-- AddForeignKey
ALTER TABLE "PagePresence" ADD CONSTRAINT "PagePresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
