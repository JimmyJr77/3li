import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { fetchBacklinks, fetchForwardLinks } from "./api";
import type { NoteLinkSummaryDto } from "./types";

export function NoteLinksPanel({
  noteId,
  onOpenNote,
  forwardLinksOverride,
  backLinksOverride,
}: {
  noteId: string;
  onOpenNote: (id: string) => void;
  /** When both provided (browser-only mode), skips API */
  forwardLinksOverride?: NoteLinkSummaryDto[];
  backLinksOverride?: NoteLinkSummaryDto[];
}) {
  const useApi = forwardLinksOverride === undefined || backLinksOverride === undefined;

  const forwardQ = useQuery({
    queryKey: ["notes-app", "links", "forward", noteId],
    queryFn: () => fetchForwardLinks(noteId),
    enabled: useApi,
  });
  const backQ = useQuery({
    queryKey: ["notes-app", "links", "back", noteId],
    queryFn: () => fetchBacklinks(noteId),
    enabled: useApi,
  });

  const forward = forwardLinksOverride ?? forwardQ.data ?? [];
  const back = backLinksOverride ?? backQ.data ?? [];
  const loading = useApi && (forwardQ.isLoading || backQ.isLoading);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Links</div>
      {loading ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading links…
        </div>
      ) : (
        <div className="mt-2 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Outgoing</div>
            <ul className="mt-1 space-y-1">
              {forward.length === 0 ? (
                <li className="text-xs text-muted-foreground">None</li>
              ) : (
                forward.map((n) => (
                  <li key={n.id}>
                    <button type="button" className="text-left text-primary hover:underline" onClick={() => onOpenNote(n.id)}>
                      {n.title}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Backlinks</div>
            <ul className="mt-1 space-y-1">
              {back.length === 0 ? (
                <li className="text-xs text-muted-foreground">None</li>
              ) : (
                back.map((n) => (
                  <li key={n.id}>
                    <button type="button" className="text-left text-primary hover:underline" onClick={() => onOpenNote(n.id)}>
                      {n.title}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
