-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN "email" TEXT;
ALTER TABLE "AppUser" ADD COLUMN "phone" TEXT;
ALTER TABLE "AppUser" ADD COLUMN "firstName" TEXT;
ALTER TABLE "AppUser" ADD COLUMN "lastName" TEXT;

-- Backfill email (unique per existing username)
UPDATE "AppUser" SET "email" = LOWER("username") || '@legacy.internal' WHERE "email" IS NULL;

ALTER TABLE "AppUser" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex (multiple NULLs allowed in PostgreSQL for unique phone)
CREATE UNIQUE INDEX "AppUser_phone_key" ON "AppUser"("phone");
