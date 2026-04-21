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
import { ChevronLeft, FileText, FolderPlus, GripVertical, Loader2, Pencil, Plus, Search, Trash2, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
  editingId,
  draftTitle,
  setDraftTitle,
  onSelect,
  onCommitRename,
  onDelete,
  onStartRename,
}: {
  folder: NotesFolderDto;
  active: boolean;
  editingId: string | null;
  draftTitle: string;
  setDraftTitle: (s: string) => void;
  onSelect: () => void;
  onCommitRename: () => void;
  onDelete: () => void;
  onStartRename: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: folder.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-0.5 rounded-md",
        active && "bg-muted font-medium",
        isDragging && "opacity-60",
      )}
    >
      <button
        type="button"
        className="touch-none rounded p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        aria-label="Drag to reorder folder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      {editingId === folder.id ? (
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={onCommitRename}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-8 min-w-0 flex-1 text-sm"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect();
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onStartRename();
          }}
          className="min-w-0 flex-1 truncate rounded px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/80"
        >
          {folder.title}
        </button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="size-7 shrink-0"
        aria-label="Rename folder"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onStartRename();
        }}
      >
        <Pencil className="size-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="size-7 shrink-0 text-destructive hover:text-destructive"
        aria-label="Delete folder"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="size-3" />
      </Button>
    </div>
  );
}

function SortableNoteRow({
  note,
  active,
  onSelect,
}: {
  note: AtlasNoteDto;
  active: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex w-full items-start gap-1 rounded-md",
        active && "bg-muted font-medium",
        isDragging && "opacity-60",
      )}
    >
      <button
        type="button"
        className="mt-1 shrink-0 touch-none rounded p-0.5 text-muted-foreground hover:bg-muted/80"
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
        className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1 py-2 text-left text-sm transition-colors hover:bg-muted/80"
      >
        <FileText className="mt-0.5 size-4 shrink-0 opacity-60" />
        <span className="line-clamp-2">
          {note.title || "Untitled"}
          {note.previewText ? (
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground line-clamp-2">{note.previewText}</span>
          ) : null}
        </span>
      </button>
    </div>
  );
}

export function AtlasNotesBrowseColumns({
  localMode,
  topFolders,
  folderFilter,
  setFolderFilter,
  setSearchHits,
  notesLoading,
  displayList,
  resolvedSelectedId,
  setSelectedId,
  searchQ,
  setSearchQ,
  runSearch,
  createPending,
  onNewNote,
  onQuickCapture,
  onNewFolder,
  newFolderPending,
  onReorderFolders,
  onReorderNotes,
  onRenameFolder,
  onDeleteFolder,
  canReorderNotes,
}: {
  localMode: boolean;
  topFolders: NotesFolderDto[];
  folderFilter: string | "all";
  setFolderFilter: (id: string | "all") => void;
  setSearchHits: (v: AtlasNoteDto[] | null) => void;
  notesLoading: boolean;
  displayList: AtlasNoteDto[];
  resolvedSelectedId: string | null;
  setSelectedId: (id: string | null) => void;
  searchQ: string;
  setSearchQ: (s: string) => void;
  runSearch: () => void | Promise<void>;
  createPending: boolean;
  onNewNote: () => void;
  onQuickCapture: () => void;
  onNewFolder: () => void;
  newFolderPending?: boolean;
  onReorderFolders: (orderedIds: string[]) => void | Promise<void>;
  onReorderNotes: (orderedIds: string[]) => void | Promise<void>;
  onRenameFolder: (folderId: string, title: string) => void | Promise<void>;
  onDeleteFolder: (folderId: string) => void | Promise<void>;
  canReorderNotes: boolean;
}) {
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const folderIds = useMemo(() => topFolders.map((f) => f.id), [topFolders]);
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
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = folderIds.indexOf(active.id as string);
    const newIndex = folderIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(folderIds, oldIndex, newIndex);
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

  const startRename = (f: NotesFolderDto) => {
    setEditingFolderId(f.id);
    setDraftTitle(f.title);
  };

  const commitRename = async () => {
    const id = editingFolderId;
    if (!id) return;
    const t = draftTitle.trim();
    setEditingFolderId(null);
    if (!t) return;
    const folder = topFolders.find((x) => x.id === id);
    if (!folder || t === folder.title) return;
    await onRenameFolder(id, t);
  };

  return (
    <>
      <CollapsibleRail
        open={foldersOpen}
        onOpenChange={setFoldersOpen}
        label="FOLDERS"
        widthClass="w-52"
        headerRight={
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="New folder"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNewFolder();
            }}
            disabled={newFolderPending}
          >
            <FolderPlus className="size-3.5" />
          </Button>
        }
      >
        <DndContext id="atlas-folders-dnd" sensors={folderSensors} collisionDetection={closestCenter} onDragEnd={onFolderDragEnd}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFolderFilter("all");
              setSearchHits(null);
            }}
            className={cn(
              "mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
              folderFilter === "all" && "bg-muted font-medium",
            )}
          >
            All notes
          </button>
          <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
            <nav className="flex flex-col gap-0.5">
              {topFolders.map((f) => (
                <SortableFolderRow
                  key={f.id}
                  folder={f}
                  active={folderFilter === f.id}
                  editingId={editingFolderId}
                  draftTitle={draftTitle}
                  setDraftTitle={setDraftTitle}
                  onSelect={() => {
                    setFolderFilter(f.id);
                    setSearchHits(null);
                  }}
                  onCommitRename={() => void commitRename()}
                  onDelete={() => {
                    if (confirm(`Delete folder “${f.title}”? Notes inside will move to another folder.`)) {
                      void onDeleteFolder(f.id);
                    }
                  }}
                  onStartRename={() => startRename(f)}
                />
              ))}
            </nav>
          </SortableContext>
        </DndContext>
      </CollapsibleRail>

      <CollapsibleRail open={notesOpen} onOpenChange={setNotesOpen} label="NOTES" widthClass="w-64">
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              placeholder="Search…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runSearch()}
              className="h-8 text-sm"
            />
            <Button type="button" size="icon" variant="secondary" className="size-8 shrink-0" onClick={() => void runSearch()}>
              <Search className="size-4" />
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={onNewNote}
              disabled={createPending}
            >
              <Plus className="size-4" />
              New note
            </Button>
            <Button type="button" size="sm" variant="secondary" className="w-full justify-start gap-2" onClick={onQuickCapture}>
              <Zap className="size-4" />
              Quick capture
            </Button>
            <p className="text-[0.65rem] leading-tight text-muted-foreground">Quick capture: ⌘⇧C · Command palette: ⌘K</p>
          </div>
        </div>
        {!canReorderNotes ? (
          <p className="mb-2 text-[0.65rem] text-muted-foreground">Select a single folder to reorder notes.</p>
        ) : null}
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {!localMode && notesLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading…
            </div>
          ) : displayList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet. Create one to get started.</p>
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
                      setSearchHits(null);
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            displayList.map((n) => (
              <button
                key={n.id}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedId(n.id);
                  setSearchHits(null);
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                  resolvedSelectedId === n.id && "bg-muted font-medium",
                )}
              >
                <span className="line-clamp-2">
                  {n.title || "Untitled"}
                  {n.previewText ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground line-clamp-2">
                      {n.previewText}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </CollapsibleRail>
    </>
  );
}
