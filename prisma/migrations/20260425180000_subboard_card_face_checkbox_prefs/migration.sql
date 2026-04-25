-- Per-ticket override for complete checkbox visibility: NULL = inherit sub-board default.
-- (SubBoardPreference columns are created with the table in 20260428133000.)
ALTER TABLE "Task"
ADD COLUMN IF NOT EXISTS "showCompleteCheckbox" BOOLEAN;
