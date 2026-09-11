import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from app.batch_operation_coordinator import BatchOperationCoordinator
from app.repositories.artifact_repository import LocalArtifactRepository


class ArtifactSnapshotPerformanceTests(unittest.TestCase):
    def test_short_lock_p95_is_below_twenty_milliseconds(self):
        with tempfile.TemporaryDirectory() as directory:
            coordinator = BatchOperationCoordinator(Path(directory))
            samples = []
            for _ in range(200):
                started = time.perf_counter_ns()
                with coordinator.lock("batch:latest"):
                    pass
                samples.append((time.perf_counter_ns() - started) / 1_000_000)
            samples.sort()
            p95 = samples[int(len(samples) * 0.95) - 1]
            self.assertLess(p95, 20, f"短锁 P95={p95:.3f}ms")

    def test_one_hundred_readers_get_identical_committed_records(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            repository = LocalArtifactRepository()
            stage = root / "batches/batch-1/preparation"
            staging = repository.begin_snapshot(stage, "prep-1")
            artifact = staging / "metadata/chunks.jsonl"
            artifact.parent.mkdir(parents=True)
            repository.write_jsonl(artifact, [{"id": index} for index in range(10)])
            ref = repository.commit_snapshot(
                staging, batch_id="batch-1", stage="preparation", run_id="prep-1",
                input_hash="sha256:input", execution_hash="sha256:execution",
                generation=1, artifact_paths=["metadata/chunks.jsonl"], data_root=root,
            )
            policy = {
                "maxRecordRatio": 0.001, "maxRecordCount": 10,
                "redactedPrefixCharacters": 80, "redactedSuffixCharacters": 80,
            }

            with ThreadPoolExecutor(max_workers=100) as executor:
                results = list(executor.map(
                    lambda _: repository.read_committed_jsonl(
                        ref, "metadata/chunks.jsonl", root, policy
                    )[0],
                    range(100),
                ))

            self.assertTrue(all(result == results[0] for result in results))


if __name__ == "__main__":
    unittest.main()
