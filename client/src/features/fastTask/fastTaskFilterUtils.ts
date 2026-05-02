import type { AtlasNoteDto } from "@/features/notes/types";
import type { FastTaskBoardAssign } from "./fastTaskMetaStore";

export function initialsFromDisplayName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]![0];
    const b = parts[1]![0];
    return `${a}${b}`.toUpperCase();
  }
  if (t.length >= 2) return t.slice(0, 2).toUpperCase();
  return t[0]!.toUpperCase();
}

export function unionNoteLabels(notes: readonly AtlasNoteDto[]) {
  const m = new Map<string, { id: string; name: string; color: string }>();
  for (const n of notes) {
    for (const row of n.labels) {
      if (!m.has(row.label.id)) {
        m.set(row.label.id, { id: row.label.id, name: row.label.name, color: row.label.color });
      }
    }
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function filterFastTaskBoards(
  notes: readonly AtlasNoteDto[],
  opts: {
    indexerView: "taskboard" | "owners";
    ownerFilterId: string | null;
    labelFilterId: string | null;
    getAssign: (noteId: string) => FastTaskBoardAssign;
  },
): AtlasNoteDto[] {
  let out = [...notes];
  if (opts.labelFilterId) {
    out = out.filter((n) => n.labels.some((l) => l.label.id === opts.labelFilterId));
  }
  if (opts.indexerView === "owners" && opts.ownerFilterId) {
    const ownerId = opts.ownerFilterId;
    out = out.filter((n) => {
      const a = opts.getAssign(n.id);
      if (a.assignAll) return true;
      return a.assigneeIds.includes(ownerId);
    });
  }
  return out;
}

export function sortBoardsByLastEdited(a: AtlasNoteDto, b: AtlasNoteDto) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}
