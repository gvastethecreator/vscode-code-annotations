Repo: `X:\vscode-extensions\code-annotations`
Remote: private (`gvastethecreator/code-annotations`)

# PDR — Annotations

## Status
Scaffolded · Priority P2

## Product summary

Annotations surfaces developer markers such as `TODO`, `FIXME`, `HACK`, `NOTE`, `REVIEW` and custom tokens directly in the editor and in a navigable workspace view. It modernizes the classic TODO-highlighting category with bounded scanning, native Tree Views, accessibility and configurable token policies.

## Opportunity

TODO highlighting is a proven VS Code category with historically popular but stale/fragmented extensions and multiple successors. The opportunity is not merely colored comments: it is a small, dependable annotation index that remains fast on large repositories and integrates with native VS Code UI.

Historical/category reference:
- https://marketplace.visualstudio.com/search?term=todo%20highlight&target=VSCode&category=All%20categories&sortBy=Relevance

## Core jobs

1. Make important comment markers visually distinct while editing.
2. Show all relevant annotations in the workspace without grep/manual search.
3. Navigate directly to an annotation.
4. Let teams add custom markers without complicated regex configuration.

## Default tokens

Suggested defaults:

- TODO
- FIXME
- HACK
- NOTE
- REVIEW
- DEPRECATED

Avoid color-only semantics. Each token keeps its textual label and optional iconography.

## MVP surfaces

### Editor decorations

Decorate matched token and optionally the annotation text. Use VS Code theme-aware colors and sane defaults. Do not paint entire lines by default.

### Workspace Tree View

Example:

```text
ANNOTATIONS
├─ src/editor.ts
│  ├─ TODO  Refactor parser
│  └─ FIXME Race condition
└─ src/utils.ts
   └─ HACK  Temporary fallback
```

Capabilities:

- group by file by default;
- click to navigate;
- refresh command;
- filter by token via command/Quick Pick;
- count shown in view descriptions if cheap.

### Problems integration

Do **not** duplicate every annotation into Problems by default. TODOs are not compiler errors. A setting may opt selected tokens such as `FIXME`/`DEPRECATED` into diagnostics later.

## Matching strategy

MVP should prioritize comment-aware matches where practical. A naïve workspace regex over all text can flag strings, snapshots and data files incorrectly.

Possible staged strategy:

- active editor: language-aware comment token detection where available or adapter-assisted scanning;
- workspace index: configurable textual scanner constrained by included files, with documented limitations;
- languages with difficult embedded syntax may initially use conservative matching.

Do not ship a dependency-heavy universal parser solely for annotations.

## Token configuration

Proposed ergonomic format:

```json
{
  "annotations.tokens": [
    { "token": "TODO", "style": "info" },
    { "token": "FIXME", "style": "error" },
    { "token": "HACK", "style": "warning" },
    { "token": "NOTE", "style": "muted" }
  ],
  "annotations.scan.exclude": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**"
  ]
}
```

If object-array configuration becomes unwieldy in VS Code Settings UI, provide a simpler token list + per-token color customization via documented theme colors/config. Do not build a custom settings page.

## Custom token validation

- token length bounded;
- plain string by default;
- optional regex mode, if introduced, must be explicit and protected against pathological patterns where possible;
- no arbitrary code/eval.

## Commands

- `Annotations: Refresh Workspace`
- `Annotations: Show All`
- `Annotations: Filter Tokens...`
- `Annotations: Next Annotation`
- `Annotations: Previous Annotation`

## Scanning architecture

```text
src/
├─ extension.ts
├─ core/
│  ├─ matcher.ts
│  ├─ annotation.ts
│  └─ grouping.ts
├─ editor/
│  └─ decorations.ts
├─ workspace/
│  ├─ scanner.ts
│  ├─ index.ts
│  └─ watchers.ts
├─ views/
│  └─ annotationsTree.ts
└─ commands/
```

Workspace index should be incremental:

1. initial scan only after feature/view activation, not at generic extension activation;
2. use bounded `workspace.findFiles` include/exclude;
3. update changed/saved files incrementally;
4. remove deleted/renamed entries;
5. cancellation support;
6. avoid reading known binary/oversized files.

## Performance limits

Provide safe defaults for:

- maximum file size scanned;
- maximum number of indexed annotations before view truncation/warning;
- excluded generated/vendor directories;
- debounce window for edits.

No repeated full-workspace scan on every file save.

## VS Code APIs

- `window.createTextEditorDecorationType`
- `window.onDidChangeActiveTextEditor`
- `workspace.onDidChangeTextDocument`
- `workspace.findFiles`
- `workspace.fs`
- `workspace.createFileSystemWatcher`
- TreeDataProvider / Tree View contributions
- commands/configuration
- optional diagnostics post-MVP.

## Compatibility

| Environment | Goal |
| --- | --- |
| Desktop | Full |
| Web | Full if scanner uses `workspace.fs` and no Node dependency |
| Virtual Workspace | Full/limited depending on watcher/provider behavior; explicitly test |
| Restricted Mode | Full read-only functionality |
| Remote | Full |

## Accessibility/theme behavior

- decoration styles must work in dark/light/high-contrast themes;
- token text remains readable without decoration;
- Tree View uses native labels/icons;
- no reliance on red/yellow/green alone.

## Security/privacy

- index remains local/in memory by default;
- no file contents or annotation text sent externally;
- no telemetry of annotation content;
- workspace regex configuration, if ever supported, treated as untrusted input and bounded.

## Testing

Unit:

- token boundary detection;
- case sensitivity settings;
- comment prefixes;
- custom tokens;
- exclusions;
- grouping/sorting;
- file-size limit;
- large annotation counts.

Integration:

- decorations refresh correctly;
- Tree View navigation opens correct URI/range;
- create/change/delete file updates index;
- no scan before feature activation where designed;
- virtual URI/web-host cases;
- high-contrast smoke check/manual QA.

## Acceptance criteria

- useful default token set with zero configuration;
- Tree View can navigate all indexed results;
- generated/vendor directories excluded by default;
- large repos do not trigger uncontrolled startup scanning;
- no duplicate/full rescans from normal edits;
- web/virtual behavior explicitly tested and documented;
- no webview.

## Non-goals

- issue tracker synchronization;
- project-management system;
- AI TODO generation;
- parsing every language perfectly in v1;
- writing TODOs automatically;
- replacing Problems/compiler diagnostics.

## Post-MVP

- optional selected-token diagnostics;
- group by token/owner;
- assignment convention (`TODO(@name)`);
- export annotation list as Markdown/JSON;
- scoped workspace folders;
- richer comment-aware language adapters driven by false-positive reports.

## Definition of done

Incremental scanner, editor decorations, Tree View, performance limits, accessibility review, tests, docs, Marketplace assets and release automation complete.
