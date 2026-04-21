import { EditorContent, useEditor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { patchNote, type PatchNoteBody } from "./api";
import { extractPreviewFromDoc } from "./extractPreview";
import { noteEditorExtensions } from "./noteEditorExtensions";
import type { AtlasNoteDto } from "./types";
import { cn } from "@/lib/utils";

const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const editorSurfaceClass =
  "max-w-none text-sm leading-relaxed text-foreground focus:outline-none [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 " +
  "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:items-start [&_li[data-type=taskItem]]:gap-2 [&_li[data-type=taskItem]]:my-1 " +
  "[&_table]:my-3 [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_td]:border [&_th]:border [&_td]:border-border [&_th]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2 [&_th]:py-1.5 [&_th]:bg-muted/50 [&_th]:text-left";

export function NoteEditor({
  note,
  onSaved,
  persistNote,
}: {
  note: AtlasNoteDto;
  onSaved?: () => void;
  /** When set (e.g. browser-only mode), saves without calling the HTTP API */
  persistNote?: (noteId: string, body: Pick<PatchNoteBody, "contentJson" | "previewText">) => Promise<void>;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerialized = useRef<string>("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [richPanelOpen, setRichPanelOpen] = useState(false);

  const flushSave = useCallback(
    async (json: unknown, preview: string) => {
      const serialized = JSON.stringify(json);
      if (serialized === lastSerialized.current) return;
      lastSerialized.current = serialized;
      setSaveStatus("saving");
      try {
        if (persistNote) {
          await persistNote(note.id, {
            contentJson: json,
            previewText: preview || null,
          });
        } else {
          await patchNote(note.id, {
            contentJson: json,
            previewText: preview || null,
          });
        }
        setSaveStatus("saved");
        onSaved?.();
        if (savedClearTimer.current) clearTimeout(savedClearTimer.current);
        savedClearTimer.current = setTimeout(() => setSaveStatus("idle"), 1600);
      } catch {
        setSaveStatus("error");
      }
    },
    [note.id, onSaved, persistNote],
  );

  const scheduleSave = useCallback(
    (json: unknown) => {
      const preview = extractPreviewFromDoc(json);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flushSave(json, preview);
      }, 750);
    },
    [flushSave],
  );

  const editor = useEditor({
    extensions: noteEditorExtensions,
    content: (note.contentJson as object | null) ?? EMPTY_DOC,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: editorSurfaceClass,
      },
    },
    onUpdate: ({ editor: ed }) => {
      scheduleSave(ed.getJSON());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const json = note.contentJson as object | null;
    const next = json ?? EMPTY_DOC;
    const asString = JSON.stringify(next);
    lastSerialized.current = asString;
    editor.commands.setContent(next, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, note.id]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedClearTimer.current) clearTimeout(savedClearTimer.current);
    };
  }, []);

  if (!editor) {
    return <div className="text-sm text-muted-foreground">Loading editor…</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        {saveStatus === "saving" && <span>Saving…</span>}
        {saveStatus === "saved" && <span>Saved</span>}
        {saveStatus === "error" && <span className="text-destructive">Could not save</span>}
      </div>
      <div className="relative flex min-h-[min(42vh,480px)] flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          <ToolbarIconBtn
            title="Checklist"
            pressed={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <ListChecks className="size-3.5" />
          </ToolbarIconBtn>
          <ToolbarIconBtn
            title="Insert table"
            pressed={editor.isActive("table")}
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            <Table2 className="size-3.5" />
          </ToolbarIconBtn>
          <ToolbarIconBtn
            title="Bullet list"
            pressed={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="size-3.5" />
          </ToolbarIconBtn>
          <ToolbarIconBtn
            title="Numbered list"
            pressed={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-3.5" />
          </ToolbarIconBtn>
          <Button
            type="button"
            size="icon-sm"
            variant={richPanelOpen ? "secondary" : "ghost"}
            className="size-8 shadow-sm"
            aria-expanded={richPanelOpen}
            aria-label={richPanelOpen ? "Hide rich text toolbar" : "Show rich text toolbar"}
            title={richPanelOpen ? "Hide rich text toolbar" : "Rich text"}
            onClick={() => setRichPanelOpen((o) => !o)}
          >
            {richPanelOpen ? <X className="size-4" /> : <Wand2 className="size-4" />}
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col pt-11">
          {richPanelOpen ? (
            <div className="border-b border-border bg-muted/35 px-3 py-2">
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 flex items-center gap-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                  <Wand2 className="size-3" aria-hidden />
                  Rich text
                </span>
                <ToolbarIconBtn
                  title="Bold"
                  pressed={editor.isActive("bold")}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold className="size-3.5" />
                </ToolbarIconBtn>
                <ToolbarIconBtn
                  title="Italic"
                  pressed={editor.isActive("italic")}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic className="size-3.5" />
                </ToolbarIconBtn>
                <ToolbarIconBtn
                  title="Strikethrough"
                  pressed={editor.isActive("strike")}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                >
                  <Strikethrough className="size-3.5" />
                </ToolbarIconBtn>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <ToolbarIconBtn
                  title="Heading 2"
                  pressed={editor.isActive("heading", { level: 2 })}
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                  <Heading2 className="size-3.5" />
                </ToolbarIconBtn>
                <ToolbarIconBtn
                  title="Heading 3"
                  pressed={editor.isActive("heading", { level: 3 })}
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                >
                  <Heading3 className="size-3.5" />
                </ToolbarIconBtn>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <ToolbarIconBtn
                  title="Quote"
                  pressed={editor.isActive("blockquote")}
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                >
                  <Quote className="size-3.5" />
                </ToolbarIconBtn>
                <ToolbarIconBtn
                  title="Inline code"
                  pressed={editor.isActive("code")}
                  onClick={() => editor.chain().focus().toggleCode().run()}
                >
                  <Code className="size-3.5" />
                </ToolbarIconBtn>
                <ToolbarIconBtn
                  title="Horizontal rule"
                  pressed={false}
                  onClick={() => editor.chain().focus().setHorizontalRule().run()}
                >
                  <Minus className="size-3.5" />
                </ToolbarIconBtn>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <ToolbarIconBtn title="Undo" pressed={false} onClick={() => editor.chain().focus().undo().run()}>
                  <Undo2 className="size-3.5" />
                </ToolbarIconBtn>
                <ToolbarIconBtn title="Redo" pressed={false} onClick={() => editor.chain().focus().redo().run()}>
                  <Redo2 className="size-3.5" />
                </ToolbarIconBtn>
              </div>
            </div>
          ) : null}

          <div className="atlas-notes-editor min-h-0 flex-1 overflow-y-auto px-3 py-2">
            <EditorContent editor={editor} />
          </div>
        </div>
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
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
