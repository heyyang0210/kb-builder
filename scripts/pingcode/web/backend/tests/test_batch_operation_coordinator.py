import json
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from app.batch_operation_coordinator import BatchOperationCoordinator
from app.models import ArtifactSnapshotRef
from app.repositories.artifact_repository import ArtifactIntegrityError


class BatchOperationCoordinatorTests(unittest.TestCase):
    def test_same_execution_hash_has_one_owner(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / "batch-1"
            coordinator = BatchOperationCoordinator(root)
            barrier = threading.Barrier(32)

            def reserve(index):
                barrier.wait()
                return coordinator.reserve_flight(
                    batch_root, "preparation", "sha256:same", f"owner-{index}"
                ).state

            with ThreadPoolExecutor(max_workers=32) as executor:
                states = list(executor.map(reserve, range(32)))

            self.assertEqual(states.count("owner"), 1)
            self.assertEqual(states.count("follower"), 31)

    def test_completed_flight_is_reused(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / "batch-1"
            coordinator = BatchOperationCoordinator(root)
            flight = coordinator.reserve_flight(batch_root, "preparation", "sha256:x", "owner")
            ref = ArtifactSnapshotRef(
                batch_id="batch-1", stage="preparation", run_id="prep-1",
                input_hash="sha256:input", manifest_path="manifest.json",
                manifest_hash="sha256:manifest", generation=1,
            )
            coordinator.complete_flight(batch_root, "preparation", "sha256:x", ref)

            reused = coordinator.reserve_flight(batch_root, "preparation", "sha256:x", "other")

            self.assertEqual(reused.state, "completed")
            self.assertEqual(reused.snapshot_ref, ref)

    def test_latest_compare_and_swap_rejects_late_writer(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / "batch-1"
            coordinator = BatchOperationCoordinator(root)
            first = ArtifactSnapshotRef(
                batch_id="batch-1", stage="preparation", run_id="new",
                input_hash="sha256:new", manifest_path="new/manifest.json",
                manifest_hash="sha256:new-manifest", generation=1,
            )
            late = first.model_copy(update={"run_id": "old", "input_hash": "sha256:old"})

            self.assertTrue(coordinator.commit_latest(batch_root, first, 0))
            self.assertFalse(coordinator.commit_latest(batch_root, late, 0))
            latest = json.loads((batch_root / "preparation/latest.json").read_text(encoding="utf-8"))
            self.assertEqual(latest["runId"], "new")
            self.assertEqual(latest["generation"], 1)

    def test_corrupted_latest_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / "batch-1"
            latest = batch_root / "preparation/latest.json"
            latest.parent.mkdir(parents=True)
            latest.write_text("{broken", encoding="utf-8")
            coordinator = BatchOperationCoordinator(root)
            ref = ArtifactSnapshotRef(
                batch_id="batch-1", stage="preparation", run_id="run",
                input_hash="sha256:x", manifest_path="run/manifest.json",
                manifest_hash="sha256:y", generation=1,
            )

            with self.assertRaises(ArtifactIntegrityError):
                coordinator.commit_latest(batch_root, ref, 0)
            self.assertEqual(latest.read_text(encoding="utf-8"), "{broken")


if __name__ == "__main__":
    unittest.main()
