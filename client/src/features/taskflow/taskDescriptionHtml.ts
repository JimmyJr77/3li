import { generateHTML } from "@tiptap/html";
import type { JSONContent } from "@tiptap/core";
import { plainTextToTipTapDoc } from "@/features/notes/noteUtils";
import { taskDescriptionEditorExtensions } from "./taskDescriptionEditorExtensions";

/**
 * Coerce server/client description to an HTML string for the TipTap editor and comparisons.
 * Legacy rows may be stored as plain text; new saves store TipTap HTML.
 */
export function taskDescriptionStringToHTML(raw: string | null | undefined): string {
  const s = raw ?? "";
  if (!s.trim()) return "";
  if (s.trim().startsWith("<")) return s;
  return generateHTML(plainTextToTipTapDoc(s) as JSONContent, taskDescriptionEditorExtensions);
}

const EMPTY_P = /^\s*<p>\s*<\/p>\s*$/i;

/** True for empty or TipTap’s default empty paragraph. */
function isVisuallyEmptyDoc(html: string): boolean {
  if (!html.trim()) return true;
  if (EMPTY_P.test(html)) return true;
  if (/^\s*<p>\s*<br\s*class="[^"]*prosemirror-trailingBreak[^"]*"\s*\/?>\s*<\/p>\s*$/i.test(html)) return true;
  return false;
}

/**
 * Return true if two description strings are equivalent for dirty checking (plain vs empty HTML, etc.).
 */
export function taskDescriptionsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a === b) return true;
  const x = a ?? "";
  const y = b ?? "";
  if (isVisuallyEmptyDoc(x) && isVisuallyEmptyDoc(y)) return true;
  const xh = x.trim() && !x.trim().startsWith("<") ? taskDescriptionStringToHTML(x) : x;
  const yh = y.trim() && !y.trim().startsWith("<") ? taskDescriptionStringToHTML(y) : y;
  if (xh === yh) return true;
  if (isVisuallyEmptyDoc(xh) && isVisuallyEmptyDoc(yh)) return true;
  return false;
}
