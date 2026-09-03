import assert from "node:assert/strict";
import test from "node:test";
import { boundedInteger, normalizeGlobList, normalizeTokens } from "./config.ts";

test("normalizes literal tokens with stable semantic styles", () => {
  const result = normalizeTokens(["TODO", "FIXME", "CUSTOM"], true);
  assert.deepEqual(result.tokens.map(({ token, style }) => ({ token, style })), [
    { token: "TODO", style: "info" },
    { token: "FIXME", style: "error" },
    { token: "CUSTOM", style: "info" },
  ]);
  assert.equal(result.rejected, 0);
});

test("rejects unsafe, duplicate, and excessive tokens", () => {
  const values = ["TODO", "todo", "", "two words", "bad\u0000token", "x".repeat(65), 42];
  const result = normalizeTokens(values, false);
  assert.deepEqual(result.tokens.map((entry) => entry.token), ["TODO"]);
  assert.equal(result.rejected, 6);
});

test("normalizes bounded glob lists and numeric settings", () => {
  assert.deepEqual(normalizeGlobList(["**/*.ts", "**/*.ts", "", "x\u0000y", 3], ["fallback"]), ["**/*.ts"]);
  assert.deepEqual(normalizeGlobList(undefined, ["fallback"]), ["fallback"]);
  assert.equal(boundedInteger(10.9, 5, 1, 10), 10);
  assert.equal(boundedInteger(-5, 5, 1, 10), 1);
  assert.equal(boundedInteger("10", 5, 1, 10), 5);
});
