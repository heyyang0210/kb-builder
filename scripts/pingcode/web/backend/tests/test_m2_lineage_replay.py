import copy
import hashlib
import unittest

from app.lineage_manifest import (
    EvidenceReplay,
    EvidenceReplayError,
    FingerprintService,
    LineageManifest,
    canonical_json_bytes,
)
from app.version_fingerprint import VersionFingerprint


CREATED_AT = "2026-08-18T09:00:00Z"


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def source_v2_id(dataset_id: str, resource_id: str, content_hash: str) -> str:
    logical_key = {
        "datasetId": dataset_id,
        "resourceId": resource_id,
        "contentHash": content_hash,
    }
    return f"source:v2:{hashlib.sha256(canonical_json_bytes(logical_key)).hexdigest()}"


def lineage_inputs(text: str = "YashanDB 支持稳定的事务处理。"):
    source_hash = f"sha256:{sha256_text(text)}"
    source_id = source_v2_id("dataset-rg24", "resource-rg24", source_hash)
    chunk_hash = f"sha256:{sha256_text(text)}"
    chunk_id = f"chunk:{source_id}:0:{chunk_hash}"
    quote = "稳定的事务处理"
    start = text.index(quote)
    end = start + len(quote)
    return (
        [{
            "resourceKey": "resource-rg24",
            "uri": "snapshot://rg24/source-1",
            "snapshotId": "snapshot-rg24-source-1",
            "contentHash": source_hash,
            "aclRef": "acl-dataset-rg24",
            "createdAt": CREATED_AT,
        }],
        [{
            "sourceId": source_id,
            "ordinal": 0,
            "textHash": chunk_hash,
            "offset": {"start": 0, "end": len(text)},
            "createdAt": CREATED_AT,
        }],
        [{
            "chunkId": chunk_id,
            "start": start,
            "end": end,
            "quotedHash": f"sha256:{sha256_text(quote)}",
            "extractorVersion": "rules-v1",
            "createdAt": CREATED_AT,
        }],
    )


def sealed(record):
    body = {key: value for key, value in record.items() if key != "recordFingerprint"}
    body["recordFingerprint"] = FingerprintService.hash_json(body).to_dict()
    return body


class M2LineageManifestRebuildTests(unittest.TestCase):
    def test_rebuild_preserves_graph_version_and_citation_identity(self):
        sources, chunks, evidence = lineage_inputs()
        first_manifest = LineageManifest.build(
            "dataset-rg24", "version-rg24", sources, chunks, evidence
        )
        rebuilt_manifest = LineageManifest.build(
            "dataset-rg24",
            "version-rg24",
            list(reversed(sources)),
            list(reversed(chunks)),
            list(reversed(evidence)),
        )
        first_version = VersionFingerprint.build(
            first_manifest, {"index": "v1"}, {"rules": "v1"}
        )
        rebuilt_version = VersionFingerprint.build(
            rebuilt_manifest, {"index": "v1"}, {"rules": "v1"}
        )

        self.assertEqual(first_manifest, rebuilt_manifest)
        self.assertEqual(first_version, rebuilt_version)
        self.assertEqual(
            first_manifest["evidence"][0]["evidenceId"],
            rebuilt_manifest["evidence"][0]["evidenceId"],
        )
        self.assertTrue(LineageManifest.verify(rebuilt_manifest).valid)

    def test_hash_drift_is_not_silently_accepted(self):
        sources, chunks, evidence = lineage_inputs()
        manifest = LineageManifest.build(
            "dataset-rg24", "version-rg24", sources, chunks, evidence
        )
        drifted = copy.deepcopy(manifest)
        drifted["evidence"][0]["quotedHash"] = f"sha256:{'0' * 64}"

        result = LineageManifest.verify(drifted)

        self.assertFalse(result.valid)
        self.assertIn(
            "LINEAGE_RECORD_FINGERPRINT_MISMATCH",
            {issue.code for issue in result.issues},
        )
        self.assertIn(
            "LINEAGE_MANIFEST_FINGERPRINT_MISMATCH",
            {issue.code for issue in result.issues},
        )

    def test_missing_source_parent_is_rejected_during_rebuild(self):
        _, chunks, evidence = lineage_inputs()

        with self.assertRaisesRegex(ValueError, "父 source 缺失"):
            LineageManifest.build(
                "dataset-rg24", "version-rg24", [], chunks, evidence
            )

    def test_missing_chunk_parent_is_rejected_during_rebuild(self):
        sources, _, evidence = lineage_inputs()

        with self.assertRaisesRegex(ValueError, "父 chunk 缺失"):
            LineageManifest.build(
                "dataset-rg24", "version-rg24", sources, [], evidence
            )


class M2EvidenceReplayRegressionTests(unittest.TestCase):
    def setUp(self):
        self.text = "YashanDB 支持稳定的事务处理。"
        sources, chunks, evidence = lineage_inputs(self.text)
        self.manifest = LineageManifest.build(
            "dataset-rg24", "version-rg24", sources, chunks, evidence
        )
        self.snapshot_id = self.manifest["sources"][0]["snapshotId"]
        self.evidence_id = self.manifest["evidence"][0]["evidenceId"]
        self.citation_id = f"citation:answer-rg24:{self.evidence_id}"

    def _replay(self, manifest=None, snapshots=None):
        return EvidenceReplay(
            manifest or self.manifest,
            {self.snapshot_id: self.text} if snapshots is None else snapshots,
        ).replay(
            self.citation_id,
            self.evidence_id,
            request_id="request-rg24",
        )

    def _assert_error(self, code, status, *, manifest=None, snapshots=None):
        with self.assertRaises(EvidenceReplayError) as context:
            self._replay(manifest=manifest, snapshots=snapshots)
        error = context.exception
        self.assertEqual(error.code, code)
        self.assertEqual(error.status, status)
        self.assertEqual(error.request_id, "request-rg24")
        self.assertEqual(error.version_id, "version-rg24")
        self.assertNotIn("quote", error.to_dict())
        return error

    def test_rebuild_replay_preserves_citation_text_offsets_and_hash(self):
        before = self._replay()
        sources, chunks, evidence = lineage_inputs(self.text)
        rebuilt = LineageManifest.build(
            "dataset-rg24", "version-rg24", sources, chunks, evidence
        )
        after = self._replay(manifest=rebuilt)

        self.assertEqual(before["citation"], after["citation"])
        self.assertEqual(before["quote"], "稳定的事务处理")
        self.assertEqual(before["quote"], after["quote"])
        self.assertEqual(before["offsets"], after["offsets"])
        self.assertEqual(before["quoteFingerprint"], after["quoteFingerprint"])
        self.assertEqual(before["citation"]["citationId"], self.citation_id)
        self.assertEqual(before["citation"]["versionId"], "version-rg24")

    def test_missing_snapshot_is_isolated_without_guessing_text(self):
        self._assert_error("FILE_SNAPSHOT_MISSING", "isolated", snapshots={})

    def test_snapshot_hash_drift_marks_reference_stale(self):
        self._assert_error(
            "FILE_SNAPSHOT_HASH_MISMATCH",
            "stale",
            snapshots={self.snapshot_id: self.text + "内容漂移"},
        )

    def test_out_of_bounds_chunk_offset_is_isolated(self):
        manifest = copy.deepcopy(self.manifest)
        manifest["chunks"][0]["offset"]["end"] = len(self.text) + 1
        manifest["chunks"][0] = sealed(manifest["chunks"][0])

        self._assert_error("EVIDENCE_OFFSET_INVALID", "isolated", manifest=manifest)

    def test_missing_chunk_parent_is_isolated(self):
        manifest = copy.deepcopy(self.manifest)
        manifest["chunks"] = []

        self._assert_error("LINEAGE_PARENT_MISSING", "isolated", manifest=manifest)

    def test_quote_hash_drift_marks_only_evidence_stale(self):
        manifest = copy.deepcopy(self.manifest)
        manifest["evidence"][0]["quotedHash"] = (
            f"sha256:{sha256_text('错误摘录')}"
        )
        manifest["evidence"][0] = sealed(manifest["evidence"][0])

        error = self._assert_error(
            "EVIDENCE_QUOTE_HASH_MISMATCH", "stale", manifest=manifest
        )
        self.assertEqual(error.object_id, self.evidence_id)


if __name__ == "__main__":
    unittest.main()
