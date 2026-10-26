import {
  DEFAULT_FILE_LIMIT,
  DEFAULT_FILE_SIZE_LIMIT,
  DEFAULT_RESULT_LIMIT,
  DEFAULT_TOKEN_NAMES,
  MAXIMUM_TOKENS,
  MAXIMUM_TOKEN_LENGTH,
  type NormalizedToken,
  type SemanticStyle,
} from "./model.ts";

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;
const WHITESPACE = /\s/u;

const DEFAULT_STYLES = new Map<string, SemanticStyle>([
  ["TODO", "info"],
  ["NOTE", "muted"],
  ["REVIEW", "review"],
  ["HACK", "warning"],
  ["FIXME", "error"],
  ["DEPRECATED", "deprecated"],
]);

export interface TokenNormalization {
  readonly tokens: readonly NormalizedToken[];
  readonly rejected: number;
}

export function normalizeTokens(value: unknown, caseSensitive: boolean): TokenNormalization {
  const input = Array.isArray(value) ? value : [...DEFAULT_TOKEN_NAMES];
  const tokens: NormalizedToken[] = [];
  const seen = new Set<string>();
  let rejected = 0;

  for (const candidate of input) {
    if (
      typeof candidate !== "string" ||
      candidate.length === 0 ||
      candidate.length > MAXIMUM_TOKEN_LENGTH ||
      CONTROL_CHARACTER.test(candidate) ||
      WHITESPACE.test(candidate)
    ) {
      rejected += 1;
      continue;
    }
    const comparison = caseSensitive ? candidate : candidate.toLowerCase();
    if (seen.has(comparison) || tokens.length >= MAXIMUM_TOKENS) {
      rejected += 1;
      continue;
    }
    seen.add(comparison);
    tokens.push({
      token: candidate,
      comparison,
      style: DEFAULT_STYLES.get(candidate.toUpperCase()) ?? "info",
    });
  }

  return { tokens, rejected };
}

export function normalizeGlobList(value: unknown, fallback: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const result: string[] = [];
  for (const candidate of value) {
    if (
      typeof candidate !== "string" ||
      candidate.length === 0 ||
      candidate.length > 256 ||
      CONTROL_CHARACTER.test(candidate)
    ) {
      continue;
    }
    if (!result.includes(candidate) && result.length < 32) {
      result.push(candidate);
    }
  }
  return result;
}

export function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.trunc(value)))
    : fallback;
}

export const DEFAULT_INCLUDE_GLOBS = ["**/*"] as const;
export const DEFAULT_EXCLUDE_GLOBS = [
  "**/.git/**",
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/coverage/**",
  "**/.next/**",
  "**/.cache/**",
  "**/vendor/**",
  "**/*.min.js",
  "**/*.map",
] as const;

export const CONFIGURATION_DEFAULTS = {
  maxFileSize: DEFAULT_FILE_SIZE_LIMIT,
  maxFiles: DEFAULT_FILE_LIMIT,
  maxResults: DEFAULT_RESULT_LIMIT,
} as const;
