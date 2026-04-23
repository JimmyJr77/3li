import type { IdeaFlowNode } from "@/features/brainstorm/types";
import { defaultIdeaData } from "@/features/brainstorm/types";
import { extractPlainTextFromDoc } from "@/features/notes/extractPreview";

export const BRAINSTORM_NOTE_IMPORT_STORAGE_KEY = "atlas.brainstorm.noteImport.v1";

export type BrainstormNoteImportPayload = {
  title: string;
  description: string;
  sourceNoteId?: string;
};

/** Serialize the current note for Brainstorm import (sessionStorage). */
export function stashNoteForBrainstormImport(note: {
  id: string;
  title: string | null;
  contentJson: unknown | null;
  previewText: string | null;
}): void {
  const title = (note.title?.trim() || "Untitled").slice(0, 500);
  const fromDoc = extractPlainTextFromDoc(note.contentJson, 20000);
  const fromPreview = note.previewText?.trim() ?? "";
  const description = (fromDoc || fromPreview).slice(0, 20000);
  const payload: BrainstormNoteImportPayload = {
    title,
    description,
    sourceNoteId: note.id,
  };
  try {
    sessionStorage.setItem(BRAINSTORM_NOTE_IMPORT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode — ignore
  }
}

/** Read and remove a pending note import (one-shot). */
export function consumeBrainstormNoteImport(): BrainstormNoteImportPayload | null {
  try {
    const raw = sessionStorage.getItem(BRAINSTORM_NOTE_IMPORT_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(BRAINSTORM_NOTE_IMPORT_STORAGE_KEY);
    const parsed = JSON.parse(raw) as BrainstormNoteImportPayload;
    if (typeof parsed.title !== "string" || typeof parsed.description !== "string") return null;
    return {
      title: parsed.title.slice(0, 500),
      description: parsed.description.slice(0, 20000),
      ...(typeof parsed.sourceNoteId === "string" ? { sourceNoteId: parsed.sourceNoteId } : {}),
    };
  } catch {
    return null;
  }
}

export function ideaNodeFromBrainstormNoteImport(
  payload: BrainstormNoteImportPayload,
  index: number,
): IdeaFlowNode {
  const id = crypto.randomUUID();
  const base = defaultIdeaData();
  return {
    id,
    type: "idea",
    position: {
      x: 100 + (index % 6) * 48,
      y: 72 + ((index * 17) % 5) * 44,
    },
    data: {
      ...base,
      title: payload.title || "Note",
      description: payload.description,
      tags: ["from-notes"],
    },
  };
}
