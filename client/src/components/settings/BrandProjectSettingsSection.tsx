import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Building2, Copy, LayoutGrid, Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createBrand,
  createBrandInvites,
  fetchBrandTeam,
  fetchBrandTree,
  joinBrandWithKey,
  patchBoard,
  patchBrand,
  patchProjectSpace,
  patchWorkspace,
  regenerateBrandJoinKey,
  removeBrandMember,
  revokeBrandInvite,
} from "@/features/taskflow/api";
import type { BrandInviteCreatedDto, BrandTreeDto } from "@/features/taskflow/types";
import { formatApiError } from "@/lib/apiErrorMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultWorkspaceTitleFromBrandName,
  WORKSPACE_NAME_MAX_LENGTH,
} from "@/lib/workspaceConstants";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";

export function WorkspaceNameField({ workspaceId, serverName }: { workspaceId: string; serverName: string }) {
  const qc = useQueryClient();
  const [v, setV] = useState(serverName);
  useEffect(() => setV(serverName), [serverName]);

  const mut = useMutation({
    mutationFn: (name: string) => patchWorkspace(workspaceId, { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
      void qc.invalidateQueries({ queryKey: ["brands-tree"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["notes-app", "bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["chat-bootstrap"] });
    },
    onError: () => setV(serverName),
  });

  return (
    <Input
      id={`workspace-name-${workspaceId}`}
      value={v}
      maxLength={WORKSPACE_NAME_MAX_LENGTH}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const t = v.trim();
        if (!t || t === serverName) return;
        mut.mutate(t);
      }}
      disabled={mut.isPending}
      className="h-9"
      aria-label="Workspace name"
    />
  );
}

function ProjectSpaceNameField({ projectSpaceId, serverName }: { projectSpaceId: string; serverName: string }) {
  const qc = useQueryClient();
  const [v, setV] = useState(serverName);
  useEffect(() => setV(serverName), [serverName]);

  const mut = useMutation({
    mutationFn: (name: string) => patchProjectSpace(projectSpaceId, { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
      void qc.invalidateQueries({ queryKey: ["brands-tree"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: () => setV(serverName),
  });

  return (
    <Input
      id={`project-space-name-${projectSpaceId}`}
      value={v}
      maxLength={WORKSPACE_NAME_MAX_LENGTH}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const t = v.trim();
        if (!t || t === serverName) return;
        mut.mutate(t);
      }}
      disabled={mut.isPending}
      className="h-9"
      aria-label="Project space name"
    />
  );
}

function BoardNameField({ boardId, serverName }: { boardId: string; serverName: string }) {
  const qc = useQueryClient();
  const [v, setV] = useState(serverName);
  useEffect(() => setV(serverName), [serverName]);

  const mut = useMutation({
    mutationFn: (name: string) => patchBoard(boardId, { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
      void qc.invalidateQueries({ queryKey: ["brands-tree"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["board", boardId] });
    },
    onError: () => setV(serverName),
  });

  return (
    <Input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const t = v.trim();
        if (!t || t === serverName) return;
        mut.mutate(t);
      }}
      disabled={mut.isPending}
      className="h-8 min-w-0 flex-1 text-sm"
      aria-label="Project board name"
    />
  );
}

function ArchiveProjectSpaceButton({ projectSpaceId, label }: { projectSpaceId: string; label: string }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => patchProjectSpace(projectSpaceId, { archived: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
      void qc.invalidateQueries({ queryKey: ["brands-tree"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={mut.isPending}
      onClick={() => {
        if (window.confirm(`Archive project space “${label}”? Boards in it will be archived from the default lists.`)) {
          mut.mutate();
        }
      }}
    >
      <Archive className="size-3.5" aria-hidden />
      Archive
    </Button>
  );
}

function ArchiveBoardButton({ boardId, label }: { boardId: string; label: string }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => patchBoard(boardId, { archived: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
      void qc.invalidateQueries({ queryKey: ["brands-tree"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 shrink-0 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={mut.isPending}
      onClick={() => {
        if (window.confirm(`Archive board “${label}”?`)) {
          mut.mutate();
        }
      }}
    >
      <Archive className="size-3.5" aria-hidden />
      Archive
    </Button>
  );
}

function ProjectSpaceBlock({
  projectSpaceId,
  name,
  boards,
}: {
  projectSpaceId: string;
  name: string;
  boards: { id: string; name: string; position: number }[];
}) {
  return (
    <li className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project space</p>
        <ArchiveProjectSpaceButton projectSpaceId={projectSpaceId} label={name} />
      </div>

      <div className="mt-3 space-y-2">
        <Label htmlFor={`project-space-name-${projectSpaceId}`}>Name</Label>
        <ProjectSpaceNameField projectSpaceId={projectSpaceId} serverName={name} />
      </div>

      <div className="mt-6 space-y-2">
        <p className="text-sm font-medium text-foreground">Project boards</p>
        {boards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No boards in this project space yet.</p>
        ) : (
          <ul className="space-y-2">
            {boards.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                <span className="min-w-0 shrink-0 text-xs text-muted-foreground sm:w-24">Board</span>
                <BoardNameField boardId={b.id} serverName={b.name} />
                <ArchiveBoardButton boardId={b.id} label={b.name} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function BrandNameRow({ brandId, brandName }: { brandId: string; brandName: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(brandName);
  useEffect(() => setDraft(brandName), [brandName]);

  const renameMut = useMutation({
    mutationFn: (next: string) => patchBrand(brandId, { name: next }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
      void qc.invalidateQueries({ queryKey: ["brands-tree"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["notes-app", "bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["chat-bootstrap"] });
      setEditing(false);
    },
    onError: () => {
      setDraft(brandName);
      setEditing(false);
    },
  });

  const commit = () => {
    const t = draft.trim();
    if (!t) {
      setDraft(brandName);
      setEditing(false);
      return;
    }
    if (t === brandName) {
      setEditing(false);
      return;
    }
    renameMut.mutate(t);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      {editing ? (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={WORKSPACE_NAME_MAX_LENGTH}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(brandName);
              setEditing(false);
            }
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          className="h-9"
          autoFocus
          disabled={renameMut.isPending}
          aria-label="Edit brand name"
        />
      ) : (
        <>
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{brandName}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Edit brand name"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        </>
      )}
    </div>
  );
}

function BrandJoinKeyRow({
  joinKey,
  brandRowId,
  isOwner,
}: {
  joinKey: string;
  brandRowId: string;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const regenMut = useMutation({
    mutationFn: () => regenerateBrandJoinKey(brandRowId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["brands-tree"] });
      void qc.invalidateQueries({ queryKey: ["brand-team", brandRowId] });
    },
  });

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Join key</span>
        <code className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
          {joinKey}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={async () => {
            await navigator.clipboard.writeText(joinKey);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Copy className="size-3" aria-hidden />
          {copied ? "Copied" : "Copy"}
        </Button>
        {isOwner ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={regenMut.isPending}
            title="Invalidate the current key and issue a new one if it was leaked"
            onClick={() => {
              if (
                window.confirm(
                  "Regenerate this join key? Anyone with the old key will no longer be able to use it to join.",
                )
              ) {
                regenMut.mutate();
              }
            }}
          >
            <RefreshCw className={`size-3 ${regenMut.isPending ? "animate-spin" : ""}`} aria-hidden />
            Regenerate
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Share this key or use email invites under Team access. The internal database id is not used for joining.
      </p>
    </div>
  );
}

function JoinBrandWithKeyPanel({ onJoined }: { onJoined: (brandId: string) => void }) {
  const qc = useQueryClient();
  const { setActiveWorkspaceId } = useActiveWorkspace();
  const [joinKeyInput, setJoinKeyInput] = useState("");

  const joinMut = useMutation({
    mutationFn: () => joinBrandWithKey(joinKeyInput.trim()),
    onSuccess: async (data) => {
      setJoinKeyInput("");
      await qc.refetchQueries({ queryKey: ["brands-tree"] });
      await qc.refetchQueries({ queryKey: ["workspaces"] });
      onJoined(data.brandId);
      if (data.workspaceId) {
        setActiveWorkspaceId(data.workspaceId);
      }
    },
  });

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/15 p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        <span className="font-medium text-foreground">Join a brand</span>
        <span className="text-muted-foreground">—</span>
        <button
          type="button"
          className="font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => document.getElementById("settings-join-brand-key")?.focus()}
        >
          Paste a join key
        </button>
        <span className="text-muted-foreground">from the owner (same access as an email invite).</span>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="settings-join-brand-key">Brand join key</Label>
          <Input
            id="settings-join-brand-key"
            placeholder="Paste key here"
            value={joinKeyInput}
            onChange={(e) => setJoinKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && joinKeyInput.trim() && !joinMut.isPending) {
                joinMut.mutate();
              }
            }}
            className="h-9 font-mono text-sm"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0 self-start sm:self-end"
          disabled={joinMut.isPending || !joinKeyInput.trim()}
          onClick={() => joinMut.mutate()}
        >
          {joinMut.isPending ? "Joining…" : "Join brand"}
        </Button>
      </div>
      {joinMut.isError ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {formatApiError(joinMut.error, "Could not join with that key")}
        </p>
      ) : null}
    </div>
  );
}

function BrandTeamAccessSection({ brand }: { brand: BrandTreeDto }) {
  const qc = useQueryClient();
  const teamQuery = useQuery({
    queryKey: ["brand-team", brand.id],
    queryFn: () => fetchBrandTeam(brand.id),
  });
  const [emailsText, setEmailsText] = useState("");
  const [lastCreated, setLastCreated] = useState<BrandInviteCreatedDto[] | null>(null);

  const inviteMut = useMutation({
    mutationFn: () => {
      const emails = emailsText
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!emails.length) {
        throw new Error("Enter at least one email address.");
      }
      return createBrandInvites(brand.id, emails);
    },
    onSuccess: (data) => {
      setEmailsText("");
      setLastCreated(data.created);
      void qc.invalidateQueries({ queryKey: ["brand-team", brand.id] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (inviteId: string) => revokeBrandInvite(brand.id, inviteId),
    onSuccess: async () => {
      void qc.invalidateQueries({ queryKey: ["brand-team", brand.id] });
    },
  });

  const removeMemberMut = useMutation({
    mutationFn: (userId: string) => removeBrandMember(brand.id, userId),
    onSuccess: async () => {
      void qc.invalidateQueries({ queryKey: ["brand-team", brand.id] });
      void qc.invalidateQueries({ queryKey: ["brands-tree"] });
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  if (teamQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Loading team…
      </div>
    );
  }
  if (teamQuery.isError) {
    return (
      <p className="border-t border-border pt-4 text-xs text-destructive">Could not load team for this brand.</p>
    );
  }
  const team = teamQuery.data;

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team access</p>
      {brand.youAreOwner ? (
        <p className="text-xs text-muted-foreground">
          Invite by email below, or share the <span className="font-medium text-foreground">join key</span> above so
          someone can use <span className="font-medium text-foreground">Join a brand</span> in Settings.
        </p>
      ) : null}
      {!brand.youAreOwner ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Shared with you</span> — you can use this brand workspace as a
          team member. Owner:{" "}
          <span className="font-medium text-foreground">{team?.owner.label ?? "—"}</span>{" "}
          <span className="text-xs">({team?.owner.email ?? ""})</span>.
        </p>
      ) : (
        <>
          <ul className="space-y-2 text-sm">
            <li className="flex flex-wrap gap-2 border-b border-border pb-2">
              <span className="text-muted-foreground">Owner</span>
              <span className="ml-auto font-medium text-foreground">{team?.owner.label}</span>
              <span className="w-full text-xs text-muted-foreground sm:w-auto sm:ml-2">{team?.owner.email}</span>
            </li>
            {team?.members.map((m) => (
              <li
                key={m.membershipId}
                className="flex flex-col gap-2 border-b border-border py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={removeMemberMut.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove ${m.label} from this brand team?`)) {
                      removeMemberMut.mutate(m.userId);
                    }
                  }}
                >
                  Remove access
                </Button>
              </li>
            ))}
          </ul>
          {team?.pendingInvites.length ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Pending invites</p>
              <ul className="space-y-2">
                {team.pendingInvites.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{inv.email}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={revokeMut.isPending}
                      onClick={() => revokeMut.mutate(inv.id)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`invite-emails-${brand.id}`}>Invite collaborators</Label>
            <textarea
              id={`invite-emails-${brand.id}`}
              className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="teammate@company.com, another@company.com"
              value={emailsText}
              onChange={(e) => {
                setEmailsText(e.target.value);
                setLastCreated(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Separate addresses with spaces, commas, or new lines. This build does not send email automatically —
              copy the generated links and send them with your own mail or chat.
            </p>
            {inviteMut.isError ? (
              <p className="text-xs text-destructive" role="alert">
                {formatApiError(inviteMut.error, "Could not create invites")}
              </p>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={inviteMut.isPending || !emailsText.trim()}
              onClick={() => inviteMut.mutate()}
            >
              {inviteMut.isPending ? "Creating…" : "Create invite links"}
            </Button>
            {lastCreated && lastCreated.length > 0 ? (
              <ul className="space-y-3 rounded-md border border-border bg-muted/20 p-3 text-xs">
                {lastCreated.map((row) => (
                  <li key={row.email} className="space-y-1">
                    <p className="font-medium text-foreground">{row.email}</p>
                    <p className="break-all text-muted-foreground">
                      <span className="font-medium text-foreground">Open invite: </span>
                      {row.landingUrl}
                    </p>
                    <p className="break-all text-muted-foreground">
                      <span className="font-medium text-foreground">Register directly: </span>
                      {row.registerUrl}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function ArchiveBrandRowButton({ brandId, label }: { brandId: string; label: string }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => patchBrand(brandId, { archived: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
      void qc.invalidateQueries({ queryKey: ["brands-tree"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["notes-app", "bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["brainstorm"] });
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={mut.isPending}
      onClick={() => {
        if (window.confirm(`Archive brand “${label}”? Its workspace and project spaces will be archived.`)) {
          mut.mutate();
        }
      }}
    >
      <Archive className="size-3.5" aria-hidden />
      Archive
    </Button>
  );
}

/** Brands only: name + workspace chrome title per brand. */
export function BrandsSettingsCardParts() {
  const qc = useQueryClient();
  const { activeWorkspace, setActiveWorkspaceId } = useActiveWorkspace();
  const brandsQuery = useQuery({
    queryKey: ["brands-tree"],
    queryFn: fetchBrandTree,
  });
  const brandTree = brandsQuery.data ?? [];
  const [newBrandName, setNewBrandName] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  useEffect(() => {
    if (brandTree.length === 0) {
      setSelectedBrandId(null);
      return;
    }
    setSelectedBrandId((cur) => {
      if (cur && brandTree.some((b) => b.id === cur)) return cur;
      if (activeWorkspace?.brandId && brandTree.some((b) => b.id === activeWorkspace.brandId)) {
        return activeWorkspace.brandId;
      }
      return brandTree[0]!.id;
    });
  }, [brandTree, activeWorkspace?.brandId]);

  const createBrandMut = useMutation({
    mutationFn: (name: string) => createBrand(name),
    onSuccess: async (created) => {
      setNewBrandName("");
      // Must await so the new workspace exists in the React Query cache before switching; otherwise
      // `setActiveWorkspaceId` no-ops and the UI stays on the previous brand (looks like data "copied over").
      await qc.refetchQueries({ queryKey: ["workspaces"] });
      await qc.refetchQueries({ queryKey: ["brands-tree"] });
      const wid = created.workspaces[0]?.id;
      if (wid) {
        setActiveWorkspaceId(wid);
      }
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["notes-app"] });
      void qc.invalidateQueries({ queryKey: ["chat-bootstrap"] });
      void qc.removeQueries({ queryKey: ["brainstorm"] });
    },
  });

  const selectedBrand =
    selectedBrandId && brandTree.length > 0 ? (brandTree.find((b) => b.id === selectedBrandId) ?? null) : null;
  const selectedFirstWorkspaceId = selectedBrand?.workspaces[0]?.id ?? null;
  const isSidebarBrand = Boolean(selectedBrand && activeWorkspace?.brandId === selectedBrand.id);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4 opacity-70" aria-hidden />
          Brands
        </CardTitle>
        <CardDescription>
          Each brand has a join key and display name (duplicate names are fine). Owners can invite collaborators by
          email or share the join key — invitees keep their personal workspace and also see this brand. Set names and
          sidebar workspace titles here; visual identity lives in{" "}
          <Link to="/app/brand-center" className="font-medium text-primary underline-offset-4 hover:underline">
            Brand Center
          </Link>
          . Project spaces and boards are under{" "}
          <span className="font-medium text-foreground">Workspace pages → Project Boards</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {brandsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading brands…
          </div>
        ) : brandsQuery.isError ? (
          <p className="text-sm text-destructive">Could not load brands.</p>
        ) : brandTree.length === 0 ? (
          <p className="text-sm text-muted-foreground">No brands yet — add one below.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2 sm:max-w-md">
                <Label htmlFor="brands-settings-brand-select">Brand</Label>
                <select
                  id="brands-settings-brand-select"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedBrandId ?? ""}
                  onChange={(e) => setSelectedBrandId(e.target.value || null)}
                >
                  {brandTree.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Choose a brand to edit. This does not change the sidebar until you use the button below.
                </p>
              </div>
              {selectedBrand && selectedFirstWorkspaceId ? (
                isSidebarBrand ? (
                  <p className="shrink-0 text-xs font-medium text-muted-foreground sm:pb-2">Active in sidebar</p>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 self-start sm:self-end"
                    onClick={() => setActiveWorkspaceId(selectedFirstWorkspaceId)}
                  >
                    Use in sidebar
                  </Button>
                )
              ) : null}
            </div>

            {selectedBrand ? (
              <div className="space-y-4 rounded-lg border border-border bg-muted/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label className="text-xs text-muted-foreground">Brand name</Label>
                    <BrandNameRow brandId={selectedBrand.id} brandName={selectedBrand.name} />
                    <BrandJoinKeyRow
                      joinKey={selectedBrand.brandIdentifier ?? selectedBrand.id}
                      brandRowId={selectedBrand.id}
                      isOwner={selectedBrand.youAreOwner}
                    />
                  </div>
                  {selectedBrand.youAreOwner ? (
                    <ArchiveBrandRowButton brandId={selectedBrand.id} label={selectedBrand.name} />
                  ) : null}
                </div>
                <BrandTeamAccessSection brand={selectedBrand} />
                {selectedBrand.workspaces[0] ? (
                  <div className="space-y-2 border-t border-border pt-4">
                    <Label
                      htmlFor={`workspace-name-${selectedBrand.workspaces[0].id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Workspace name
                    </Label>
                    <WorkspaceNameField
                      workspaceId={selectedBrand.workspaces[0].id}
                      serverName={selectedBrand.workspaces[0].name}
                    />
                    <p className="text-xs text-muted-foreground">
                      Appears at the top of the workspace sidebar. Default when unchanged:{" "}
                      <span className="font-medium text-foreground">
                        {defaultWorkspaceTitleFromBrandName(selectedBrand.name)}
                      </span>
                      .
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {!brandsQuery.isLoading && !brandsQuery.isError ? (
          <JoinBrandWithKeyPanel onJoined={(brandId) => setSelectedBrandId(brandId)} />
        ) : null}

        <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="New brand name"
            value={newBrandName}
            maxLength={WORKSPACE_NAME_MAX_LENGTH}
            onChange={(e) => setNewBrandName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newBrandName.trim()) {
                createBrandMut.mutate(newBrandName.trim());
              }
            }}
            className="h-9"
            aria-label="New brand name"
          />
          <Button
            type="button"
            size="sm"
            className="shrink-0 gap-1"
            disabled={createBrandMut.isPending || !newBrandName.trim()}
            onClick={() => newBrandName.trim() && createBrandMut.mutate(newBrandName.trim())}
          >
            <Plus className="size-4" aria-hidden />
            Add brand
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Project spaces & boards for a selected brand — embed under Settings → Project Boards (does not change the active workspace). */
export function WorkspaceProjectSpacesSettingsBody() {
  const brandsQuery = useQuery({
    queryKey: ["brands-tree"],
    queryFn: fetchBrandTree,
  });
  const brandTree = brandsQuery.data ?? [];
  const { activeWorkspace } = useActiveWorkspace();
  const [reviewBrandId, setReviewBrandId] = useState<string | null>(null);

  useEffect(() => {
    if (brandTree.length === 0) {
      setReviewBrandId(null);
      return;
    }
    setReviewBrandId((cur) => {
      if (cur && brandTree.some((b) => b.id === cur)) return cur;
      if (activeWorkspace?.brandId && brandTree.some((b) => b.id === activeWorkspace.brandId)) {
        return activeWorkspace.brandId;
      }
      return brandTree[0]!.id;
    });
  }, [brandTree, activeWorkspace?.brandId]);

  const reviewedBrand = brandTree.find((b) => b.id === reviewBrandId);
  const reviewedWorkspace = reviewedBrand?.workspaces[0] ?? null;
  const ready = Boolean(reviewedBrand && reviewedWorkspace);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LayoutGrid className="size-4 opacity-70" aria-hidden />
          Project spaces &amp; boards
        </h3>
        <p className="text-sm text-muted-foreground">
          Pick a brand to review and rename its project spaces and boards. This does not switch which brand is active
          in the sidebar — use the workspace switcher or Brands settings for that.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/app/brand-center">Brand Center</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/app/boards">Project Boards</Link>
        </Button>
      </div>

      {brandsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : brandTree.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add a brand under Brands first.</p>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="settings-review-brand">Brand</Label>
            <select
              id="settings-review-brand"
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={reviewBrandId ?? ""}
              onChange={(e) => setReviewBrandId(e.target.value || null)}
            >
              {brandTree.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Showing project spaces and boards for this brand&apos;s workspace only.
            </p>
          </div>

          {!ready || !reviewedWorkspace ? (
            <p className="text-sm text-muted-foreground">Could not load workspace for this brand.</p>
          ) : reviewedWorkspace.projectSpaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No project spaces yet — add them on{" "}
              <Link to="/app/boards" className="font-medium text-primary underline-offset-4 hover:underline">
                Project Boards
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">
                {reviewedBrand?.name} — project spaces &amp; boards
              </h4>
              <ul className="space-y-6">
                {reviewedWorkspace.projectSpaces.map((ps) => (
                  <ProjectSpaceBlock
                    key={ps.id}
                    projectSpaceId={ps.id}
                    name={ps.name}
                    boards={ps.boards}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
