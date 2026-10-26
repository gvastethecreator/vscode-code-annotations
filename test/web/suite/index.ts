import * as vscode from "vscode";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("gvastethecreator.code-annotations");
  assert(extension, "Code Annotations was not discovered in the web host.");
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert(folder, "The virtual test workspace did not open.");
  assert(folder.uri.scheme === "vscode-test-web", "The web test is not using a virtual filesystem.");

  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await vscode.commands.executeCommand("codeAnnotations.showAll");
  await vscode.commands.executeCommand("codeAnnotations.next");
  const editor = vscode.window.activeTextEditor;
  assert(editor, "Web navigation did not open an editor.");
  assert(editor.document.uri.path.endsWith("src/annotations.ts"), "Web navigation opened the wrong file.");
  assert(editor.document.getText(editor.selection) === "TODO", "Web navigation did not select the first token.");
  assert(extension.isActive, "Show All did not activate Code Annotations in the web host.");
  console.log("Code Annotations web integration passed.");
}
