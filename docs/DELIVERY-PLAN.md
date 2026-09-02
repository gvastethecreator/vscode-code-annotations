# Code Annotations — Complete delivery plan

Status: execution specification  
Repository: `gvastethecreator/vscode-code-annotations`  
Product phase: scaffold  
First public target: `0.1.0`  
Last reviewed: 2026-09-01

This document converts `docs/PDR.md` into an implementation-ready specification and ordered ticket backlog. It defines the minimum reliable product, scanning limits, compatibility contract, accessibility requirements, and launch gates.

---

## 1. Current state

The repository has a consistent scaffold:

- strict TypeScript, esbuild, pnpm, and CI;
- five contributed commands;
- PDR, security/development/publishing notes, agent guidance, icon, and preview;
- declared Virtual Workspace and Restricted Mode support.

The product itself is not implemented:

- every command reaches the shared placeholder handler;
- the only test verifies the Node test runner;
- no annotation model, matcher, editor decorations, scanner, index, file watcher, Tree View, configuration, theme colors, navigation, or filtering exists;
- no browser entry or web-host test exists;
- no Extension Host integration tests or packaged VSIX smoke test exists;
- the package declares ESM while esbuild emits a CommonJS `.js` artifact;
- the display name is the generic `Annotations`, while the repository and package use `code-annotations`;
- command IDs currently use the broad `annotations.*` namespace.

The first release must be intentionally conservative. The differentiator is not “color TODO comments”; it is a dependable, bounded, navigable index that does not punish large workspaces.

---

## 2. Naming and public contract

Before publication, use one coherent public identity:

- recommended display name: **Code Annotations**;
- Marketplace package name: `code-annotations`, subject to final collision check;
- command namespace: `codeAnnotations.*`;
- view ID: `codeAnnotations.workspace`;
- configuration root: `codeAnnotations`;
- custom theme-color root: `codeAnnotations.*`.

Changing IDs after public release creates migration cost. Resolve this before `0.1.0`.

---

## 3. Release outcome

Code Annotations `0.1.0` must provide:

1. visible, theme-aware editor decorations for a small default token set;
2. a native Tree View containing bounded workspace results grouped by file;
3. keyboard-accessible navigation to each annotation;
4. next/previous commands;
5. token filtering;
6. incremental updates for open edits and file create/change/delete events;
7. explicit refresh and cancellation;
8. no uncontrolled scan during generic activation;
9. no webview;
10. desktop, remote, web, virtual, and Restricted Mode behavior that is tested and honestly declared.

Default tokens:

```text
TODO
FIXME
HACK
NOTE
REVIEW
DEPRECATED
```

The Tree View and token text must remain understandable without relying on color.

---

## 4. Matching specification

### 4.1 Annotation model

```ts
interface Annotation {
  id: string;
  uri: string;
  token: string;
  message: string;
  line: number;
  start: number;
  end: number;
  source: "open-document" | "workspace-scan";
}
```

Requirements:

- IDs must be stable enough to refresh a view but contain no annotation text;
- `message` is bounded and normalized for display;
- source text remains local and in memory;
- offsets/ranges identify the token and optional message independently;
- the index stores only what is required for navigation/display.

### 4.2 Token boundaries

A token matches by default when:

- it is preceded and followed by a non-word boundary appropriate to ASCII token names;
- an optional colon is accepted (`TODO:`);
- optional owner syntax may be recognized only as plain message text in `0.1` (`TODO(@name)` is not a separate semantic feature yet);
- case sensitivity follows configuration;
- tokens are treated as literal strings, never regex in `0.1`;
- empty, duplicate, excessively long, whitespace-only, or control-character tokens are rejected during configuration normalization.

Default maximum token length: 64 characters.  
Default maximum displayed annotation message: 500 characters.  
Longer source remains untouched; only view text is truncated with an accessible indication.

### 4.3 Comment-awareness strategy

A universal parser is not justified for `0.1`. Use a staged adapter model:

1. active/open documents: use lightweight language adapters where available;
2. workspace scan: conservative line scanner constrained to configured text file patterns;
3. avoid obvious string-only matches in supported adapters;
4. document that unsupported languages may produce textual false positives;
5. never claim perfect parsing for every language.

Initial comment adapters should cover, at minimum:

- JavaScript/TypeScript/JSX/TSX;
- HTML/XML-style comments;
- CSS/SCSS/Less;
- Python/shell-style line comments;
- Markdown/MDX comments where practical.

Adapters must be pure, fixture-backed, and optional. A failed adapter must fall back conservatively or skip, never hang the extension host.

### 4.4 Included files

Suggested defaults:

```json
{
  "codeAnnotations.scan.include": ["**/*"],
  "codeAnnotations.scan.exclude": [
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
    "**/*.map"
  ]
}
```

Implementation safeguards:

- skip files above configured byte limit;
- skip likely binary content after a small prefix check;
- respect `files.exclude` and `search.exclude` only if the behavior is explicit and testable; otherwise own a clear extension-specific exclusion list;
- use `workspace.findFiles` and `workspace.fs` with URIs;
- cancellation must stop discovery and reading;
- never follow a second independent recursive filesystem implementation.

---

## 5. Scanning and index lifecycle

### 5.1 Activation

The extension may register lightweight editor listeners when an eligible document opens, but the workspace scan must start only when one of these occurs:

- the Code Annotations view becomes visible;
- `Show All` is invoked;
- `Refresh Workspace` is invoked;
- another feature explicitly requires the workspace index.

No `onStartupFinished` scan.

### 5.2 Initial scan

Pipeline:

```text
find candidate URIs
→ apply limits/exclusions
→ read bounded text
→ classify adapter
→ match annotations
→ update per-file index
→ publish batched Tree View changes
```

Requirements:

- one active scan generation per workspace;
- cancellation token for user cancellation and superseded scans;
- incremental/batched Tree View updates, not one event per match;
- progress UI only when scan duration justifies it;
- errors aggregated without leaking annotation content;
- partial index marked as partial if limits/cancellation stop completion.

### 5.3 Incremental updates

- open document edits update decorations after debounce;
- open unsaved buffer is authoritative over disk content;
- save updates the workspace index without a full scan;
- create/change/delete/rename events update only affected URIs;
- configuration changes rebuild only what is necessary;
- closing a dirty document must not replace current index with stale disk content;
- deleted files remove all entries;
- watchers are disposed cleanly;
- virtual providers without reliable watch support get an explicit refresh fallback.

### 5.4 Limits

Initial defaults, to validate through benchmarks:

- maximum file size: 1 MiB;
- maximum indexed files: 20,000;
- maximum annotations: 10,000;
- maximum annotations per file: 1,000;
- editor debounce: 200 ms;
- file-change debounce/coalescing: 300 ms;
- Tree View batch interval: 100 ms.

When a limit is reached:

- stop predictably;
- keep valid results already found;
- show one value-free summary;
- mark the view as partial;
- provide a command/settings path to refine include/exclude rather than silently truncating.

---

## 6. Editor decoration contract

Decorate the token by default, not the whole line.

Requirements:

- one reusable decoration type per semantic style, not per annotation;
- use `ThemeColor` and contributed theme colors;
- support dark, light, and high-contrast themes;
- avoid backgrounds with unreadable contrast;
- avoid gutter icons in `0.1` unless they prove clear at small size;
- dispose/recreate decoration types only when style configuration changes;
- update visible editors only;
- preserve token text as the primary semantic indicator;
- optional whole-line mode is post-MVP unless usability testing proves necessary.

Suggested semantic styles:

| Token | Semantic style |
| --- | --- |
| TODO | info |
| NOTE | muted/info |
| REVIEW | review |
| HACK | warning |
| FIXME | error |
| DEPRECATED | deprecated |

Do not hardcode a red/yellow/green-only meaning system.

---

## 7. Tree View contract

Default hierarchy:

```text
CODE ANNOTATIONS
├─ src/editor.ts · 2
│  ├─ TODO  Refactor parser
│  └─ FIXME  Race condition
└─ src/utils.ts · 1
   └─ HACK  Temporary fallback
```

Required behavior:

- group by file;
- sort files by workspace-relative path;
- sort annotations by line/column;
- file node includes count;
- annotation node includes token, bounded message, line number, tooltip, and accessible label;
- click opens exact URI and reveals/selects the token range;
- preserve/collapse state naturally through stable IDs where possible;
- handle missing/deleted files gracefully;
- show welcome content before scan and actionable empty-state content after scan;
- include refresh and filter actions in the view title;
- no custom webview.

Filtering:

- filter tokens through Quick Pick;
- keep filter window-local by default;
- provide `Show All`/clear filter;
- indicate active filter in view description/title;
- do not persist potentially team-specific filters without explicit design.

---

## 8. Commands and settings

### Commands

- `Code Annotations: Refresh Workspace`
- `Code Annotations: Show All`
- `Code Annotations: Filter Tokens...`
- `Code Annotations: Next Annotation`
- `Code Annotations: Previous Annotation`
- `Code Annotations: Clear Filter`
- optional: `Code Annotations: Reveal in View`

### Proposed settings

```json
{
  "codeAnnotations.enabled": true,
  "codeAnnotations.tokens": ["TODO", "FIXME", "HACK", "NOTE", "REVIEW", "DEPRECATED"],
  "codeAnnotations.caseSensitive": true,
  "codeAnnotations.decorations.enabled": true,
  "codeAnnotations.scan.include": ["**/*"],
  "codeAnnotations.scan.exclude": ["**/.git/**", "**/node_modules/**", "**/dist/**", "**/build/**"],
  "codeAnnotations.scan.maxFileSize": 1048576,
  "codeAnnotations.scan.maxFiles": 20000,
  "codeAnnotations.scan.maxResults": 10000
}
```

Keep settings native and schema-driven. Do not build a settings webview. Avoid configurable regex in `0.1`.

---

## 9. Architecture

Recommended structure:

```text
src/
├─ extension.ts
├─ core/
│  ├─ annotation.ts
│  ├─ tokens.ts
│  ├─ matcher.ts
│  ├─ grouping.ts
│  └─ limits.ts
├─ adapters/
│  ├─ adapter.ts
│  ├─ slashComments.ts
│  ├─ hashComments.ts
│  ├─ markupComments.ts
│  └─ stylesheetComments.ts
├─ editor/
│  ├─ decorations.ts
│  └─ visibleEditors.ts
├─ workspace/
│  ├─ discovery.ts
│  ├─ scanner.ts
│  ├─ index.ts
│  ├─ coordinator.ts
│  └─ watchers.ts
├─ views/
│  ├─ treeProvider.ts
│  ├─ treeItems.ts
│  └─ filterState.ts
├─ commands/
│  ├─ refresh.ts
│  ├─ filter.ts
│  ├─ navigate.ts
│  └─ reveal.ts
└─ platform/
   ├─ documents.ts
   ├─ configuration.ts
   └─ logging.ts
```

Pure modules must not import `vscode`:

- token normalization;
- boundary matching;
- adapters/scanners;
- grouping/sorting;
- limits;
- index state transitions where possible.

---

## 10. Manifest and compatibility

### Build

Correct the current module mismatch. Recommended:

- Node entry: `dist/node/extension.cjs`;
- web entry: `dist/web/extension.js`;
- shared browser-safe core;
- no Node `fs/path/process` in web/common code;
- `workspace.fs` and `Uri` for workspace access.

### Contributions required

- commands;
- configuration;
- Tree View and optional dedicated view container decision;
- view welcome content;
- menus for view/title and Tree items;
- contributed theme colors;
- activation driven by commands/view/languages as appropriate.

### Compatibility targets

| Environment | Goal |
| --- | --- |
| Desktop | Full |
| WSL/SSH/Codespaces | Full; scan in appropriate workspace host |
| Web | Full if provider/file limits work through browser host |
| Virtual Workspace | Full or explicitly limited based on provider/watcher support |
| Restricted Mode | Full read-only behavior; no code execution |

`capabilities` and `extensionKind` must be based on tests. Scanning a remote workspace likely belongs in the workspace extension host, but the final declaration must be verified.

Derive the minimum VS Code version from APIs used and test that minimum plus current stable.

---

## 11. Security and privacy

- no network access;
- zero telemetry in `0.1`;
- no annotation text, comments, filenames, or source content in logs;
- no index persistence by default;
- no `eval` or workspace-configured executable behavior;
- no regex mode in initial release;
- validate and bound token strings/globs/numeric settings;
- read only configured candidate files;
- handle maliciously large files, long lines, and pathological tokens predictably;
- command arguments and Tree item data validated at runtime;
- no HTML rendering of annotation content;
- tooltips use plain MarkdownString/plain text with command links disabled;
- Restricted Mode declaration reflects actual read-only behavior.

Annotation messages may contain secrets. The Tree View necessarily displays them locally, but they must never leave the extension host or appear in telemetry/logs.

---

## 12. Accessibility and UX

- token names remain visible; color is supplemental;
- high-contrast theme smoke test;
- native Tree View and Quick Pick;
- keyboard navigation and commands;
- accessible names include token, message, file, and line where useful;
- concise, non-repeating scan-limit/error notifications;
- cancellation available for long scans;
- no promotional UI in the editor/view;
- no custom icons that are unclear at 16 px;
- filter state is visible;
- empty/partial states explain the next action;
- next/previous navigation wraps only if documented and configurable decision is settled.

---

## 13. Test matrix

### Matcher and adapter unit tests

- token boundaries;
- colon/parentheses after token;
- case sensitivity;
- duplicate/custom tokens;
- comments versus strings;
- block and line comments;
- nested-looking markup;
- multiline comments;
- escaped delimiters;
- Markdown code fences;
- minified/long lines;
- Unicode messages;
- CRLF/LF/BOM;
- message truncation;
- invalid configuration;
- binary prefix detection.

### Index unit tests

- add/update/remove file;
- stable sort;
- replace open-buffer result over disk result;
- limit reached state;
- cancellation generation;
- stale scan result ignored;
- filter state;
- duplicate event coalescing;
- rename modeled as delete/create;
- partial/complete state transitions.

### Desktop integration

- activation by view and command;
- no workspace scan before feature activation;
- decorations on open/edit/close;
- Tree View population and navigation;
- refresh/cancel/filter/clear;
- create/change/delete file updates;
- dirty buffer authority;
- multi-root paths;
- read-only files;
- Restricted Mode;
- large workspace fixture;
- high-contrast manual check;
- minimum/current VS Code.

### Web/virtual/remote

- browser bundle loads;
- virtual workspace discovery/read;
- provider without watcher support;
- remote URIs and relative labels;
- `@vscode/test-web` navigation and index tests;
- manual `vscode.dev` sideload;
- no Node-only dependency in browser artifact.

### Package

- VSIX includes required views/config/colors/icon/README/LICENSE/CHANGELOG;
- source/tests/internal docs excluded intentionally;
- clean-profile installation;
- packaged activation and view rendering;
- uninstall leaves no persisted index.

---

## 14. Ordered ticket backlog

Use these IDs in GitHub Issues, branches, commits, and PR descriptions.

### Identity and foundation

#### ANN-001 — Finalize public naming and namespaces
Priority: P0  
Depends on: none

Rename display/command/config/view/color identifiers coherently before publication. Check Marketplace/Open VSX collisions and record the result.

#### ANN-002 — Align Node/web module formats
Priority: P0  
Depends on: ANN-001

Replace the current ESM/CommonJS ambiguity with explicit Node and browser artifacts; update manifest, build, launch, and package exclusions.

#### ANN-003 — Establish unit, desktop, and web test harnesses
Priority: P0  
Depends on: ANN-002

Add fixture workspace, `@vscode/test-electron`, `@vscode/test-web`, activation tests, CI timeouts, and minimum/current version strategy.

#### ANN-004 — Define annotation, token, range, and index domain models
Priority: P0  
Depends on: ANN-001

Create immutable pure types and stable IDs without embedding message content.

### Matching and configuration

#### ANN-005 — Implement token configuration normalization
Priority: P0  
Depends on: ANN-004

Validate literal tokens, limits, duplicates, case behavior, control characters, and defaults.

#### ANN-006 — Implement core literal token matcher
Priority: P0  
Depends on: ANN-005

Deliver bounded boundary matching, message extraction, truncation metadata, and deterministic ordering.

#### ANN-007 — Implement initial comment adapters
Priority: P0  
Depends on: ANN-006

Cover slash, hash, markup, and stylesheet comment families with fixture-backed scanners. Document fallback behavior.

#### ANN-008 — Contribute native configuration schema
Priority: P0  
Depends on: ANN-005

Add tokens, case sensitivity, decorations, include/exclude, and numeric safeguards. No regex/eval settings.

#### ANN-009 — Contribute theme colors and decoration style map
Priority: P0  
Depends on: ANN-001

Define semantic styles compatible with dark/light/high-contrast themes and native customization.

### Editor experience

#### ANN-010 — Implement active-document matching cache
Priority: P0  
Depends on: ANN-006, ANN-007

Parse eligible open documents by URI/version, debounce edits, enforce size limits, and clear on close.

#### ANN-011 — Implement reusable editor decorations
Priority: P0  
Depends on: ANN-009, ANN-010

Decorate token ranges across visible editors, update incrementally, and dispose types/listeners correctly.

#### ANN-012 — Add editor lifecycle and configuration handling
Priority: P0  
Depends on: ANN-011

Handle active/visible editor changes, saves, language changes, theme/config changes, and extension disable state without leaks.

### Workspace index

#### ANN-013 — Implement bounded URI discovery
Priority: P0  
Depends on: ANN-003, ANN-008

Use `workspace.findFiles`, exclusions, max-file count, cancellation, multi-root provenance, and URI-safe paths.

#### ANN-014 — Implement safe file reader and binary/size guards
Priority: P0  
Depends on: ANN-013

Read through `workspace.fs`, skip unsupported/large/binary candidates, aggregate value-free errors, and honor cancellation.

#### ANN-015 — Implement per-file annotation index
Priority: P0  
Depends on: ANN-004, ANN-006, ANN-014

Support replace/remove/query/sort/filter, open-buffer authority, partial state, result limits, and stale generation rejection.

#### ANN-016 — Implement scan coordinator and progress/cancellation
Priority: P0  
Depends on: ANN-015

Ensure one active generation, batched updates, cancellation, and no scan before view/command activation.

#### ANN-017 — Implement incremental file/watch updates
Priority: P0  
Depends on: ANN-015, ANN-016

Handle create/change/delete/rename/save events, coalesce bursts, and provide virtual-workspace fallback.

### Tree View and commands

#### ANN-018 — Contribute Tree View, welcome content, and menus
Priority: P0  
Depends on: ANN-001

Add view ID/container decision, title actions, context values, welcome/empty content, and activation behavior.

#### ANN-019 — Implement TreeDataProvider and native items
Priority: P0  
Depends on: ANN-015, ANN-018

Group by file, sort, display counts/messages/line numbers, provide safe tooltips/accessibility labels, and stable IDs.

#### ANN-020 — Implement reveal/navigation behavior
Priority: P0  
Depends on: ANN-019

Open exact URI, reveal/select range, recover from deleted/moved files, and support keyboard activation.

#### ANN-021 — Implement refresh/show/filter/clear commands
Priority: P0  
Depends on: ANN-016, ANN-019

Add Quick Pick filtering, visible active filter, cancellation, and manual refresh.

#### ANN-022 — Implement next/previous navigation
Priority: P1  
Depends on: ANN-015, ANN-020

Define ordering, scope, wrap behavior, filtered-index behavior, and no-result UX.

### Hardening and release

#### ANN-023 — Complete performance and large-workspace benchmark suite
Priority: P0  
Depends on: ANN-010 through ANN-022

Benchmark limits, pathological long lines, cancellation latency, edit debounce, batch updates, and memory.

#### ANN-024 — Complete security/privacy review
Priority: P0  
Depends on: ANN-010 through ANN-022

Audit logs, message handling, token/glob inputs, tooltip safety, persistence, Restricted Mode, and source-content boundaries.

#### ANN-025 — Complete desktop integration matrix
Priority: P0  
Depends on: ANN-023, ANN-024

Test lifecycle, dirty buffers, multi-root, file events, view navigation, limits, high contrast, Restricted Mode, minimum/current VS Code.

#### ANN-026 — Complete web/virtual/remote matrix
Priority: P0  
Depends on: ANN-003, ANN-017 through ANN-024

Ship browser entry, web tests, virtual provider behavior, remote location decision, and manual `vscode.dev` smoke test.

#### ANN-027 — Replace scaffold README and preview
Priority: P1  
Depends on: implemented user flows

Document tokens, matching limitations, settings, view, performance limits, privacy, compatibility, troubleshooting, and real screenshots. Update CHANGELOG.

#### ANN-028 — Harden CI and package inspection
Priority: P0  
Depends on: ANN-025 through ANN-027

Run unit, desktop, web, build, VSIX creation/content inspection, packaged activation, and clean-profile smoke tests.

#### ANN-029 — Derive manifest capabilities and minimum VS Code
Priority: P0  
Depends on: ANN-025, ANN-026

Set `engines.vscode`, `browser`, `capabilities`, `extensionKind`, activation, views, menus, and colors from proven behavior.

#### ANN-030 — Publish and verify `0.1.0`
Priority: P0  
Depends on: ANN-028, ANN-029

Publish Marketplace/Open VSX artifacts, release notes, post-publication installation tests, and first-week issue triage.

---

## 15. Launch gate

Do not publish until:

- public IDs/namespaces are final;
- no placeholder code/test remains;
- workspace scan does not run at generic activation;
- cancellation and limits work under large fixtures;
- dirty open buffers override stale disk results;
- Tree View navigation and decorations agree on ranges;
- editor decorations remain readable in dark/light/high contrast;
- no annotation content is logged, persisted, or transmitted;
- web/virtual/remote claims are test-backed;
- Node/browser artifacts match the manifest;
- minimum VS Code version is derived and tested;
- packaged VSIX is installed in a clean profile;
- README accurately documents fallback false positives and limits.

---

## 16. Post-`0.1.0` candidates

Promote only from user evidence:

- group by token or owner;
- optional selected-token Problems diagnostics;
- assignment syntax such as `TODO(@name)`;
- export Markdown/JSON;
- richer language adapters;
- workspace-folder scoping controls;
- optional whole-line decoration;
- persisted filter preference;
- regex tokens only after a dedicated safety design.

Issue-tracker synchronization, AI TODO generation, automatic comment writing, and project-management features remain non-goals.

---

## 17. Primary references

- https://code.visualstudio.com/api
- https://code.visualstudio.com/api/extension-guides/tree-view
- https://code.visualstudio.com/api/references/extension-manifest
- https://code.visualstudio.com/api/references/activation-events
- https://code.visualstudio.com/api/references/theme-color
- https://code.visualstudio.com/api/extension-guides/web-extensions
- https://code.visualstudio.com/api/extension-guides/virtual-workspaces
- https://code.visualstudio.com/api/extension-guides/workspace-trust
- https://code.visualstudio.com/api/advanced-topics/extension-host
- https://code.visualstudio.com/api/advanced-topics/remote-extensions
- https://code.visualstudio.com/api/ux-guidelines/views
- https://code.visualstudio.com/api/ux-guidelines/quick-picks
- https://code.visualstudio.com/api/working-with-extensions/testing-extension
- https://code.visualstudio.com/api/working-with-extensions/bundling-extension
- https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- https://github.com/microsoft/vscode-extension-samples
- https://github.com/microsoft/vscode-test-web
