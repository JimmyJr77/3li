import { generateJSON } from "@tiptap/html";
import { EditorContent, useEditor } from "@tiptap/react";
import { type ReactNode, useEffect, useId } from "react";
import { Bold, List, ListCheck, ListOrdered } from "lucide-react";
import { taskDescriptionStringToHTML, taskDescriptionsEqual } from "./taskDescriptionHtml";
import { taskDescriptionEditorExtensions } from "./taskDescriptionEditorExtensions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const editorSurfaceClass =
  "max-w-none text-sm leading-relaxed text-foreground focus:outline-none [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 " +
  "[&_ul:not([data-type=taskList]):not(.atlas-note-task-list)]:list-disc [&_ul:not([data-type=taskList]):not(.atlas-note-task-list)]:ps-6 " +
  "[&_ol]:list-decimal [&_ol]:ps-6 " +
  "[&_a]:break-words";

type Props = {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
};

function FieldLabel({ children }: { children: ReactNode }) {
  return <Label className="text-xs font-medium text-muted-foreground">{children}</Label>;
}

/**
 * Rich description field (TipTap) — list behavior matches notes; use under `.notebooks-editor` for checkbox styling.
 */
export function TicketDescriptionEditor({ id, value, onChange, disabled }: Props) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  const editor = useEditor({
    extensions: taskDescriptionEditorExtensions,
    content: (() => {
      const html = taskDescriptionStringToHTML(value);
      return html
        ? generateJSON(html, taskDescriptionEditorExtensions)
        : { type: "doc" as const, content: [{ type: "paragraph" as const }] };
    })(),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    editorProps: {
      attributes: {
        id: fieldId,
        class: editorSurfaceClass,
        "aria-label": "Description",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (taskDescriptionsEqual(value, editor.getHTML())) return;
    const html = taskDescriptionStringToHTML(value);
    const content = html
      ? generateJSON(html, taskDescriptionEditorExtensions)
      : { type: "doc" as const, content: [{ type: "paragraph" as const }] };
    editor.commands.setContent(content, { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) {
    return <div className="text-sm text-muted-foreground">Loading editor…</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>Description</FieldLabel>
        <div className="flex flex-wrap gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8"
            disabled={disabled}
            title="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-pressed={editor.isActive("bold")}
          >
            <Bold className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8"
            disabled={disabled}
            title="Bulleted list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            aria-pressed={editor.isActive("bulletList")}
          >
            <List className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8"
            disabled={disabled}
            title="Numbered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            aria-pressed={editor.isActive("orderedList")}
          >
            <ListOrdered className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8"
            disabled={disabled}
            title="Checklist"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            aria-pressed={editor.isActive("taskList")}
          >
            <ListCheck className="size-4" />
          </Button>
        </div>
      </div>
      <div
        className={cn(
          "notebooks-editor ticket-description-editor",
          "border-input bg-background ring-offset-background",
          "flex min-h-[120px] w-full flex-col rounded-md border px-3 py-2",
          "focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-none",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <EditorContent editor={editor} className="min-h-[104px] flex-1" />
      </div>
    </div>
  );
}
