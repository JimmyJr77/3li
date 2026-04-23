-- Brainstorm canvas: multiple node kinds + edge line styles
ALTER TABLE "IdeaNode" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'idea';
ALTER TABLE "IdeaNode" ADD COLUMN IF NOT EXISTS "payload" JSONB;

ALTER TABLE "IdeaEdge" ADD COLUMN IF NOT EXISTS "lineStyle" TEXT NOT NULL DEFAULT 'solid';
