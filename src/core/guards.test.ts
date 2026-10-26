import assert from "node:assert/strict";
import test from "node:test";
import { isLikelyBinary } from "./binary.ts";
import { inferLanguageId } from "./language.ts";

test("detects NUL and dense control-byte binary prefixes", () => {
  assert.equal(isLikelyBinary(new Uint8Array([65, 0, 66])), true);
  assert.equal(isLikelyBinary(new Uint8Array([1, 2, 3, 4, 65])), true);
  assert.equal(isLikelyBinary(new TextEncoder().encode("// TODO normal text\n")), false);
});

test("infers supported language adapters from URI paths", () => {
  assert.equal(inferLanguageId("/workspace/src/app.tsx"), "typescriptreact");
  assert.equal(inferLanguageId("/workspace/Dockerfile.dev"), "dockerfile");
  assert.equal(inferLanguageId("/workspace/Makefile"), "makefile");
  assert.equal(inferLanguageId("/workspace/unknown.data"), "plaintext");
});
