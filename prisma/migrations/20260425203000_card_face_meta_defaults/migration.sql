-- Per-user board defaults for card face + optional per-sub-board meta overrides.
ALTER TABLE "BoardUserPreference"
ADD COLUMN IF NOT EXISTS "defaultCardFaceLayout" VARCHAR(64) NOT NULL DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS "defaultCardFaceMeta" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "SubBoardPreference"
ADD COLUMN IF NOT EXISTS "cardFaceMeta" JSONB;
