import copy
import hashlib
import json
import unittest

from app.lineage_manifest import (
    EvidenceReplay,
    EvidenceReplayError,
    FingerprintService,
    LineageManifest,
    canonical_json_bytes,
)


CREATED_AT = "2026-08-18T08:00:00Z"


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def source_v2_id(dataset_id: str, resource_id: str, content_hash: str) -> str:
    logical_key = {
        "datasetId": dataset_id,
        "resourceId": resource_id,
        "contentHash": content_hash,
    }
    return f"source:v2:{hashlib.sha256(canonical_json_bytes(logical_key)).hexdigest()}"


def records(label: str = "a"):
    resource_id = f"resource-{label}"
    content_hash = f"sha256:{digest(f'source-{label}')}"
    source_id = source_v2_id("dataset-1", resource_id, content_hash)
    text_hash = f"sha256:{digest(f'chunk-{label}')}"
    chunk_id = f"chunk:{source_id}:0:{text_hash}"
    return (
        {
            "resourceKey": resource_id,
            "uri": f"snapshot://{label}",
            "snapshotId": f"snapshot-{label}",
            "contentHash": content_hash,
            "aclRef": "acl-dataset-1",
            "createdAt": CREATED_AT,
        },
        {
            "sourceId": source_id,
            "ordinal": 0,
            "textHash": text_hash,
            "offset": {"start": 0, "end": 8},
            "createdAt": CREATED_AT,
        },
        {
            "chunkId": chunk_id,
            "start": 0,
            "end": 4,
            "quotedHash": f"sha256:{digest(f'quote-{label}')}",
            "extractorVersion": "rules-v1",
            "createdAt": CREATED_AT,
        },
    )


def replay_fixture():
    source_text = "前言\nYashanDB 支持事务。\n结束"
    chunk_text = "YashanDB 支持事务。"
    quote = "支持事务"
    chunk_start = source_text.index(chunk_text)
    evidence_start = chunk_text.index(quote)
    content_hash = f"sha256:{digest(source_text)}"
    source_id = source_v2_id("dataset-1", "resource-replay", content_hash)
    text_hash = f"sha256:{digest(chunk_text)}"
    chunk_id = f"chunk:{source_id}:0:{text_hash}"
    source = {
        "resourceKey": "resource-replay",
        "uri": "snapshot://replay",
        "snapshotId": "snapshot-replay",
        "contentHash": content_hash,
        "aclRef": "acl-dataset-1",
        "createdAt": CREATED_AT,
    }
    chunk = {
        "sourceId": source_id,
        "ordinal": 0,
        "textHash": text_hash,
        "offset": {
            "start": chunk_start,
            "end": chunk_start + len(chunk_text),
        },
        "createdAt": CREATED_AT,
    }
    evidence = {
        "chunkId": chunk_id,
        "start": evidence_start,
        "end": evidence_start + len(quote),
        "quotedHash": f"sha256:{digest(quote)}",
        "extractorVersion": "rules-v1",
        "createdAt": CREATED_AT,
    }
    manifest = LineageManifest.build(
        "dataset-1", "version-1", [source], [chunk], [evidence]
    )
    return manifest, source_text, chunk_text, quote


def citation_for(evidence_id: str) -> str:
    return f"citation:answer-1:{evidence_id}"


# Produced once by the committed Schema 1.0 implementation. This literal must
# not be regenerated through LineageManifest.build(), whose writer is v2-only.
LEGACY_V1_MANIFEST_JSON = r'''{
  "chunks": [{"chunkHash":"aead82303da9e59f78f98f032c907808c930883e71972275164bfbf741b74838","chunkId":"chunk:source:dataset-1:ac3854a97fc9667b360d438039c0cb2288a8bdd0204cfecdc295208196c17fc6:0:aead82303da9e59f78f98f032c907808c930883e71972275164bfbf741b74838","createdAt":"2026-08-18T08:00:00Z","datasetId":"dataset-1","lineageId":"chunk:source:dataset-1:ac3854a97fc9667b360d438039c0cb2288a8bdd0204cfecdc295208196c17fc6:0:aead82303da9e59f78f98f032c907808c930883e71972275164bfbf741b74838","offset":{"end":17,"start":3},"ordinal":0,"pageRef":null,"recordFingerprint":{"algorithm":"sha256-v1","byteLength":751,"digest":"434853bb8255575ad18627ba424170f16cd1322ac8a6efc17754e9bde08dc44e"},"schemaVersion":"1.0","sourceId":"source:dataset-1:ac3854a97fc9667b360d438039c0cb2288a8bdd0204cfecdc295208196c17fc6","textHash":"aead82303da9e59f78f98f032c907808c930883e71972275164bfbf741b74838","versionId":"version-1"}],
  "datasetId":"dataset-1",
  "evidence":[{"chunkId":"chunk:source:dataset-1:ac3854a97fc9667b360d438039c0cb2288a8bdd0204cfecdc295208196c17fc6:0:aead82303da9e59f78f98f032c907808c930883e71972275164bfbf741b74838","createdAt":"2026-08-18T08:00:00Z","datasetId":"dataset-1","end":13,"evidenceId":"evidence:chunk:source:dataset-1:ac3854a97fc9667b360d438039c0cb2288a8bdd0204cfecdc295208196c17fc6:0:aead82303da9e59f78f98f032c907808c930883e71972275164bfbf741b74838:914e74b6ae9f965401fc1e60d762ecb3188595e6456cfb57ddb25a98f66c5ad7","extractorVersion":"rules-v1","lineageId":"evidence:chunk:source:dataset-1:ac3854a97fc9667b360d438039c0cb2288a8bdd0204cfecdc295208196c17fc6:0:aead82303da9e59f78f98f032c907808c930883e71972275164bfbf741b74838:914e74b6ae9f965401fc1e60d762ecb3188595e6456cfb57ddb25a98f66c5ad7","quotedHash":"d852fdb6e8f0bcc1c10ba1320353cad1269695de8308ea40ef8624a9d9b51efb","recordFingerprint":{"algorithm":"sha256-v1","byteLength":967,"digest":"da8ab4048d0f268bf9bcdcc59cfc97722c13108746a6537230972ea25ae612ce"},"schemaVersion":"1.0","spanHash":"914e74b6ae9f965401fc1e60d762ecb3188595e6456cfb57ddb25a98f66c5ad7","start":9,"versionId":"version-1"}],
  "manifestFingerprint":{"algorithm":"sha256-v1","byteLength":2705,"digest":"2a6c32da54f719ed4100fb40c8861bff1d93859499bb8962c98d867239508904"},
  "schemaVersion":"1.0",
  "sources":[{"aclRef":"acl-dataset-1","contentHash":"ac3854a97fc9667b360d438039c0cb2288a8bdd0204cfecdc295208196c17fc6","createdAt":"2026-08-18T08:00:00Z","datasetId":"dataset-1","lineageId":"source:dataset-1:ac3854a97fc9667b360d438039c0cb2288a8bdd0204cfecdc295208196c17fc6","recordFingerprint":{"algorithm":"sha256-v1","byteLength":460,"digest":"87070f7862098eb1383a5b6cd628c1001e1e6268d5799eac6b48cd2d1f37fcc5"},"schemaVersion":"1.0","snapshotId":"snapshot-replay","sourceId":"source:dataset-1:ac3854a97fc9667b360d438039c0cb2288a8bdd0204cfecdc295208196c17fc6","uri":"snapshot://replay","versionId":"version-1"}],
  "versionId":"version-1"
}'''


class FingerprintServiceTests(unittest.TestCase):
    def test_hash_bytes_uses_sha256_v1_and_utf8_byte_length(self):
        payload = "崖山".encode("utf-8")
        fingerprint = FingerprintService.hash_bytes(payload)
        self.assertEqual(fingerprint.algorithm, "sha256-v1")
        self.assertEqual(fingerprint.digest, hashlib.sha256(payload).hexdigest())
        self.assertEqual(fingerprint.byte_length, len(payload))

    def test_canonical_json_is_key_order_independent_and_rejects_nan(self):
        self.assertEqual(
            canonical_json_bytes({"中文": 1, "a": [2]}),
            canonical_json_bytes({"a": [2], "中文": 1}),
        )
        with self.assertRaisesRegex(ValueError, "有限值"):
            canonical_json_bytes({"score": float("nan")})

    def test_unknown_algorithm_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "不支持"):
            FingerprintService.hash_bytes(b"value", "sha1")


class LineageManifestTests(unittest.TestCase):
    def test_build_is_order_independent_and_derives_stable_parent_chain(self):
        source_a, chunk_a, evidence_a = records("a")
        source_b, chunk_b, evidence_b = records("b")
        left = LineageManifest.build(
            "dataset-1",
            "version-1",
            [source_a, source_b],
            [chunk_a, chunk_b],
            [evidence_a, evidence_b],
        )
        right = LineageManifest.build(
            "dataset-1",
            "version-1",
            [source_b, source_a],
            [chunk_b, chunk_a],
            [evidence_b, evidence_a],
        )

        self.assertEqual(left, right)
        self.assertEqual(left["schemaVersion"], "2.0")
        self.assertTrue(left["sources"][0]["sourceId"].startswith("source:v2:"))
        self.assertEqual(len(left["sources"][0]["sourceId"]), len("source:v2:") + 64)
        self.assertTrue(left["chunks"][0]["chunkId"].startswith("chunk:source:"))
        self.assertTrue(left["evidence"][0]["evidenceId"].startswith("evidence:chunk:"))
        self.assertTrue(LineageManifest.verify(left).valid)

    def test_stable_references_survive_a_new_projection_version(self):
        source, chunk, evidence = records()
        first = LineageManifest.build(
            "dataset-1", "version-1", [source], [chunk], [evidence]
        )
        second = LineageManifest.build(
            "dataset-1", "version-2", [source], [chunk], [evidence]
        )
        for collection, field in (
            ("sources", "sourceId"),
            ("chunks", "chunkId"),
            ("evidence", "evidenceId"),
        ):
            self.assertEqual(first[collection][0][field], second[collection][0][field])
        self.assertNotEqual(first["manifestFingerprint"], second["manifestFingerprint"])

    def test_verify_reports_record_and_manifest_tampering(self):
        source, chunk, evidence = records()
        manifest = LineageManifest.build(
            "dataset-1", "version-1", [source], [chunk], [evidence]
        )
        tampered = copy.deepcopy(manifest)
        tampered["sources"][0]["uri"] = "snapshot://replaced"

        result = LineageManifest.verify(tampered)

        self.assertFalse(result.valid)
        self.assertEqual(
            {issue.code for issue in result.issues},
            {
                "LINEAGE_RECORD_FINGERPRINT_MISMATCH",
                "LINEAGE_MANIFEST_FINGERPRINT_MISMATCH",
            },
        )

    def test_verify_identifies_record_even_when_stable_reference_is_corrupted(self):
        source, chunk, evidence = records()
        manifest = LineageManifest.build(
            "dataset-1", "version-1", [source], [chunk], [evidence]
        )
        tampered = copy.deepcopy(manifest)
        tampered["sources"][0]["contentHash"] = "0" * 64

        result = LineageManifest.verify(tampered)

        self.assertFalse(result.valid)
        record_issues = [
            issue
            for issue in result.issues
            if issue.code == "LINEAGE_RECORD_FINGERPRINT_MISMATCH"
        ]
        self.assertEqual(len(record_issues), 1)
        self.assertEqual(record_issues[0].object_type, "sources")
        self.assertEqual(record_issues[0].object_id, manifest["sources"][0]["sourceId"])
        self.assertIn(
            "LINEAGE_MANIFEST_INVALID", {issue.code for issue in result.issues}
        )

    def test_missing_parent_and_forged_stable_id_are_rejected(self):
        source, chunk, evidence = records()
        with self.assertRaisesRegex(ValueError, "父 source 缺失"):
            LineageManifest.build(
                "dataset-1", "version-1", [], [chunk], [evidence]
            )
        source["sourceId"] = "source:forged"
        with self.assertRaisesRegex(ValueError, "稳定引用"):
            LineageManifest.build(
                "dataset-1", "version-1", [source], [chunk], [evidence]
            )

    def test_pl_b06_resource_key_is_hashed_and_never_becomes_a_path_or_id(self):
        resource_id = "../租户:秘密\u2215resource-*"
        content_hash = f"sha256:{digest('same bytes')}"
        manifest = LineageManifest.build(
            "dataset-1",
            "version-malicious",
            [{
                "resourceKey": resource_id,
                "uri": "snapshot://redacted",
                "snapshotId": "snapshots/safe-id.md",
                "contentHash": content_hash,
                "aclRef": "acl-dataset-1",
                "createdAt": CREATED_AT,
            }],
            [],
            [],
        )

        source = manifest["sources"][0]
        expected_id = source_v2_id("dataset-1", resource_id, content_hash)
        self.assertEqual(source["sourceId"], expected_id)
        self.assertEqual(source["lineageId"], expected_id)
        self.assertNotIn(resource_id, source["sourceId"])
        self.assertNotIn(resource_id, source["snapshotId"])
        self.assertEqual(len(source["sourceId"]), len("source:v2:") + 64)
        self.assertTrue(
            all(character in "0123456789abcdef" for character in source["sourceId"][10:])
        )

    def test_pl_b04_same_resource_content_change_gets_new_id_and_old_replays(self):
        first_text = "YashanDB 支持事务。"
        second_text = "YashanDB 支持事务与分析。"

        def build_version(text: str, version_id: str):
            content_hash = f"sha256:{digest(text)}"
            source_id = source_v2_id("dataset-1", "resource-stable", content_hash)
            text_hash = f"sha256:{digest(text)}"
            chunk_id = f"chunk:{source_id}:0:{text_hash}"
            quote = "YashanDB"
            return LineageManifest.build(
                "dataset-1",
                version_id,
                [{
                    "resourceKey": "resource-stable",
                    "uri": "snapshot://resource-stable",
                    "snapshotId": f"snapshot-{version_id}",
                    "contentHash": content_hash,
                    "aclRef": "acl-dataset-1",
                    "createdAt": CREATED_AT,
                }],
                [{
                    "sourceId": source_id,
                    "ordinal": 0,
                    "textHash": text_hash,
                    "offset": {"start": 0, "end": len(text)},
                    "createdAt": CREATED_AT,
                }],
                [{
                    "chunkId": chunk_id,
                    "start": 0,
                    "end": len(quote),
                    "quotedHash": f"sha256:{digest(quote)}",
                    "extractorVersion": "rules-v2",
                    "createdAt": CREATED_AT,
                }],
            )

        old_manifest = build_version(first_text, "version-old")
        frozen_old = copy.deepcopy(old_manifest)
        new_manifest = build_version(second_text, "version-new")

        self.assertNotEqual(
            old_manifest["sources"][0]["sourceId"],
            new_manifest["sources"][0]["sourceId"],
        )
        old_evidence = old_manifest["evidence"][0]["evidenceId"]
        replayed = EvidenceReplay(
            old_manifest, {"snapshot-version-old": first_text}
        ).replay(citation_for(old_evidence), old_evidence)
        self.assertEqual(replayed["quote"], "YashanDB")
        self.assertEqual(old_manifest, frozen_old)

    def test_pl_b05_frozen_v1_is_read_only_replayable_and_ambiguous(self):
        legacy = json.loads(LEGACY_V1_MANIFEST_JSON)
        before = copy.deepcopy(legacy)

        verification = LineageManifest.verify(legacy)
        issue_codes = {issue.code for issue in verification.issues}
        evidence_id = legacy["evidence"][0]["evidenceId"]
        replayed = EvidenceReplay(
            legacy,
            {"snapshot-replay": "前言\nYashanDB 支持事务。\n结束"},
        ).replay(citation_for(evidence_id), evidence_id)

        self.assertFalse(verification.valid)
        self.assertIn("LEGACY_SOURCE_IDENTITY_AMBIGUOUS", issue_codes)
        self.assertEqual(replayed["quote"], "支持事务")
        self.assertEqual(legacy, before)
        self.assertEqual(legacy["schemaVersion"], "1.0")
        self.assertEqual(
            LineageManifest.build("dataset-1", "version-new", [], [], [])["schemaVersion"],
            "2.0",
        )


class EvidenceReplayTests(unittest.TestCase):
    def test_mapping_and_callback_rebuild_the_same_citation_and_quote(self):
        manifest, source_text, chunk_text, quote = replay_fixture()
        evidence_id = manifest["evidence"][0]["evidenceId"]
        citation_id = citation_for(evidence_id)
        mapping_result = EvidenceReplay(
            manifest, {"snapshot-replay": source_text}
        ).replay(citation_id, evidence_id, request_id="request-1")
        callback_result = EvidenceReplay(
            manifest,
            lambda snapshot_id: source_text
            if snapshot_id == "snapshot-replay"
            else None,
        ).replay(citation_id, evidence_id, request_id="request-2")

        self.assertEqual(mapping_result["citation"], callback_result["citation"])
        self.assertEqual(mapping_result["evidence"], callback_result["evidence"])
        self.assertEqual(mapping_result["quote"], quote)
        self.assertEqual(mapping_result["quote"], callback_result["quote"])
        self.assertEqual(mapping_result["quoteFingerprint"]["digest"], digest(quote))
        self.assertEqual(
            source_text[
                mapping_result["offsets"]["source"]["start"]
                : mapping_result["offsets"]["source"]["end"]
            ],
            chunk_text,
        )

    def test_missing_snapshot_is_structured_and_does_not_return_text(self):
        manifest, _, _, _ = replay_fixture()
        evidence_id = manifest["evidence"][0]["evidenceId"]
        with self.assertRaises(EvidenceReplayError) as context:
            EvidenceReplay(manifest, {}).replay(
                citation_for(evidence_id), evidence_id, request_id="request-missing"
            )

        error = context.exception
        self.assertEqual(error.code, "FILE_SNAPSHOT_MISSING")
        self.assertEqual(error.status, "isolated")
        self.assertEqual(error.request_id, "request-missing")
        self.assertNotIn("quote", error.to_dict())

    def test_snapshot_hash_mismatch_marks_citation_stale(self):
        manifest, source_text, _, _ = replay_fixture()
        evidence_id = manifest["evidence"][0]["evidenceId"]
        with self.assertRaises(EvidenceReplayError) as context:
            EvidenceReplay(
                manifest, {"snapshot-replay": source_text + "已替换"}
            ).replay(citation_for(evidence_id), evidence_id, request_id="request-hash")

        self.assertEqual(context.exception.code, "FILE_SNAPSHOT_HASH_MISMATCH")
        self.assertEqual(context.exception.status, "stale")
        self.assertNotIn(source_text, str(context.exception))

    def test_missing_parent_is_isolated(self):
        manifest, source_text, _, _ = replay_fixture()
        evidence_id = manifest["evidence"][0]["evidenceId"]
        manifest["chunks"] = []
        with self.assertRaises(EvidenceReplayError) as context:
            EvidenceReplay(
                manifest, {"snapshot-replay": source_text}
            ).replay(
                citation_for(evidence_id), evidence_id, request_id="request-parent"
            )

        self.assertEqual(context.exception.code, "LINEAGE_PARENT_MISSING")
        self.assertEqual(context.exception.status, "isolated")

    def test_chunk_and_evidence_offsets_are_bounded(self):
        manifest, source_text, _, _ = replay_fixture()
        evidence_id = manifest["evidence"][0]["evidenceId"]
        manifest["chunks"][0]["offset"]["end"] = len(source_text) + 1
        manifest["chunks"][0]["recordFingerprint"] = FingerprintService.hash_json(
            {
                key: value
                for key, value in manifest["chunks"][0].items()
                if key != "recordFingerprint"
            }
        ).to_dict()
        with self.assertRaises(EvidenceReplayError) as context:
            EvidenceReplay(
                manifest, {"snapshot-replay": source_text}
            ).replay(
                citation_for(evidence_id), evidence_id, request_id="request-offset"
            )

        self.assertEqual(context.exception.code, "EVIDENCE_OFFSET_INVALID")
        self.assertEqual(context.exception.status, "isolated")

        manifest, source_text, chunk_text, _ = replay_fixture()
        evidence = manifest["evidence"][0]
        evidence["end"] = len(chunk_text) + 1
        evidence["recordFingerprint"] = FingerprintService.hash_json(
            {
                key: value
                for key, value in evidence.items()
                if key != "recordFingerprint"
            }
        ).to_dict()
        with self.assertRaises(EvidenceReplayError) as context:
            EvidenceReplay(
                manifest, {"snapshot-replay": source_text}
            ).replay(
                citation_for(evidence["evidenceId"]),
                evidence["evidenceId"],
                request_id="request-evidence-offset",
            )

        self.assertEqual(context.exception.code, "EVIDENCE_OFFSET_INVALID")
        self.assertEqual(context.exception.object_id, evidence["evidenceId"])

    def test_quote_hash_mismatch_marks_only_target_evidence_stale(self):
        manifest, source_text, _, _ = replay_fixture()
        evidence = manifest["evidence"][0]
        evidence["quotedHash"] = digest("不同摘录")
        evidence["recordFingerprint"] = FingerprintService.hash_json(
            {
                key: value
                for key, value in evidence.items()
                if key != "recordFingerprint"
            }
        ).to_dict()
        with self.assertRaises(EvidenceReplayError) as context:
            EvidenceReplay(
                manifest, {"snapshot-replay": source_text}
            ).replay(
                citation_for(evidence["evidenceId"]),
                evidence["evidenceId"],
                request_id="request-quote",
            )

        self.assertEqual(context.exception.code, "EVIDENCE_QUOTE_HASH_MISMATCH")
        self.assertEqual(context.exception.object_id, evidence["evidenceId"])
        self.assertEqual(context.exception.status, "stale")

    def test_citation_cannot_be_rebound_to_another_evidence(self):
        manifest, source_text, _, _ = replay_fixture()
        evidence_id = manifest["evidence"][0]["evidenceId"]
        with self.assertRaises(EvidenceReplayError) as context:
            EvidenceReplay(
                manifest, {"snapshot-replay": source_text}
            ).replay(
                "citation:answer-1:evidence:other",
                evidence_id,
                request_id="request-binding",
            )

        self.assertEqual(context.exception.code, "LINEAGE_NOT_FOUND")
        self.assertEqual(context.exception.status, "isolated")

    def test_manifest_is_frozen_when_replay_component_is_created(self):
        manifest, source_text, _, quote = replay_fixture()
        evidence_id = manifest["evidence"][0]["evidenceId"]
        replay = EvidenceReplay(manifest, {"snapshot-replay": source_text})
        manifest["evidence"].clear()

        result = replay.replay(citation_for(evidence_id), evidence_id)

        self.assertEqual(result["quote"], quote)

    def test_invalid_evidence_offset_is_rejected(self):
        source, chunk, evidence = records()
        evidence["end"] = evidence["start"]
        with self.assertRaisesRegex(ValueError, "偏移"):
            LineageManifest.build(
                "dataset-1", "version-1", [source], [chunk], [evidence]
            )


if __name__ == "__main__":
    unittest.main()
