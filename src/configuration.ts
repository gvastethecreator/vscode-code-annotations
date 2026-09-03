import * as vscode from "vscode";
import {
  CONFIGURATION_DEFAULTS,
  DEFAULT_EXCLUDE_GLOBS,
  DEFAULT_INCLUDE_GLOBS,
  boundedInteger,
  normalizeGlobList,
  normalizeTokens,
} from "./core/config.ts";
import { DEFAULT_MESSAGE_LIMIT, DEFAULT_PER_FILE_LIMIT, type NormalizedToken } from "./core/model.ts";

export interface RuntimeConfiguration {
  readonly enabled: boolean;
  readonly decorationsEnabled: boolean;
  readonly caseSensitive: boolean;
  readonly tokens: readonly NormalizedToken[];
  readonly rejectedTokens: number;
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly maxFileSize: number;
  readonly maxFiles: number;
  readonly maxResults: number;
  readonly maxPerFile: number;
  readonly maxMessageLength: number;
}

export function readConfiguration(): RuntimeConfiguration {
  const source = vscode.workspace.getConfiguration("codeAnnotations");
  const caseSensitive = source.get<boolean>("caseSensitive", true);
  const normalized = normalizeTokens(source.get<unknown>("tokens"), caseSensitive);
  const include = normalizeGlobList(source.get<unknown>("scan.include"), DEFAULT_INCLUDE_GLOBS);
  const exclude = normalizeGlobList(source.get<unknown>("scan.exclude"), DEFAULT_EXCLUDE_GLOBS);
  const result = {
    enabled: source.get<boolean>("enabled", true),
    decorationsEnabled: source.get<boolean>("decorations.enabled", true),
    caseSensitive,
    tokens: normalized.tokens,
    rejectedTokens: normalized.rejected,
    include,
    exclude,
    maxFileSize: boundedInteger(source.get<unknown>("scan.maxFileSize"), CONFIGURATION_DEFAULTS.maxFileSize, 1_024, 16_777_216),
    maxFiles: boundedInteger(source.get<unknown>("scan.maxFiles"), CONFIGURATION_DEFAULTS.maxFiles, 1, 100_000),
    maxResults: boundedInteger(source.get<unknown>("scan.maxResults"), CONFIGURATION_DEFAULTS.maxResults, 1, 100_000),
    maxPerFile: DEFAULT_PER_FILE_LIMIT,
    maxMessageLength: DEFAULT_MESSAGE_LIMIT,
  };
  return result;
}
