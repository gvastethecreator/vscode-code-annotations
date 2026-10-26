# Code Annotations

VS Code extension `gvastethecreator.code-annotations`. Node 22, pnpm 12, TypeScript. esbuild writes `dist/node/extension.cjs` and `dist/web/extension.cjs`.

## Commands

- Install: `pnpm install`
- Quality: `pnpm run quality`
- Desktop integration: `pnpm run test:integration`
- Web/virtual integration: `pnpm run test:web`
- Production bundle: `pnpm run package`
- VSIX: `pnpm run vsix`
- Inspect VSIX: `pnpm run inspect:vsix`
- Installed smoke: `pnpm run test:vsix`

## Rules

- Package manager is pnpm. Do not switch to npm or yarn.
- Product UI strings stay English. Operator chat may be Spanish.
- No webviews. Use the native Command Palette, Quick Pick, Tree View, notifications, and decorations.
- No telemetry or network access. Never log paths, document contents, environment values, or annotation messages.
- Domain logic stays in `src/core/` without `vscode` imports.
- Tokens remain bounded literal strings. Do not add regex or eval modes.
- Workspace access uses VS Code URI APIs and `workspace.fs`; preserve web, virtual, remote, and Restricted Mode support.
- Full workspace scanning stays lazy, bounded, cancellable, and incremental.
- `media/source/code-annotations-imagegen.png` is the accepted raster source. Do not reinterpret it as SVG.
- Product contract is `docs/PDR.md`; update the portfolio copy in the same change.
- Local tickets belong under `.scratch/vscode-code-annotations/issues/`, never `docs/`.
- Do not commit, push, publish, tag, or rewrite history without explicit approval.

## Layout

- `src/extension.ts` — lifecycle and command wiring
- `src/configuration.ts` — VS Code settings adapter
- `src/core/` — pure match, guard, language, and index logic with unit tests
- `src/editor/` — visible-editor decorations
- `src/workspace/` — lazy scan and incremental coordination
- `src/views/` — native Explorer tree
- `test/` — desktop, web, and installed-VSIX runners
- `test-workspace/` — shared user-observable fixture
- `scripts/` — builds, package inspection, performance, and media tooling
- `docs/adr/` — durable design decisions
- `docs/PDR.md` — shipped product contract
