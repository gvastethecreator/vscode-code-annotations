import picomatch from "picomatch";
import * as vscode from "vscode";
import type { RuntimeConfiguration } from "../configuration.ts";
import { isLikelyBinary } from "../core/binary.ts";
import { AnnotationIndex } from "../core/index.ts";
import { inferLanguageId } from "../core/language.ts";
import { matchAnnotations } from "../core/matcher.ts";
import {
  FILE_EVENT_DEBOUNCE_MS,
  type Annotation,
  type FileAnnotations,
  type IndexStatus,
  type PartialReason,
} from "../core/model.ts";

type PathMatcher = (path: string) => boolean;
type FileScan =
  | { readonly kind: "file"; readonly file: FileAnnotations }
  | { readonly kind: "binary" }
  | { readonly kind: "large" }
  | { readonly kind: "missing" }
  | { readonly kind: "error" };

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function addReason(reasons: PartialReason[], reason: PartialReason): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function combinedGlob(patterns: readonly string[]): string | undefined {
  if (patterns.length === 0) return undefined;
  return patterns.length === 1 ? patterns[0] : `{${patterns.join(",")}}`;
}

function compilePatterns(patterns: readonly string[]): readonly PathMatcher[] {
  const matchers: PathMatcher[] = [];
  for (const pattern of patterns) {
    try {
      matchers.push(picomatch(pattern, { dot: true }));
    } catch {
      // Invalid user globs are ignored. Configuration is untrusted input.
    }
  }
  return matchers;
}

export class WorkspaceCoordinator implements vscode.Disposable {
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();
  #watcher: vscode.FileSystemWatcher | undefined;
  #scanCancellation: vscode.CancellationTokenSource | undefined;
  #activeScan: Promise<void> | undefined;
  #generation = 0;
  #started = false;
  #includeMatchers: readonly PathMatcher[] = [];
  #excludeMatchers: readonly PathMatcher[] = [];

  constructor(
    readonly index: AnnotationIndex,
    private readonly getConfiguration: () => RuntimeConfiguration,
    private readonly onDidChange: () => void,
  ) {
    this.compilePathMatchers();
  }

  async ensureStarted(): Promise<void> {
    if (this.#activeScan) return this.#activeScan;
    if (this.#started) return;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.#started = true;
    this.ensureWatcher();
    this.#generation += 1;
    const generation = this.#generation;
    this.#scanCancellation?.cancel();
    this.#scanCancellation?.dispose();
    const cancellation = new vscode.CancellationTokenSource();
    this.#scanCancellation = cancellation;
    const scan = this.performScan(generation, cancellation.token).finally(() => {
      if (this.#generation === generation) this.#activeScan = undefined;
    });
    this.#activeScan = scan;
    await this.withDelayedProgress(scan, cancellation);
  }

  configurationChanged(): void {
    this.compilePathMatchers();
    if (this.#started) void this.refresh();
  }

  updateOpenDocument(document: vscode.TextDocument, annotations?: readonly Annotation[], truncated = false): void {
    if (!this.#started || !this.getConfiguration().enabled || !this.pathAllowed(document.uri)) return;
    const configuration = this.getConfiguration();
    if (new TextEncoder().encode(document.getText()).byteLength > configuration.maxFileSize) {
      this.index.removeFile(document.uri.toString());
      this.index.addPartialReason("file-size");
      this.onDidChange();
      return;
    }
    const match = annotations
      ? { annotations, truncated }
      : matchAnnotations(document.getText(), {
          uri: document.uri.toString(),
          languageId: document.languageId,
          source: "open-document",
          tokens: configuration.tokens,
          caseSensitive: configuration.caseSensitive,
          maxMessageLength: configuration.maxMessageLength,
          maxResults: configuration.maxPerFile,
        });
    if (match.truncated) this.index.addPartialReason("per-file-limit");
    this.index.replaceFile(
      { uri: document.uri.toString(), source: "open-document", annotations: match.annotations, truncated: match.truncated },
      configuration.maxResults,
    );
    this.onDidChange();
  }

  documentClosed(uri: vscode.Uri, wasDirty: boolean): void {
    if (!this.#started) return;
    this.scheduleFileEvent(uri, "change", wasDirty ? FILE_EVENT_DEBOUNCE_MS * 2 : FILE_EVENT_DEBOUNCE_MS);
  }

  private async withDelayedProgress(scan: Promise<void>, cancellation: vscode.CancellationTokenSource): Promise<void> {
    const completedQuickly = await Promise.race([scan.then(() => true), delay(350).then(() => false)]);
    if (completedQuickly) return;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Scanning code annotations", cancellable: true },
      async (_progress, token) => {
        const subscription = token.onCancellationRequested(() => cancellation.cancel());
        try {
          await scan;
        } finally {
          subscription.dispose();
        }
      },
    );
  }

  private async performScan(generation: number, token: vscode.CancellationToken): Promise<void> {
    const configuration = this.getConfiguration();
    if (!configuration.enabled || configuration.tokens.length === 0 || !vscode.workspace.workspaceFolders?.length) {
      this.index.replaceSnapshot([], { scanned: true, partialReasons: [], candidateFiles: 0, scannedFiles: 0, skippedFiles: 0 });
      this.onDidChange();
      return;
    }

    const partialReasons: PartialReason[] = [];
    const discovery = await this.discover(configuration, token);
    if (generation !== this.#generation) return;
    if (discovery.limitReached) addReason(partialReasons, "file-limit");

    const files: FileAnnotations[] = [];
    let scannedFiles = 0;
    let skippedFiles = 0;
    let totalResults = 0;
    let readErrors = 0;

    for (let start = 0; start < discovery.uris.length; start += 8) {
      if (token.isCancellationRequested) {
        addReason(partialReasons, "cancelled");
        break;
      }
      const batch = discovery.uris.slice(start, start + 8);
      const results = await Promise.all(batch.map((uri) => this.scanUri(uri, configuration)));
      if (generation !== this.#generation) return;
      for (const result of results) {
        if (result.kind === "file") {
          scannedFiles += 1;
          if (result.file.truncated) addReason(partialReasons, "per-file-limit");
          const remaining = configuration.maxResults - totalResults;
          if (remaining <= 0) {
            addReason(partialReasons, "result-limit");
            break;
          }
          const annotations = result.file.annotations.slice(0, remaining);
          if (annotations.length < result.file.annotations.length) addReason(partialReasons, "result-limit");
          totalResults += annotations.length;
          if (annotations.length > 0) files.push({ ...result.file, annotations, truncated: result.file.truncated || annotations.length < result.file.annotations.length });
        } else if (result.kind === "large") {
          skippedFiles += 1;
          addReason(partialReasons, "file-size");
        } else if (result.kind === "binary" || result.kind === "missing") {
          skippedFiles += 1;
        } else {
          skippedFiles += 1;
          readErrors += 1;
        }
      }
      if (partialReasons.includes("result-limit")) break;
    }

    if (token.isCancellationRequested) addReason(partialReasons, "cancelled");
    if (readErrors > 0) addReason(partialReasons, "read-errors");
    const status: IndexStatus = {
      scanned: true,
      partialReasons,
      candidateFiles: discovery.uris.length,
      scannedFiles,
      skippedFiles,
    };
    this.index.replaceSnapshot(files, status);
    for (const document of vscode.workspace.textDocuments) {
      if (generation !== this.#generation) return;
      if (this.pathAllowed(document.uri)) this.updateOpenDocument(document);
    }
    this.onDidChange();
    if (partialReasons.length > 0) {
      void vscode.window.showWarningMessage(
        `Code Annotations indexed ${totalResults} result${totalResults === 1 ? "" : "s"}. The index is partial because configured limits, cancellation, or read errors were reached.`,
      );
    }
  }

  private async discover(
    configuration: RuntimeConfiguration,
    token: vscode.CancellationToken,
  ): Promise<{ readonly uris: readonly vscode.Uri[]; readonly limitReached: boolean }> {
    const found = new Map<string, vscode.Uri>();
    let limitReached = false;
    const exclude = combinedGlob(configuration.exclude);
    for (const include of configuration.include) {
      if (token.isCancellationRequested) break;
      const remaining = configuration.maxFiles - found.size;
      if (remaining <= 0) {
        limitReached = true;
        break;
      }
      let candidates: readonly vscode.Uri[];
      try {
        candidates = await vscode.workspace.findFiles(include, exclude, remaining + 1, token);
      } catch {
        continue;
      }
      for (const uri of candidates) {
        if (this.pathAllowed(uri)) found.set(uri.toString(), uri);
        if (found.size > configuration.maxFiles) {
          limitReached = true;
          break;
        }
      }
      if (limitReached) break;
    }
    const uris = [...found.values()]
      .sort((left, right) => left.toString() < right.toString() ? -1 : left.toString() > right.toString() ? 1 : 0)
      .slice(0, configuration.maxFiles);
    return { uris, limitReached };
  }

  private async scanUri(uri: vscode.Uri, configuration: RuntimeConfiguration): Promise<FileScan> {
    const openDocument = vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri.toString());
    if (openDocument) {
      const text = openDocument.getText();
      if (new TextEncoder().encode(text).byteLength > configuration.maxFileSize) return { kind: "large" };
      return { kind: "file", file: this.matchFile(uri, openDocument.languageId, text, "open-document", configuration) };
    }

    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if ((stat.type & vscode.FileType.File) === 0) return { kind: "missing" };
      if (stat.size > configuration.maxFileSize) return { kind: "large" };
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.byteLength > configuration.maxFileSize) return { kind: "large" };
      if (isLikelyBinary(bytes)) return { kind: "binary" };
      const text = new TextDecoder("utf-8").decode(bytes);
      return { kind: "file", file: this.matchFile(uri, inferLanguageId(uri.path), text, "workspace-scan", configuration) };
    } catch (error) {
      return error instanceof vscode.FileSystemError && error.code === "FileNotFound" ? { kind: "missing" } : { kind: "error" };
    }
  }

  private matchFile(
    uri: vscode.Uri,
    languageId: string,
    text: string,
    source: "open-document" | "workspace-scan",
    configuration: RuntimeConfiguration,
  ): FileAnnotations {
    const result = matchAnnotations(text, {
      uri: uri.toString(),
      languageId,
      source,
      tokens: configuration.tokens,
      caseSensitive: configuration.caseSensitive,
      maxMessageLength: configuration.maxMessageLength,
      maxResults: configuration.maxPerFile,
    });
    return { uri: uri.toString(), source, annotations: result.annotations, truncated: result.truncated };
  }

  private ensureWatcher(): void {
    if (this.#watcher) return;
    const watcher = vscode.workspace.createFileSystemWatcher("**/*");
    watcher.onDidCreate((uri) => this.scheduleFileEvent(uri, "change"));
    watcher.onDidChange((uri) => this.scheduleFileEvent(uri, "change"));
    watcher.onDidDelete((uri) => this.scheduleFileEvent(uri, "delete"));
    this.#watcher = watcher;
  }

  private scheduleFileEvent(uri: vscode.Uri, kind: "change" | "delete", debounce = FILE_EVENT_DEBOUNCE_MS): void {
    if (!this.#started || !this.getConfiguration().enabled || !this.pathAllowed(uri)) return;
    const key = uri.toString();
    const existing = this.#timers.get(key);
    if (existing) clearTimeout(existing);
    this.#timers.set(
      key,
      setTimeout(() => {
        this.#timers.delete(key);
        void this.applyFileEvent(uri, kind);
      }, debounce),
    );
  }

  private async applyFileEvent(uri: vscode.Uri, kind: "change" | "delete"): Promise<void> {
    if (this.#activeScan) await this.#activeScan;
    const generation = this.#generation;
    if (!this.getConfiguration().enabled || !this.pathAllowed(uri)) return;
    if (kind === "delete") {
      this.index.removeFile(uri.toString());
      this.onDidChange();
      return;
    }
    if (vscode.workspace.textDocuments.some((document) => document.uri.toString() === uri.toString())) return;
    const configuration = this.getConfiguration();
    const result = await this.scanUri(uri, configuration);
    if (generation !== this.#generation) return;
    if (result.kind === "file") {
      if (result.file.truncated) this.index.addPartialReason("per-file-limit");
      this.index.replaceFile(result.file, configuration.maxResults);
    }
    else if (result.kind === "missing" || result.kind === "binary" || result.kind === "large") this.index.removeFile(uri.toString());
    if (result.kind === "large") this.index.addPartialReason("file-size");
    if (result.kind === "error") this.index.addPartialReason("read-errors");
    this.onDidChange();
  }

  private compilePathMatchers(): void {
    const configuration = this.getConfiguration();
    this.#includeMatchers = compilePatterns(configuration.include);
    this.#excludeMatchers = compilePatterns(configuration.exclude);
  }

  private pathAllowed(uri: vscode.Uri): boolean {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return false;
    const relative = vscode.workspace.asRelativePath(uri, false).replaceAll("\\", "/");
    return this.#includeMatchers.some((match) => match(relative)) && !this.#excludeMatchers.some((match) => match(relative));
  }

  dispose(): void {
    this.#generation += 1;
    this.#scanCancellation?.cancel();
    this.#scanCancellation?.dispose();
    this.#watcher?.dispose();
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
  }
}
