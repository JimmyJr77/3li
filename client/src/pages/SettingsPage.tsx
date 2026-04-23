import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Keyboard,
  LayoutPanelLeft,
  MousePointerClick,
  Palette,
  User,
} from "lucide-react";
import { ModeToggle } from "@/components/shared/ModeToggle";
import { AgentContextSettingsCard } from "@/components/settings/AgentContextSettingsCard";
import { BrandsSettingsCardParts } from "@/components/settings/BrandProjectSettingsSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { WorkspacePageSettingsCard } from "@/components/settings/WorkspacePageSettingsCard";
import {
  WORKSPACE_PAGE_SETTINGS,
  isWorkspacePageSettingsId,
  type WorkspacePageSettingsId,
} from "@/config/workspacePageSettings";
import { useWorkspacePrefs, type SidebarBehavior } from "@/context/WorkspacePrefsContext";
import { fetchMe, logout } from "@/features/auth/api";
import { cn } from "@/lib/utils";

type GeneralSettingsCategoryId = "profile" | "brand" | "shortcuts" | "appearance" | "layout";

type SettingsCategoryId = GeneralSettingsCategoryId | WorkspacePageSettingsId;

const GENERAL_SETTINGS_NAV: {
  id: GeneralSettingsCategoryId;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "brand", label: "Brands", icon: Building2 },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "layout", label: "Workspace layout", icon: LayoutPanelLeft },
];

function settingsCategoryLabel(id: SettingsCategoryId): string {
  const general = GENERAL_SETTINGS_NAV.find((c) => c.id === id);
  if (general) return general.label;
  const page = WORKSPACE_PAGE_SETTINGS.find((p) => p.id === id);
  return page?.label ?? "Settings";
}

function isGeneralSettingsCategoryId(id: string): id is GeneralSettingsCategoryId {
  return GENERAL_SETTINGS_NAV.some((c) => c.id === id);
}

function isValidSettingsCategoryId(id: string): id is SettingsCategoryId {
  return isWorkspacePageSettingsId(id) || isGeneralSettingsCategoryId(id);
}

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
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile, updateProfile, sidebarBehavior, setSidebarBehavior } = useWorkspacePrefs();
  const [category, setCategory] = useState<SettingsCategoryId>("profile");
  const { data: authUser } = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });
  const logoutMut = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/login");
    },
  });

  useEffect(() => {
    const raw = (location.state as { settingsCategory?: unknown } | null)?.settingsCategory;
    if (typeof raw === "string" && isValidSettingsCategoryId(raw)) {
      setCategory(raw);
    }
  }, [location.state]);

  const setMode = (mode: SidebarBehavior) => setSidebarBehavior(mode);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Workspace layout, appearance, and your profile. Theme controls also stay in the sidebar and mobile header.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-8 lg:flex-row lg:items-start lg:gap-10">
        <div className="min-w-0 flex-1">
          {isWorkspacePageSettingsId(category) ? (
            <WorkspacePageSettingsCard pageId={category} />
          ) : category === "brand" ? (
            <div
              role="region"
              aria-live="polite"
              aria-label={settingsCategoryLabel(category)}
              className="space-y-8"
            >
              <BrandsSettingsCardParts />
              <AgentContextSettingsCard />
            </div>
          ) : (
          <Card
            className="w-full"
            role="region"
            aria-live="polite"
            aria-label={settingsCategoryLabel(category)}
          >
            {category === "profile" && (
              <>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="size-4 opacity-70" aria-hidden />
                    Your profile
                  </CardTitle>
                  <CardDescription>
                    Local display preferences below. Your account username is managed on the server when you sign in.
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
                  {authUser ? (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <div>
                        <p className="text-sm font-medium">Account</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Signed in as{" "}
                          <span className="font-medium text-foreground">{authUser.username}</span>
                          {authUser.displayName ? ` (${authUser.displayName})` : null}
                          {authUser.role === "admin" ? (
                            <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                              Admin
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {authUser.email}
                          {authUser.phone ? ` · ${authUser.phone}` : null}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={logoutMut.isPending}
                        onClick={() => logoutMut.mutate()}
                      >
                        {logoutMut.isPending ? "Signing out…" : "Sign out"}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </>
            )}

            {category === "shortcuts" && (
              <>
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
              </>
            )}

            {category === "appearance" && (
              <>
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
              </>
            )}

            {category === "layout" && (
              <>
                <CardHeader>
                  <CardTitle className="text-base">Sidebar</CardTitle>
                  <CardDescription>
                    On large screens, keep the nav docked beside your content or tuck it away until you hover the left
                    edge.
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
              </>
            )}
          </Card>
          )}

          <Separator className="my-8" />

          <p className="text-center text-xs text-muted-foreground">
            Preferences save automatically in this browser.
          </p>
        </div>

        <nav
          className="shrink-0 lg:sticky lg:top-6 lg:w-56"
          aria-label="Settings categories"
        >
          <p className="mb-2 hidden text-xs font-medium uppercase tracking-wide text-muted-foreground lg:block">
            General
          </p>
          <ul className="flex flex-row gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
            {GENERAL_SETTINGS_NAV.map(({ id, label, icon: Icon }) => (
              <li key={id} className="shrink-0 lg:w-full">
                <button
                  type="button"
                  onClick={() => setCategory(id)}
                  aria-pressed={category === id}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    category === id
                      ? "bg-muted font-medium text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
                  <span className="whitespace-nowrap lg:whitespace-normal">{label}</span>
                </button>
              </li>
            ))}
          </ul>

          <p className="mb-2 mt-5 hidden text-xs font-medium uppercase tracking-wide text-muted-foreground lg:block">
            Workspace pages
          </p>
          <ul className="mt-2 flex flex-row gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:mt-0 lg:flex-col lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
            {WORKSPACE_PAGE_SETTINGS.map(({ id, label, icon: Icon }) => (
              <li key={id} className="shrink-0 lg:w-full">
                <button
                  type="button"
                  onClick={() => setCategory(id)}
                  aria-pressed={category === id}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    category === id
                      ? "bg-muted font-medium text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
                  <span className="whitespace-nowrap lg:whitespace-normal">{label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
