# Code Annotations — additional quality and competitive review

Review date: 2026-09-06. Baseline: `1020534ca8d778a80375bc8e025626456b06389d` (`main`).

## Scope and status

This is a source-pinned review and proposed acceptance contract, not a feature implementation. Live execution checklists belong in the accompanying PR. The shipped PDR remains unchanged; later behavior changes must update its portfolio counterpart too.

Current ref, AGENTS, tree provider, token normalization, core index and release publication steps were re-read. These reads extend the first review with a concrete filter-identity inconsistency. No build, desktop/web host, VSIX or performance test ran: local checkout was blocked by DNS and pnpm was unavailable. Static findings are distinguished from observed runtime incidents.

Pinned evidence: [tree provider](https://github.com/gvastethecreator/vscode-code-annotations/blob/1020534ca8d778a80375bc8e025626456b06389d/src/views/annotationsTree.ts), [token normalization](https://github.com/gvastethecreator/vscode-code-annotations/blob/1020534ca8d778a80375bc8e025626456b06389d/src/core/config.ts), [index](https://github.com/gvastethecreator/vscode-code-annotations/blob/1020534ca8d778a80375bc8e025626456b06389d/src/core/index.ts), [release](https://github.com/gvastethecreator/vscode-code-annotations/blob/1020534ca8d778a80375bc8e025626456b06389d/.github/workflows/release.yml).

## Preserve the bounded index

The product already has literal-token matching, a native tree, token filtering, next/previous navigation and partial-result indication. Preserve lazy workspace discovery, explicit size/file/result limits, cancellable scans, URI-based filesystem access and incremental updates. A new grouping is a projection of the existing index, not a reason for another scan or storage backend.

[Todo Tree](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree) is the relevant comparison for grouping/filtering/export workflows. Its broader configuration surface does not justify adding regex modes, task boards or an issue synchronization service here.

## Additional finding: case-sensitive identity is lost in filters

`normalizeTokens(value, caseSensitive)` preserves distinct token identities when case sensitivity is enabled: `TODO` and `todo` are valid distinct entries. However, `AnnotationsTreeProvider` lowercases filter choices and configured tokens, and `AnnotationIndex.groups` tests `annotation.token.toLowerCase()` regardless of case policy.

Consequently, the filter representation cannot distinguish those two valid configured tokens. Selecting only one can admit both. This is a verified source-level inconsistency; it has not been run inside an Extension Host during this review.

Use one canonical token identity throughout configuration, matcher results, filter choices, index projections and navigation. Case-sensitive mode must retain case; insensitive mode must normalize consistently with the matcher. Reuse the existing normalized comparison policy rather than inventing another casing rule. Define filter migration when the case setting changes, and preserve the semantic difference between no filter and an explicitly empty filter.

Regression fixture: configure both `TODO` and `todo`, annotate one of each, select only `TODO`, and assert one displayed/exported/navigable result. Repeat in insensitive mode, where equivalent configured tokens should deduplicate according to the existing normalization contract.

## Group by token and scope to the active file

Keep file grouping as the default and add token grouping using the same current result set. Introduce an explicit Active File scope in the existing tree controls or picker. The active-file identifier is a full URI, not basename. When focus moves to a non-text surface, define a stable last-eligible-file policy or show the absence explicitly; never silently return to a full-workspace scope.

Use the same projection for tree rows, counts, next/previous commands and export. Changing grouping or scope must not start another workspace scan. Keep deterministic ordering, stable node IDs, accessible labels and partial-result warnings. Define behavior when a file closes, moves, leaves a workspace root or has unsaved changes.

Touchpoints: `src/views/annotationsTree.ts`, `src/core/index.ts`, command wiring, context keys/manifest and existing tests. Do not duplicate the index or retain separate arrays of full document contents.

## Export the filtered view

Create an unsaved Markdown or plain-text document from an explicit export command. Include workspace-relative file identity, line, token and message, preserving the exact selected scope/filter. Escape Markdown syntax, link targets and unusual filenames; do not emit executable command links or automatically save files.

If the index is partial, include that status and its reason in the exported header. An empty filtered view must not be described as a clean or fully scanned repository. Keep export bounded by existing result/message limits. Never log paths or annotation messages while exporting; output is user-requested document content, not telemetry.

## Lifecycle and rendering checks

The tree provider owns an EventEmitter but does not expose disposal in the reviewed class. Review its owner wiring and add deterministic disposal coverage before calling this a measured leak. Repeated enable/disable/open/close cycles must release observers, timers and provider-owned resources. Keep tree refresh coalesced for a batch of index events; avoid a complete scan or expensive reprojection per individual file event.

## Release publication contract

The inspected GitHub Release job invokes `gh release` without checkout or explicit repository context and does not target the verified source SHA. Its release check is not a tag-ref check; API failures are not separately classified. The shown publication consumers do not explicitly verify downloaded checksum sidecars.

Require explicit repository identity, a preparation-stage source SHA, matching tag/ref checks and checksum verification before every publisher. Existing tags must not move; network/permission failures must abort rather than be treated as absence. Preserve protected environments and artifact-only defaults. Validate without registry publication. References: [CLI repository context](https://cli.github.com/manual/gh_help_environment), [release tag target](https://cli.github.com/manual/gh_release_create).

## Acceptance matrix

| Scenario | Required outcome |
| --- | --- |
| Case-sensitive `TODO` and `todo`, one selected | Exactly the chosen token is shown, exported and navigated. |
| Toggle case policy, empty filter or removed token | Defined migration; no accidental all-results fallback. |
| Switch grouping or Active File scope | No new scan; rows, counts and navigation agree. |
| Equal basenames in different roots | Scope follows the exact URI. |
| Partial/cancelled/limited scan | Tree and export both declare incompleteness. |
| Markdown punctuation or unusual paths in messages | Safe, readable export; no command-link injection. |
| Repeated provider lifecycle and event bursts | Resources disposed; bounded/coalesced refresh work. |
| Wrong artifact checksum or mismatched tag | Publication fails before registry actions. |

Run existing core/integration/web/installed-VSIX suites, using representative large-workspace and dirty-document fixtures. Measure cold activation, first explicit scan, incremental updates and projection cost separately; record fixture/source/editor versions and artifact hash. Do not use module-load timing as a proxy for workspace scan cost. No measured performance claim is made here.

## Exclusions

No Kanban, database, assignment system, reminders, issue-account integration, telemetry, network calls, regex/eval modes or custom webview. More useful views should reuse the same small index and preserve truthful partial results.
