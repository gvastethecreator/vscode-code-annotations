import * as vscode from "vscode";
import type { RuntimeConfiguration } from "../configuration.ts";
import { matchAnnotations } from "../core/matcher.ts";
import { EDITOR_DEBOUNCE_MS, type Annotation, type SemanticStyle } from "../core/model.ts";

const STYLES: readonly SemanticStyle[] = ["info", "muted", "review", "warning", "error", "deprecated"];

export class AnnotationDecorations implements vscode.Disposable {
  readonly #types = new Map<SemanticStyle, vscode.TextEditorDecorationType>();
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #matches = new Map<string, { readonly version: number; readonly signature: string; readonly annotations: readonly Annotation[]; readonly truncated: boolean }>();
  readonly #disposables: vscode.Disposable[] = [];

  constructor(
    private readonly getConfiguration: () => RuntimeConfiguration,
    private readonly onAnnotations: (document: vscode.TextDocument, annotations: readonly Annotation[], truncated: boolean) => void,
  ) {
    for (const style of STYLES) {
      const color = new vscode.ThemeColor(`codeAnnotations.${style}Foreground`);
      this.#types.set(
        style,
        vscode.window.createTextEditorDecorationType({
          color,
          fontWeight: "600",
          borderColor: color,
          borderStyle: "solid",
          borderWidth: "0 0 1px 0",
          rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        }),
      );
    }
    this.#disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(() => this.refresh()),
      vscode.workspace.onDidChangeTextDocument((event) => this.schedule(event.document)),
      vscode.workspace.onDidCloseTextDocument((document) => {
        const key = document.uri.toString();
        const timer = this.#timers.get(key);
        if (timer) clearTimeout(timer);
        this.#timers.delete(key);
        this.#matches.delete(key);
      }),
    );
    this.refresh();
  }

  refresh(): void {
    for (const editor of vscode.window.visibleTextEditors) this.update(editor);
  }

  schedule(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const existing = this.#timers.get(key);
    if (existing) clearTimeout(existing);
    this.#timers.set(
      key,
      setTimeout(() => {
        this.#timers.delete(key);
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document.uri.toString() === key) this.update(editor);
        }
      }, EDITOR_DEBOUNCE_MS),
    );
  }

  update(editor: vscode.TextEditor): void {
    const configuration = this.getConfiguration();
    const key = editor.document.uri.toString();
    const clear = (): void => {
      for (const type of this.#types.values()) editor.setDecorations(type, []);
    };
    if (!configuration.enabled || configuration.tokens.length === 0) {
      this.#matches.delete(key);
      clear();
      this.onAnnotations(editor.document, [], false);
      return;
    }
    const text = editor.document.getText();
    if (new TextEncoder().encode(text).byteLength > configuration.maxFileSize) {
      this.#matches.delete(key);
      clear();
      this.onAnnotations(editor.document, [], false);
      return;
    }
    const signature = JSON.stringify([
      editor.document.languageId,
      configuration.caseSensitive,
      configuration.maxMessageLength,
      configuration.maxPerFile,
      configuration.tokens.map(({ comparison, style }) => [comparison, style]),
    ]);
    const cached = this.#matches.get(key);
    const result = cached?.version === editor.document.version && cached.signature === signature
      ? cached
      : matchAnnotations(text, {
          uri: key,
          languageId: editor.document.languageId,
          source: "open-document",
          tokens: configuration.tokens,
          caseSensitive: configuration.caseSensitive,
          maxMessageLength: configuration.maxMessageLength,
          maxResults: configuration.maxPerFile,
        });
    if (result !== cached) {
      this.#matches.set(key, { version: editor.document.version, signature, annotations: result.annotations, truncated: result.truncated });
    }
    if (configuration.decorationsEnabled) {
      for (const style of STYLES) {
        const ranges = result.annotations
          .filter((annotation) => annotation.style === style)
          .map((annotation) => new vscode.Range(editor.document.positionAt(annotation.start), editor.document.positionAt(annotation.end)));
        editor.setDecorations(this.#types.get(style)!, ranges);
      }
    } else {
      clear();
    }
    this.onAnnotations(editor.document, result.annotations, result.truncated);
  }

  dispose(): void {
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
    this.#matches.clear();
    for (const disposable of [...this.#disposables, ...this.#types.values()]) disposable.dispose();
  }
}
