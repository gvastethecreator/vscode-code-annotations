# Domain docs

How engineering skills consume this repo's domain docs when exploring.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists. It points at one `CONTEXT.md` per context. Read each relevant to the topic.
- **`docs/adr/`**: ADRs that touch the area you are about to work in.
- Product contract: `docs/PDR.md`.
- Engineering rules: `AGENTS.md`.

If any of these files do not exist, **proceed silently**. Do not flag absence or suggest creating them. `/grill-with-docs` creates them lazily when terms or decisions resolve.

## Public vs local

Tickets, task lists, and in-flight architecture spikes never live under `docs/`. Local tickets: `.scratch/vscode-code-annotations/issues/`. Operator architecture: `.scratch/architecture/`. `docs/adr/` is the published decision log only when README, CONTRIBUTING, or this contract treats it as public/contributor docs.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
├── docs/adr/
├── docs/PDR.md
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept (issue title, refactor proposal, hypothesis, test name), use the `CONTEXT.md` term. Do not drift to synonyms the glossary avoids.

If the concept is missing from the glossary: inventing language the project does not use (reconsider), or a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If output contradicts an existing ADR, surface it; don't silently override.
