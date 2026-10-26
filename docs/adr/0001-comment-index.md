# ADR 0001: Bounded comment-aware annotation index

Status: Accepted — 2026-09-02

## Context

Plain workspace regex search produces false positives in strings and data, can expose pathological user patterns, and does not provide an incremental in-memory model. A universal parser would add a large runtime and still fail on mixed or embedded grammars.

## Decision

Use small deterministic comment adapters for common language families, plus a conservative comment-prefix fallback. Match only validated literal tokens with explicit boundaries. Keep the domain implementation independent of VS Code.

Build the workspace index only when the native view or a workspace command needs it. Discover through `workspace.findFiles`, read through `workspace.fs`, keep open documents authoritative, and enforce file, result, message, and candidate limits. Use one cancellable generation at a time and coalesce watcher updates.

Pass only opaque stable IDs through Tree item commands. Resolve the ID against the current in-memory index, validate the current document range and token, then reveal it.

## Consequences

- Node, web, virtual, remote, and Restricted Mode hosts share one implementation.
- Normal editor activation never starts a full workspace scan.
- Custom tokens cannot execute code or regular expressions.
- Some uncommon or embedded syntaxes use conservative matching and can miss nonstandard comment forms.
- A partial index is explicit whenever a configured limit, cancellation, or read error prevents a full result set.
