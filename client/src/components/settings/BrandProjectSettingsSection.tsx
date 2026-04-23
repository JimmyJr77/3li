import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Building2, LayoutGrid, Loader2, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createBrand,
  fetchBrandTree,
  patchBoard,
  patchBrand,
  patchProjectSpace,
  patchWorkspace,
} from "@/features/taskflow/api";
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
  const { setActiveWorkspaceId } = useActiveWorkspace();
  const brandsQuery = useQuery({
    queryKey: ["brands-tree"],
    queryFn: fetchBrandTree,
  });
  const brandTree = brandsQuery.data ?? [];
  const [newBrandName, setNewBrandName] = useState("");

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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4 opacity-70" aria-hidden />
          Brands
        </CardTitle>
        <CardDescription>
          Set each brand&apos;s name and the workspace name shown at the top of the sidebar for that brand. Visual
          identity and kit live in{" "}
          <Link to="/app/brand-center" className="font-medium text-primary underline-offset-4 hover:underline">
            Brand Center
          </Link>
          . Manage project spaces and boards under{" "}
          <span className="font-medium text-foreground">Project spaces &amp; boards</span> in the category list.
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
          <ul className="divide-y divide-border rounded-lg border border-border">
            {brandTree.map((b) => {
              const w = b.workspaces[0];
              const defaultWorkspaceHint = defaultWorkspaceTitleFromBrandName(b.name);
              return (
                <li
                  key={b.id}
                  className="space-y-4 px-4 py-4 first:rounded-t-[calc(var(--radius)-1px)] last:rounded-b-[calc(var(--radius)-1px)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label className="text-xs text-muted-foreground">Brand name</Label>
                      <BrandNameRow brandId={b.id} brandName={b.name} />
                    </div>
                    <ArchiveBrandRowButton brandId={b.id} label={b.name} />
                  </div>
                  {w ? (
                    <div className="space-y-2 border-t border-border pt-4">
                      <Label htmlFor={`workspace-name-${w.id}`} className="text-xs text-muted-foreground">
                        Workspace name
                      </Label>
                      <WorkspaceNameField workspaceId={w.id} serverName={w.name} />
                      <p className="text-xs text-muted-foreground">
                        Appears at the top of the workspace sidebar. Default when unchanged:{" "}
                        <span className="font-medium text-foreground">{defaultWorkspaceHint}</span>.
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

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
