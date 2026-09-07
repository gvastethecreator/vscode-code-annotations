import * as vscode from "vscode";
import type { RuntimeConfiguration } from "../configuration.ts";
import { AnnotationIndex, type AnnotationGroup } from "../core/index.ts";
import type { Annotation, SemanticStyle } from "../core/model.ts";

type TreeNode = { readonly kind: "file"; readonly group: AnnotationGroup } | { readonly kind: "token"; readonly token: string; readonly annotations: readonly Annotation[] } | { readonly kind: "annotation"; readonly annotation: Annotation };

const ICONS: Record<SemanticStyle, string> = {
  info: "comment-discussion",
  muted: "note",
  review: "eye",
  warning: "warning",
  error: "error",
  deprecated: "archive",
};

export class AnnotationsTreeProvider implements vscode.TreeDataProvider<TreeNode>, vscode.Disposable {
  readonly #changeEmitter = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this.#changeEmitter.event;
  #filter: ReadonlySet<string> | undefined;
  #view: vscode.TreeView<TreeNode> | undefined;
  #grouping: "file" | "token" = "file";
  #activeFileOnly = false;
  #activeUri: string | undefined = vscode.window.activeTextEditor?.document.uri.toString();

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
    if (this.#activeFileOnly) pieces.push("active file");
    if (this.index.status.partialReasons.length > 0) pieces.push("partial");
    if (this.#view) this.#view.description = this.index.status.scanned ? pieces.join(" · ") : undefined;
    void vscode.commands.executeCommand("setContext", "codeAnnotations.hasScanned", this.index.status.scanned);
    void vscode.commands.executeCommand("setContext", "codeAnnotations.hasResults", total > 0);
    void vscode.commands.executeCommand("setContext", "codeAnnotations.hasFilter", this.#filter !== undefined);
    void vscode.commands.executeCommand("setContext", "codeAnnotations.isPartial", this.index.status.partialReasons.length > 0);
  }

  setFilter(tokens: ReadonlySet<string> | undefined): void {
    const configured = new Set(this.getConfiguration().tokens.map((entry) => entry.comparison));
    const retained = tokens && new Set([...tokens].filter((token) => configured.has(token)));
    this.#filter = retained && retained.size < configured.size ? retained : undefined;
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
    const configured = new Set(this.getConfiguration().tokens.map((entry) => entry.comparison));
    const retained = new Set([...this.#filter].filter((token) => configured.has(token)));
    this.#filter = retained.size < configured.size ? retained : undefined;
    this.refresh();
  }

  get filter(): ReadonlySet<string> | undefined {
    return this.#filter;
  }

  get filteredAnnotations(): readonly Annotation[] {
    return this.index.all(this.#filter, this.getConfiguration().caseSensitive)
      .filter((annotation) => !this.#activeFileOnly || annotation.uri === this.#activeUri);
  }

  setGrouping(grouping: "file" | "token"): void {
    this.#grouping = grouping;
    this.refresh();
  }

  setActiveFileOnly(enabled: boolean): void {
    this.#activeFileOnly = enabled;
    this.refresh();
  }

  activeEditorChanged(editor: vscode.TextEditor | undefined): void {
    this.#activeUri = editor?.document.uri.toString();
    if (this.#activeFileOnly) this.refresh();
  }

  exportText(): string {
    return JSON.stringify({
      scope: this.#activeFileOnly ? "active-file" : "workspace",
      activeUri: this.#activeFileOnly ? this.#activeUri ?? null : undefined,
      tokens: this.#filter ? [...this.#filter] : null,
      caseSensitive: this.getConfiguration().caseSensitive,
      status: this.index.status,
      annotations: this.filteredAnnotations,
    }, null, 2) + "\n";
  }

  dispose(): void {
    this.#changeEmitter.dispose();
    this.#view = undefined;
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.kind === "token") {
      const item = new vscode.TreeItem(element.token, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `token:${element.token}`;
      item.description = `${element.annotations.length}`;
      item.iconPath = new vscode.ThemeIcon("symbol-keyword");
      return item;
    }
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
    item.description = this.#grouping === "token"
      ? `${vscode.workspace.asRelativePath(vscode.Uri.parse(annotation.uri), true)}:${annotation.line + 1}`
      : `Ln ${annotation.line + 1}`;
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
    if (!element) {
      const groups = new Map<string, Annotation[]>();
      for (const annotation of this.filteredAnnotations) {
        const key = this.#grouping === "file" ? annotation.uri
          : this.getConfiguration().caseSensitive ? annotation.token : annotation.token.toLowerCase();
        const group = groups.get(key) ?? [];
        group.push(annotation);
        groups.set(key, group);
      }
      return [...groups].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, annotations]): TreeNode => this.#grouping === "file"
          ? { kind: "file", group: { uri: key, annotations } }
          : { kind: "token", token: this.getConfiguration().tokens.find((entry) => entry.comparison === key)?.token ?? key, annotations });
    }
    if (element.kind === "file") return element.group.annotations.map((annotation) => ({ kind: "annotation", annotation }));
    if (element.kind === "token") return element.annotations.map((annotation) => ({ kind: "annotation", annotation }));
    return [];
  }
}
