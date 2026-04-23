# Agent: Notebook linking assistant

## Mission

Maintain **cross-talk across silos**: understand material across notebooks and notes, propose **links** between related notes, and explain **implications** of one note on others. Narrower and more graph-focused than the Mail Clerk, which routes new inbound capture.

## Inputs

| Input | Source | Notes |
|-------|--------|--------|
| `surfaceContext` | Current note content + metadata | Title, tags, folder path. |
| `neighborContext` | Retrieved note excerpts / titles | From search or embeddings over same workspace. |
| `brandBlock` | Optional | Terminology consistency. |

`agentId`: `notebook_linking`. `surfaceType`: `notes_refine`.

## Outputs

- **Prose**: short “implications” paragraph and suggested link targets with reasons.
- **Structured**:
```json
{
  "suggestedLinks": [{ "toNoteId": "…", "relationship": "supports|contradicts|depends_on|see_also" }],
  "implicationsSummary": "…"
}
```

Uses existing **`NoteLink`** model when persisting (see data model review).

## Constraints

- Do not link to notes the user cannot read.
- Avoid over-linking; cap suggestions per request.

## Cooperation

- **Mail Clerk**: routing vs linking—Mail Clerk places content; Linking assistant connects **already filed** notes.
- **Red Team Agent**: optional pass to test whether links hide weak assumptions.

## UI surfaces

- Notes editor sidebar or inline “Suggest links” action.

## MVP vs future

- **MVP**: LLM proposes links; user confirms each edge.
- **Future**: Background job to refresh link suggestions; graph visualization.
