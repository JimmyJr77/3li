import { Prisma, type Note, type NoteTag, type NotesFolder } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/db.js";
import { extractFullPlainText } from "../lib/notePlainText.js";
import {
  aiServiceUnavailableDetail,
  chatModel,
  getAiPublicMetadata,
  getOpenAIOrNull,
} from "../lib/openai/client.js";
import { ensureDefaultNotesFolder, ensureNotesBootstrap, ensureQuicknotesFolder } from "../lib/notesDefaults.js";
import type { Workspace } from "@prisma/client";
import { syncNoteLinksFromContent } from "../lib/wikiLinks.js";
import { formatBrandProfileForPrompt } from "../lib/brandProfileFormat.js";
import {
  DEFAULT_NOTEBOOK_BASE,
  DEFAULT_NOTE_BASE,
  nextSequencedTitle,
} from "../lib/sequencedDefaultTitle.js";
import { runMailClerkNotebookAutotag } from "../lib/openai/surfaceAgents.js";

function normalizeRowAccentColor(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!/^#([0-9a-f]{6})$/i.test(s)) return undefined;
  return s.toLowerCase();
}

function normalizePublicSlug(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return s.length > 0 ? s : null;
}

const router = Router();

const noteInclude = {
  tags: true,
} as const;

type NoteWithTags = Note & { tags: NoteTag[] };

function serializeFolder(f: NotesFolder) {
  return {
    ...f,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

function serializeNote(n: NoteWithTags) {
  return {
    ...n,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    tags: n.tags.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  };
}

function serializeTag(t: NoteTag) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Public read-only note (no auth). */
router.get("/public/:publicSlug", async (req, res) => {
  try {
    const publicSlug = normalizePublicSlug(req.params.publicSlug);
    if (!publicSlug) {
      res.status(400).json({ error: "Invalid slug" });
      return;
    }
    const note = await prisma.note.findFirst({
      where: { publicSlug, isPublic: true },
      select: {
        id: true,
        title: true,
        contentJson: true,
        previewText: true,
        updatedAt: true,
      },
    });
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json({
      ...note,
      updatedAt: note.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load public note" });
  }
});

router.get("/bootstrap", async (req, res) => {
  try {
    const q = req.query.workspaceId;
    let workspace: Workspace;
    if (typeof q === "string" && q.trim()) {
      const ws = await prisma.workspace.findFirst({
        where: { id: q.trim(), archivedAt: null },
      });
      if (!ws) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      workspace = ws;
    } else {
      workspace = (await ensureNotesBootstrap()).workspace;
    }
    const defaultFolder = await ensureDefaultNotesFolder(workspace.id);
    const quickCaptureFolder = await ensureQuicknotesFolder(workspace.id);
    const folders = await prisma.notesFolder.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ parentId: "asc" }, { position: "asc" }],
    });
    const notes = await prisma.note.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ folderId: "asc" }, { position: "asc" }, { updatedAt: "desc" }],
      include: noteInclude,
      take: 200,
    });
    res.json({
      ai: getAiPublicMetadata(),
      workspace: {
        ...workspace,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
      },
      defaultFolderId: defaultFolder.id,
      quickCaptureFolderId: quickCaptureFolder.id,
      folders: folders.map(serializeFolder),
      notes: notes.map(serializeNote),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Notes bootstrap failed" });
  }
});

router.get("/folders", async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (!workspaceId) {
      res.status(400).json({ error: "workspaceId required" });
      return;
    }
    const folders = await prisma.notesFolder.findMany({
      where: { workspaceId },
      orderBy: [{ parentId: "asc" }, { position: "asc" }],
    });
    res.json(folders.map(serializeFolder));
  } catch {
    res.status(500).json({ error: "Failed to list folders" });
  }
});

router.post("/folders", async (req, res) => {
  try {
    const body = req.body as {
      workspaceId?: string;
      title?: string;
      parentId?: string | null;
    };
    if (!body.workspaceId) {
      res.status(400).json({ error: "workspaceId required" });
      return;
    }
    const parentId = body.parentId ?? null;
    const trimmed = typeof body.title === "string" ? body.title.trim() : "";
    let title: string;
    if (trimmed) {
      title = trimmed;
    } else {
      const siblings = await prisma.notesFolder.findMany({
        where: { workspaceId: body.workspaceId, parentId },
        select: { title: true },
      });
      const base = parentId === null ? DEFAULT_NOTEBOOK_BASE : "Folder";
      title = nextSequencedTitle(
        siblings.map((s) => s.title),
        base,
      );
    }
    const maxPos = await prisma.notesFolder.aggregate({
      where: { workspaceId: body.workspaceId, parentId },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;
    const folder = await prisma.notesFolder.create({
      data: {
        workspaceId: body.workspaceId,
        parentId: parentId ?? undefined,
        title,
        position,
      },
    });
    res.status(201).json(serializeFolder(folder));
  } catch {
    res.status(500).json({ error: "Failed to create folder" });
  }
});

router.patch("/folders/reorder", async (req, res) => {
  try {
    const body = req.body as { workspaceId?: string; orderedFolderIds?: string[] };
    if (!body.workspaceId || !Array.isArray(body.orderedFolderIds)) {
      res.status(400).json({ error: "workspaceId and orderedFolderIds required" });
      return;
    }
    const folders = await prisma.notesFolder.findMany({
      where: { workspaceId: body.workspaceId, parentId: null },
    });
    const valid = new Set(folders.map((f) => f.id));
    if (body.orderedFolderIds.length !== valid.size || body.orderedFolderIds.some((id) => !valid.has(id))) {
      res.status(400).json({ error: "Invalid folder order" });
      return;
    }
    await prisma.$transaction(
      body.orderedFolderIds.map((id, position) =>
        prisma.notesFolder.update({ where: { id }, data: { position } }),
      ),
    );
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to reorder folders" });
  }
});

router.patch("/folders/:folderId", async (req, res) => {
  try {
    const folderId = req.params.folderId;
    const body = req.body as { title?: string; position?: number; rowAccentColor?: string | null };
    const existing = await prisma.notesFolder.findUnique({ where: { id: folderId } });
    if (!existing) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
    if (body.title !== undefined && !body.title.trim()) {
      res.status(400).json({ error: "Title required" });
      return;
    }
    const accent = normalizeRowAccentColor(body.rowAccentColor);
    if (body.rowAccentColor !== undefined && accent === undefined && body.rowAccentColor !== null && body.rowAccentColor !== "") {
      res.status(400).json({ error: "rowAccentColor must be #RRGGBB or empty" });
      return;
    }
    const data: Prisma.NotesFolderUpdateInput = {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
      ...(body.rowAccentColor !== undefined ? { rowAccentColor: accent ?? null } : {}),
    };
    const folder = await prisma.notesFolder.update({ where: { id: folderId }, data });
    res.json(serializeFolder(folder));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update folder" });
  }
});

router.delete("/folders/:folderId", async (req, res) => {
  try {
    const folderId = req.params.folderId;
    const folder = await prisma.notesFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
    const siblingCount = await prisma.notesFolder.count({
      where: { workspaceId: folder.workspaceId, parentId: folder.parentId ?? null },
    });
    if (siblingCount <= 1) {
      res.status(400).json({ error: "Cannot delete the only folder in this workspace" });
      return;
    }
    const target = await prisma.notesFolder.findFirst({
      where: {
        workspaceId: folder.workspaceId,
        parentId: folder.parentId ?? null,
        id: { not: folderId },
      },
      orderBy: { position: "asc" },
    });
    if (!target) {
      res.status(500).json({ error: "No target folder" });
      return;
    }
    await prisma.note.updateMany({
      where: { folderId },
      data: { folderId: target.id },
    });
    await prisma.notesFolder.delete({ where: { id: folderId } });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete folder" });
  }
});

router.get("/notes", async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (!workspaceId) {
      res.status(400).json({ error: "workspaceId required" });
      return;
    }
    const folderId = req.query.folderId as string | undefined;
    const where =
      folderId === undefined || folderId === "all"
        ? { workspaceId }
        : { workspaceId, folderId };
    const notes = await prisma.note.findMany({
      where,
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
      include: noteInclude,
      take: 500,
    });
    res.json(notes.map(serializeNote));
  } catch {
    res.status(500).json({ error: "Failed to list notes" });
  }
});

router.get("/notes/:noteId/backlinks", async (req, res) => {
  try {
    const noteId = req.params.noteId;
    const links = await prisma.noteLink.findMany({
      where: { toNoteId: noteId },
      include: {
        fromNote: {
          select: { id: true, title: true, previewText: true, updatedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      links.map((l) => ({
        id: l.fromNote.id,
        title: l.fromNote.title,
        previewText: l.fromNote.previewText,
        updatedAt: l.fromNote.updatedAt.toISOString(),
      })),
    );
  } catch {
    res.status(500).json({ error: "Failed to load backlinks" });
  }
});

router.get("/notes/:noteId/forward-links", async (req, res) => {
  try {
    const noteId = req.params.noteId;
    const links = await prisma.noteLink.findMany({
      where: { fromNoteId: noteId },
      include: {
        toNote: {
          select: { id: true, title: true, previewText: true, updatedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      links.map((l) => ({
        id: l.toNote.id,
        title: l.toNote.title,
        previewText: l.toNote.previewText,
        updatedAt: l.toNote.updatedAt.toISOString(),
      })),
    );
  } catch {
    res.status(500).json({ error: "Failed to load forward links" });
  }
});

router.get("/notes/:noteId", async (req, res) => {
  try {
    const note = await prisma.note.findUnique({
      where: { id: req.params.noteId },
      include: noteInclude,
    });
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json(serializeNote(note));
  } catch {
    res.status(500).json({ error: "Failed to load note" });
  }
});

/** Refine quick-capture draft using workspace + notebook + optional Brand Center (client-supplied) context. */
router.post("/quick-capture/enrich", async (req, res) => {
  try {
    const openai = getOpenAIOrNull();
    if (!openai) {
      res.status(503).json({
        error: "AI service unavailable",
        detail: aiServiceUnavailableDetail(),
      });
      return;
    }
    const body = req.body as {
      workspaceId?: string;
      folderId?: string;
      title?: string;
      rawText?: string;
      /** Preferred: merged kit (API) + Rapid Router from `getBrandContextForAI`. */
      brandCenterContext?: string | null;
      /** Legacy: rapid-only when brandCenterContext omitted. */
      brandRapidCaptureContext?: string | null;
    };
    const workspaceId = body.workspaceId?.trim();
    const folderId = body.folderId?.trim();
    const rawText = body.rawText?.trim() ?? "";
    if (!workspaceId || !folderId) {
      res.status(400).json({ error: "workspaceId and folderId required" });
      return;
    }
    if (rawText.length < 1) {
      res.status(400).json({ error: "Add some note text to refine" });
      return;
    }
    if (rawText.length > 50000) {
      res.status(400).json({ error: "Note text too long" });
      return;
    }

    const [workspace, folder] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          brand: { select: { brandProfile: true } },
        },
      }),
      prisma.notesFolder.findUnique({ where: { id: folderId }, select: { id: true, workspaceId: true, title: true } }),
    ]);
    if (!workspace || !folder) {
      res.status(404).json({ error: "Workspace or notebook not found" });
      return;
    }
    if (folder.workspaceId !== workspace.id) {
      res.status(400).json({ error: "Notebook does not belong to workspace" });
      return;
    }

    const mergedFromClient = (body.brandCenterContext ?? "").trim();
    const rapidOnly = (body.brandRapidCaptureContext ?? "").trim();
    const dbKit = formatBrandProfileForPrompt(workspace.brand?.brandProfile ?? null);
    const kitMarker = "## Company brand kit (authoritative for this workspace)";
    let brandSection = "";
    if (mergedFromClient.length) {
      const merged =
        mergedFromClient.length > 14_000 ? `${mergedFromClient.slice(0, 14_000)}\n…(truncated)` : mergedFromClient;
      if (dbKit && !merged.includes(kitMarker)) {
        brandSection = `${dbKit}\n\n---\n\nSupplemental (client bundle, incl. Rapid Router):\n${merged}`;
      } else {
        brandSection = merged;
      }
    } else {
      const rapid = rapidOnly.length > 8000 ? `${rapidOnly.slice(0, 8000)}\n…(truncated)` : rapidOnly;
      brandSection = [dbKit, rapid ? `Rapid Router quick captures (device):\n${rapid}` : ""].filter(Boolean).join("\n\n");
    }
    const draftTitle = (body.title ?? "").trim().slice(0, 500);

    const system = `You refine rough quick-capture notes into clear, usable content. Respond with valid JSON only (no markdown fences), using this exact shape: {"title":"string","body":"string"}.
Rules:
- title: concise, specific, at most 120 characters.
- body: plain text only; use blank lines between paragraphs; optional simple bullet lines with leading "- ".
- Connect the writing to the workspace and notebook when it helps the reader.
- When the company brand kit or Brand Center snippets describe positioning, tone, audience, or vocabulary, align emphasis and wording with them. Do not invent facts not present in the draft or brand context.
- Preserve specific facts, names, dates, and numbers from the user's draft.`;

    const userPayload = [
      `Workspace: ${workspace.name}`,
      `Notebook: ${folder.title}`,
      brandSection
        ? `Brand context (saved kit + Rapid Router when applicable):\n${brandSection}`
        : "(No brand context — consider filling Brand Center for this workspace.)",
      draftTitle ? `Working title: ${draftTitle}` : "Working title: (none)",
      `Draft:\n${rawText}`,
    ].join("\n\n");

    const completion = await openai.chat.completions.create({
      model: chatModel("jsonQuick"),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPayload },
      ],
      temperature: 0.45,
    });

    const rawJson = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let parsed: { title?: unknown; body?: unknown };
    try {
      parsed = JSON.parse(rawJson) as { title?: unknown; body?: unknown };
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON" });
      return;
    }
    const titleOut = typeof parsed.title === "string" ? parsed.title.trim().slice(0, 500) : "";
    const bodyOut = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!titleOut || !bodyOut) {
      res.status(500).json({ error: "AI returned empty title or body" });
      return;
    }
    res.json({ title: titleOut, body: bodyOut });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Quick capture enrich failed" });
  }
});

const NOTE_AI_EXTRA_CONTEXT_MAX = 4000;

function withNoteAiExtraContext(baseUserContent: string, extraContext: string): string {
  const t = extraContext.trim();
  if (!t) return baseUserContent;
  const capped = t.slice(0, NOTE_AI_EXTRA_CONTEXT_MAX);
  return `${baseUserContent}\n\n---\n\nAdditional instructions / context from the author:\n${capped}`;
}

router.post("/notes/:noteId/ai", async (req, res) => {
  try {
    const openai = getOpenAIOrNull();
    if (!openai) {
      res.status(503).json({
        error: "AI service unavailable",
        detail: aiServiceUnavailableDetail(),
      });
      return;
    }
    const body = req.body as { action?: string; extraContext?: string };
    const action = body.action;
    if (!action || !["summarize", "rewrite", "suggestTags", "notebookLinking"].includes(action)) {
      res.status(400).json({ error: "action must be summarize | rewrite | suggestTags | notebookLinking" });
      return;
    }
    const extraContext =
      typeof body.extraContext === "string" ? body.extraContext.trim().slice(0, NOTE_AI_EXTRA_CONTEXT_MAX) : "";
    const note = await prisma.note.findUnique({ where: { id: req.params.noteId } });
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    const text = extractFullPlainText(note.contentJson);
    const title = note.title;

    if (action === "summarize") {
      const userContent = withNoteAiExtraContext(
        `Summarize this note in 2-5 sentences. Title: "${title}"\n\n${text || "(empty note)"}`,
        extraContext,
      );
      const completion = await openai.chat.completions.create({
        model: chatModel("primary"),
        messages: [
          { role: "system", content: "You are a concise note summarizer." },
          {
            role: "user",
            content: userContent,
          },
        ],
      });
      const result = completion.choices[0]?.message?.content ?? "";
      res.json({ result });
      return;
    }

    if (action === "rewrite") {
      const userContent = withNoteAiExtraContext(`Title: "${title}"\n\n${text || "(empty note)"}`, extraContext);
      const completion = await openai.chat.completions.create({
        model: chatModel("primary"),
        messages: [
          {
            role: "system",
            content:
              "Rewrite for clarity and scannability. Keep the author's meaning. Output plain text only; use blank lines between paragraphs.",
          },
          { role: "user", content: userContent },
        ],
      });
      const result = completion.choices[0]?.message?.content ?? "";
      res.json({ result });
      return;
    }

    if (action === "notebookLinking") {
      const links = await prisma.noteLink.findMany({
        where: { OR: [{ fromNoteId: note.id }, { toNoteId: note.id }] },
        include: {
          fromNote: { select: { id: true, title: true, previewText: true } },
          toNote: { select: { id: true, title: true, previewText: true } },
        },
      });
      const neighborLines = links.map((l) => {
        const other = l.fromNoteId === note.id ? l.toNote : l.fromNote;
        const prev = (other.previewText ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
        return `- ${other.title}${prev ? ` — ${prev}` : ""} (id: ${other.id})`;
      });
      const workspace = await prisma.workspace.findUnique({
        where: { id: note.workspaceId },
        select: { brand: { select: { brandProfile: true } } },
      });
      const brandSection = formatBrandProfileForPrompt(workspace?.brand?.brandProfile ?? null);

      const system = `You are the notebook linking assistant. Suggest how this note connects to linked notes, what implications to track, and 1–3 concrete link ideas the author could add. Be concise. If there are no linked notes, suggest what kinds of notes might connect later. Output plain text with short sections: Connections, Implications, Suggested next links.`;
      const userBlock = withNoteAiExtraContext(
        [
          brandSection ? `Brand context (summary):\n${brandSection.slice(0, 6000)}` : "",
          `Note title: ${title}`,
          `Note body:\n${text || "(empty)"}`,
          neighborLines.length
            ? `Linked notes:\n${neighborLines.join("\n")}`
            : "Linked notes: (none yet)",
        ]
          .filter(Boolean)
          .join("\n\n"),
        extraContext,
      );

      const completion = await openai.chat.completions.create({
        model: chatModel("primary"),
        messages: [
          { role: "system", content: system },
          { role: "user", content: userBlock },
        ],
      });
      const result = completion.choices[0]?.message?.content ?? "";
      res.json({ result });
      return;
    }

    const tagUserContent = withNoteAiExtraContext(
      `Suggest tags for this note.\nTitle: "${title}"\n\n${text || ""}`,
      extraContext,
    );
    const completion = await openai.chat.completions.create({
      model: chatModel("mini"),
      messages: [
        {
          role: "system",
          content:
            'Reply with JSON only in this shape: {"tags":["tag1","tag2"]}. At most 5 short tags, lowercase, single words or hyphenated. No # or quotes inside strings.',
        },
        { role: "user", content: tagUserContent },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      const parsed = JSON.parse(cleaned) as { tags?: unknown };
      const arr = Array.isArray(parsed.tags) ? parsed.tags : [];
      const tags = arr
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean)
        .slice(0, 5);
      res.json({ tags });
    } catch {
      res.json({ tags: [] as string[] });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "AI request failed" });
  }
});

router.post("/notes", async (req, res) => {
  try {
    const body = req.body as {
      workspaceId?: string;
      folderId?: string | null;
      title?: string;
      contentJson?: unknown | null;
      previewText?: string | null;
      routingSource?: string | null;
    };
    if (!body.workspaceId) {
      res.status(400).json({ error: "workspaceId required" });
      return;
    }
    let folderId = body.folderId ?? null;
    if (!folderId) {
      const f = await ensureDefaultNotesFolder(body.workspaceId);
      folderId = f.id;
    }
    const maxOrder = await prisma.note.aggregate({
      where: { workspaceId: body.workspaceId, folderId },
      _max: { position: true },
    });
    const position = (maxOrder._max.position ?? -1) + 1;
    const routingSource =
      typeof body.routingSource === "string" && body.routingSource.trim()
        ? body.routingSource.trim().slice(0, 64)
        : undefined;

    const trimmedTitle = typeof body.title === "string" ? body.title.trim() : "";
    let resolvedTitle: string;
    if (trimmedTitle) {
      resolvedTitle = trimmedTitle;
    } else {
      const existingTitles = await prisma.note.findMany({
        where: { workspaceId: body.workspaceId, folderId },
        select: { title: true },
      });
      resolvedTitle = nextSequencedTitle(
        existingTitles.map((r) => r.title),
        DEFAULT_NOTE_BASE,
      );
    }

    const note = await prisma.note.create({
      data: {
        workspaceId: body.workspaceId,
        folderId,
        title: resolvedTitle,
        ...(body.contentJson !== undefined
          ? {
              contentJson:
                body.contentJson === null
                  ? Prisma.DbNull
                  : (body.contentJson as Prisma.InputJsonValue),
            }
          : {}),
        ...(body.previewText !== undefined ? { previewText: body.previewText } : {}),
        ...(routingSource ? { routingSource } : {}),
      },
      include: noteInclude,
    });
    if (body.contentJson !== undefined && body.contentJson !== null) {
      await syncNoteLinksFromContent(note.id, body.workspaceId, body.contentJson);
    }
    res.status(201).json(serializeNote(note));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create note" });
  }
});

router.patch("/notes/reorder", async (req, res) => {
  try {
    const body = req.body as {
      workspaceId?: string;
      folderId?: string | null;
      orderedNoteIds?: string[];
    };
    if (!body.workspaceId || body.folderId === undefined || !Array.isArray(body.orderedNoteIds)) {
      res.status(400).json({ error: "workspaceId, folderId, orderedNoteIds required" });
      return;
    }
    const notes = await prisma.note.findMany({
      where: { workspaceId: body.workspaceId, folderId: body.folderId },
    });
    const valid = new Set(notes.map((n) => n.id));
    if (body.orderedNoteIds.length !== valid.size || body.orderedNoteIds.some((id) => !valid.has(id))) {
      res.status(400).json({ error: "Invalid note order for folder" });
      return;
    }
    await prisma.$transaction(
      body.orderedNoteIds.map((id, position) =>
        prisma.note.update({ where: { id }, data: { position } }),
      ),
    );
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to reorder notes" });
  }
});

router.patch("/notes/:noteId", async (req, res) => {
  try {
    const noteId = req.params.noteId;
    const body = req.body as {
      title?: string;
      contentJson?: unknown | null;
      previewText?: string | null;
      folderId?: string | null;
      slug?: string | null;
      isPinned?: boolean;
      isPublic?: boolean;
      publicSlug?: string | null;
      tagIds?: string[];
      position?: number;
      rowAccentColor?: string | null;
    };

    const existing = await prisma.note.findUnique({ where: { id: noteId } });
    if (!existing) {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    const noteAccent = normalizeRowAccentColor(body.rowAccentColor);
    if (body.rowAccentColor !== undefined && noteAccent === undefined && body.rowAccentColor !== null && body.rowAccentColor !== "") {
      res.status(400).json({ error: "rowAccentColor must be #RRGGBB or empty" });
      return;
    }

    const data: Prisma.NoteUpdateInput = {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.contentJson !== undefined
        ? {
            contentJson:
              body.contentJson === null
                ? Prisma.DbNull
                : (body.contentJson as Prisma.InputJsonValue),
          }
        : {}),
      ...(body.previewText !== undefined ? { previewText: body.previewText } : {}),
      ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
      ...(body.slug !== undefined ? { slug: body.slug } : {}),
      ...(body.isPinned !== undefined ? { isPinned: body.isPinned } : {}),
      ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
      ...(body.rowAccentColor !== undefined ? { rowAccentColor: noteAccent ?? null } : {}),
      ...(body.publicSlug !== undefined
        ? {
            publicSlug:
              body.publicSlug === null || body.publicSlug === ""
                ? null
                : normalizePublicSlug(body.publicSlug),
          }
        : {}),
    };

    if (body.tagIds !== undefined) {
      data.tags = { set: body.tagIds.map((id) => ({ id })) };
    }

    const note = await prisma.note.update({
      where: { id: noteId },
      data,
      include: noteInclude,
    });
    if (body.contentJson !== undefined) {
      await syncNoteLinksFromContent(noteId, existing.workspaceId, note.contentJson);
    }
    res.json(serializeNote(note));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update note" });
  }
});

/** Mail Clerk–style autotag: merge AI-picked workspace tags onto the note (routing index + vocabulary). */
router.post("/notes/:noteId/mail-clerk-autotag", async (req, res) => {
  try {
    const openai = getOpenAIOrNull();
    if (!openai) {
      res.status(503).json({
        error: "AI service unavailable",
        detail: aiServiceUnavailableDetail(),
      });
      return;
    }
    const noteId = req.params.noteId;
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      include: { tags: true },
    });
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    const workspaceTags = await prisma.noteTag.findMany({
      where: { workspaceId: note.workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    if (!workspaceTags.length) {
      res.status(409).json({
        error: "No workspace tags",
        detail: "Create at least one workspace tag before using Mail Clerk autotag.",
      });
      return;
    }

    const plain = extractFullPlainText(note.contentJson);
    const picked = await runMailClerkNotebookAutotag(openai, {
      workspaceId: note.workspaceId,
      noteTitle: note.title,
      notePlainText: plain,
      tagsOnNoteNames: note.tags.map((t) => t.name),
      tagVocabulary: workspaceTags.map((t) => ({ name: t.name })),
    });

    const nameToId = new Map(workspaceTags.map((t) => [t.name.toLowerCase(), t.id]));
    const newIds = picked.map((n) => nameToId.get(n.toLowerCase())).filter((id): id is string => Boolean(id));
    const mergedIds = [...new Set([...note.tags.map((t) => t.id), ...newIds])];

    const updated = await prisma.note.update({
      where: { id: noteId },
      data: { tags: { set: mergedIds.map((id) => ({ id })) } },
      include: noteInclude,
    });
    res.json(serializeNote(updated));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Mail Clerk autotag failed" });
  }
});

router.delete("/notes/:noteId", async (req, res) => {
  try {
    await prisma.note.delete({ where: { id: req.params.noteId } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete note" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q as string) ?? "";
    const workspaceId = req.query.workspaceId as string | undefined;
    if (!workspaceId) {
      res.status(400).json({ error: "workspaceId required" });
      return;
    }
    const term = q.trim();
    if (!term) {
      res.json([]);
      return;
    }
    const notes = await prisma.note.findMany({
      where: {
        workspaceId,
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { previewText: { contains: term, mode: "insensitive" } },
        ],
      },
      take: 50,
      include: noteInclude,
      orderBy: { updatedAt: "desc" },
    });
    res.json(notes.map(serializeNote));
  } catch {
    res.status(500).json({ error: "Search failed" });
  }
});

router.post("/tags", async (req, res) => {
  try {
    const body = req.body as { workspaceId?: string; name?: string; color?: string };
    if (!body.workspaceId || !body.name?.trim()) {
      res.status(400).json({ error: "workspaceId and name required" });
      return;
    }
    const name = body.name.trim();
    try {
      const tag = await prisma.noteTag.create({
        data: {
          workspaceId: body.workspaceId,
          name,
          color: body.color ?? "#6366f1",
        },
      });
      res.status(201).json(serializeTag(tag));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const existing = await prisma.noteTag.findFirst({
          where: { workspaceId: body.workspaceId, name },
        });
        if (existing) {
          res.json(serializeTag(existing));
          return;
        }
      }
      throw e;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create tag" });
  }
});

router.get("/tags", async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (!workspaceId) {
      res.status(400).json({ error: "workspaceId required" });
      return;
    }
    const tags = await prisma.noteTag.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    });
    res.json(
      tags.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    );
  } catch {
    res.status(500).json({ error: "Failed to list tags" });
  }
});

router.delete("/tags/:tagId", async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    const tagId = req.params.tagId?.trim();
    if (!workspaceId?.trim()) {
      res.status(400).json({ error: "workspaceId required" });
      return;
    }
    if (!tagId) {
      res.status(400).json({ error: "tagId required" });
      return;
    }
    const tag = await prisma.noteTag.findFirst({
      where: { id: tagId, workspaceId: workspaceId.trim() },
    });
    if (!tag) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }
    await prisma.noteTag.delete({ where: { id: tag.id } });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

export default router;
