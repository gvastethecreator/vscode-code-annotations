import * as vscode from "vscode";

interface SettingsScope extends vscode.QuickPickItem {
  readonly target: vscode.ConfigurationTarget;
  readonly uri?: vscode.Uri;
}

export async function changeSettings(
  namespace: string,
  title: string,
  keys: readonly string[],
  mode: "defaults" | "inherit",
  supportsFolder: boolean,
): Promise<boolean> {
  const scopes: SettingsScope[] = [{ label: "User", description: "This VS Code profile", target: vscode.ConfigurationTarget.Global }];
  const workspace = vscode.workspace.workspaceFile?.toString();
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (workspace || folders.length) {
    scopes.push({ label: "Workspace", description: "The current workspace", target: vscode.ConfigurationTarget.Workspace });
  }
  if (supportsFolder && workspace) {
    for (const folder of folders) scopes.push({ label: `Folder: ${folder.name}`, description: folder.uri.toString(true), target: vscode.ConfigurationTarget.WorkspaceFolder, uri: folder.uri });
  }
  const action = mode === "defaults" ? "Apply Factory Defaults" : "Reset to Inherited Settings";
  const scope = await vscode.window.showQuickPick(scopes, { title: `${title}: ${action}`, placeHolder: "Choose the one scope to change" });
  if (!scope) return false;
  const confirmation = await vscode.window.showWarningMessage(
    `${action} in ${scope.label}? ${mode === "inherit" ? "Remove explicit values so settings inherit from other scopes." : "Write the extension's factory values."} Language overrides and other scopes stay unchanged.`,
    { modal: true }, action,
  );
  if (confirmation !== action) return false;
  if (scope.target !== vscode.ConfigurationTarget.Global && (
    workspace !== vscode.workspace.workspaceFile?.toString() ||
    folders.map((folder) => folder.uri.toString()).join("\n") !== (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.toString()).join("\n")
  )) {
    void vscode.window.showWarningMessage("The workspace changed. Choose a scope again.");
    return false;
  }
  const configuration = vscode.workspace.getConfiguration(namespace, scope.uri);
  // No languageId scope: never touch [language] overrides.
  const values = keys.map((key) => {
    const inspected = configuration.inspect(key);
    if (!inspected) throw new Error(`Unknown setting: ${namespace}.${key}`);
    return { key, value: mode === "inherit" ? undefined : inspected.defaultValue };
  });
  let completed = 0;
  try {
    for (const { key, value } of values) {
      await configuration.update(key, value, scope.target, false);
      completed++;
    }
    return true;
  } catch {
    void vscode.window.showErrorMessage(`${title}: ${completed} of ${values.length} settings changed in ${scope.label}. Review that scope before retrying.`);
    return false;
  }
}
