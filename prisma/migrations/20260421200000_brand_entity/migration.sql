-- Create Brand; move Workspace.brandProfile to Brand; one Brand per existing Workspace (1:1 migration).

CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "brandProfile" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Brand_archivedAt_idx" ON "Brand"("archivedAt");

ALTER TABLE "Workspace" ADD COLUMN "brandId" TEXT;

-- For each workspace, create a brand and link (preserves global brand ordering as brand.position).
DO $$
DECLARE
  r RECORD;
  new_brand_id TEXT;
BEGIN
  FOR r IN
    SELECT "id", "brandProfile", "position", "archivedAt", "createdAt", "updatedAt"
    FROM "Workspace"
    ORDER BY "position" ASC, "createdAt" ASC
  LOOP
    new_brand_id := 'cm' || substr(md5(random()::text || clock_timestamp()::text || r."id"), 1, 24);
    INSERT INTO "Brand" ("id", "brandProfile", "position", "archivedAt", "createdAt", "updatedAt")
    VALUES (
      new_brand_id,
      r."brandProfile",
      r."position",
      r."archivedAt",
      r."createdAt",
      r."updatedAt"
    );
    UPDATE "Workspace"
    SET "brandId" = new_brand_id,
        "position" = 0
    WHERE "id" = r."id";
  END LOOP;
END $$;

ALTER TABLE "Workspace" ALTER COLUMN "brandId" SET NOT NULL;

ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Workspace_archivedAt_idx";

ALTER TABLE "Workspace" DROP COLUMN "brandProfile";

CREATE INDEX "Workspace_brandId_idx" ON "Workspace"("brandId");
CREATE INDEX "Workspace_archivedAt_idx" ON "Workspace"("archivedAt");
