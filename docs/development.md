# Development

Use Node.js 22 and pnpm 12. The lockfile and `packageManager` field are authoritative.

## Structure

- `src/core/` contains pure matching, validation, language, binary, and index logic.
- `src/editor/` owns reusable editor decorations.
- `src/workspace/` owns lazy discovery, bounded reads, generations, and watcher updates.
- `src/views/` owns the native Explorer Tree View.
- `test-workspace/` is the shared writable fixture for desktop, web, VSIX, and preview checks.
- `scripts/` contains package, performance, and media gates.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install the locked dependency graph. |
| `pnpm run test:unit` | Run pure Node tests. |
| `pnpm run check-types` | Type-check extension source. |
| `pnpm run compile` | Type-check and build Node/web development bundles. |
| `pnpm run package` | Build minified production bundles. |
| `pnpm run test:performance` | Check matcher, index, bundle size, and module-load budgets. |
| `pnpm run test:integration` | Run the extension from source in a clean desktop host. |
| `pnpm run test:web` | Run the browser bundle in a writable virtual workspace. |
| `pnpm run vsix` | Build `code-annotations.vsix`. |
| `pnpm run inspect:vsix` | Verify the package allowlist, manifest, bundles, and media. |
| `pnpm run test:vsix` | Install the VSIX into a clean profile and run public-flow tests. |
| `pnpm run render:media` | Downsample the accepted Imagegen PNG directly to `media/icon.png`. |
| `pnpm run check:media` | Verify direct provenance, alpha, sizes, and 32px readability. |
| `pnpm run quality` | Run unit, types, build, performance, and media gates. |

## Extension Host

Press F5 with **Run Extension**. The launch config compiles both `.cjs` runtime bundles and opens `test-workspace/`.

The workspace scan is deliberately lazy. Opening a supported document can activate decorations, but a full scan starts only when the Tree View becomes visible or a workspace command needs the index.

## Media

`media/source/code-annotations-imagegen.png` is the accepted generated raster source. Do not redraw it as SVG. `media/icon.png` must remain an alpha-preserving resize of those exact pixels. `media/preview.png` must be captured from the final installed VSIX, not composed as a mockup.
