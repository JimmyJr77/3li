import { useEffect, useRef } from "react";
import { AUTOSAVE_DEBOUNCE_MS } from "@/lib/autosave";

export type UseDebouncedAutosaveParams = {
  /** When false, no timer is scheduled (e.g. sheet locked, missing prerequisites). */
  enabled: boolean;
  /** When false, no save is needed. */
  dirty: boolean;
  /** While a save is in flight, wait — avoids overlapping requests. */
  isPending: boolean;
  /** Called after the debounce elapses. Should read latest state from refs/closures. */
  onFlush: () => void;
  /**
   * When this value changes, the debounce timer resets (typically the draft payload
   * or serialized form state).
   */
  resetKey: unknown;
};

/**
 * Schedules `onFlush` once `AUTOSAVE_DEBOUNCE_MS` after `resetKey` stops changing,
 * when `enabled && dirty && !isPending`.
 */
export function useDebouncedAutosave({
  enabled,
  dirty,
  isPending,
  onFlush,
  resetKey,
}: UseDebouncedAutosaveParams): void {
  const flushRef = useRef(onFlush);
  flushRef.current = onFlush;

  useEffect(() => {
    if (!enabled || !dirty || isPending) return;
    const id = window.setTimeout(() => {
      flushRef.current();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [enabled, dirty, isPending, resetKey]);
}
