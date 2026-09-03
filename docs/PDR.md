Repo: `https://github.com/gvastethecreator/vscode-code-annotations`

Remote: public (`gvastethecreator/vscode-code-annotations`)

# PDR — Code Annotations: TODO Index

## Status

`0.1.0` release candidate implemented. Publication remains a separate human-approved gate.

## Product summary

Code Annotations highlights and indexes `TODO`, `FIXME`, `HACK`, `NOTE`, `REVIEW`, `DEPRECATED`, and validated literal custom tokens inside comments. It uses native VS Code surfaces, bounded scanning, and no webview, network, telemetry, persistence, subprocess, or workspace-code execution.

## Release contract

- Editor decorations apply only to matched token ranges.
- A native Explorer Tree View groups deterministic results by file.
- Tree items open the exact URI and validate the indexed token before selecting it.
- Native Quick Pick filtering changes the view and next/previous navigation scope.
- Next and previous navigation wrap across the filtered ordinal index.
- Workspace scanning begins only when the view becomes visible or a workspace command needs it.
- One cancellable scan generation runs at a time. File create/change/delete events update the active index after a 300 ms debounce.
- Open documents are authoritative over disk. Closing a dirty document schedules a 600 ms disk rescan instead of immediately replacing its result with stale disk state.

## Default tokens and styles

| Token | Semantic style |
| --- | --- |
| `TODO` | info |
| `FIXME` | error |
| `HACK` | warning |
| `NOTE` | muted |
| `REVIEW` | review |
| `DEPRECATED` | deprecated |

The text and native icon remain available without color. Six contributed theme colors define dark, light, high-contrast dark, and high-contrast light defaults.

## Matching

Tokens are plain strings, limited to 32 entries and 64 characters each. Empty, duplicate, whitespace-containing, or control-character tokens are rejected. Matching honors the case-sensitivity setting and word boundaries; it never evaluates regular expressions or code.

Initial adapters cover:

- slash comments for JavaScript, TypeScript, C-family, Rust, Go, Java, PHP, Swift, Kotlin, and related modes;
- hash comments for Python, shell, PowerShell, YAML, TOML, Ruby, and related modes;
- markup comments for HTML, XML, Vue, Svelte, and Astro;
- CSS, SCSS, and Less block comments;
- Markdown and MDX HTML comments outside fenced code;
- a conservative line-prefix fallback for unknown languages.

Messages are normalized and limited to 500 characters. Stable hashed IDs include URI, normalized token, and offsets, never message text.

## Configuration

| Setting | Default | Bound |
| --- | --- | --- |
| `codeAnnotations.enabled` | `true` | Boolean |
| `codeAnnotations.tokens` | Built-in six | 32 literal tokens, 64 chars each |
| `codeAnnotations.caseSensitive` | `true` | Boolean |
| `codeAnnotations.decorations.enabled` | `true` | Boolean |
| `codeAnnotations.scan.include` | `["**/*"]` | 32 patterns, 256 chars each |
| `codeAnnotations.scan.exclude` | Generated/vendor defaults | 32 patterns, 256 chars each |
| `codeAnnotations.scan.maxFileSize` | 1 MiB | 1 KiB–16 MiB |
| `codeAnnotations.scan.maxFiles` | 20,000 | 1–100,000 |
| `codeAnnotations.scan.maxResults` | 10,000 | 1–100,000 |

Per-file results are fixed at 1,000. Editor changes debounce for 200 ms. Full scans read in batches of eight. Known binary files and oversized files are skipped. The view marks partial state after file/result/per-file limits, cancellation, size skips, or read errors.

## Commands

- `Code Annotations: Refresh Workspace`
- `Code Annotations: Show All`
- `Code Annotations: Filter Tokens...`
- `Code Annotations: Clear Filter`
- `Code Annotations: Next Annotation`
- `Code Annotations: Previous Annotation`

No default keybindings ship in `0.1.0`.

## Compatibility

Minimum VS Code is `1.134.0`. The package supplies explicit Node and browser CommonJS bundles. `extensionKind` prefers the workspace host and allows the UI host. Virtual and untrusted workspaces are declared supported because all access uses VS Code URI APIs and read-only extension behavior.

Automated gates cover Linux minimum/Stable/Insiders desktop hosts, Windows and macOS Stable, a writable browser-host virtual workspace, and installation of the exact VSIX into a clean profile. Remote-host behavior follows the same workspace extension path; real remote provider latency remains an environment-specific manual release check.

## Security and privacy

- No document content, path, environment value, or annotation message leaves the extension host or enters logs.
- No network request, telemetry, subprocess, persistence, webview, dynamic import, `eval`, or workspace code execution.
- Tree commands accept only opaque stable IDs and revalidate the current target before reveal.
- Configuration and command arguments are treated as untrusted input and bounded.

## Performance budgets

- 100 KiB comment fixture median: under 50 ms in the local performance gate.
- 1 MiB comment fixture median: under 500 ms.
- 10,000-result index replacement and flatten: under 100 ms.
- Node and web bundles: under 600 KiB each.
- Bundle module load: under 50 ms.

## Assets

`media/source/code-annotations-imagegen.png` is the accepted native-alpha Imagegen source. `media/icon.png` is a direct alpha-preserving 256×256 downsample; no SVG reinterpretation is allowed. `media/preview.png` is a tightly cropped native-alpha editor capture from the final installed VSIX, showing the configured annotation tokens on synthetic TypeScript code.

## Non-goals for 0.1.0

- diagnostics or Problems entries;
- issue-tracker synchronization;
- ownership or assignment syntax;
- regex tokens;
- custom settings webview;
- universal parsing of every embedded language;
- export or persistence of the index.

## Release gate

Unit, type, build, performance, media, desktop, web, VSIX inspection, and installed-package checks must pass on the candidate bytes. Marketplace/Open VSX publication, release creation, tagging, and post-publication verification require explicit human authorization.
