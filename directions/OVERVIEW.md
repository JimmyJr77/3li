1. Product Overview

Three Lions Industries (3LI) is a consulting operating system designed to centralize:

Strategy
Operations
Planning
Execution
AI-powered solutioning

The platform consists of:

A public-facing homepage
An authenticated workspace
A suite of consulting tools
A centralized AI service layer powered by OpenAI
2. Core Objectives
Build a modern, clean, high-end consulting platform
Maintain a consistent UI system (light/dark mode)
Provide modular tools for consulting workflows
Enable AI-assisted decision-making
Maximize speed of development and iteration
Avoid unnecessary infrastructure complexity
Ensure scalability with a clean architecture
3. Technology Stack
Frontend
React
TypeScript
Vite
UI System
Tailwind CSS
shadcn/ui
lucide-react
Routing
React Router
State / Data
TanStack Query (server state)
Zustand (light client state)
Backend
Node.js (Express OR Vercel serverless functions)
Prisma ORM
PostgreSQL
AI Layer
OpenAI API (server-side only)
Validation / Forms
Zod
React Hook Form
Hosting
Vercel
4. System Architecture
React Frontend
      ↓
API Layer (Node / Vercel)
      ↓
OpenAI Service Layer
      ↓
OpenAI Models

Database (Postgres + Prisma)

Critical Rule:
Never call OpenAI from the frontend. All AI calls must go through the backend.

5. Application Architecture
5.1 Public Layer

Routes:

/
/services
/solutions
/contact
/login
5.2 Authenticated Workspace

Routes:

/app/dashboard
/app/brainstorm
/app/tasks
/app/board
/app/notes
/app/chat
/app/settings
6. Core Modules
Phase 1 (MVP)
Brainstorming Studio
Task Manager
Kanban Board
Notes / Knowledge Base
AI Chat Assistant
Phase 2
Proposal Builder
Roadmap Planner
Client Workspaces
Template Library
Phase 3
CRM-lite
Decision Log
Automation workflows
AI-driven task pipelines
7. Design System Requirements
Global light/dark mode
Centralized design tokens
Consistent spacing, typography, and layout
Shared component library
No one-off styling
Clean, modern consulting aesthetic
8. Project Folder Structure
three-lions-industries/

  client/
    src/
      app/
        router.tsx
        providers.tsx

      components/
        ui/
        layout/
        shared/

      features/
        brainstorm/
        tasks/
        board/
        notes/
        chat/

      pages/
        HomePage.tsx
        ServicesPage.tsx
        SolutionsPage.tsx
        ContactPage.tsx
        LoginPage.tsx
        DashboardPage.tsx
        BrainstormPage.tsx
        TasksPage.tsx
        BoardPage.tsx
        NotesPage.tsx
        ChatPage.tsx
        SettingsPage.tsx

      hooks/
      lib/
        api/
        utils/
        validations/

      styles/
        globals.css
        tokens.css

      App.tsx
      main.tsx

  server/
    src/
      routes/
        ai.ts
        tasks.ts
        board.ts
        brainstorm.ts
        notes.ts

      lib/
        db.ts
        openai/
          client.ts
          prompts.ts
          orchestrator.ts

      index.ts

  prisma/
    schema.prisma

  docs/
    product-spec.md

  .env.example
9. OpenAI Service Layer
/server/src/lib/openai/client.ts
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
/server/src/lib/openai/prompts.ts
export const SYSTEM_PROMPT = `
You are a high-level consulting assistant.
You structure ideas, create plans, and generate actionable outputs.
`;

export const brainstormPrompt = (input: string) => `
Expand this idea into structured, high-quality concepts:

${input}
`;

export const taskPrompt = (input: string) => `
Turn this into a prioritized task list:

${input}
`;
/server/src/lib/openai/orchestrator.ts
import { openai } from "./client";
import { SYSTEM_PROMPT } from "./prompts";

export async function runAI(prompt: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message.content;
}
10. API Layer
/server/src/routes/ai.ts
import { Router } from "express";
import { runAI } from "../lib/openai/orchestrator";

const router = Router();

router.post("/chat", async (req, res) => {
  try {
    const { prompt } = req.body;

    const result = await runAI(prompt);

    res.json({ result });
  } catch {
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
11. Frontend AI Hook
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

export function useAI() {
  return useMutation({
    mutationFn: async (prompt: string) => {
      const res = await axios.post("/api/ai/chat", { prompt });
      return res.data.result;
    },
  });
}
12. Database Models (Prisma)
model Task {
  id        String @id @default(cuid())
  title     String
  completed Boolean @default(false)
}

(Expand later as needed)

13. Cursor Rules (cursor-rules.md)
- Use React + TypeScript + Vite
- Use React Router
- Use Tailwind + shadcn/ui only
- No inline styling hacks
- Keep components small and reusable
- Use TanStack Query for server state
- Use Zustand for lightweight UI state
- Use Zod for validation
- Keep OpenAI calls server-side only
- Modularize features by folder
- Add loading and error states everywhere
14. Cursor Build Prompt
Build a production-grade React consulting platform for Three Lions Industries.

Stack:
- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- React Router
- TanStack Query + Zustand
- Node backend (Express or Vercel serverless)
- Prisma + PostgreSQL
- OpenAI API (server-side only)

Features:
- Homepage
- Authenticated workspace
- Brainstorm tool
- Task manager
- Kanban board
- Notes system
- AI chat assistant

Requirements:
- Clean modern UI
- Consistent theming
- Modular architecture
- Server-side AI integration

Deliver:
- Folder structure
- Pages
- Layout system
- OpenAI service layer
- API routes
15. Build Order
Scaffold React app (Vite)
Install Tailwind + shadcn + theme system
Build router + app shell
Build homepage
Setup backend + Prisma
Build dashboard
Brainstorm tool
Task manager
Kanban board
Notes
AI chat
Polish and deploy
16. Final Vision

Three Lions Industries should function as:

A centralized consulting operating system where ideas become structured plans, plans become executable tasks, and execution is enhanced by AI.

17. Current implementation notes (Level 1 shell)

- **Monorepo:** npm workspaces — packages `client` (Vite + React) and `server` (Express). Prisma schema lives at repo root in `prisma/`.
- **Run locally:** From the repo root, `npm install` then `npm run dev` (starts Vite on port 5173 and the API on port 3001). See [production_steps/local-dev.md](production_steps/local-dev.md).
- **Build:** `npm run build` builds client then server. Prisma: `npm run db:generate`, `npm run db:migrate` or `npm run db:push`.
- **Client:** React Router with public layout (`/`, `/services`, `/solutions`, `/contact`, `/login`) and workspace layout under `/app/*`. TanStack Query + `next-themes` + shadcn/ui (Nova preset). API calls use relative `/api` with Vite proxy to the Express server.
- **Auth:** `/login` is a stub — form navigates to `/app/dashboard` without real sessions.
- **AI:** `POST /api/ai/chat` and `POST /api/ai/brainstorm` (thinking modes + canvas context) are implemented server-side; both return `503` if `OPENAI_API_KEY` is unset. The frontend must never call OpenAI directly.
- **Brainstorm Studio (`/app/brainstorm`):** Multiple **sessions** per project (`GET/POST/PATCH/DELETE /api/brainstorm/sessions`, canvas under `/api/brainstorm/sessions/:id`). URL query `?session=` selects the active session. React Flow canvas, Zustand, debounced autosave, toolbar save status. AI co-pilot includes quick actions plus a **prompt library** (overview §10); `/api/ai/brainstorm`. **Convert to plan** posts to `/api/brainstorm/sessions/:id/convert-plan` (legacy `/session/...` still works).
- **Tasks & board:** TaskFoundry API under `/api/task-app/*` (bootstrap, boards, flat `/tasks`, patch task). Kanban on `/app/board`; flat list on `/app/tasks` and `/app/my-tasks`.
- **Atlas Notes (`/app/notes`):** Vite + React UI with folders, note list, TipTap block editor, debounced autosave, tag pills + new-tag field, quick capture sheet (button and ⌘⇧C / Ctrl⇧C), **command palette** (⌘K / Ctrl+K: search notes, new note, quick capture, templates), **import/export JSON** + in-app **?note=** deep links, outgoing/backlink panels, **Publish** (public slug + copy link), and **AI** (summarize / rewrite / suggest tags via `POST /api/notes-app/notes/:id/ai`, needs `OPENAI_API_KEY`). If the API is down, notes continue in **browser storage** (Zustand + localStorage). Public read-only pages at **`/n/:publicSlug`** (same origin; API `GET /api/notes-app/public/:slug`). `[[Note title]]` in the body syncs `NoteLink` on save. API under `/api/notes-app/*`. Prisma models `NotesFolder`, `Note`, `NoteTag`, `NoteLink` scoped to `Workspace`. Run `npm run db:migrate` so the Atlas migration is applied.
- **Directions:** Instruction and tracking docs live under `Directions/production_steps/`. Brainstorm roadmap: `Directions/production_steps/tool-brainstorm/phases.md`. Atlas Notes roadmap: `Directions/production_steps/tool-notes/phases.md`. Preference notes for how you like work done go in `Directions/my_voice/` when added.

**Intentional deltas from section 8:** The repo uses `client/src/app/router.tsx` and `providers.tsx` as specified; `docs/product-spec.md` is not added yet. `docs/brainstorm-studio-spec.md` is a short pointer to `directions/production_steps/tool-brainstorm/`. Optional `client/src/styles/tokens.css` exists for future design tokens alongside shadcn CSS variables.