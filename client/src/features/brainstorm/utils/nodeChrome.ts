import type { CSSProperties } from "react";
import type { FlowNodeChrome } from "@/features/brainstorm/types";

/** Inline styles for optional per-node fill, text, and outline (persists on the node). */
export function nodeChromeToStyle(chrome: Partial<FlowNodeChrome> | undefined): CSSProperties {
  if (!chrome) return {};
  const s: CSSProperties = {};
  if (chrome.backgroundColor) s.backgroundColor = chrome.backgroundColor;
  if (chrome.color) s.color = chrome.color;
  if (chrome.borderColor) s.borderColor = chrome.borderColor;
  if (chrome.borderWidthPx != null && Number.isFinite(chrome.borderWidthPx) && chrome.borderWidthPx > 0) {
    s.borderWidth = chrome.borderWidthPx;
    s.borderStyle = "solid";
  }
  return s;
}
