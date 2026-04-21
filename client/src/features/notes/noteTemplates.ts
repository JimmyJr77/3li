import type { AtlasNoteDto } from "./types";

export type NoteTemplate = {
  id: string;
  title: string;
  description: string;
  /** TipTap JSON document */
  contentJson: unknown;
};

/** Built-in starter layouts — applied when creating a note from a template. */
export const BUILTIN_NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "daily",
    title: "Daily journal",
    description: "Quick bullets for wins, blockers, and next steps.",
    contentJson: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Today" }],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Win: " }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Focus: " }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Tomorrow: " }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "meeting",
    title: "Meeting notes",
    description: "Agenda, discussion, decisions, and follow-ups.",
    contentJson: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Attendees: " }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Agenda" }],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }] },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Decisions" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Action items" }],
        },
      ],
    },
  },
  {
    id: "project",
    title: "Project brief",
    description: "Goal, scope, risks, and links.",
    contentJson: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Goal" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Scope / non-goals" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Risks" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Links — use [[Another note]] to connect ideas." }],
        },
      ],
    },
  },
];

export function templateSeedTitle(template: NoteTemplate): string {
  return template.title;
}

/** Shape used when rehydrating from export JSON (ids stripped before create). */
export type TemplateLikeBody = Pick<AtlasNoteDto, "title" | "contentJson" | "previewText">;
