/** Must match server `notesDefaults` seed titles. */
export const QUICKNOTES_NOTEBOOK_TITLE = "Quicknotes";
export const DEFAULT_NOTEBOOK_TITLE = "Notebook";

export function isProtectedNotebookTitle(title: string): boolean {
  return title === QUICKNOTES_NOTEBOOK_TITLE || title === DEFAULT_NOTEBOOK_TITLE;
}
