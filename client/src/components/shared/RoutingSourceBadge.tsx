import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  rapid_router: "Rapid Router",
  mail_clerk_plan: "Mail Clerk",
  mailroom: "Mailroom",
};

function labelForSource(source: string): string {
  return LABELS[source] ?? source.replace(/_/g, " ");
}

/** Subtle provenance chip when a task or note was created from capture / routing flows. */
export function RoutingSourceBadge({
  source,
  className,
}: {
  source: string | null | undefined;
  className?: string;
}) {
  const s = typeof source === "string" ? source.trim() : "";
  if (!s) return null;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      title={`Created via ${labelForSource(s)}`}
    >
      From {labelForSource(s)}
    </span>
  );
}
