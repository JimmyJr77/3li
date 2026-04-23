import { useEffect, useMemo, useRef } from "react";
import { Boxes, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, LayoutList, Trash2, Ungroup } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import { zReorderWouldChange } from "@/features/brainstorm/utils/nodeLayout";
import { cn } from "@/lib/utils";

type BrainstormCanvasContextMenuProps = {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
};

export function BrainstormCanvasContextMenu({ open, x, y, onClose }: BrainstormCanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const nodes = useBrainstormStore((s) => s.nodes);
  const groupSelectedNodes = useBrainstormStore((s) => s.groupSelectedNodes);
  const ungroupSelection = useBrainstormStore((s) => s.ungroupSelection);
  const organizeSelectedNodes = useBrainstormStore((s) => s.organizeSelectedNodes);
  const deleteSelectedNodes = useBrainstormStore((s) => s.deleteSelectedNodes);
  const reorderSelectedZIndex = useBrainstormStore((s) => s.reorderSelectedZIndex);

  const selected = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedIds = useMemo(() => new Set(selected.map((n) => n.id)), [selected]);

  const canGroup = selected.length >= 2;

  const canUngroup = useMemo(() => {
    for (const n of nodes) {
      if (n.type === "shape" && n.selected && nodes.some((c) => c.parentId === n.id)) {
        return true;
      }
    }
    for (const n of selected) {
      if (n.parentId) {
        const p = nodes.find((x) => x.id === n.parentId);
        if (p?.type === "shape") return true;
      }
    }
    return false;
  }, [nodes, selected]);

  const canOrganize = useMemo(() => {
    if (selected.length === 0) return false;
    const same = selected.every((n) => n.parentId === selected[0]!.parentId);
    if (same) return true;
    return selected.some((n) => !n.parentId);
  }, [selected]);

  const canDelete = selected.length > 0;

  const canBringForward = useMemo(
    () => zReorderWouldChange(nodes, selectedIds, "forward"),
    [nodes, selectedIds],
  );
  const canSendBackward = useMemo(
    () => zReorderWouldChange(nodes, selectedIds, "backward"),
    [nodes, selectedIds],
  );
  const canBringToFront = useMemo(
    () => zReorderWouldChange(nodes, selectedIds, "front"),
    [nodes, selectedIds],
  );
  const canSendToBack = useMemo(
    () => zReorderWouldChange(nodes, selectedIds, "back"),
    [nodes, selectedIds],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => {
      const el = menuRef.current;
      if (!el || el.contains(ev.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const menuW = 248;
  const left = Math.max(8, Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1200) - menuW - 8));
  const top = Math.max(8, Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 800) - 8));

  return (
    <div
      ref={menuRef}
      role="menu"
      className={cn(
        "fixed z-[200] min-w-[12rem] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
      )}
      style={{ left, top, width: menuW }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-start gap-2 px-2 font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={!canDelete}
        onClick={() => {
          deleteSelectedNodes();
          onClose();
        }}
      >
        <Trash2 className="size-4 shrink-0 opacity-70" aria-hidden />
        Delete
      </Button>

      <Separator className="my-1" />

      <p className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Order</p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-start gap-2 px-2 font-normal"
        disabled={!canBringForward}
        onClick={() => {
          reorderSelectedZIndex("forward");
          onClose();
        }}
      >
        <ChevronUp className="size-4 shrink-0 opacity-70" aria-hidden />
        Bring forward
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-start gap-2 px-2 font-normal"
        disabled={!canSendBackward}
        onClick={() => {
          reorderSelectedZIndex("backward");
          onClose();
        }}
      >
        <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
        Send backward
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-start gap-2 px-2 font-normal"
        disabled={!canBringToFront}
        onClick={() => {
          reorderSelectedZIndex("front");
          onClose();
        }}
      >
        <ChevronsUp className="size-4 shrink-0 opacity-70" aria-hidden />
        Bring to front
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-start gap-2 px-2 font-normal"
        disabled={!canSendToBack}
        onClick={() => {
          reorderSelectedZIndex("back");
          onClose();
        }}
      >
        <ChevronsDown className="size-4 shrink-0 opacity-70" aria-hidden />
        Send to back
      </Button>

      <Separator className="my-1" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-start gap-2 px-2 font-normal"
        disabled={!canGroup}
        onClick={() => {
          groupSelectedNodes();
          onClose();
        }}
      >
        <Boxes className="size-4 shrink-0 opacity-70" aria-hidden />
        Group
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-start gap-2 px-2 font-normal"
        disabled={!canUngroup}
        onClick={() => {
          ungroupSelection();
          onClose();
        }}
      >
        <Ungroup className="size-4 shrink-0 opacity-70" aria-hidden />
        Ungroup
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-start gap-2 px-2 font-normal"
        disabled={!canOrganize}
        onClick={() => {
          organizeSelectedNodes();
          onClose();
        }}
      >
        <LayoutList className="size-4 shrink-0 opacity-70" aria-hidden />
        Organize by type
      </Button>
      <p className="px-2 pb-1 pt-0.5 text-[10px] leading-snug text-muted-foreground">
        Backspace/Delete removes the selection. Order applies among siblings on the board (or inside the same group).
      </p>
    </div>
  );
}
