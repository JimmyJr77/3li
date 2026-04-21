export type BoardTemplateList = { title: string; key: string | null };

export type BoardTemplate = {
  id: string;
  name: string;
  description: string;
  lists: BoardTemplateList[];
};

/** In-memory templates for `POST .../boards/from-template` (no DB table yet). */
export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "simple_kanban",
    name: "Simple kanban",
    description: "Backlog, in progress, and done — the default shape.",
    lists: [
      { title: "Backlog", key: "backlog" },
      { title: "In progress", key: "in_progress" },
      { title: "Done", key: "done" },
    ],
  },
  {
    id: "software_sprint",
    name: "Software sprint",
    description: "Adds a review column before done.",
    lists: [
      { title: "Backlog", key: "backlog" },
      { title: "In progress", key: "in_progress" },
      { title: "In review", key: null },
      { title: "Done", key: "done" },
    ],
  },
  {
    id: "ops_triage",
    name: "Ops triage",
    description: "New → triaged → scheduled → complete.",
    lists: [
      { title: "New", key: "backlog" },
      { title: "Triaged", key: null },
      { title: "Scheduled", key: "in_progress" },
      { title: "Complete", key: "done" },
    ],
  },
  {
    id: "single_list",
    name: "Single list",
    description: "One column to start from scratch.",
    lists: [{ title: "Tasks", key: null }],
  },
];

export const DEFAULT_TEMPLATE_LABELS = [
  { name: "Bug", color: "#ef4444" },
  { name: "Feature", color: "#22c55e" },
  { name: "Chore", color: "#64748b" },
] as const;
