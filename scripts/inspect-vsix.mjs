import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import yauzl from "yauzl";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requested = process.argv[2];
const filename = requested
  ? path.resolve(root, requested)
  : path.join(root, (await readdir(root)).find((name) => /^code-annotations(?:-.*)?\.vsix$/.test(name)) || "");
assert.ok(filename.endsWith(".vsix"), "No Code Annotations VSIX found.");
assert.ok((await stat(filename)).size < 5 * 1024 * 1024, "VSIX exceeds the 5 MiB budget.");

const allowedExtensionFiles = new Set([
  "extension/package.json",
  "extension/dist/node/extension.cjs",
  "extension/dist/web/extension.cjs",
  "extension/media/icon.png",
  "extension/media/preview.png",
  "extension/readme.md",
  "extension/changelog.md",
  "extension/LICENSE.txt",
  "extension/SECURITY.md",
  "extension/THIRD_PARTY_NOTICES.md",
]);
const { names, contents } = await inspect(filename, allowedExtensionFiles);
for (const required of allowedExtensionFiles) assert.ok(names.has(required), `Missing packaged file: ${required}`);
for (const name of names) {
  assert.ok(!name.includes(".."), `Unsafe archive entry: ${name}`);
  if (name.startsWith("extension/")) assert.ok(allowedExtensionFiles.has(name), `Unexpected packaged file: ${name}`);
}

const manifest = JSON.parse(contents.get("extension/package.json").toString("utf8"));
assert.equal(manifest.name, "code-annotations");
assert.equal(manifest.displayName, "Code Annotations: TODO Index");
assert.equal(manifest.version, "0.1.0");
assert.equal(manifest.main, "./dist/node/extension.cjs");
assert.equal(manifest.browser, "./dist/web/extension.cjs");
assert.deepEqual(manifest.extensionKind, ["workspace", "ui"]);
assert.equal(manifest.capabilities.untrustedWorkspaces.supported, true);
assert.equal(manifest.capabilities.virtualWorkspaces.supported, true);
assert.equal(manifest.contributes.commands.length, 6);
assert.deepEqual(
  manifest.contributes.commands.map((entry) => entry.command),
  [
    "codeAnnotations.refreshWorkspace",
    "codeAnnotations.showAll",
    "codeAnnotations.filterTokens",
    "codeAnnotations.clearFilter",
    "codeAnnotations.next",
    "codeAnnotations.previous",
  ],
);
assert.equal(Object.keys(manifest.contributes.configuration.properties).length, 9);
assert.ok(
  Object.values(manifest.contributes.configuration.properties).every((entry) => entry.scope === "window"),
  "Settings must use one coherent workspace-wide configuration in multi-root windows.",
);
assert.equal(manifest.contributes.views.explorer.length, 1);
assert.equal(manifest.contributes.views.explorer[0].id, "codeAnnotations.workspace");
assert.equal(manifest.contributes.colors.length, 6);
assert.equal(manifest.contributes.keybindings, undefined, "No default keybinding should ship in 0.1.0.");
assert.equal(manifest.contributes.viewsContainers, undefined, "Code Annotations must use the native Explorer container.");
assert.equal(manifest.contributes.webviews, undefined, "Code Annotations must not ship a webview.");
assert.ok(manifest.activationEvents.every((entry) => entry.startsWith("onLanguage:")), "Activation must remain editor-language scoped.");

for (const bundleName of ["extension/dist/node/extension.cjs", "extension/dist/web/extension.cjs"]) {
  const bundle = contents.get(bundleName).toString("utf8");
  assert.ok(Buffer.byteLength(bundle) < 600 * 1024, `${bundleName} exceeds the 600 KiB budget.`);
  const runtimeImports = [...bundle.matchAll(/require\(["']([^"']+)["']\)/gu)].map((match) => match[1]);
  assert.deepEqual([...new Set(runtimeImports)], ["vscode"], `${bundleName} has unexpected runtime imports.`);
  for (const forbidden of ["child_process", "XMLHttpRequest", "WebSocket(", "fetch(", "eval("]) {
    assert.equal(bundle.includes(forbidden), false, `${bundleName} contains forbidden runtime surface: ${forbidden}`);
  }
}

await verifyPng(contents.get("extension/media/icon.png"), 256, 256, "Marketplace icon");
await verifyPng(contents.get("extension/media/preview.png"), 1200, 800, "Marketplace preview");
console.log(`VSIX inspection passed: ${names.size} entries.`);

async function verifyPng(buffer, width, height, label) {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  assert.equal(metadata.format, "png", `${label} must be PNG.`);
  assert.equal(metadata.width, width, `${label} width changed.`);
  assert.equal(metadata.height, height, `${label} height changed.`);
  assert.equal(metadata.channels, 4, `${label} must carry native alpha.`);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = info.channels - 1;
  const offsets = [
    alpha,
    (info.width - 1) * info.channels + alpha,
    (info.height - 1) * info.width * info.channels + alpha,
    (info.width * info.height - 1) * info.channels + alpha,
  ];
  assert.ok(offsets.every((offset) => data[offset] === 0), `${label} corners must be transparent.`);
}

function inspect(file, collected) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(error || new Error("Could not open VSIX."));
      const names = new Set();
      const contents = new Map();
      zip.on("error", reject);
      zip.on("end", () => resolve({ names, contents }));
      zip.on("entry", (entry) => {
        names.add(entry.fileName);
        if (!collected.has(entry.fileName)) return zip.readEntry();
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return reject(streamError || new Error("Could not read a packaged file."));
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => {
            contents.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}
