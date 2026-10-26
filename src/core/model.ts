export type AnnotationSource = "open-document" | "workspace-scan";
export type SemanticStyle = "info" | "muted" | "review" | "warning" | "error" | "deprecated";

export interface NormalizedToken {
  readonly token: string;
  readonly comparison: string;
  readonly style: SemanticStyle;
}

export interface Annotation {
  readonly id: string;
  readonly uri: string;
  readonly token: string;
  readonly style: SemanticStyle;
  readonly message: string;
  readonly messageTruncated: boolean;
  readonly line: number;
  readonly character: number;
  readonly endCharacter: number;
  readonly start: number;
  readonly end: number;
  readonly source: AnnotationSource;
}

export interface FileAnnotations {
  readonly uri: string;
  readonly source: AnnotationSource;
  readonly annotations: readonly Annotation[];
  readonly truncated: boolean;
}

export type PartialReason = "cancelled" | "file-limit" | "file-size" | "per-file-limit" | "result-limit" | "read-errors";

export interface IndexStatus {
  readonly scanned: boolean;
  readonly partialReasons: readonly PartialReason[];
  readonly candidateFiles: number;
  readonly scannedFiles: number;
  readonly skippedFiles: number;
}

export interface MatchOptions {
  readonly uri: string;
  readonly languageId: string;
  readonly source: AnnotationSource;
  readonly tokens: readonly NormalizedToken[];
  readonly caseSensitive: boolean;
  readonly maxMessageLength: number;
  readonly maxResults: number;
}

export interface MatchResult {
  readonly annotations: readonly Annotation[];
  readonly truncated: boolean;
}

export interface OffsetRange {
  readonly start: number;
  readonly end: number;
}

export const DEFAULT_TOKEN_NAMES = ["TODO", "FIXME", "HACK", "NOTE", "REVIEW", "DEPRECATED"] as const;
export const MAXIMUM_TOKENS = 32;
export const MAXIMUM_TOKEN_LENGTH = 64;
export const DEFAULT_MESSAGE_LIMIT = 500;
export const DEFAULT_FILE_SIZE_LIMIT = 1_048_576;
export const DEFAULT_FILE_LIMIT = 20_000;
export const DEFAULT_RESULT_LIMIT = 10_000;
export const DEFAULT_PER_FILE_LIMIT = 1_000;
export const EDITOR_DEBOUNCE_MS = 200;
export const FILE_EVENT_DEBOUNCE_MS = 300;
