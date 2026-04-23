# PRD: Rapid Router

## Problem

Operators need a **low-friction** place to jot thoughts, optionally sharpen them with AI, then **route** them to notebooks, brainstorm, or boards without heavy process.

## Goals

- Capture text (and stickies) with optional **Red Team** pass for thought exercises.
- **Mail Clerk / Mailroom** flow: standardized prompts to decide destinations, or manual routing.
- Align terminology with **holding pens** in notebooks (raw forwards land in a defined inbox area downstream).

## Current implementation (reference)

- Single page routes capture to Brand Center storage, notes, brainstorm append, or board tasks (`RapidRouterPage`).
- Sticky notes may be local-only.

## User stories

- As a user, I capture a thought and send it to the right notebook or board in one flow.
- As a user, I ask the Mail Clerk to **split** a long capture and propose multiple destinations.

## Open questions

- Server-side **index** of folder/board names for accurate routing vs client-only lists.
- Unified **tag** for “came from Rapid Router” on notes and tasks.

## Agents

- **Red Team Agent**: optional pre-routing challenge.
- **Mail Clerk Agent**: decomposition and routing (see `docs/agents/mail-clerk-mailroom-agent.md`).

## Acceptance criteria

- User can complete capture → route without losing text on failure (error state + retry).
- Mailroom popup uses same prompt contract as documented context bundle.
