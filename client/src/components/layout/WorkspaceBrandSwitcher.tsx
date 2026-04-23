import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import type { WorkspaceDto } from "@/features/taskflow/types";
import { truncateWorkspaceDisplayName, WORKSPACE_DISPLAY_NAME_MAX } from "@/lib/workspaceConstants";
import { cn } from "@/lib/utils";

/** Legacy: workspace row title only. Prefer {@link brandMentionLabel} for sidebar chrome. */
export function workspaceChromeTitle(w: WorkspaceDto | null | undefined): string {
  if (!w) return "Workspace";
  return w.name?.trim() || "Workspace";
}

/** Lists, “My brands”, and copy that refers to the brand — uses Settings brand name, then kit display name. */
export function brandMentionLabel(w: WorkspaceDto | null | undefined): string {
  if (!w) return "Brand";
  const fromSettings = w.brandName?.trim();
  if (fromSettings) return fromSettings;
  const fromKit = w.brandDisplayName?.trim();
  if (fromKit) return fromKit;
  return w.name?.trim() || "Brand";
}

/** @deprecated Use `brandMentionLabel` for chrome; `workspaceChromeTitle` only for raw workspace row name. */
export function workspaceBrandLabel(w: WorkspaceDto | null | undefined): string {
  return brandMentionLabel(w);
}

type WorkspaceBrandSwitcherProps = {
  className?: string;
  /** When false, render a plain loading or fallback label (mobile header). */
  showDropdown?: boolean;
};

/**
 * One selectable row per brand (each maps to a single workspace ecosystem).
 * The trigger shows the **active brand** (Settings name → kit display name → workspace title), truncated.
 */
export function WorkspaceBrandSwitcher({ className, showDropdown = true }: WorkspaceBrandSwitcherProps) {
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspaceId,
    isLoading,
  } = useActiveWorkspace();

  const fullName = brandMentionLabel(activeWorkspace);
  const label = truncateWorkspaceDisplayName(fullName, WORKSPACE_DISPLAY_NAME_MAX);
  const needsTooltip = fullName.length > label.length;

  const titleInner = (
    <span className={cn("min-w-0 truncate font-semibold tracking-tight", className)}>{label}</span>
  );

  const triggerContent = (
    <>
      {titleInner}
      {showDropdown && workspaces.length > 1 ? (
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
      ) : null}
    </>
  );

  if (isLoading && !activeWorkspace) {
    return (
      <span className={cn("text-sm font-semibold tracking-tight text-muted-foreground", className)}>
        Loading…
      </span>
    );
  }

  if (!showDropdown || workspaces.length <= 1) {
    return (
      <Link
        to="/app/dashboard"
        className={cn("flex min-w-0 max-w-full items-center gap-1", className)}
        title={needsTooltip ? fullName : undefined}
      >
        {triggerContent}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-auto max-w-full justify-start gap-1 px-2 py-1 font-semibold has-[>svg]:px-2",
            className,
          )}
          title={needsTooltip ? fullName : undefined}
          aria-label={`Workspace: ${fullName}. Open to switch brands.`}
        >
          {triggerContent}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">My brands</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            className="gap-2"
            onClick={() => setActiveWorkspaceId(w.id)}
          >
            <span className="min-w-0 flex-1 truncate">{brandMentionLabel(w)}</span>
            {w.id === activeWorkspaceId ? (
              <span className="text-xs text-muted-foreground">✓</span>
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app/settings">Brand &amp; project spaces in Settings…</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
