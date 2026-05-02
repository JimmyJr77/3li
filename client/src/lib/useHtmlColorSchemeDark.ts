import { useSyncExternalStore } from "react";

/** Matches Tailwind `@custom-variant dark` on `html` (`.dark` or `.public-red-dark`). */
function htmlHasDarkSurfaceClass(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement;
  return el.classList.contains("dark") || el.classList.contains("public-red-dark");
}

function subscribeHtmlClass(callback: () => void) {
  const el = document.documentElement;
  const obs = new MutationObserver(callback);
  obs.observe(el, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

/** For props/CSS that cannot use Tailwind `dark:` (e.g. React Flow color strings). */
export function useHtmlColorSchemeDark(): boolean {
  return useSyncExternalStore(subscribeHtmlClass, htmlHasDarkSurfaceClass, () => false);
}
