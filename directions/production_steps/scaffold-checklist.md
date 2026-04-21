# Level 1 scaffold checklist

Use this to confirm the shell is in place before building individual tools.

- [ ] `npm install` at repo root succeeds
- [ ] `npm run db:generate` runs without errors
- [ ] `npm run build` builds both `client` and `server`
- [ ] `npm run dev` serves the SPA and API; `/api/health` returns OK
- [ ] Public routes load: `/`, `/services`, `/solutions`, `/contact`, `/login`
- [ ] Workspace routes load: `/app/dashboard`, `/app/brainstorm` (canvas + AI + autosave), `/app/tasks`, `/app/board` (Kanban), `/app/notes`, `/app/chat`, `/app/settings`
- [ ] Light/dark theme toggle works (header / workspace sidebar)
- [ ] Phase 2/3 items appear as “coming soon” on Solutions and roadmap section on Dashboard
- [ ] `Directions/OVERVIEW.md` “Current implementation notes” matches how you run the project
