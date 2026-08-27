import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory

from app.repositories.keyword_filter_run_repository import (
    KeywordFilterRunAlreadyExistsError,
    KeywordFilterRunImmutableSnapshotError,
    KeywordFilterRunRevisionConflictError,
    KeywordFilterRunStateError,
    LocalKeywordFilterRunRepository,
)


class KeywordFilterRunRepositoryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.repository = LocalKeywordFilterRunRepository(self.root)
        self.dataset_id = "dataset-1"
        self.filter_run_id = "kfr-1"

    def tearDown(self):
        self.temporary.cleanup()

    @staticmethod
    def candidates(total=3):
        return [
            {
                "keywordId": f"keyword:{index}",
                "keywordName": f"关键词 {index}",
                "keywordRawName": f"keyword {index}",
                "aliases": [f"K{index}"],
                "evidenceRefs": [f"chunk:{index}"],
            }
            for index in range(total)
        ]

    def create_run(self, *, run_id=None, created_at="2026-08-14T10:00:00+08:00", total=3):
        return self.repository.create_run(
            self.dataset_id,
            run_id or self.filter_run_id,
            {
                "createdAt": created_at,
                "skillVersion": "sha256:skill",
                "rulesVersion": "sha256:rules",
                "sourceGraphVersion": "sha256:graph",
                "modelProvider": None,
                "modelName": None,
            },
            self.candidates(total),
        )

    def test_create_run_publishes_complete_contract_and_reads_643_candidates(self):
        run = self.create_run(total=643)
        run_root = (
            self.root
            / "datasets"
            / self.dataset_id
            / "keyword-filter-runs"
            / self.filter_run_id
        )

        self.assertEqual(run["schemaVersion"], "1.0")
        self.assertEqual(run["revision"], 0)
        self.assertEqual(run["candidateTotal"], 643)
        self.assertEqual(len(self.repository.read_candidate_snapshot(
            self.dataset_id, self.filter_run_id
        )), 643)
        self.assertEqual(self.repository.read_review_decisions(
            self.dataset_id, self.filter_run_id
        ), [])
        self.assertIsNone(self.repository.read_model_decisions(
            self.dataset_id, self.filter_run_id
        ))
        self.assertIsNone(self.repository.read_final_decisions(
            self.dataset_id, self.filter_run_id
        ))
        self.assertEqual(self.repository.read_events(
            self.dataset_id, self.filter_run_id
        )[0]["type"], "run.created")
        self.assertEqual(
            {path.name for path in run_root.iterdir()},
            {"run.json", "candidate-snapshot.json", "review-decisions.json", "events.jsonl"},
        )
        self.assertEqual(list(run_root.glob(".*.tmp")), [])

    def test_same_run_cannot_be_created_twice_or_replace_candidate_snapshot(self):
        self.create_run()

        with self.assertRaises(KeywordFilterRunAlreadyExistsError):
            self.create_run()

        self.assertEqual(
            self.repository.read_candidate_snapshot(self.dataset_id, self.filter_run_id),
            self.candidates(),
        )

    def test_model_and_final_snapshots_are_immutable(self):
        self.create_run()
        model = [{"keywordId": "keyword:0", "modelAction": "exclude"}]
        run = self.repository.write_model_decisions(
            self.dataset_id,
            self.filter_run_id,
            model,
            expected_revision=0,
            run_updates={"decisionTotal": 1},
        )
        final = [{**model[0], "finalAction": "exclude"}]
        run = self.repository.write_final_decisions(
            self.dataset_id,
            self.filter_run_id,
            final,
            expected_revision=run["revision"],
            run_updates={"finalExclude": 1},
        )

        with self.assertRaises(KeywordFilterRunImmutableSnapshotError):
            self.repository.write_model_decisions(
                self.dataset_id, self.filter_run_id, [], expected_revision=run["revision"]
            )
        with self.assertRaises(KeywordFilterRunImmutableSnapshotError):
            self.repository.write_final_decisions(
                self.dataset_id, self.filter_run_id, [], expected_revision=run["revision"]
            )
        self.assertEqual(
            self.repository.read_model_decisions(self.dataset_id, self.filter_run_id), model
        )
        self.assertEqual(
            self.repository.read_final_decisions(self.dataset_id, self.filter_run_id), final
        )

    def test_review_snapshot_uses_revision_cas_and_records_events(self):
        self.create_run()
        review = [{"keywordId": "keyword:0", "finalAction": "keep"}]
        run = self.repository.write_review_decisions(
            self.dataset_id,
            self.filter_run_id,
            review,
            expected_revision=0,
            event={"type": "review.updated", "actor": "anonymous"},
        )

        self.assertEqual(run["revision"], 1)
        self.assertEqual(
            self.repository.read_review_decisions(self.dataset_id, self.filter_run_id),
            review,
        )
        self.assertEqual(
            [item["type"] for item in self.repository.read_events(
                self.dataset_id, self.filter_run_id
            )],
            ["run.created", "review.updated"],
        )
        with self.assertRaises(KeywordFilterRunRevisionConflictError) as context:
            self.repository.write_review_decisions(
                self.dataset_id, self.filter_run_id, [], expected_revision=0
            )
        self.assertEqual(context.exception.actual_revision, 1)

    def test_only_one_concurrent_writer_with_same_revision_succeeds(self):
        self.create_run()

        def update(marker):
            try:
                return self.repository.update_run(
                    self.dataset_id,
                    self.filter_run_id,
                    {"marker": marker},
                    expected_revision=0,
                    event={"type": "run.updated", "marker": marker},
                )
            except KeywordFilterRunRevisionConflictError as exc:
                return exc

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(update, ["a", "b"]))

        successes = [item for item in results if isinstance(item, dict)]
        conflicts = [
            item for item in results if isinstance(item, KeywordFilterRunRevisionConflictError)
        ]
        self.assertEqual(len(successes), 1)
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(self.repository.read_run(
            self.dataset_id, self.filter_run_id
        )["revision"], 1)

    def test_state_machine_prevents_backward_transition_and_freezes_applied_review(self):
        self.create_run()
        run = self.repository.transition_run(
            self.dataset_id, self.filter_run_id, "running", expected_revision=0
        )
        run = self.repository.transition_run(
            self.dataset_id, self.filter_run_id, "reviewable",
            expected_revision=run["revision"],
        )
        run = self.repository.transition_run(
            self.dataset_id, self.filter_run_id, "applied",
            expected_revision=run["revision"],
        )

        with self.assertRaises(KeywordFilterRunStateError):
            self.repository.transition_run(
                self.dataset_id, self.filter_run_id, "running",
                expected_revision=run["revision"],
            )
        with self.assertRaises(KeywordFilterRunImmutableSnapshotError):
            self.repository.write_review_decisions(
                self.dataset_id, self.filter_run_id, [], expected_revision=run["revision"]
            )

    def test_list_runs_is_descending_paginated_and_reads_only_run_json(self):
        self.create_run(run_id="kfr-1", created_at="2026-08-14T10:00:00+08:00")
        self.create_run(run_id="kfr-2", created_at="2026-08-14T11:00:00+08:00")
        self.create_run(run_id="kfr-3", created_at="2026-08-14T12:00:00+08:00")
        damaged_decisions = (
            self.root / "datasets" / self.dataset_id / "keyword-filter-runs"
            / "kfr-3" / "model-decisions.json"
        )
        damaged_decisions.write_text("not-json", encoding="utf-8")

        page = self.repository.list_runs(self.dataset_id, offset=1, limit=1)

        self.assertEqual(page["total"], 3)
        self.assertEqual(page["items"][0]["filterRunId"], "kfr-2")
        self.assertEqual(page["offset"], 1)
        self.assertEqual(page["limit"], 1)

    def test_fingerprints_are_canonical_and_candidate_order_independent(self):
        left = {"b": 2, "a": "事务"}
        right = {"a": "事务", "b": 2}
        self.assertEqual(
            self.repository.fingerprint_json(left), self.repository.fingerprint_json(right)
        )
        candidates = self.candidates()
        self.assertEqual(
            self.repository.fingerprint_candidates(candidates),
            self.repository.fingerprint_candidates(list(reversed(candidates))),
        )
        file_path = self.root / "skill.md"
        file_path.write_bytes(b"skill-v1")
        self.assertEqual(
            self.repository.fingerprint_file(file_path),
            self.repository.fingerprint_bytes(b"skill-v1"),
        )

    def test_atomic_snapshot_files_are_valid_json_and_jsonl(self):
        self.create_run()
        run_root = (
            self.root / "datasets" / self.dataset_id / "keyword-filter-runs" / self.filter_run_id
        )
        for name in ("run.json", "candidate-snapshot.json", "review-decisions.json"):
            json.loads((run_root / name).read_text(encoding="utf-8"))
        for line in (run_root / "events.jsonl").read_text(encoding="utf-8").splitlines():
            json.loads(line)


if __name__ == "__main__":
    unittest.main()
