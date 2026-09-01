# Publishing Annotations

Extension id: `gvastethecreator.code-annotations`.

This repository starts private. Do not publish to the Marketplace until PDR v1 is done and the user asks.

## Package a VSIX (no token needed)

```bash
pnpm run vsix
```

Output: `code-annotations-<version>.vsix` (gitignored).

## Browser upload

1. Open https://marketplace.visualstudio.com/manage
2. Sign in with the Microsoft account that owns publisher `gvastethecreator`
3. Choose **New extension** → **Visual Studio Code** → upload the VSIX

`package.json` → `icon` must be PNG. Keep SVG sources out of the VSIX (see `.vscodeignore`).
