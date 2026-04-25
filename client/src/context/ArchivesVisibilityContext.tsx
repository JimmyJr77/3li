/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";

type ArchivesVisibilityValue = {
  /** When false, archive lists and “archived-only” task browsing stay hidden. Default false; resets on brand change. */
  showArchives: boolean;
  setShowArchives: (next: boolean) => void;
  toggleShowArchives: () => void;
};

const ArchivesVisibilityContext = createContext<ArchivesVisibilityValue | null>(null);

export function ArchivesVisibilityProvider({ children }: { children: ReactNode }) {
  const { activeWorkspaceId } = useActiveWorkspace();
  const [showArchives, setShowArchives] = useState(false);

  useEffect(() => {
    setShowArchives(false);
  }, [activeWorkspaceId]);

  const toggleShowArchives = useCallback(() => {
    setShowArchives((v) => !v);
  }, []);

  const value = useMemo(
    () => ({ showArchives, setShowArchives, toggleShowArchives }),
    [showArchives, toggleShowArchives],
  );

  return <ArchivesVisibilityContext.Provider value={value}>{children}</ArchivesVisibilityContext.Provider>;
}

export function useArchivesVisibility(): ArchivesVisibilityValue {
  const ctx = useContext(ArchivesVisibilityContext);
  if (!ctx) {
    throw new Error("useArchivesVisibility must be used within ArchivesVisibilityProvider");
  }
  return ctx;
}
