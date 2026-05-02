import type { Editor } from "@tiptap/core";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ALargeSmall,
  Bold,
  ChevronDown,
  Code,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Paperclip,
  Pencil,
  Redo2,
  Strikethrough,
  Table2,
  Undo2,
} from "lucide-react";
import { useEditorState } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useWorkspacePrefs } from "@/context/WorkspacePrefsContext";
import {
  NOTE_TOOLBAR_ORDER,
  NOTE_TOOLBAR_ORDER_SET,
  type NoteToolbarItemId,
} from "@/features/notes/noteEditorToolbarConfig";

export type { NoteToolbarItemId } from "@/features/notes/noteEditorToolbarConfig";

const STORAGE_KEY = "atlas-note-editor-toolbar-order-v1";

function normalizeOrder(parsed: unknown): NoteToolbarItemId[] {
  if (!Array.isArray(parsed)) return [...NOTE_TOOLBAR_ORDER];
  const seen = new Set<string>();
  const out: NoteToolbarItemId[] = [];
  for (const x of parsed) {
    if (typeof x !== "string" || !NOTE_TOOLBAR_ORDER_SET.has(x) || seen.has(x)) continue;
    seen.add(x);
    out.push(x as NoteToolbarItemId);
  }
  for (const id of NOTE_TOOLBAR_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

function loadToolbarOrder(): NoteToolbarItemId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...NOTE_TOOLBAR_ORDER];
    return normalizeOrder(JSON.parse(raw) as unknown);
  } catch {
    return [...NOTE_TOOLBAR_ORDER];
  }
}

function currentTextStyleShortLabel(editor: Editor): string {
  for (let level = 1; level <= 6; level += 1) {
    if (editor.isActive("heading", { level })) return `H${level}`;
  }
  return "Body";
}

function SortableToolbarItem({
  id,
  reorderMode,
  children,
}: {
  id: NoteToolbarItemId;
  reorderMode: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !reorderMode,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex shrink-0 items-center rounded-md border border-transparent bg-muted/20 px-0.5 py-0.5",
        reorderMode && "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "border-border bg-muted/50 opacity-90 shadow-sm",
        reorderMode && !isDragging && "border-dashed border-muted-foreground/25",
      )}
      {...(reorderMode ? { ...attributes, ...listeners } : {})}
    >
      <div className={cn("flex shrink-0 items-center", reorderMode && "pointer-events-none select-none")}>
        {children}
      </div>
    </div>
  );
}

function ToolbarIconBtn({
  title,
  pressed,
  onClick,
  children,
}: {
  title: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      title={title}
      aria-pressed={pressed}
      className={cn("size-8 shadow-sm", pressed && "bg-muted text-foreground")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function renderItem(
  id: NoteToolbarItemId,
  editor: Editor,
  fileInputRef: RefObject<HTMLInputElement | null>,
): ReactNode {
  switch (id) {
    case "textStyle":
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-8 shadow-sm"
              aria-label={`Text size and headings. Current: ${currentTextStyleShortLabel(editor)}.`}
              title="Body text and heading levels"
              onMouseDown={(e) => e.preventDefault()}
            >
              <ALargeSmall className="size-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[11rem]">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Body</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => {
                editor.chain().focus().setParagraph().run();
              }}
            >
              <span className={editor.isActive("paragraph") && !editor.isActive("heading") ? "font-medium" : ""}>
                Normal
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Headings</DropdownMenuLabel>
            {([1, 2, 3, 4, 5, 6] as const).map((level) => (
              <DropdownMenuItem
                key={level}
                onSelect={() => {
                  editor.chain().focus().setHeading({ level }).run();
                }}
              >
                <span className={editor.isActive("heading", { level }) ? "font-medium" : ""}>Heading {level}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    case "checklist":
      return (
        <ToolbarIconBtn
          title="Checklist"
          pressed={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListChecks className="size-3.5" />
        </ToolbarIconBtn>
      );
    case "table":
      return (
        <ToolbarIconBtn
          title="Insert table"
          pressed={editor.isActive("table")}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <Table2 className="size-3.5" />
        </ToolbarIconBtn>
      );
    case "attach":
      return (
        <ToolbarIconBtn
          title="Insert file — images embed in the note; other files (up to 4 MB) insert as download links"
          pressed={false}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-3.5" />
        </ToolbarIconBtn>
      );
    case "tableEdit":
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2 text-xs font-normal shadow-sm"
              aria-label="Edit table: rows, columns, delete"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Table2 className="size-3.5" />
              Edit table
              <ChevronDown className="size-3.5 opacity-70" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[12.5rem]">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Rows</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => {
                editor.chain().focus().addRowBefore().run();
              }}
            >
              Add row above
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                editor.chain().focus().addRowAfter().run();
              }}
            >
              Add row below
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                editor.chain().focus().deleteRow().run();
              }}
            >
              Delete row
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Columns</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => {
                editor.chain().focus().addColumnBefore().run();
              }}
            >
              Add column left
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                editor.chain().focus().addColumnAfter().run();
              }}
            >
              Add column right
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                editor.chain().focus().deleteColumn().run();
              }}
            >
              Delete column
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                if (!confirm("Remove this entire table?")) {
                  e.preventDefault();
                  return;
                }
                editor.chain().focus().deleteTable().run();
              }}
            >
              Delete table
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    case "bulletList":
      return (
        <ToolbarIconBtn
          title="Bullet list"
          pressed={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-3.5" />
        </ToolbarIconBtn>
      );
    case "orderedList":
      return (
        <ToolbarIconBtn
          title="Numbered list"
          pressed={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-3.5" />
        </ToolbarIconBtn>
      );
    case "bold":
      return (
        <ToolbarIconBtn
          title="Bold"
          pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" />
        </ToolbarIconBtn>
      );
    case "italic":
      return (
        <ToolbarIconBtn
          title="Italic"
          pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </ToolbarIconBtn>
      );
    case "strike":
      return (
        <ToolbarIconBtn
          title="Strikethrough"
          pressed={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="size-3.5" />
        </ToolbarIconBtn>
      );
    case "code":
      return (
        <ToolbarIconBtn
          title="Inline code"
          pressed={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="size-3.5" />
        </ToolbarIconBtn>
      );
    case "horizontalRule":
      return (
        <ToolbarIconBtn
          title="Horizontal rule"
          pressed={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="size-3.5" />
        </ToolbarIconBtn>
      );
    case "undo":
      return (
        <ToolbarIconBtn title="Undo" pressed={false} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="size-3.5" />
        </ToolbarIconBtn>
      );
    case "redo":
      return (
        <ToolbarIconBtn title="Redo" pressed={false} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="size-3.5" />
        </ToolbarIconBtn>
      );
    default:
      return null;
  }
}

export function NoteEditorToolbar({
  editor,
  fileInputRef,
}: {
  editor: Editor;
  fileInputRef: RefObject<HTMLInputElement | null>;
}) {
  const { isNoteToolbarItemVisible } = useWorkspacePrefs();
  const [order, setOrder] = useState<NoteToolbarItemId[]>(() => [...NOTE_TOOLBAR_ORDER]);
  const [reorderMode, setReorderMode] = useState(false);

  useEffect(() => {
    setOrder(loadToolbarOrder());
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((items) => {
      const oldIndex = items.indexOf(active.id as NoteToolbarItemId);
      const newIndex = items.indexOf(over.id as NoteToolbarItemId);
      if (oldIndex < 0 || newIndex < 0) return items;
      const next = arrayMove(items, oldIndex, newIndex);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const visibleOrder = useMemo(
    () => order.filter((id) => isNoteToolbarItemVisible(id)),
    [order, isNoteToolbarItemVisible],
  );

  const isTableActive = useEditorState({
    editor,
    selector: ({ editor: ed }) => ed.isActive("table"),
  });

  const visibleToolbarIds = useMemo(
    () => visibleOrder.filter((id) => id !== "tableEdit" || isTableActive),
    [visibleOrder, isTableActive],
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 px-2 py-1.5",
          reorderMode && "rounded-md bg-muted/30 ring-1 ring-muted-foreground/20",
        )}
      >
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className={cn("size-8 shadow-sm", reorderMode && "bg-muted text-foreground")}
          title={
            reorderMode
              ? "Done reordering — toolbar actions work again"
              : "Reorder toolbar — drag controls to rearrange"
          }
          aria-label={reorderMode ? "Done reordering toolbar" : "Reorder toolbar"}
          aria-pressed={reorderMode}
          onClick={() => setReorderMode((v) => !v)}
        >
          <Pencil className="size-3.5" aria-hidden />
        </Button>
        <SortableContext items={visibleToolbarIds} strategy={horizontalListSortingStrategy}>
          {visibleToolbarIds.map((id) => (
            <SortableToolbarItem key={id} id={id} reorderMode={reorderMode}>
              {renderItem(id, editor, fileInputRef)}
            </SortableToolbarItem>
          ))}
        </SortableContext>
      </div>
    </DndContext>
  );
}
