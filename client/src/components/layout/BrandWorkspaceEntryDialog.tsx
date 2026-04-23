import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { BRAND_ENTRY_SESSION_KEY } from "@/lib/workspaceConstants";
import { cn } from "@/lib/utils";

/** When multiple brands exist, prompt once per browser tab session before heavy UI loads. */
export function BrandWorkspaceEntryDialog() {
  const { workspaces, isLoading, activeWorkspaceId, setActiveWorkspaceId } = useActiveWorkspace();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading || workspaces.length <= 1) return;
    try {
      if (sessionStorage.getItem(BRAND_ENTRY_SESSION_KEY)) return;
    } catch {
      return;
    }
    setOpen(true);
  }, [isLoading, workspaces.length]);

  const onPick = (id: string) => {
    setActiveWorkspaceId(id);
    try {
      sessionStorage.setItem(BRAND_ENTRY_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (workspaces.length <= 1) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-md gap-4"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle>Choose a brand</DialogTitle>
        <DialogDescription>
          You have more than one brand workspace. Pick which one to work in for this session.
        </DialogDescription>
        <ul className="flex max-h-[min(60vh,420px)] flex-col gap-2 overflow-y-auto pr-1">
          {workspaces.map((w) => {
            const label = w.brandDisplayName?.trim() || w.brandName || w.name;
            const sub = w.brandDisplayName?.trim() ? w.name : null;
            const selected = w.id === activeWorkspaceId;
            return (
              <li key={w.id}>
                <Button
                  type="button"
                  variant={selected ? "default" : "outline"}
                  className={cn("h-auto w-full justify-start py-3 text-left")}
                  onClick={() => onPick(w.id)}
                >
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="truncate font-medium">{label}</span>
                    {sub ? <span className="text-xs font-normal text-muted-foreground">{sub}</span> : null}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
