---
name: reconcile-docs
description: Periodically reconcile repository requirements, designs, implementation, tests, and documentation against the last successful Git snapshot. Use when auditing documentation drift after merges, during weekly governance, before releases, after architecture or public API changes, or when updating documents from code changes without losing the original business intent.
---

# Periodic Documentation Reconciliation

Use an evidence-driven three-way comparison: approved baseline, recorded business intent, and current implementation plus verification evidence. Never treat model knowledge, commit messages, or current code alone as approved business truth.

## Workflow

1. Read the repository `AGENTS.md` and `.codex/config/doc-governance.json`.
2. Run `readiness` before collecting evidence. Freeze the reported `runStartHead` for the entire run.
3. Run `refresh` after merges to update the project snapshot. Treat every dirty-worktree entry captured at startup as `preExisting`; do not attribute it to the audit.
4. Run `audit --mode incremental` for routine audits or `audit --mode full` before releases and after structural invalidation.
5. Read `knowledge/references/reconciliation-rules.md` before interpreting the machine report. Read `knowledge/references/output-contracts.md` before editing or validating generated artifacts.
6. Group unresolved questions by business decision. Ask the user only when evidence cannot establish intent, ownership, public-contract meaning, deletion or movement approval, or acceptance semantics.
7. Record each answer with `answer --run-dir <path> --question-id <id> --decision <accept|reject|defer> --reason <text> --operator <name>`; `defer` remains blocking.
8. Apply only confirmed documentation changes. Do not modify business code, approve architecture, commit changes, or move/delete documents automatically.
9. Run repository-specific validation, then `validate --run-dir <path>`.
10. Run `checkpoint --run-dir <path> --confirmed` only after explicit user confirmation and successful validation.

## Commands

```bash
python3 knowledge/skills/reconcile-docs/scripts/reconcile_docs.py readiness
python3 knowledge/skills/reconcile-docs/scripts/reconcile_docs.py refresh
python3 knowledge/skills/reconcile-docs/scripts/reconcile_docs.py audit --mode incremental
python3 knowledge/skills/reconcile-docs/scripts/reconcile_docs.py audit --mode full
python3 knowledge/skills/reconcile-docs/scripts/reconcile_docs.py answer --run-dir <path> --question-id <id> --decision accept --reason "已确认业务原因" --operator "<name>"
python3 knowledge/skills/reconcile-docs/scripts/reconcile_docs.py validate --run-dir <path>
python3 knowledge/skills/reconcile-docs/scripts/reconcile_docs.py checkpoint --run-dir <path> --confirmed
python3 knowledge/skills/reconcile-docs/scripts/reconcile_docs.py selftest
```

Use `--repo`, `--config`, `--context-root`, and `--output` to override project defaults. The scripts require only Python 3 and Git.

## Decision Gates

Keep formal documents unchanged and request confirmation when the report contains `NEEDS_CONFIRMATION`. This includes a missing or non-ancestor baseline, behavior changes without a recorded business reason, requirements/code/docs conflicts, public API or module-boundary changes, converting target design into claimed current behavior, moving or deleting documents, and verification contradicting acceptance criteria.

Treat `TARGET_NOT_IMPLEMENTED` as planned behavior, never current capability. Treat `UNVERIFIED_IMPLEMENTATION` as a risk, never verified behavior. Treat `UPDATE_CANDIDATE` as a draft opportunity that still requires evidence review before editing.

## Reusable Resources

- `scripts/reconcile_docs.py`: deterministic CLI for readiness, snapshots, audits, validation, checkpoints, and self-test.
- `knowledge/references/reconciliation-rules.md`: evidence hierarchy, state rules, and confirmation policy.
- `knowledge/references/output-contracts.md`: configuration and artifact schemas.
- `assets/*.template.*`: starting points for governance policy, change context, impact reports, and verification reports.

Keep project-specific paths and module mappings in `.codex/config/doc-governance.json`; do not add repository-specific rules to this Skill.
