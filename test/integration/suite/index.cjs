const assert = require("node:assert/strict");
const vscode = require("vscode");

const commands = [
  "codeAnnotations.refreshWorkspace",
  "codeAnnotations.showAll",
  "codeAnnotations.filterTokens",
  "codeAnnotations.clearFilter",
  "codeAnnotations.next",
  "codeAnnotations.previous",
];

async function run() {
  const extension = vscode.extensions.getExtension("gvastethecreator.code-annotations");
  assert.ok(extension, "Code Annotations was not discovered.");
  assert.deepEqual(extension.packageJSON.extensionKind, ["workspace", "ui"]);
  assert.equal(extension.packageJSON.capabilities.untrustedWorkspaces.supported, true);
  assert.equal(extension.packageJSON.capabilities.virtualWorkspaces.supported, true);
  assert.ok(
    Object.values(extension.packageJSON.contributes.configuration.properties).every((entry) => entry.scope === "window"),
    "Multi-root settings must resolve once per window.",
  );
  const configuration = vscode.workspace.getConfiguration("codeAnnotations");
  assert.equal(configuration.get("enabled"), true);
  assert.deepEqual(configuration.get("tokens"), ["TODO", "FIXME", "HACK", "NOTE", "REVIEW", "DEPRECATED"]);
  assert.equal(configuration.get("scan.maxFileSize"), 1_048_576);
  assert.equal(configuration.get("scan.maxFiles"), 20_000);
  assert.equal(configuration.get("scan.maxResults"), 10_000);
  const discovered = await vscode.workspace.findFiles("**/*", "{**/.git/**,**/node_modules/**,**/dist/**,**/build/**,**/out/**,**/coverage/**,**/.next/**,**/.cache/**,**/vendor/**,**/*.min.js,**/*.map}");
  assert.equal(vscode.workspace.workspaceFolders.length, 2, "The integration fixture is not multi-root.");
  assert.ok(discovered.some((uri) => uri.path.endsWith("src/annotations.ts")), "The fixture was not discoverable through the production glob contract.");
  assert.ok(discovered.some((uri) => uri.path.endsWith("src/extra.ts")), "The secondary workspace was not discoverable.");

  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await vscode.commands.executeCommand("codeAnnotations.showAll");
  assert.equal(extension.isActive, true, "Show All did not activate Code Annotations.");
  const registered = await vscode.commands.getCommands(true);
  for (const id of commands) assert.ok(registered.includes(id), `${id} was not registered.`);
  await vscode.commands.executeCommand("codeAnnotations.next");
  assertSelection("TODO", "src/annotations.ts");

  await vscode.commands.executeCommand("codeAnnotations.previous");
  assertSelection("DEPRECATED", "src/extra.ts");
  await vscode.commands.executeCommand("codeAnnotations.next");
  assertSelection("TODO", "src/annotations.ts");

  const folder = vscode.workspace.workspaceFolders[0];
  const created = vscode.Uri.joinPath(folder.uri, "src", "000-created.ts");
  await vscode.workspace.fs.writeFile(created, new TextEncoder().encode("// NOTE: Added after the initial scan.\n"));
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await waitForSelection("codeAnnotations.next", "NOTE", "src/000-created.ts");
  await vscode.workspace.fs.delete(created);
  await delay(800);
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await vscode.commands.executeCommand("codeAnnotations.next");
  assertSelection("TODO", "src/annotations.ts");

  await configuration.update("decorations.enabled", false, vscode.ConfigurationTarget.Workspace);
  await delay(800);
  const openOnly = vscode.Uri.joinPath(folder.uri, "src", "000-open.ts");
  await vscode.workspace.fs.writeFile(openOnly, new Uint8Array());
  const openDocument = await vscode.workspace.openTextDocument(openOnly);
  const openEditor = await vscode.window.showTextDocument(openDocument);
  await openEditor.edit((builder) => builder.insert(new vscode.Position(0, 0), "// NOTE: Indexed while decorations are hidden.\n"));
  await delay(600);
  await vscode.commands.executeCommand("codeAnnotations.previous");
  assertSelection("NOTE", "src/000-open.ts");
  await vscode.commands.executeCommand("workbench.action.files.revert");
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await vscode.workspace.fs.delete(openOnly);
  await configuration.update("decorations.enabled", true, vscode.ConfigurationTarget.Workspace);

  // Prompt stubs affect only the development extension API instance. Installed
  // smoke uses a separate runner extension; the full prompt cases run above that
  // packaging layer in test:integration. Keep noninteractive installed checks.
  if (process.env.VSIX_SMOKE !== "1") {
  const caseUri = vscode.Uri.joinPath(folder.uri, "src", "case-filter.ts");
  await vscode.workspace.fs.writeFile(caseUri, new TextEncoder().encode("// TODO upper\n// todo lower\n"));
  await configuration.update("tokens", ["TODO", "todo"], vscode.ConfigurationTarget.Workspace);
  await delay(400);
  await vscode.commands.executeCommand("codeAnnotations.refreshWorkspace");
  const caseDocument = await vscode.workspace.openTextDocument(caseUri);
  await vscode.window.showTextDocument(caseDocument);
  const originalPick = vscode.window.showQuickPick;
  try {
    vscode.window.showQuickPick = async (items) => items.find((item) => item.activeOnly === true);
    await vscode.commands.executeCommand("codeAnnotations.viewScope");
    vscode.window.showQuickPick = async (items) => items.find((item) => item.value === "token");
    await vscode.commands.executeCommand("codeAnnotations.groupBy");
    vscode.window.showQuickPick = async (items) => items.filter((item) => item.label === "todo");
    await vscode.commands.executeCommand("codeAnnotations.filterTokens");
    await vscode.commands.executeCommand("codeAnnotations.exportFiltered");
    const exported = JSON.parse(vscode.window.activeTextEditor.document.getText());
    assert.equal(exported.scope, "active-file");
    assert.equal(exported.status.scanned, true);
    assert.ok(Array.isArray(exported.status.partialReasons));
    assert.deepEqual(exported.annotations.map((annotation) => [annotation.uri, annotation.token, annotation.message]), [[caseUri.toString(), "todo", "lower"]]);
    await vscode.window.showTextDocument(caseDocument);
    await vscode.commands.executeCommand("codeAnnotations.next");
    assertSelection("todo", "case-filter.ts");
    vscode.window.showQuickPick = async () => [];
    await vscode.commands.executeCommand("codeAnnotations.filterTokens");
    await vscode.commands.executeCommand("codeAnnotations.exportFiltered");
    assert.deepEqual(JSON.parse(vscode.window.activeTextEditor.document.getText()).annotations, []);
  } finally {
    vscode.window.showQuickPick = originalPick;
    await configuration.update("tokens", undefined, vscode.ConfigurationTarget.Workspace);
  }
  }
  console.log("Code Annotations desktop integration passed, including case-sensitive projections and export.");
}

function assertSelection(expected, suffix) {
  const editor = vscode.window.activeTextEditor;
  assert.ok(editor, "Navigation did not open an editor.");
  assert.ok(editor.document.uri.path.endsWith(suffix), `Unexpected navigation target: ${editor.document.uri.path}`);
  assert.equal(editor.document.getText(editor.selection), expected);
}

async function waitForSelection(command, expected, suffix, timeout = 5_000) {
  const deadline = Date.now() + timeout;
  let lastTarget = "no active editor";
  while (Date.now() < deadline) {
    await vscode.commands.executeCommand(command);
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selected = editor.document.getText(editor.selection);
      lastTarget = `${editor.document.uri.path} (${JSON.stringify(selected)})`;
      if (editor.document.uri.path.endsWith(suffix) && selected === expected) return;
    }
    await delay(100);
  }
  assert.fail(`Timed out waiting for ${suffix} ${expected}; last target: ${lastTarget}`);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

module.exports = { run };
