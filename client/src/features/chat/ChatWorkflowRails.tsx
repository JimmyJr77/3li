import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const verticalLabelClass =
  "select-none text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground";

function VerticalLabel({ children }: { children: string }) {
  return (
    <span className={verticalLabelClass} style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
      {children}
    </span>
  );
}

/** Left column: collapsing to a thin strip on the left (content folds right), matching Notebooks FOLDERS/NOTES rails. */
export function ChatChatsRail({
  open,
  onOpenChange,
  label,
  widthClass,
  headerRight,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  label: string;
  widthClass: string;
  headerRight?: ReactNode;
  children: React.ReactNode;
}) {
  if (!open) {
    return (
      <button
        type="button"
        title={`Show ${label} panel`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenChange(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex min-h-[min(68vh,560px)] w-10 shrink-0 cursor-pointer flex-col items-center justify-center border-r border-border bg-muted/40 py-4 hover:bg-muted/70"
        aria-expanded={false}
        aria-label={`Expand ${label}`}
      >
        <VerticalLabel>{label}</VerticalLabel>
      </button>
    );
  }
  return (
    <div
      className={cn(
        "relative z-10 flex min-h-0 shrink-0 flex-col self-stretch border-r border-border bg-muted/30",
        widthClass,
      )}
    >
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
        <span className="truncate text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          {headerRight}
          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            title="Hide this panel"
            className="size-8 shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenChange(false);
            }}
            aria-expanded
            aria-label={`Collapse ${label}`}
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>
      </div>
      <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2">{children}</div>
    </div>
  );
}

/** Right column: collapsing to a thin strip on the right (content folds right), mirrored from the left rail. */
export function ChatContextRail({
  open,
  onOpenChange,
  label,
  widthClass,
  headerLeft,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  label: string;
  widthClass: string;
  headerLeft?: ReactNode;
  children: React.ReactNode;
}) {
  if (!open) {
    return (
      <button
        type="button"
        title={`Show ${label} panel`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenChange(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex min-h-[min(68vh,560px)] w-10 shrink-0 cursor-pointer flex-col items-center justify-center border-l border-border bg-muted/40 py-4 hover:bg-muted/70"
        aria-expanded={false}
        aria-label={`Expand ${label}`}
      >
        <VerticalLabel>{label}</VerticalLabel>
      </button>
    );
  }
  return (
    <div
      className={cn(
        "relative z-10 flex min-h-0 shrink-0 flex-col self-stretch border-l border-border bg-muted/30",
        widthClass,
      )}
    >
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {headerLeft}
          <span className="truncate text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon-xs"
          title="Hide this panel"
          className="size-8 shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenChange(false);
          }}
          aria-expanded
          aria-label={`Collapse ${label}`}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-2">{children}</div>
    </div>
  );
}
