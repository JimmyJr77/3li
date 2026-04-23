import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchContextInstructions,
  patchContextInstructions,
  type ContextInstructionsDto,
} from "@/features/taskflow/api";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const textareaClass = cn(
  "min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

export function AgentContextSettingsCard() {
  const qc = useQueryClient();
  const { activeWorkspaceId, activeWorkspace } = useActiveWorkspace();
  const [team, setTeam] = useState("");
  const [user, setUser] = useState("");

  const q = useQuery({
    queryKey: ["context-instructions", activeWorkspaceId],
    queryFn: () => fetchContextInstructions(activeWorkspaceId!),
    enabled: !!activeWorkspaceId,
  });

  useEffect(() => {
    if (!q.data) return;
    setTeam(q.data.teamContextInstructions);
    setUser(q.data.userContextInstructions);
  }, [q.data]);

  const mut = useMutation({
    mutationFn: (body: { teamContextInstructions?: string; userContextInstructions?: string }) =>
      patchContextInstructions(activeWorkspaceId!, body),
    onSuccess: (data: ContextInstructionsDto) => {
      setTeam(data.teamContextInstructions);
      setUser(data.userContextInstructions);
      void qc.invalidateQueries({ queryKey: ["context-instructions", activeWorkspaceId] });
    },
  });

  if (!activeWorkspaceId) {
    return null;
  }

  const dirty =
    q.data &&
    (team !== q.data.teamContextInstructions || user !== q.data.userContextInstructions);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-amber-500" aria-hidden />
          Agent context
        </CardTitle>
        <CardDescription>
          Team rules override individual preferences for the Consultant Agent and other LLM calls. Applies to{" "}
          <span className="font-medium text-foreground">{activeWorkspace?.name ?? "this workspace"}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : q.isError ? (
          <p className="text-sm text-destructive">Could not load context instructions.</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="team-context">Team context</Label>
              <p className="text-xs text-muted-foreground">
                Shared methodology and mandatory rules for everyone working this brand.
              </p>
              <textarea
                id="team-context"
                className={textareaClass}
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="e.g. engagement standards, filing rules, definition of done…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-context">Individual context</Label>
              <p className="text-xs text-muted-foreground">
                Your working style and frameworks for this workspace. Team context wins on conflict.
              </p>
              <textarea
                id="user-context"
                className={textareaClass}
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="How you like to run meetings, preferred frameworks, personal checklists…"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!dirty || mut.isPending}
                onClick={() => mut.mutate({ teamContextInstructions: team, userContextInstructions: user })}
              >
                {mut.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  "Save context"
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
