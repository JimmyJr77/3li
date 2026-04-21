export const NOTES_EXPORT_VERSION = 1 as const;

export type ExportedNotePayload = {
  title: string;
  contentJson: unknown;
  previewText: string | null;
  folderId?: string | null;
};

export type NotesBulkExport = {
  version: typeof NOTES_EXPORT_VERSION;
  exportedAt: string;
  notes: ExportedNotePayload[];
};

export type NotesSingleExport = {
  version: typeof NOTES_EXPORT_VERSION;
  exportedAt: string;
  note: ExportedNotePayload;
};

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseNotesImportJson(raw: string): NotesBulkExport | NotesSingleExport | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const v = (data as { version?: unknown }).version;
    if (v !== NOTES_EXPORT_VERSION) return null;
    if ("notes" in (data as object) && Array.isArray((data as NotesBulkExport).notes)) {
      return data as NotesBulkExport;
    }
    if ("note" in (data as object) && (data as NotesSingleExport).note && typeof (data as NotesSingleExport).note.title === "string") {
      return data as NotesSingleExport;
    }
    return null;
  } catch {
    return null;
  }
}
