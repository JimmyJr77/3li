import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { fetchBootstrap } from "@/features/taskflow/api";

/** Legacy `/app/board` → default board Kanban or boards list (Trello-style hub). */
export function DefaultBoardRedirect() {
  const q = useQuery({
    queryKey: ["bootstrap"],
    queryFn: fetchBootstrap,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Loading…
      </div>
    );
  }

  const id = q.data?.board?.id;
  if (id) {
    return <Navigate to={`/app/boards/${id}`} replace />;
  }
  return <Navigate to="/app/boards" replace />;
}
