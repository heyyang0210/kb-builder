"""Measured 1k/8k bounded execution baselines for the 2C kernel."""

from __future__ import annotations

import hashlib
import json
import resource
import time
import tracemalloc
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from app.production_lineage import CommittedRebuildInputRef, KeywordRuleRebuild
from tests.test_keyword_rule_rebuild import _descriptor


def _sha(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


class _BatchedExecutor:
    batch_size = 64

    def __init__(self):
        self.calls = 0
        self.max_batch = 0
        self.model_calls = 0

    def execute_batch(self, records, context):
        self.calls += 1
        self.max_batch = max(self.max_batch, len(records))
        rule_ref = context.ruleSnapshotRef
        candidates = []
        for record in records:
            resource_id = str(record["resourceId"])
            for unit in record["processingUnits"]:
                candidates.append(
                    {
                        "schemaVersion": "2.0",
                        "candidateId": f"candidate:{resource_id}:{unit['chunkId']}",
                        "resourceId": resource_id,
                        "chunkId": str(unit["chunkId"]),
                        "sourceMethod": "deterministic_keyword",
                        "evidenceText": str(unit["content"]),
                        "extractorVersion": rule_ref["extractorVersion"],
                        "extractorSnapshotRef": dict(rule_ref),
                        "model": None,
                        "modelStatus": "not_applicable",
                    }
                )
        return {
            "candidates": candidates,
            "isolated": [],
            "modelCallCount": 0,
            "modelStatus": "not_applicable",
        }


def _build_input(root: Path, count: int) -> CommittedRebuildInputRef:
    dataset_id = f"dataset-perf-{count}"
    batch_id = f"batch-perf-{count}"
    task_id = f"task-perf-{count}"
    package = root / "rebuild-inputs" / f"perf-{count}"
    normalized_dir = package / "artifacts" / "normalized"
    normalized_dir.mkdir(parents=True)
    processing_path = package / "artifacts" / "processing-units.jsonl"
    normalized = []
    with processing_path.open("w", encoding="utf-8") as processing:
        for index in range(count):
            resource_id = f"resource-{index:05d}"
            normalized_path = normalized_dir / f"{resource_id}.md"
            text = f"规则内容 {index}\n"
            normalized_path.write_text(text, encoding="utf-8")
            normalized.append(
                {
                    "resourceId": resource_id,
                    "path": f"normalized/{resource_id}.md",
                    "sha256": _sha(normalized_path),
                    "bytes": normalized_path.stat().st_size,
                }
            )
            processing.write(
                json.dumps(
                    {
                        "chunkId": f"{resource_id}:0",
                        "resourceId": resource_id,
                        "chunkIndex": 0,
                        "offset": {"start": 0, "end": len(text)},
                        "content": text,
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                )
                + "\n"
            )
    artifacts = [
        {
            "path": "artifacts/processing-units.jsonl",
            "sha256": _sha(processing_path),
            "bytes": processing_path.stat().st_size,
        }
    ]
    artifacts.extend(
        {
            **item,
            "path": f"artifacts/{item['path']}",
        }
        for item in normalized
    )
    facts = {
        "datasetId": dataset_id,
        "batchId": batch_id,
        "taskId": task_id,
        "manifest": {"sha256": "sha256:" + "0" * 64, "bytes": 0},
        "artifacts": [dict(artifacts[0])],
        "normalized": normalized,
        "sources": [],
        "documents": [],
        "processingUnits": [],
    }
    canonical = json.dumps(facts, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    input_digest = "sha256:" + hashlib.sha256(canonical).hexdigest()
    manifest = {
        "schemaVersion": "rebuild-input/v1",
        "captureSemantics": "request_time_snapshot",
        "datasetId": dataset_id,
        "batchId": batch_id,
        "taskId": task_id,
        "inputDigest": input_digest,
        "sourceManifestHash": "sha256:" + "1" * 64,
        "artifacts": artifacts,
        "facts": facts,
    }
    manifest_path = package / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, sort_keys=True), encoding="utf-8")
    manifest_hash = _sha(manifest_path)
    (package / "commit.json").write_text(
        json.dumps(
            {
                "schemaVersion": "rebuild-input-commit/v1",
                "datasetId": dataset_id,
                "batchId": batch_id,
                "taskId": task_id,
                "inputDigest": input_digest,
                "manifestPath": "manifest.json",
                "manifestHash": manifest_hash,
            },
            ensure_ascii=False,
            sort_keys=True,
        ),
        encoding="utf-8",
    )
    return CommittedRebuildInputRef(
        dataset_id,
        batch_id,
        task_id,
        input_digest,
        "request_time_snapshot",
        str(manifest_path.relative_to(root)),
        manifest_hash,
        tuple(artifacts),
    )


class KeywordRuleRebuildPerformanceTests(unittest.TestCase):
    def test_1k_and_8k_use_bounded_batches_and_zero_model_calls(self):
        measurements = []
        for count in (1000, 8000):
            with self.subTest(documents=count), TemporaryDirectory() as directory:
                root = Path(directory)
                frozen = _build_input(root, count)
                executor = _BatchedExecutor()
                started = time.perf_counter()
                rss_before = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
                tracemalloc.start()
                with patch(
                    "app.production_lineage.settings",
                    SimpleNamespace(data_root=root),
                    create=True,
                ):
                    result = KeywordRuleRebuild.execute(
                        frozen,
                        _descriptor(),
                        {
                            "datasetId": frozen.datasetId,
                            "taskId": frozen.taskId,
                            "inputDigest": frozen.inputDigest,
                        },
                        executor,
                    )
                _, peak_python_bytes = tracemalloc.get_traced_memory()
                tracemalloc.stop()
                elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
                rss_after = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
                package_bytes = sum(path.stat().st_size for path in (root / "rebuild-inputs").rglob("*") if path.is_file())
                run_root = root / "training-runs" / result.rebuildRunId
                output_bytes = sum(path.stat().st_size for path in run_root.rglob("*") if path.is_file())
                self.assertEqual(result.candidateCount, count)
                self.assertEqual(executor.model_calls, 0)
                self.assertLessEqual(executor.max_batch, executor.batch_size)
                self.assertGreater(executor.calls, 1)
                measurements.append(
                    {
                        "documents": count,
                        "elapsedMs": elapsed_ms,
                        "peakRssDelta": max(0, rss_after - rss_before),
                        "peakPythonBytes": peak_python_bytes,
                        "readBytes": package_bytes,
                        "writeBytes": output_bytes,
                        "lockWaitMs": 0,
                        "retries": 0,
                        "batchSize": executor.batch_size,
                        "batchCalls": executor.calls,
                        "maxBatch": executor.max_batch,
                        "modelCalls": executor.model_calls,
                    }
                )
        print("PERF_BASELINE " + json.dumps(measurements, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    unittest.main()
