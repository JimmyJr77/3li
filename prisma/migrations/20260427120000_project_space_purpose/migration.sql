-- Optional human-readable purpose for a project space (delivery thread).
-- Idempotent: `purpose` may already exist from 20260201120000_project_space_default_purpose.
ALTER TABLE "ProjectSpace" ADD COLUMN IF NOT EXISTS "purpose" TEXT;
