"""Red tests for the approved G-LIN-02 2C rebuild kernel.

The tests use the internal four-argument ``KeywordRuleRebuild.execute``
contract only.  They do not exercise or change the pending public API
meaning of ``sourceDatasetId``.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from app.production_lineage import (
    KeywordRuleRebuild,
    KeywordRuleSnapshot,
    ProductionLineageError,
)
from app.repositories.artifact_repository import LocalArtifactRepository


def _plain(value):
    if isinstance(value, dict):
        return dict(value)
    if hasattr(value, "to_dict"):
        return value.to_dict()
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json", by_alias=True)
    raise TypeError(f"unsupported value: {type(value).__name__}")


def _field(value, name):
    if isinstance(value, dict):
        return value[name]
    return getattr(value, name)


def _sha256_bytes(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def _sha256_file(path: Path) -> str:
    return _sha256_bytes(path.read_bytes())


def _descriptor(pattern_hash="sha256:" + "1" * 64):
    return {
        "schemaVersion": "1.0",
        "mode": "keyword_analysis",
        "producerName": "deterministic_keyword",
        "implementationVersion": "2.0.0",
        "pipelineVersion": "2.0",
        "candidateSchemaVersion": "2.0",
        "ruleArtifacts": [
            {
                "name": "keyword-patterns",
                "version": "2026.08",
                "contentHash": pattern_hash,
            },
            {
                "name": "domain-glossary",
                "version": "2026.08",
                "contentHash": "sha256:" + "2" * 64,
            },
        ],
        "configurationHash": "sha256:" + "3" * 64,
        "inputContractVersion": "normalized-chunk:v1",
        "runtimeConfiguration": {"concurrency": 2, "logLevel": "info"},
    }


class _RuleExecutor:
    """Deterministic, model-free executor used as the kernel's rule boundary."""

    def __init__(self, extractor_version, snapshot_ref, *, delay=0.0, barrier=None):
        self.extractor_version = extractor_version
        self.snapshot_ref = dict(snapshot_ref)
        self.delay = delay
        self.barrier = barrier
        self.calls = 0
        self.model_calls = 0
        self._lock = threading.Lock()

    def __call__(self, *args, **kwargs):
        with self._lock:
            self.calls += 1
        if self.barrier is not None:
            try:
                self.barrier.wait(timeout=3)
            except threading.BrokenBarrierError as exc:
                raise AssertionError("不同 rebuildKey 的规则计算被全局锁串行化") from exc
        if self.delay:
            time.sleep(self.delay)

        inputs = next(
            (item for item in args if isinstance(item, (list, tuple))),
            None,
        )
        inputs = inputs or kwargs.get("verified_inputs") or kwargs.get("inputs") or []
        candidates = []
        for item in inputs:
            resource_id = str(item.get("resourceId") or item.get("resource_id") or "")
            candidates.append({
                "schemaVersion": "2.0",
                "candidateId": f"candidate:{resource_id}",
                "resourceId": resource_id,
                "chunkId": f"{resource_id}:0",
                "sourceMethod": "deterministic_keyword",
                "evidenceText": "事务",
                "extractorVersion": self.extractor_version,
                "extractorSnapshotRef": dict(self.snapshot_ref),
                "model": None,
                "modelStatus": "not_applicable",
            })
        return {
            "candidates": candidates,
            "isolatedCount": 0,
            "modelCallCount": self.model_calls,
            "modelCalls": self.model_calls,
        }


class _RebuildFixture:
    def __init__(self, root: Path, *, resource_texts=None, rule_descriptor=None):
        self.root = root
        self.repository = LocalArtifactRepository()
        self.resource_texts = resource_texts or {
            "resource-1": "事务提交与回滚。",
            "resource-2": "索引生成与查询。",
        }
        self.input_refs = []
        for index, (resource_id, text) in enumerate(self.resource_texts.items(), 1):
            self.input_refs.append(self._commit_input(resource_id, text, index))

        fingerprints = [
            {
                "resourceId": item["resourceId"],
                "algorithm": "sha256-v1",
                "digest": item["normalizedHash"].removeprefix("sha256:"),
                "byteLength": item["normalizedBytes"],
            }
            for item in self.input_refs
        ]
        self.rule_run_id = "rule-run-1"
        self.rule_root = self.root / "training-runs" / self.rule_run_id
        self.rule_ref = KeywordRuleSnapshot.commit(
            run_root=self.rule_root,
            run_id=self.rule_run_id,
            descriptor=rule_descriptor or _descriptor(),
            input_snapshot_fingerprints=fingerprints,
        )
        self.legacy_path = (
            self.root
            / "training-runs"
            / "legacy-run"
            / "extraction-results"
            / "keyword-candidates.jsonl"
        )
        self.legacy_path.parent.mkdir(parents=True, exist_ok=True)
        self.legacy_path.write_bytes(
            b'{"candidateId":"legacy-1","sourceMethod":"deterministic_keyword"}\n'
        )
        self.legacy_ref = {
            "runId": "legacy-run",
            "candidateVersionId": "legacy-version-1",
            "candidatePath": "training-runs/legacy-run/extraction-results/keyword-candidates.jsonl",
        }

    def _commit_input(self, resource_id: str, text: str, index: int):
        run_id = f"input-run-{index}"
        stage_root = self.root / "frozen-inputs" / run_id
        staging = self.repository.begin_snapshot(stage_root, run_id)
        normalized_path = staging / "normalized" / f"{resource_id}.md"
        processing_path = staging / "processing-units" / f"{resource_id}.jsonl"
        normalized_path.parent.mkdir(parents=True, exist_ok=True)
        processing_path.parent.mkdir(parents=True, exist_ok=True)
        normalized_bytes = text.encode("utf-8")
        normalized_path.write_bytes(normalized_bytes)
        processing_path.write_text(
            json.dumps(
                {
                    "chunkId": f"{resource_id}:0",
                    "resourceId": resource_id,
                    "content": text,
                },
                ensure_ascii=False,
            )
            + "\n",
            encoding="utf-8",
        )
        normalized_rel = f"normalized/{resource_id}.md"
        processing_rel = f"processing-units/{resource_id}.jsonl"
        snapshot_ref = self.repository.commit_snapshot(
            staging,
            batch_id="batch-test",
            stage="normalized",
            run_id=run_id,
            input_hash=_sha256_bytes(normalized_bytes),
            execution_hash=_sha256_bytes(normalized_bytes + b"|processing"),
            generation=1,
            artifact_paths=[normalized_rel, processing_rel],
            data_root=self.root,
            manifest_extra={"resourceId": resource_id},
        )
        ref = {
            "resourceId": resource_id,
            "snapshotRef": snapshot_ref.model_dump(mode="json", by_alias=True),
            "normalizedArtifactPath": normalized_rel,
            "processingUnitsArtifactPath": processing_rel,
            "normalizedHash": _sha256_bytes(normalized_bytes),
            "normalizedBytes": len(normalized_bytes),
        }
        return ref

    def source_refs(self):
        return deepcopy(self.input_refs)

    def executor(self, *, delay=0.0, barrier=None):
        return _RuleExecutor(
            self.rule_ref["extractorVersion"],
            self.rule_ref,
            delay=delay,
            barrier=barrier,
        )

    def rebuild(self, refs=None, *, executor=None, rule_ref=None, legacy_ref=None):
        with patch(
            "app.production_lineage.settings",
            SimpleNamespace(data_root=self.root),
            create=True,
        ):
            return KeywordRuleRebuild.execute(
                refs if refs is not None else self.source_refs(),
                rule_ref if rule_ref is not None else self.rule_ref,
                legacy_ref if legacy_ref is not None else self.legacy_ref,
                executor or self.executor(),
            )

    def rebuild_output_path(self, result):
        return (
            self.root
            / "training-runs"
            / str(_field(result, "rebuildRunId"))
            / "extraction-results"
            / "keyword-candidates.jsonl"
        )

    def rebuild_outputs(self):
        return [
            path
            for path in (self.root / "training-runs").glob(
                "*/extraction-results/keyword-candidates.jsonl"
            )
            if path != self.legacy_path
        ]


class KeywordRuleRebuildTests(unittest.TestCase):
    def _isolated(self, root: Path, **kwargs):
        return _RebuildFixture(root, **kwargs)

    def test_2c_t01_shuffled_inputs_have_same_key_candidates_order_and_fingerprint(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = self._isolated(root)
            first_executor = fixture.executor()
            first = fixture.rebuild(executor=first_executor)
            shuffled_executor = fixture.executor()
            shuffled = fixture.rebuild(
                refs=list(reversed(fixture.source_refs())),
                executor=shuffled_executor,
            )

            self.assertEqual(_field(first, "rebuildKey"), _field(shuffled, "rebuildKey"))
            self.assertEqual(
                _field(first, "candidateVersionId"),
                _field(shuffled, "candidateVersionId"),
            )
            self.assertEqual(
                _field(first, "resultFingerprint"),
                _field(shuffled, "resultFingerprint"),
            )
            self.assertEqual(first_executor.calls, 1)
            self.assertEqual(shuffled_executor.calls, 0)
            first_bytes = fixture.rebuild_output_path(first).read_bytes()
            shuffled_bytes = fixture.rebuild_output_path(shuffled).read_bytes()
            self.assertEqual(first_bytes, shuffled_bytes)
            ids = [json.loads(line)["candidateId"] for line in first_bytes.splitlines()]
            self.assertEqual(ids, sorted(ids))

    def test_2c_t02_input_hash_drift_blocks_and_valid_changed_snapshot_changes_key(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = self._isolated(root)
            legacy_bytes = fixture.legacy_path.read_bytes()
            original = fixture.source_refs()[0]
            normalized = (
                root
                / original["snapshotRef"]["manifestPath"]
            ).parent / original["normalizedArtifactPath"]
            normalized.write_text("篡改后的事务文档。", encoding="utf-8")
            with self.assertRaises(ProductionLineageError) as raised:
                fixture.rebuild(refs=fixture.source_refs())
            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")
            self.assertEqual(fixture.legacy_path.read_bytes(), legacy_bytes)

            changed = _RebuildFixture(
                root / "changed",
                resource_texts={
                    "resource-1": "事务提交与回滚。变化",
                    "resource-2": "索引生成与查询。",
                },
            )
            old = _RebuildFixture(root / "old")
            old_result = old.rebuild()
            changed_result = changed.rebuild()
            self.assertNotEqual(
                _field(old_result, "rebuildKey"),
                _field(changed_result, "rebuildKey"),
            )

    def test_2c_t03_eight_same_key_calls_commit_once_and_execute_rules_once(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = self._isolated(root)
            executor = fixture.executor(delay=0.05)

            def invoke(_):
                return fixture.rebuild(executor=executor)

            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(invoke, range(8)))

            self.assertEqual(executor.calls, 1)
            keys = {_field(result, "rebuildKey") for result in results}
            run_ids = {_field(result, "rebuildRunId") for result in results}
            self.assertEqual(len(keys), 1)
            self.assertEqual(len(run_ids), 1)
            output = fixture.rebuild_output_path(results[0])
            self.assertTrue(output.is_file())
            self.assertEqual(len(fixture.rebuild_outputs()), 1)

    def test_2c_t04_different_keys_reach_rule_executor_concurrently(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = self._isolated(root)
            barrier = threading.Barrier(2)
            executor = fixture.executor(barrier=barrier)
            first_refs = fixture.source_refs()
            second_refs = [fixture._commit_input("resource-3", "并发重建", 3)]

            errors = []

            def invoke(refs):
                try:
                    fixture.rebuild(refs=refs, executor=executor)
                except BaseException as exc:  # surface the barrier diagnostic
                    errors.append(exc)

            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(invoke, refs) for refs in (first_refs, second_refs)]
                for future in futures:
                    future.result(timeout=5)
            if errors:
                raise errors[0]
            self.assertEqual(executor.calls, 2)

    def test_2c_t05_tamper_symlink_path_escape_and_cross_run_rule_ref_fail_closed(self):
        mutations = ("artifact", "symlink", "path", "rule-run")
        for mutation in mutations:
            with self.subTest(mutation=mutation), TemporaryDirectory() as directory:
                root = Path(directory)
                fixture = self._isolated(root)
                refs = fixture.source_refs()
                rule_ref = fixture.rule_ref
                if mutation == "artifact":
                    path = (
                        root
                        / refs[0]["snapshotRef"]["manifestPath"]
                    ).parent / refs[0]["normalizedArtifactPath"]
                    path.write_text("tampered", encoding="utf-8")
                elif mutation == "symlink":
                    path = (
                        root
                        / refs[0]["snapshotRef"]["manifestPath"]
                    ).parent / refs[0]["normalizedArtifactPath"]
                    outside = root / "outside.md"
                    outside.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
                    path.unlink()
                    path.symlink_to(outside)
                elif mutation == "path":
                    refs[0]["normalizedArtifactPath"] = "../../outside.md"
                    (root / "outside.md").write_text("outside", encoding="utf-8")
                else:
                    bad_ref = dict(fixture.rule_ref)
                    bad_ref["runId"] = "another-rule-run"
                    rule_ref = bad_ref

                baseline = fixture.legacy_path.read_bytes()
                with self.assertRaises(ProductionLineageError) as raised:
                    fixture.rebuild(
                        refs=refs,
                        rule_ref=rule_ref,
                    )
                self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")
                self.assertEqual(fixture.legacy_path.read_bytes(), baseline)
                self.assertEqual(fixture.rebuild_outputs(), [])

    def test_2c_t06_failed_final_cas_leaves_no_partial_result_and_retry_is_safe(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = self._isolated(root)
            baseline = fixture.legacy_path.read_bytes()
            original_replace = os.replace

            def fail_rebuild_replace(source, target):
                if "rebuild" in str(target) or "rebuild" in str(source):
                    raise OSError("injected final CAS failure")
                return original_replace(source, target)

            with patch("app.production_lineage.os.replace", side_effect=fail_rebuild_replace):
                with self.assertRaises(ProductionLineageError) as raised:
                    fixture.rebuild()
            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")
            self.assertEqual(fixture.legacy_path.read_bytes(), baseline)
            self.assertEqual(
                fixture.rebuild_outputs(),
                [],
            )

            retry = fixture.rebuild()
            self.assertEqual(_field(retry, "state"), "completed")
            self.assertTrue(fixture.rebuild_output_path(retry).is_file())

    def test_2c_t07_new_run_candidate_version_and_rebuild_of_are_independent(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = self._isolated(root)
            legacy_run = fixture.legacy_ref["runId"]
            result = fixture.rebuild()
            result_dict = _plain(result)

            self.assertNotEqual(result_dict["rebuildRunId"], legacy_run)
            self.assertNotEqual(result_dict["candidateVersionId"], fixture.legacy_ref["candidateVersionId"])
            self.assertEqual(result_dict["rebuildOf"]["legacyRunId"], legacy_run)
            self.assertEqual(result_dict["rebuildOf"]["reason"], "extractor_version_unproven")
            self.assertEqual(result_dict["state"], "completed")
            self.assertEqual(
                result_dict["ruleSnapshotRef"]["runId"],
                result_dict["rebuildRunId"],
            )
            self.assertTrue(result_dict["sourceSnapshotFingerprints"])
            self.assertTrue(fixture.rebuild_output_path(result).is_file())

    def test_2c_t08_every_candidate_has_rule_evidence_and_model_calls_are_zero(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = self._isolated(root)
            executor = fixture.executor()
            result = fixture.rebuild(executor=executor)
            result_dict = _plain(result)
            rule_ref = result_dict["ruleSnapshotRef"]
            output = fixture.rebuild_output_path(result)
            candidates = [json.loads(line) for line in output.read_text(encoding="utf-8").splitlines()]

            self.assertTrue(candidates)
            self.assertEqual(rule_ref["runId"], result_dict["rebuildRunId"])
            self.assertEqual(_field(result, "candidateCount"), len(candidates))
            self.assertEqual(_field(result, "isolatedCount"), 0)
            self.assertEqual(executor.model_calls, 0)
            for candidate in candidates:
                self.assertEqual(candidate["schemaVersion"], "2.0")
                self.assertEqual(candidate["extractorVersion"], rule_ref["extractorVersion"])
                self.assertEqual(candidate["extractorSnapshotRef"], rule_ref)
                self.assertEqual(candidate["extractorSnapshotRef"]["runId"], result_dict["rebuildRunId"])
                self.assertIsNone(candidate["model"])
                self.assertEqual(candidate["modelStatus"], "not_applicable")

    def test_2c_t09_legacy_candidate_bytes_sha_and_mtime_are_unchanged(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = self._isolated(root)
            before_bytes = fixture.legacy_path.read_bytes()
            before_hash = _sha256_file(fixture.legacy_path)
            before_mtime_ns = fixture.legacy_path.stat().st_mtime_ns

            fixture.rebuild()

            self.assertEqual(fixture.legacy_path.read_bytes(), before_bytes)
            self.assertEqual(_sha256_file(fixture.legacy_path), before_hash)
            self.assertEqual(fixture.legacy_path.stat().st_mtime_ns, before_mtime_ns)
            self.assertTrue(fixture.legacy_path.is_file())


if __name__ == "__main__":
    unittest.main()
