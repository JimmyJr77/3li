import { AtlasNotesApp } from "@/features/notes/AtlasNotesApp";

export function NotesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Atlas Notes</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Fast capture and rich notes — workspaces, folders, tags, and a block editor. Powered by the Vite +
          React client and the Express notes API.
        </p>
      </div>
      <AtlasNotesApp />
    </div>
  );
}
