import { api } from "@/lib/api/client";
import type { AtlasNoteDto, NoteLinkSummaryDto, NoteTagDto, NotesBootstrapDto, NotesFolderDto } from "./types";

export async function fetchNotesBootstrap(): Promise<NotesBootstrapDto> {
  const { data } = await api.get<NotesBootstrapDto>("/api/notes-app/bootstrap");
  return data;
}

export async function fetchNotesList(params: {
  workspaceId: string;
  folderId?: string | "all";
}): Promise<AtlasNoteDto[]> {
  const { data } = await api.get<AtlasNoteDto[]>("/api/notes-app/notes", {
    params: {
      workspaceId: params.workspaceId,
      ...(params.folderId !== undefined ? { folderId: params.folderId } : {}),
    },
  });
  return data;
}

export async function createNote(body: {
  workspaceId: string;
  folderId?: string | null;
  title?: string;
  contentJson?: unknown | null;
  previewText?: string | null;
}): Promise<AtlasNoteDto> {
  const { data } = await api.post<AtlasNoteDto>("/api/notes-app/notes", body);
  return data;
}

export type PatchNoteBody = {
  title?: string;
  contentJson?: unknown | null;
  previewText?: string | null;
  folderId?: string | null;
  slug?: string | null;
  isPinned?: boolean;
  isPublic?: boolean;
  publicSlug?: string | null;
  tagIds?: string[];
  position?: number;
};

export async function patchNote(noteId: string, body: PatchNoteBody): Promise<AtlasNoteDto> {
  const { data } = await api.patch<AtlasNoteDto>(`/api/notes-app/notes/${noteId}`, body);
  return data;
}

export async function deleteNote(noteId: string): Promise<void> {
  await api.delete(`/api/notes-app/notes/${noteId}`);
}

export async function createFolder(body: {
  workspaceId: string;
  title: string;
  parentId?: string | null;
}): Promise<NotesFolderDto> {
  const { data } = await api.post<NotesFolderDto>("/api/notes-app/folders", body);
  return data;
}

export async function patchFolder(
  folderId: string,
  body: { title?: string; position?: number },
): Promise<NotesFolderDto> {
  const { data } = await api.patch<NotesFolderDto>(`/api/notes-app/folders/${folderId}`, body);
  return data;
}

export async function deleteFolder(folderId: string): Promise<void> {
  await api.delete(`/api/notes-app/folders/${folderId}`);
}

export async function reorderFolders(workspaceId: string, orderedFolderIds: string[]): Promise<void> {
  await api.patch("/api/notes-app/folders/reorder", { workspaceId, orderedFolderIds });
}

export async function reorderNotes(
  workspaceId: string,
  folderId: string,
  orderedNoteIds: string[],
): Promise<void> {
  await api.patch("/api/notes-app/notes/reorder", { workspaceId, folderId, orderedNoteIds });
}

export async function searchNotes(workspaceId: string, q: string): Promise<AtlasNoteDto[]> {
  const { data } = await api.get<AtlasNoteDto[]>("/api/notes-app/search", {
    params: { workspaceId, q },
  });
  return data;
}

export async function fetchWorkspaceTags(workspaceId: string): Promise<NoteTagDto[]> {
  const { data } = await api.get<NoteTagDto[]>("/api/notes-app/tags", {
    params: { workspaceId },
  });
  return data;
}

export async function createWorkspaceTag(body: {
  workspaceId: string;
  name: string;
  color?: string;
}): Promise<NoteTagDto> {
  const { data } = await api.post<NoteTagDto>("/api/notes-app/tags", body);
  return data;
}

export async function fetchBacklinks(noteId: string): Promise<NoteLinkSummaryDto[]> {
  const { data } = await api.get<NoteLinkSummaryDto[]>(`/api/notes-app/notes/${noteId}/backlinks`);
  return data;
}

export async function fetchForwardLinks(noteId: string): Promise<NoteLinkSummaryDto[]> {
  const { data } = await api.get<NoteLinkSummaryDto[]>(`/api/notes-app/notes/${noteId}/forward-links`);
  return data;
}

export type NoteAiAction = "summarize" | "rewrite" | "suggestTags";

export async function postNoteAi(
  noteId: string,
  action: NoteAiAction,
): Promise<{ result?: string; tags?: string[] }> {
  const { data } = await api.post<{ result?: string; tags?: string[] }>(`/api/notes-app/notes/${noteId}/ai`, {
    action,
  });
  return data;
}

export type PublicNoteDto = {
  id: string;
  title: string;
  contentJson: unknown;
  previewText: string | null;
  updatedAt: string;
};

export async function fetchPublicNote(publicSlug: string): Promise<PublicNoteDto> {
  const { data } = await api.get<PublicNoteDto>(`/api/notes-app/public/${encodeURIComponent(publicSlug)}`);
  return data;
}
