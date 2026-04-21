import { Fragment, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, LayoutTemplate, Loader2, Plus, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchNotes } from "./api";
import type { NoteTemplate } from "./noteTemplates";
import { BUILTIN_NOTE_TEMPLATES } from "./noteTemplates";
import type { AtlasNoteDto } from "./types";

type PaletteItem =
  | { kind: "action"; id: string; label: string; hint?: string; icon: typeof Plus; run: () => void }
  | { kind: "template"; template: NoteTemplate }
  | { kind: "note"; note: AtlasNoteDto };

export function NotesCommandPalette({
  open,
  onOpenChange,
  localMode,
  workspaceId,
  searchNotesLocal,
  onOpenNote,
  onNewNote,
  onQuickCapture,
  onApplyTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localMode: boolean;
  workspaceId: string;
  searchNotesLocal: (q: string) => AtlasNoteDto[];
  onOpenNote: (id: string) => void;
  onNewNote: () => void;
  onQuickCapture: () => void;
  onApplyTemplate: (template: NoteTemplate) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setQuery("");
        setDebounced("");
        setActive(0);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const { data: remoteHits = [], isFetching: remoteLoading } = useQuery({
    queryKey: ["notes-command-palette", workspaceId, debounced],
    queryFn: () => searchNotes(workspaceId, debounced),
    enabled: open && !localMode && debounced.length >= 1,
  });

  const items: PaletteItem[] = useMemo(() => {
    if (debounced.length >= 1) {
      const hits = localMode ? searchNotesLocal(debounced) : remoteHits;
      return hits.map((note) => ({ kind: "note" as const, note }));
    }
    const actions: PaletteItem[] = [
      {
        kind: "action",
        id: "new",
        label: "New note",
        hint: "Create in the current notebook",
        icon: Plus,
        run: () => {
          onNewNote();
          handleOpenChange(false);
        },
      },
      {
        kind: "action",
        id: "capture",
        label: "Quick capture",
        hint: "⌘⇧C",
        icon: Zap,
        run: () => {
          onQuickCapture();
          handleOpenChange(false);
        },
      },
    ];
    const tpls: PaletteItem[] = BUILTIN_NOTE_TEMPLATES.map((template) => ({ kind: "template" as const, template }));
    return [...actions, ...tpls];
  }, [debounced, localMode, remoteHits, searchNotesLocal, onNewNote, onQuickCapture, handleOpenChange]);

  useEffect(() => {
    startTransition(() => setActive(0));
  }, [debounced, items.length]);

  const runItem = useCallback(
    (item: PaletteItem) => {
      if (item.kind === "action") {
        item.run();
        return;
      }
      if (item.kind === "template") {
        onApplyTemplate(item.template);
        handleOpenChange(false);
        return;
      }
      onOpenNote(item.note.id);
      handleOpenChange(false);
    },
    [handleOpenChange, onApplyTemplate, onOpenNote],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      runItem(items[active]);
    }
  };

  const loading = !localMode && debounced.length >= 1 && remoteLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <div className="border-b border-border px-4 py-3">
          <DialogTitle className="sr-only">Notebooks command palette</DialogTitle>
          <DialogDescription className="sr-only">
            Search notes or run actions. Use arrow keys and Enter.
          </DialogDescription>
          <div className="flex items-center gap-2">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  handleOpenChange(false);
                  return;
                }
                onKeyDown(e);
              }}
              placeholder="Search notes or choose an action…"
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              autoComplete="off"
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="shrink-0"
              aria-label="Close"
              onClick={() => handleOpenChange(false)}
            >
              <span className="text-xs text-muted-foreground">Esc</span>
            </Button>
          </div>
        </div>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Searching…
            </div>
          ) : items.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {debounced ? "No notes match your search." : "No actions available."}
            </p>
          ) : (
            <ul className="space-y-0.5" role="listbox">
              {debounced.length >= 1 ? (
                <li className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Notebooks</li>
              ) : (
                <li className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Actions</li>
              )}
              {items.map((item, idx) => {
                const showTemplateHeading = !debounced && idx === 2 && item.kind === "template";
                const row = (() => {
                  if (item.kind === "action") {
                    const Icon = item.icon;
                    return (
                      <li key={item.id} role="option" aria-selected={idx === active}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                            idx === active ? "bg-muted" : "hover:bg-muted/80",
                          )}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => runItem(item)}
                        >
                          <Icon className="size-4 shrink-0 opacity-70" />
                          <span className="min-w-0 flex-1 font-medium">{item.label}</span>
                          {item.hint ? (
                            <span className="shrink-0 text-xs text-muted-foreground">{item.hint}</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  }
                  if (item.kind === "template") {
                    const t = item.template;
                    return (
                      <li key={t.id} role="option" aria-selected={idx === active}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                            idx === active ? "bg-muted" : "hover:bg-muted/80",
                          )}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => runItem(item)}
                        >
                          <LayoutTemplate className="mt-0.5 size-4 shrink-0 opacity-70" />
                          <span className="min-w-0">
                            <span className="block font-medium">{t.title}</span>
                            <span className="block text-xs text-muted-foreground">{t.description}</span>
                          </span>
                        </button>
                      </li>
                    );
                  }
                  const n = item.note;
                  return (
                    <li key={n.id} role="option" aria-selected={idx === active}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                          idx === active ? "bg-muted" : "hover:bg-muted/80",
                        )}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => runItem(item)}
                      >
                        <FileText className="mt-0.5 size-4 shrink-0 opacity-60" />
                        <span className="min-w-0">
                          <span className="block font-medium">{n.title || "Untitled"}</span>
                          {n.previewText ? (
                            <span className="line-clamp-2 text-xs text-muted-foreground">{n.previewText}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })();
                return (
                  <Fragment key={item.kind === "note" ? item.note.id : item.kind === "template" ? item.template.id : item.id}>
                    {showTemplateHeading ? (
                      <li className="list-none px-2 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Templates
                      </li>
                    ) : null}
                    {row}
                  </Fragment>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border px-4 py-2 text-[0.65rem] text-muted-foreground">
          <span className="font-medium text-foreground/80">⌘K</span> palette · ↑↓ navigate · ↵ open
        </div>
      </DialogContent>
    </Dialog>
  );
}
