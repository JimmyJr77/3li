export type NotesWorkspaceDto = {
  id: string;
  name: string;
  /** Brand for ticket-style labels (same as project boards in this workspace). */
  brandId: string;
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
  /** Same shape as ticket labels: board `Label` rows + personal `UserBrandTicketLabel` rows. */
  labels: { label: { id: string; name: string; color: string }; labelScope?: "board" | "user" }[];
};

/** Response from `POST /notes-app/notes/:id/mail-clerk-autotag` (preview only; nothing applied until user confirms). */
export type MailClerkAutotagSuggestionDto = {
  name: string;
  match: { kind: "board" | "user"; id: string; color: string } | null;
};

export type MailClerkAutotagResponseDto = {
  /** Key themes extracted from the note (for display / future UX). */
  themes: string[];
  suggestions: MailClerkAutotagSuggestionDto[];
};

export type NotesBootstrapDto = {
  /** Which LLM stack the API uses (Ollama locally, OpenAI when deployed). */
  ai?: {
    backend: "openai" | "ollama" | "groq";
    chatModel: string;
    embeddingModel: string;
  };
  workspace: NotesWorkspaceDto;
  defaultFolderId: string;
  /** Notebook where Quick Capture (⌘⇧C) saves new notes (typically "Quicknotes"). */
  quickCaptureFolderId: string;
  /** Primary project board in this workspace for board-scoped label chips (or null). */
  defaultLabelBoardId: string | null;
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
