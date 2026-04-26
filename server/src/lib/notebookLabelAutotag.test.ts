import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNotebookAutotagSuggestions,
  parseNotebookAutotagModelJson,
  reconcileProposeToVocabulary,
  sanitizeNotebookAutotagLabelName,
  type NotebookAutotagVocabularyItem,
} from "./notebookLabelAutotag.js";

function v(
  overrides: Partial<NotebookAutotagVocabularyItem> & Pick<NotebookAutotagVocabularyItem, "kind" | "id" | "name">,
): NotebookAutotagVocabularyItem {
  const color = overrides.color ?? "#111111";
  return {
    kind: overrides.kind,
    id: overrides.id,
    name: overrides.name,
    color,
    lineForPrompt: overrides.lineForPrompt ?? `- ${overrides.name} (${overrides.kind})`,
  };
}

describe("sanitizeNotebookAutotagLabelName", () => {
  it("trims and collapses whitespace to hyphen", () => {
    assert.equal(sanitizeNotebookAutotagLabelName("  foo  bar  "), "foo-bar");
  });
});

describe("parseNotebookAutotagModelJson", () => {
  it("parses themes, reuse, and propose", () => {
    const raw = JSON.stringify({
      themes: ["A", "B"],
      reuseExisting: ["Bug"],
      proposeNew: ["New-theme"],
    });
    const out = parseNotebookAutotagModelJson(raw);
    assert.deepEqual(out.themes, ["A", "B"]);
    assert.deepEqual(out.reuseExisting, ["Bug"]);
    assert.deepEqual(out.proposeNew, ["New-theme"]);
  });

  it("falls back legacy labels into proposeNew", () => {
    const raw = JSON.stringify({ labels: ["Legacy"] });
    const out = parseNotebookAutotagModelJson(raw);
    assert.deepEqual(out.proposeNew, ["Legacy"]);
  });
});

describe("reconcileProposeToVocabulary", () => {
  const vocab = [v({ kind: "board", id: "1", name: "Bug" }), v({ kind: "user", id: "2", name: "Client onboarding" })];

  it("returns vocab on exact name match", () => {
    const hit = reconcileProposeToVocabulary("Bug", vocab);
    assert.equal(hit?.id, "1");
  });

  it("returns vocab on single-character typos when lengths allow", () => {
    const hit = reconcileProposeToVocabulary("Bog", vocab);
    assert.equal(hit?.id, "1");
  });

  it("returns null when two vocabs both substring-match the proposal", () => {
    const wide = [v({ kind: "board", id: "a", name: "goal" }), v({ kind: "board", id: "b", name: "goat" })];
    assert.equal(reconcileProposeToVocabulary("go", wide), null);
  });

  it("returns null when there is no match", () => {
    assert.equal(reconcileProposeToVocabulary("completely-unrelated", vocab), null);
  });
});

describe("buildNotebookAutotagSuggestions", () => {
  const vocab = [
    v({ kind: "board", id: "b1", name: "Bug" }),
    v({ kind: "user", id: "u1", name: "Feature" }),
  ];

  it("maps reuseExisting to match rows", () => {
    const rows = buildNotebookAutotagSuggestions(vocab, ["Bug"], []);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.name, "Bug");
    assert.equal(rows[0]!.match?.id, "b1");
  });

  it("promotes proposeNew when reconcile finds one strong match", () => {
    const rows = buildNotebookAutotagSuggestions(vocab, [], ["Bug"]);
    assert.equal(rows[0]!.match?.id, "b1");
  });

  it("emits new row without match when novel", () => {
    const rows = buildNotebookAutotagSuggestions(vocab, [], ["Novel-theme"]);
    assert.equal(rows[0]!.name, "Novel-theme");
    assert.equal(rows[0]!.match, null);
  });
});
