import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { appendFile, readFile, readdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

// Development-only release entry point. Every publishing job verifies independently.
function command(binary, args) {
  const result = spawnSync(binary, args, { encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, `${binary} failed; publication stopped (${result.error?.code ?? result.status}).`);
  return result.stdout.trim();
}

function required(name) {
  const value = process.env[name];
  assert.ok(value, `Missing ${name}.`);
  return value;
}

async function digest(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function identity() {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  assert.match(manifest.name, /^[a-z0-9][a-z0-9-]*$/);
  assert.match(manifest.publisher, /^[\w-]+$/);
  assert.match(manifest.version, /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/);
  const repository = required("GITHUB_REPOSITORY");
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/);
  const source = command("git", ["rev-parse", "HEAD"]);
  assert.match(source, /^[a-f0-9]{40}$/);
  const files = (await readdir(".")).filter((file) => file.endsWith(".vsix"));
  assert.equal(files.length, 1, "Expected exactly one VSIX.");
  const vsix = files[0];
  assert.match(vsix, /^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.vsix$/);
  return { repository, source, name: manifest.name, publisher: manifest.publisher,
    version: manifest.version, title: manifest.displayName, tag: `v${manifest.version}`,
    vsix, sha256: await digest(vsix) };
}

async function record() {
  const metadata = await identity();
  assert.equal(metadata.source, required("GITHUB_SHA"), "Checkout differs from the workflow source.");
  assert.ok(typeof metadata.title === "string" && !/[\r\n]/.test(metadata.title));
  await writeFile(`${metadata.vsix}.sha256`, `${metadata.sha256}  ${metadata.vsix}\n`);
  await writeFile("release-artifact.json", `${JSON.stringify(metadata, null, 2)}\n`);
  await appendFile(required("GITHUB_OUTPUT"), Object.entries(metadata).map(([key, value]) => `${key}=${value}\n`).join(""));
}

async function verify() {
  const actual = await identity();
  const recorded = JSON.parse(await readFile("release-artifact.json", "utf8"));
  assert.deepEqual(recorded, actual, "Artifact metadata differs from the checked-out source or bytes.");
  assert.equal(actual.source, required("RELEASE_SOURCE"));
  assert.equal(actual.sha256, required("RELEASE_SHA256"), "Artifact hash differs from the prepare job.");
  assert.equal(actual.vsix, required("RELEASE_VSIX"));
  assert.equal(await readFile(`${actual.vsix}.sha256`, "utf8"), `${actual.sha256}  ${actual.vsix}\n`);
  return actual;
}

function api(path, args = []) {
  return JSON.parse(command("gh", ["api", path, ...args]));
}

function checkTag(metadata) {
  assert.equal(required("GH_REPO"), metadata.repository);
  required("GH_TOKEN");
  // The matching-refs endpoint returns an empty array for a missing tag. Any
  // authentication, permission, network or API error fails closed in command().
  const refs = api(`repos/${metadata.repository}/git/matching-refs/tags/${metadata.tag}`);
  assert.ok(Array.isArray(refs));
  const ref = refs.find((entry) => entry.ref === `refs/tags/${metadata.tag}`);
  if (!ref) return false;
  let object = ref.object;
  for (let depth = 0; object.type === "tag" && depth < 8; depth++) {
    assert.match(object.sha, /^[a-f0-9]{40}$/);
    object = api(`repos/${metadata.repository}/git/tags/${object.sha}`).object;
  }
  assert.equal(object.type, "commit", "Tag does not resolve to a commit.");
  assert.equal(object.sha, metadata.source, "Existing tag points to another commit; never rewrite it.");
  return true;
}

async function publishGitHub() {
  const metadata = await verify();
  const hasTag = checkTag(metadata);
  const pages = api(`repos/${metadata.repository}/releases?per_page=100`, ["--paginate", "--slurp"]);
  assert.ok(Array.isArray(pages) && pages.every(Array.isArray));
  assert.ok(!pages.flat().some((release) => release.tag_name === metadata.tag), "Release already exists; never replace published bytes.");
  if (!hasTag) {
    api(`repos/${metadata.repository}/git/refs`, ["--method", "POST", "-f", `ref=refs/tags/${metadata.tag}`, "-f", `sha=${metadata.source}`]);
  }
  assert.equal(checkTag(metadata), true);
  command("gh", ["release", "create", metadata.tag, metadata.vsix, `${metadata.vsix}.sha256`, "release-artifact.json",
    "--repo", metadata.repository, "--verify-tag", "--target", metadata.source,
    "--title", `${metadata.title} ${metadata.version}`, "--generate-notes"]);
}

switch (process.argv[2]) {
  case "record": await record(); break;
  case "verify": await verify(); break;
  case "verify-remote": checkTag(await verify()); break;
  case "publish-github": await publishGitHub(); break;
  default: throw new Error("Expected record, verify, verify-remote or publish-github.");
}
