# Triage fields

GitHub Issues: one category label and one triage label. Local mirrors record the same values.

## Categories

| Canonical category | GitHub label  | Meaning                    |
| ------------------ | ------------- | -------------------------- |
| `bug`              | `bug`         | Existing behavior is wrong |
| `enhancement`      | `enhancement` | New behavior or improvement |

## Statuses

| Canonical status   | GitHub label       | Meaning                                   |
| ------------------ | ------------------ | ----------------------------------------- |
| `needs-triage`     | `needs-triage`     | Maintainer evaluation required            |
| `needs-info`       | `needs-info`       | Waiting for missing information           |
| `ready-for-agent`  | `ready-for-agent`  | Fully specified, ready for an AFK agent   |
| `ready-for-human`  | `ready-for-human`  | Requires human implementation or judgment |
| `wontfix`          | `wontfix`          | Deliberately not actioned                 |

## Project status

Linked Project `30` `Status` values:

| Workflow state | Project value | Option id  |
| -------------- | ------------- | ---------- |
| Queued         | Todo          | `f75ad846` |
| Active         | In Progress   | `47fc9ee4` |
| Finished       | Done          | `98236657` |

When a skill changes a role, update the GitHub label and local `Category:` or `Status:` field together. When work starts or finishes, update the Project item and local `Project status:` field together.

Local `Execution:` is separate from triage `Status:`. Use `queued`, `active`, `blocked`, or `finished`. Mirror the configured Project workflow value without replacing the triage label.

## Workflow labels

- `spec`: parent specification for implementation tickets.
- `wayfinder:map`: parent decision map.
- `wayfinder:research`: research decision ticket.
- `wayfinder:prototype`: prototype decision ticket.
- `wayfinder:grilling`: human decision ticket.
- `wayfinder:task`: prerequisite task for a later decision.
