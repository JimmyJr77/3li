import { NOTE_TOOLBAR_LABELS, NOTE_TOOLBAR_ORDER } from "@/features/notes/noteEditorToolbarConfig";
import { useWorkspacePrefs } from "@/context/WorkspacePrefsContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function NoteEditorToolbarSettings() {
  const { isNoteToolbarItemVisible, setNoteToolbarItemVisible, notesToolbarHiddenIds, showAllNoteToolbarItems } =
    useWorkspacePrefs();

  const showAll = notesToolbarHiddenIds.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Note editor toolbar</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Turn controls on or off for the bar above the note. Drag handles in the editor still reorder visible
            buttons.
          </p>
        </div>
        {showAll ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 self-start sm:self-auto"
            onClick={() => showAllNoteToolbarItems()}
          >
            Show all
          </Button>
        ) : null}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {NOTE_TOOLBAR_ORDER.map((id) => {
          const visible = isNoteToolbarItemVisible(id);
          const label = NOTE_TOOLBAR_LABELS[id];
          return (
            <li key={id}>
              <Label
                htmlFor={`note-toolbar-${id}`}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/15 px-3 py-2.5 transition-colors hover:bg-muted/30"
              >
                <span className="text-sm font-medium text-foreground">{label}</span>
                <input
                  id={`note-toolbar-${id}`}
                  type="checkbox"
                  className="size-4 shrink-0 rounded border-input accent-primary"
                  checked={visible}
                  onChange={(e) => setNoteToolbarItemVisible(id, e.target.checked)}
                />
              </Label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
