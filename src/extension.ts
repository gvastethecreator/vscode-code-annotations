import * as vscode from "vscode";
import { COMMANDS } from "./commands.ts";

export function activate(context: vscode.ExtensionContext): void {
  for (const id of COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => {
        void vscode.window.showErrorMessage("This command is not implemented yet.");
      }),
    );
  }
}

export function deactivate(): void {}
