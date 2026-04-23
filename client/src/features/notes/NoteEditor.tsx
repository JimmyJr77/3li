import type { Editor, JSONContent } from "@tiptap/core";
import type { Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { patchNote, type PatchNoteBody } from "./api";
import { extractPreviewFromDoc } from "./extractPreview";
import { noteEditorExtensions } from "./noteEditorExtensions";
import { NoteEditorToolbar } from "./NoteEditorToolbar";
import type { AtlasNoteDto } from "./types";

const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/** Inline images are stored as data URLs in note JSON; cap size to keep saves reasonable. */
const MAX_NOTEBOOK_IMAGE_BYTES = 8 * 1024 * 1024;
/** Non-image files are embedded as `data:` links; smaller cap than images. */
const MAX_NOTEBOOK_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const editorSurfaceClass =
  "max-w-none text-sm leading-relaxed text-foreground focus:outline-none [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 " +
  "[&_h1]:my-3 [&_h1]:scroll-mt-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:my-2.5 [&_h2]:scroll-mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:my-2 [&_h3]:scroll-mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:my-2 [&_h4]:scroll-mt-4 [&_h4]:text-base [&_h4]:font-semibold [&_h5]:my-2 [&_h5]:scroll-mt-4 [&_h5]:text-sm [&_h5]:font-semibold [&_h5]:uppercase [&_h5]:tracking-wide [&_h6]:my-2 [&_h6]:scroll-mt-4 [&_h6]:text-xs [&_h6]:font-semibold [&_h6]:uppercase [&_h6]:tracking-wide [&_h6]:text-muted-foreground " +
  "[&_ul:not([data-type=taskList]):not(.atlas-note-task-list)]:list-disc [&_ul:not([data-type=taskList]):not(.atlas-note-task-list)]:ps-6 " +
  "[&_ol]:list-decimal [&_ol]:ps-6 " +
  "[&_a]:break-words [&_img.atlas-note-image]:my-2 [&_img.atlas-note-image]:max-w-full [&_img.atlas-note-image]:h-auto [&_img.atlas-note-image]:rounded-md [&_img.atlas-note-image]:border [&_img.atlas-note-image]:border-border " +
  "[&_table]:my-3 [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_td]:border [&_th]:border [&_td]:border-border [&_th]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2 [&_th]:py-1.5 [&_th]:bg-muted/50 [&_th]:text-left";

function listFilesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const seen = new Set<string>();
  const out: File[] = [];
  const add = (f: File | null) => {
    if (!f) return;
    const key = `${f.name}-${f.size}-${f.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(f);
  };
  for (const f of Array.from(dt.files ?? [])) add(f);
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === "file") add(item.getAsFile());
  }
  return out;
}

function listFilesFromClipboard(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const out: File[] = [];
  if (dt.files?.length) {
    for (const f of Array.from(dt.files)) out.push(f);
    return out;
  }
  const { items } = dt;
  if (!items?.length) return out;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || item.kind !== "file") continue;
    const f = item.getAsFile();
    if (f) out.push(f);
  }
  return out;
}

function readFileAsDataUrlUnderCap(file: File, maxBytes: number): Promise<string | null> {
  if (file.size > maxBytes) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
    fr.onerror = () => reject(new Error("Failed to read file"));
    fr.readAsDataURL(file);
  });
}

async function buildNotebookFileInserts(files: File[]): Promise<{
  nodes: JSONContent[];
  skippedOversizedImages: number;
  skippedOversizedAttachments: number;
}> {
  const nodes: JSONContent[] = [];
  let skippedOversizedImages = 0;
  let skippedOversizedAttachments = 0;
  for (const file of files) {
    if (file.type.startsWith("image/")) {
      if (file.size > MAX_NOTEBOOK_IMAGE_BYTES) {
        skippedOversizedImages += 1;
        continue;
      }
      try {
        const src = await readFileAsDataUrlUnderCap(file, MAX_NOTEBOOK_IMAGE_BYTES);
        if (src) nodes.push({ type: "image", attrs: { src } });
      } catch {
        /* skip */
      }
    } else {
      if (file.size > MAX_NOTEBOOK_ATTACHMENT_BYTES) {
        skippedOversizedAttachments += 1;
        continue;
      }
      try {
        const href = await readFileAsDataUrlUnderCap(file, MAX_NOTEBOOK_ATTACHMENT_BYTES);
        if (href) {
          nodes.push({
            type: "paragraph",
            content: [
              {
                type: "text",
                text: file.name || "Attachment",
                marks: [
                  {
                    type: "link",
                    attrs: { href, target: "_blank", rel: "noopener noreferrer" },
                  },
                ],
              },
            ],
          });
        }
      } catch {
        /* skip */
      }
    }
  }
  return { nodes, skippedOversizedImages, skippedOversizedAttachments };
}

async function insertNotebookFiles(editor: Editor, insertPos: number | null, files: File[]): Promise<void> {
  const { nodes, skippedOversizedImages, skippedOversizedAttachments } = await buildNotebookFileInserts(files);
  if (skippedOversizedImages > 0) {
    window.alert(
      `Skipped ${skippedOversizedImages} image(s) larger than ${Math.round(MAX_NOTEBOOK_IMAGE_BYTES / (1024 * 1024))} MB.`,
    );
  }
  if (skippedOversizedAttachments > 0) {
    window.alert(
      `Skipped ${skippedOversizedAttachments} file(s) larger than ${Math.round(MAX_NOTEBOOK_ATTACHMENT_BYTES / (1024 * 1024))} MB.`,
    );
  }
  if (!nodes.length) return;
  const pos = insertPos ?? editor.state.selection.from;
  editor.chain().focus().setTextSelection(pos).insertContent(nodes).run();
}

export function NoteEditor({
  note,
  onSaved,
  persistNote,
}: {
  note: AtlasNoteDto;
  onSaved?: () => void;
  /** When set (e.g. browser-only mode), saves without calling the HTTP API */
  persistNote?: (noteId: string, body: Pick<PatchNoteBody, "contentJson" | "previewText">) => Promise<void>;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerialized = useRef<string>("");
  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bodyChromeRef = useRef<HTMLDivElement | null>(null);
  /** True while focus is in the note body (editor or its toolbar); hides chrome when reading. */
  const [bodyWorkSurfaceActive, setBodyWorkSurfaceActive] = useState(false);

  const editorProps = useMemo(
    () => ({
      attributes: { class: editorSurfaceClass },
      handleDOMEvents: {
        dragover: (_view: EditorView, event: Event) => {
          const e = event as DragEvent;
          if (e.dataTransfer?.types?.includes("Files")) {
            e.preventDefault();
          }
          return false;
        },
      },
      handleDrop(view: EditorView, event: DragEvent, _slice: Slice, moved: boolean) {
        if (moved) return false;
        const ed = editorRef.current;
        if (!ed?.isEditable) return false;
        const files = listFilesFromDataTransfer(event.dataTransfer);
        if (!files.length) return false;
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (coords == null) return false;
        event.preventDefault();

        void (async () => {
          const current = editorRef.current;
          if (!current) return;
          await insertNotebookFiles(current, coords.pos, files);
        })();

        return true;
      },
      handlePaste(_view: EditorView, event: ClipboardEvent) {
        const ed = editorRef.current;
        if (!ed?.isEditable) return false;
        const files = listFilesFromClipboard(event.clipboardData);
        if (!files.length) return false;
        event.preventDefault();

        void (async () => {
          const current = editorRef.current;
          if (!current) return;
          await insertNotebookFiles(current, null, files);
        })();

        return true;
      },
    }),
    [],
  );

  const flushSave = useCallback(
    async (json: unknown, preview: string) => {
      const serialized = JSON.stringify(json);
      if (serialized === lastSerialized.current) return;
      lastSerialized.current = serialized;
      try {
        if (persistNote) {
          await persistNote(note.id, {
            contentJson: json,
            previewText: preview || null,
          });
        } else {
          await patchNote(note.id, {
            contentJson: json,
            previewText: preview || null,
          });
        }
        onSaved?.();
      } catch {
        window.alert("Could not save this note. Check your connection and try again.");
      }
    },
    [note.id, onSaved, persistNote],
  );

  const scheduleSave = useCallback(
    (json: unknown) => {
      const preview = extractPreviewFromDoc(json);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flushSave(json, preview);
      }, 750);
    },
    [flushSave],
  );

  const editor = useEditor({
    extensions: noteEditorExtensions,
    content: (note.contentJson as object | null) ?? EMPTY_DOC,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps,
    onUpdate: ({ editor: ed }) => {
      scheduleSave(ed.getJSON());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const json = note.contentJson as object | null;
    const next = json ?? EMPTY_DOC;
    const asString = JSON.stringify(next);
    lastSerialized.current = asString;
    editor.commands.setContent(next, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, note.id]);

  useEffect(() => {
    setBodyWorkSurfaceActive(false);
  }, [note.id]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(bodyWorkSurfaceActive);
  }, [editor, bodyWorkSurfaceActive]);

  useEffect(() => {
    if (!editor) return;
    const onFocus = () => {
      setBodyWorkSurfaceActive(true);
    };
    const onBlur = ({ event }: { event: FocusEvent }) => {
      const root = bodyChromeRef.current;
      const rt = event.relatedTarget as Node | null;
      if (root && rt && root.contains(rt)) return;
      setBodyWorkSurfaceActive(false);
    };
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    return () => {
      editor.off("focus", onFocus);
      editor.off("blur", onBlur);
    };
  }, [editor]);

  const activateBodyWorkSurface = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    setBodyWorkSurfaceActive(true);
    ed.setEditable(true);
    queueMicrotask(() => {
      ed.commands.focus();
    });
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (!editor) {
    return <div className="text-sm text-muted-foreground">Loading editor…</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[min(42vh,480px)] flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div ref={bodyChromeRef} className="flex min-h-0 flex-1 flex-col outline-none">
          {bodyWorkSurfaceActive ? (
            <div className="shrink-0 border-b border-border bg-muted/30">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const input = e.currentTarget;
                  const { files } = input;
                  input.value = "";
                  const ed = editorRef.current;
                  if (!files?.length || !ed) return;
                  void insertNotebookFiles(ed, null, Array.from(files));
                }}
              />
              <NoteEditorToolbar editor={editor} fileInputRef={fileInputRef} />
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className={cn(
                "notebooks-editor min-h-0 flex-1 overflow-y-auto px-3 py-2",
                !bodyWorkSurfaceActive && "cursor-text",
              )}
              onPointerDownCapture={(e) => {
                if (bodyWorkSurfaceActive || e.button !== 0) return;
                activateBodyWorkSurface();
              }}
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
