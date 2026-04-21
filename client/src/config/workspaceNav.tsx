import type { ComponentType } from "react";
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
  Settings,
  StickyNote,
  Zap,
} from "lucide-react";
import { RapidRouterIcon } from "@/components/shared/RapidRouterIcon";

export type WorkspaceNavIcon = ComponentType<{ className?: string }>;

export const workspaceNavSections: readonly {
  readonly items: readonly { readonly to: string; readonly label: string; readonly icon: WorkspaceNavIcon }[];
}[] = [
  {
    items: [
      { to: "/app/dashboard", label: "Home", icon: Home },
      { to: "/app/notifications", label: "Activity", icon: Bell },
      { to: "/app/goals", label: "Brand Center", icon: Goal },
    ],
  },
  {
    items: [
      { to: "/app/rapid-router", label: "Rapid Router", icon: RapidRouterIcon },
      { to: "/app/notes", label: "Notebooks", icon: StickyNote },
      { to: "/app/brainstorm", label: "Brainstorm Studio", icon: Lightbulb },
      { to: "/app/boards", label: "Project Boards", icon: LayoutGrid },
      { to: "/app/my-tasks", label: "Task Lists", icon: ListTodo },
      { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    items: [
      { to: "/app/automations", label: "Automations", icon: Zap },
      { to: "/app/chat", label: "AI Consultant", icon: MessageSquare },
    ],
  },
  {
    items: [
      { to: "/app/docs", label: "Docs", icon: BookOpen },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];
