import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";

/**
 * Shared TipTap schema for the note editor and HTML export (e.g. public note page).
 * Keep these lists in sync wherever `generateHTML` / `generateJSON` is used.
 */
export const noteEditorExtensions = [
  StarterKit,
  TaskItem.configure({
    nested: true,
  }),
  TaskList,
  TableKit.configure({
    table: { resizable: false },
  }),
  Placeholder.configure({
    placeholder: "Start writing…",
  }),
];
