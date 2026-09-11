# Output Contracts

## Governance configuration

`.codex/config/doc-governance.json` uses `doc-governance/v1`. It defines context and audit roots, inventory include/exclude globs, module-specific code/document/intent/verification globs, public-contract globs, structural invalidators, and required document metadata.

All paths are repository-relative POSIX paths. Glob matching supports `*`, `?`, character classes, and recursive `**` patterns through Python `pathlib` and `fnmatch` behavior.

## Context files

- `snapshot.json`: frozen HEAD, policy digest, tracked inventory, module mapping, and startup worktree state.
- `checkpoint.json`: last successful ref, policy digest, audit path, rule version, and confirmation time.
- `change-ledger.jsonl`: append-only refresh summaries; it does not establish business intent.

## Audit directory

Each audit directory contains:

- `change-context.json`: run ID, mode, refs, committed changes, pre-existing changes, module evidence, states, and questions.
- `impact-report.md`: Chinese human-readable impact summary.
- `verification-report.md`: validation status, checks, blockers, and timestamp.
- `audit-manifest.json`: artifact hashes and frozen run metadata.

`NEEDS_CONFIRMATION` questions use stable IDs derived from type, module, and evidence paths. `answer` records decision, reason, operator, and UTC timestamp in `change-context.json`; `defer` remains open. An audit is checkpoint-eligible only when validation passes and no unresolved blocking question remains.

## Exit codes

- `0`: command completed and produced a usable result.
- `2`: readiness or audit requires confirmation or bootstrap.
- `3`: configuration or input contract error.
- `4`: validation failed or checkpoint conditions were not met.

Commands always print a JSON summary to stdout so callers can locate artifacts without parsing human reports.
