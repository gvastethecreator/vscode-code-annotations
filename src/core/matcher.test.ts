import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTokens } from "./config.ts";
import { matchAnnotations } from "./matcher.ts";

function match(text: string, languageId: string, tokenNames: readonly string[] = ["TODO", "FIXME", "HACK", "NOTE", "REVIEW"], caseSensitive = true, maxResults = 1_000) {
  const tokens = normalizeTokens(tokenNames, caseSensitive).tokens;
  return matchAnnotations(text, {
    uri: "test:/fixture",
    languageId,
    source: "workspace-scan",
    tokens,
    caseSensitive,
    maxMessageLength: 500,
    maxResults,
  });
}

test("finds slash comments while excluding strings, templates, and regex literals", () => {
  const source = [
    'const text = "// TODO hidden";',
    "const template = `/* HACK hidden */`;",
    "const pattern = /\\/\\/ FIXME hidden/; // FIXME real failure",
    "/* REVIEW inspect this */",
  ].join("\n");
  const result = match(source, "typescript");
  assert.deepEqual(result.annotations.map(({ token, message, line }) => ({ token, message, line })), [
    { token: "FIXME", message: "real failure", line: 2 },
    { token: "REVIEW", message: "inspect this", line: 3 },
  ]);
});

test("finds hash comments without matching quoted hashes", () => {
  const result = match('print("# TODO hidden")  # HACK temporary\n# NOTE: explain', "python");
  assert.deepEqual(result.annotations.map(({ token, message }) => ({ token, message })), [
    { token: "HACK", message: "temporary" },
    { token: "NOTE", message: "explain" },
  ]);
});

test("finds markup and stylesheet comments only", () => {
  const html = match('<div title="TODO hidden"></div><!-- TODO: visible -->', "html");
  const css = match('.x::after { content: "FIXME hidden"; } /* FIXME visible */', "css");
  assert.equal(html.annotations.length, 1);
  assert.equal(html.annotations[0]!.message, "visible");
  assert.equal(css.annotations.length, 1);
  assert.equal(css.annotations[0]!.message, "visible");
});

test("ignores fenced Markdown and reads HTML comments outside fences", () => {
  const source = "```ts\n// TODO hidden\n```\n<!-- NOTE visible -->";
  const result = match(source, "markdown");
  assert.deepEqual(result.annotations.map(({ token, line }) => ({ token, line })), [{ token: "NOTE", line: 3 }]);
});

test("enforces boundaries and keeps owner syntax as message text", () => {
  const result = match("// TODONT no\n// TODO(@ana): owner text\n// TODO: plain", "javascript", ["TODO"]);
  assert.deepEqual(result.annotations.map(({ message, line }) => ({ message, line })), [
    { message: "(@ana): owner text", line: 1 },
    { message: "plain", line: 2 },
  ]);
});

test("supports case-insensitive custom literal tokens", () => {
  const result = match("// todo lower\n// @Review custom", "javascript", ["TODO", "@REVIEW"], false);
  assert.deepEqual(result.annotations.map((annotation) => annotation.token), ["todo", "@Review"]);
});

test("preserves Unicode messages, CRLF positions, and stable value-free IDs", () => {
  const result = match("\uFEFF// TODO: café ☕\r\n// FIXME: résumé", "javascript");
  assert.deepEqual(result.annotations.map(({ line, character, message }) => ({ line, character, message })), [
    { line: 0, character: 4, message: "café ☕" },
    { line: 1, character: 3, message: "résumé" },
  ]);
  assert.match(result.annotations[0]!.id, /^annotation:[0-9a-f]{16}$/u);
  assert.equal(result.annotations[0]!.id.includes("café"), false);
});

test("bounds messages and per-file result counts", () => {
  const long = match(`// TODO ${"x".repeat(600)}`, "javascript");
  assert.equal(Array.from(long.annotations[0]!.message).length, 500);
  assert.equal(long.annotations[0]!.messageTruncated, true);
  const limited = match("// TODO one\n// TODO two", "javascript", ["TODO"], true, 1);
  assert.equal(limited.annotations.length, 1);
  assert.equal(limited.truncated, true);
});

test("handles pathological long non-boundary runs without recursion", () => {
  const result = match(`// ${"A".repeat(100_000)}`, "javascript", ["A"]);
  assert.equal(result.annotations.length, 0);
});

test("uses Unicode-aware token boundaries", () => {
  const result = match("// 前修正後 hidden\n// 修正 visible", "javascript", ["修正"]);
  assert.deepEqual(result.annotations.map(({ message, line }) => ({ message, line })), [{ message: "visible", line: 1 }]);
});
