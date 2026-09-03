import { compareOrdinal } from "./matcher.ts";
import type { Annotation, FileAnnotations, IndexStatus, PartialReason } from "./model.ts";

export interface AnnotationGroup {
  readonly uri: string;
  readonly annotations: readonly Annotation[];
}

const EMPTY_STATUS: IndexStatus = {
  scanned: false,
  partialReasons: [],
  candidateFiles: 0,
  scannedFiles: 0,
  skippedFiles: 0,
};

export class AnnotationIndex {
  readonly #files = new Map<string, FileAnnotations>();
  #status: IndexStatus = EMPTY_STATUS;

  replaceSnapshot(files: readonly FileAnnotations[], status: IndexStatus): void {
    this.#files.clear();
    for (const file of files) {
      if (file.annotations.length > 0) this.#files.set(file.uri, file);
    }
    this.#status = status;
  }

  replaceFile(file: FileAnnotations, maxResults: number): boolean {
    this.#files.delete(file.uri);
    const available = Math.max(0, maxResults - this.total);
    const kept = file.annotations.slice(0, available);
    if (kept.length > 0) this.#files.set(file.uri, { ...file, annotations: kept, truncated: file.truncated || kept.length < file.annotations.length });
    const resultLimitReached = kept.length < file.annotations.length;
    if (resultLimitReached) this.addPartialReason("result-limit");
    return file.truncated || resultLimitReached;
  }

  removeFile(uri: string): void {
    this.#files.delete(uri);
  }

  setStatus(status: IndexStatus): void {
    this.#status = status;
  }

  addPartialReason(reason: PartialReason): void {
    if (this.#status.partialReasons.includes(reason)) return;
    this.#status = { ...this.#status, partialReasons: [...this.#status.partialReasons, reason] };
  }

  groups(filter?: ReadonlySet<string>): readonly AnnotationGroup[] {
    const groups: AnnotationGroup[] = [];
    for (const file of this.#files.values()) {
      const annotations = file.annotations.filter((annotation) => !filter || filter.has(annotation.token.toLowerCase()));
      if (annotations.length > 0) groups.push({ uri: file.uri, annotations });
    }
    return groups.sort((left, right) => compareOrdinal(left.uri, right.uri));
  }

  all(filter?: ReadonlySet<string>): readonly Annotation[] {
    return this.groups(filter).flatMap((group) => group.annotations);
  }

  findById(id: string): Annotation | undefined {
    for (const file of this.#files.values()) {
      const annotation = file.annotations.find((candidate) => candidate.id === id);
      if (annotation) return annotation;
    }
    return undefined;
  }

  get total(): number {
    let total = 0;
    for (const file of this.#files.values()) total += file.annotations.length;
    return total;
  }

  get status(): IndexStatus {
    return this.#status;
  }
}
