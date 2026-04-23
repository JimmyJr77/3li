import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";

/** Legacy `/app/board` → first board of the active workspace, or boards hub. */
export function DefaultBoardRedirect() {
  const { activeWorkspace, isLoading } = useActiveWorkspace();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Loading…
      </div>
    );
  }

  const id = activeWorkspace?.projectSpaces?.[0]?.boards?.[0]?.id;
  if (id) {
    return <Navigate to={`/app/boards/${id}`} replace />;
  }
  return <Navigate to="/app/boards" replace />;
}
