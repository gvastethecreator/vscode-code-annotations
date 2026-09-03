import { commentRanges } from "./commentRanges.ts";
import { DEFAULT_MESSAGE_LIMIT, type Annotation, type MatchOptions, type MatchResult, type NormalizedToken } from "./model.ts";

function isWord(value: string | undefined): boolean {
  return value !== undefined && /[\p{L}\p{N}_]/u.test(value);
}

function hasBoundary(text: string, start: number, end: number, token: string): boolean {
  const before = text[start - 1];
  const after = text[end];
  return (!isWord(token[0]) || !isWord(before)) && (!isWord(token.at(-1)) || !isWord(after));
}

function truncateMessage(value: string, limit: number): { text: string; truncated: boolean } {
  const normalized = value.replace(/[\t ]+/gu, " ").trim();
  const characters = Array.from(normalized);
  if (characters.length <= limit) return { text: normalized, truncated: false };
  return { text: `${characters.slice(0, Math.max(0, limit - 1)).join("")}…`, truncated: true };
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function positionAt(starts: readonly number[], offset: number): { line: number; character: number } {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle]! <= offset) low = middle + 1;
    else high = middle - 1;
  }
  const line = Math.max(0, high);
  return { line, character: offset - starts[line]! };
}

function hashId(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charCodeAt(index);
    first ^= character;
    first = Math.imul(first, 0x01000193);
    second ^= character;
    second = Math.imul(second, 0x85ebca6b);
  }
  return `annotation:${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function nextMatch(
  text: string,
  comparisonSegment: string,
  segmentOffset: number,
  start: number,
  tokens: readonly NormalizedToken[],
): { token: NormalizedToken; start: number; end: number } | undefined {
  let searchStart = start;
  while (searchStart < comparisonSegment.length) {
    let best: { token: NormalizedToken; start: number; end: number } | undefined;
    for (const token of tokens) {
      const localStart = comparisonSegment.indexOf(token.comparison, searchStart);
      if (localStart === -1) continue;
      const localEnd = localStart + token.token.length;
      if (!best || localStart < best.start || (localStart === best.start && token.token.length > best.token.token.length)) {
        best = { token, start: localStart, end: localEnd };
      }
    }
    if (!best) return undefined;
    const globalStart = segmentOffset + best.start;
    const globalEnd = segmentOffset + best.end;
    if (hasBoundary(text, globalStart, globalEnd, best.token.token)) {
      return { token: best.token, start: globalStart, end: globalEnd };
    }
    searchStart = best.start + 1;
  }
  return undefined;
}

export function matchAnnotations(text: string, options: MatchOptions): MatchResult {
  if (options.tokens.length === 0 || options.maxResults <= 0) return { annotations: [], truncated: false };
  const comparisonText = options.caseSensitive ? text : text.toLowerCase();
  const starts = lineStarts(text);
  const annotations: Annotation[] = [];
  const ranges = commentRanges(text, options.languageId);

  for (const range of ranges) {
    let cursor = range.start;
    while (cursor < range.end) {
      const newline = text.indexOf("\n", cursor);
      const segmentEnd = newline === -1 || newline > range.end ? range.end : newline;
      const comparisonSegment = comparisonText.slice(cursor, segmentEnd);
      let search = 0;
      while (search < comparisonSegment.length) {
        const match = nextMatch(text, comparisonSegment, cursor, search, options.tokens);
        if (!match) break;
        const position = positionAt(starts, match.start);
        let messageStart = match.end;
        if (text[messageStart] === ":") messageStart += 1;
        const message = truncateMessage(text.slice(messageStart, segmentEnd), options.maxMessageLength || DEFAULT_MESSAGE_LIMIT);
        annotations.push({
          id: hashId(`${options.uri}\u0000${match.token.comparison}\u0000${match.start}\u0000${match.end}`),
          uri: options.uri,
          token: text.slice(match.start, match.end),
          style: match.token.style,
          message: message.text,
          messageTruncated: message.truncated,
          line: position.line,
          character: position.character,
          endCharacter: position.character + (match.end - match.start),
          start: match.start,
          end: match.end,
          source: options.source,
        });
        if (annotations.length >= options.maxResults) return { annotations, truncated: true };
        search = match.end - cursor;
      }
      cursor = segmentEnd + 1;
    }
  }

  return {
    annotations: annotations.sort((left, right) => left.start - right.start || compareOrdinal(left.token, right.token)),
    truncated: false,
  };
}

export function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
