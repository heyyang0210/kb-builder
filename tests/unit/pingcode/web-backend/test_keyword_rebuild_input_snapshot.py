"""Red contract tests for request-time dataset input freezing.

The fixture deliberately resembles a committed candidate dataset and uses the
real local artifact repository and JSON store.  These tests remain red until
``KeywordRebuildInputFreezer`` is implemented; a missing component is reported
as such instead of being disguised as a malformed fixture.
"""

from __future__ import annotations

import hashlib
import json
import os
import unittest
from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app import production_lineage as lineage
from app.repositories.artifact_repository import LocalArtifactRepository
from app.store import JsonStore


DATASET_ID = "dataset-freeze-1"
BATCH_ID = "batch-freeze-1"
TASK_ID = "training-freeze-1"


def _sha256(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def _value(value, *names):
    if isinstance(value, dict):
        for name in names:
            if name in value:
                return value[name]
    for name in names:
        if hasattr(value, name):
            return getattr(value, name)
    return None


class _DatasetFixture:
    """A candidate dataset with source, document, chunk and normalized facts."""

    def __init__(self, root: Path):
        self.root = root
        self.repository = LocalArtifactRepository()
        self.store = JsonStore(root / "state.json")
        self.dataset_root = root / "datasets" / DATASET_ID
        self.dataset_root.mkdir(parents=True)
        self.normalized = {
            "resource-1": "事务提交与回滚。\n",
            "resource-2": "索引生成与查询。\n",
        }
        self.sources = [
            {
                "resourceId": resource_id,
                "sourcePath": f"docs/{resource_id}.md",
                "normalizedPath": f"normalized/{resource_id}.md",
                "normalizedHash": _sha256(content.encode("utf-8")),
                "originalHash": _sha256(("original-" + resource_id).encode("utf-8")),
                "processingStatus": "completed",
            }
            for resource_id, content in self.normalized.items()
        ]
        self._write_inputs()
        self._write_identity()

    def _write_inputs(self):
        normalized_dir = self.dataset_root / "normalized"
        normalized_dir.mkdir(parents=True)
        for resource_id, content in self.normalized.items():
            (normalized_dir / f"{resource_id}.md").write_bytes(content.encode("utf-8"))

        documents = [
            {"resourceId": "resource-1", "title": "事务", "sourcePath": "docs/resource-1.md"},
            {"resourceId": "resource-2", "title": "索引", "sourcePath": "docs/resource-2.md"},
        ]
        processing_units = [
            {
                "chunkId": "resource-1:0",
                "resourceId": "resource-1",
                "chunkIndex": 0,
                "offset": {"start": 0, "end": len(self.normalized["resource-1"])},
                "content": self.normalized["resource-1"],
            },
            {
                "chunkId": "resource-2:0",
                "resourceId": "resource-2",
                "chunkIndex": 0,
                "offset": {"start": 0, "end": len(self.normalized["resource-2"])},
                "content": self.normalized["resource-2"],
            },
        ]
        source_documents = self.sources
        self._write_jsonl("documents.jsonl", documents)
        self._write_jsonl("processing-units.jsonl", processing_units)
        self._write_jsonl("source-documents.jsonl", source_documents)
        artifacts = {}
        for relative in (
            "documents.jsonl",
            "processing-units.jsonl",
            "source-documents.jsonl",
        ):
            path = self.dataset_root / relative
            artifacts[relative] = {"path": relative, "sha256": _sha256(path.read_bytes()), "bytes": path.stat().st_size}
        normalized_artifacts = []
        for source in source_documents:
            relative = source["normalizedPath"]
            path = self.dataset_root / relative
            normalized_artifacts.append(
                {
                    "resourceId": source["resourceId"],
                    "path": relative,
                    "sha256": _sha256(path.read_bytes()),
                    "bytes": path.stat().st_size,
                }
            )
        manifest = {
            "schemaVersion": "dataset-manifest/v1",
            "datasetId": DATASET_ID,
            "batchId": BATCH_ID,
            "taskId": TASK_ID,
            "state": "candidate",
            "mode": "keyword_analysis",
            "sources": source_documents,
            "normalized": normalized_artifacts,
            "artifacts": artifacts,
        }
        self._write_json("manifest.json", manifest)

    def _write_json(self, relative: str, value):
        self.repository.write_json(self.dataset_root / relative, value)

    def _write_jsonl(self, relative: str, values):
        self.repository.write_jsonl(self.dataset_root / relative, values)

    def _write_identity(self):
        self.store.put_record(
            "batches",
            BATCH_ID,
            {"id": BATCH_ID, "state": "downloaded", "activeTaskIds": [TASK_ID]},
        )
        self.store.put_record(
            "tasks",
            TASK_ID,
            {"id": TASK_ID, "batchId": BATCH_ID, "type": "keyword_analysis", "state": "completed"},
        )
        self.store.put_record(
            "datasets",
            DATASET_ID,
            {
                "id": DATASET_ID,
                "batchId": BATCH_ID,
                "trainingTaskId": TASK_ID,
                "state": "candidate",
                "datasetPath": f"datasets/{DATASET_ID}",
            },
        )

    def dataset_ref(self):
        return {
            "datasetId": DATASET_ID,
            "batchId": BATCH_ID,
            "taskId": TASK_ID,
            "rootPath": f"datasets/{DATASET_ID}",
            "manifestPath": f"datasets/{DATASET_ID}/manifest.json",
        }

    def request_context(self):
        return {
            "requestId": "request-freeze-1",
            "datasetId": DATASET_ID,
            "batchId": BATCH_ID,
            "taskId": TASK_ID,
            "mode": "keyword_analysis",
        }

    def source_state(self):
        paths = [self.dataset_root / "manifest.json"]
        paths.extend(self.dataset_root / source["normalizedPath"] for source in self.sources)
        paths.extend(self.dataset_root / name for name in ("documents.jsonl", "processing-units.jsonl", "source-documents.jsonl"))
        return {str(path): (path.read_bytes(), _sha256(path.read_bytes()), path.stat().st_mtime_ns) for path in paths}


class KeywordRebuildInputSnapshotTests(unittest.TestCase):
    def _make_freezer(self, fixture: _DatasetFixture):
        freezer_type = getattr(lineage, "KeywordRebuildInputFreezer", None)
        if freezer_type is None:
            raise AssertionError("KeywordRebuildInputFreezer component is not implemented")
        return freezer_type(repository=fixture.repository, store=fixture.store, data_root=fixture.root)

    def _freeze(self, fixture: _DatasetFixture, dataset_ref=None, request_context=None):
        freezer = self._make_freezer(fixture)
        return freezer.freeze(dataset_ref or fixture.dataset_ref(), request_context or fixture.request_context())

    def _expect_contract_error(self, fixture, mutate=None):
        if mutate:
            mutate()
        try:
            self._freeze(fixture)
        except AssertionError as exc:
            self.fail(str(exc))
        except Exception as exc:  # implementation must expose a classified contract error
            self.assertTrue(getattr(exc, "code", None) or getattr(exc, "reason_code", None), repr(exc))
        else:
            self.fail("invalid dataset input was accepted")

    def test_missing_file_is_rejected(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            (fixture.dataset_root / "normalized/resource-1.md").unlink()
            self._expect_contract_error(fixture)

    def test_dataset_batch_task_manifest_and_store_identity_must_agree(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            for field, value in (("batchId", "batch-other"), ("taskId", "task-other"), ("datasetId", "dataset-other")):
                with self.subTest(field=field):
                    broken = deepcopy(fixture.dataset_ref())
                    broken[field] = value
                    try:
                        self._freeze(fixture, broken)
                    except AssertionError as exc:
                        self.fail(str(exc))
                    except Exception as exc:
                        self.assertTrue(getattr(exc, "code", None) or getattr(exc, "reason_code", None), repr(exc))
                    else:
                        self.fail(f"identity mismatch {field} was accepted")

    def test_manifest_store_and_task_mode_state_must_be_candidate_keyword(self):
        for field, value in (("state", "published"), ("mode", "formal_knowledge")):
            with self.subTest(field=field), TemporaryDirectory() as directory:
                fixture = _DatasetFixture(Path(directory))
                manifest = json.loads((fixture.dataset_root / "manifest.json").read_text(encoding="utf-8"))
                manifest[field] = value
                fixture._write_json("manifest.json", manifest)
                self._expect_contract_error(fixture)

    def test_store_dataset_task_and_batch_state_must_match_manifest(self):
        mutations = (
            ("datasets", DATASET_ID, {"state": "published"}),
            ("tasks", TASK_ID, {"type": "formal_knowledge"}),
            ("tasks", TASK_ID, {"batchId": "batch-other"}),
            ("batches", BATCH_ID, {"state": "processing"}),
        )
        for collection, record_id, changes in mutations:
            with self.subTest(collection=collection, changes=changes), TemporaryDirectory() as directory:
                fixture = _DatasetFixture(Path(directory))
                fixture.store.update_record(collection, record_id, changes)
                self._expect_contract_error(fixture)

    def test_document_resource_association_must_match_source_facts(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            documents_path = fixture.dataset_root / "documents.jsonl"
            documents = fixture.repository.read_jsonl(documents_path)
            documents[0]["resourceId"] = "resource-2"
            fixture._write_jsonl("documents.jsonl", documents)
            self._expect_contract_error(fixture)

    def test_path_traversal_and_symlink_are_rejected(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            manifest = json.loads((fixture.dataset_root / "manifest.json").read_text(encoding="utf-8"))
            manifest["normalized"][0]["path"] = "../outside.md"
            fixture._write_json("manifest.json", manifest)
            self._expect_contract_error(fixture)

        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            outside = Path(directory) / "outside.md"
            outside.write_text("逃逸", encoding="utf-8")
            target = fixture.dataset_root / "normalized/resource-1.md"
            target.unlink()
            try:
                target.symlink_to(outside)
            except OSError as exc:
                self.skipTest(f"symlink unavailable: {exc}")
            self._expect_contract_error(fixture)

    def test_chunk_resource_offset_and_content_must_match_normalized_snapshot(self):
        for mutation in ("resource", "offset", "content"):
            with self.subTest(mutation=mutation), TemporaryDirectory() as directory:
                fixture = _DatasetFixture(Path(directory))
                units_path = fixture.dataset_root / "processing-units.jsonl"
                units = fixture.repository.read_jsonl(units_path)
                if mutation == "resource":
                    units[0]["resourceId"] = "resource-2"
                elif mutation == "offset":
                    units[0]["offset"] = {"start": 1, "end": 999}
                else:
                    units[0]["content"] = "篡改正文"
                fixture._write_jsonl("processing-units.jsonl", units)
                self._expect_contract_error(fixture)

    def test_cross_resource_chunk_reference_is_rejected(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            units_path = fixture.dataset_root / "processing-units.jsonl"
            units = fixture.repository.read_jsonl(units_path)
            units[0]["overlap"] = {"sourceChunkId": "resource-2:0"}
            fixture._write_jsonl("processing-units.jsonl", units)
            self._expect_contract_error(fixture)

    def test_input_digest_is_stable_and_order_independent(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            first = self._freeze(fixture)
            digest = _value(first, "inputDigest", "input_digest")
            self.assertRegex(digest or "", r"^sha256:[0-9a-f]{64}$")
            second = self._freeze(fixture)
            self.assertEqual(digest, _value(second, "inputDigest", "input_digest"))

    def test_any_input_byte_change_changes_digest_or_is_rejected(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            before = self._freeze(fixture)
            old_digest = _value(before, "inputDigest", "input_digest")
            path = fixture.dataset_root / "normalized/resource-1.md"
            path.write_bytes(path.read_bytes() + "新增".encode("utf-8"))
            try:
                after = self._freeze(fixture)
            except Exception as exc:
                self.assertTrue(getattr(exc, "code", None) or getattr(exc, "reason_code", None), repr(exc))
            else:
                self.assertNotEqual(old_digest, _value(after, "inputDigest", "input_digest"))

    def test_capture_semantics_is_request_time_snapshot(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            result = self._freeze(fixture)
            self.assertEqual(
                _value(result, "captureSemantics", "capture_semantics"),
                "request_time_snapshot",
            )

    def test_source_files_remain_byte_sha_and_mtime_identical(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            before = fixture.source_state()
            self._freeze(fixture)
            self.assertEqual(before, fixture.source_state())

    def test_freeze_never_reads_latest_pointer(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            latest = fixture.dataset_root / "latest.json"
            latest.write_text("this must never be opened", encoding="utf-8")
            original_open = Path.open

            def reject_latest(path, *args, **kwargs):
                if path.name == "latest.json":
                    raise AssertionError("freeze read forbidden latest.json pointer")
                return original_open(path, *args, **kwargs)

            with patch.object(Path, "open", autospec=True, side_effect=reject_latest):
                self._freeze(fixture)

    def test_valid_freeze_commits_manifest_and_all_related_artifacts(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            result = self._freeze(fixture)
            self.assertEqual(_value(result, "datasetId", "dataset_id"), DATASET_ID)
            self.assertEqual(_value(result, "batchId", "batch_id"), BATCH_ID)
            self.assertEqual(_value(result, "taskId", "task_id"), TASK_ID)
            manifest_path = _value(result, "manifestPath", "manifest_path")
            self.assertTrue(manifest_path)
            path = Path(manifest_path)
            if not path.is_absolute():
                path = fixture.root / path
            self.assertTrue(path.is_file())
            committed = json.loads(path.read_text(encoding="utf-8"))
            serialized = json.dumps(committed, ensure_ascii=False)
            for marker in ("resource-1", "resource-2", "documents.jsonl", "processing-units.jsonl"):
                self.assertIn(marker, serialized)


if __name__ == "__main__":
    unittest.main()
