import { Download, FileUp, Link2, Users } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import type { AtlasNoteDto } from "./types";
import { downloadJson, NOTES_EXPORT_VERSION, parseNotesImportJson, type ExportedNotePayload } from "./notesImportExport";

export function NotesPortabilityPanel({
  localMode,
  selected,
  exportableNotes,
  onImportPayloads,
  embedded,
}: {
  localMode: boolean;
  selected: AtlasNoteDto | null;
  /** All notes in the workspace (for bulk export), with bodies when available */
  exportableNotes: AtlasNoteDto[];
  onImportPayloads: (payloads: ExportedNotePayload[]) => void | Promise<void>;
  /** Omit outer card chrome when nested inside a larger panel */
  embedded?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const exportOne = () => {
    if (!selected) return;
    downloadJson(`notebooks-note-${slugify(selected.title || "note")}.json`, {
      version: NOTES_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      note: {
        title: selected.title,
        contentJson: selected.contentJson,
        previewText: selected.previewText,
        folderId: selected.folderId,
      },
    });
  };

  const exportAll = () => {
    if (!exportableNotes.length) return;
    downloadJson(`notebooks-export-${todayStamp()}.json`, {
      version: NOTES_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      notes: exportableNotes.map((n) => ({
        title: n.title,
        contentJson: n.contentJson,
        previewText: n.previewText,
        folderId: n.folderId,
      })),
    });
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const parsed = parseNotesImportJson(text);
    if (!parsed) {
      window.alert("Could not read this file. Use a Notebooks JSON export (version 1).");
      return;
    }
    const payloads: ExportedNotePayload[] =
      "notes" in parsed ? parsed.notes : [parsed.note];
    await onImportPayloads(payloads);
  };

  const shareAppLink = selected
    ? `${window.location.origin}${window.location.pathname}?note=${encodeURIComponent(selected.id)}`
    : `${window.location.origin}${window.location.pathname}`;

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareAppLink);
    } catch {
      window.prompt("Copy this link:", shareAppLink);
    }
  };

  return (
    <div className={embedded ? "space-y-4" : "rounded-lg border border-border bg-muted/15 p-3"}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Import / export</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Download JSON backups or bring notes in from another export. IDs are regenerated on import.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" className="gap-1.5" disabled={!selected} onClick={exportOne}>
          <Download className="size-3.5" />
          Export note
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5"
          disabled={!exportableNotes.length}
          onClick={exportAll}
        >
          <Download className="size-3.5" />
          Export all
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}>
          <FileUp className="size-3.5" />
          Import JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onPickFile(e)}
        />
      </div>
      {localMode ? (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">
          Browser-only mode: imports stay on this device until the API is available.
        </p>
      ) : null}

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Users className="size-3.5" />
          Collaboration
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Live co-editing is not available yet. Use <strong className="font-medium text-foreground">Publish</strong> for a
          read-only public link, or copy an in-app link so teammates can open the same note in Notebooks (requires access
          to this workspace).
        </p>
        <Button type="button" size="sm" variant="secondary" className="mt-2 gap-1.5" onClick={() => void copyShare()}>
          <Link2 className="size-3.5" />
          Copy in-app link
        </Button>
      </div>
    </div>
  );
}

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}
