import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";
import { downloadVSCode } from "./download-vscode.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const version = process.env.VSCODE_TEST_VERSION || "stable";
const vscodeExecutablePath = await downloadVSCode(version);
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "code-annotations-"));
const primaryWorkspace = path.join(temporaryRoot, "workspace-primary");
const secondaryWorkspace = path.join(temporaryRoot, "workspace-secondary");
const workspace = path.join(temporaryRoot, "code-annotations.code-workspace");
await cp(path.join(root, "test-workspace"), primaryWorkspace, { recursive: true });
await mkdir(path.join(secondaryWorkspace, "src"), { recursive: true });
await writeFile(path.join(secondaryWorkspace, "src", "extra.ts"), "// DEPRECATED: Secondary workspace.\n", "utf8");
await writeFile(workspace, JSON.stringify({ folders: [{ path: primaryWorkspace }, { path: secondaryWorkspace }] }), "utf8");
const launchArgs = [
  workspace,
  "--disable-extensions",
  "--skip-welcome",
  "--skip-release-notes",
  "--user-data-dir",
  path.join(temporaryRoot, "data"),
  "--extensions-dir",
  path.join(temporaryRoot, "ext"),
];
if (process.platform === "linux") {
  launchArgs.push("--disable-gpu");
  if (process.env.CI) launchArgs.push("--no-sandbox");
}

try {
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(root, "test", "integration", "suite", "index.cjs"),
    launchArgs,
    reuseMachineInstall: true,
    vscodeExecutablePath,
  });
} finally {
  if (temporaryRoot.startsWith(os.tmpdir() + path.sep)) {
    await rm(temporaryRoot, { force: true, maxRetries: 10, recursive: true, retryDelay: 200 });
  }
}
