-- AlterTable
ALTER TABLE "NotesFolder" ADD COLUMN IF NOT EXISTS "rowAccentColor" TEXT;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "rowAccentColor" TEXT;
