import { Extension } from "@tiptap/core";
import { ListKit } from "@tiptap/extension-list";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";

const TASK_TAB = "   ";

const TaskTabInsert = Extension.create({
  name: "taskDescriptionTab",
  priority: 10,
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!this.editor.isEditable) return false;
        return this.editor.commands.insertContent(TASK_TAB);
      },
    };
  },
});

/**
 * Rich-text schema for task descriptions: lists + task list + standard marks.
 * Matches notes list styling (including checkbox appearance via global CSS under `.notebooks-editor`).
 */
export const taskDescriptionEditorExtensions = [
  StarterKit.configure({
    bulletList: false,
    orderedList: false,
    listItem: false,
    listKeymap: false,
  }),
  ListKit.configure({
    taskItem: {
      nested: true,
      HTMLAttributes: { class: "atlas-note-task-item" },
    },
    taskList: {
      HTMLAttributes: { class: "atlas-note-task-list" },
    },
  }),
  Placeholder.configure({ placeholder: "Add a description…" }),
  TaskTabInsert,
];
