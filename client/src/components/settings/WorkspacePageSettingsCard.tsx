import { Link } from "react-router-dom";
import {
  WORKSPACE_PAGE_SETTINGS,
  type WorkspacePageSettingsId,
} from "@/config/workspacePageSettings";
import { WorkspaceProjectSpacesSettingsBody } from "@/components/settings/BrandProjectSettingsSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NoteEditorToolbarSettings } from "@/components/settings/NoteEditorToolbarSettings";
import { BrainstormStudioSettings } from "@/features/brainstorm/components/BrainstormStudioSettings";

export function WorkspacePageSettingsCard({ pageId }: { pageId: WorkspacePageSettingsId }) {
  const cfg = WORKSPACE_PAGE_SETTINGS.find((p) => p.id === pageId);
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <Card
      className="w-full"
      role="region"
      aria-live="polite"
      aria-label={`${cfg.label} settings`}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 opacity-70" aria-hidden />
          {cfg.label}
        </CardTitle>
        <CardDescription>{cfg.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to={cfg.to}>Open {cfg.label}</Link>
        </Button>

        {cfg.id === "wp-notes" ? (
          <div className="border-t border-border pt-6">
            <NoteEditorToolbarSettings />
          </div>
        ) : cfg.id === "wp-boards" ? (
          <div className="border-t border-border pt-6">
            <WorkspaceProjectSpacesSettingsBody />
          </div>
        ) : cfg.id === "wp-brainstorm" ? (
          <BrainstormStudioSettings />
        ) : (
          <p className="text-sm text-muted-foreground">
            Tool-specific preferences will appear here as each workspace area grows.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
