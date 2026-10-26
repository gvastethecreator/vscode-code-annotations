import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-web";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
await runTests({
  browserOptions: process.env.CI ? ["--no-sandbox", "--disable-gpu"] : undefined,
  browserType: "chromium",
  extensionDevelopmentPath: root,
  extensionTestsPath: path.join(root, "dist", "web", "test", "suite", "index.cjs"),
  folderPath: path.join(root, "test-workspace"),
  headless: true,
  quality: "stable",
  testRunnerDataDir: path.join(root, ".vscode-test-web"),
});
