import type { CSSProperties } from "react";
import type { FlowNodeChrome } from "@/features/brainstorm/types";

/** Surface only (fill + outline). Text color is applied separately so captions stay controlled. */
export function nodeChromeToStyle(chrome: Partial<FlowNodeChrome> | undefined): CSSProperties {
  if (!chrome) return {};
  const s: CSSProperties = {};
  if (chrome.backgroundColor) s.backgroundColor = chrome.backgroundColor;
  if (chrome.borderColor) s.borderColor = chrome.borderColor;
  if (chrome.borderWidthPx != null && Number.isFinite(chrome.borderWidthPx) && chrome.borderWidthPx > 0) {
    s.borderWidth = chrome.borderWidthPx;
    s.borderStyle = "solid";
  }
  return s;
}

/** Appearance “Text” color for content inside the artifact (not outside labels). */
export function nodeChromeTextColorStyle(chrome: Partial<FlowNodeChrome> | undefined): CSSProperties {
  if (!chrome?.color || !String(chrome.color).trim()) return {};
  return { color: String(chrome.color).trim() };
}
