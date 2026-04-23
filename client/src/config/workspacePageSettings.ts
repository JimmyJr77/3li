import { RapidRouterIcon } from "@/components/shared/RapidRouterIcon";
import {
  Bell,
  BookOpen,
  CalendarDays,
  Goal,
  Home,
  LayoutGrid,
  Lightbulb,
  ListTodo,
  MessageSquare,
  StickyNote,
  Zap,
} from "lucide-react";

export const WORKSPACE_PAGE_SETTINGS = [
  {
    id: "wp-dashboard",
    to: "/app/dashboard",
    label: "Home",
    description: "Workspace home and quick links to tools.",
    icon: Home,
  },
  {
    id: "wp-notifications",
    to: "/app/notifications",
    label: "Activity Tracker",
    description: "Recent task activity in the active brand workspace, including who performed each action.",
    icon: Bell,
  },
  {
    id: "wp-brand-center",
    to: "/app/brand-center",
    label: "Brand Center",
    description: "Brand kit, voice, and positioning used across AI and delivery tools.",
    icon: Goal,
  },
  {
    id: "wp-rapid-router",
    to: "/app/rapid-router",
    label: "Rapid Router",
    description: "Capture and route text into backlog, notes, or brainstorm.",
    icon: RapidRouterIcon,
  },
  {
    id: "wp-notes",
    to: "/app/notes",
    label: "Notebooks",
    description: "Notebooks, notes, and the rich text editor.",
    icon: StickyNote,
  },
  {
    id: "wp-brainstorm",
    to: "/app/brainstorm",
    label: "Brainstorm",
    description: "Studio boards and structured ideation.",
    icon: Lightbulb,
  },
  {
    id: "wp-boards",
    to: "/app/boards",
    label: "Project Boards",
    description: "Kanban boards, templates, and project spaces — rename spaces and boards below without leaving Settings.",
    icon: LayoutGrid,
  },
  {
    id: "wp-my-tasks",
    to: "/app/my-tasks",
    label: "Task Lists",
    description: "Your tasks across boards in the active project space.",
    icon: ListTodo,
  },
  {
    id: "wp-calendar",
    to: "/app/calendar",
    label: "Calendar",
    description: "Due dates on a month grid.",
    icon: CalendarDays,
  },
  {
    id: "wp-automations",
    to: "/app/automations",
    label: "Automations",
    description: "Rules, triggers, and actions (foundation in progress).",
    icon: Zap,
  },
  {
    id: "wp-chat",
    to: "/app/chat",
    label: "AI Consultant",
    description: "Chat with the AI consultant for the active brand context.",
    icon: MessageSquare,
  },
  {
    id: "wp-docs",
    to: "/app/docs",
    label: "Docs",
    description: "Project documentation layer (wireframe).",
    icon: BookOpen,
  },
] as const;

export type WorkspacePageSettingsId = (typeof WORKSPACE_PAGE_SETTINGS)[number]["id"];

export function isWorkspacePageSettingsId(id: string): id is WorkspacePageSettingsId {
  return WORKSPACE_PAGE_SETTINGS.some((p) => p.id === id);
}
