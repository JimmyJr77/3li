import { BrainstormEdgeToolbar } from "@/features/brainstorm/components/BrainstormEdgeToolbar";
import { BrainstormNodeToolbar } from "@/features/brainstorm/components/BrainstormNodeToolbar";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";

/** Top-right panel: node inspector when something is selected, otherwise edge link editor. */
export function BrainstormCanvasInspector() {
  const nodes = useBrainstormStore((s) => s.nodes);
  const selected = nodes.filter((n) => n.selected);
  if (selected.length > 0) {
    return <BrainstormNodeToolbar selected={selected} />;
  }
  return <BrainstormEdgeToolbar />;
}
