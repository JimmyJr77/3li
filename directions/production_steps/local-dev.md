# Local development

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm (workspaces)
- PostgreSQL 15+ (local or Docker)

## First-time setup

1. From the repository root, install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

   Set `DATABASE_URL` to your PostgreSQL connection string and optionally `OPENAI_API_KEY` for live AI responses. Without `OPENAI_API_KEY`, `POST /api/ai/chat` and `POST /api/ai/brainstorm` return `503` with a clear message.

3. Generate Prisma Client:

   ```bash
   npm run db:generate
   ```

4. Apply the schema (development):

   ```bash
   npm run db:push
   ```

   Or create a migration:

   ```bash
   npm run db:migrate
   ```

## Run the stack

From the repository root:

```bash
npm run dev
```

- **Client:** [http://localhost:5173](http://localhost:5173) (Vite)
- **API:** [http://localhost:3001](http://localhost:3001) (Express)

The Vite dev server proxies `/api/*` to the API (see `client/vite.config.ts`).

## Health check

```bash
curl -s http://localhost:3001/api/health
```

Expected: JSON with `"ok": true`.

## Brainstorm Studio & tasks API (after `db:push`)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/brainstorm/session` | Load or create default project/session and canvas |
| `PUT /api/brainstorm/session/:id/canvas` | Save nodes and edges (autosaved from `/app/brainstorm`) |
| `POST /api/brainstorm/session/:id/convert-plan` | AI: idea → tasks (requires `OPENAI_API_KEY`) |
| `GET /api/task-app/bootstrap` | Default workspace + main board (TaskFoundry) |
| `GET /api/task-app/tasks` | Flat tasks (optional `workspaceId` query) |
| `PATCH /api/task-app/tasks/:id` | Update task / move between lists (Kanban) |

## PostgreSQL via Docker (optional)

```bash
docker run --name three-lions-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=three_lions -p 5432:5432 -d postgres:16
```

Then set:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/three_lions?schema=public"
```

## Workspace packages

| Package   | Path      | Role                          |
|-----------|-----------|-------------------------------|
| `client`  | `client/` | Vite + React + React Router   |
| `server`  | `server/` | Express API                   |
| Prisma    | `prisma/` | Schema at repo root           |
