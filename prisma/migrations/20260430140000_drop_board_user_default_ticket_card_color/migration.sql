-- Per-user default ticket card color removed; board accent + sub-board prefs cover coloring.
ALTER TABLE "BoardUserPreference" DROP COLUMN IF EXISTS "defaultTicketCardColor";
