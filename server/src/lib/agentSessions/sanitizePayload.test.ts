import assert from "node:assert/strict";
import test from "node:test";
import { titleFromText, truncateForEvent } from "./sanitizePayload.js";

test("titleFromText short", () => {
  assert.equal(titleFromText("  hello world  "), "hello world");
});

test("truncateForEvent caps length", () => {
  const long = "x".repeat(20_000);
  const out = truncateForEvent(long, 100);
  assert.ok(out.length <= 100);
  assert.ok(out.includes("truncated"));
});
