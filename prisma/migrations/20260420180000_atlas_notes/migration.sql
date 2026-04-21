-- Atlas Notes: folders, notes, tags (implicit M2M), links

CREATE TABLE "NotesFolder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotesFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "folderId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "slug" TEXT,
    "contentJson" JSONB,
    "previewText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publicSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NoteTag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NoteLink" (
    "id" TEXT NOT NULL,
    "fromNoteId" TEXT NOT NULL,
    "toNoteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_NoteToNoteTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_NoteToNoteTag_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE UNIQUE INDEX "Note_publicSlug_key" ON "Note"("publicSlug");

CREATE UNIQUE INDEX "Note_workspaceId_slug_key" ON "Note"("workspaceId", "slug");

CREATE UNIQUE INDEX "NoteTag_workspaceId_name_key" ON "NoteTag"("workspaceId", "name");

CREATE UNIQUE INDEX "NoteLink_fromNoteId_toNoteId_key" ON "NoteLink"("fromNoteId", "toNoteId");

CREATE INDEX "NotesFolder_workspaceId_idx" ON "NotesFolder"("workspaceId");

CREATE INDEX "NotesFolder_parentId_idx" ON "NotesFolder"("parentId");

CREATE INDEX "Note_workspaceId_idx" ON "Note"("workspaceId");

CREATE INDEX "Note_folderId_idx" ON "Note"("folderId");

CREATE INDEX "NoteTag_workspaceId_idx" ON "NoteTag"("workspaceId");

CREATE INDEX "NoteLink_fromNoteId_idx" ON "NoteLink"("fromNoteId");

CREATE INDEX "NoteLink_toNoteId_idx" ON "NoteLink"("toNoteId");

CREATE INDEX "_NoteToNoteTag_B_index" ON "_NoteToNoteTag"("B");

ALTER TABLE "NotesFolder" ADD CONSTRAINT "NotesFolder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotesFolder" ADD CONSTRAINT "NotesFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "NotesFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Note" ADD CONSTRAINT "Note_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Note" ADD CONSTRAINT "Note_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "NotesFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NoteTag" ADD CONSTRAINT "NoteTag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_fromNoteId_fkey" FOREIGN KEY ("fromNoteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_toNoteId_fkey" FOREIGN KEY ("toNoteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_NoteToNoteTag" ADD CONSTRAINT "_NoteToNoteTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_NoteToNoteTag" ADD CONSTRAINT "_NoteToNoteTag_B_fkey" FOREIGN KEY ("B") REFERENCES "NoteTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
