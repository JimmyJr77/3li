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
  /** #RRGGBB or null for default row tint */
  rowAccentColor?: string | null;
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
  /** #RRGGBB or null for default row tint */
  rowAccentColor?: string | null;
  isPinned: boolean;
  isPublic: boolean;
  publicSlug: string | null;
  /** When set, note was created from Rapid Router / similar capture flows. */
  routingSource?: string | null;
  createdAt: string;
  updatedAt: string;
  tags: NoteTagDto[];
};

export type NotesBootstrapDto = {
  /** Which LLM stack the API uses (Ollama locally, OpenAI when deployed). */
  ai?: {
    backend: "openai" | "ollama";
    chatModel: string;
    embeddingModel: string;
  };
  workspace: NotesWorkspaceDto;
  defaultFolderId: string;
  /** Notebook where Quick Capture (⌘⇧C) saves new notes (typically "Quicknotes"). */
  quickCaptureFolderId: string;
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
