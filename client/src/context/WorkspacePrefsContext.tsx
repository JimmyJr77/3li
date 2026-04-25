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
import type { NoteToolbarItemId } from "@/features/notes/noteEditorToolbarConfig";
import { NOTE_TOOLBAR_ORDER_SET } from "@/features/notes/noteEditorToolbarConfig";

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

type PersistedV2 = {
  v: 2;
  sidebarBehavior: SidebarBehavior;
  profile: WorkspaceProfile;
  /** Toolbar buttons hidden in Notebooks (ids from `NOTE_TOOLBAR_ORDER`). */
  notesToolbarHiddenIds: NoteToolbarItemId[];
};

const defaultProfile: WorkspaceProfile = { displayName: "", email: "" };

const defaultsV2: PersistedV2 = {
  v: 2,
  sidebarBehavior: "pinned",
  profile: defaultProfile,
  notesToolbarHiddenIds: [],
};

function normalizeNotesToolbarHidden(raw: unknown): NoteToolbarItemId[] {
  if (!Array.isArray(raw)) return [];
  const out: NoteToolbarItemId[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string" || !NOTE_TOOLBAR_ORDER_SET.has(x) || seen.has(x)) continue;
    seen.add(x);
    out.push(x as NoteToolbarItemId);
  }
  return out;
}

function readPersisted(): PersistedV2 {
  if (typeof window === "undefined") return defaultsV2;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultsV2;
    const parsed = JSON.parse(raw) as Partial<PersistedV2> & Partial<PersistedV1> & { v?: number };
    if (parsed.v === 1) {
      return {
        v: 2,
        sidebarBehavior:
          parsed.sidebarBehavior === "pinned" || parsed.sidebarBehavior === "overlay"
            ? parsed.sidebarBehavior
            : defaultsV2.sidebarBehavior,
        profile: {
          displayName: typeof parsed.profile?.displayName === "string" ? parsed.profile.displayName : "",
          email: typeof parsed.profile?.email === "string" ? parsed.profile.email : "",
        },
        notesToolbarHiddenIds: [],
      };
    }
    if (parsed.v !== 2) return defaultsV2;
    return {
      v: 2,
      sidebarBehavior:
        parsed.sidebarBehavior === "pinned" || parsed.sidebarBehavior === "overlay"
          ? parsed.sidebarBehavior
          : defaultsV2.sidebarBehavior,
      profile: {
        displayName: typeof parsed.profile?.displayName === "string" ? parsed.profile.displayName : "",
        email: typeof parsed.profile?.email === "string" ? parsed.profile.email : "",
      },
      notesToolbarHiddenIds: normalizeNotesToolbarHidden(parsed.notesToolbarHiddenIds),
    };
  } catch {
    return defaultsV2;
  }
}

function writePersisted(data: PersistedV2) {
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
  notesToolbarHiddenIds: readonly NoteToolbarItemId[];
  isNoteToolbarItemVisible: (id: NoteToolbarItemId) => boolean;
  setNoteToolbarItemVisible: (id: NoteToolbarItemId, visible: boolean) => void;
  showAllNoteToolbarItems: () => void;
};

const WorkspacePrefsContext = createContext<WorkspacePrefsValue | null>(null);

export function WorkspacePrefsProvider({ children }: { children: ReactNode }) {
  const initial = readPersisted();
  const [sidebarBehavior, setSidebarBehaviorState] = useState<SidebarBehavior>(initial.sidebarBehavior);
  const [profile, setProfileState] = useState<WorkspaceProfile>(initial.profile);
  const [notesToolbarHiddenIds, setNotesToolbarHiddenIds] = useState<NoteToolbarItemId[]>(
    () => [...initial.notesToolbarHiddenIds],
  );

  useEffect(() => {
    writePersisted({ v: 2, sidebarBehavior, profile, notesToolbarHiddenIds });
  }, [sidebarBehavior, profile, notesToolbarHiddenIds]);

  const setSidebarBehavior = useCallback((v: SidebarBehavior) => {
    setSidebarBehaviorState(v);
  }, []);

  const setProfile = useCallback((p: WorkspaceProfile) => {
    setProfileState(p);
  }, []);

  const updateProfile = useCallback((partial: Partial<WorkspaceProfile>) => {
    setProfileState((prev) => ({ ...prev, ...partial }));
  }, []);

  const hiddenSet = useMemo(() => new Set(notesToolbarHiddenIds), [notesToolbarHiddenIds]);

  const isNoteToolbarItemVisible = useCallback(
    (id: NoteToolbarItemId) => !hiddenSet.has(id),
    [hiddenSet],
  );

  const setNoteToolbarItemVisible = useCallback((id: NoteToolbarItemId, visible: boolean) => {
    setNotesToolbarHiddenIds((prev) => {
      if (visible) return prev.filter((x) => x !== id);
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const showAllNoteToolbarItems = useCallback(() => {
    setNotesToolbarHiddenIds([]);
  }, []);

  const value = useMemo(
    () => ({
      sidebarBehavior,
      setSidebarBehavior,
      profile,
      setProfile,
      updateProfile,
      notesToolbarHiddenIds,
      isNoteToolbarItemVisible,
      setNoteToolbarItemVisible,
      showAllNoteToolbarItems,
    }),
    [
      sidebarBehavior,
      setSidebarBehavior,
      profile,
      setProfile,
      updateProfile,
      notesToolbarHiddenIds,
      isNoteToolbarItemVisible,
      setNoteToolbarItemVisible,
      showAllNoteToolbarItems,
    ],
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
