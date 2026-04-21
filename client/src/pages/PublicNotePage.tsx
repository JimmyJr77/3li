import type { JSONContent } from "@tiptap/core";
import { generateHTML } from "@tiptap/html";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { fetchPublicNote } from "@/features/notes/api";
import { noteEditorExtensions } from "@/features/notes/noteEditorExtensions";

export function PublicNotePage() {
  const { publicSlug } = useParams<{ publicSlug: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-note", publicSlug],
    queryFn: () => fetchPublicNote(publicSlug!),
    enabled: !!publicSlug?.trim(),
  });

  let htmlBody = "";
  if (data?.contentJson && typeof data.contentJson === "object") {
    try {
      htmlBody = generateHTML(data.contentJson as JSONContent, noteEditorExtensions);
    } catch {
      htmlBody = "";
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Loading…
          </div>
        )}
        {!isLoading && error && (
          <p className="text-destructive">
            This public note could not be found. The link may be wrong or publishing was turned off.
          </p>
        )}
        {data && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">{data.title || "Untitled"}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Updated {new Date(data.updatedAt).toLocaleString()}
            </p>
            {htmlBody ? (
              <article
                className="public-note-content mt-8 text-sm leading-relaxed text-foreground [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:items-start [&_li[data-type=taskItem]]:gap-2 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_th]:border [&_td]:border-border [&_th]:border-border [&_td]:px-2 [&_th]:px-2 [&_th]:bg-muted/40 [&_th]:text-left"
                dangerouslySetInnerHTML={{ __html: htmlBody }}
              />
            ) : data.previewText ? (
              <p className="mt-8 whitespace-pre-wrap text-sm leading-relaxed">{data.previewText}</p>
            ) : (
              <p className="mt-8 text-sm text-muted-foreground">No content.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
