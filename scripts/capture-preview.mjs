import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executablePath = process.env.VSCODE_EXECUTABLE_PATH;
assert.ok(executablePath, "Set VSCODE_EXECUTABLE_PATH to the tested VS Code executable.");
const requested = process.env.VSIX_PATH;
const vsix = requested
  ? path.resolve(root, requested)
  : path.join(root, (await readdir(root)).find((name) => /^code-annotations(?:-.*)?\.vsix$/.test(name)) || "");
assert.ok(vsix.endsWith(".vsix"), "Build the Code Annotations VSIX before capturing the preview.");

const scratch = path.join(root, ".scratch", "capture-preview");
const profile = path.join(scratch, "profile");
const extensions = path.join(scratch, "extensions");
const workspace = path.join(scratch, "code-annotations-preview");
const fixture = path.join(workspace, "src", "annotations.ts");
const raw = path.join(scratch, "raw.png");
await rm(scratch, { force: true, recursive: true });
await mkdir(path.join(profile, "User"), { recursive: true });
await cp(path.join(root, "test-workspace"), workspace, { recursive: true });
await writeFile(
  path.join(profile, "User", "settings.json"),
  JSON.stringify({
    "breadcrumbs.enabled": false,
    "git.enabled": false,
    "git.openRepositoryInParentFolders": "never",
    "telemetry.telemetryLevel": "off",
    "window.commandCenter": false,
    "workbench.secondarySideBar.defaultVisibility": "hidden",
    "workbench.startupEditor": "none",
    "workbench.tree.indent": 14,
  }),
  "utf8",
);

const cliScript = await findCliScript(executablePath);
const cliEnvironment = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };
delete cliEnvironment.VSCODE_DEV;
const install = spawnSync(
  executablePath,
  [cliScript, "--install-extension", vsix, "--force", "--extensions-dir", extensions, "--user-data-dir", profile],
  { encoding: "utf8", env: cliEnvironment, stdio: "inherit" },
);
assert.equal(install.status, 0, "VSIX installation failed before preview capture.");

const application = await electron.launch({
  executablePath,
  args: [
    "--new-window",
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-workspace-trust",
    "--disable-updates",
    "--disable-gpu",
    "--user-data-dir",
    profile,
    "--extensions-dir",
    extensions,
    workspace,
    "--goto",
    `${fixture}:1:1`,
  ],
  timeout: 60_000,
});

try {
  const window = await application.firstWindow({ timeout: 60_000 });
  await application.evaluate(({ BrowserWindow }) => {
    const active = BrowserWindow.getAllWindows()[0];
    active?.setSize(1280, 800);
  });
  await window.waitForSelector(".monaco-workbench", { timeout: 60_000 });
  await window.waitForTimeout(2_000);
  await window.waitForFunction(() => document.querySelector(".view-lines")?.textContent?.includes("queueJob"), undefined, { timeout: 30_000 });
  await window.keyboard.press("F1");
  await window.waitForSelector(".quick-input-widget", { state: "visible", timeout: 10_000 });
  await window.keyboard.type("Code Annotations: Show All");
  await window.waitForFunction(() => document.querySelector(".quick-input-widget")?.textContent?.includes("Code Annotations: Show All"), undefined, { timeout: 10_000 });
  await window.keyboard.press("Enter");
  await window.waitForFunction(
    () => [...document.querySelectorAll(".monaco-list-row")].some((element) => element.textContent?.includes("Validate the job name before queueing")),
    undefined,
    { timeout: 30_000 },
  );
  await window.waitForTimeout(1_000);
  await window.screenshot({ path: raw, animations: "disabled" });

  const framedWidth = 1120;
  const framedHeight = 720;
  const screenshot = await sharp(raw)
    .resize(framedWidth, framedHeight, { fit: "cover", position: "centre" })
    .composite([
      {
        input: Buffer.from(`<svg width="${framedWidth}" height="${framedHeight}"><rect width="100%" height="100%" rx="18" fill="white"/></svg>`),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
  await sharp({ create: { width: 1200, height: 800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: screenshot, left: 40, top: 40 }])
    .png()
    .toFile(path.join(root, "media", "preview.png"));
  console.log("Captured media/preview.png from the installed Code Annotations VSIX in VS Code.");
} finally {
  await application.close();
}

async function findCliScript(executable) {
  const installationRoot = path.dirname(executable);
  const direct = path.join(installationRoot, "resources", "app", "out", "cli.js");
  try {
    await access(direct);
    return direct;
  } catch {}
  for (const entry of await readdir(installationRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(installationRoot, entry.name, "resources", "app", "out", "cli.js");
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("Could not locate VS Code's CLI entry point.");
}
