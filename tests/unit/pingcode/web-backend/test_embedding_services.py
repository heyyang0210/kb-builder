import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from app.embedding_cluster_service import EmbeddingClusterService
from app.embedding_service import EmbeddingService


def _config(version="1.0.0", provider_type="deterministic_hash", threshold=0.5):
    return {
        "profile": {"id": "test-profile", "version": version, "enabled": True},
        "provider": {
            "type": provider_type,
            "model": "hash-embedding-v1",
            "dimension": 16,
            "textKind": "semantic_title_summary_chunk",
        },
        "cache": {"directory": "model-results/embedding-cache"},
        "cluster": {
            "enabled": True,
            "algorithm": "cosine_threshold_connected_components",
            "threshold": threshold,
            "minClusterSize": 2,
            "singletonMode": "include",
        },
    }


class EmbeddingServiceTests(unittest.TestCase):
    def test_deterministic_provider_writes_index_and_hits_cache(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            documents = [{"resourceId": "r1", "sourcePath": "事务.md", "semanticTitle": "事务", "summary": "事务提交", "topicCandidates": [{"name": "事务"}]}]
            contexts = [{"resourceId": "r1", "chunkId": "r1:0", "sourcePath": "事务.md", "semanticTitle": "事务", "chunkSummary": "事务提交"}]
            service = EmbeddingService(_config(), "sha256:rules")
            first, first_issues = service.build(root, documents, contexts)
            second, second_issues = service.build(root, documents, contexts)

        self.assertEqual(first_issues, [])
        self.assertEqual(second_issues, [])
        self.assertEqual(len(first), 1)
        self.assertEqual(first[0]["status"], "completed")
        self.assertFalse(first[0]["cacheHit"])
        self.assertTrue(second[0]["cacheHit"])
        self.assertEqual(first[0]["vectorHash"], second[0]["vectorHash"])
        self.assertIn("embeddingId", first[0])
        self.assertNotIn("api", json.dumps(first, ensure_ascii=False).lower())

    def test_profile_version_changes_cache_key(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            documents = [{"resourceId": "r1", "sourcePath": "redo.md", "semanticTitle": "REDO"}]
            contexts = [{"resourceId": "r1", "chunkId": "r1:0", "sourcePath": "redo.md", "semanticTitle": "REDO", "chunkSummary": "REDO 日志"}]
            first, _ = EmbeddingService(_config(version="1.0.0"), "sha256:rules").build(root, documents, contexts)
            second, _ = EmbeddingService(_config(version="1.0.1"), "sha256:rules").build(root, documents, contexts)

        self.assertNotEqual(first[0]["cacheKey"], second[0]["cacheKey"])

    def test_unavailable_provider_degrades_to_warning(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            records, issues = EmbeddingService(_config(provider_type="model_gateway"), "sha256:rules").build(
                root,
                [{"resourceId": "r1", "sourcePath": "lob.md", "semanticTitle": "LOB"}],
                [{"resourceId": "r1", "chunkId": "r1:0", "sourcePath": "lob.md", "semanticTitle": "LOB"}],
            )
            persisted = json.loads((root / "quality/embedding-issues.json").read_text(encoding="utf-8"))

        self.assertEqual(records, [])
        self.assertEqual(issues[0]["code"], "EMBEDDING_PROVIDER_UNAVAILABLE")
        self.assertEqual(persisted[0]["severity"], "warning")


class EmbeddingClusterServiceTests(unittest.TestCase):
    def test_cluster_id_is_stable_for_same_members(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            documents = [
                {"resourceId": "r1", "semanticTitle": "事务", "topicCandidates": [{"name": "事务"}]},
                {"resourceId": "r2", "semanticTitle": "事务", "topicCandidates": [{"name": "事务"}]},
            ]
            contexts = [
                {"resourceId": "r1", "chunkId": "r1:0", "sourcePath": "事务1.md", "semanticTitle": "事务", "chunkSummary": "事务提交"},
                {"resourceId": "r2", "chunkId": "r2:0", "sourcePath": "事务2.md", "semanticTitle": "事务", "chunkSummary": "事务提交"},
            ]
            embeddings, _ = EmbeddingService(_config(threshold=0.1), "sha256:rules").build(root, documents, contexts)
            report1, issues1 = EmbeddingClusterService(_config(threshold=0.1)).build(root, embeddings, documents)
            report2, issues2 = EmbeddingClusterService(_config(threshold=0.1)).build(root, list(reversed(embeddings)), list(reversed(documents)))

        self.assertEqual(issues1, [])
        self.assertEqual(issues2, [])
        self.assertEqual(report1["summary"]["embeddingCount"], 2)
        self.assertEqual(report1["clusters"][0]["clusterId"], report2["clusters"][0]["clusterId"])
        self.assertEqual(report1["clusters"][0]["representativeTitle"], "事务")


if __name__ == "__main__":
    unittest.main()
