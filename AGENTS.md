# Annotations

VS Code extension (`gvastethecreator.code-annotations`). pnpm. TypeScript in `src/`. esbuild writes `dist/extension.js`.

## Commands

- Install: `pnpm install`
- Test: `pnpm test`
- Types: `pnpm run check-types`
- Compile: `pnpm run compile`
- Watch: `pnpm run watch`
- Production bundle: `pnpm run package`
- VSIX: `pnpm run vsix`

F5 (`Run Extension`) compiles, then opens `test-workspace/`.

## Rules

- Package manager is pnpm. Do not switch to npm or yarn.
- Product UI strings stay English. Operator chat may be Spanish.
- No webviews. Use Command Palette, Quick Pick, Problems, Tree View, or decorations.
- No telemetry. Do not log secrets, clipboard bytes, or document contents.
- Domain logic lives in `src/core/` with no `vscode` import.
- Product contract: `docs/PDR.md`. Update it in the same change as behavior.
- Do not write tickets under `docs/`. Local tickets: `.scratch/code-annotations/issues/`.
- Do not commit, push, or rewrite git history unless the user asks. Scaffold first commit is an exception.

## Layout

- `src/extension.ts` — activate and command registration
- `src/commands.ts` — command ids
- `src/core/` — pure logic and tests
- `test-workspace/` — Extension Host folder
- `docs/PDR.md` — product contract
