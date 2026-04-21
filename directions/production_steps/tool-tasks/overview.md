# Full-Scale Task Manager App Spec and Cursor Build Prompt

## 1) Objective
Build a modern task manager application that starts with a Trello-like core and expands into a full work-management platform. The product should preserve the speed and visual clarity of boards, lists, and cards while adding the best capabilities from modern task apps: multiple views, automation, docs, calendar, goals, dashboards, AI assistance, templates, permissions, and integrations.

The app should feel simple on day one and powerful on day one hundred.

---

## 2) Competitive Landscape Synthesis

### Trello-style strengths
- Extremely fast visual organization
- Boards, lists, and cards are intuitive
- Drag-and-drop interaction is the core mental model
- Lightweight collaboration and card-level discussion
- Templates and automation make repeated workflows easy
- Power-up ecosystem extends the product without cluttering the core

### Asana-style strengths
- Clear project structure for teams
- Multiple views across the same underlying data
- Strong task relationships, dependencies, and timelines
- Goals, portfolios, workload, and cross-project visibility
- Useful workflow automation and forms

### ClickUp-style strengths
- “Everything in one place” model
- Tasks + docs + chat + dashboards + whiteboards + goals
- Deep customization and flexible hierarchies
- Rich views, automations, and reporting
- Strong productivity tooling for power users

### Notion-style strengths
- Tasks and knowledge live together
- Database-driven flexibility
- Pages, docs, notes, templates, and project tracking in one system
- Strong customization for teams with unique workflows
- AI and automation opportunities around structured workspace data

### Todoist-style strengths
- Personal productivity polish
- Fast capture, recurring tasks, reminders, filters, and priorities
- Low-friction keyboard-first UX
- Excellent “My Tasks” and daily focus patterns

### Jira-style strengths
- Backlog discipline and prioritization for complex work
- Custom workflows and statuses
- Sprint planning, issue types, estimation, and dependency handling
- Best-in-class support for operational and engineering-style tracking

### monday.com-style strengths
- Flexible work management with strong automation
- Good operational workflows, forms, and dashboards
- Easy status tracking across teams

---

## 3) Product Direction

### Product name placeholder
TaskFoundry

### Core positioning
A visual-first work management platform built on a Trello-like interaction model, but expanded into a complete operating system for personal productivity, team coordination, and project delivery.

### Product philosophy
1. The board is the foundation.
2. Every item should be viewable in multiple ways.
3. Capture must be faster than thinking.
4. Complexity should be available, not forced.
5. Tasks should connect to docs, calendar, goals, files, and automation.
6. AI should assist, not obstruct.

---

## 4) Foundational Product Model

### Workspace hierarchy
- Workspace
- Team / Space
- Project / Board
- List / Column / Swimlane
- Card / Task
- Subtask / Checklist Item

### Trello-like foundation
The app must begin with a board model that feels familiar to Trello users:
- A board contains ordered lists
- A list contains ordered cards
- Cards can be dragged between lists
- Cards can contain title, description, assignees, labels, due dates, attachments, comments, subtasks, activity history, priority, custom fields, and linked tasks

### Scalable data model
The same task should also be viewable as:
- Board view
- Table view
- Calendar view
- Timeline / Gantt view
- My Tasks view
- Inbox view
- Dashboard view

This means the underlying data must be normalized and not hardcoded to only a Kanban structure.

---

## 5) Feature Set for the Full App

## A. Core Task and Board Features
- Workspaces, teams, and projects
- Create/edit/archive boards
- Custom lists/columns
- Drag-and-drop cards and list reordering
- Rich card detail drawer/modal
- Task title, description, notes, and rich text formatting
- Assignees and watchers
- Labels/tags/color coding
- Priority levels
- Due dates, start dates, and recurring tasks
- Checklists and subtasks
- Attachments and file previews
- Comments, mentions, and activity log
- Task cover images / emojis / icons
- Task relationships: blocks, depends on, linked to, duplicate of
- Card templates
- Bulk edit and multi-select
- Saved filters and quick search
- Archive and restore

## B. Productivity and Planning Features
- Personal inbox / quick capture
- Global command palette
- My Tasks page
- Today / Upcoming / Overdue views
- Recurring task engine
- Reminders and notifications
- Prioritization modes
- Time estimates and actual time tracking
- Time blocking support through calendar drag-drop
- Daily planning and weekly planning pages
- Focus mode

## C. View System
- Board / Kanban
- Table / spreadsheet-like view
- List view
- Calendar month/week/day
- Timeline / Gantt
- Dashboard / analytics
- Workload / capacity view
- Goal alignment view

## D. Collaboration Features
- Real-time multi-user updates
- Presence indicators
- Comments and threaded discussions
- Mentions and assignments from comments
- Shareable board/project links with permission control
- Guest access
- Role-based permissions
- Team activity feed
- Notifications center

## E. Workflow and Automation
- Rule builder
- Trigger examples:
  - when card enters list
  - when due date is near
  - when checkbox is completed
  - when status changes
  - when form is submitted
  - on schedule
- Action examples:
  - assign user
  - move card
  - set due date
  - add label
  - create subtask
  - post comment
  - notify Slack/email/webhook
  - duplicate task from template
- Buttons:
  - card buttons
  - board buttons
  - workspace automation recipes

## F. Templates and Intake
- Personal templates
- Team templates
- Board templates
- Project templates
- Task templates
- Form-to-task creation
- Intake queue board

## G. Docs and Knowledge Layer
- Project docs linked to boards
- Meeting notes linked to tasks
- SOP / wiki pages inside workspace
- Task-to-doc references
- Doc mentions and backlinks
- AI-generated summaries from task/project activity

## H. Goals and Reporting
- Goals / OKRs
- Link tasks and projects to goals
- Dashboard widgets
- Completion trends
- Velocity / throughput
- Due date risk indicators
- Team workload metrics
- SLA / response tracking options for ops workflows

## I. AI Layer
- Natural language task capture
- Convert a paragraph into tasks/subtasks
- Summarize board activity
- Suggest deadlines, assignees, and dependencies
- Auto-generate project plan from prompt
- Detect stale or blocked tasks
- Daily/weekly status summary
- Smart search / semantic search

## J. Integrations
- Google Calendar / Outlook Calendar
- Slack / Teams
- Gmail / email-to-task
- Drive / Dropbox / OneDrive
- GitHub / GitLab
- Zapier / Make / webhooks
- OpenAI API for AI features

## K. Mobile and UX Features
- Responsive web app
- Mobile-first quick capture patterns
- Offline caching for recent boards/tasks
- Push notifications
- Swipe actions on mobile
- Keyboard shortcuts on desktop

---

## 6) What Makes This Product Different

This app should differentiate by combining:
- Trello’s clarity and speed
- Todoist’s fast capture and recurring task polish
- Asana’s multi-view project structure
- ClickUp’s all-in-one breadth
- Notion’s docs + task relationship
- Jira’s backlog and dependency rigor
- monday.com’s workflow automation and operational use cases

### Primary differentiator
A truly elegant Trello-first foundation that does not collapse under scale.

### Secondary differentiators
- Board-first UX with enterprise-capable data model
- Docs, goals, and calendar tightly connected to tasks
- AI that improves planning rather than flooding the UI
- Deep automation with simple setup
- Personal productivity and team operations in the same product

---

## 7) MVP Scope

The MVP should intentionally focus on the Trello-like foundation plus the highest-value adjacent features.

### MVP must-have
- Authentication
- Workspace creation
- Board creation
- Lists and cards
- Drag-and-drop cards and lists
- Card detail modal
- Assignees, labels, due date, description, comments, subtasks
- Search and filters
- Board templates
- Basic notifications
- Activity log
- Table view
- Calendar view
- My Tasks view
- Light/dark mode
- Responsive design

### MVP+ should include soon after
- Automation rules
- Recurring tasks
- Timeline view
- Docs linked to tasks
- Dashboard widgets
- AI quick capture and summaries
- Integrations

---

## 8) Recommended Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- dnd-kit for drag-and-drop
- TanStack Query
- Zustand or Redux Toolkit for client state
- React Router
- TipTap or Lexical for rich text
- FullCalendar for calendar views
- TanStack Table for table view
- Recharts for dashboard widgets
- Framer Motion for polished interaction

### Backend
- Node.js with Next.js API routes or standalone Express/NestJS backend
- PostgreSQL
- Prisma ORM
- Redis for caching / queues / realtime helpers
- Socket.IO or Supabase Realtime / Pusher for collaboration
- BullMQ for background jobs and automations

### Auth
- Clerk or Auth.js

### Storage
- S3 compatible object storage

### AI
- OpenAI API

### Hosting
- Vercel for frontend and serverless-compatible services
- Neon/Supabase/Railway/Postgres host for database
- Upstash Redis or equivalent

---

## 9) Suggested Information Architecture

### Primary navigation
- Home
- Inbox
- My Tasks
- Boards
- Calendar
- Goals
- Docs
- Dashboard
- Automations
- Settings

### Board page layout
- Left sidebar: workspaces, favorites, boards
- Top bar: board name, members, filters, view switcher, automation, share
- Main canvas: lists and cards
- Right utility panel: board activity, details, insights

### Card modal layout
- Header: title, status, labels, priority
- Main body: description, checklist, subtasks, linked docs, attachments
- Side panel: assignees, dates, reminders, custom fields, automations, related tasks
- Footer: comments and activity log

---

## 10) Suggested Database Entities

- users
- workspaces
- workspace_members
- teams
- boards
- board_members
- lists
- tasks
- task_assignees
- task_watchers
- task_labels
- labels
- comments
- attachments
- checklists
- checklist_items
- task_relations
- recurring_rules
- views
- filters
- automations
- automation_runs
- docs
- goals
- goal_links
- notifications
- activities
- integrations
- webhooks

---

## 11) Recommended Build Phases

### Phase 1: Foundation
- Project setup
- Auth
- Workspace/board/list/task CRUD
- Drag and drop board UX
- Card modal
- Comments, labels, due dates, assignees
- Basic responsive shell

### Phase 2: Usability
- Search/filter/sort
- My Tasks
- Table and calendar views
- Notifications center
- Templates
- Activity timeline

### Phase 3: Planning and scale
- Recurring tasks
- Timeline view
- Task relationships and dependencies
- Workload view
- Dashboard widgets

### Phase 4: Automation and knowledge
- Rule builder
- Forms intake
- Docs/wiki layer
- Task-doc linking
- Webhooks/integrations

### Phase 5: AI
- Natural language task capture
- Auto-subtask generation
- Board summaries
- Planning assistant
- Smart prioritization suggestions

---

## 12) Cursor Master Prompt

Use the following prompt in Cursor.

```md
You are building a production-grade full-stack task manager application called TaskFoundry.

The product vision is to combine the best aspects of Trello, Asana, ClickUp, Notion, Todoist, Jira, and monday.com into one modern app, but with a specific requirement:

The foundation must feel like Trello.

That means the first-class user experience is a board made of lists and cards with beautiful drag-and-drop interactions, simple visual scanning, quick editing, and low-friction task movement. However, the architecture must support a much broader work-management platform over time, including table, calendar, timeline, dashboard, docs, automation, goals, AI, and integrations.

Build this as a React + TypeScript app using Vite, Tailwind, shadcn/ui, and a modern component architecture. Use a backend with PostgreSQL and Prisma. Design the codebase so it can be deployed on Vercel, with OpenAI used for AI features.

## Core product requirements

### Core hierarchy
- Workspace
- Team / Space
- Board / Project
- List / Column
- Task Card
- Subtask / Checklist Item

### MVP features
- Authentication
- Workspace creation and switching
- Board CRUD
- List CRUD
- Card/task CRUD
- Drag-and-drop cards across lists
- Reorder lists
- Card detail modal with:
  - title
  - description
  - assignees
  - labels
  - priority
  - due date
  - start date
  - comments
  - checklist/subtasks
  - activity history
  - attachments
- Board templates
- Search, filter, and sort
- My Tasks view
- Table view
- Calendar view
- Responsive mobile/tablet/desktop layout
- Light and dark mode

### UX requirements
- The app should feel premium, modern, fast, and clean.
- Use a consistent design system.
- The board view should be excellent and feel polished.
- Drag-and-drop should be smooth and visually clear.
- Use spacious layouts, strong hierarchy, rounded corners, and subtle shadows.
- Avoid visual clutter.
- Support keyboard shortcuts and fast task capture.

### Future-ready architecture requirements
The data model must support:
- recurring tasks
- task dependencies
- automation rules
- docs linked to tasks
- dashboards
- goals / OKRs
- notifications
- integrations
- AI summaries and natural language task capture

### Pages to build
- Login / Auth
- Home dashboard
- Inbox
- My Tasks
- Board page
- Calendar page
- Docs placeholder page
- Goals placeholder page
- Automations placeholder page
- Settings

### Board page requirements
- Left sidebar for workspace navigation and boards
- Top board toolbar for search, filters, members, view switcher, automation, templates
- Main kanban canvas
- Card quick-add in each list
- Rich task modal or slide-over panel

### Data and backend requirements
Create a Prisma schema with entities including:
- User
- Workspace
- WorkspaceMember
- Board
- List
- Task
- TaskAssignee
- Label
- Comment
- Checklist
- ChecklistItem
- Attachment
- Activity
- Notification
- View
- Filter
- RecurringRule
- TaskRelation

Implement clean server-side APIs for CRUD operations and board state updates.

### Realtime/collaboration direction
Prepare the architecture for real-time multi-user presence and live updates, even if the first pass uses mocked or simplified behavior.

### AI direction
Create hooks and service boundaries for future OpenAI features such as:
- turn text into tasks
- suggest subtasks
- summarize board progress
- identify blocked or overdue work

### Output requirements
1. First, define the folder structure.
2. Then generate the Prisma schema.
3. Then generate the main layout and routes.
4. Then implement the board page and drag-and-drop system.
5. Then implement task modal and CRUD flows.
6. Then implement table and calendar views.
7. Then add polish, seed data, and demo-ready UI states.
8. Then identify remaining gaps and propose next implementation steps.

### Coding expectations
- Production-minded code quality
- Strong typing
- Reusable components
- Clear separation between UI, domain logic, and data access
- Thoughtful loading, empty, and error states
- Clean file naming
- Minimal tech debt

Now build the app step by step. Start by proposing the folder structure, route map, component tree, Prisma schema, and implementation plan before writing full code.
```

---

## 13) Cursor Segmented Prompts

## Prompt A: App architecture and scaffolding
```md
Create the initial architecture for a React + TypeScript + Vite task manager app called TaskFoundry.

Requirements:
- Tailwind + shadcn/ui
- React Router
- Zustand or Redux Toolkit
- TanStack Query
- dnd-kit
- Prisma-ready backend integration layer
- Clean feature-based folder structure
- Support light/dark mode
- Route layout for Home, Inbox, My Tasks, Boards, Calendar, Docs, Goals, Automations, Settings

Deliver:
- folder structure
- route structure
- app shell
- navigation/sidebar/topbar
- theme system
- state structure
- API client structure
- recommended conventions
```

## Prompt B: Database and backend model
```md
Design the backend data model and API contract for TaskFoundry, a Trello-like task manager that will later support table, calendar, timeline, automation, docs, goals, and AI.

Deliver:
- Prisma schema
- relation explanations
- CRUD endpoints
- task ordering model for drag-and-drop
- activity logging model
- notification model
- recurring task model
- dependency / task relation model
- board permissions model
```

## Prompt C: Trello-like board experience
```md
Implement the main board experience for TaskFoundry.

Requirements:
- Kanban board with horizontally scrollable lists
- Each list supports quick add card
- Cards draggable across lists
- Lists draggable for reorder
- Empty states and loading states
- Smooth polished interactions
- Card preview shows title, labels, assignees, due date, checklist progress, priority
- Clicking a card opens a rich detail modal or drawer

Use dnd-kit and make the UX feel premium.
```

## Prompt D: Task modal and task system
```md
Implement the task detail experience for TaskFoundry.

Task detail must support:
- title
- rich description
- assignees
- labels
- priority
- due date and start date
- checklist and subtasks
- comments
- attachments
- activity history
- linked tasks placeholder

Use a clean two-column layout with excellent visual hierarchy.
```

## Prompt E: Alternate views
```md
Implement alternate task views for TaskFoundry using the same underlying board/task data.

Views required:
- Table view
- Calendar view
- My Tasks view

Requirements:
- shared filters
- shared sorting
- view switcher at board/project level
- maintain data consistency across views
```

## Prompt F: Automation, docs, and AI foundations
```md
Add the foundation for advanced capabilities in TaskFoundry.

Implement placeholder architecture and partial UI for:
- automation rules
- docs linked to tasks
- goals linked to tasks/boards
- AI quick capture and AI board summaries

Do not overbuild. Create clean service boundaries, UI placeholders, and extensible data shapes so these features can be fully implemented later.
```

---

## 14) UX Notes for Cursor

Tell Cursor to make the design feel like this:
- Trello simplicity at the board layer
- Notion cleanliness in spacing and layout
- ClickUp breadth without ClickUp clutter
- Asana professionalism in navigation and structure
- Todoist speed in capture and task editing

### Visual guidance
- Generous whitespace
- Rounded 2xl cards and panels
- Subtle shadows
- Clean typography
- Strong empty states
- Minimal but useful color
- Consistent spacing scale
- Thoughtful hover, drag, and active states

---

## 15) Success Criteria

The build is successful if:
- A user can create a workspace, board, lists, and cards quickly
- The board experience feels excellent immediately
- The same tasks can appear in board, table, and calendar views
- The data model is ready for automation, AI, docs, and goals
- The UI looks polished enough to demo to real users
- The architecture is clean enough to scale without rewrite

