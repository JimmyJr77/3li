import {
  Bell,
  BookOpen,
  CalendarDays,
  Goal,
  Home,
  LayoutGrid,
  Lightbulb,
  ListTodo,
  MessageSquare,
  Settings,
  StickyNote,
  Zap,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { ModeToggle } from "@/components/shared/ModeToggle";
import { RapidRouterIcon } from "@/components/shared/RapidRouterIcon";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const workspaceNavSections = [
  {
    items: [
      { to: "/app/dashboard", label: "Home", icon: Home },
      { to: "/app/notifications", label: "Activity", icon: Bell },
      { to: "/app/goals", label: "Brand Center", icon: Goal },
    ],
  },
  {
    items: [
      { to: "/app/rapid-router", label: "Rapid Router", icon: RapidRouterIcon },
      { to: "/app/notes", label: "Notes", icon: StickyNote },
      { to: "/app/brainstorm", label: "Brainstorm", icon: Lightbulb },
      { to: "/app/boards", label: "Boards", icon: LayoutGrid },
      { to: "/app/my-tasks", label: "Task Lists", icon: ListTodo },
      { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    items: [
      { to: "/app/automations", label: "Automations", icon: Zap },
      { to: "/app/chat", label: "Chat", icon: MessageSquare },
    ],
  },
  {
    items: [
      { to: "/app/docs", label: "Docs", icon: BookOpen },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

function WorkspaceNav({
  navClassName,
  separatorMobile,
}: {
  navClassName: string;
  separatorMobile: boolean;
}) {
  return (
    <nav className={navClassName} aria-label="Workspace">
      {workspaceNavSections.map((section, sectionIndex) => (
        <Fragment key={sectionIndex}>
          {sectionIndex > 0 ? (
            <>
              {separatorMobile ? (
                <Separator
                  orientation="vertical"
                  className="mx-1 h-7 shrink-0 self-center md:hidden"
                />
              ) : null}
              <Separator className={cn("my-2", separatorMobile ? "hidden md:block" : "block")} orientation="horizontal" />
            </>
          ) : null}
          {section.items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </Fragment>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);

  useEffect(() => {
    if (!desktopSidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDesktopSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [desktopSidebarOpen]);

  return (
    <div className="flex min-h-screen flex-col">
      <aside className="border-b bg-sidebar md:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link to="/app/dashboard" className="font-semibold tracking-tight">
            3LI Workspace
          </Link>
          <div className="flex items-center gap-1">
            <ModeToggle />
          </div>
        </div>
        <WorkspaceNav
          navClassName="flex gap-1 overflow-x-auto px-2 pb-2"
          separatorMobile
        />
      </aside>

      {/* Desktop: hover the left screen edge to reveal; leaving the drawer closes it */}
      <div
        className={cn(
          "fixed top-0 left-0 z-50 hidden h-full overflow-hidden transition-[width] duration-200 ease-out md:block",
          desktopSidebarOpen ? "w-56" : "w-3",
        )}
        onMouseEnter={() => setDesktopSidebarOpen(true)}
        onMouseLeave={() => setDesktopSidebarOpen(false)}
      >
        <aside
          className={cn(
            "flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar shadow-lg transition-transform duration-200 ease-out",
            desktopSidebarOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
          )}
          aria-hidden={!desktopSidebarOpen}
        >
          <div className="px-3 pt-4 pb-3">
            <Link to="/app/dashboard" className="text-sm font-semibold tracking-tight">
              3LI Workspace
            </Link>
          </div>
          <Separator />
          <WorkspaceNav navClassName="flex flex-col gap-0 px-2 pt-0 pb-0" separatorMobile={false} />
          <div className="mt-auto px-3 pb-4">
            <Separator className="my-3" />
            <div className="flex flex-col gap-2">
              <Link
                to="/"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                ← Public site
              </Link>
              <ModeToggle />
            </div>
          </div>
        </aside>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
