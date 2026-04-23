import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CollapsibleAgentCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Applied to the leading icon (e.g. accent color). */
  iconClassName?: string;
  defaultOpen?: boolean;
  /** Controlled open state; use with `onOpenChange` (e.g. mutually exclusive panels). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: ReactNode;
};

/** Shared shell for sidebar-style agents (collapsible header + body). */
export function CollapsibleAgentCard({
  title,
  description,
  icon: Icon,
  iconClassName,
  defaultOpen = false,
  open: openControlled,
  onOpenChange,
  className,
  children,
}: CollapsibleAgentCardProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = openControlled !== undefined;
  const open = controlled ? openControlled : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (controlled) {
      onOpenChange?.(next);
    } else {
      setUncontrolledOpen(next);
    }
  };

  return (
    <Card className={cn("flex h-full min-h-0 flex-col border bg-card shadow-sm", className)}>
      <CardHeader className="pb-2">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-2 text-left"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className={cn("size-4 shrink-0", iconClassName)} aria-hidden />
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          {open ? (
            <ChevronUp className="size-4 shrink-0 opacity-60" />
          ) : (
            <ChevronDown className="size-4 shrink-0 opacity-60" />
          )}
        </button>
      </CardHeader>
      {open ? <CardContent className="space-y-3 pt-0">{children}</CardContent> : null}
    </Card>
  );
}
