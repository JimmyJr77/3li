import { BoxSelect, ImagePlus, Maximize2, Plus, Shapes, Table2, TextCursor, Workflow } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { readImageFileAsDataUrl } from "@/features/brainstorm/readImageDataUrl";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import { cn } from "@/lib/utils";

/** Canvas palette: session bar row, or a vertical strip for full-screen mode (`layout="presentation"`). */
export function BrainstormCanvasTools({ layout }: { layout?: "default" | "presentation" }) {
  const presentation = layout === "presentation";
  const imageInputRef = useRef<HTMLInputElement>(null);
  const addIdeaNode = useBrainstormStore((s) => s.addIdeaNode);
  const shapePickerOpen = useBrainstormStore((s) => s.shapePickerOpen);
  const setShapePickerOpen = useBrainstormStore((s) => s.setShapePickerOpen);
  const addTableNode = useBrainstormStore((s) => s.addTableNode);
  const addContainerNode = useBrainstormStore((s) => s.addContainerNode);
  const addImageNode = useBrainstormStore((s) => s.addImageNode);
  const addHierarchyNode = useBrainstormStore((s) => s.addHierarchyNode);
  const addTextFromToolbar = useBrainstormStore((s) => s.addTextFromToolbar);
  const togglePresentationMode = useBrainstormStore((s) => s.togglePresentationMode);
  const presentationMode = useBrainstormStore((s) => s.presentationMode);
  const agentsPanelVisible = useBrainstormStore((s) => s.agentsPanelVisible);
  const setAgentsPanelVisible = useBrainstormStore((s) => s.setAgentsPanelVisible);

  const btn = presentation ? "h-9 w-full justify-start gap-2 px-3 text-xs" : "gap-1";

  return (
    <div className={cn("flex flex-col gap-2", presentation && "min-h-0")}>
      <p
        className={
          presentation ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" : "text-xs font-medium text-muted-foreground"
        }
      >
        Canvas tools
      </p>
      <div className={cn("flex gap-2", presentation ? "flex-col" : "flex-wrap")}>
        <Button type="button" size="sm" variant="secondary" className={btn} onClick={() => addIdeaNode()}>
          <Plus className="size-4" />
          Add idea
        </Button>
        <Button
          type="button"
          size="sm"
          variant={shapePickerOpen ? "secondary" : "outline"}
          className={btn}
          title="Open the shape gallery, then pick what to place on the board."
          onClick={() => setShapePickerOpen(!shapePickerOpen)}
        >
          <Shapes className="size-4" />
          Shape
        </Button>
        <Button type="button" size="sm" variant="outline" className={btn} onClick={() => addHierarchyNode()}>
          <Workflow className="size-4" />
          Hierarchy
        </Button>
        <Button type="button" size="sm" variant="outline" className={btn} onClick={() => addTableNode()}>
          <Table2 className="size-4" />
          Table
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={btn}
          title="Resizable frame on the bottom layer. Drag items onto it to group them; they move with the frame."
          onClick={() => addContainerNode()}
        >
          <BoxSelect className="size-4" />
          Container
        </Button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const src = await readImageFileAsDataUrl(file);
              addImageNode({ src, alt: file.name.replace(/\.[^/.]+$/, "") });
            } catch (err) {
              window.alert(err instanceof Error ? err.message : "Could not add image.");
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={btn}
          title="Add an image from a file (or drag an image onto the canvas)."
          onClick={() => imageInputRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          Image
        </Button>
        <Button type="button" size="sm" variant="outline" className={btn} onClick={() => addTextFromToolbar()}>
          <TextCursor className="size-4" />
          Text
        </Button>
        <Button type="button" size="sm" variant="outline" className={btn} onClick={() => togglePresentationMode()}>
          <Maximize2 className="size-4" />
          {presentationMode ? "Exit full screen" : "Full screen"}
        </Button>
      </div>
      {presentation ? (
        <div className="flex items-start gap-2 border-t border-border pt-3">
          <input
            id="brainstorm-canvas-tools-agents"
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 rounded border border-input"
            checked={agentsPanelVisible}
            onChange={(e) => setAgentsPanelVisible(e.target.checked)}
          />
          <Label htmlFor="brainstorm-canvas-tools-agents" className="text-xs font-normal leading-snug">
            Show Brainstorm Agents (side sheet)
          </Label>
        </div>
      ) : null}
    </div>
  );
}
