import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * PNGs live in `client/public/workspace-previews/` and are served at `/workspace-previews/<name>.png`.
 * Bump this when replacing screenshots so browsers don’t keep stale cached images.
 */
const WORKSPACE_PREVIEW_ASSET_VERSION = "6";

/** Relatable marketing blurbs for the Solutions page hero (not shown on the dashboard grid). */
const workspaceMarketing = {
  "rapid-router": {
    headline: "Catch a thought and send it to the right home—before it slips away.",
    highlights: [
      "Drop in a note the moment it hits you—no hunting for the “right” app first.",
      "Route it to your backlog, notes, or brainstorm with a couple of taps.",
      "Stops the “where did I save that?” loop that eats your evening.",
    ],
    ai: "Optional smarts can suggest a destination from the way you wrote it—like a quick second opinion, not autopilot.",
  },
  activity: {
    headline:
      "Activity Tracker — who did what on tasks in the active brand workspace.",
    highlights: [
      "See teammate moves alongside yours, like a lightweight audit trail.",
      "Spot what changed on tasks without opening every board.",
      "Scoped to this brand workspace so you only see relevant work.",
    ],
    ai: undefined,
  },
  "task-lists": {
    headline: "One master list for everything you owe—across every project.",
    highlights: [
      "Everything on your plate in a single place, like a chore chart for real work.",
      "Check things off from one view instead of tab-hopping.",
      "Harder for small asks to hide on another screen.",
    ],
    ai: undefined,
  },
  boards: {
    headline: "Project boards that feel like sticky notes on a wall—except they stay in sync.",
    highlights: [
      "Move cards across stages so the whole team sees the same picture.",
      "Start from templates instead of a blank canvas every time.",
      "Friendly if you’ve ever used a Kanban or Trello-style board.",
    ],
    ai: undefined,
  },
  calendar: {
    headline: "A month-at-a-glance view for when things are due—not a separate life admin.",
    highlights: [
      "Spot heavy weeks before they land on you.",
      "Due dates stay tied to real work, not random sticky notes.",
      "Plan around deadlines you already committed to.",
    ],
    ai: undefined,
  },
  brainstorm: {
    headline: "Structure for when you’re stuck staring at a blank page.",
    highlights: [
      "Turn fuzzy ideas into lists you can act on.",
      "Helpful when you’re thinking alone or with a group.",
      "Promote the best bits into tasks when you’re ready—not before.",
    ],
    ai: "Helpful prompts and structure so ideation stays grounded instead of drifting.",
  },
  notes: {
    headline: "A shared place for “how we do things” that isn’t buried in email.",
    highlights: [
      "Write it once; find it later without a scavenger hunt.",
      "Keeps know-how out of one person’s head—or one inbox thread.",
      "Your team’s lightweight filing cabinet, searchable when you need it.",
    ],
    ai: undefined,
  },
  chat: {
    headline: "Ask questions with your workspace in the room—not a generic chatbot in a vacuum.",
    highlights: [
      "Answers that can lean on your notes, tasks, and context you already saved.",
      "Suggests sensible next steps instead of dumping a wall of text.",
      "Runs with guardrails on the server side so your org’s rules still matter.",
    ],
    ai: "Retrieval-aware assistant: grounded in what you’ve actually stored, with task-aware follow-through.",
  },
  settings: {
    headline: "Dial in how the workspace feels—and what it’s allowed to touch.",
    highlights: [
      "Tame notifications so the tool works for you, not the other way around.",
      "See what’s connected and adjust without a engineering degree.",
      "You stay in charge of preferences and integrations.",
    ],
    ai: undefined,
  },
} as const;

/** Preview filenames under `/public/workspace-previews/` (PNG screenshots of each tool). */
export const workspaceDashboardHomeTiles = [
  {
    title: "Rapid Router",
    to: "/app/rapid-router",
    body: "Capture text and route it to backlog, notes, or brainstorm.",
    preview: "rapid-router",
  },
  {
    title: "Activity Tracker",
    to: "/app/notifications",
    body: "Team task activity for the active brand workspace in one place.",
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
    title: "Brainstorm",
    to: "/app/brainstorm",
    body: "Studio boards and structured ideation.",
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

type WorkspaceDashboardHomeGridProps = {
  className?: string;
  /** Compact 5-across picker + hero; for Solutions tab only. Dashboard uses default. */
  variant?: "default" | "solutions";
};

function WorkspaceSolutionsPicker({ className }: { className?: string }) {
  const [selected, setSelected] = useState(0);
  const tile = workspaceDashboardHomeTiles[selected];
  const marketing = workspaceMarketing[tile.preview as keyof typeof workspaceMarketing];

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border bg-muted shadow-sm">
          <img
            key={`${tile.preview}-hero-${WORKSPACE_PREVIEW_ASSET_VERSION}`}
            src={workspacePreviewSrc(tile.preview)}
            alt={`${tile.title} — larger preview`}
            className="absolute inset-0 h-full w-full object-cover object-top"
            loading="eager"
            decoding="async"
          />
        </div>
        <div className="min-w-0 space-y-4">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">{tile.title}</h3>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">{marketing.headline}</p>
          </div>
          <ul className="space-y-2.5 text-sm leading-relaxed text-foreground/90">
            {marketing.highlights.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {marketing.ai ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm leading-relaxed">
              <span className="font-medium text-foreground">AI in this area: </span>
              <span className="text-muted-foreground">{marketing.ai}</span>
            </div>
          ) : null}
          <Link
            to={tile.to}
            className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open in workspace →
          </Link>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        role="radiogroup"
        aria-label="Choose a workspace area to preview"
      >
        {workspaceDashboardHomeTiles.map((t, i) => {
          const isSelected = i === selected;
          return (
            <button
              key={t.to}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(i)}
              className={cn(
                "group flex w-full min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-left shadow-sm outline-none transition-all",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isSelected
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "hover:border-primary/40 hover:shadow-md",
              )}
            >
              <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
                <img
                  src={workspacePreviewSrc(t.preview)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.03]"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="border-t px-1.5 py-1.5 sm:px-2 sm:py-2">
                <p className="line-clamp-2 text-[11px] font-medium leading-tight sm:text-xs">{t.title}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkspaceDashboardHomeGrid({ className, variant = "default" }: WorkspaceDashboardHomeGridProps) {
  if (variant === "solutions") {
    return <WorkspaceSolutionsPicker className={className} />;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
        className,
      )}
    >
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
