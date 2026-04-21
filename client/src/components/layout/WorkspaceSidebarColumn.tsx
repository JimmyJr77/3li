import { Fragment } from "react";
import { Link, NavLink } from "react-router-dom";
import { workspaceNavSections } from "@/config/workspaceNav";
import { ModeToggle } from "@/components/shared/ModeToggle";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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

export { WorkspaceNav };

/** Desktop sidebar: brand, nav, public link, theme toggle. */
export function WorkspaceSidebarColumn() {
  return (
    <>
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
    </>
  );
}
