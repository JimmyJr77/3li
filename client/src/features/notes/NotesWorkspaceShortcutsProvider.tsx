/* Context module: provider + hook. */
/* eslint-disable react-refresh/only-export-components */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { createNote, fetchNotesBootstrap } from "./api";
import { extractPreviewFromDoc } from "./extractPreview";
import { LOCAL_WORKSPACE_ID, useLocalNotesStore } from "./localNotesStore";
import type { NoteTemplate } from "./noteTemplates";
import { templateSeedTitle } from "./noteTemplates";
import { NotesCommandPalette } from "./NotesCommandPalette";
import { QuickCaptureSheet } from "./QuickCaptureSheet";

type NotesWorkspaceShortcutsContextValue = {
  openCommandPalette: () => void;
  toggleCommandPalette: () => void;
  openQuickCapture: () => void;
  /** While Notebooks is open, set the folder used for “new note” / quick capture from the command palette */
  setActiveNotesFolderId: (id: string | null) => void;
};

const NotesWorkspaceShortcutsContext = createContext<NotesWorkspaceShortcutsContextValue | null>(null);

export function useNotesWorkspaceShortcuts() {
  const ctx = useContext(NotesWorkspaceShortcutsContext);
  if (!ctx) {
    throw new Error("useNotesWorkspaceShortcuts must be used within NotesWorkspaceShortcutsProvider");
  }
  return ctx;
}

export function NotesWorkspaceShortcutsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: bootstrapData, isLoading: bootstrapLoading, isError: bootstrapError } = useQuery({
    queryKey: ["notes-app", "bootstrap"],
    queryFn: fetchNotesBootstrap,
    retry: false,
  });

  const localMode = !bootstrapLoading && (bootstrapError || !bootstrapData);

  const localDefaultFolderId = useLocalNotesStore((s) => s.defaultFolderId);
  const localFolders = useLocalNotesStore((s) => s.folders);
  const createNoteLocal = useLocalNotesStore((s) => s.createNote);
  const searchNotesLocal = useLocalNotesStore((s) => s.searchNotes);

  const workspaceId = localMode ? LOCAL_WORKSPACE_ID : bootstrapData?.workspace.id;
  const defaultFolderId = localMode ? localDefaultFolderId : bootstrapData?.defaultFolderId;

  const ready = Boolean(workspaceId && defaultFolderId);

  const [activeNotesFolderId, setActiveNotesFolderId] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);

  const targetFolderId = activeNotesFolderId ?? defaultFolderId ?? null;

  const quickCaptureContextSummary = useMemo(() => {
    if (!targetFolderId) return undefined;
    const ws = localMode ? "This browser" : (bootstrapData?.workspace.name ?? "Workspace");
    const nb = localMode
      ? (localFolders.find((f) => f.id === targetFolderId)?.title ?? "Notebook")
      : (bootstrapData?.folders.find((f) => f.id === targetFolderId)?.title ?? "Notebook");
    return `${ws} · ${nb}`;
  }, [targetFolderId, localMode, bootstrapData?.workspace.name, bootstrapData?.folders, localFolders]);

  const applyTemplate = useCallback(
    (template: NoteTemplate) => {
      if (!workspaceId || !defaultFolderId || !targetFolderId) return;
      const preview = extractPreviewFromDoc(template.contentJson);
      const title = templateSeedTitle(template);
      if (localMode) {
        const note = createNoteLocal(targetFolderId, title, template.contentJson, preview || null);
        void qc.invalidateQueries({ queryKey: ["notes-app"] });
        navigate(`/app/notes?note=${note.id}`);
        return;
      }
      void createNote({
        workspaceId,
        folderId: targetFolderId,
        title,
        contentJson: template.contentJson,
        previewText: preview || null,
      }).then((note) => {
        void qc.invalidateQueries({ queryKey: ["notes-app"] });
        navigate(`/app/notes?note=${note.id}`);
      });
    },
    [workspaceId, defaultFolderId, targetFolderId, localMode, createNoteLocal, qc, navigate],
  );

  const newNoteMut = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !targetFolderId) throw new Error("Notes unavailable");
      if (localMode) {
        return createNoteLocal(targetFolderId, "Untitled");
      }
      return createNote({ workspaceId, folderId: targetFolderId, title: "Untitled" });
    },
    onSuccess: (note) => {
      void qc.invalidateQueries({ queryKey: ["notes-app"] });
      navigate(`/app/notes?note=${note.id}`);
    },
  });

  const onNewNote = useCallback(() => {
    if (!ready) return;
    newNoteMut.mutate();
  }, [ready, newNoteMut]);

  const onOpenNote = useCallback(
    (id: string) => {
      navigate(`/app/notes?note=${encodeURIComponent(id)}`);
    },
    [navigate],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ready) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const t = e.target as HTMLElement | null;
        if (t?.closest?.('[data-slot="dialog-content"]')) return;
        e.preventDefault();
        setCommandOpen((o) => !o);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        const t = e.target as HTMLElement | null;
        if (t?.closest?.('[data-slot="sheet-content"]')) return;
        e.preventDefault();
        setQuickCaptureOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready]);

  const openCommandPalette = useCallback(() => {
    if (!ready) return;
    setCommandOpen(true);
  }, [ready]);

  const toggleCommandPalette = useCallback(() => {
    if (!ready) return;
    setCommandOpen((o) => !o);
  }, [ready]);

  const openQuickCapture = useCallback(() => {
    if (!ready) return;
    setQuickCaptureOpen(true);
  }, [ready]);

  const value = useMemo<NotesWorkspaceShortcutsContextValue>(
    () => ({
      openCommandPalette,
      toggleCommandPalette,
      openQuickCapture,
      setActiveNotesFolderId,
    }),
    [openCommandPalette, toggleCommandPalette, openQuickCapture, setActiveNotesFolderId],
  );

  const quickCaptureCreateFn =
    localMode && ready
      ? async (body: {
          workspaceId: string;
          folderId: string;
          title: string;
          contentJson: unknown;
          previewText: string | null;
        }) => {
          const note = createNoteLocal(body.folderId, body.title, body.contentJson, body.previewText);
          return { id: note.id };
        }
      : undefined;

  return (
    <NotesWorkspaceShortcutsContext.Provider value={value}>
      {children}
      {ready && workspaceId && targetFolderId ? (
        <>
          <NotesCommandPalette
            open={commandOpen}
            onOpenChange={setCommandOpen}
            localMode={localMode}
            workspaceId={workspaceId}
            searchNotesLocal={searchNotesLocal}
            onOpenNote={onOpenNote}
            onNewNote={onNewNote}
            onQuickCapture={() => setQuickCaptureOpen(true)}
            onApplyTemplate={applyTemplate}
          />
          <QuickCaptureSheet
            open={quickCaptureOpen}
            onOpenChange={setQuickCaptureOpen}
            workspaceId={workspaceId}
            folderId={targetFolderId}
            onCreated={(id) => navigate(`/app/notes?note=${encodeURIComponent(id)}`)}
            createNoteFn={quickCaptureCreateFn}
            aiDisabled={localMode}
            contextSummary={quickCaptureContextSummary}
          />
        </>
      ) : null}
    </NotesWorkspaceShortcutsContext.Provider>
  );
}
