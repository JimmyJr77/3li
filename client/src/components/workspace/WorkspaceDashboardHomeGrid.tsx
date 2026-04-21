import { Link } from "react-router-dom";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * PNGs live in `client/public/workspace-previews/` and are served at `/workspace-previews/<name>.png`.
 * Bump this when replacing screenshots so browsers don’t keep stale cached images.
 */
const WORKSPACE_PREVIEW_ASSET_VERSION = "6";

/** Preview filenames under `/public/workspace-previews/` (PNG screenshots of each tool). */
export const workspaceDashboardHomeTiles = [
  {
    title: "Rapid Router",
    to: "/app/rapid-router",
    body: "Capture text and route it to backlog, notes, or brainstorm.",
    preview: "rapid-router",
  },
  {
    title: "Activity",
    to: "/app/notifications",
    body: "Workspace task activity feed.",
    preview: "activity",
  },
  {
    title: "Task Lists",
    to: "/app/my-tasks",
    body: "All tasks across project boards.",
    preview: "task-lists",
  },
  {
    title: "Project Boards",
    to: "/app/boards",
    body: "Project spaces, templates, and Trello-style project boards.",
    preview: "boards",
  },
  {
    title: "Calendar",
    to: "/app/calendar",
    body: "Due dates on a month grid.",
    preview: "calendar",
  },
  {
    title: "Brainstorm Studio",
    to: "/app/brainstorm",
    body: "Structured ideation.",
    preview: "brainstorm",
  },
  {
    title: "Notebooks",
    to: "/app/notes",
    body: "Knowledge base.",
    preview: "notes",
  },
  {
    title: "AI Consultant",
    to: "/app/chat",
    body: "Structured consulting chat with retrieval and tasks (server-side).",
    preview: "chat",
  },
  {
    title: "Settings",
    to: "/app/settings",
    body: "Workspace preferences.",
    preview: "settings",
  },
] as const;

function workspacePreviewSrc(preview: string) {
  const base = import.meta.env.BASE_URL;
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}workspace-previews/${preview}.png?v=${WORKSPACE_PREVIEW_ASSET_VERSION}`;
}

export function WorkspaceDashboardHomeGrid({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3", className)}>
      {workspaceDashboardHomeTiles.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className="group flex w-full min-w-0 cursor-pointer flex-col rounded-xl text-inherit no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Card className="flex h-full flex-col gap-0 overflow-hidden py-0 shadow-sm transition-shadow duration-300 ease-out group-hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.22),0_8px_20px_-8px_rgba(0,0,0,0.1)] dark:group-hover:shadow-[0_22px_56px_-12px_rgba(0,0,0,0.65),0_10px_24px_-10px_rgba(0,0,0,0.45)]">
            {/* Fixed aspect for previews — size does not change with title/description length */}
            <div className="relative aspect-[14/9] w-full shrink-0 overflow-hidden bg-muted">
              <img
                key={`${t.preview}-${WORKSPACE_PREVIEW_ASSET_VERSION}`}
                src={workspacePreviewSrc(t.preview)}
                alt={`${t.title} preview`}
                className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                loading="eager"
                decoding="async"
              />
            </div>
            <CardHeader className="gap-1.5 px-4 py-3">
              <CardTitle className="line-clamp-2 text-lg leading-snug">{t.title}</CardTitle>
              <CardDescription className="line-clamp-3 text-sm leading-snug">{t.body}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
