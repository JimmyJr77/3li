# PRD: Brainstorm studio board elements (beyond idea cards)

**Phase tags:** P2 UX exploration → P3 persistence/model for non-card entities.

## Problem

Brainstorm Studio is the **master** ideation surface. Idea cards are the core primitive today; the product also needs **additional element types** for real planning work: raw text blocks, shapes with labels, hierarchical charts, **calculators** (e.g. amortization, simple loans, compound interest), lightweight **deck-style** blocks, tables, and image placement.

## Goals

- Keep **studio boards** (rename from “session” in UI where still present) as the primary brainstorm artifact.
- Allow **snapshots** or exports to Notebooks (inbox) and Rapid Router holding areas.
- **Board scope**: independent / pre-project, **new project** (auto-create project space + linkage), or **assigned** to an existing project space.

## Agents

| Agent | Role |
|-------|------|
| [AI Consultant Agent](../agents/ai-consultant-agent.md) | Mode-aligned facilitation (`ai_consultant`, collapsible panel). |
| [Red Team Agent](../agents/red-team-agent.md) | Challenge and alternates (`red_team`, same panel pattern as Notes/Chat). |

## Dependencies

- Brainstorm data model today is card-centric (`IdeaNode`); new element types imply schema migration or a polymorphic `boardElement` model.
- Performance: large boards + images.

## Non-goals (v1)

- Full PowerPoint compatibility; focus on **planning-relevant** primitives.

## Acceptance criteria (phased)

1. PRD drives an engineering spike: data shape for non-card elements.
2. UI copy uses **studio board** terminology consistently ([copy-alignment-p0](../ux/copy-alignment-p0.md)).
