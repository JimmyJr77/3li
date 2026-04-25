import { useSyncExternalStore } from "react";

/** Tailwind `md` — side-by-side browse rails vs stacked mobile accordion. */
const NOTES_BROWSE_DESKTOP_MQ = "(min-width: 768px)";

function subscribeMdUp(onStoreChange: () => void) {
  const mq = window.matchMedia(NOTES_BROWSE_DESKTOP_MQ);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getMdUpSnapshot() {
  return window.matchMedia(NOTES_BROWSE_DESKTOP_MQ).matches;
}

/** Server snapshot: prefer stacked layout until client hydrates. */
function getServerSnapshot() {
  return false;
}

export function useNotesBrowseDesktop(): boolean {
  return useSyncExternalStore(subscribeMdUp, getMdUpSnapshot, getServerSnapshot);
}
