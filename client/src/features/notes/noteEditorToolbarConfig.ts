/** Toolbar control ids (order defaults are defined in `NoteEditorToolbar` localStorage). */
export const NOTE_TOOLBAR_ORDER = [
  "textStyle",
  "checklist",
  "table",
  "attach",
  "tableEdit",
  "bulletList",
  "orderedList",
  "bold",
  "italic",
  "strike",
  "blockquote",
  "code",
  "horizontalRule",
  "undo",
  "redo",
] as const;

export type NoteToolbarItemId = (typeof NOTE_TOOLBAR_ORDER)[number];

export const NOTE_TOOLBAR_ORDER_SET = new Set<string>(NOTE_TOOLBAR_ORDER);

/** User-facing labels for Settings and tooltips. */
export const NOTE_TOOLBAR_LABELS: Record<NoteToolbarItemId, string> = {
  textStyle: "Body & headings",
  checklist: "Checklist",
  table: "Insert table",
  attach: "Attach file",
  tableEdit: "Edit table",
  bulletList: "Bullet list",
  orderedList: "Numbered list",
  bold: "Bold",
  italic: "Italic",
  strike: "Strikethrough",
  blockquote: "Quote",
  code: "Inline code",
  horizontalRule: "Horizontal rule",
  undo: "Undo",
  redo: "Redo",
};
