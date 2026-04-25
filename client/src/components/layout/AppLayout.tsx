import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { ModeToggle } from "@/components/shared/ModeToggle";
import { WorkspaceBrandSwitcher } from "@/components/layout/WorkspaceBrandSwitcher";
import { WorkspaceNav, WorkspaceSidebarColumn } from "@/components/layout/WorkspaceSidebarColumn";
import { ActiveWorkspaceProvider } from "@/context/ActiveWorkspaceContext";
import { ArchivesVisibilityProvider } from "@/context/ArchivesVisibilityContext";
import { ShowArchivesFooter } from "@/components/layout/ShowArchivesFooter";
import { MailroomRoutingProvider, useMailroomRouting } from "@/context/MailroomRoutingContext";
import { RoutingToastProvider } from "@/context/RoutingToastContext";
import { NotesWorkspaceShortcutsProvider } from "@/features/notes/NotesWorkspaceShortcutsProvider";
import { MailroomRoutingDialog } from "@/features/notes/MailroomRoutingDialog";
import { WorkspacePrefsProvider, useWorkspacePrefs } from "@/context/WorkspacePrefsContext";
import { BrandWorkspaceEntryDialog } from "@/components/layout/BrandWorkspaceEntryDialog";
import { cn } from "@/lib/utils";

function AppLayoutInner() {
  const { sidebarBehavior } = useWorkspacePrefs();
  const { mailroomOpen, setMailroomOpen } = useMailroomRouting();
  const pinned = sidebarBehavior === "pinned";
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);
  const desktopSidebarAsideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!desktopSidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDesktopSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [desktopSidebarOpen]);

  useEffect(() => {
    if (desktopSidebarOpen || pinned) return;
    const root = desktopSidebarAsideRef.current;
    if (!root?.contains(document.activeElement)) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, [desktopSidebarOpen, pinned]);

  return (
    <div className="flex min-h-screen flex-col">
      <aside className="border-b bg-sidebar md:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <WorkspaceBrandSwitcher className="text-sm" showDropdown />
          <div className="flex items-center gap-1">
            <ModeToggle />
          </div>
        </div>
        <WorkspaceNav
          navClassName="flex gap-1 overflow-x-auto px-2 pb-2"
          separatorMobile
        />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
        {pinned ? (
          <aside
            className="fixed inset-y-0 left-0 z-50 hidden w-56 flex-col border-r border-sidebar-border bg-sidebar shadow-lg md:flex md:flex-col"
            aria-label="Workspace"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <WorkspaceSidebarColumn />
            </div>
          </aside>
        ) : (
          <>
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
                ref={desktopSidebarAsideRef}
                className={cn(
                  "flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar shadow-lg transition-transform duration-200 ease-out",
                  desktopSidebarOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
                )}
                inert={desktopSidebarOpen ? undefined : true}
              >
                <WorkspaceSidebarColumn />
              </aside>
            </div>
          </>
        )}

        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            pinned && "md:pl-56",
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 lg:p-8">
            <div className="min-h-0 flex-1">
              <Outlet />
            </div>
            <ShowArchivesFooter />
          </div>
        </div>
      </div>
      <BrandWorkspaceEntryDialog />
      <MailroomRoutingDialog open={mailroomOpen} onOpenChange={setMailroomOpen} />
    </div>
  );
}

export function AppLayout() {
  return (
    <WorkspacePrefsProvider>
      <ActiveWorkspaceProvider>
        <ArchivesVisibilityProvider>
          <NotesWorkspaceShortcutsProvider>
            <MailroomRoutingProvider>
              <RoutingToastProvider>
                <AppLayoutInner />
              </RoutingToastProvider>
            </MailroomRoutingProvider>
          </NotesWorkspaceShortcutsProvider>
        </ArchivesVisibilityProvider>
      </ActiveWorkspaceProvider>
    </WorkspacePrefsProvider>
  );
}
