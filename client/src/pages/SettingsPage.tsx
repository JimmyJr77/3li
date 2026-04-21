import type { ReactNode } from "react";
import { Keyboard, LayoutPanelLeft, MousePointerClick, User } from "lucide-react";
import { ModeToggle } from "@/components/shared/ModeToggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useWorkspacePrefs, type SidebarBehavior } from "@/context/WorkspacePrefsContext";
import { cn } from "@/lib/utils";

function initialsFromProfile(displayName: string, email: string) {
  const t = displayName.trim();
  if (t) {
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }
    return t.slice(0, 2).toUpperCase();
  }
  const e = email.trim();
  if (e) return e.slice(0, 2).toUpperCase();
  return "?";
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-border bg-muted px-2 font-mono text-xs font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function ShortcutRow({
  title,
  description,
  keys,
}: {
  title: string;
  description: string;
  keys: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">{keys}</div>
    </div>
  );
}

function SidebarOptionCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: typeof LayoutPanelLeft;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full gap-3 rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:bg-muted/40",
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

export function SettingsPage() {
  const { profile, updateProfile, sidebarBehavior, setSidebarBehavior } = useWorkspacePrefs();

  const setMode = (mode: SidebarBehavior) => setSidebarBehavior(mode);

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Workspace layout, appearance, and your profile. Theme controls also stay in the sidebar and
          mobile header.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4 opacity-70" aria-hidden />
              Your profile
            </CardTitle>
            <CardDescription>
              Shown in the workspace where your name appears. Stored on this device only (demo sign-in).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div
                className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground"
                aria-hidden
              >
                {initialsFromProfile(profile.displayName, profile.email)}
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-display-name">Display name</Label>
                  <Input
                    id="profile-display-name"
                    autoComplete="name"
                    placeholder="Alex Morgan"
                    value={profile.displayName}
                    onChange={(e) => updateProfile({ displayName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={profile.email}
                    onChange={(e) => updateProfile({ email: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Shortcuts</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Keyboard className="size-4 opacity-70" aria-hidden />
              Keyboard shortcuts
            </CardTitle>
            <CardDescription>
              These work anywhere in the workspace after Notebooks has finished loading. macOS uses ⌘; Windows and
              Linux use Ctrl.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ShortcutRow
              title="Notes command palette"
              description="Search notes, create a note, open quick capture, or apply a template."
              keys={
                <>
                  <Kbd>⌘</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>K</Kbd>
                  <span className="px-1 text-xs text-muted-foreground">or</span>
                  <Kbd>Ctrl</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>K</Kbd>
                </>
              }
            />
            <ShortcutRow
              title="Quick capture"
              description="Open the side sheet to jot a title and note body into your default or current notebook."
              keys={
                <>
                  <Kbd>⌘</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>⇧</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>C</Kbd>
                  <span className="px-1 text-xs text-muted-foreground">or</span>
                  <Kbd>Ctrl</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>⇧</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>C</Kbd>
                </>
              }
            />
            <ShortcutRow
              title="Rapid Router — send capture"
              description="When focus is in the Capture field on Rapid Router, submit the same as the Send button (if routing is ready)."
              keys={
                <>
                  <Kbd>⌘</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>↵</Kbd>
                  <span className="px-1 text-xs text-muted-foreground">or</span>
                  <Kbd>Ctrl</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>Enter</Kbd>
                </>
              }
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Appearance</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Color mode</CardTitle>
            <CardDescription>Same options as the theme control in the workspace chrome.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Choose light, dark, vibrant, rainbow, or system.</p>
            <div className="flex shrink-0 items-center gap-2">
              <ModeToggle />
              <span className="text-sm text-muted-foreground">Theme</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Workspace layout</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sidebar</CardTitle>
            <CardDescription>
              On large screens, keep the nav docked beside your content or tuck it away until you hover
              the left edge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SidebarOptionCard
              selected={sidebarBehavior === "pinned"}
              onSelect={() => setMode("pinned")}
              icon={LayoutPanelLeft}
              title="Always visible"
              description="The sidebar stays open and the main workspace resizes beside it — nothing slides over your content."
            />
            <SidebarOptionCard
              selected={sidebarBehavior === "overlay"}
              onSelect={() => setMode("overlay")}
              icon={MousePointerClick}
              title="Hide until needed"
              description="Move the pointer to the left edge to open the sidebar; it floats above the page."
            />
          </CardContent>
        </Card>
      </section>

      <Separator />

      <p className="text-center text-xs text-muted-foreground">
        Preferences save automatically in this browser.
      </p>
    </div>
  );
}
