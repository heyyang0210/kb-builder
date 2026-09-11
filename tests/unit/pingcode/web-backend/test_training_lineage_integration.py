"""Training-exit integration coverage for the production governance package."""

from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from app.training_service import TrainingService


class TrainingLineageIntegrationTests(unittest.TestCase):
    def test_governance_helper_commits_verified_keyword_package(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            dataset_root = root / "datasets" / "dataset-integration"
            normalized = dataset_root / "normalized" / "resource-1.md"
            normalized.parent.mkdir(parents=True)
            text = "连接池参数"
            normalized.write_text(text, encoding="utf-8")
            digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
            source_documents = [{
                "resourceId": "resource-1",
                "sourcePath": "docs/manual.md",
                "normalizedHash": digest,
            }]
            units = [{
                "chunkId": "resource-1:0",
                "resourceId": "resource-1",
                "chunkIndex": 0,
                "content": text,
                "normalizedOffsets": {"start": 0, "end": len(text)},
                "overlap": {"enabled": False, "sourceChunkId": None},
            }]
            service = TrainingService(
                SimpleNamespace(), SimpleNamespace(), SimpleNamespace(),
                None, None, gateway=None,
            )
            request = SimpleNamespace(
                config=SimpleNamespace(low_confidence_threshold=0.65),
            )
            refs = service._commit_production_governance(
                dataset_id="dataset-integration",
                mode="keyword_analysis",
                dataset_root=dataset_root,
                source_documents=source_documents,
                processing_units=units,
                evidence_records=[{
                    "candidateId": "candidate-1",
                    "chunkId": "resource-1:0",
                    "evidenceText": text,
                    "schemaVersion": "2.0.0",
                }],
                nodes=[{"id": "keyword-1", "type": "Keyword"}],
                edges=[],
                keyword_chunk_index={"keyword-1": ["resource-1:0"]},
                request=request,
            )
            self.assertEqual(refs["lineage"]["status"], "verified")
            self.assertTrue((dataset_root / "governance/lineage-manifest.json").is_file())
            manifest = json.loads(
                (dataset_root / "governance/lineage-manifest.json").read_text(encoding="utf-8")
            )
            self.assertTrue(manifest["manifestFingerprint"]["digest"])
            self.assertFalse(list(dataset_root.glob(".governance-staging-*")))


if __name__ == "__main__":
    unittest.main()
