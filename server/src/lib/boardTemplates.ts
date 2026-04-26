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
    id: "single_list",
    name: "Single list",
    description: "One column to start from scratch.",
    lists: [{ title: "Tasks", key: null }],
  },
  {
    id: "discovery_pipeline",
    name: "Discovery pipeline",
    description: "Research and shaped work from intake through review to outcomes.",
    lists: [
      { title: "Intake", key: "backlog" },
      { title: "In focus", key: "in_progress" },
      { title: "In review", key: null },
      { title: "Done", key: "done" },
    ],
  },
  {
    id: "engagement_program",
    name: "Engagement program",
    description: "Timeboxed program: kick off, deliver, stabilize, and close out.",
    lists: [
      { title: "Kickoff", key: "backlog" },
      { title: "In delivery", key: "in_progress" },
      { title: "Stabilize", key: null },
      { title: "Closeout", key: "done" },
    ],
  },
  {
    id: "launch_cadence",
    name: "Launch cadence",
    description: "Plan, build, ship, and learn for GTM or a release window.",
    lists: [
      { title: "Plan", key: "backlog" },
      { title: "Build", key: "in_progress" },
      { title: "Ship", key: null },
      { title: "Learn", key: "done" },
    ],
  },
  {
    id: "run_and_change",
    name: "Run and change",
    description: "Queue work, run it, verify, and close the loop (operations and change).",
    lists: [
      { title: "Intake", key: "backlog" },
      { title: "Active", key: "in_progress" },
      { title: "Verifying", key: null },
      { title: "Closed", key: "done" },
    ],
  },
  {
    id: "program_portfolio",
    name: "Program portfolio",
    description: "Funnel to execution, status, and achieved outcomes (portfolio review).",
    lists: [
      { title: "Funnel", key: "backlog" },
      { title: "In flight", key: "in_progress" },
      { title: "Status", key: null },
      { title: "Achieved", key: "done" },
    ],
  },
];

export const DEFAULT_TEMPLATE_LABELS = [
  { name: "Bug", color: "#ef4444" },
  { name: "Feature", color: "#22c55e" },
  { name: "Chore", color: "#64748b" },
] as const;
