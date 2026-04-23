/* eslint-disable react-refresh/only-export-components -- hook + provider share one context module */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RoutingToastInput = {
  message: string;
  /** Shown for a few seconds; call on undo to reverse the route when possible */
  undoLabel?: string;
  undo?: () => Promise<void>;
};

type ToastItem = RoutingToastInput & { id: string };

const RoutingToastContext = createContext<(t: RoutingToastInput) => void>(() => {});

const DEFAULT_TTL_MS = 12_000;

export function RoutingToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const pushToast = useCallback(
    (t: RoutingToastInput) => {
      const id = crypto.randomUUID();
      setItems((prev) => [...prev, { ...t, id }]);
      const timer = window.setTimeout(() => dismiss(id), DEFAULT_TTL_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => pushToast, [pushToast]);

  return (
    <RoutingToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(100vw-2rem,22rem)] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg",
            )}
          >
            <p className="leading-snug">{t.message}</p>
            {t.undo ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={async () => {
                    try {
                      await t.undo?.();
                    } finally {
                      dismiss(t.id);
                    }
                  }}
                >
                  {t.undoLabel ?? "Undo"}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => dismiss(t.id)}>
                  Dismiss
                </Button>
              </div>
            ) : (
              <div className="mt-2">
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => dismiss(t.id)}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </RoutingToastContext.Provider>
  );
}

export function useRoutingToast() {
  return useContext(RoutingToastContext);
}
