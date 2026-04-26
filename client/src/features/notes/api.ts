import { api } from "@/lib/api/client";
import type {
  AtlasNoteDto,
  MailClerkAutotagResponseDto,
  NoteLinkSummaryDto,
  NotesBootstrapDto,
  NotesFolderDto,
} from "./types";

export async function fetchNotesBootstrap(workspaceId?: string | null): Promise<NotesBootstrapDto> {
  const { data } = await api.get<NotesBootstrapDto>("/api/notes-app/bootstrap", {
    params: workspaceId ? { workspaceId } : undefined,
  });
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

export async function enrichQuickCapture(body: {
  workspaceId: string;
  folderId: string;
  title?: string;
  rawText: string;
  /** Merged kit + Rapid Router from `getBrandContextForAI`. */
  brandCenterContext?: string;
  brandRapidCaptureContext?: string;
}): Promise<{ title: string; body: string }> {
  const { data } = await api.post<{ title: string; body: string }>("/api/notes-app/quick-capture/enrich", body);
  return data;
}

export async function createNote(body: {
  workspaceId: string;
  folderId?: string | null;
  title?: string;
  contentJson?: unknown | null;
  previewText?: string | null;
  routingSource?: string | null;
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
  position?: number;
  rowAccentColor?: string | null;
};

export async function patchNote(noteId: string, body: PatchNoteBody): Promise<AtlasNoteDto> {
  const { data } = await api.patch<AtlasNoteDto>(`/api/notes-app/notes/${noteId}`, body);
  return data;
}

/** Mail Clerk agent: returns suggested labels from routing context + note body (user picks before anything is applied). */
export async function postNoteMailClerkAutotag(noteId: string): Promise<MailClerkAutotagResponseDto> {
  const { data } = await api.post<MailClerkAutotagResponseDto>(`/api/notes-app/notes/${noteId}/mail-clerk-autotag`, {});
  return data;
}

export async function deleteNote(noteId: string): Promise<void> {
  await api.delete(`/api/notes-app/notes/${noteId}`);
}

export async function createFolder(body: {
  workspaceId: string;
  title?: string;
  parentId?: string | null;
}): Promise<NotesFolderDto> {
  const { data } = await api.post<NotesFolderDto>("/api/notes-app/folders", body);
  return data;
}

export async function patchFolder(
  folderId: string,
  body: { title?: string; position?: number; rowAccentColor?: string | null },
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

export async function addNoteBoardLabel(noteId: string, labelId: string): Promise<AtlasNoteDto> {
  const { data } = await api.post<AtlasNoteDto>(`/api/notes-app/notes/${encodeURIComponent(noteId)}/labels`, {
    labelId,
  });
  return data;
}

export async function removeNoteBoardLabel(noteId: string, labelId: string): Promise<AtlasNoteDto> {
  const { data } = await api.delete<AtlasNoteDto>(
    `/api/notes-app/notes/${encodeURIComponent(noteId)}/labels/${encodeURIComponent(labelId)}`,
  );
  return data;
}

export async function addNoteUserTicketLabel(noteId: string, userBrandTicketLabelId: string): Promise<AtlasNoteDto> {
  const { data } = await api.post<AtlasNoteDto>(
    `/api/notes-app/notes/${encodeURIComponent(noteId)}/my-ticket-labels`,
    { userBrandTicketLabelId },
  );
  return data;
}

export async function removeNoteUserTicketLabel(
  noteId: string,
  userBrandTicketLabelId: string,
): Promise<AtlasNoteDto> {
  const { data } = await api.delete<AtlasNoteDto>(
    `/api/notes-app/notes/${encodeURIComponent(noteId)}/my-ticket-labels/${encodeURIComponent(userBrandTicketLabelId)}`,
  );
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

export type NoteAiAction = "summarize" | "rewrite" | "suggestTags" | "notebookLinking";

export async function postNoteAi(
  noteId: string,
  action: NoteAiAction,
  opts?: { extraContext?: string },
): Promise<{ result?: string; tags?: string[] }> {
  const body: { action: NoteAiAction; extraContext?: string } = { action };
  const trimmed = opts?.extraContext?.trim();
  if (trimmed) body.extraContext = trimmed.slice(0, 4000);
  const { data } = await api.post<{ result?: string; tags?: string[] }>(`/api/notes-app/notes/${noteId}/ai`, body);
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
