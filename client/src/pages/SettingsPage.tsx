import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Check,
  Keyboard,
  LayoutPanelLeft,
  Loader2,
  MousePointerClick,
  Palette,
  Tags,
  User,
  Users,
} from "lucide-react";
import { ModeToggle } from "@/components/shared/ModeToggle";
import { AdminUserAccountsSettingsSection } from "@/components/settings/AdminUserAccountsSettingsSection";
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
import { changePassword, fetchMe, logout, patchProfile, type AuthUser } from "@/features/auth/api";
import { formatUsPhoneInput } from "@/lib/phoneUs";
import { formatApiError } from "@/lib/apiErrorMessage";
import { useDebouncedAutosave } from "@/hooks/useDebouncedAutosave";
import { cn } from "@/lib/utils";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { UserTicketLabelsPanel } from "@/features/taskflow/UserTicketLabelsPanel";

type GeneralSettingsCategoryId =
  | "profile"
  | "brand"
  | "ticket-labels"
  | "shortcuts"
  | "appearance"
  | "layout"
  | "user-accounts";

type SettingsCategoryId = GeneralSettingsCategoryId | WorkspacePageSettingsId;

const GENERAL_SETTINGS_NAV: {
  id: Exclude<GeneralSettingsCategoryId, "user-accounts">;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "brand", label: "Brands", icon: Building2 },
  { id: "ticket-labels", label: "Ticket labels", icon: Tags },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "layout", label: "Workspace layout", icon: LayoutPanelLeft },
];

const ADMIN_SETTINGS_NAV_ITEM = {
  id: "user-accounts" as const satisfies GeneralSettingsCategoryId,
  label: "User accounts",
};

function settingsCategoryLabel(id: SettingsCategoryId): string {
  if (id === "user-accounts") return ADMIN_SETTINGS_NAV_ITEM.label;
  const general = GENERAL_SETTINGS_NAV.find((c) => c.id === id);
  if (general) return general.label;
  const page = WORKSPACE_PAGE_SETTINGS.find((p) => p.id === id);
  return page?.label ?? "Settings";
}

function isValidSettingsCategoryId(id: string, isAdmin: boolean): id is SettingsCategoryId {
  if (id === "user-accounts") return isAdmin;
  return isWorkspacePageSettingsId(id) || GENERAL_SETTINGS_NAV.some((c) => c.id === id);
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

type AccountDraft = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
};

function profileAuthSyncKey(user: AuthUser) {
  return [
    user.id,
    user.username,
    user.email,
    user.phone ?? "",
    user.firstName ?? "",
    user.lastName ?? "",
    user.displayName ?? "",
  ].join("\0");
}

function ProfileAndAccountCard({ authUser }: { authUser: AuthUser }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [accountDraft, setAccountDraft] = useState<AccountDraft>(() => ({
    username: authUser.username,
    email: authUser.email,
    firstName: authUser.firstName ?? "",
    lastName: authUser.lastName ?? "",
    displayName: authUser.displayName ?? "",
  }));
  const [phoneDisplay, setPhoneDisplay] = useState(() => formatUsPhoneInput(authUser.phone ?? ""));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const accountDirty = useMemo(() => {
    const phone = formatUsPhoneInput(phoneDisplay);
    return (
      accountDraft.username.trim() !== authUser.username ||
      accountDraft.email.trim() !== authUser.email ||
      phone !== (authUser.phone ?? "") ||
      (accountDraft.firstName.trim() || "") !== (authUser.firstName ?? "") ||
      (accountDraft.lastName.trim() || "") !== (authUser.lastName ?? "") ||
      (accountDraft.displayName.trim() || "") !== (authUser.displayName ?? "")
    );
  }, [authUser, accountDraft, phoneDisplay]);

  const profileSaveMut = useMutation({
    mutationFn: async () => {
      const phone = formatUsPhoneInput(phoneDisplay);
      const digits = phone.replace(/\D/g, "");
      if (digits.length !== 10) {
        throw new Error("Enter a complete US phone number (10 digits).");
      }
      return patchProfile({
        username: accountDraft.username.trim(),
        email: accountDraft.email.trim(),
        phone,
        firstName: accountDraft.firstName.trim(),
        lastName: accountDraft.lastName.trim(),
        displayName: accountDraft.displayName.trim() ? accountDraft.displayName.trim() : null,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  const profileDraftKey = useMemo(
    () =>
      JSON.stringify({
        ...accountDraft,
        phone: formatUsPhoneInput(phoneDisplay),
      }),
    [accountDraft, phoneDisplay],
  );

  const profileAutosavePrereqs =
    formatUsPhoneInput(phoneDisplay).replace(/\D/g, "").length === 10 &&
    accountDraft.username.trim().length >= 3;

  useDebouncedAutosave({
    enabled: profileAutosavePrereqs,
    dirty: accountDirty,
    isPending: profileSaveMut.isPending,
    onFlush: () => profileSaveMut.mutate(),
    resetKey: profileDraftKey,
  });

  const passwordMut = useMutation({
    mutationFn: async () => {
      if (newPassword !== newPassword2) {
        throw new Error("New password and confirmation do not match.");
      }
      await changePassword(currentPassword, newPassword);
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setNewPassword2("");
    },
  });

  useEffect(() => {
    if (accountDirty) {
      profileSaveMut.reset();
    }
  }, [accountDirty, profileSaveMut]);

  useEffect(() => {
    passwordMut.reset();
  }, [currentPassword, newPassword, newPassword2, passwordMut]);

  const logoutMut = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/login");
    },
  });

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground"
          aria-hidden
        >
          {initialsFromProfile(accountDraft.displayName, accountDraft.email)}
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="acct-first">First name</Label>
              <Input
                id="acct-first"
                autoComplete="given-name"
                value={accountDraft.firstName}
                onChange={(e) => setAccountDraft((d) => ({ ...d, firstName: e.target.value }))}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acct-last">Last name</Label>
              <Input
                id="acct-last"
                autoComplete="family-name"
                value={accountDraft.lastName}
                onChange={(e) => setAccountDraft((d) => ({ ...d, lastName: e.target.value }))}
                maxLength={80}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="acct-display">Display name</Label>
            <Input
              id="acct-display"
              autoComplete="name"
              placeholder="Shown in the product"
              value={accountDraft.displayName}
              onChange={(e) => setAccountDraft((d) => ({ ...d, displayName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acct-email">Email</Label>
            <Input
              id="acct-email"
              type="email"
              autoComplete="email"
              value={accountDraft.email}
              onChange={(e) => setAccountDraft((d) => ({ ...d, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acct-phone">Mobile phone (US)</Label>
            <Input
              id="acct-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="555-123-4567"
              value={phoneDisplay}
              onChange={(e) => setPhoneDisplay(formatUsPhoneInput(e.target.value))}
              aria-describedby="acct-phone-hint"
            />
            <p id="acct-phone-hint" className="text-xs text-muted-foreground">
              Stored as ###-###-#### (10 digits).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="acct-username">Username</Label>
            <Input
              id="acct-username"
              autoComplete="username"
              value={accountDraft.username}
              onChange={(e) => setAccountDraft((d) => ({ ...d, username: e.target.value }))}
              minLength={3}
              maxLength={32}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              3–32 characters: letters, digits, or underscore. Matching is case-insensitive.
            </p>
          </div>
          {authUser.role === "admin" ? (
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Administrator account</p>
          ) : null}
          {profileSaveMut.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {formatApiError(profileSaveMut.error, "Could not save profile")}
            </p>
          ) : null}
          {profileSaveMut.isPending ? (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
              Saving…
            </p>
          ) : null}
          {!profileSaveMut.isPending && accountDirty && profileAutosavePrereqs ? (
            <p className="text-sm text-muted-foreground">Unsaved changes — will save automatically.</p>
          ) : null}
          {!profileSaveMut.isPending && accountDirty && !profileAutosavePrereqs ? (
            <p className="text-sm text-muted-foreground">
              Complete a valid US phone (10 digits) and username (3+ characters) to autosave.
            </p>
          ) : null}
          {profileSaveMut.isSuccess && !accountDirty ? (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Profile saved
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        <div>
          <p className="text-sm font-medium text-foreground">Password</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your current password, then choose a new one (3–15 characters; any mix of letters, numbers, and
            symbols).
          </p>
        </div>
        <div className="grid max-w-md gap-4">
          <div className="space-y-2">
            <Label htmlFor="acct-cur-pw">Current password</Label>
            <Input
              id="acct-cur-pw"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acct-new-pw">New password</Label>
            <Input
              id="acct-new-pw"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={3}
              maxLength={15}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acct-new-pw2">Confirm new password</Label>
            <Input
              id="acct-new-pw2"
              type="password"
              autoComplete="new-password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              minLength={3}
              maxLength={15}
            />
          </div>
          {passwordMut.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {formatApiError(passwordMut.error, "Could not change password")}
            </p>
          ) : null}
          {passwordMut.isSuccess ? (
            <p className="text-sm text-muted-foreground">Password updated.</p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={
              passwordMut.isPending ||
              !currentPassword ||
              !newPassword ||
              newPassword.length < 3 ||
              newPassword.length > 15 ||
              !newPassword2
            }
            onClick={() => passwordMut.mutate()}
          >
            {passwordMut.isPending ? "Updating…" : "Update password"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-6">
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
    </>
  );
}

export function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarBehavior, setSidebarBehavior } = useWorkspacePrefs();
  const { activeWorkspace } = useActiveWorkspace();
  const { data: authUser } = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });

  const deepLinkCategory = useMemo(() => {
    const raw = (location.state as { settingsCategory?: unknown } | null)?.settingsCategory;
    if (typeof raw !== "string") return null;
    return isValidSettingsCategoryId(raw, authUser?.role === "admin") ? raw : null;
  }, [location.state, authUser?.role]);

  const [manualCategory, setManualCategory] = useState<SettingsCategoryId>("profile");

  const category: SettingsCategoryId = deepLinkCategory ?? manualCategory;

  const selectCategory = (id: SettingsCategoryId) => {
    setManualCategory(id);
    const s = location.state as Record<string, unknown> | null;
    if (s && typeof s === "object" && "settingsCategory" in s) {
      const next: Record<string, unknown> = { ...s };
      delete next.settingsCategory;
      navigate(".", { replace: true, state: next });
    }
  };

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
          ) : category === "user-accounts" ? (
            authUser?.role === "admin" ? (
              <AdminUserAccountsSettingsSection currentUser={authUser} />
            ) : (
              <Card className="w-full">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    Administrator access is required to manage user accounts.
                  </p>
                </CardContent>
              </Card>
            )
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
                    Profile &amp; account
                  </CardTitle>
                  <CardDescription>
                    These fields are stored with your login and autosave while you edit (after a short pause). Password
                    changes apply immediately when you submit the password form and keep you signed in on this device.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  {!authUser ? (
                    <p className="text-sm text-muted-foreground">Sign in to manage your account from this page.</p>
                  ) : (
                    <ProfileAndAccountCard key={profileAuthSyncKey(authUser)} authUser={authUser} />
                  )}
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

            {category === "ticket-labels" && (
              <>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tags className="size-4 opacity-70" aria-hidden />
                    Ticket labels
                  </CardTitle>
                  <CardDescription>
                    Custom labels are saved to your account for the{" "}
                    <span className="font-medium text-foreground">
                      {activeWorkspace?.brandName ?? "active brand"}
                    </span>{" "}
                    workspace. They appear on every project board in that brand. Board-specific labels are still
                    managed on each board.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UserTicketLabelsPanel brandId={activeWorkspace?.brandId} mode="manage" />
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
                  onClick={() => selectCategory(id)}
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
            {authUser?.role === "admin" ? (
              <li key={ADMIN_SETTINGS_NAV_ITEM.id} className="shrink-0 lg:w-full">
                <button
                  type="button"
                  onClick={() => selectCategory(ADMIN_SETTINGS_NAV_ITEM.id)}
                  aria-pressed={category === ADMIN_SETTINGS_NAV_ITEM.id}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    category === ADMIN_SETTINGS_NAV_ITEM.id
                      ? "bg-muted font-medium text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Users className="size-4 shrink-0 opacity-70" aria-hidden />
                  <span className="whitespace-nowrap lg:whitespace-normal">{ADMIN_SETTINGS_NAV_ITEM.label}</span>
                </button>
              </li>
            ) : null}
          </ul>

          <p className="mb-2 mt-5 hidden text-xs font-medium uppercase tracking-wide text-muted-foreground lg:block">
            Workspace pages
          </p>
          <ul className="mt-2 flex flex-row gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:mt-0 lg:flex-col lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
            {WORKSPACE_PAGE_SETTINGS.map(({ id, label, icon: Icon }) => (
              <li key={id} className="shrink-0 lg:w-full">
                <button
                  type="button"
                  onClick={() => selectCategory(id)}
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
