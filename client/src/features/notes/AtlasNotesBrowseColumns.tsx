import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookPlus,
  ChevronLeft,
  FilePlus,
  Globe,
  GripVertical,
  Loader2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BrowseItemOverflowMenu } from "./BrowseItemOverflowMenu";
import { browseRowAccentSurface } from "./notebookRowAccent";
import type { AtlasNoteDto, NotesFolderDto } from "./types";

function CollapsibleRail({
  open,
  onOpenChange,
  label,
  widthClass,
  headerRight,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  label: string;
  widthClass: string;
  headerRight?: ReactNode;
  children: React.ReactNode;
}) {
  if (!open) {
    return (
      <button
        type="button"
        title={`Show ${label} panel`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenChange(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex min-h-[min(68vh,560px)] w-10 shrink-0 cursor-pointer flex-col items-center justify-center border-r border-border bg-muted/40 py-4 hover:bg-muted/70"
        aria-expanded={false}
        aria-label={`Expand ${label}`}
      >
        <span
          className="select-none text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {label}
        </span>
      </button>
    );
  }
  return (
    <div
      className={cn(
        "relative z-10 flex min-h-0 shrink-0 flex-col self-stretch border-r border-border bg-muted/30",
        widthClass,
      )}
    >
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
        <span className="truncate text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          {headerRight}
          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            title="Hide this panel"
            className="size-8 shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenChange(false);
            }}
            aria-expanded
            aria-label={`Collapse ${label}`}
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>
      </div>
      <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2">{children}</div>
    </div>
  );
}

function SortableFolderRow({
  folder,
  active,
  onSelect,
  onPatch,
  onDelete,
  dragDisabled,
}: {
  folder: NotesFolderDto;
  active: boolean;
  onSelect: () => void;
  onPatch: (payload: { title: string; rowAccentColor: string | null }) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  dragDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folder.id,
    disabled: dragDisabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const rowTint = browseRowAccentSurface(folder.rowAccentColor ?? null);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...rowTint }}
      className={cn(
        "flex items-center gap-0.5 rounded-md",
        active && "bg-muted font-medium",
        isDragging && "opacity-60",
      )}
    >
      <button
        type="button"
        className={cn(
          "touch-none rounded p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          dragDisabled && "pointer-events-none opacity-40",
        )}
        aria-label="Drag to reorder notebook"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
        }}
        className="min-w-0 flex-1 truncate rounded px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/80"
      >
        {folder.title}
      </button>
      <BrowseItemOverflowMenu
        kind="notebook"
        initialTitle={folder.title}
        initialAccent={folder.rowAccentColor ?? null}
        onApply={onPatch}
        onDelete={onDelete}
        deleteConfirmation={`Delete notebook “${folder.title}”? Notes inside will be moved to another notebook if one exists.`}
      />
    </div>
  );
}

function SortableNoteRow({
  note,
  active,
  onSelect,
  onPatch,
  onDelete,
}: {
  note: AtlasNoteDto;
  active: boolean;
  onSelect: () => void;
  onPatch: (payload: { title: string; rowAccentColor: string | null }) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });
  const dndStyle = { transform: CSS.Transform.toString(transform), transition };
  const rowTint = browseRowAccentSurface(note.rowAccentColor ?? null);
  const title = note.title || "Untitled";

  return (
    <div
      ref={setNodeRef}
      style={{ ...dndStyle, ...rowTint }}
      className={cn(
        "flex w-full items-center gap-0.5 rounded-md",
        active && "bg-muted font-medium",
        isDragging && "opacity-60",
      )}
    >
      <button
        type="button"
        className="shrink-0 touch-none rounded p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        aria-label="Drag to reorder note"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
        }}
        className="min-w-0 flex-1 truncate rounded px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/80"
      >
        {title}
      </button>
      <BrowseItemOverflowMenu
        kind="note"
        initialTitle={title}
        initialAccent={note.rowAccentColor ?? null}
        onApply={onPatch}
        onDelete={onDelete}
        deleteConfirmation={`Delete note “${title}”?`}
      />
    </div>
  );
}

export function AtlasNotesBrowseColumns({
  localMode,
  topFolders,
  folderFilter,
  onPickNotebook,
  universalSearch,
  onUniversalSearchChange,
  notesLoading,
  displayList,
  resolvedSelectedId,
  setSelectedId,
  searchQ,
  setSearchQ,
  createPending,
  onNewNote,
  onNewFolder,
  newFolderPending,
  onReorderFolders,
  onReorderNotes,
  onPatchFolder,
  onDeleteFolder,
  onPatchNote,
  onDeleteNote,
  canReorderNotes,
}: {
  localMode: boolean;
  topFolders: NotesFolderDto[];
  folderFilter: string | "all";
  onPickNotebook: (id: string | "all") => void;
  universalSearch: boolean;
  onUniversalSearchChange: (on: boolean) => void;
  notesLoading: boolean;
  displayList: AtlasNoteDto[];
  resolvedSelectedId: string | null;
  setSelectedId: (id: string | null) => void;
  searchQ: string;
  setSearchQ: (s: string) => void;
  createPending: boolean;
  onNewNote: () => void;
  onNewFolder: () => void;
  newFolderPending?: boolean;
  onReorderFolders: (orderedIds: string[]) => void | Promise<void>;
  onReorderNotes: (orderedIds: string[]) => void | Promise<void>;
  onPatchFolder: (folderId: string, body: { title: string; rowAccentColor: string | null }) => void | Promise<void>;
  onDeleteFolder: (folderId: string) => void | Promise<void>;
  onPatchNote: (noteId: string, body: { title: string; rowAccentColor: string | null }) => void | Promise<void>;
  onDeleteNote: (noteId: string) => void | Promise<void>;
  canReorderNotes: boolean;
}) {
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [notebookSearch, setNotebookSearch] = useState("");

  const notebookSearchActive = notebookSearch.trim().length > 0;
  const foldersShown = useMemo(() => {
    const q = notebookSearch.trim().toLowerCase();
    if (!q) return topFolders;
    return topFolders.filter((f) => f.title.toLowerCase().includes(q));
  }, [topFolders, notebookSearch]);

  const folderIdsShown = useMemo(() => foldersShown.map((f) => f.id), [foldersShown]);
  const noteIds = useMemo(() => displayList.map((n) => n.id), [displayList]);

  const folderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const noteSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onFolderDragEnd = (e: DragEndEvent) => {
    if (notebookSearchActive) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fullIds = topFolders.map((f) => f.id);
    const oldIndex = fullIds.indexOf(active.id as string);
    const newIndex = fullIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(fullIds, oldIndex, newIndex);
    void onReorderFolders(next);
  };

  const onNoteDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = noteIds.indexOf(active.id as string);
    const newIndex = noteIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(noteIds, oldIndex, newIndex);
    void onReorderNotes(next);
  };

  return (
    <>
      <CollapsibleRail
        open={foldersOpen}
        onOpenChange={setFoldersOpen}
        label="NOTEBOOKS"
        widthClass="w-52"
        headerRight={
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="New notebook"
            title="New notebook"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNewFolder();
            }}
            disabled={newFolderPending}
          >
            <BookPlus className="size-3.5" />
          </Button>
        }
      >
        <Input
          placeholder="Find notebooks…"
          value={notebookSearch}
          onChange={(e) => setNotebookSearch(e.target.value)}
          className="mb-2 h-8 text-sm"
          aria-label="Filter notebooks"
        />
        {universalSearch ? (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-sky-500/35 bg-sky-500/10 px-2 py-1.5 text-[0.65rem] text-sky-900 dark:text-sky-100">
            <Globe className="size-3.5 shrink-0" aria-hidden />
            <span className="font-medium">Searching all notebooks</span>
          </div>
        ) : null}
        {notebookSearchActive ? (
          <p className="mb-2 text-[0.65rem] text-muted-foreground">Clear the filter to reorder notebooks.</p>
        ) : null}
        <DndContext
          id="notebooks-dnd"
          sensors={folderSensors}
          collisionDetection={closestCenter}
          onDragEnd={onFolderDragEnd}
        >
          <SortableContext items={folderIdsShown} strategy={verticalListSortingStrategy}>
            <nav
              className={cn(
                "flex flex-col gap-0.5",
                universalSearch && "rounded-md opacity-60 transition-opacity",
              )}
            >
              {foldersShown.map((f) => (
                <SortableFolderRow
                  key={f.id}
                  folder={f}
                  active={!universalSearch && folderFilter === f.id}
                  onSelect={() => {
                    onPickNotebook(f.id);
                  }}
                  onPatch={(payload) => onPatchFolder(f.id, payload)}
                  onDelete={() => void onDeleteFolder(f.id)}
                  dragDisabled={notebookSearchActive}
                />
              ))}
            </nav>
          </SortableContext>
        </DndContext>
      </CollapsibleRail>

      <CollapsibleRail
        open={notesOpen}
        onOpenChange={setNotesOpen}
        label="NOTES"
        widthClass="w-64"
        headerRight={
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="New note"
            title="New note"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNewNote();
            }}
            disabled={createPending}
          >
            <FilePlus className="size-3.5" />
          </Button>
        }
      >
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              placeholder={universalSearch ? "Search all notebooks…" : "Filter notes in this notebook…"}
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="h-8 min-w-0 flex-1 text-sm"
              aria-label={universalSearch ? "Search notes in all notebooks" : "Filter notes in the selected notebook"}
            />
            <Button
              type="button"
              size="icon"
              variant={universalSearch ? "secondary" : "outline"}
              className={cn("size-8 shrink-0", universalSearch && "border-sky-500/50 bg-sky-500/15 text-sky-800 dark:text-sky-100")}
              title={universalSearch ? "Universal search on — click to return to one notebook" : "Search across all notebooks"}
              aria-pressed={universalSearch}
              aria-label={universalSearch ? "Exit universal note search" : "Search all notebooks"}
              onClick={() => onUniversalSearchChange(!universalSearch)}
            >
              <Globe className="size-4" />
            </Button>
          </div>
        </div>
        {!canReorderNotes ? (
          <p className="mb-2 text-[0.65rem] text-muted-foreground">Select a single notebook to reorder notes.</p>
        ) : null}
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {!localMode && notesLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading…
            </div>
          ) : displayList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {universalSearch
                ? searchQ.trim()
                  ? "No notes match."
                  : "Type above to search every notebook, or turn off the globe to browse one notebook."
                : "No notes yet. Create one to get started."}
            </p>
          ) : canReorderNotes ? (
            <DndContext id="atlas-notes-dnd" sensors={noteSensors} collisionDetection={closestCenter} onDragEnd={onNoteDragEnd}>
              <SortableContext items={noteIds} strategy={verticalListSortingStrategy}>
                {displayList.map((n) => (
                  <SortableNoteRow
                    key={n.id}
                    note={n}
                    active={resolvedSelectedId === n.id}
                    onSelect={() => {
                      setSelectedId(n.id);
                    }}
                    onPatch={(payload) => onPatchNote(n.id, payload)}
                    onDelete={() => void onDeleteNote(n.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            displayList.map((n) => {
              const nt = n.title || "Untitled";
              const rowTint = browseRowAccentSurface(n.rowAccentColor ?? null);
              return (
                <div
                  key={n.id}
                  className="flex items-center gap-0.5 rounded-md"
                  style={rowTint}
                >
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedId(n.id);
                    }}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-md px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                      resolvedSelectedId === n.id && "bg-muted font-medium",
                    )}
                  >
                    {nt}
                  </button>
                  <BrowseItemOverflowMenu
                    kind="note"
                    initialTitle={nt}
                    initialAccent={n.rowAccentColor ?? null}
                    onApply={(payload) => onPatchNote(n.id, payload)}
                    onDelete={() => void onDeleteNote(n.id)}
                    deleteConfirmation={`Delete note “${nt}”?`}
                  />
                </div>
              );
            })
          )}
        </div>
      </CollapsibleRail>
    </>
  );
}
