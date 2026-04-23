-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "actorUserId" TEXT;

-- CreateIndex
CREATE INDEX "Activity_actorUserId_idx" ON "Activity"("actorUserId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
