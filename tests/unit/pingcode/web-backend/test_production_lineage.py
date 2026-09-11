import hashlib
import json
import random
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory

from app.lineage_manifest import LineageManifest
from app.production_lineage import (
    FORMAL_MODE,
    KEYWORD_MODE,
    GovernancePackageRepository,
    ProductionLineageAdapter,
    ProductionLineageError,
)
from app.version_fingerprint import VersionFingerprint


CREATED_AT = "2026-08-18T10:00:00Z"


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class ProductionFixture:
    source_text = "甲证据乙\n丙正文丁\n重复重复"

    def __init__(self, root: Path):
        self.dataset_root = root / "datasets" / "dataset-1"
        normalized = self.dataset_root / "normalized" / "resource-1.md"
        normalized.parent.mkdir(parents=True)
        normalized.write_bytes(self.source_text.encode("utf-8"))
        self.sources = [
            {
                "resourceId": "resource-1",
                "sourcePath": "docs/manual.md",
                "normalizedHash": sha256_text(self.source_text),
                "originalHash": "1" * 64,
            }
        ]
        self.chunks = [
            {
                "chunkId": "resource-1:0",
                "resourceId": "resource-1",
                "chunkIndex": 0,
                "content": "甲证据乙",
                "normalizedOffsets": {"start": 0, "end": 4},
                "sourceLocations": [
                    {"kind": "page", "pageNumber": 3, "blockIndex": 2}
                ],
                "overlap": {"enabled": False, "sourceChunkId": None},
            },
            {
                "chunkId": "resource-1:1",
                "resourceId": "resource-1",
                "chunkIndex": 1,
                "content": "甲证据乙\n\n丙正文丁",
                "normalizedOffsets": {"start": 5, "end": 9},
                "sourceLocations": [],
                "overlap": {
                    "enabled": True,
                    "sourceChunkId": "resource-1:0",
                },
            },
            {
                "id": "resource-1:2",
                "resourceId": "resource-1",
                "chunkIndex": 2,
                "content": "重复重复",
                "normalizedOffsets": {"start": 10, "end": 14},
                "sourceLocations": [],
                "overlap": {"enabled": False, "sourceChunkId": None},
            },
        ]

    def build(self, evidence, mode=FORMAL_MODE, **changes):
        arguments = {
            "dataset_id": "dataset-1",
            "version_id": "dataset-1",
            "dataset_root": self.dataset_root,
            "source_documents": self.sources,
            "prepared_chunks": self.chunks,
            "evidence_records": evidence,
            "mode": mode,
            "graph": {
                "nodes": [{"id": "node-1"}],
                "edges": [],
                "schemaVersion": "2.0",
                "graphSource": "final_knowledge",
            },
            "index": {"chunks": ["resource-1:0", "resource-1:1"]},
            "rule": {"pipelineVersion": "2.0", "schemaVersion": "2.0.0"},
            "created_at": CREATED_AT,
        }
        arguments.update(changes)
        return ProductionLineageAdapter.build(**arguments)

    @staticmethod
    def formal(record_id, chunk_id, text, offsets=None):
        value = {
            "knowledgeId": record_id,
            "chunkId": chunk_id,
            "evidenceText": text,
            "sourceMethod": "knowledge_extraction_workflow_agent",
            "schemaVersion": "2.0.0",
        }
        if offsets is not None:
            value["evidenceOffsets"] = offsets
        return value

    @staticmethod
    def keyword(record_id, chunk_id, text):
        return {
            "candidateId": record_id,
            "chunkId": chunk_id,
            "evidenceText": text,
            "sourceMethod": "deterministic_keyword",
            "schemaVersion": "2.0.0",
        }


class ProductionLineageAdapterTests(unittest.TestCase):
    def test_pl_b01_same_bytes_different_resources_keep_two_occurrences(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            second = fixture.dataset_root / "normalized" / "resource-2.md"
            second.write_bytes(fixture.source_text.encode("utf-8"))
            fixture.sources.append(
                {
                    "resourceId": "resource-2",
                    "sourcePath": "docs/copied-manual.md",
                    "normalizedHash": sha256_text(fixture.source_text),
                    "originalHash": "2" * 64,
                }
            )
            fixture.chunks.append(
                {
                    "chunkId": "resource-2:0",
                    "resourceId": "resource-2",
                    "chunkIndex": 0,
                    "content": "甲证据乙",
                    "normalizedOffsets": {"start": 0, "end": 4},
                    "sourceLocations": [],
                    "overlap": {"enabled": False, "sourceChunkId": None},
                }
            )

            result = fixture.build([])
            sources = {item["resourceKey"]: item for item in result.manifest["sources"]}
            chunks = {
                item["producerChunkId"]: item for item in result.manifest["chunks"]
            }

            self.assertEqual(result.manifest["schemaVersion"], "2.0")
            self.assertEqual(set(sources), {"resource-1", "resource-2"})
            self.assertEqual(
                sources["resource-1"]["contentHash"],
                sources["resource-2"]["contentHash"],
            )
            self.assertNotEqual(
                sources["resource-1"]["sourceId"],
                sources["resource-2"]["sourceId"],
            )
            self.assertEqual(sources["resource-1"]["uri"], "docs/manual.md")
            self.assertEqual(sources["resource-2"]["uri"], "docs/copied-manual.md")
            self.assertEqual(sources["resource-1"]["aclRef"], "dataset:dataset-1")
            self.assertNotEqual(
                chunks["resource-1:0"]["sourceId"],
                chunks["resource-2:0"]["sourceId"],
            )

    def test_pl_b02_10100_occurrences_with_2321_duplicates_do_not_collide(self):
        common_a = f"sha256:{sha256_text('provider-error-envelope')}"
        common_b = f"sha256:{sha256_text('second-duplicate-group')}"
        content_hashes = (
            [common_a] * 2027
            + [common_b] * 296
            + [f"sha256:{sha256_text(f'unique-{index}')}" for index in range(7777)]
        )
        sources = [
            {
                "resourceKey": f"resource-{index:05d}",
                "uri": f"snapshot://resource-{index:05d}",
                "snapshotId": f"snapshot-{index:05d}",
                "contentHash": content_hash,
                "aclRef": "dataset:dataset-scale",
                "createdAt": CREATED_AT,
            }
            for index, content_hash in enumerate(content_hashes)
        ]

        started = time.monotonic()
        manifest = LineageManifest.build(
            "dataset-scale", "version-scale", sources, [], []
        )
        elapsed = time.monotonic() - started

        source_ids = [item["sourceId"] for item in manifest["sources"]]
        unique_hashes = {item["contentHash"] for item in manifest["sources"]}
        self.assertEqual(len(manifest["sources"]), 10100)
        self.assertEqual(len(source_ids), len(set(source_ids)))
        self.assertEqual(len(unique_hashes), 7779)
        self.assertEqual(len(source_ids) - len(unique_hashes), 2321)
        self.assertLess(elapsed, 10.0)

    def test_pl_b03_duplicate_resource_and_content_is_rejected(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            fixture.sources.append(dict(fixture.sources[0]))

            with self.assertRaises(ProductionLineageError) as raised:
                fixture.build([])

            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")
            self.assertIn("resourceId 重复", str(raised.exception))

    def test_pl_b06_path_confusing_resource_ids_fail_closed(self):
        resource_ids = (
            "tenant:resource",
            "nested/resource",
            "nested\\resource",
            "resource-*",
            "resource\u2215confusable",
        )
        for resource_id in resource_ids:
            with self.subTest(resource_id=resource_id), TemporaryDirectory() as directory:
                fixture = ProductionFixture(Path(directory))
                fixture.sources[0]["resourceId"] = resource_id
                fixture.chunks[0]["resourceId"] = resource_id

                with self.assertRaises(ProductionLineageError) as raised:
                    fixture.build([])

                self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")

    def test_pl_a01_non_object_evidence_isolated_without_attribute_error(self):
        """PL-A01: malformed records must not escape the per-record quarantine."""
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            valid = fixture.formal(
                "knowledge-good", "resource-1:0", "证据", {"start": 1, "end": 3}
            )
            result = fixture.build(["text", ["array"], 7, None, valid])

            self.assertEqual(len(result.manifest["evidence"]), 1)
            self.assertEqual(len(result.issues), 4)
            self.assertTrue(
                all(issue["code"] == "LINEAGE_RECORD_INVALID" for issue in result.issues)
            )
            self.assertTrue(result.verification["valid"])

    def test_pl_a07_unsupported_mode_is_rejected_before_package_creation(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            with self.assertRaises(ProductionLineageError) as raised:
                fixture.build([], mode="untrusted_mode")

            self.assertEqual(raised.exception.code, "VERSION_FINGERPRINT_INVALID")

    def test_pl_a12_resource_path_injection_is_rejected(self):
        for resource_id in ("../outside", "/tmp/outside", "nested/../outside", "resource-*"):
            with self.subTest(resource_id=resource_id), TemporaryDirectory() as directory:
                fixture = ProductionFixture(Path(directory))
                fixture.sources[0]["resourceId"] = resource_id
                with self.assertRaises(ProductionLineageError) as raised:
                    fixture.build([])
                self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")

    def test_pl_a13_normalized_file_symlink_outside_root_is_rejected(self):
        with TemporaryDirectory() as directory, TemporaryDirectory() as outside:
            fixture = ProductionFixture(Path(directory))
            snapshot = fixture.dataset_root / "normalized" / "resource-1.md"
            external = Path(outside) / "secret.md"
            external.write_text(fixture.source_text, encoding="utf-8")
            snapshot.unlink()
            snapshot.symlink_to(external)

            with self.assertRaises(ProductionLineageError) as raised:
                fixture.build([])
            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")

    def test_pl_a14_normalized_symlink_directory_cannot_escape_root(self):
        with TemporaryDirectory() as directory, TemporaryDirectory() as outside:
            fixture = ProductionFixture(Path(directory))
            normalized = fixture.dataset_root / "normalized"
            (normalized / "resource-1.md").unlink()
            external_dir = Path(outside) / "nested"
            external_dir.mkdir()
            (external_dir / "resource-1.md").write_text(
                fixture.source_text, encoding="utf-8"
            )
            (normalized / "nested").symlink_to(external_dir, target_is_directory=True)
            fixture.sources[0]["resourceId"] = "nested/resource-1"

            with self.assertRaises(ProductionLineageError) as raised:
                fixture.build([])
            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")

    def test_pl_a15_governance_parent_symlink_is_fail_closed(self):
        with TemporaryDirectory() as directory, TemporaryDirectory() as outside:
            root = Path(directory)
            fixture = ProductionFixture(root)
            result = fixture.build([])
            target = root / "run"
            target.symlink_to(Path(outside), target_is_directory=True)

            with self.assertRaises(ProductionLineageError):
                GovernancePackageRepository.commit(target, result)
            self.assertFalse((Path(outside) / "governance").exists())

    def test_pl_a15_governance_final_symlink_is_fail_closed(self):
        with TemporaryDirectory() as directory, TemporaryDirectory() as outside:
            root = Path(directory)
            fixture = ProductionFixture(root)
            result = fixture.build([])
            target = root / "run"
            target.mkdir()
            (target / "governance").symlink_to(
                Path(outside), target_is_directory=True
            )

            with self.assertRaises(ProductionLineageError):
                GovernancePackageRepository.commit(target, result)
            self.assertEqual(list(Path(outside).iterdir()), [])

    def test_pl_a15_governance_staging_symlink_swap_is_fail_closed(self):
        with TemporaryDirectory() as directory, TemporaryDirectory() as outside:
            root = Path(directory)
            fixture = ProductionFixture(root)
            result = fixture.build([])
            target = root / "run"

            def swap_staging(stage, staging):
                if stage == "before_verify":
                    staging.rename(staging.with_name(f"{staging.name}-original"))
                    staging.symlink_to(Path(outside), target_is_directory=True)

            with self.assertRaises(ProductionLineageError):
                GovernancePackageRepository.commit(
                    target, result, fault_injector=swap_staging
                )
            self.assertFalse((target / "governance").exists())

    def test_pl_a16_corrupt_issues_file_is_checked_before_publish(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = ProductionFixture(root)
            result = fixture.build(
                [fixture.formal("knowledge-bad", "resource-1:1", "不存在")]
            )
            target = root / "run"

            def tamper(stage, staging):
                if stage == "before_verify":
                    (staging / "lineage-issues.jsonl").write_text(
                        "not-json\n", encoding="utf-8"
                    )

            with self.assertRaises(ProductionLineageError) as raised:
                GovernancePackageRepository.commit(
                    target, result, fault_injector=tamper
                )
            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")
            self.assertFalse((target / "governance").exists())

    def test_pl_a16_issues_replacement_after_verification_blocks_publish(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = ProductionFixture(root)
            result = fixture.build(
                [fixture.formal("knowledge-bad", "resource-1:1", "不存在")]
            )
            target = root / "run"

            def tamper(stage, staging):
                if stage == "before_publish":
                    (staging / "lineage-issues.jsonl").write_text(
                        "not-json\n", encoding="utf-8"
                    )

            with self.assertRaises(ProductionLineageError):
                GovernancePackageRepository.commit(
                    target, result, fault_injector=tamper
                )
            self.assertFalse((target / "governance").exists())

    def test_pl_a17_any_governance_file_corruption_blocks_publish(self):
        for filename in (
            "lineage-manifest.json",
            "lineage-verification.json",
            "version-fingerprint.json",
        ):
            with self.subTest(filename=filename), TemporaryDirectory() as directory:
                root = Path(directory)
                fixture = ProductionFixture(root)
                result = fixture.build([])
                target = root / "run"

                def tamper(stage, staging, filename=filename):
                    if stage == "before_verify":
                        path = staging / filename
                        path.write_text("{}", encoding="utf-8")

                with self.assertRaises(ProductionLineageError):
                    GovernancePackageRepository.commit(
                        target, result, fault_injector=tamper
                    )
                self.assertFalse((target / "governance").exists())

    @unittest.skip(
        "PL-A18 pending G-LIN-04: production offsetUnit has not been frozen"
    )
    def test_pl_a18_unicode_offsets_follow_frozen_offset_unit(self):
        self.fail("Enable after offsetUnit is confirmed and add a table-driven contract")

    def test_pl_a19_composed_and_decomposed_unicode_bytes_are_not_normalized(self):
        values = ("é", "e\u0301")
        results = []
        with TemporaryDirectory() as directory:
            for index, value in enumerate(values):
                fixture = ProductionFixture(Path(directory) / str(index))
                fixture.source_text = value
                snapshot = fixture.dataset_root / "normalized" / "resource-1.md"
                snapshot.write_text(value, encoding="utf-8")
                fixture.sources[0]["normalizedHash"] = sha256_text(value)
                fixture.chunks = [
                    {
                        "chunkId": "resource-1:0",
                        "resourceId": "resource-1",
                        "chunkIndex": 0,
                        "content": value,
                        "normalizedOffsets": {"start": 0, "end": len(value)},
                        "sourceLocations": [],
                        "overlap": {"enabled": False, "sourceChunkId": None},
                    }
                ]
                results.append(
                    fixture.build(
                        [
                            fixture.formal(
                                "knowledge-unicode",
                                "resource-1:0",
                                value,
                                {"start": 0, "end": len(value)},
                            )
                        ]
                    )
                )

        self.assertNotEqual(
            results[0].manifest["sources"][0]["contentHash"],
            results[1].manifest["sources"][0]["contentHash"],
        )
        self.assertNotEqual(
            results[0].manifest["evidence"][0]["quotedHash"],
            results[1].manifest["evidence"][0]["quotedHash"],
        )

    def test_pl_a21_overlap_parent_from_another_resource_is_isolated(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            second_text = "资源二证据"
            second_snapshot = fixture.dataset_root / "normalized" / "resource-2.md"
            second_snapshot.write_text(second_text, encoding="utf-8")
            fixture.sources.append(
                {
                    "resourceId": "resource-2",
                    "sourcePath": "docs/other.md",
                    "normalizedHash": sha256_text(second_text),
                }
            )
            fixture.chunks.append(
                {
                    "chunkId": "resource-2:0",
                    "resourceId": "resource-2",
                    "chunkIndex": 0,
                    "content": second_text,
                    "normalizedOffsets": {"start": 0, "end": len(second_text)},
                    "sourceLocations": [],
                    "overlap": {"enabled": False, "sourceChunkId": None},
                }
            )
            fixture.chunks[1]["overlap"] = {
                "enabled": True,
                "sourceChunkId": "resource-2:0",
            }
            result = fixture.build(
                [
                    fixture.formal(
                        "knowledge-cross-resource",
                        "resource-1:1",
                        "证据",
                        {"start": 6, "end": 8},
                    )
                ]
            )

            self.assertEqual(result.manifest["evidence"], [])
            self.assertEqual(len(result.issues), 1)
            self.assertEqual(result.issues[0]["objectId"], "knowledge-cross-resource")

    def test_pl_a22_overlap_missing_self_and_cycle_are_bounded_and_isolated(self):
        overlap_cases = {
            "missing": ("missing:0", None),
            "self": ("resource-1:1", None),
            "cycle": ("resource-1:2", "resource-1:1"),
        }
        for name, (parent_id, reverse_parent_id) in overlap_cases.items():
            with self.subTest(case=name), TemporaryDirectory() as directory:
                fixture = ProductionFixture(Path(directory))
                fixture.chunks[1]["overlap"] = {
                    "enabled": True,
                    "sourceChunkId": parent_id,
                }
                if reverse_parent_id is not None:
                    fixture.chunks[2]["overlap"] = {
                        "enabled": True,
                        "sourceChunkId": reverse_parent_id,
                    }
                result = fixture.build(
                    [
                        fixture.formal(
                            "knowledge-good",
                            "resource-1:0",
                            "证据",
                            {"start": 1, "end": 3},
                        ),
                        fixture.formal(
                            f"knowledge-{name}",
                            "resource-1:1",
                            "证据",
                            {"start": 6, "end": 8},
                        ),
                    ]
                )

                self.assertEqual(len(result.manifest["evidence"]), 1)
                self.assertEqual(len(result.issues), 1)
                self.assertEqual(result.issues[0]["objectId"], f"knowledge-{name}")

    @unittest.skip(
        "PL-A23 pending G-LIN-04: formal evidenceOffsets representation is not frozen"
    )
    def test_pl_a23_formal_offset_representations_are_table_driven(self):
        self.fail("Enable after source/runtime/chunk offset representation is confirmed")

    def test_pl_a24_input_order_permutations_produce_identical_package(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            evidence = [
                fixture.formal("knowledge-a", "resource-1:0", "证据", {"start": 1, "end": 3}),
                fixture.formal("knowledge-b", "resource-1:1", "正文", {"start": 12, "end": 14}),
                fixture.formal("knowledge-c", "resource-1:2", "重复", {"start": 10, "end": 12}),
                {"chunkId": "resource-1:0", "evidenceText": "证据"},
                {"chunkId": "resource-1:2", "evidenceText": "重复"},
            ]
            expected = fixture.build(evidence)
            for seed in range(100):
                rng = random.Random(seed)
                sources = list(fixture.sources)
                chunks = list(fixture.chunks)
                records = list(evidence)
                rng.shuffle(sources)
                rng.shuffle(chunks)
                rng.shuffle(records)
                actual = fixture.build(
                    records,
                    source_documents=sources,
                    prepared_chunks=chunks,
                )
                self.assertEqual(expected, actual, f"input order changed at seed {seed}")

    def test_pl_a25_invalid_evidence_identity_does_not_depend_on_record_index(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            malformed = [
                {"chunkId": "resource-1:0", "evidenceText": "证据"},
                {"chunkId": "resource-1:2", "evidenceText": "重复"},
            ]
            first = fixture.build(malformed)
            second = fixture.build(list(reversed(malformed)))

            first_ids = {issue["objectId"] for issue in first.issues}
            second_ids = {issue["objectId"] for issue in second.issues}
            self.assertEqual(first_ids, second_ids)
            self.assertTrue(
                all(
                    value.startswith("record:")
                    and len(value) == len("record:") + 24
                    and all(character in "0123456789abcdef" for character in value[7:])
                    for value in first_ids
                )
            )

    def test_pl_a27_rebuilding_same_facts_keeps_occurrence_ids_across_versions(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            evidence = [
                fixture.formal(
                    "knowledge-versioned", "resource-1:1", "正文", {"start": 12, "end": 14}
                )
            ]
            first = fixture.build(evidence, version_id="version-1")
            second = fixture.build(evidence, version_id="version-2")

            id_fields = {
                "sources": "sourceId",
                "chunks": "chunkId",
                "evidence": "evidenceId",
            }
            for collection, id_field in id_fields.items():
                first_ids = {
                    item[id_field] for item in first.manifest[collection]
                }
                second_ids = {
                    item[id_field] for item in second.manifest[collection]
                }
                self.assertEqual(first_ids, second_ids)
            self.assertNotEqual(
                first.manifest["manifestFingerprint"], second.manifest["manifestFingerprint"]
            )
            self.assertEqual(first.version_fingerprint, second.version_fingerprint)

    def test_same_input_is_deterministic_and_uses_frozen_bytes_and_offsets(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            evidence = [
                fixture.formal(
                    "knowledge-1", "resource-1:1", "正文", {"start": 12, "end": 14}
                )
            ]

            first = fixture.build(evidence)
            second = fixture.build(evidence)

            self.assertEqual(first, second)
            self.assertTrue(LineageManifest.verify(first.manifest).valid)
            self.assertTrue(VersionFingerprint.verify(first.version_fingerprint))
            source = first.manifest["sources"][0]
            self.assertEqual(
                source["contentHash"], f"sha256:{sha256_text(fixture.source_text)}"
            )
            self.assertEqual(
                source["snapshotId"], "datasets/dataset-1/normalized/resource-1.md"
            )
            chunks = {
                item["producerChunkId"]: item for item in first.manifest["chunks"]
            }
            self.assertEqual(chunks["resource-1:1"]["offset"], {"start": 5, "end": 9})
            self.assertEqual(chunks["resource-1:1"]["pageRef"], None)
            self.assertEqual(chunks["resource-1:0"]["pageRef"]["pageNumber"], 3)
            self.assertEqual(
                chunks["resource-1:1"]["textHash"], f"sha256:{sha256_text('丙正文丁')}"
            )
            mapped = first.manifest["evidence"][0]
            self.assertEqual((mapped["start"], mapped["end"]), (1, 3))
            self.assertEqual(mapped["quotedHash"], f"sha256:{sha256_text('正文')}")
            self.assertEqual(first.version_fingerprint["status"]["model"], "not_applicable")
            self.assertEqual(first.version_fingerprint["status"]["embedding"], "not_applicable")

    def test_pl_a11_snapshot_byte_change_is_detected_before_manifest_build(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            snapshot = fixture.dataset_root / "normalized" / "resource-1.md"
            snapshot.write_bytes((fixture.source_text + "变").encode("utf-8"))

            with self.assertRaises(ProductionLineageError) as raised:
                fixture.build([])

            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")
            self.assertIn("哈希不一致", str(raised.exception))

    def test_pl_a11_non_utf8_snapshot_is_rejected_before_manifest_build(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            payload = b"\xff\xfe\x00"
            snapshot = fixture.dataset_root / "normalized" / "resource-1.md"
            snapshot.write_bytes(payload)
            fixture.sources[0]["normalizedHash"] = hashlib.sha256(payload).hexdigest()

            with self.assertRaises(ProductionLineageError) as raised:
                fixture.build([])

            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")
            self.assertIn("不可读取", str(raised.exception))

    def test_invalid_offset_and_missing_source_parent_fail_whole_build(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            fixture.chunks[0]["normalizedOffsets"] = {"start": 0, "end": 999}
            with self.assertRaises(ProductionLineageError) as raised:
                fixture.build([])
            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")

            fixture = ProductionFixture(Path(directory) / "second")
            fixture.chunks[0]["resourceId"] = "missing-resource"
            with self.assertRaises(ProductionLineageError) as raised:
                fixture.build([])
            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")
            self.assertIn("父 source", str(raised.exception))

    def test_one_bad_evidence_is_isolated_and_valid_evidence_remains(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            result = fixture.build(
                [
                    fixture.formal(
                        "knowledge-good",
                        "resource-1:1",
                        "正文",
                        {"start": 12, "end": 14},
                    ),
                    fixture.formal("knowledge-bad", "resource-1:1", "不存在"),
                    fixture.formal("knowledge-orphan", "missing:0", "证据"),
                ]
            )

            self.assertEqual(len(result.manifest["evidence"]), 1)
            self.assertEqual(
                {item["objectId"] for item in result.issues},
                {"knowledge-bad", "knowledge-orphan"},
            )
            self.assertTrue(all(item["code"] == "LINEAGE_RECORD_INVALID" for item in result.issues))
            self.assertTrue(result.verification["valid"])

    def test_pl_a05_same_span_aggregates_explicit_versions_deterministically(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            workflow = fixture.formal(
                "knowledge-point", "resource-1:1", "正文", {"start": 12, "end": 14}
            )
            workflow["schemaVersion"] = "2.1.0"
            prior_workflow = fixture.formal(
                "knowledge-entity", "resource-1:1", "正文", {"start": 12, "end": 14}
            )
            result = fixture.build([workflow, prior_workflow])

            self.assertEqual(len(result.manifest["evidence"]), 1)
            mapped = result.manifest["evidence"][0]
            self.assertEqual(
                mapped["producerEvidenceIds"],
                ["knowledge-entity", "knowledge-point"],
            )
            self.assertEqual(
                mapped["extractorVersions"],
                [
                    "knowledge_extraction_workflow_agent:2.0.0",
                    "knowledge_extraction_workflow_agent:2.1.0",
                ],
            )
            self.assertEqual(
                mapped["extractorVersion"],
                "knowledge_extraction_workflow_agent:2.0.0",
            )
            self.assertTrue(result.verification["valid"])

    def test_pl_a06_empty_and_all_invalid_evidence_are_expressible(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))

            empty = fixture.build([])
            isolated = fixture.build(
                [
                    fixture.formal("knowledge-no-offset", "resource-1:0", "证据"),
                    fixture.formal(
                        "knowledge-orphan",
                        "missing:0",
                        "证据",
                        {"start": 1, "end": 3},
                    ),
                ]
            )

            self.assertEqual(empty.manifest["evidence"], [])
            self.assertEqual(empty.issues, ())
            self.assertTrue(empty.verification["valid"])
            self.assertEqual(isolated.manifest["evidence"], [])
            self.assertEqual(
                {issue["objectId"] for issue in isolated.issues},
                {"knowledge-no-offset", "knowledge-orphan"},
            )
            self.assertTrue(
                all(
                    issue["code"] == "LINEAGE_RECORD_INVALID"
                    for issue in isolated.issues
                )
            )
            self.assertTrue(isolated.verification["valid"])

    def test_pl_a20_formal_overlap_rebinds_parent_and_ambiguous_quote_is_isolated(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            result = fixture.build(
                [
                    fixture.formal(
                        "knowledge-overlap",
                        "resource-1:1",
                        "证据",
                        {"start": 6, "end": 8},
                    ),
                    fixture.formal("knowledge-ambiguous", "resource-1:2", "重复"),
                ]
            )

            chunks = {
                item["producerChunkId"]: item for item in result.manifest["chunks"]
            }
            mapped = result.manifest["evidence"][0]
            self.assertEqual(mapped["chunkId"], chunks["resource-1:0"]["chunkId"])
            self.assertEqual((mapped["start"], mapped["end"]), (1, 3))
            self.assertEqual(len(result.issues), 1)
            self.assertEqual(result.issues[0]["objectId"], "knowledge-ambiguous")
            self.assertIn("evidenceOffsets", result.issues[0]["reason"])

    def test_keyword_uses_smallest_offset_for_ambiguous_quote(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            result = fixture.build(
                [fixture.keyword("candidate-1", "resource-1:2", "重复")],
                mode=KEYWORD_MODE,
                graph={"graphSource": "metadata_keyword", "nodes": [], "edges": []},
            )

            mapped = result.manifest["evidence"][0]
            self.assertEqual((mapped["start"], mapped["end"]), (0, 2))
            self.assertEqual(mapped["occurrenceIndex"], 0)
            self.assertEqual(mapped["extractorVersion"], "deterministic_keyword:2.0.0")

    def test_required_version_component_failure_blocks_result(self):
        with TemporaryDirectory() as directory:
            fixture = ProductionFixture(Path(directory))
            with self.assertRaises(ProductionLineageError) as raised:
                fixture.build([], graph=None)
            self.assertEqual(raised.exception.code, "VERSION_FINGERPRINT_INVALID")


class GovernancePackageRepositoryTests(unittest.TestCase):
    def _result(self, root: Path):
        fixture = ProductionFixture(root)
        return fixture.build(
            [
                fixture.formal(
                    "knowledge-1", "resource-1:1", "正文", {"start": 12, "end": 14}
                ),
                fixture.formal("knowledge-bad", "resource-1:1", "不存在"),
            ]
        )

    def test_commit_publishes_exactly_four_self_verified_files(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            result = self._result(root)
            target = root / "run"

            committed = GovernancePackageRepository.commit(target, result)

            self.assertEqual(
                {path.name for path in committed.root.iterdir()},
                {
                    "lineage-manifest.json",
                    "lineage-verification.json",
                    "lineage-issues.jsonl",
                    "version-fingerprint.json",
                },
            )
            manifest = json.loads(
                (committed.root / "lineage-manifest.json").read_text(encoding="utf-8")
            )
            versions = json.loads(
                (committed.root / "version-fingerprint.json").read_text(encoding="utf-8")
            )
            self.assertTrue(LineageManifest.verify(manifest).valid)
            self.assertTrue(VersionFingerprint.verify(versions))
            self.assertEqual(
                len((committed.root / "lineage-issues.jsonl").read_text(encoding="utf-8").splitlines()),
                1,
            )
            self.assertEqual(
                committed.to_dict()["lineage"]["manifestPath"],
                "governance/lineage-manifest.json",
            )

    def test_faults_before_atomic_replace_leave_no_half_package(self):
        for failure_stage in ("after_manifest", "before_verify", "before_publish"):
            with self.subTest(stage=failure_stage), TemporaryDirectory() as directory:
                root = Path(directory)
                result = self._result(root)
                target = root / "run"

                def fail(stage, _staging):
                    if stage == failure_stage:
                        raise OSError(f"fault:{stage}")

                with self.assertRaisesRegex(OSError, f"fault:{failure_stage}"):
                    GovernancePackageRepository.commit(
                        target, result, fault_injector=fail
                    )

                self.assertFalse((target / "governance").exists())
                self.assertEqual(list(target.glob(".governance-staging-*")), [])

    def test_staging_tamper_fails_closed_without_publish(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            result = self._result(root)
            target = root / "run"

            def tamper(stage, staging):
                if stage == "before_verify":
                    path = staging / "lineage-manifest.json"
                    value = json.loads(path.read_text(encoding="utf-8"))
                    value["versionId"] = "tampered"
                    path.write_text(json.dumps(value), encoding="utf-8")

            with self.assertRaises(ProductionLineageError) as raised:
                GovernancePackageRepository.commit(
                    target, result, fault_injector=tamper
                )

            self.assertEqual(raised.exception.code, "MANIFEST_VERIFICATION_PENDING")
            self.assertFalse((target / "governance").exists())

    def test_existing_package_is_immutable(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            result = self._result(root)
            target = root / "run"
            GovernancePackageRepository.commit(target, result)

            with self.assertRaises(ProductionLineageError) as raised:
                GovernancePackageRepository.commit(target, result)

            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")

    def test_pl_a26_concurrent_writers_publish_exactly_one_complete_package(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            result = self._result(root)
            target = root / "run"
            ready = threading.Barrier(2)

            def commit_after_barrier():
                def synchronize(stage, _staging):
                    if stage == "before_publish":
                        ready.wait(timeout=5)

                try:
                    return GovernancePackageRepository.commit(
                        target, result, fault_injector=synchronize
                    )
                except Exception as exc:  # Captured for exact result accounting.
                    return exc

            with ThreadPoolExecutor(max_workers=2) as executor:
                outcomes = list(executor.map(lambda _: commit_after_barrier(), range(2)))

            successes = [
                item for item in outcomes if not isinstance(item, Exception)
            ]
            failures = [item for item in outcomes if isinstance(item, Exception)]
            self.assertEqual(len(successes), 1)
            self.assertEqual(len(failures), 1)
            self.assertIsInstance(failures[0], ProductionLineageError)
            self.assertEqual(failures[0].code, "ARTIFACT_INTEGRITY_ERROR")
            self.assertEqual(list(target.glob(".governance-staging-*")), [])
            GovernancePackageRepository._verify_staging(
                target / "governance", result.issues
            )


if __name__ == "__main__":
    unittest.main()
