import * as vscode from "vscode";
import type { RuntimeConfiguration } from "../configuration.ts";
import { AnnotationIndex, type AnnotationGroup } from "../core/index.ts";
import type { Annotation, SemanticStyle } from "../core/model.ts";

type TreeNode = { readonly kind: "file"; readonly group: AnnotationGroup } | { readonly kind: "annotation"; readonly annotation: Annotation };

const ICONS: Record<SemanticStyle, string> = {
  info: "comment-discussion",
  muted: "note",
  review: "eye",
  warning: "warning",
  error: "error",
  deprecated: "archive",
};

export class AnnotationsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  readonly #changeEmitter = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this.#changeEmitter.event;
  #filter: ReadonlySet<string> | undefined;
  #view: vscode.TreeView<TreeNode> | undefined;

  constructor(
    private readonly index: AnnotationIndex,
    private readonly getConfiguration: () => RuntimeConfiguration,
  ) {}

  attach(view: vscode.TreeView<TreeNode>): void {
    this.#view = view;
    this.refresh();
  }

  refresh(): void {
    this.#changeEmitter.fire(undefined);
    const total = this.filteredAnnotations.length;
    const pieces = [`${total} annotation${total === 1 ? "" : "s"}`];
    if (this.#filter) pieces.push(`${this.#filter.size} token${this.#filter.size === 1 ? "" : "s"}`);
    if (this.index.status.partialReasons.length > 0) pieces.push("partial");
    if (this.#view) this.#view.description = this.index.status.scanned ? pieces.join(" · ") : undefined;
    void vscode.commands.executeCommand("setContext", "codeAnnotations.hasScanned", this.index.status.scanned);
    void vscode.commands.executeCommand("setContext", "codeAnnotations.hasResults", total > 0);
    void vscode.commands.executeCommand("setContext", "codeAnnotations.hasFilter", this.#filter !== undefined);
    void vscode.commands.executeCommand("setContext", "codeAnnotations.isPartial", this.index.status.partialReasons.length > 0);
  }

  setFilter(tokens: ReadonlySet<string> | undefined): void {
    const configurationTokens = this.getConfiguration().tokens.map((entry) => entry.token.toLowerCase());
    this.#filter = tokens && tokens.size < configurationTokens.length ? new Set(tokens) : undefined;
    this.refresh();
  }

  clearFilter(): void {
    this.setFilter(undefined);
  }

  configurationChanged(): void {
    if (!this.#filter) {
      this.refresh();
      return;
    }
    const configured = new Set(this.getConfiguration().tokens.map((entry) => entry.token.toLowerCase()));
    const retained = new Set([...this.#filter].filter((token) => configured.has(token)));
    this.#filter = retained.size > 0 && retained.size < configured.size ? retained : undefined;
    this.refresh();
  }

  get filter(): ReadonlySet<string> | undefined {
    return this.#filter;
  }

  get filteredAnnotations(): readonly Annotation[] {
    return this.index.all(this.#filter);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.kind === "file") {
      const uri = vscode.Uri.parse(element.group.uri);
      const includeFolder = (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
      const label = vscode.workspace.asRelativePath(uri, includeFolder);
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `file:${element.group.uri}`;
      item.description = `${element.group.annotations.length}`;
      item.contextValue = "codeAnnotations.file";
      item.iconPath = new vscode.ThemeIcon("file-code");
      item.resourceUri = uri;
      item.accessibilityInformation = { label: `${label}, ${element.group.annotations.length} annotations` };
      return item;
    }

    const { annotation } = element;
    const message = annotation.message || "No details";
    const item = new vscode.TreeItem(`${annotation.token}  ${message}`, vscode.TreeItemCollapsibleState.None);
    item.id = annotation.id;
    item.description = `Ln ${annotation.line + 1}`;
    item.contextValue = "codeAnnotations.annotation";
    item.iconPath = new vscode.ThemeIcon(ICONS[annotation.style], new vscode.ThemeColor(`codeAnnotations.${annotation.style}Foreground`));
    item.tooltip = `${annotation.token}: ${message}\nLine ${annotation.line + 1}`;
    item.command = { command: "codeAnnotations.openAnnotation", title: "Open Annotation", arguments: [annotation.id] };
    item.accessibilityInformation = {
      label: `${annotation.token}, ${message}, line ${annotation.line + 1}${annotation.messageTruncated ? ", message truncated" : ""}`,
    };
    return item;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) return this.index.groups(this.#filter).map((group) => ({ kind: "file", group }));
    if (element.kind === "file") return element.group.annotations.map((annotation) => ({ kind: "annotation", annotation }));
    return [];
  }
}
