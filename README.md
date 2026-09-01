# Annotations

Decorate TODO, FIXME, HACK, NOTE, REVIEW, and DEPRECATED markers and list them in a tree.

This repository is private and unpublished. Do not publish a VSIX until the product PDR v1 list is complete.

Extension id: `gvastethecreator.code-annotations`.

## Status

Scaffold only. Commands appear in the Command Palette and return "This command is not implemented yet."

## Product contract

See [docs/PDR.md](docs/PDR.md).

Development details: [docs/development.md](docs/development.md). Publishing: [docs/publishing.md](docs/publishing.md).

## Development

Package manager is pnpm. Do not switch to npm or yarn.

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm test` | Node test runner on `src/**/*.test.ts` |
| `pnpm run check-types` | `tsc --noEmit` |
| `pnpm run compile` | Types then esbuild |
| `pnpm run watch` | esbuild watch |
| `pnpm run package` | Production bundle |
| `pnpm run vsix` | Production bundle + VSIX |

F5 (`Run Extension`) compiles, then opens `test-workspace/`.

## Privacy

No telemetry. No network. File contents stay on this machine.

## License

MIT. See [LICENSE](LICENSE).
