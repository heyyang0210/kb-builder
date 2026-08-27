# Reconciliation Rules

## Evidence priority

Use evidence in this order:

1. Explicit user decision or approved requirement/ADR.
2. Approved design and acceptance criteria.
3. Task records containing reason, owner, and traceability.
4. Current implementation and configuration.
5. Real verification evidence.
6. Commit messages and naming conventions as clues only.

Never resolve a conflict by silently preferring lower-priority evidence.

## Three-way comparison

- Baseline: the last explicitly confirmed successful audit commit and its reports.
- Intent: requirements, decisions, task cards, acceptance criteria, and recorded change reasons.
- Evidence: code, configuration, API contracts, tests, and real validation results at `runStartHead`.

The frozen target is `runStartHead`. Ignore commits created after the run starts. Record dirty-worktree files as `preExisting` and do not infer their owner or reason.

## State rules

| State | Meaning | Allowed action |
|---|---|---|
| `ALIGNED` | Intent, implementation, verification, and docs are consistent | Keep unchanged |
| `UPDATE_CANDIDATE` | Intent and verified implementation agree, but docs appear stale | Draft an evidence-linked update |
| `TARGET_NOT_IMPLEMENTED` | Approved target exists without implementation evidence | Update plan/progress only |
| `UNVERIFIED_IMPLEMENTATION` | Implementation exists without adequate verification | Record risk; do not claim verified |
| `NEEDS_CONFIRMATION` | Business meaning or authority cannot be established | Stop formal edits and ask grouped questions |

## Mandatory confirmation

Require confirmation for:

- no baseline or a baseline that is not an ancestor of `runStartHead`;
- implementation/configuration change without intent evidence;
- conflicts among requirements, implementation, documentation, or verification;
- public API, persistence contract, security boundary, or module-boundary changes;
- changing a target-state design into a current-state claim;
- moving, renaming, archiving, or deleting documents;
- validation evidence that contradicts acceptance criteria.

Record each answer with question ID, decision, reason, operator, and timestamp. Unanswered questions remain blocking.

## Update discipline

Keep source facts and interpretation separate. Link every proposed statement to file paths and commits. Prefer minimal document changes. Preserve historical decisions and mark superseded content explicitly rather than rewriting history. Never advance the checkpoint after a failed, incomplete, or unconfirmed audit.
