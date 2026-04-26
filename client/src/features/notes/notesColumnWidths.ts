const STORAGE_KEY = "atlas-notes-column-widths-v1";

export type NotesColumnWidths = {
  notebooks: number;
  notes: number;
};

export const DEFAULT_NOTES_COLUMN_WIDTHS: NotesColumnWidths = {
  notebooks: 208,
  notes: 256,
};

const MIN_NOTEBOOKS = 140;
const MAX_NOTEBOOKS = 440;
const MIN_NOTES = 160;
const MAX_NOTES = 600;

export function clampNotesColumnWidths(w: NotesColumnWidths): NotesColumnWidths {
  return {
    notebooks: Math.min(MAX_NOTEBOOKS, Math.max(MIN_NOTEBOOKS, Math.round(w.notebooks))),
    notes: Math.min(MAX_NOTES, Math.max(MIN_NOTES, Math.round(w.notes))),
  };
}

export function loadNotesColumnWidths(): NotesColumnWidths {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTES_COLUMN_WIDTHS };
    const p = JSON.parse(raw) as Partial<NotesColumnWidths>;
    const notebooks =
      typeof p.notebooks === "number" && Number.isFinite(p.notebooks)
        ? p.notebooks
        : DEFAULT_NOTES_COLUMN_WIDTHS.notebooks;
    const notes =
      typeof p.notes === "number" && Number.isFinite(p.notes) ? p.notes : DEFAULT_NOTES_COLUMN_WIDTHS.notes;
    return clampNotesColumnWidths({ notebooks, notes });
  } catch {
    return { ...DEFAULT_NOTES_COLUMN_WIDTHS };
  }
}

export function saveNotesColumnWidths(w: NotesColumnWidths): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clampNotesColumnWidths(w)));
  } catch {
    /* ignore */
  }
}
