"""Contract red tests for the G-LIN-02 2C rebuild kernel.

These tests deliberately stay below the public training API.  They exercise
the internal rebuild boundary with an already committed input fixture and
make the missing same-run, provenance, context, and recovery guarantees
visible before the backend implementation is changed.
"""

from __future__ import annotations

import hashlib
import inspect
import json
import time
import unittest
from collections.abc import Mapping
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from app import production_lineage as production_lineage_module
from app.production_lineage import KeywordRuleRebuild, ProductionLineageError
from tests.test_keyword_rule_rebuild import _RebuildFixture, _descriptor, _plain


def _input_digest(dataset_id: str, refs: list[dict]) -> str:
    """Build a stable fixture digest without depending on temporary paths."""

    facts = [
        {
            "datasetId": dataset_id,
            "resourceId": ref["resourceId"],
            "normalizedHash": ref["normalizedHash"],
            "normalizedBytes": ref["normalizedBytes"],
        }
        for ref in refs
    ]
    payload = json.dumps(
        sorted(facts, key=lambda item: item["resourceId"]),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def _contract_inputs(fixture: _RebuildFixture, task_id: str):
    """Attach the source identity that API-A must carry into the kernel."""

    dataset_id = "dataset-contract"
    refs = fixture.source_refs()
    for ref in refs:
        ref["datasetId"] = dataset_id
    return refs, {
        "datasetId": dataset_id,
        "taskId": task_id,
        "inputDigest": _input_digest(dataset_id, refs),
    }


def _context_value(context, *names):
    for name in names:
        if isinstance(context, Mapping) and name in context:
            return context[name]
        if hasattr(context, name):
            return getattr(context, name)
    for name in names:
        snake = []
        for char in name:
            if char.isupper():
                snake.append("_" + char.lower())
            else:
                snake.append(char)
        value = "".join(snake)
        if hasattr(context, value):
            return getattr(context, value)
    return None


class _ContractExecutor:
    """Executor that exposes whether the kernel supplied immutable context."""

    def __init__(self, fixture: _RebuildFixture, *, outer_task_id=None, model_calls=0):
        self.fixture = fixture
        self.outer_task_id = outer_task_id
        self.model_calls = model_calls
        self.calls = 0
        self.contexts = []
        self.context_was_mutable = False

    def __call__(self, records, context=None):
        self.calls += 1
        self.contexts.append(context)

        if context is None:
            rule_ref = self.fixture.rule_ref
            # The legacy call shape has no context boundary.  Deliberately
            # include the outer task only in this fallback so the stability
            # test catches kernels that leak task identity to the executor.
            candidate_prefix = self.outer_task_id or "legacy"
        else:
            rule_ref = _context_value(context, "ruleSnapshotRef", "rule_snapshot_ref")
            if not isinstance(rule_ref, Mapping):
                rule_ref = self.fixture.rule_ref
            candidate_prefix = "context"
            rebuild_run_id = _context_value(context, "rebuildRunId", "rebuild_run_id")
            candidate_version_id = _context_value(
                context, "candidateVersionId", "candidate_version_id"
            )
            rebuild_key = _context_value(context, "rebuildKey", "rebuild_key")
            model_allowed = _context_value(context, "modelAllowed", "model_allowed")
            self.context_fields = {
                "rebuildRunId": rebuild_run_id,
                "candidateVersionId": candidate_version_id,
                "rebuildKey": rebuild_key,
                "ruleSnapshotRef": rule_ref,
                "modelAllowed": model_allowed,
            }
            # RebuildExecutionContext is a read-only value object.  A mutable
            # dict or a non-frozen object is a contract failure, not a fixture
            # failure, so record it for the assertion below.
            try:
                if isinstance(context, Mapping):
                    context["rebuildRunId"] = rebuild_run_id
                else:
                    setattr(context, "rebuildRunId", rebuild_run_id)
            except (AttributeError, TypeError, ValueError):
                pass
            else:
                self.context_was_mutable = True

        candidates = []
        for record in records:
            resource_id = str(record.get("resourceId") or record.get("resource_id") or "")
            candidate_id = f"candidate:{candidate_prefix}:{resource_id}"
            candidates.append(
                {
                    "schemaVersion": "2.0",
                    "candidateId": candidate_id,
                    "resourceId": resource_id,
                    "chunkId": f"{resource_id}:0",
                    "sourceMethod": "deterministic_keyword",
                    "evidenceText": "rule evidence",
                    "extractorVersion": rule_ref["extractorVersion"],
                    "extractorSnapshotRef": dict(rule_ref),
                    "model": None,
                    "modelStatus": "not_applicable",
                }
            )
        return {
            "candidates": candidates,
            "isolated": [],
            "modelCallCount": self.model_calls,
            "modelStatus": "not_applicable",
        }


class _SimulatedProcessCrash(BaseException):
    """Models a process exit after final rename and before reservation CAS."""


class KeywordRuleRebuildContractTests(unittest.TestCase):
    def _run(self, fixture, refs, rebuild_of, executor=None):
        executor = executor or _ContractExecutor(fixture)
        parameters = inspect.signature(KeywordRuleRebuild.execute).parameters
        descriptor_contract = (
            hasattr(production_lineage_module, "RebuildExecutionContext")
            or "rule_descriptor" in parameters
            or "rebuild_of" in parameters
        )
        if descriptor_contract:
            # Once KRN-BE-02 exposes the approved descriptor/context boundary,
            # use it directly.  The current implementation has no such
            # symbol, so it continues through the legacy-compatible fixture
            # path and produces specific red assertions below.
            with patch(
                "app.production_lineage.settings",
                SimpleNamespace(data_root=fixture.root),
                create=True,
            ):
                return KeywordRuleRebuild.execute(
                    refs,
                    _descriptor(),
                    rebuild_of,
                    executor,
                )
        return fixture.rebuild(refs=refs, legacy_ref=rebuild_of, executor=executor)

    @staticmethod
    def _candidates(fixture, result):
        output = fixture.rebuild_output_path(result)
        return [
            json.loads(line)
            for line in output.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]

    def test_candidate_rule_evidence_is_committed_in_rebuild_run(self):
        with TemporaryDirectory() as directory:
            fixture = _RebuildFixture(Path(directory))
            refs, rebuild_of = _contract_inputs(fixture, "source-task-a")
            result = self._run(fixture, refs, rebuild_of)
            result_dict = _plain(result)
            rebuild_run_id = result_dict["rebuildRunId"]
            rule_ref = result_dict["ruleSnapshotRef"]

            self.assertEqual(rule_ref["runId"], rebuild_run_id)
            run_root = Path(directory) / "training-runs" / rebuild_run_id
            self.assertTrue((run_root / rule_ref["manifestPath"]).is_file())
            self.assertTrue((run_root / rule_ref["artifactPath"]).is_file())
            for candidate in self._candidates(fixture, result):
                self.assertEqual(candidate["extractorVersion"], rule_ref["extractorVersion"])
                self.assertEqual(candidate["extractorSnapshotRef"], rule_ref)
                self.assertEqual(candidate["extractorSnapshotRef"]["runId"], rebuild_run_id)

    def test_rebuild_of_has_dataset_task_and_input_digest(self):
        with TemporaryDirectory() as directory:
            fixture = _RebuildFixture(Path(directory))
            refs, rebuild_of = _contract_inputs(fixture, "source-task-a")
            result = self._run(fixture, refs, rebuild_of)
            self.assertEqual(_plain(result)["rebuildOf"], rebuild_of)

    def test_candidate_ids_do_not_depend_on_outer_task_identity(self):
        with TemporaryDirectory() as directory:
            first_fixture = _RebuildFixture(Path(directory) / "first")
            second_fixture = _RebuildFixture(Path(directory) / "second")
            first_refs, first_rebuild_of = _contract_inputs(first_fixture, "source-task-a")
            second_refs, second_rebuild_of = _contract_inputs(second_fixture, "source-task-b")
            first_executor = _ContractExecutor(first_fixture, outer_task_id="source-task-a")
            second_executor = _ContractExecutor(second_fixture, outer_task_id="source-task-b")

            first = self._run(first_fixture, first_refs, first_rebuild_of, first_executor)
            second = self._run(second_fixture, second_refs, second_rebuild_of, second_executor)
            first_ids = [item["candidateId"] for item in self._candidates(first_fixture, first)]
            second_ids = [item["candidateId"] for item in self._candidates(second_fixture, second)]

            self.assertEqual(first_ids, second_ids)
            self.assertEqual(
                _plain(first)["candidateVersionId"],
                _plain(second)["candidateVersionId"],
            )

    def test_executor_receives_read_only_rebuild_context(self):
        with TemporaryDirectory() as directory:
            fixture = _RebuildFixture(Path(directory))
            refs, rebuild_of = _contract_inputs(fixture, "source-task-a")
            executor = _ContractExecutor(fixture)
            result = self._run(fixture, refs, rebuild_of, executor)

            self.assertIsNotNone(result)
            self.assertEqual(len(executor.contexts), 1)
            context = executor.contexts[0]
            self.assertIsNotNone(context)
            self.assertTrue(executor.context_fields["rebuildRunId"])
            self.assertTrue(executor.context_fields["candidateVersionId"])
            self.assertTrue(executor.context_fields["rebuildKey"])
            self.assertIsInstance(executor.context_fields["ruleSnapshotRef"], Mapping)
            self.assertFalse(executor.context_fields["modelAllowed"])
            self.assertFalse(executor.context_was_mutable)

    def test_rename_before_reservation_completion_is_adopted_on_retry(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = _RebuildFixture(root)
            refs, rebuild_of = _contract_inputs(fixture, "source-task-a")
            first_executor = _ContractExecutor(fixture)

            with patch.object(
                KeywordRuleRebuild,
                "_complete",
                side_effect=_SimulatedProcessCrash(),
            ):
                with self.assertRaises(_SimulatedProcessCrash):
                    self._run(fixture, refs, rebuild_of, first_executor)

            reservation_files = list((root / KeywordRuleRebuild._RESERVATION_DIR).glob("*.json"))
            self.assertEqual(len(reservation_files), 1)
            state = json.loads(reservation_files[0].read_text(encoding="utf-8"))
            self.assertEqual(state["state"], "running")
            final_root = root / "training-runs" / state["rebuildRunId"]
            self.assertTrue((final_root / "result.json").is_file())

            retry_executor = _ContractExecutor(fixture)
            with patch.object(KeywordRuleRebuild, "_TIMEOUT_SECONDS", 0.2), patch.object(
                KeywordRuleRebuild, "_POLL_INTERVAL", 0.005
            ):
                try:
                    retry = self._run(fixture, refs, rebuild_of, retry_executor)
                except ProductionLineageError as exc:
                    self.fail(
                        "rename 后已有 final run 时未能接管 reservation: "
                        f"{exc.code}: {exc}"
                    )
            self.assertEqual(_plain(retry)["state"], "completed")
            self.assertEqual(_plain(retry)["rebuildRunId"], state["rebuildRunId"])
            self.assertEqual(retry_executor.calls, 0)

    def test_stale_running_reservation_has_bounded_single_worker_takeover(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = _RebuildFixture(root)
            refs, rebuild_of = _contract_inputs(fixture, "source-task-a")

            def crash_after_reservation(_records, _context=None):
                raise _SimulatedProcessCrash()

            with self.assertRaises(_SimulatedProcessCrash):
                self._run(fixture, refs, rebuild_of, crash_after_reservation)

            reservation_files = list((root / KeywordRuleRebuild._RESERVATION_DIR).glob("*.json"))
            self.assertEqual(len(reservation_files), 1)
            state_path = reservation_files[0]
            state = json.loads(state_path.read_text(encoding="utf-8"))
            self.assertEqual(state["state"], "running")
            stale_at = time.time() - 3600
            state.update(
                {
                    "startedAt": stale_at,
                    "heartbeatAt": stale_at,
                    "updatedAt": stale_at,
                    "leaseExpiresAt": stale_at,
                }
            )
            state_path.write_text(
                json.dumps(state, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                encoding="utf-8",
            )

            takeover_executor = _ContractExecutor(fixture)
            with patch.object(KeywordRuleRebuild, "_TIMEOUT_SECONDS", 0.2), patch.object(
                KeywordRuleRebuild, "_POLL_INTERVAL", 0.005
            ):
                try:
                    result = self._run(fixture, refs, rebuild_of, takeover_executor)
                except ProductionLineageError as exc:
                    self.fail(
                        "stale running reservation 未在租约到期后有界接管: "
                        f"{exc.code}: {exc}"
                    )
            self.assertEqual(_plain(result)["state"], "completed")
            self.assertEqual(takeover_executor.calls, 1)

    def test_nonzero_model_calls_publish_no_candidate_result(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = _RebuildFixture(root)
            refs, rebuild_of = _contract_inputs(fixture, "source-task-a")
            executor = _ContractExecutor(fixture, model_calls=1)

            with self.assertRaises(ProductionLineageError) as raised:
                self._run(fixture, refs, rebuild_of, executor)
            self.assertEqual(raised.exception.code, "RULE_ONLY_CONTRACT_VIOLATION")
            self.assertEqual(fixture.rebuild_outputs(), [])
            self.assertFalse(list((root / "training-runs").glob("rebuild_*/result.json")))
            reservation_files = list((root / KeywordRuleRebuild._RESERVATION_DIR).glob("*.json"))
            self.assertEqual(len(reservation_files), 1)
            self.assertEqual(
                json.loads(reservation_files[0].read_text(encoding="utf-8"))["state"],
                "failed",
            )


if __name__ == "__main__":
    unittest.main()
