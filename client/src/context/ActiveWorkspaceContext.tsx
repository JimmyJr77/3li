/* eslint-disable react-refresh/only-export-components */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchWorkspaces } from "@/features/taskflow/api";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import type { WorkspaceDto } from "@/features/taskflow/types";
import { ACTIVE_WORKSPACE_STORAGE_KEY } from "@/lib/workspaceConstants";

type ActiveWorkspaceValue = {
  workspaces: WorkspaceDto[];
  isLoading: boolean;
  isError: boolean;
  /** Resolved selection (falls back to first workspace when stored id is stale). */
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceDto | null;
  setActiveWorkspaceId: (id: string) => void;
};

const ActiveWorkspaceContext = createContext<ActiveWorkspaceValue | null>(null);

export function ActiveWorkspaceProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data: workspaces = [], isLoading, isError } = useQuery({
    queryKey: ["workspaces"],
    queryFn: fetchWorkspaces,
  });

  const [storedId, setStoredId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (workspaces.length === 0) return;
    const valid = storedId && workspaces.some((w) => w.id === storedId);
    if (!valid) {
      const next = workspaces[0].id;
      setStoredId(next);
    }
  }, [workspaces, storedId]);

  const activeWorkspaceId = useMemo(() => {
    if (workspaces.length === 0) return null;
    if (storedId && workspaces.some((w) => w.id === storedId)) return storedId;
    return workspaces[0].id;
  }, [workspaces, storedId]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    try {
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, activeWorkspaceId);
    } catch {
      /* ignore */
    }
  }, [activeWorkspaceId]);

  const setActiveWorkspaceId = useCallback(
    (id: string) => {
      // Prefer the query cache so callers can switch immediately after `refetchQueries` (before re-render).
      const list = qc.getQueryData<WorkspaceDto[]>(["workspaces"]) ?? workspaces;
      if (!list.some((w) => w.id === id)) return;
      setStoredId(id);
      useBrainstormStore.getState().resetCanvas([], []);
      void qc.removeQueries({ queryKey: ["brainstorm"] });
      void qc.invalidateQueries({ queryKey: ["notes-app", "bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["chat-bootstrap"] });
    },
    [workspaces, qc],
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId],
  );

  const value = useMemo(
    () => ({
      workspaces,
      isLoading,
      isError,
      activeWorkspaceId,
      activeWorkspace,
      setActiveWorkspaceId,
    }),
    [workspaces, isLoading, isError, activeWorkspaceId, activeWorkspace, setActiveWorkspaceId],
  );

  return (
    <ActiveWorkspaceContext.Provider value={value}>{children}</ActiveWorkspaceContext.Provider>
  );
}

export function useActiveWorkspace(): ActiveWorkspaceValue {
  const ctx = useContext(ActiveWorkspaceContext);
  if (!ctx) {
    throw new Error("useActiveWorkspace must be used within ActiveWorkspaceProvider");
  }
  return ctx;
}
