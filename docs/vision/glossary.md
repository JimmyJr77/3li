# Glossary

Canonical product and engineering terms for 3LI. Use these consistently in UI copy, APIs, and agent prompts.

## Core entities

| Term | Definition | Code / data today |
|------|------------|-------------------|
| **My brands** | Sidebar switcher: brands and, when needed, project spaces nested under a brand. | **`Brand`** rows; chrome resolves **`brandDisplayName`** from **`Brand.brandProfile`**. Multiple **`Workspace`** rows can share one brand. |
| **Brand** (product) | The client or company lens for AI and delivery. | Prisma **`Brand`** — **`brandProfile`** JSON; **`Workspace.brandId`** links project spaces. |
| **Project space** | A scoped delivery thread: boards, tasks, notes, tags together. | **`Workspace`** in Prisma (TaskFoundry). Not the brainstorm **`Project`** model. |
| **Brand kit** | Structured identity, voice, goals, and constraints for AI. | **`Brand.brandProfile`** — validated on save; `identity.displayName` surfaces as **`brandDisplayName`** in workspace list API. |
| **Brainstorm project** | Legacy top-level container for chat RAG, documents, brainstorm sessions. | Prisma **`Project`** — distinct from TaskFoundry `Workspace`. |
| **Studio board** | A single brainstorm canvas (ideas, nodes, edges). | **`BrainstormSession`**. |
| **Board (task board)** | Kanban board inside a project space. | **`Board`** under `Workspace`. |
| **Holding pen** | Inbox for raw captures not yet filed. | Product-defined (folders, tags, Rapid Router state). |

## Roles

| Term | Definition |
|------|------------|
| **Operator / consultant** | A user (in-house or external) who runs workflows for one or more brands or clients. |
| **Team** | The group sharing team-level context documents; precedence over individual user context when rules conflict. |

## AI terminology

| Term | Definition |
|------|------------|
| **Agent** | A named behavioral contract (mission, inputs, outputs) implemented as system prompts + optional tools—not necessarily a separate model or autonomous loop. |
| **Context bundle** | Structured payload assembled for each LLM call. See [context-ladder.md](./context-ladder.md) and [../integrations/CONTEXT_BUNDLE.md](../integrations/CONTEXT_BUNDLE.md). |
| **Consulting mode** | Strategy / financial / operations / technical lens on the AI Consultant chat path. |

## Data model direction

**Multiple project spaces per brand** are supported: one **`Brand`** kit, many **`Workspace`** rows per brand. Brand ordering uses **`Brand.position`**; project space ordering within a brand uses **`Workspace.position`** scoped by **`brandId`**.
