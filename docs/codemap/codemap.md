# Code map · vscode-code-annotations

generated: 2026-09-05T04:45:27Z
commit: 15227074ac13
scope: .

counts: 10 nodes · 19 edges · 0 flows · 0 unknown

## Modules

- `esbuild` · `esbuild.cjs` · interface · Esbuild
  callers: repository (calls)
  callees: external-dependencies (imports)
  tests: (none)
  entry: esbuild.cjs:main

- `external-dependencies` · `esbuild.cjs` · external · External
  callers: esbuild (imports), scripts (imports), src (imports), src-editor (imports), src-views (imports), src-workspace (imports)
  callees: (none)
  tests: (none)
  entry: esbuild.cjs:esbuild

- `repository` · `package.json` · module · Repository
  callers: (none)
  callees: esbuild (calls), scripts (calls)
  tests: (none)
  entry: package.json:{

- `scripts` · `scripts` · service · Scripts
  callers: repository (calls)
  callees: external-dependencies (imports), src-core (imports)
  tests: (none)
  entry: scripts/build-web-tests.mjs:root

- `src` · `src` · module · Src
  callers: src-editor (imports), src-views (imports), src-workspace (imports)
  callees: external-dependencies (imports), src-core (imports), src-editor (imports), src-views (imports), src-workspace (imports)
  tests: (none)
  entry: src/commands.ts:COMMANDS

- `src-core` · `src/core` · service · Src
  callers: scripts (imports), src (imports), src-editor (imports), src-views (imports), src-workspace (imports)
  callees: (none)
  tests: src/core/config.test.ts, src/core/guards.test.ts, src/core/index.test.ts, src/core/matcher.test.ts
  entry: src/core/index.ts:AnnotationIndex

- `src-editor` · `src/editor` · module · Src
  callers: src (imports)
  callees: external-dependencies (imports), src (imports), src-core (imports)
  tests: (none)
  entry: src/editor/decorations.ts:AnnotationDecorations

- `src-views` · `src/views` · module · Src
  callers: src (imports)
  callees: external-dependencies (imports), src (imports), src-core (imports)
  tests: (none)
  entry: src/views/annotationsTree.ts:AnnotationsTreeProvider

- `src-workspace` · `src/workspace` · module · Src
  callers: src (imports)
  callees: external-dependencies (imports), src (imports), src-core (imports)
  tests: (none)
  entry: src/workspace/coordinator.ts:delay

- `test-workspace-src` · `test-workspace/src` · module · Test Workspace
  callers: (none)
  callees: (none)
  tests: (none)
  entry: test-workspace/src/annotations.ts:queueJob

## Edges

- esbuild -> external-dependencies · imports
- repository -> esbuild · calls
- repository -> scripts · calls
- scripts -> external-dependencies · imports
- scripts -> src-core · imports
- src -> external-dependencies · imports
- src -> src-core · imports
- src -> src-editor · imports
- src -> src-views · imports
- src -> src-workspace · imports
- src-editor -> external-dependencies · imports
- src-editor -> src · imports
- src-editor -> src-core · imports
- src-views -> external-dependencies · imports
- src-views -> src · imports
- src-views -> src-core · imports
- src-workspace -> external-dependencies · imports
- src-workspace -> src · imports
- src-workspace -> src-core · imports

## Unknown

- none

## Flows

- none
