import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { normalizeTokens } from "../src/core/config.ts";
import { AnnotationIndex } from "../src/core/index.ts";
import { matchAnnotations } from "../src/core/matcher.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokens = normalizeTokens(["TODO", "FIXME", "HACK", "NOTE", "REVIEW", "DEPRECATED"], true).tokens;
const measurements = [];

for (const [label, bytes, budget] of [
  ["100 KiB", 100 * 1024, 50],
  ["1 MiB", 1024 * 1024, 500],
]) {
  const unit = "// TODO: bounded workspace annotation\nconst value = 1;\n";
  const source = unit.repeat(Math.ceil(bytes / unit.length)).slice(0, bytes);
  const samples = [];
  for (let index = 0; index < 5; index += 1) {
    const started = performance.now();
    const result = matchAnnotations(source, {
      uri: `file:///fixture-${index}.ts`,
      languageId: "typescript",
      source: "workspace-scan",
      tokens,
      caseSensitive: true,
      maxMessageLength: 500,
      maxResults: 100_000,
    });
    assert.ok(result.annotations.length > 0);
    samples.push(performance.now() - started);
  }
  samples.sort((left, right) => left - right);
  const median = samples[Math.floor(samples.length / 2)];
  assert.ok(median < budget, `${label} match exceeded ${budget} ms: ${median.toFixed(2)} ms.`);
  measurements.push(`${label} ${median.toFixed(2)} ms`);
}

const pathological = `${"x".repeat(1_000_000)} // TODO: tail`;
const pathologicalStart = performance.now();
const pathologicalResult = matchAnnotations(pathological, {
  uri: "file:///pathological.ts",
  languageId: "typescript",
  source: "workspace-scan",
  tokens,
  caseSensitive: true,
  maxMessageLength: 500,
  maxResults: 1_000,
});
assert.equal(pathologicalResult.annotations.length, 1);
assert.ok(performance.now() - pathologicalStart < 500, "Pathological long line exceeded 500 ms.");

const index = new AnnotationIndex();
const files = Array.from({ length: 100 }, (_, file) => ({
  uri: `file:///workspace/file-${String(file).padStart(3, "0")}.ts`,
  source: "workspace-scan",
  truncated: false,
  annotations: Array.from({ length: 100 }, (_, entry) => ({
    id: `annotation:${file}-${entry}`,
    uri: `file:///workspace/file-${String(file).padStart(3, "0")}.ts`,
    token: "TODO",
    style: "info",
    message: "Indexed result",
    messageTruncated: false,
    line: entry,
    character: 3,
    endCharacter: 7,
    start: entry * 10,
    end: entry * 10 + 4,
    source: "workspace-scan",
  })),
}));
const indexStarted = performance.now();
index.replaceSnapshot(files, { scanned: true, partialReasons: [], candidateFiles: 100, scannedFiles: 100, skippedFiles: 0 });
assert.equal(index.all().length, 10_000);
const indexElapsed = performance.now() - indexStarted;
assert.ok(indexElapsed < 100, `10,000-result index exceeded 100 ms: ${indexElapsed.toFixed(2)} ms.`);

for (const output of ["dist/node/extension.cjs", "dist/web/extension.cjs"]) {
  const bytes = (await stat(path.join(root, output))).size;
  assert.ok(bytes < 600 * 1024, `${output} exceeds the 600 KiB development-bundle budget.`);
}

const nodeBundle = await readFile(path.join(root, "dist/node/extension.cjs"), "utf8");
const loadSamples = [];
for (let sample = 0; sample < 7; sample += 1) {
  const module = { exports: {} };
  const started = performance.now();
  vm.runInNewContext(nodeBundle, {
    Buffer,
    TextDecoder,
    TextEncoder,
    clearTimeout,
    console,
    exports: module.exports,
    module,
    require: (id) => {
      assert.equal(id, "vscode", `Unexpected runtime import: ${id}`);
      return {};
    },
    setTimeout,
  });
  loadSamples.push(performance.now() - started);
}
loadSamples.sort((left, right) => left - right);
const loadMedian = loadSamples[Math.floor(loadSamples.length / 2)];
assert.ok(loadMedian < 50, `Bundle module load exceeded 50 ms: ${loadMedian.toFixed(2)} ms.`);

console.log(`Performance passed: ${measurements.join("; ")}; 10k index ${indexElapsed.toFixed(2)} ms; module load ${loadMedian.toFixed(2)} ms.`);
