import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialsFromDisplayName } from "./fastTaskFilterUtils";
import { useFastTaskMetaStore, type FastTaskMember } from "./fastTaskMetaStore";

export function FastTaskAssigneeStrip({
  workspaceKey,
  noteId,
  members,
}: {
  workspaceKey: string;
  noteId: string;
  members: FastTaskMember[];
}) {
  const assign = useFastTaskMetaStore((s) => s.workspaces[workspaceKey]?.assigns[noteId]);
  const setAssignAll = useFastTaskMetaStore((s) => s.setAssignAll);
  const toggleAssignee = useFastTaskMetaStore((s) => s.toggleAssignee);
  const addMember = useFastTaskMetaStore((s) => s.addMember);

  const resolved = assign ?? { assignAll: true, assigneeIds: [] as string[] };
  const [addOpen, setAddOpen] = useState(false);
  const [draftName, setDraftName] = useState("");

  const lookup = (id: string) => members.find((m) => m.id === id);

  const maxShown = 5;
  const ids = resolved.assignAll ? [] : resolved.assigneeIds;
  const shownIds = ids.slice(0, maxShown);
  const overflow = ids.length - shownIds.length;

  return (
    <>
      <div className="mt-3 flex shrink-0 flex-col gap-1.5 border-t border-border pt-3">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Assignees</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-10 justify-start gap-1 p-1 hover:bg-muted/60"
              aria-label="Edit assignees"
            >
              <div className="flex flex-wrap items-center gap-1">
                {resolved.assignAll ? (
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-primary"
                    title="Universal — everyone"
                  >
                    <Users className="size-4" aria-hidden />
                  </span>
                ) : (
                  <>
                    {shownIds.map((id, i) => {
                      const m = lookup(id);
                      const abb = m ? initialsFromDisplayName(m.displayName) : "?";
                      return (
                        <span
                          key={id}
                          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-semibold text-foreground"
                          style={{ marginLeft: i > 0 ? -6 : 0 }}
                          title={m?.displayName ?? id}
                        >
                          {abb}
                        </span>
                      );
                    })}
                    {overflow > 0 ? (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-background text-[10px] font-medium text-muted-foreground">
                        +{overflow}
                      </span>
                    ) : null}
                  </>
                )}
                <span className="ms-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground">
                  <Plus className="size-4" aria-hidden />
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start" side="top">
            <DropdownMenuLabel>Assignment</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={resolved.assignAll}
              onCheckedChange={(c) => setAssignAll(workspaceKey, noteId, Boolean(c))}
            >
              All (universal list)
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
              Team members
            </DropdownMenuLabel>
            {members.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Add a teammate below.</div>
            ) : (
              members.map((m) => (
                <DropdownMenuCheckboxItem
                  key={m.id}
                  checked={!resolved.assignAll && resolved.assigneeIds.includes(m.id)}
                  disabled={resolved.assignAll}
                  onCheckedChange={(c) => toggleAssignee(workspaceKey, noteId, m.id, Boolean(c))}
                >
                  {m.displayName}
                </DropdownMenuCheckboxItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setAddOpen(true);
              }}
            >
              Add teammate…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>Add teammate</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fast-task-new-member">Name</Label>
            <Input
              id="fast-task-new-member"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="e.g. Alex Kim"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const name = draftName.trim();
                if (!name) return;
                addMember(workspaceKey, name);
                setDraftName("");
                setAddOpen(false);
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
