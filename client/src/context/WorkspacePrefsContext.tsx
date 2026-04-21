/* Context module: provider + hook. */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "3li-workspace-prefs";

export type SidebarBehavior = "pinned" | "overlay";

export type WorkspaceProfile = {
  displayName: string;
  email: string;
};

type PersistedV1 = {
  v: 1;
  sidebarBehavior: SidebarBehavior;
  profile: WorkspaceProfile;
};

const defaultProfile: WorkspaceProfile = { displayName: "", email: "" };

const defaults: PersistedV1 = {
  v: 1,
  sidebarBehavior: "overlay",
  profile: defaultProfile,
};

function readPersisted(): PersistedV1 {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PersistedV1>;
    if (parsed.v !== 1) return defaults;
    return {
      v: 1,
      sidebarBehavior:
        parsed.sidebarBehavior === "pinned" || parsed.sidebarBehavior === "overlay"
          ? parsed.sidebarBehavior
          : defaults.sidebarBehavior,
      profile: {
        displayName: typeof parsed.profile?.displayName === "string" ? parsed.profile.displayName : "",
        email: typeof parsed.profile?.email === "string" ? parsed.profile.email : "",
      },
    };
  } catch {
    return defaults;
  }
}

function writePersisted(data: PersistedV1) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

type WorkspacePrefsValue = {
  sidebarBehavior: SidebarBehavior;
  setSidebarBehavior: (v: SidebarBehavior) => void;
  profile: WorkspaceProfile;
  setProfile: (p: WorkspaceProfile) => void;
  updateProfile: (partial: Partial<WorkspaceProfile>) => void;
};

const WorkspacePrefsContext = createContext<WorkspacePrefsValue | null>(null);

export function WorkspacePrefsProvider({ children }: { children: ReactNode }) {
  const [sidebarBehavior, setSidebarBehaviorState] = useState<SidebarBehavior>(
    () => readPersisted().sidebarBehavior,
  );
  const [profile, setProfileState] = useState<WorkspaceProfile>(() => readPersisted().profile);

  useEffect(() => {
    writePersisted({ v: 1, sidebarBehavior, profile });
  }, [sidebarBehavior, profile]);

  const setSidebarBehavior = useCallback((v: SidebarBehavior) => {
    setSidebarBehaviorState(v);
  }, []);

  const setProfile = useCallback((p: WorkspaceProfile) => {
    setProfileState(p);
  }, []);

  const updateProfile = useCallback((partial: Partial<WorkspaceProfile>) => {
    setProfileState((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo(
    () => ({
      sidebarBehavior,
      setSidebarBehavior,
      profile,
      setProfile,
      updateProfile,
    }),
    [sidebarBehavior, setSidebarBehavior, profile, setProfile, updateProfile],
  );

  return <WorkspacePrefsContext.Provider value={value}>{children}</WorkspacePrefsContext.Provider>;
}

export function useWorkspacePrefs() {
  const ctx = useContext(WorkspacePrefsContext);
  if (!ctx) {
    throw new Error("useWorkspacePrefs must be used within WorkspacePrefsProvider");
  }
  return ctx;
}
