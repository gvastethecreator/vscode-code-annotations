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

`media/source/code-annotations-imagegen-raw.png` retains isolated code-line composition `exec-b76b4a5d-5733-4d7d-bb58-cb7bdf41c924`. Native-alpha extraction `exec-fabd5197-955b-49ad-beec-ba222b620b68` produced `media/source/code-annotations-imagegen.png`, the accepted raster normalized to a thin transparent safety margin. It uses five open code lines and one integrated annotation marker without an editor or browser tile. Do not redraw it as SVG. `media/icon.png` must remain an alpha-preserving resize of those exact pixels. `media/preview.png` must be captured from the final installed VSIX, not composed as a mockup.

SHA-256: raw `6A88216FE9C9CCFC5405AE6DDA9C0EA4BE5F910FC6D31C524AE2B15C79A726CA`; accepted `FDF9CF03B333B83C4F7EBF9B6904852ED6000CCFFC240374F6EF5395319429B5`; production `6DE8D652A8556A31206961190CCABA12675E0A774D5FC37A5B9B8A8919E076CC`.
