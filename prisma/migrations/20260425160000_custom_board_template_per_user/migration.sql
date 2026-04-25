-- Custom board templates are owned by a single app user; not shared across logins.
ALTER TABLE "CustomBoardTemplate" ADD COLUMN "createdByUserId" TEXT;

CREATE INDEX "CustomBoardTemplate_createdByUserId_idx" ON "CustomBoardTemplate"("createdByUserId");

ALTER TABLE "CustomBoardTemplate" ADD CONSTRAINT "CustomBoardTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
