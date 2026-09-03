import * as vscode from "vscode";
import { COMMANDS } from "./commands.ts";
import { readConfiguration, type RuntimeConfiguration } from "./configuration.ts";
import { AnnotationIndex } from "./core/index.ts";
import type { Annotation } from "./core/model.ts";
import { AnnotationDecorations } from "./editor/decorations.ts";
import { AnnotationsTreeProvider } from "./views/annotationsTree.ts";
import { WorkspaceCoordinator } from "./workspace/coordinator.ts";

const VIEW_ID = "codeAnnotations.workspace";

function compareLocation(left: Annotation, uri: string, line: number, character: number): number {
  if (left.uri !== uri) return left.uri < uri ? -1 : 1;
  if (left.line !== line) return left.line - line;
  return left.character - character;
}

async function offerSettings(message: string): Promise<void> {
  const action = await vscode.window.showInformationMessage(message, "Open Settings");
  if (action === "Open Settings") {
    await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:gvastethecreator.code-annotations");
  }
}

export function activate(context: vscode.ExtensionContext): void {
  let configuration = readConfiguration();
  const getConfiguration = (): RuntimeConfiguration => configuration;
  const index = new AnnotationIndex();
  const provider = new AnnotationsTreeProvider(index, getConfiguration);
  const tree = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: provider, showCollapseAll: true });
  provider.attach(tree);

  const coordinator = new WorkspaceCoordinator(index, getConfiguration, () => provider.refresh());
  const decorations = new AnnotationDecorations(getConfiguration, (document, annotations, truncated) => {
    coordinator.updateOpenDocument(document, annotations, truncated);
  });
  const dirtyDocuments = new Set<string>();

  async function requireEnabled(): Promise<boolean> {
    if (configuration.enabled) return true;
    await offerSettings("Code Annotations is disabled for this workspace.");
    return false;
  }

  async function openAnnotation(id: unknown): Promise<void> {
    if (typeof id !== "string") {
      void vscode.window.showWarningMessage("This annotation target is invalid. Refresh the view.");
      return;
    }
    const annotation = index.findById(id);
    if (!annotation) {
      void vscode.window.showWarningMessage("This annotation changed or was removed. Refresh the view.");
      return;
    }
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(annotation.uri));
      const start = new vscode.Position(annotation.line, annotation.character);
      const end = new vscode.Position(annotation.line, annotation.endCharacter);
      const range = new vscode.Range(start, end);
      if (document.validateRange(range).isEqual(range) === false || document.getText(range) !== annotation.token) {
        void vscode.window.showWarningMessage("This annotation moved after the index was built. Refresh the view.");
        return;
      }
      const editor = await vscode.window.showTextDocument(document, { preview: true, preserveFocus: false });
      editor.selection = new vscode.Selection(start, end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    } catch {
      void vscode.window.showWarningMessage("Code Annotations could not open this annotation. Refresh the view.");
    }
  }

  async function navigate(direction: "next" | "previous"): Promise<void> {
    if (!(await requireEnabled())) return;
    await coordinator.ensureStarted();
    const annotations = provider.filteredAnnotations;
    if (annotations.length === 0) {
      void vscode.window.showInformationMessage("No code annotations match the current filter.");
      return;
    }
    const editor = vscode.window.activeTextEditor;
    let target: Annotation | undefined;
    if (!editor) {
      target = direction === "next" ? annotations[0] : annotations.at(-1);
    } else {
      const uri = editor.document.uri.toString();
      const position = direction === "next" ? editor.selection.end : editor.selection.start;
      if (direction === "next") {
        target = annotations.find((annotation) => compareLocation(annotation, uri, position.line, position.character) > 0) ?? annotations[0];
      } else {
        target = [...annotations].reverse().find((annotation) => compareLocation(annotation, uri, position.line, position.character) < 0) ?? annotations.at(-1);
      }
    }
    if (target) await openAnnotation(target.id);
  }

  context.subscriptions.push(
    tree,
    coordinator,
    decorations,
    tree.onDidChangeVisibility((event) => {
      if (event.visible && configuration.enabled) void coordinator.ensureStarted();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.isDirty) dirtyDocuments.add(event.document.uri.toString());
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      dirtyDocuments.delete(document.uri.toString());
      coordinator.updateOpenDocument(document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      const key = document.uri.toString();
      const wasDirty = dirtyDocuments.delete(key);
      coordinator.documentClosed(document.uri, wasDirty);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("codeAnnotations")) return;
      configuration = readConfiguration();
      void vscode.commands.executeCommand("setContext", "codeAnnotations.enabled", configuration.enabled);
      if (configuration.rejectedTokens > 0) {
        void vscode.window.showWarningMessage(
          `Code Annotations ignored ${configuration.rejectedTokens} invalid or duplicate token${configuration.rejectedTokens === 1 ? "" : "s"}.`,
        );
      }
      decorations.refresh();
      coordinator.configurationChanged();
      provider.configurationChanged();
    }),
    vscode.commands.registerCommand(COMMANDS.refreshWorkspace, async () => {
      if (!(await requireEnabled())) return;
      await coordinator.refresh();
    }),
    vscode.commands.registerCommand(COMMANDS.showAll, async () => {
      if (!(await requireEnabled())) return;
      provider.clearFilter();
      await coordinator.ensureStarted();
      await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
    }),
    vscode.commands.registerCommand(COMMANDS.filterTokens, async () => {
      if (!(await requireEnabled())) return;
      await coordinator.ensureStarted();
      if (configuration.tokens.length === 0) {
        await offerSettings("No valid annotation tokens are configured.");
        return;
      }
      const items = configuration.tokens.map((entry) => ({
        label: entry.token,
        picked: provider.filter ? provider.filter.has(entry.token.toLowerCase()) : true,
      }));
      const selected = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        title: "Filter Code Annotations",
        placeHolder: "Choose tokens to show",
      });
      if (!selected) return;
      provider.setFilter(new Set(selected.map((item) => item.label.toLowerCase())));
    }),
    vscode.commands.registerCommand(COMMANDS.clearFilter, () => provider.clearFilter()),
    vscode.commands.registerCommand(COMMANDS.next, () => navigate("next")),
    vscode.commands.registerCommand(COMMANDS.previous, () => navigate("previous")),
    vscode.commands.registerCommand(COMMANDS.openAnnotation, (id: unknown) => openAnnotation(id)),
  );

  void vscode.commands.executeCommand("setContext", "codeAnnotations.enabled", configuration.enabled);
  if (configuration.rejectedTokens > 0) {
    void vscode.window.showWarningMessage(
      `Code Annotations ignored ${configuration.rejectedTokens} invalid or duplicate token${configuration.rejectedTokens === 1 ? "" : "s"}.`,
    );
  }
  if (tree.visible && configuration.enabled) void coordinator.ensureStarted();
}

export function deactivate(): void {}
