import { useArchivesVisibility } from "@/context/ArchivesVisibilityContext";
import { cn } from "@/lib/utils";

/**
 * Shown at the bottom of the authenticated app shell so every in-app page can opt into the same
 * “Show archives / Hide archives” pattern without duplicating it per route.
 */
export function ShowArchivesFooter() {
  const { showArchives, toggleShowArchives } = useArchivesVisibility();

  return (
    <footer className="mt-8 shrink-0 border-t border-border/60 pt-4">
      <button
        type="button"
        onClick={toggleShowArchives}
        className={cn(
          "text-xs text-muted-foreground underline-offset-4 transition-colors",
          "hover:text-foreground hover:underline",
        )}
        aria-expanded={showArchives}
      >
        {showArchives ? "Hide archives" : "Show archives"}
      </button>
    </footer>
  );
}
