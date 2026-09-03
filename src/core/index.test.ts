import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTokens } from "./config.ts";
import { AnnotationIndex } from "./index.ts";
import { matchAnnotations } from "./matcher.ts";
import type { FileAnnotations, IndexStatus } from "./model.ts";

const complete: IndexStatus = { scanned: true, partialReasons: [], candidateFiles: 2, scannedFiles: 2, skippedFiles: 0 };

function file(uri: string, source: string): FileAnnotations {
  const result = matchAnnotations(source, {
    uri,
    languageId: "typescript",
    source: "workspace-scan",
    tokens: normalizeTokens(["TODO", "FIXME"], true).tokens,
    caseSensitive: true,
    maxMessageLength: 500,
    maxResults: 1_000,
  });
  return { uri, source: "workspace-scan", annotations: result.annotations, truncated: result.truncated };
}

test("groups files and annotations in deterministic ordinal order", () => {
  const index = new AnnotationIndex();
  index.replaceSnapshot([
    file("file:///z.ts", "// TODO z"),
    file("file:///A.ts", "// FIXME first\n// TODO second"),
  ], complete);
  assert.deepEqual(index.groups().map((group) => group.uri), ["file:///A.ts", "file:///z.ts"]);
  assert.deepEqual(index.groups()[0]!.annotations.map((annotation) => annotation.token), ["FIXME", "TODO"]);
  assert.equal(index.total, 3);
});

test("filters tokens, resolves stable IDs, and removes files", () => {
  const index = new AnnotationIndex();
  index.replaceSnapshot([file("file:///a.ts", "// TODO a\n// FIXME b")], complete);
  const todo = index.all(new Set(["todo"]));
  assert.equal(todo.length, 1);
  assert.equal(index.findById(todo[0]!.id)?.message, "a");
  index.removeFile("file:///a.ts");
  assert.equal(index.total, 0);
});

test("replaces one file atomically and records result truncation", () => {
  const index = new AnnotationIndex();
  index.replaceSnapshot([file("file:///a.ts", "// TODO old")], complete);
  const truncated = index.replaceFile(file("file:///a.ts", "// TODO one\n// FIXME two"), 1);
  assert.equal(truncated, true);
  assert.equal(index.total, 1);
  assert.deepEqual(index.status.partialReasons, ["result-limit"]);
});

test("open-document replacement supersedes disk results", () => {
  const index = new AnnotationIndex();
  index.replaceSnapshot([file("file:///a.ts", "// TODO disk")], complete);
  const open = file("file:///a.ts", "// FIXME unsaved");
  index.replaceFile({ ...open, source: "open-document", annotations: open.annotations.map((annotation) => ({ ...annotation, source: "open-document" })) }, 10);
  assert.deepEqual(index.all().map(({ token, message, source }) => ({ token, message, source })), [
    { token: "FIXME", message: "unsaved", source: "open-document" },
  ]);
});

test("leaves per-file truncation classification to the scan owner", () => {
  const index = new AnnotationIndex();
  index.replaceSnapshot([], complete);
  const limited = file("file:///a.ts", "// TODO one");
  assert.equal(index.replaceFile({ ...limited, truncated: true }, 10), true);
  assert.deepEqual(index.status.partialReasons, []);
});
