-- Optional edge caption and RF handle ids (tree vs lateral links on hierarchy nodes).
ALTER TABLE "IdeaEdge" ADD COLUMN IF NOT EXISTS "label" TEXT NOT NULL DEFAULT '';
ALTER TABLE "IdeaEdge" ADD COLUMN IF NOT EXISTS "sourceHandle" TEXT;
ALTER TABLE "IdeaEdge" ADD COLUMN IF NOT EXISTS "targetHandle" TEXT;
