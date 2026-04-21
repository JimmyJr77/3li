import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Kanban, LayoutGrid, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  createBoardFromTemplate,
  createCustomBoardTemplate,
  createWorkspace,
  deleteBoardTemplate,
  fetchArchivedBoards,
  fetchArchivedWorkspaces,
  fetchBoardTemplates,
  fetchWorkspaces,
  patchBoard,
  patchWorkspace,
  reorderWorkspaces,
} from "@/features/taskflow/api";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DEFAULT_CUSTOM_COLUMNS = ["Backlog", "In progress", "Done"];

function parseBoardsDragPayload(raw: string): {
  kind?: string;
  templateId?: string;
  workspaceId?: string;
  boardId?: string;
} {
  try {
    const v = JSON.parse(raw || "{}") as Record<string, unknown>;
    return {
      kind: typeof v.kind === "string" ? v.kind : undefined,
      templateId: typeof v.templateId === "string" ? v.templateId : undefined,
      workspaceId: typeof v.workspaceId === "string" ? v.workspaceId : undefined,
      boardId: typeof v.boardId === "string" ? v.boardId : undefined,
    };
  } catch {
    return {};
  }
}

function computeWorkspaceReorder(orderedIds: string[], draggedId: string, beforeId: string): string[] {
  if (draggedId === beforeId) return orderedIds;
  const without = orderedIds.filter((id) => id !== draggedId);
  const insertBefore = without.indexOf(beforeId);
  if (insertBefore === -1) return orderedIds;
  return [...without.slice(0, insertBefore), draggedId, ...without.slice(insertBefore)];
}

export function BoardsPage() {
  const queryClient = useQueryClient();
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [columnTitles, setColumnTitles] = useState<string[]>(() => [...DEFAULT_CUSTOM_COLUMNS]);
  const [templateFormError, setTemplateFormError] = useState<string | null>(null);
  const [draggingTemplateId, setDraggingTemplateId] = useState<string | null>(null);
  const [draggingWorkspaceId, setDraggingWorkspaceId] = useState<string | null>(null);
  const [draggingBoardId, setDraggingBoardId] = useState<string | null>(null);
  const [dropTargetWorkspaceId, setDropTargetWorkspaceId] = useState<string | null>(null);
  const [workspaceReorderHoverId, setWorkspaceReorderHoverId] = useState<string | null>(null);
  const [sideStripActive, setSideStripActive] = useState(false);

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: fetchWorkspaces,
  });

  const templatesQuery = useQuery({
    queryKey: ["board-templates"],
    queryFn: fetchBoardTemplates,
  });

  const archivedWorkspacesQuery = useQuery({
    queryKey: ["archived-workspaces"],
    queryFn: fetchArchivedWorkspaces,
  });

  const workspaces = workspacesQuery.data ?? [];

  const archivedBoardQueries = useQueries({
    queries: workspaces.map((ws) => ({
      queryKey: ["archived-boards", ws.id] as const,
      queryFn: () => fetchArchivedBoards(ws.id),
      enabled: workspaces.length > 0,
    })),
  });

  const createWsMutation = useMutation({
    mutationFn: (name: string) => createWorkspace(name),
    onSuccess: () => {
      setNewWorkspaceName("");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: ({ workspaceId, templateId }: { workspaceId: string; templateId: string }) =>
      createBoardFromTemplate(workspaceId, { templateId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const restoreBoardMutation = useMutation({
    mutationFn: (boardId: string) => patchBoard(boardId, { archived: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["archived-boards"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const archiveBoardMutation = useMutation({
    mutationFn: (boardId: string) => patchBoard(boardId, { archived: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["archived-boards"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: deleteBoardTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-templates"] });
    },
  });

  const archiveWorkspaceMutation = useMutation({
    mutationFn: (id: string) => patchWorkspace(id, { archived: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["archived-workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["archived-boards"] });
    },
  });

  const restoreWorkspaceMutation = useMutation({
    mutationFn: (id: string) => patchWorkspace(id, { archived: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["archived-workspaces"] });
    },
  });

  const reorderWorkspacesMutation = useMutation({
    mutationFn: reorderWorkspaces,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      const lists = columnTitles.map((t) => t.trim()).filter(Boolean);
      if (!templateName.trim()) throw new Error("Name is required.");
      if (lists.length === 0) throw new Error("Add at least one column with a title.");
      return createCustomBoardTemplate({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        lists: lists.map((title) => ({ title })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-templates"] });
      setTemplateDialogOpen(false);
      setTemplateName("");
      setTemplateDescription("");
      setColumnTitles([...DEFAULT_CUSTOM_COLUMNS]);
      setTemplateFormError(null);
    },
    onError: (err: unknown) => {
      setTemplateFormError(err instanceof Error ? err.message : "Could not save template.");
    },
  });

  const templates = templatesQuery.data ?? [];

  const draggedTemplateSummary = draggingTemplateId
    ? templates.find((x) => x.id === draggingTemplateId)
    : undefined;
  const showTemplateTrashStrip = Boolean(draggedTemplateSummary && !draggedTemplateSummary.isBuiltin);
  const showWorkspaceArchiveStrip = Boolean(draggingWorkspaceId);
  const showBoardArchiveStrip = Boolean(draggingBoardId);
  const showArchiveStrip = showWorkspaceArchiveStrip || showBoardArchiveStrip;
  const showSideStrip = showTemplateTrashStrip || showArchiveStrip;

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Boards</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspaces group boards. Create a board from a template, then open the main board view to work.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Board templates</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Save column layouts to reuse when adding boards. Drag a template onto a workspace below. Hover for a
            light floating motion. Drag a custom template to the narrow column beside workspaces to delete it;
            built-in templates cannot be deleted.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Input
            placeholder="e.g. Design review"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && templateName.trim()) {
                setTemplateFormError(null);
                setTemplateDescription("");
                setColumnTitles([...DEFAULT_CUSTOM_COLUMNS]);
                setTemplateDialogOpen(true);
              }
            }}
            className="w-full min-w-0 sm:max-w-xs"
            aria-label="New custom template title"
          />
          <Button
            type="button"
            className="gap-1 shrink-0 self-end sm:self-auto"
            disabled={createTemplateMutation.isPending || !templateName.trim()}
            onClick={() => {
              if (!templateName.trim()) return;
              setTemplateFormError(null);
              setTemplateDescription("");
              setColumnTitles([...DEFAULT_CUSTOM_COLUMNS]);
              setTemplateDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            New custom template
          </Button>
        </div>
        <Dialog
          open={templateDialogOpen}
          onOpenChange={(open) => {
            setTemplateDialogOpen(open);
            if (open) {
              setTemplateFormError(null);
              setTemplateDescription("");
              setColumnTitles([...DEFAULT_CUSTOM_COLUMNS]);
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogTitle>New custom template</DialogTitle>
            <DialogDescription>
              Title: <span className="font-medium text-foreground">{templateName.trim() || "—"}</span>. Set
              optional details and column titles, then save.
            </DialogDescription>
            <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Description (optional)</Label>
                  <textarea
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="When to use this layout…"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Columns</Label>
                  <ul className="space-y-2">
                    {columnTitles.map((col, index) => (
                      <li key={index} className="flex gap-2">
                        <Input
                          value={col}
                          onChange={(e) => {
                            const next = [...columnTitles];
                            next[index] = e.target.value;
                            setColumnTitles(next);
                          }}
                          placeholder={`Column ${index + 1}`}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground"
                          disabled={columnTitles.length <= 1}
                          onClick={() =>
                            setColumnTitles((rows) =>
                              rows.length <= 1 ? rows : rows.filter((_, i) => i !== index),
                            )
                          }
                          aria-label="Remove column"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setColumnTitles((rows) => [...rows, ""])}
                  >
                    Add column
                  </Button>
                </div>
                {templateFormError && (
                  <p className="text-sm text-destructive">{templateFormError}</p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTemplateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="gap-2"
                    disabled={createTemplateMutation.isPending}
                    onClick={() => {
                      setTemplateFormError(null);
                      createTemplateMutation.mutate();
                    }}
                  >
                    {createTemplateMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      "Save template"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
        </Dialog>
        {templatesQuery.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading templates…
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const canDrag = workspaces.length > 0;
            const isDragging = draggingTemplateId === t.id;
            return (
              <Card
                key={t.id}
                draggable={canDrag && !createFromTemplateMutation.isPending}
                onDragStart={(e) => {
                  if (!canDrag) {
                    e.preventDefault();
                    return;
                  }
                  setDraggingTemplateId(t.id);
                  const payload = JSON.stringify({ kind: "template", templateId: t.id });
                  e.dataTransfer.setData("application/json", payload);
                  e.dataTransfer.setData("text/plain", payload);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onDragEnd={() => {
                  setDraggingTemplateId(null);
                  setDropTargetWorkspaceId(null);
                  setSideStripActive(false);
                }}
                className={cn(
                  "boards-draggable-card select-none py-0 shadow-none",
                  isDragging && "boards-draggable-card--dragging",
                  !canDrag && "cursor-not-allowed opacity-80",
                )}
                title={canDrag ? "Drag onto a workspace below" : "Create a workspace first"}
              >
                <CardHeader className="pb-4 pt-4">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <CardDescription>{t.description || "—"}</CardDescription>
                  <p className="text-xs text-muted-foreground">
                    {t.listCount} column{t.listCount === 1 ? "" : "s"} ·{" "}
                    {t.isBuiltin
                      ? "Built-in"
                      : t.workspaceId && t.workspaceName
                        ? `Custom · ${t.workspaceName}`
                        : "Custom · Any workspace"}
                  </p>
                  {!canDrag ? (
                    <p className="mt-2 text-xs text-muted-foreground">Create a workspace to enable drag.</p>
                  ) : null}
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Your workspaces</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Boards are thin cards—drag one to the narrow column to archive it. Drag a template here to add a
            board. Drag workspaces to reorder, or onto the column to archive a workspace.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Input
            placeholder="e.g. Client A"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newWorkspaceName.trim()) {
                createWsMutation.mutate(newWorkspaceName.trim());
              }
            }}
            className="w-full min-w-0 sm:max-w-xs"
            aria-label="New workspace name"
          />
          <Button
            type="button"
            className="gap-1 shrink-0 self-end sm:self-auto"
            onClick={() =>
              newWorkspaceName.trim() && createWsMutation.mutate(newWorkspaceName.trim())
            }
            disabled={createWsMutation.isPending || !newWorkspaceName.trim()}
          >
            <Plus className="size-4" />
            Add workspace
          </Button>
        </div>
        {workspacesQuery.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        )}
        {workspacesQuery.isError && (
          <p className="text-sm text-destructive">Could not load workspaces.</p>
        )}

        <div className="flex flex-col items-stretch gap-4 md:flex-row">
          {showSideStrip && (
            <div
              role="region"
              aria-label={
                showTemplateTrashStrip
                  ? "Drop to delete custom template"
                  : showBoardArchiveStrip
                    ? "Drop to archive board"
                    : "Drop to archive workspace"
              }
              className={cn(
                "flex min-h-[12rem] w-11 shrink-0 flex-col items-center justify-center self-stretch rounded-lg border-2 border-dashed px-0 py-4 transition-colors",
                sideStripActive
                  ? showTemplateTrashStrip
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-primary bg-primary/10 text-primary"
                  : "border-muted-foreground/30 bg-muted/25 text-muted-foreground",
              )}
              onDragEnter={(e) => {
                e.preventDefault();
                setSideStripActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (showTemplateTrashStrip) {
                  e.dataTransfer.dropEffect = "copy";
                } else {
                  e.dataTransfer.dropEffect = "move";
                }
                setSideStripActive(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setSideStripActive(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSideStripActive(false);
                const raw =
                  e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
                const p = parseBoardsDragPayload(raw);
                const boardIdToArchive = p.boardId ?? draggingBoardId ?? undefined;
                const workspaceIdToArchive = p.workspaceId ?? draggingWorkspaceId ?? undefined;
                const templateIdToDelete = p.templateId ?? draggingTemplateId ?? undefined;
                setDraggingTemplateId(null);
                setDraggingWorkspaceId(null);
                setDraggingBoardId(null);
                setDropTargetWorkspaceId(null);
                setWorkspaceReorderHoverId(null);
                if (boardIdToArchive) {
                  archiveBoardMutation.mutate(boardIdToArchive);
                  return;
                }
                if (workspaceIdToArchive) {
                  archiveWorkspaceMutation.mutate(workspaceIdToArchive);
                  return;
                }
                if (templateIdToDelete) {
                  const tpl = templates.find((x) => x.id === templateIdToDelete);
                  if (tpl && !tpl.isBuiltin) {
                    deleteTemplateMutation.mutate(templateIdToDelete);
                  }
                }
              }}
            >
              {showTemplateTrashStrip ? (
                <Trash2 className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
              ) : (
                <Archive className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
              )}
            </div>
          )}

          <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws, wsIndex) => {
            const archivedBoards = archivedBoardQueries[wsIndex]?.data ?? [];
            const archivedLoading = archivedBoardQueries[wsIndex]?.isLoading;
            const draggedTemplate = draggingTemplateId
              ? templates.find((x) => x.id === draggingTemplateId)
              : undefined;
            const templateDropValid = Boolean(draggedTemplate);
            const templateHighlighted = dropTargetWorkspaceId === ws.id && templateDropValid;
            const workspaceReorderHighlighted = Boolean(
              draggingWorkspaceId &&
                draggingWorkspaceId !== ws.id &&
                workspaceReorderHoverId === ws.id,
            );
            const isHighlighted = templateHighlighted || workspaceReorderHighlighted;
            const workspaceDragDisabled =
              reorderWorkspacesMutation.isPending ||
              archiveWorkspaceMutation.isPending ||
              archiveBoardMutation.isPending ||
              createFromTemplateMutation.isPending;
            const isWorkspaceDragging = draggingWorkspaceId === ws.id;

            return (
              <Card
                key={ws.id}
                draggable={!workspaceDragDisabled}
                onDragStart={(e) => {
                  if (workspaceDragDisabled) {
                    e.preventDefault();
                    return;
                  }
                  setDraggingWorkspaceId(ws.id);
                  const payload = JSON.stringify({ kind: "workspace", workspaceId: ws.id });
                  e.dataTransfer.setData("application/json", payload);
                  e.dataTransfer.setData("text/plain", payload);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDraggingWorkspaceId(null);
                  setWorkspaceReorderHoverId(null);
                  setSideStripActive(false);
                }}
                className={cn(
                  "min-w-0 select-none transition-[box-shadow,ring,opacity] duration-200",
                  !workspaceDragDisabled && "cursor-grab active:cursor-grabbing",
                  isWorkspaceDragging && "boards-draggable-card--dragging",
                  isHighlighted &&
                    "ring-primary shadow-lg ring-2 ring-offset-2 ring-offset-background",
                )}
                onDragOver={(e) => {
                  if (draggingBoardId) return;
                  if (draggingWorkspaceId) {
                    if (draggingWorkspaceId === ws.id) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setWorkspaceReorderHoverId(ws.id);
                    setDropTargetWorkspaceId(null);
                    return;
                  }
                  if (draggedTemplate) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    setDropTargetWorkspaceId(ws.id);
                    setWorkspaceReorderHoverId(null);
                  }
                }}
                onDragLeave={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX;
                  const y = e.clientY;
                  const margin = 6;
                  if (
                    x < rect.left - margin ||
                    x > rect.right + margin ||
                    y < rect.top - margin ||
                    y > rect.bottom + margin
                  ) {
                    setDropTargetWorkspaceId((cur) => (cur === ws.id ? null : cur));
                    setWorkspaceReorderHoverId((cur) => (cur === ws.id ? null : cur));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTargetWorkspaceId(null);
                  setWorkspaceReorderHoverId(null);
                  setDraggingTemplateId(null);
                  setDraggingWorkspaceId(null);
                  setDraggingBoardId(null);
                  setSideStripActive(false);
                  const raw =
                    e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
                  const p = parseBoardsDragPayload(raw);

                  if (p.boardId) return;

                  if (p.workspaceId) {
                    if (p.workspaceId === ws.id) return;
                    const next = computeWorkspaceReorder(
                      workspaces.map((w) => w.id),
                      p.workspaceId,
                      ws.id,
                    );
                    reorderWorkspacesMutation.mutate(next);
                    return;
                  }

                  if (!p.templateId) return;
                  const dropped = templates.find((x) => x.id === p.templateId);
                  if (!dropped) return;
                  createFromTemplateMutation.mutate({
                    workspaceId: ws.id,
                    templateId: p.templateId,
                  });
                }}
              >
                <CardHeader className="gap-0">
                  <div
                    className={cn(
                      "boards-draggable-card -mx-1 rounded-md px-1 pb-1",
                      isWorkspaceDragging && "pointer-events-none",
                    )}
                  >
                    <CardTitle className="text-lg">{ws.name}</CardTitle>
                    <CardDescription>
                      {ws.boards.length === 0 ? "No boards yet." : `${ws.boards.length} board(s)`}
                    </CardDescription>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {ws.boards.map((b) => {
                      const boardDragDisabled =
                        archiveBoardMutation.isPending || restoreBoardMutation.isPending;
                      const isBoardDragging = draggingBoardId === b.id;
                      return (
                        <li className="flex min-h-9 items-stretch gap-1">
                          <div
                            draggable={!boardDragDisabled}
                            onDragStart={(e) => {
                              if (boardDragDisabled) {
                                e.preventDefault();
                                return;
                              }
                              setDraggingBoardId(b.id);
                              const payload = JSON.stringify({ kind: "board", boardId: b.id });
                              e.dataTransfer.setData("application/json", payload);
                              e.dataTransfer.setData("text/plain", payload);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => {
                              setDraggingBoardId(null);
                              setSideStripActive(false);
                            }}
                            className={cn(
                              "workspace-board-chip boards-draggable-card flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm shadow-sm",
                              !boardDragDisabled && "cursor-grab active:cursor-grabbing",
                              isBoardDragging && "boards-draggable-card--dragging",
                            )}
                          >
                            <Kanban className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="min-w-0 truncate font-medium">{b.name}</span>
                          </div>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-9 shrink-0 rounded-md border-border bg-muted/30 px-1.5 text-xs font-medium text-primary shadow-sm hover:bg-muted/50 hover:text-primary"
                          >
                            <Link to={`/app/boards/${b.id}`}>Open</Link>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                  {archivedLoading && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      Loading archived boards…
                    </div>
                  )}
                  {!archivedLoading && archivedBoards.length > 0 && (
                    <div className="mt-4 border-t pt-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Archived boards</p>
                      <ul className="space-y-2 text-sm">
                        {archivedBoards.map((b) => (
                          <li key={b.id} className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-muted-foreground">{b.name}</span>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="shrink-0 gap-1"
                              disabled={restoreBoardMutation.isPending}
                              onClick={() => restoreBoardMutation.mutate(b.id)}
                            >
                              <ArchiveRestore className="size-3.5" aria-hidden />
                              Restore
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardHeader>
              </Card>
            );
          })}
          </div>
        </div>

        {archivedWorkspacesQuery.data && archivedWorkspacesQuery.data.length > 0 && (
          <div className="mt-6 space-y-3 rounded-lg border border-dashed bg-muted/15 p-4">
            <p className="text-sm font-medium">Archived workspaces</p>
            <ul className="space-y-2 text-sm">
              {archivedWorkspacesQuery.data.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-muted-foreground">{w.name}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 gap-1"
                    disabled={restoreWorkspaceMutation.isPending}
                    onClick={() => restoreWorkspaceMutation.mutate(w.id)}
                  >
                    <ArchiveRestore className="size-3.5" aria-hidden />
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
