"""G-LIN-02 rule snapshot and extractor-version contract tests.

These tests intentionally exclude the pending public API semantics for
``sourceDatasetId``.  They exercise only the approved 2A producer/resolver
contract and the rule-only portion of 2C.
"""

from __future__ import annotations

import hashlib
import json
import unittest
from collections.abc import Mapping
from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from app.models import TaskSnapshot
from app.production_lineage import (
    KeywordExtractorVersion,
    KeywordRuleSnapshot,
    ProductionLineageError,
)
from app.training_service import TrainingService, utcnow


def _field(value, name):
    if isinstance(value, Mapping):
        return value[name]
    return getattr(value, name)


def _plain(value):
    if isinstance(value, Mapping):
        return dict(value)
    if hasattr(value, "to_dict"):
        return value.to_dict()
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json", by_alias=True)
    raise TypeError(f"unsupported contract value: {type(value).__name__}")


def _digest(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def _under(root: Path, relative_path: str) -> Path:
    path = Path(relative_path)
    return path if path.is_absolute() else root / path


def _descriptor(*, pattern_hash="sha256:" + "1" * 64, concurrency=2, log_level="info"):
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
        "semanticConfiguration": {
            "titleTopicMaxCharacters": 40,
            "lowConfidenceThreshold": 0.65,
        },
        "runtimeConfiguration": {
            "concurrency": concurrency,
            "logLevel": log_level,
        },
        "inputContractVersion": "normalized-chunk:v1",
    }


def _input_fingerprints():
    return [
        {
            "resourceId": "resource-1",
            "algorithm": "sha256-v1",
            "digest": "a" * 64,
            "byteLength": 32,
        }
    ]


class KeywordRuleSnapshotContractTests(unittest.TestCase):
    def test_descriptor_version_is_stable_and_ignores_runtime_tuning(self):
        first = _descriptor(concurrency=1, log_level="debug")
        reordered = dict(reversed(list(_descriptor(concurrency=16, log_level="warn").items())))
        reordered["ruleArtifacts"] = list(reversed(reordered["ruleArtifacts"]))

        first_version = KeywordRuleSnapshot.extractor_version(first)
        repeated_version = KeywordRuleSnapshot.extractor_version(deepcopy(first))
        runtime_tuned_version = KeywordRuleSnapshot.extractor_version(reordered)

        self.assertEqual(first_version, repeated_version)
        self.assertEqual(first_version, runtime_tuned_version)
        self.assertRegex(first_version, r"^keyword-rule:v1:[0-9a-f]{64}$")

        semantic_change = _descriptor(pattern_hash="sha256:" + "3" * 64)
        self.assertNotEqual(
            first_version,
            KeywordRuleSnapshot.extractor_version(semantic_change),
        )

    def test_committed_snapshot_binds_artifact_manifest_and_commit_hashes(self):
        with TemporaryDirectory() as directory:
            run_root = Path(directory) / "training-run-1"
            reference = KeywordRuleSnapshot.commit(
                run_root=run_root,
                run_id="training-run-1",
                descriptor=_descriptor(),
                input_snapshot_fingerprints=_input_fingerprints(),
            )
            plain_ref = _plain(reference)
            artifact = _under(run_root, plain_ref["artifactPath"])
            manifest = _under(run_root, plain_ref["manifestPath"])
            commit = manifest.parent / "commit.json"

            self.assertTrue(artifact.is_file())
            self.assertTrue(manifest.is_file())
            self.assertTrue(commit.is_file())
            self.assertEqual(plain_ref["artifactHash"], _digest(artifact))
            self.assertEqual(plain_ref["manifestHash"], _digest(manifest))

            manifest_value = json.loads(manifest.read_text(encoding="utf-8"))
            commit_value = json.loads(commit.read_text(encoding="utf-8"))
            self.assertEqual(manifest_value["artifactHash"], plain_ref["artifactHash"])
            self.assertEqual(commit_value["manifestHash"], plain_ref["manifestHash"])

            verified = KeywordRuleSnapshot.verify(
                run_root=run_root,
                snapshot_ref=reference,
                expected_run_id="training-run-1",
            )
            self.assertEqual(_field(verified, "extractorVersion"), plain_ref["extractorVersion"])

    def test_snapshot_verification_fails_closed_for_path_symlink_cross_run_and_tamper(self):
        mutations = ("path", "symlink", "cross-run", "artifact", "manifest", "commit")
        for mutation in mutations:
            with self.subTest(mutation=mutation), TemporaryDirectory() as directory:
                root = Path(directory)
                run_root = root / "training-run-1"
                reference = KeywordRuleSnapshot.commit(
                    run_root=run_root,
                    run_id="training-run-1",
                    descriptor=_descriptor(),
                    input_snapshot_fingerprints=_input_fingerprints(),
                )
                plain_ref = _plain(reference)
                artifact = _under(run_root, plain_ref["artifactPath"])
                manifest = _under(run_root, plain_ref["manifestPath"])
                commit = manifest.parent / "commit.json"
                candidate_ref = deepcopy(plain_ref)
                expected_run_id = "training-run-1"

                if mutation == "path":
                    candidate_ref["artifactPath"] = "../outside.json"
                    (root / "outside.json").write_text("{}", encoding="utf-8")
                elif mutation == "symlink":
                    outside = root / "outside.json"
                    outside.write_text(artifact.read_text(encoding="utf-8"), encoding="utf-8")
                    artifact.unlink()
                    artifact.symlink_to(outside)
                elif mutation == "cross-run":
                    expected_run_id = "training-run-2"
                elif mutation == "artifact":
                    artifact.write_text('{"tampered":true}', encoding="utf-8")
                elif mutation == "manifest":
                    manifest.write_text('{"tampered":true}', encoding="utf-8")
                else:
                    commit.write_text('{"tampered":true}', encoding="utf-8")

                with self.assertRaises(ProductionLineageError) as raised:
                    KeywordRuleSnapshot.verify(
                        run_root=run_root,
                        snapshot_ref=candidate_ref,
                        expected_run_id=expected_run_id,
                    )
                self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")


class KeywordExtractorVersionResolutionTests(unittest.TestCase):
    def _commit(self, root: Path, run_id="training-run-1"):
        return KeywordRuleSnapshot.commit(
            run_root=root,
            run_id=run_id,
            descriptor=_descriptor(),
            input_snapshot_fingerprints=_input_fingerprints(),
        )

    def test_new_candidate_requires_exact_version_and_snapshot_reference(self):
        with TemporaryDirectory() as directory:
            run_root = Path(directory) / "training-run-1"
            reference = self._commit(run_root)
            candidate = {
                "schemaVersion": "2.0",
                "candidateId": "candidate-1",
                "sourceMethod": "deterministic_title_glossary",
                "extractorVersion": _field(reference, "extractorVersion"),
                "extractorSnapshotRef": _plain(reference),
                "chunkId": "resource-1:0",
                "evidenceText": "Replication",
            }

            resolved = KeywordExtractorVersion.resolve(
                candidate=candidate,
                candidate_run_id="training-run-1",
                run_root=run_root,
                committed_snapshot_ref=reference,
            )
            self.assertEqual(_field(resolved, "status"), "verified")
            self.assertEqual(
                _field(resolved, "extractorVersion"),
                candidate["extractorVersion"],
            )

            for field, bad_value in (
                ("extractorVersion", "keyword-rule:v1:" + "f" * 64),
                ("extractorSnapshotRef", {**_plain(reference), "artifactHash": "sha256:" + "f" * 64}),
            ):
                invalid = deepcopy(candidate)
                invalid[field] = bad_value
                with self.subTest(field=field), self.assertRaises(ProductionLineageError):
                    KeywordExtractorVersion.resolve(
                        candidate=invalid,
                        candidate_run_id="training-run-1",
                        run_root=run_root,
                        committed_snapshot_ref=reference,
                    )

    def test_legacy_only_uses_trusted_same_run_snapshot_and_never_mutates_record(self):
        legacy = {
            "candidateId": "legacy-1",
            "sourceMethod": "deterministic_title_glossary",
            "chunkId": "resource-1:0",
            "evidenceText": "Replication",
        }
        original = deepcopy(legacy)
        with TemporaryDirectory() as directory:
            run_root = Path(directory) / "training-run-1"
            reference = self._commit(run_root)

            verified = KeywordExtractorVersion.resolve(
                candidate=legacy,
                candidate_run_id="training-run-1",
                run_root=run_root,
                committed_snapshot_ref=reference,
            )
            self.assertEqual(_field(verified, "status"), "verified")
            self.assertEqual(
                _field(verified, "extractorVersion"),
                _field(reference, "extractorVersion"),
            )
            self.assertEqual(legacy, original)

            for snapshot_ref, run_id in ((None, "training-run-1"), (reference, "other-run")):
                with self.subTest(snapshot=bool(snapshot_ref), run_id=run_id):
                    isolated = KeywordExtractorVersion.resolve(
                        candidate=legacy,
                        candidate_run_id=run_id,
                        run_root=run_root,
                        committed_snapshot_ref=snapshot_ref,
                    )
                    self.assertEqual(_field(isolated, "status"), "isolated")
                    self.assertEqual(
                        _field(isolated, "reasonCode"),
                        "LEGACY_EXTRACTOR_VERSION_UNPROVEN",
                    )
                    self.assertEqual(legacy, original)


class _Events:
    def __init__(self):
        self.items = []

    def publish_event(self, task_id, event_name, data):
        self.items.append((task_id, event_name, data))


class _Tasks:
    def __init__(self, task):
        self.task = task
        self.events = _Events()

    def get(self, task_id):
        if task_id != self.task.id:
            raise KeyError(task_id)
        return self.task

    def _update(self, task_id, **changes):
        self.get(task_id)
        self.task = self.task.model_copy(update={**changes, "updated_at": utcnow()})
        return self.task


class _Batches:
    def __init__(self):
        self.batch = SimpleNamespace(id="batch-test", state="downloaded", active_task_ids=[])

    def get(self, batch_id):
        if batch_id != self.batch.id:
            raise KeyError(batch_id)
        return self.batch


class _NoModelGateway:
    def __init__(self):
        self.calls = []

    def _fail(self, operation):
        self.calls.append(operation)
        raise AssertionError(f"rule-only extraction called model gateway: {operation}")

    def status(self):
        return self._fail("status")

    def test(self):
        return self._fail("test")

    def chat_json(self, messages, options):
        return self._fail("chat_json")


class KeywordProducerContractTests(unittest.TestCase):
    def _service(self, gateway, metadata):
        now = utcnow()
        task = TaskSnapshot(
            id="training-rule-version",
            batch_id="batch-test",
            type="graph",
            state="running",
            stage="knowledge_extraction",
            total=1,
            created_at=now,
            updated_at=now,
        )
        return TrainingService(
            None,
            _Batches(),
            _Tasks(task),
            None,
            None,
            metadata_construction=metadata,
            gateway=gateway,
        )

    @staticmethod
    def _inputs():
        chunks = [
            {
                "id": "resource-1:0",
                "chunkId": "resource-1:0",
                "resourceId": "resource-1",
                "chunkIndex": 0,
                "sourcePath": "docs/replication.md",
                "headingPath": ["Replication"],
                "content": "Replication 负责复制日志。",
            }
        ]
        documents = [
            {
                "resourceId": "resource-1",
                "title": "Replication",
                "semanticTitle": "Replication",
                "contentHash": "a" * 64,
                "domainTerms": [
                    {
                        "termId": "database.feature.replication",
                        "canonicalName": "Replication",
                        "aliases": ["Replication"],
                        "matchedAliases": ["Replication"],
                        "category": "数据库特性",
                    }
                ],
            }
        ]
        return chunks, documents

    def test_rule_only_producer_commits_snapshot_and_versions_every_candidate(self):
        with TemporaryDirectory() as directory:
            run_dir = Path(directory) / "training-rule-version"
            gateway = _NoModelGateway()
            metadata = SimpleNamespace(
                rule_set_hash="rules-v1",
                rules={
                    "titleCleaning": {"titleGlossaryConfidence": 0.9},
                    "stopwords": set(),
                    "glossaries": {},
                },
            )
            service = self._service(gateway, metadata)
            chunks, documents = self._inputs()

            candidates, issues, calls = service._extract_keyword_analysis(
                service.tasks.task.id,
                chunks,
                documents,
                run_dir,
                {"succeeded": 0, "failed": 0, "skipped": 0},
            )

            self.assertTrue(candidates)
            self.assertEqual(issues, [])
            self.assertEqual(gateway.calls, [])
            self.assertEqual(calls, {"succeeded": 0, "failed": 0, "skipped": 0})
            persisted = service._read_jsonl(
                run_dir / "extraction-results/keyword-candidates.jsonl"
            )
            self.assertEqual(persisted, candidates)

            for candidate in candidates:
                self.assertEqual(candidate["schemaVersion"], "2.0")
                self.assertRegex(
                    candidate["extractorVersion"],
                    r"^keyword-rule:v1:[0-9a-f]{64}$",
                )
                self.assertEqual(candidate["model"], None)
                self.assertEqual(candidate["modelStatus"], "not_applicable")
                reference = candidate["extractorSnapshotRef"]
                self.assertEqual(reference["runId"], service.tasks.task.id)
                verified = KeywordRuleSnapshot.verify(
                    run_root=run_dir,
                    snapshot_ref=reference,
                    expected_run_id=service.tasks.task.id,
                )
                self.assertEqual(
                    candidate["extractorVersion"],
                    _field(verified, "extractorVersion"),
                )

    def test_same_rule_and_input_produce_identical_candidates(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            metadata = SimpleNamespace(
                rule_set_hash="rules-v1",
                rules={
                    "titleCleaning": {"titleGlossaryConfidence": 0.9},
                    "stopwords": set(),
                    "glossaries": {},
                },
            )
            first_service = self._service(_NoModelGateway(), metadata)
            second_service = self._service(_NoModelGateway(), deepcopy(metadata))
            chunks, documents = self._inputs()

            first, _, _ = first_service._extract_keyword_analysis(
                first_service.tasks.task.id,
                deepcopy(chunks),
                deepcopy(documents),
                root / "first" / "training-rule-version",
            )
            second, _, _ = second_service._extract_keyword_analysis(
                second_service.tasks.task.id,
                deepcopy(chunks),
                deepcopy(documents),
                root / "second" / "training-rule-version",
            )

            self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
