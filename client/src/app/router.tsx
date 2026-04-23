import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { BoardPage } from "@/pages/BoardPage";
import { BoardsPage } from "@/pages/BoardsPage";
import { DefaultBoardRedirect } from "@/pages/DefaultBoardRedirect";
import { BrainstormPage } from "@/pages/BrainstormPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { ChatPage } from "@/pages/ChatPage";
import { ContactPage } from "@/pages/ContactPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { HomePage } from "@/pages/HomePage";
import { RapidRouterPage } from "@/pages/RapidRouterPage";
import { RequireAuthAppLayout } from "@/components/auth/RequireAuthAppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { BrandCenterPage } from "@/pages/BrandCenterPage";
import { ModulePlaceholderPage } from "@/pages/ModulePlaceholderPage";
import { MyTasksPage } from "@/pages/MyTasksPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { NotesPage } from "@/pages/NotesPage";
import { PublicNotePage } from "@/pages/PublicNotePage";
import { ServicesPage } from "@/pages/ServicesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SolutionsPage } from "@/pages/SolutionsPage";
import { TasksPage } from "@/pages/TasksPage";
import { BookOpen, Zap } from "lucide-react";

function BoardsSection() {
  return <Outlet />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "services", element: <ServicesPage /> },
      { path: "solutions", element: <SolutionsPage /> },
      { path: "contact", element: <ContactPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "n/:publicSlug", element: <PublicNotePage /> },
    ],
  },
  {
    path: "/app",
    element: <RequireAuthAppLayout />,
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "home", element: <DashboardPage /> },
      { path: "inbox", element: <Navigate to="/app/rapid-router" replace /> },
      { path: "rapid-router", element: <RapidRouterPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "my-tasks", element: <MyTasksPage /> },
      { path: "tasks", element: <TasksPage /> },
      {
        path: "boards",
        element: <BoardsSection />,
        children: [
          { index: true, element: <BoardsPage /> },
          { path: ":boardId", element: <BoardPage /> },
        ],
      },
      { path: "board", element: <DefaultBoardRedirect /> },
      { path: "calendar", element: <CalendarPage /> },
      {
        path: "docs",
        element: (
          <ModulePlaceholderPage
            title="Docs"
            description="Project docs and notes linked to tasks — wireframe for the knowledge layer."
            icon={BookOpen}
          />
        ),
      },
      { path: "goals", element: <Navigate to="/app/brand-center" replace /> },
      { path: "brand-center", element: <BrandCenterPage /> },
      {
        path: "automations",
        element: (
          <ModulePlaceholderPage
            title="Automations"
            description="Rule builder, triggers, and actions — foundation hooks live in the API layer."
            icon={Zap}
          />
        ),
      },
      { path: "brainstorm", element: <BrainstormPage /> },
      { path: "notes", element: <NotesPage /> },
      { path: "chat", element: <ChatPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
