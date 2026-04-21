export type NotesWorkspaceDto = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type NotesFolderDto = {
  id: string;
  workspaceId: string;
  parentId: string | null;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type NoteTagDto = {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
};

export type AtlasNoteDto = {
  id: string;
  workspaceId: string;
  folderId: string | null;
  title: string;
  slug: string | null;
  contentJson: unknown;
  previewText: string | null;
  position: number;
  isPinned: boolean;
  isPublic: boolean;
  publicSlug: string | null;
  createdAt: string;
  updatedAt: string;
  tags: NoteTagDto[];
};

export type NotesBootstrapDto = {
  workspace: NotesWorkspaceDto;
  defaultFolderId: string;
  folders: NotesFolderDto[];
  notes: AtlasNoteDto[];
};

/** Minimal note row for link panels */
export type NoteLinkSummaryDto = {
  id: string;
  title: string;
  previewText: string | null;
  updatedAt: string;
};
