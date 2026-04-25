import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Kanban, LayoutGrid, Loader2, MoreVertical, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  createBoardFromTemplate,
  createCustomBoardTemplate,
  createProjectSpace,
  createBoardList,
  deleteBoardList,
  deleteBoardTemplate,
  deleteProjectSpace,
  fetchArchivedBoards,
  fetchArchivedProjectSpaces,
  fetchBoard,
  fetchBoardTemplate,
  fetchBoardTemplates,
  fetchWorkspaces,
  patchBoard,
  patchBoardList,
  patchCustomBoardTemplate,
  patchProjectSpace,
  reorderBoardLists,
  reorderProjectSpaces,
} from "@/features/taskflow/api";
import { brandMentionLabel } from "@/components/layout/WorkspaceBrandSwitcher";
import { PMAgentSheet } from "@/features/agents/PMAgentSheet";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { useArchivesVisibility } from "@/context/ArchivesVisibilityContext";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WORKSPACE_NAME_MAX_LENGTH } from "@/lib/workspaceConstants";
import { cn } from "@/lib/utils";

const DEFAULT_CUSTOM_COLUMNS = ["Backlog", "In progress", "Done"];

function parseBoardsDragPayload(raw: string): {
  kind?: string;
  templateId?: string;
  projectSpaceId?: string;
  boardId?: string;
} {
  try {
    const v = JSON.parse(raw || "{}") as Record<string, unknown>;
    return {
      kind: typeof v.kind === "string" ? v.kind : undefined,
      templateId: typeof v.templateId === "string" ? v.templateId : undefined,
      projectSpaceId: typeof v.projectSpaceId === "string" ? v.projectSpaceId : undefined,
      boardId: typeof v.boardId === "string" ? v.boardId : undefined,
    };
  } catch {
    return {};
  }
}

function computeProjectSpaceReorder(orderedIds: string[], draggedId: string, beforeId: string): string[] {
  if (draggedId === beforeId) return orderedIds;
  const without = orderedIds.filter((id) => id !== draggedId);
  const insertBefore = without.indexOf(beforeId);
  if (insertBefore === -1) return orderedIds;
  return [...without.slice(0, insertBefore), draggedId, ...without.slice(insertBefore)];
}

function BoardsDropStrip({
  variant,
  active,
  onActiveChange,
  onDrop,
}: {
  variant: "trash" | "archive";
  active: boolean;
  onActiveChange: (next: boolean) => void;
  onDrop: (e: DragEvent) => void;
}) {
  const isTrash = variant === "trash";
  return (
    <div
      role="region"
      aria-label={
        isTrash
          ? "Drop to delete custom template"
          : "Drop to archive project board or project space"
      }
      className={cn(
        "flex min-h-[12rem] w-11 shrink-0 flex-col items-center justify-center self-stretch rounded-lg border-2 border-dashed px-0 py-4 transition-colors",
        active
          ? isTrash
            ? "border-destructive bg-destructive/10 text-destructive"
            : "border-primary bg-primary/10 text-primary"
          : "border-muted-foreground/30 bg-muted/25 text-muted-foreground",
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        onActiveChange(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isTrash) {
          e.dataTransfer.dropEffect = "copy";
        } else {
          e.dataTransfer.dropEffect = "move";
        }
        onActiveChange(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onActiveChange(false);
        }
      }}
      onDrop={onDrop}
    >
      {isTrash ? (
        <Trash2 className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
      ) : (
        <Archive className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
      )}
    </div>
  );
}

const BOARD_OPEN_DRAG_THRESHOLD_PX = 8;

export function BoardsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const boardOpenPointerRef = useRef<{ x: number; y: number } | null>(null);
  const { activeWorkspace, activeWorkspaceId } = useActiveWorkspace();
  const { showArchives } = useArchivesVisibility();
  const [newProjectSpaceName, setNewProjectSpaceName] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [columnTitles, setColumnTitles] = useState<string[]>(() => [...DEFAULT_CUSTOM_COLUMNS]);
  const [templateFormError, setTemplateFormError] = useState<string | null>(null);
  const [draggingTemplateId, setDraggingTemplateId] = useState<string | null>(null);
  const [draggingProjectSpaceId, setDraggingProjectSpaceId] = useState<string | null>(null);
  const [draggingBoardId, setDraggingBoardId] = useState<string | null>(null);
  const [dropTargetProjectSpaceId, setDropTargetProjectSpaceId] = useState<string | null>(null);
  const [projectSpaceReorderHoverId, setProjectSpaceReorderHoverId] = useState<string | null>(null);
  const [sideStripActive, setSideStripActive] = useState(false);
  const [projectSpaceEditId, setProjectSpaceEditId] = useState<string | null>(null);
  const [projectSpaceEditName, setProjectSpaceEditName] = useState("");
  const [projectSpaceEditPurpose, setProjectSpaceEditPurpose] = useState("");
  const [spaceBoardNameDraft, setSpaceBoardNameDraft] = useState<Record<string, string>>({});
  const [projectSpaceEditError, setProjectSpaceEditError] = useState<string | null>(null);
  const [projectSpaceDeleteTarget, setProjectSpaceDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [boardEditId, setBoardEditId] = useState<string | null>(null);
  const [boardEditName, setBoardEditName] = useState("");
  const [boardEditColumns, setBoardEditColumns] = useState<{ id?: string; title: string }[]>([]);
  const [boardEditError, setBoardEditError] = useState<string | null>(null);
  const [templateDialogMode, setTemplateDialogMode] = useState<"create" | "edit">("create");
  const [templateEditId, setTemplateEditId] = useState<string | null>(null);

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: fetchWorkspaces,
  });

  const templatesQuery = useQuery({
    queryKey: ["board-templates", activeWorkspaceId],
    queryFn: () => fetchBoardTemplates(activeWorkspaceId),
  });

  const boardEditQuery = useQuery({
    queryKey: ["board", boardEditId] as const,
    queryFn: () => fetchBoard(boardEditId!),
    enabled: Boolean(boardEditId),
  });

  const templateEditQuery = useQuery({
    queryKey: ["board-template", templateEditId] as const,
    queryFn: () => fetchBoardTemplate(templateEditId!),
    enabled: Boolean(templateEditId) && templateDialogMode === "edit",
  });

  const archivedProjectSpacesQuery = useQuery({
    queryKey: ["archived-project-spaces", activeWorkspace?.id] as const,
    queryFn: () => fetchArchivedProjectSpaces(activeWorkspace!.id),
    enabled: showArchives && Boolean(activeWorkspace),
  });

  const archivedBoardsQuery = useQuery({
    queryKey: ["archived-boards", activeWorkspace?.id] as const,
    queryFn: () => fetchArchivedBoards(activeWorkspace!.id),
    enabled: showArchives && Boolean(activeWorkspace),
  });

  const createProjectSpaceMutation = useMutation({
    mutationFn: (name: string) => {
      const t = name.trim();
      if (t.length > WORKSPACE_NAME_MAX_LENGTH) {
        throw new Error(`Name must be at most ${WORKSPACE_NAME_MAX_LENGTH} characters.`);
      }
      const ws = activeWorkspace;
      if (!ws) {
        throw new Error("No active brand workspace — pick a brand in Settings or the sidebar.");
      }
      return createProjectSpace(ws.id, t);
    },
    onSuccess: () => {
      setNewProjectSpaceName("");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["brands-tree"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: (args: { workspaceId: string; templateId: string; projectSpaceId: string }) =>
      createBoardFromTemplate(args.workspaceId, {
        templateId: args.templateId,
        projectSpaceId: args.projectSpaceId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["brands-tree"] });
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

  const archiveProjectSpaceMutation = useMutation({
    mutationFn: (id: string) => patchProjectSpace(id, { archived: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["brands-tree"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["archived-project-spaces"] });
    },
  });

  const restoreProjectSpaceFromArchiveMutation = useMutation({
    mutationFn: (id: string) => patchProjectSpace(id, { archived: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["brands-tree"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["archived-project-spaces"] });
    },
  });

  const reorderProjectSpacesMutation = useMutation({
    mutationFn: ({ workspaceId, orderedIds }: { workspaceId: string; orderedIds: string[] }) =>
      reorderProjectSpaces(workspaceId, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["brands-tree"] });
    },
  });

  const updateProjectSpaceMutation = useMutation({
    mutationFn: async (args: {
      id: string;
      name: string;
      purpose: string | null;
      boardNameUpdates: { boardId: string; name: string }[];
    }) => {
      await patchProjectSpace(args.id, { name: args.name, purpose: args.purpose });
      for (const u of args.boardNameUpdates) {
        await patchBoard(u.boardId, { name: u.name });
      }
    },
    onSuccess: () => {
      setProjectSpaceEditId(null);
      setProjectSpaceEditName("");
      setProjectSpaceEditPurpose("");
      setSpaceBoardNameDraft({});
      setProjectSpaceEditError(null);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["brands-tree"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (err: unknown) => {
      setProjectSpaceEditError(err instanceof Error ? err.message : "Could not save project space.");
    },
  });

  const archiveBoardFromSpaceEditMutation = useMutation({
    mutationFn: (boardId: string) => patchBoard(boardId, { archived: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["brands-tree"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });

  const deleteProjectSpaceMutation = useMutation({
    mutationFn: (args: { id: string; disposition: "transferBoardsToDefault" | "archiveBoards" }) =>
      deleteProjectSpace(args.id, args.disposition),
    onSuccess: (_d, { id: deletedId }) => {
      setProjectSpaceDeleteTarget(null);
      setProjectSpaceEditId((cur) => (cur === deletedId ? null : cur));
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["brands-tree"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["archived-project-spaces"] });
      queryClient.invalidateQueries({ queryKey: ["archived-boards"] });
    },
  });

  const saveBoardEditMutation = useMutation({
    mutationFn: async (args: { boardId: string; name: string; columns: { id?: string; title: string }[] }) => {
      const initial = await fetchBoard(args.boardId);
      const nonEmpty = args.columns.map((c) => ({ ...c, title: c.title.trim() })).filter((c) => c.title);
      if (nonEmpty.length < 1) throw new Error("Add at least one column with a title.");
      if (args.name.trim().length < 1) throw new Error("Board name is required.");
      if (args.name !== initial.name) {
        await patchBoard(args.boardId, { name: args.name.trim() });
      }
      const desiredOrder: string[] = [];
      for (const col of nonEmpty) {
        if (col.id && initial.lists.some((l) => l.id === col.id)) {
          const prev = initial.lists.find((l) => l.id === col.id)!;
          if (prev.title !== col.title) {
            await patchBoardList(args.boardId, col.id, { title: col.title });
          }
          desiredOrder.push(col.id);
        } else {
          const created = await createBoardList(args.boardId, col.title);
          desiredOrder.push(created.id);
        }
      }
      const oldIds = initial.lists.map((l) => l.id);
      for (const id of oldIds) {
        if (!desiredOrder.includes(id)) {
          await deleteBoardList(args.boardId, id);
        }
      }
      await reorderBoardLists(args.boardId, desiredOrder);
    },
    onSuccess: (_d, v) => {
      setBoardEditId(null);
      setBoardEditError(null);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["brands-tree"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["board", v.boardId] });
    },
    onError: (err: unknown) => {
      setBoardEditError(err instanceof Error ? err.message : "Could not save board.");
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      const ws = activeWorkspace;
      if (!ws) {
        throw new Error("Select a brand workspace to save a template for that brand.");
      }
      const lists = columnTitles.map((t) => t.trim()).filter(Boolean);
      if (!templateName.trim()) throw new Error("Name is required.");
      if (lists.length === 0) throw new Error("Add at least one column with a title.");
      return createCustomBoardTemplate({
        workspaceId: ws.id,
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
      setTemplateEditId(null);
      setTemplateDialogMode("create");
    },
    onError: (err: unknown) => {
      setTemplateFormError(err instanceof Error ? err.message : "Could not save template.");
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!templateEditId) throw new Error("No template selected.");
      const lists = columnTitles.map((t) => t.trim()).filter(Boolean);
      if (!templateName.trim()) throw new Error("Name is required.");
      if (lists.length === 0) throw new Error("Add at least one column with a title.");
      return patchCustomBoardTemplate(templateEditId, {
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
      setTemplateEditId(null);
      setTemplateDialogMode("create");
    },
    onError: (err: unknown) => {
      setTemplateFormError(err instanceof Error ? err.message : "Could not update template.");
    },
  });

  useEffect(() => {
    if (!boardEditId || !boardEditQuery.data) return;
    setBoardEditName(boardEditQuery.data.name);
    setBoardEditColumns(boardEditQuery.data.lists.map((l) => ({ id: l.id, title: l.title })));
    setBoardEditError(null);
  }, [boardEditId, boardEditQuery.data]);

  useEffect(() => {
    if (templateDialogMode !== "edit" || !templateEditId || !templateEditQuery.data) return;
    const d = templateEditQuery.data;
    if (d.isBuiltin) return;
    setTemplateName(d.name);
    setTemplateDescription(d.description);
    setColumnTitles(d.lists.length > 0 ? d.lists.map((l) => l.title) : [...DEFAULT_CUSTOM_COLUMNS]);
    setTemplateFormError(null);
  }, [templateDialogMode, templateEditId, templateEditQuery.data]);

  const templates = templatesQuery.data ?? [];
  const projectSpaces = activeWorkspace?.projectSpaces ?? [];

  useEffect(() => {
    if (!projectSpaceEditId) return;
    const ps = projectSpaces.find((p) => p.id === projectSpaceEditId);
    if (ps) {
      setProjectSpaceEditName(ps.name);
      setProjectSpaceEditPurpose(ps.purpose ?? "");
      const m: Record<string, string> = {};
      for (const b of ps.boards) m[b.id] = b.name;
      setSpaceBoardNameDraft(m);
    }
  }, [projectSpaceEditId, projectSpaces]);

  const handleBoardsStripDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setSideStripActive(false);
      const raw =
        e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
      const p = parseBoardsDragPayload(raw);
      const boardIdToArchive = p.boardId ?? draggingBoardId ?? undefined;
      const projectSpaceIdToArchive = p.projectSpaceId ?? draggingProjectSpaceId ?? undefined;
      const templateIdToDelete = p.templateId ?? draggingTemplateId ?? undefined;
      setDraggingTemplateId(null);
      setDraggingProjectSpaceId(null);
      setDraggingBoardId(null);
      setDropTargetProjectSpaceId(null);
      setProjectSpaceReorderHoverId(null);
      if (boardIdToArchive) {
        archiveBoardMutation.mutate(boardIdToArchive);
        return;
      }
      if (projectSpaceIdToArchive) {
        const sp = projectSpaces.find((x) => x.id === projectSpaceIdToArchive);
        if (sp?.isDefault) return;
        archiveProjectSpaceMutation.mutate(projectSpaceIdToArchive);
        return;
      }
      if (templateIdToDelete) {
        const tpl = templates.find((x) => x.id === templateIdToDelete);
        if (tpl && !tpl.isBuiltin) {
          deleteTemplateMutation.mutate(templateIdToDelete);
        }
      }
    },
    [
      templates,
      draggingBoardId,
      draggingProjectSpaceId,
      draggingTemplateId,
      archiveBoardMutation,
      archiveProjectSpaceMutation,
      deleteTemplateMutation,
      projectSpaces,
    ],
  );

  const boardsIndexContext = useMemo(() => {
    if (!activeWorkspace?.projectSpaces?.length) return "No project spaces in this workspace.";
    const lines: string[] = [`Workspace: ${activeWorkspace.name}`];
    for (const ps of activeWorkspace.projectSpaces) {
      lines.push(`\n## ${ps.name}`);
      for (const b of ps.boards) {
        lines.push(`- ${b.name} (${b.id})`);
      }
    }
    return lines.join("\n").slice(0, 14_000);
  }, [activeWorkspace]);

  const draggedTemplateSummary = draggingTemplateId
    ? templates.find((x) => x.id === draggingTemplateId)
    : undefined;
  const showTemplateTrashStrip = Boolean(draggedTemplateSummary && !draggedTemplateSummary.isBuiltin);
  const draggedProjectSpaceForArchive =
    draggingProjectSpaceId ? projectSpaces.find((p) => p.id === draggingProjectSpaceId) : undefined;
  const showProjectSpaceArchiveStrip = Boolean(
    draggingProjectSpaceId && draggedProjectSpaceForArchive?.isDefault !== true,
  );
  const showBoardArchiveStrip = Boolean(draggingBoardId);
  const showProjectSpacesDropStrip = showProjectSpaceArchiveStrip || showBoardArchiveStrip;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-5 text-muted-foreground" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">Project Boards</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Project spaces group project boards. Create a project board from a template, then open the main board view
            to work.
          </p>
        </div>
        {activeWorkspaceId ? (
          <PMAgentSheet
            workspaceId={activeWorkspaceId}
            contextText={boardsIndexContext}
            surfaceLabel="Project spaces and board index"
          />
        ) : null}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Project Board Templates</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Built-in templates are shared by everyone. Custom templates belong to the active brand. Drag a template onto
            a project space below. Drag a <span className="font-medium text-foreground">custom</span> template to the
            narrow column to the left of these cards to delete it. Built-in templates cannot be deleted.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Input
            placeholder="e.g. Design review"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && templateName.trim() && activeWorkspace) {
                setTemplateFormError(null);
                setTemplateDescription("");
                setColumnTitles([...DEFAULT_CUSTOM_COLUMNS]);
                setTemplateDialogOpen(true);
              }
            }}
            className="w-full min-w-0 sm:max-w-xs"
            aria-label="New custom template title"
            disabled={!activeWorkspace}
          />
          <Button
            type="button"
            className="gap-1 shrink-0 self-end sm:self-auto"
            disabled={
              createTemplateMutation.isPending || updateTemplateMutation.isPending || !templateName.trim() || !activeWorkspace
            }
            onClick={() => {
              if (!templateName.trim() || !activeWorkspace) return;
              setTemplateFormError(null);
              setTemplateDescription("");
              setColumnTitles([...DEFAULT_CUSTOM_COLUMNS]);
              setTemplateDialogMode("create");
              setTemplateEditId(null);
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
            if (!open) {
              setTemplateFormError(null);
              setTemplateDescription("");
              setColumnTitles([...DEFAULT_CUSTOM_COLUMNS]);
              setTemplateEditId(null);
              setTemplateDialogMode("create");
            } else {
              if (templateDialogMode === "create" && !templateEditId) {
                setTemplateFormError(null);
                setTemplateDescription("");
                setColumnTitles([...DEFAULT_CUSTOM_COLUMNS]);
              }
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogTitle>
              {templateDialogMode === "edit" ? "Edit custom template" : "New custom template"}
            </DialogTitle>
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
                    disabled={
                      createTemplateMutation.isPending ||
                      updateTemplateMutation.isPending ||
                      (templateDialogMode === "edit" && templateEditQuery.isLoading)
                    }
                    onClick={() => {
                      setTemplateFormError(null);
                      if (templateDialogMode === "edit") {
                        updateTemplateMutation.mutate();
                      } else {
                        createTemplateMutation.mutate();
                      }
                    }}
                  >
                    {createTemplateMutation.isPending || updateTemplateMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : templateDialogMode === "edit" ? (
                      "Save changes"
                    ) : (
                      "Save template"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
        </Dialog>
        <Dialog
          open={projectSpaceEditId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setProjectSpaceEditId(null);
              setProjectSpaceEditName("");
              setProjectSpaceEditPurpose("");
              setSpaceBoardNameDraft({});
              setProjectSpaceEditError(null);
            }
          }}
        >
          <DialogContent
            className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <DialogTitle>Edit project space</DialogTitle>
            <DialogDescription>
              Update the name, purpose, and boards in this delivery thread. The primary (default) project space
              cannot be deleted.
            </DialogDescription>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="project-space-edit-name" className="text-xs text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="project-space-edit-name"
                  value={projectSpaceEditName}
                  onChange={(e) => {
                    setProjectSpaceEditName(e.target.value);
                    setProjectSpaceEditError(null);
                  }}
                  maxLength={WORKSPACE_NAME_MAX_LENGTH}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-space-edit-purpose" className="text-xs text-muted-foreground">
                  Purpose (optional)
                </Label>
                <textarea
                  id="project-space-edit-purpose"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  value={projectSpaceEditPurpose}
                  onChange={(e) => {
                    setProjectSpaceEditPurpose(e.target.value);
                    setProjectSpaceEditError(null);
                  }}
                  placeholder="What this project space is for…"
                />
              </div>
              {projectSpaceEditId && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Project boards in this space</p>
                  <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {(projectSpaces.find((p) => p.id === projectSpaceEditId)?.boards ?? []).map((b) => (
                      <li
                        key={b.id}
                        className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-2 sm:flex-row sm:items-center"
                      >
                        <Input
                          className="min-w-0 flex-1"
                          value={spaceBoardNameDraft[b.id] ?? b.name}
                          onChange={(e) =>
                            setSpaceBoardNameDraft((m) => ({ ...m, [b.id]: e.target.value }))
                          }
                          aria-label={`Board name: ${b.name}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1 text-destructive"
                          disabled={archiveBoardFromSpaceEditMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Archive board “${b.name}”?`)) {
                              archiveBoardFromSpaceEditMutation.mutate(b.id);
                            }
                          }}
                        >
                          <Archive className="size-3.5" aria-hidden />
                          Archive
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {projectSpaceEditError ? (
                <p className="text-sm text-destructive">{projectSpaceEditError}</p>
              ) : null}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setProjectSpaceEditId(null);
                  setProjectSpaceEditName("");
                  setProjectSpaceEditPurpose("");
                  setSpaceBoardNameDraft({});
                  setProjectSpaceEditError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={updateProjectSpaceMutation.isPending}
                onClick={() => {
                  const t = projectSpaceEditName.trim();
                  if (!t) {
                    setProjectSpaceEditError("Name is required.");
                    return;
                  }
                  if (t.length > WORKSPACE_NAME_MAX_LENGTH) {
                    setProjectSpaceEditError(`Name must be at most ${WORKSPACE_NAME_MAX_LENGTH} characters.`);
                    return;
                  }
                  if (!projectSpaceEditId) return;
                  const ps = projectSpaces.find((p) => p.id === projectSpaceEditId);
                  const boardNameUpdates: { boardId: string; name: string }[] = [];
                  if (ps) {
                    for (const b of ps.boards) {
                      const next = (spaceBoardNameDraft[b.id] ?? b.name).trim();
                      if (next && next !== b.name) {
                        boardNameUpdates.push({ boardId: b.id, name: next });
                      }
                    }
                  }
                  const purposeVal = projectSpaceEditPurpose.trim() || null;
                  updateProjectSpaceMutation.mutate({
                    id: projectSpaceEditId,
                    name: t,
                    purpose: purposeVal,
                    boardNameUpdates,
                  });
                }}
              >
                {updateProjectSpaceMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={boardEditId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setBoardEditId(null);
              setBoardEditError(null);
            }
          }}
        >
          <DialogContent
            className="max-h-[90vh] overflow-y-auto sm:max-w-md"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <DialogTitle>Edit project board</DialogTitle>
            <DialogDescription>
              Change the board name and column layout. Deleting a column moves tasks to other lists when possible.
            </DialogDescription>
            {boardEditQuery.isLoading && boardEditId ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading board…
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Board name</Label>
                  <Input
                    value={boardEditName}
                    onChange={(e) => {
                      setBoardEditName(e.target.value);
                      setBoardEditError(null);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Columns (lists)</Label>
                  <ul className="space-y-2">
                    {boardEditColumns.map((col, index) => (
                      <li key={index} className="flex flex-wrap items-center gap-2">
                        <Input
                          className="min-w-0 flex-1"
                          value={col.title}
                          onChange={(e) => {
                            const next = [...boardEditColumns];
                            next[index] = { ...next[index]!, title: e.target.value };
                            setBoardEditColumns(next);
                          }}
                          placeholder={`Column ${index + 1}`}
                        />
                        <div className="flex shrink-0 gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={index === 0}
                            onClick={() => {
                              const next = [...boardEditColumns];
                              [next[index - 1]!, next[index]!] = [next[index]!, next[index - 1]!];
                              setBoardEditColumns(next);
                            }}
                            aria-label="Move column up"
                          >
                            ↑
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={index >= boardEditColumns.length - 1}
                            onClick={() => {
                              const next = [...boardEditColumns];
                              [next[index]!, next[index + 1]!] = [next[index + 1]!, next[index]!];
                              setBoardEditColumns(next);
                            }}
                            aria-label="Move column down"
                          >
                            ↓
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground"
                          disabled={boardEditColumns.length <= 1}
                          onClick={() =>
                            setBoardEditColumns((rows) =>
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
                    onClick={() => setBoardEditColumns((rows) => [...rows, { title: "" }])}
                  >
                    Add column
                  </Button>
                </div>
                {boardEditError ? <p className="text-sm text-destructive">{boardEditError}</p> : null}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setBoardEditId(null);
                      setBoardEditError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={saveBoardEditMutation.isPending || !boardEditId}
                    onClick={() => {
                      if (!boardEditId) return;
                      setBoardEditError(null);
                      saveBoardEditMutation.mutate({
                        boardId: boardEditId,
                        name: boardEditName,
                        columns: boardEditColumns,
                      });
                    }}
                  >
                    {saveBoardEditMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Dialog
          open={projectSpaceDeleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setProjectSpaceDeleteTarget(null);
          }}
        >
          <DialogContent className="sm:max-w-md" onPointerDown={(e) => e.stopPropagation()}>
            <DialogTitle>Delete project space?</DialogTitle>
            <DialogDescription>
              {projectSpaceDeleteTarget ? (
                <>
                  This will close <span className="font-medium text-foreground">{projectSpaceDeleteTarget.name}</span>.{" "}
                  Choose what happens to the project boards that are still in it.
                </>
              ) : null}
            </DialogDescription>
            <div className="flex flex-col gap-2 py-2">
              <Button
                type="button"
                variant="default"
                disabled={deleteProjectSpaceMutation.isPending}
                onClick={() => {
                  if (!projectSpaceDeleteTarget) return;
                  deleteProjectSpaceMutation.mutate({
                    id: projectSpaceDeleteTarget.id,
                    disposition: "transferBoardsToDefault",
                  });
                }}
              >
                Move all boards to the default project space, then close this one
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={deleteProjectSpaceMutation.isPending}
                onClick={() => {
                  if (!projectSpaceDeleteTarget) return;
                  deleteProjectSpaceMutation.mutate({
                    id: projectSpaceDeleteTarget.id,
                    disposition: "archiveBoards",
                  });
                }}
              >
                Archive all boards in this space, then close this project space
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setProjectSpaceDeleteTarget(null)}
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {templatesQuery.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading templates…
          </div>
        )}
        <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
          {showTemplateTrashStrip ? (
            <BoardsDropStrip
              variant="trash"
              active={sideStripActive}
              onActiveChange={setSideStripActive}
              onDrop={handleBoardsStripDrop}
            />
          ) : null}
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const canDrag =
              Boolean(activeWorkspace) &&
              projectSpaces.length > 0 &&
              !createFromTemplateMutation.isPending;
            const isDragging = draggingTemplateId === t.id;
            return (
              <Card
                key={t.id}
                draggable={canDrag}
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
                  setDropTargetProjectSpaceId(null);
                  setSideStripActive(false);
                }}
                className={cn(
                  "template-card-draggable select-none py-0 shadow-none",
                  isDragging && "boards-draggable-card--dragging",
                  !canDrag && "cursor-not-allowed opacity-80",
                )}
                title={
                  canDrag
                    ? "Drag onto a project space below"
                    : activeWorkspace
                      ? "Add a project space below first"
                      : "Select a brand workspace first"
                }
              >
                <CardHeader className="space-y-0 pb-4 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{t.name}</CardTitle>
                    </div>
                    {!t.isBuiltin ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                            aria-label={`Template options: ${t.name}`}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="size-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-40">
                          <DropdownMenuItem
                            onSelect={() => {
                              setTemplateDialogMode("edit");
                              setTemplateEditId(t.id);
                              setTemplateFormError(null);
                              setTemplateDialogOpen(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              if (
                                window.confirm(
                                  `Delete template “${t.name}”? This cannot be undone.`,
                                )
                              ) {
                                deleteTemplateMutation.mutate(t.id);
                              }
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                  <CardDescription className="mt-1.5">{t.description || "—"}</CardDescription>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t.listCount} column{t.listCount === 1 ? "" : "s"} ·{" "}
                    {t.isBuiltin
                      ? "Built-in · shared by all users"
                      : t.workspaceName
                        ? `Custom · ${t.workspaceName}`
                        : "Custom · this brand"}
                  </p>
                  {!canDrag ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {activeWorkspace
                        ? "Add a project space to enable drag."
                        : "Select a brand in Settings or the sidebar."}
                    </p>
                  ) : null}
                </CardHeader>
              </Card>
            );
          })}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Project spaces</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Each brand has one workspace; the cards below are <span className="font-medium text-foreground">project spaces</span>{" "}
            inside that workspace. Click a project board row to open it, or drag it to another project space or to the
            narrow archive column (left of these cards) to archive it. Drag a template from above onto a project space
            to add a board. Drag project spaces to reorder, or onto the column to archive a project space.
          </p>
          {activeWorkspace ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Active brand:{" "}
              <span className="font-medium text-foreground">{brandMentionLabel(activeWorkspace)}</span>
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Input
            placeholder="e.g. Client A"
            value={newProjectSpaceName}
            maxLength={WORKSPACE_NAME_MAX_LENGTH}
            onChange={(e) => setNewProjectSpaceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newProjectSpaceName.trim()) {
                createProjectSpaceMutation.mutate(newProjectSpaceName.trim());
              }
            }}
            className="w-full min-w-0 sm:max-w-xs"
            aria-label="New project space name"
            disabled={!activeWorkspace}
          />
          <Button
            type="button"
            className="gap-1 shrink-0 self-end sm:self-auto"
            onClick={() =>
              newProjectSpaceName.trim() && createProjectSpaceMutation.mutate(newProjectSpaceName.trim())
            }
            disabled={
              createProjectSpaceMutation.isPending || !newProjectSpaceName.trim() || !activeWorkspace
            }
          >
            <Plus className="size-4" />
            Add project space
          </Button>
        </div>
        {workspacesQuery.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading project spaces…
          </div>
        )}
        {workspacesQuery.isError && (
          <p className="text-sm text-destructive">
            Could not load project spaces for your brand. Check your connection and try again.
          </p>
        )}
        {!workspacesQuery.isLoading && !activeWorkspace && !workspacesQuery.isError && (
          <p className="text-sm text-muted-foreground">
            Select a brand from the sidebar or Settings to see and manage project spaces for that brand&apos;s workspace.
          </p>
        )}

        {activeWorkspace ? (
        <div className="flex flex-col items-stretch gap-4 md:flex-row">
          {showProjectSpacesDropStrip ? (
            <BoardsDropStrip
              variant="archive"
              active={sideStripActive}
              onActiveChange={setSideStripActive}
              onDrop={handleBoardsStripDrop}
            />
          ) : null}

          <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projectSpaces.map((ps) => {
            const draggedTemplate = draggingTemplateId
              ? templates.find((x) => x.id === draggingTemplateId)
              : undefined;
            const templateDropValid = Boolean(draggedTemplate);
            const templateHighlighted = dropTargetProjectSpaceId === ps.id && templateDropValid;
            const projectSpaceReorderHighlighted = Boolean(
              draggingProjectSpaceId &&
                draggingProjectSpaceId !== ps.id &&
                projectSpaceReorderHoverId === ps.id,
            );
            const isHighlighted = templateHighlighted || projectSpaceReorderHighlighted;
            const projectSpaceDragDisabled =
              reorderProjectSpacesMutation.isPending ||
              archiveProjectSpaceMutation.isPending ||
              archiveBoardMutation.isPending ||
              createFromTemplateMutation.isPending;
            const isProjectSpaceDragging = draggingProjectSpaceId === ps.id;

            return (
              <Card
                key={ps.id}
                draggable={!projectSpaceDragDisabled}
                onDragStart={(e) => {
                  if (projectSpaceDragDisabled) {
                    e.preventDefault();
                    return;
                  }
                  setDraggingProjectSpaceId(ps.id);
                  const payload = JSON.stringify({ kind: "project-space", projectSpaceId: ps.id });
                  e.dataTransfer.setData("application/json", payload);
                  e.dataTransfer.setData("text/plain", payload);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDraggingProjectSpaceId(null);
                  setProjectSpaceReorderHoverId(null);
                  setSideStripActive(false);
                }}
                className={cn(
                  "project-space-boards-card min-w-0 select-none transition-[box-shadow,ring,opacity,transform] duration-200",
                  !projectSpaceDragDisabled && "cursor-grab active:cursor-grabbing",
                  isProjectSpaceDragging && "boards-draggable-card--dragging",
                  isHighlighted &&
                    "ring-primary shadow-lg ring-2 ring-offset-2 ring-offset-background",
                )}
                onDragOver={(e) => {
                  if (draggingBoardId) return;
                  if (draggingProjectSpaceId) {
                    if (draggingProjectSpaceId === ps.id) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setProjectSpaceReorderHoverId(ps.id);
                    setDropTargetProjectSpaceId(null);
                    return;
                  }
                  if (draggedTemplate) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    setDropTargetProjectSpaceId(ps.id);
                    setProjectSpaceReorderHoverId(null);
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
                    setDropTargetProjectSpaceId((cur) => (cur === ps.id ? null : cur));
                    setProjectSpaceReorderHoverId((cur) => (cur === ps.id ? null : cur));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTargetProjectSpaceId(null);
                  setProjectSpaceReorderHoverId(null);
                  setDraggingTemplateId(null);
                  setDraggingProjectSpaceId(null);
                  setDraggingBoardId(null);
                  setSideStripActive(false);
                  const raw =
                    e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
                  const p = parseBoardsDragPayload(raw);

                  if (p.boardId) return;

                  if (p.projectSpaceId) {
                    if (p.projectSpaceId === ps.id) return;
                    const ids = projectSpaces.map((x) => x.id);
                    if (!ids.includes(p.projectSpaceId)) return;
                    if (!activeWorkspace) return;
                    const next = computeProjectSpaceReorder(ids, p.projectSpaceId, ps.id);
                    reorderProjectSpacesMutation.mutate({
                      workspaceId: activeWorkspace.id,
                      orderedIds: next,
                    });
                    return;
                  }

                  if (!p.templateId || !activeWorkspace) return;
                  const dropped = templates.find((x) => x.id === p.templateId);
                  if (!dropped) return;
                  createFromTemplateMutation.mutate({
                    workspaceId: activeWorkspace.id,
                    templateId: p.templateId,
                    projectSpaceId: ps.id,
                  });
                }}
              >
                <CardHeader className="gap-0">
                  <div
                    className={cn(
                      "flex items-start justify-between gap-2",
                      isProjectSpaceDragging && "pointer-events-none",
                    )}
                  >
                    <div className="min-w-0 flex-1 -mx-1 rounded-md px-1 pb-1">
                      <CardTitle className="text-lg">{ps.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {ps.isDefault ? (
                          <>
                            <span className="font-medium text-destructive">Default</span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {ps.boards.length} project board{ps.boards.length === 1 ? "" : "s"}
                            </span>
                          </>
                        ) : ps.boards.length === 0 ? (
                          "No project boards yet."
                        ) : (
                          `${ps.boards.length} project board${ps.boards.length === 1 ? "" : "s"}`
                        )}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label={`Project space options: ${ps.name}`}
                          disabled={
                            projectSpaceDragDisabled ||
                            updateProjectSpaceMutation.isPending ||
                            archiveProjectSpaceMutation.isPending
                          }
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="size-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="min-w-40"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem
                          onSelect={() => {
                            setProjectSpaceEditId(ps.id);
                            setProjectSpaceEditError(null);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        {!ps.isDefault ? (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              setProjectSpaceDeleteTarget({ id: ps.id, name: ps.name });
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {ps.boards.map((b) => {
                      const boardDragDisabled =
                        archiveBoardMutation.isPending || restoreBoardMutation.isPending;
                      const isBoardDragging = draggingBoardId === b.id;
                      return (
                        <li key={b.id} className="flex min-h-9 items-stretch gap-1">
                          <div
                            role="link"
                            tabIndex={boardDragDisabled ? -1 : 0}
                            aria-label={`Open project board: ${b.name}`}
                            title="Click to open · drag to another project space or to the archive column"
                            draggable={!boardDragDisabled}
                            onPointerDown={(e) => {
                              if (boardDragDisabled) return;
                              boardOpenPointerRef.current = { x: e.clientX, y: e.clientY };
                            }}
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
                            onClick={(e) => {
                              if (boardDragDisabled) return;
                              const start = boardOpenPointerRef.current;
                              boardOpenPointerRef.current = null;
                              if (start) {
                                const dx = e.clientX - start.x;
                                const dy = e.clientY - start.y;
                                if (Math.hypot(dx, dy) > BOARD_OPEN_DRAG_THRESHOLD_PX) return;
                              }
                              navigate(`/app/boards/${b.id}`);
                            }}
                            onKeyDown={(e) => {
                              if (boardDragDisabled) return;
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                navigate(`/app/boards/${b.id}`);
                              }
                            }}
                            className={cn(
                              "workspace-board-chip boards-draggable-card flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                              !boardDragDisabled && "cursor-pointer active:cursor-grabbing",
                              isBoardDragging && "boards-draggable-card--dragging",
                            )}
                          >
                            <Kanban className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="min-w-0 truncate font-medium">{b.name}</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
                                aria-label={`Board options: ${b.name}`}
                                disabled={boardDragDisabled}
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="size-4" aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="min-w-40"
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem
                                onSelect={() => {
                                  setBoardEditId(b.id);
                                  setBoardEditError(null);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => {
                                  if (window.confirm(`Delete “${b.name}”? This archives the board.`)) {
                                    archiveBoardMutation.mutate(b.id);
                                  }
                                }}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </li>
                      );
                    })}
                  </ul>
                </CardHeader>
              </Card>
            );
          })}
          </div>
        </div>
        ) : null}

        {activeWorkspace && showArchives ? (
          <div className="mt-6 space-y-3">
            {(archivedProjectSpacesQuery.isLoading || archivedBoardsQuery.isLoading) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Loading archived project spaces and boards…
              </div>
            )}
            {!archivedProjectSpacesQuery.isLoading &&
              (archivedProjectSpacesQuery.data?.length ?? 0) > 0 && (
                <div className="rounded-lg border border-dashed bg-muted/15 p-4">
                  <p className="mb-2 text-sm font-medium">Archived project spaces</p>
                  <ul className="space-y-2 text-sm">
                    {archivedProjectSpacesQuery.data!.map((ps) => (
                      <li key={ps.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-muted-foreground">{ps.name}</span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="shrink-0 gap-1"
                          disabled={restoreProjectSpaceFromArchiveMutation.isPending}
                          onClick={() => restoreProjectSpaceFromArchiveMutation.mutate(ps.id)}
                        >
                          <ArchiveRestore className="size-3.5" aria-hidden />
                          Restore
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {!archivedBoardsQuery.isLoading &&
              (archivedBoardsQuery.data?.length ?? 0) > 0 && (
                <div className="rounded-lg border border-dashed bg-muted/15 p-4">
                  <p className="mb-2 text-sm font-medium">Archived project boards</p>
                  <ul className="space-y-2 text-sm">
                    {archivedBoardsQuery.data!.map((b) => (
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
          </div>
        ) : null}
      </section>
    </div>
  );
}
