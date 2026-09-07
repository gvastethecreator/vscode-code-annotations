# Changelog

## [Unreleased]

- Token filters respect caseSensitive, so TODO and todo can be selected independently. Selecting no tokens shows no results. The view can group by file or token, and can show the workspace or only the active file. Tree entries, next/previous navigation and Export Filtered Results use the same filtered index projection. Export opens an unsaved JSON document containing the selected results and partial-scan status for review and Save As. It does not run an additional scanner or persist the index automatically. Grouping and scope are session state.

## 0.1.1 — Unreleased

- Added a Set Defaults command that writes factory settings to user and workspace scope.

## 0.1.0 — 2026-09-02

- Added comment-aware decorations for six built-in markers and validated literal custom tokens.
- Added a lazy, bounded, cancellable workspace index with native Explorer grouping, filtering, refresh, and wraparound navigation.
- Added incremental open-document and file watcher updates with virtual workspace, web, remote, and Restricted Mode support.
- Added semantic theme colors, accessible native Tree items, and partial-index feedback.
- Added unit, performance, desktop, web, packaged VSIX, and package-content gates.
- Replaced scaffold media with a direct Imagegen PNG icon and a preview captured from the installed VSIX.
