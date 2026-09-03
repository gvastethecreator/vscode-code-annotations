# Publishing Code Annotations

Extension ID: `gvastethecreator.code-annotations`

Marketplace display name: `Code Annotations: TODO Index`

An existing Marketplace extension already uses the exact display name **Code Annotations** under another publisher. The more specific display name avoids ambiguous search and support while preserving this repository's package ID and the `codeAnnotations.*` public namespace.

Publishing is a separate operator action. Do not publish, create a release, tag, or delete a branch as part of normal implementation.

## Candidate gate

1. Run `pnpm install --frozen-lockfile` on the candidate commit.
2. Run `pnpm run quality`.
3. Run desktop tests on VS Code 1.134.0, current Stable, and Insiders; include Windows, macOS, and Linux Stable.
4. Run `pnpm exec playwright install --with-deps chromium` and `pnpm run test:web`.
5. Run `pnpm run vsix` and `pnpm run inspect:vsix`.
6. Install the exact VSIX into a clean profile and run `pnpm run test:vsix`.
7. Capture `media/preview.png` from that installed VSIX, rebuild once, and repeat package inspection without changing source afterward.
8. Review README, changelog, icon, preview, licensing notices, version, and package hash.
9. Obtain explicit human approval for Marketplace/Open VSX upload.

The CI **Release candidate** workflow performs the reproducible automated subset and uploads the exact VSIX artifact without publishing it.
