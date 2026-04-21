import { StickyNote } from "lucide-react";
import { AtlasNotesApp } from "@/features/notes/AtlasNotesApp";

export function NotesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <StickyNote className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Notebooks</h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Fast capture and rich notes — workspaces, folders, tags, and a block editor. Powered by the Vite +
          React client and the Express notes API.
        </p>
      </div>
      <AtlasNotesApp />
    </div>
  );
}
