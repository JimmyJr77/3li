/* Context: Notebooks page header hosts AdvisorAgentsSheet; AtlasNotesApp registers props. */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AdvisorAgentsSheetNoteAi } from "@/features/agents/AdvisorAgentsSheet";

export type NotesAdvisorAgentsShellPayload = {
  workspaceId: string;
  contextHint: string;
  noteAi?: AdvisorAgentsSheetNoteAi;
};

type NotesAdvisorAgentsShellContextValue = {
  payload: NotesAdvisorAgentsShellPayload | null;
  setNotesAdvisorPayload: (p: NotesAdvisorAgentsShellPayload | null) => void;
};

const NotesAdvisorAgentsShellContext = createContext<NotesAdvisorAgentsShellContextValue | null>(null);

export function NotesAdvisorAgentsShellProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<NotesAdvisorAgentsShellPayload | null>(null);
  const setNotesAdvisorPayload = useCallback((p: NotesAdvisorAgentsShellPayload | null) => {
    setPayload(p);
  }, []);
  const value = useMemo(
    () => ({ payload, setNotesAdvisorPayload }),
    [payload, setNotesAdvisorPayload],
  );
  return (
    <NotesAdvisorAgentsShellContext.Provider value={value}>{children}</NotesAdvisorAgentsShellContext.Provider>
  );
}

export function useNotesAdvisorAgentsShell() {
  const ctx = useContext(NotesAdvisorAgentsShellContext);
  if (!ctx) {
    throw new Error("useNotesAdvisorAgentsShell must be used within NotesAdvisorAgentsShellProvider");
  }
  return ctx;
}

/** When Notebooks is not wrapped by the shell provider, registration is a no-op. */
export function useOptionalNotesAdvisorAgentsShell() {
  return useContext(NotesAdvisorAgentsShellContext);
}
