# Development

Package manager is pnpm (`packageManager: pnpm@12.1.0`). Do not switch to npm or yarn.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm install` | Install deps from `pnpm-lock.yaml` |
| `pnpm test` | Node test runner on `src/**/*.test.ts` |
| `pnpm run check-types` | `tsc --noEmit` |
| `pnpm run compile` | Types then esbuild → `dist/extension.js` |
| `pnpm run watch` | esbuild watch |
| `pnpm run package` | Production bundle |
| `pnpm run vsix` | Production bundle + `vsce package --no-dependencies` |

GitHub Actions runs `pnpm test` and `pnpm run check-types` on `main` and pull requests.

## Extension Host

`.vscode/launch.json` uses the default build task, then opens `test-workspace/` with `--extensionDevelopmentPath` set to this repo.

Marketplace packaging: [publishing](publishing.md).
