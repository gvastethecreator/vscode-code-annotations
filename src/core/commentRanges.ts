import type { OffsetRange } from "./model.ts";

const SLASH_LANGUAGES = new Set([
  "c",
  "cpp",
  "csharp",
  "dart",
  "go",
  "java",
  "javascript",
  "javascriptreact",
  "jsonc",
  "kotlin",
  "objective-c",
  "objective-cpp",
  "php",
  "rust",
  "swift",
  "typescript",
  "typescriptreact",
]);

const HASH_LANGUAGES = new Set([
  "dockerfile",
  "makefile",
  "perl",
  "powershell",
  "python",
  "r",
  "ruby",
  "shellscript",
  "toml",
  "yaml",
]);

const MARKUP_LANGUAGES = new Set(["astro", "html", "svelte", "vue", "xml", "xsl"]);
const STYLESHEET_LANGUAGES = new Set(["css", "less", "scss"]);

function lineEnd(text: string, start: number): number {
  const newline = text.indexOf("\n", start);
  return newline === -1 ? text.length : newline;
}

function previousSignificant(text: string, index: number): string | undefined {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const value = text[cursor]!;
    if (!/\s/u.test(value)) {
      return value;
    }
  }
  return undefined;
}

function canStartRegex(text: string, slash: number): boolean {
  const previous = previousSignificant(text, slash);
  return previous === undefined || "([{:,;=!?&|+-*%^~<>".includes(previous);
}

function skipQuoted(text: string, start: number, quote: string): number {
  let escaped = false;
  for (let index = start + 1; index < text.length; index += 1) {
    const value = text[index]!;
    if (escaped) {
      escaped = false;
    } else if (value === "\\") {
      escaped = true;
    } else if (value === quote) {
      return index + 1;
    }
  }
  return text.length;
}

function skipRegex(text: string, start: number): number {
  let escaped = false;
  let inClass = false;
  for (let index = start + 1; index < text.length; index += 1) {
    const value = text[index]!;
    if (value === "\n" || value === "\r") return index;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (value === "\\") {
      escaped = true;
    } else if (value === "[") {
      inClass = true;
    } else if (value === "]") {
      inClass = false;
    } else if (value === "/" && !inClass) {
      index += 1;
      while (index < text.length && /[A-Za-z]/u.test(text[index]!)) index += 1;
      return index;
    }
  }
  return text.length;
}

function slashCommentRanges(text: string, lineComments: boolean, blockComments = true): OffsetRange[] {
  const ranges: OffsetRange[] = [];
  let index = 0;
  while (index < text.length) {
    const value = text[index]!;
    if (value === "'" || value === '"' || value === "`") {
      index = skipQuoted(text, index, value);
      continue;
    }
    if (value === "/" && text[index + 1] === "/" && lineComments) {
      const end = lineEnd(text, index + 2);
      ranges.push({ start: index + 2, end });
      index = end;
      continue;
    }
    if (value === "/" && text[index + 1] === "*" && blockComments) {
      const close = text.indexOf("*/", index + 2);
      const end = close === -1 ? text.length : close;
      ranges.push({ start: index + 2, end });
      index = close === -1 ? text.length : close + 2;
      continue;
    }
    if (value === "/" && canStartRegex(text, index)) {
      index = skipRegex(text, index);
      continue;
    }
    index += 1;
  }
  return ranges;
}

function hashCommentRanges(text: string): OffsetRange[] {
  const ranges: OffsetRange[] = [];
  let start = 0;
  while (start < text.length) {
    const end = lineEnd(text, start);
    let quote: string | undefined;
    let escaped = false;
    for (let index = start; index < end; index += 1) {
      const value = text[index]!;
      if (escaped) {
        escaped = false;
      } else if (value === "\\" && quote === '"') {
        escaped = true;
      } else if (quote) {
        if (value === quote) quote = undefined;
      } else if (value === "'" || value === '"') {
        quote = value;
      } else if (value === "#") {
        ranges.push({ start: index + 1, end });
        break;
      }
    }
    start = end + 1;
  }
  return ranges;
}

function markupCommentRanges(text: string, allowed?: readonly OffsetRange[]): OffsetRange[] {
  const ranges: OffsetRange[] = [];
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("<!--", index);
    if (open === -1) break;
    const close = text.indexOf("-->", open + 4);
    const end = close === -1 ? text.length : close;
    if (!allowed || allowed.some((range) => open >= range.start && open < range.end)) {
      ranges.push({ start: open + 4, end });
    }
    index = close === -1 ? text.length : close + 3;
  }
  return ranges;
}

function markdownContentRanges(text: string): OffsetRange[] {
  const ranges: OffsetRange[] = [];
  let start = 0;
  let segmentStart = 0;
  let fence: "`" | "~" | undefined;
  while (start <= text.length) {
    const end = lineEnd(text, start);
    const line = text.slice(start, end);
    const marker = /^\s*(`{3,}|~{3,})/u.exec(line)?.[1];
    if (marker) {
      const kind = marker[0] as "`" | "~";
      if (!fence) {
        if (segmentStart < start) ranges.push({ start: segmentStart, end: start });
        fence = kind;
      } else if (fence === kind) {
        fence = undefined;
        segmentStart = end + 1;
      }
    }
    if (end === text.length) break;
    start = end + 1;
  }
  if (!fence && segmentStart < text.length) ranges.push({ start: segmentStart, end: text.length });
  return ranges;
}

function genericCommentRanges(text: string): OffsetRange[] {
  const ranges: OffsetRange[] = [];
  let start = 0;
  while (start < text.length) {
    const end = lineEnd(text, start);
    const line = text.slice(start, end);
    const match = /^\s*(?:\/\/|#|;|--|\/\*+|\*+)\s?/u.exec(line);
    if (match) ranges.push({ start: start + match[0].length, end });
    start = end + 1;
  }
  return ranges;
}

export function commentRanges(text: string, languageId: string): readonly OffsetRange[] {
  if (SLASH_LANGUAGES.has(languageId)) return slashCommentRanges(text, true);
  if (STYLESHEET_LANGUAGES.has(languageId)) return slashCommentRanges(text, languageId !== "css");
  if (HASH_LANGUAGES.has(languageId)) return hashCommentRanges(text);
  if (MARKUP_LANGUAGES.has(languageId)) return markupCommentRanges(text);
  if (languageId === "markdown" || languageId === "mdx") {
    return markupCommentRanges(text, markdownContentRanges(text));
  }
  return genericCommentRanges(text);
}
