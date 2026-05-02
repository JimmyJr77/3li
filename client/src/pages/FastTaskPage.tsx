import { GalleryHorizontal } from "lucide-react";
import { FastTaskApp } from "@/features/fastTask/FastTaskApp";

export function FastTaskPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <GalleryHorizontal className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Fast Task</h1>
        </div>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Boards scroll flush to the screen edges. Indexer: jump or filter by owner and label. Each board has labels
          and assignees.
        </p>
      </div>
      <FastTaskApp />
    </div>
  );
}
