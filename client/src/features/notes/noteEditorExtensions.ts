import { Extension } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { ListKit } from "@tiptap/extension-list";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";

/** Plain-text indent when Tab is not handled by tables, lists, or code blocks. */
const NOTE_TAB_SPACES = "   ";

const NoteTabInsert = Extension.create({
  name: "noteTabInsert",
  /** Run after built-in Tab handlers (tables, list indent, code blocks). */
  priority: 10,
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!this.editor.isEditable) return false;
        return this.editor.commands.insertContent(NOTE_TAB_SPACES);
      },
    };
  },
});

/**
 * Shared TipTap schema for the note editor and HTML export (e.g. public note page).
 * Keep these lists in sync wherever `generateHTML` / `generateJSON` is used.
 *
 * ListKit bundles bullet, ordered, list item, keymap, and task lists in the order TipTap expects.
 * StarterKit’s list pieces are disabled so they are not registered twice.
 */
export const noteEditorExtensions = [
  StarterKit.configure({
    bulletList: false,
    orderedList: false,
    listItem: false,
    listKeymap: false,
    /** Allow `data:` URLs on links so notebook file attachments (non-images) can embed safely. */
    link: {
      protocols: [{ scheme: "data", optionalSlashes: true }],
    },
  }),
  ListKit.configure({
    taskItem: {
      nested: true,
      HTMLAttributes: {
        class: "atlas-note-task-item",
      },
    },
    taskList: {
      HTMLAttributes: {
        class: "atlas-note-task-list",
      },
    },
  }),
  Image.configure({
    allowBase64: true,
    HTMLAttributes: {
      class: "atlas-note-image",
    },
  }),
  TableKit.configure({
    table: { resizable: false },
  }),
  Placeholder.configure({
    placeholder: "Start writing…",
  }),
  NoteTabInsert,
];
