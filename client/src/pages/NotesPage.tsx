import { StickyNote } from "lucide-react";
import { AdvisorAgentsSheet } from "@/features/agents/AdvisorAgentsSheet";
import { AtlasNotesApp } from "@/features/notes/AtlasNotesApp";
import {
  NotesAdvisorAgentsShellProvider,
  useNotesAdvisorAgentsShell,
} from "@/features/notes/NotesAdvisorAgentsShellContext";

function NotesPageHeader() {
  const { payload } = useNotesAdvisorAgentsShell();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StickyNote className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Notebooks</h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Fast capture and rich notes — workspaces, folders, tags, and a block editor. Powered by the Vite +
          React client and the Express notes API.
        </p>
      </div>
      {payload?.workspaceId ? (
        <div className="shrink-0 sm:pt-0.5">
          <AdvisorAgentsSheet
            workspaceId={payload.workspaceId}
            contextHint={payload.contextHint}
            noteAi={payload.noteAi}
          />
        </div>
      ) : null}
    </div>
  );
}

export function NotesPage() {
  return (
    <NotesAdvisorAgentsShellProvider>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <NotesPageHeader />
        <AtlasNotesApp />
      </div>
    </NotesAdvisorAgentsShellProvider>
  );
}
