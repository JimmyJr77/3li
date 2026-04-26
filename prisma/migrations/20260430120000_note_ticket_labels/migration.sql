-- Board labels and per-user brand ticket labels on notes (same label rows as tasks).

CREATE TABLE "NoteLabel" (
    "noteId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    CONSTRAINT "NoteLabel_pkey" PRIMARY KEY ("noteId","labelId")
);

CREATE TABLE "NoteUserBrandTicketLabel" (
    "noteId" TEXT NOT NULL,
    "userBrandTicketLabelId" TEXT NOT NULL,

    CONSTRAINT "NoteUserBrandTicketLabel_pkey" PRIMARY KEY ("noteId","userBrandTicketLabelId")
);

CREATE INDEX "NoteLabel_labelId_idx" ON "NoteLabel"("labelId");

CREATE INDEX "NoteUserBrandTicketLabel_userBrandTicketLabelId_idx" ON "NoteUserBrandTicketLabel"("userBrandTicketLabelId");

ALTER TABLE "NoteLabel" ADD CONSTRAINT "NoteLabel_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NoteLabel" ADD CONSTRAINT "NoteLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NoteUserBrandTicketLabel" ADD CONSTRAINT "NoteUserBrandTicketLabel_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NoteUserBrandTicketLabel" ADD CONSTRAINT "NoteUserBrandTicketLabel_userBrandTicketLabelId_fkey" FOREIGN KEY ("userBrandTicketLabelId") REFERENCES "UserBrandTicketLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
