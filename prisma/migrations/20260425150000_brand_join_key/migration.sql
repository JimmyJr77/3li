-- Add shareable / rotatable join key (backfill from primary id for existing rows).
ALTER TABLE "Brand" ADD COLUMN "joinKey" TEXT;

UPDATE "Brand" SET "joinKey" = "id" WHERE "joinKey" IS NULL;

CREATE UNIQUE INDEX "Brand_joinKey_key" ON "Brand"("joinKey");

ALTER TABLE "Brand" ALTER COLUMN "joinKey" SET NOT NULL;
