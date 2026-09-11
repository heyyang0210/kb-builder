import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app.repositories.artifact_repository import LocalArtifactRepository
from app.repositories.artifact_repository import ArtifactIntegrityError


class ArtifactReadTests(unittest.TestCase):
    def setUp(self):
        self.repository = LocalArtifactRepository()

    def test_json_default(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            default = {"状态": "默认"}
            self.assertIs(self.repository.read_json(root / "missing.json", default), default)

            damaged = root / "damaged.json"
            damaged.write_text("{not-json", encoding="utf-8")
            self.assertIs(self.repository.read_json(damaged, default), default)

            unreadable = root / "unreadable.json"
            unreadable.write_text('{"value": 1}', encoding="utf-8")
            with patch.object(Path, "read_text", side_effect=OSError("读取失败")):
                self.assertIs(self.repository.read_json(unreadable, default), default)

    def test_jsonl_tolerates_bad_lines(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "mixed.jsonl"
            path.write_text(
                '{"id": 1, "名称": "事务"}\n\ninvalid\n{"id": 2, "名称": "索引"}\n',
                encoding="utf-8",
            )

            self.assertEqual(
                self.repository.read_jsonl(path),
                [{"id": 1, "名称": "事务"}, {"id": 2, "名称": "索引"}],
            )


class ArtifactRoundTripTests(unittest.TestCase):
    def setUp(self):
        self.repository = LocalArtifactRepository()

    def test_json_round_trip(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "nested" / "artifact.json"
            value = {
                "名称": "事务隔离级别",
                "enabled": True,
                "optional": None,
                "nested": {"items": [1, 2, 3]},
            }

            self.repository.write_json(path, value)

            self.assertEqual(self.repository.read_json(path), value)
            self.assertIn("事务隔离级别", path.read_text(encoding="utf-8"))

    def test_jsonl_format(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            populated = root / "populated.jsonl"
            empty = root / "empty.jsonl"

            self.repository.write_jsonl(populated, [{"id": 1}, {"id": 2}])
            self.repository.write_jsonl(empty, [])

            content = populated.read_text(encoding="utf-8")
            self.assertTrue(content.endswith("\n"))
            self.assertEqual(content.splitlines(), ['{"id": 1}', '{"id": 2}'])
            self.assertEqual(empty.read_bytes(), b"")

    def test_text_write_creates_parent(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "nested" / "说明.txt"

            self.repository.write_text(path, "原子写入中文文本")

            self.assertEqual(path.read_text(encoding="utf-8"), "原子写入中文文本")


class ArtifactAtomicWriteTests(unittest.TestCase):
    def setUp(self):
        self.repository = LocalArtifactRepository()

    def test_atomic_replace_success(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            json_path = root / "artifact.json"
            text_path = root / "artifact.txt"
            json_path.write_text('{"version": "old"}', encoding="utf-8")
            text_path.write_text("旧文本", encoding="utf-8")

            self.repository.write_json(json_path, {"version": "new"})
            self.repository.write_text(text_path, "新文本")

            self.assertEqual(json.loads(json_path.read_text(encoding="utf-8")), {"version": "new"})
            self.assertEqual(text_path.read_text(encoding="utf-8"), "新文本")
            self.assertFalse(json_path.with_suffix(".json.tmp").exists())
            self.assertFalse(text_path.with_suffix(".txt.tmp").exists())

    def test_atomic_replace_failure_preserves_old_file(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "artifact.json"
            old_bytes = b'{"version": "old"}'
            path.write_bytes(old_bytes)

            with patch.object(Path, "replace", side_effect=OSError("替换失败")):
                with self.assertRaisesRegex(OSError, "替换失败"):
                    self.repository.write_json(path, {"version": "new"})

            self.assertEqual(path.read_bytes(), old_bytes)

    def test_concurrent_writers_never_publish_partial_json(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "artifact.json"
            values = [{"writer": index, "content": "x" * 1000} for index in range(32)]
            with ThreadPoolExecutor(max_workers=32) as executor:
                list(executor.map(lambda value: self.repository.write_json(path, value), values))

            self.assertIn(json.loads(path.read_text(encoding="utf-8")), values)
            self.assertEqual(list(path.parent.glob(f".{path.name}.*.tmp")), [])


class CommittedArtifactReadTests(unittest.TestCase):
    def setUp(self):
        self.repository = LocalArtifactRepository()

    def test_bad_record_can_be_isolated_when_policy_allows(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            repository = LocalArtifactRepository()
            stage = root / "batches/batch-1/preparation"
            staging = repository.begin_snapshot(stage, "prep-1")
            path = staging / "metadata/chunks.jsonl"
            path.parent.mkdir(parents=True)
            path.write_text('{"id": 1}\ninvalid\n{"id": 2}\n', encoding="utf-8")
            ref = repository.commit_snapshot(
                staging, batch_id="batch-1", stage="preparation", run_id="prep-1",
                input_hash="sha256:input", execution_hash="sha256:execution",
                generation=1, artifact_paths=["metadata/chunks.jsonl"], data_root=root,
            )

            records, issues = repository.read_committed_jsonl(
                ref, "metadata/chunks.jsonl", root,
                {"maxRecordRatio": 1.0, "maxRecordCount": 1,
                 "redactedPrefixCharacters": 8, "redactedSuffixCharacters": 8},
            )

            self.assertEqual(records, [{"id": 1}, {"id": 2}])
            self.assertEqual(issues[0]["lineNumber"], 2)
            self.assertNotIn("invalid", json.dumps(issues, ensure_ascii=False))

    def test_file_hash_mismatch_blocks_read(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            repository = LocalArtifactRepository()
            stage = root / "batches/batch-1/preparation"
            staging = repository.begin_snapshot(stage, "prep-1")
            path = staging / "metadata/chunks.jsonl"
            path.parent.mkdir(parents=True)
            path.write_text('{"id": 1}\n', encoding="utf-8")
            ref = repository.commit_snapshot(
                staging, batch_id="batch-1", stage="preparation", run_id="prep-1",
                input_hash="sha256:input", execution_hash="sha256:execution",
                generation=1, artifact_paths=["metadata/chunks.jsonl"], data_root=root,
            )
            (root / ref.manifest_path).parent.joinpath("metadata/chunks.jsonl").write_text(
                '{"id": 2}\n', encoding="utf-8"
            )

            with self.assertRaises(ArtifactIntegrityError):
                repository.read_committed_jsonl(
                    ref, "metadata/chunks.jsonl", root,
                    {"maxRecordRatio": 1.0, "maxRecordCount": 1,
                     "redactedPrefixCharacters": 8, "redactedSuffixCharacters": 8},
                )

    def test_truncated_final_record_blocks_even_when_manifest_matches(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            repository = LocalArtifactRepository()
            staging = repository.begin_snapshot(root / "batches/batch-1/preparation", "prep-1")
            path = staging / "metadata/chunks.jsonl"
            path.parent.mkdir(parents=True)
            path.write_text('{"id": 1}\n{"id": "truncated', encoding="utf-8")
            ref = repository.commit_snapshot(
                staging, batch_id="batch-1", stage="preparation", run_id="prep-1",
                input_hash="sha256:input", execution_hash="sha256:execution",
                generation=1, artifact_paths=["metadata/chunks.jsonl"], data_root=root,
            )

            with self.assertRaisesRegex(ArtifactIntegrityError, "尾部记录被截断"):
                repository.read_committed_jsonl(
                    ref, "metadata/chunks.jsonl", root,
                    {"maxRecordRatio": 1.0, "maxRecordCount": 10,
                     "redactedPrefixCharacters": 8, "redactedSuffixCharacters": 8},
                )

    def test_atomic_write_failure_preserves_old_file(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "artifact.txt"
            old_bytes = "旧文本".encode("utf-8")
            path.write_bytes(old_bytes)
            original_write_text = Path.write_text

            def fail_temporary_write(candidate, *args, **kwargs):
                if candidate != path:
                    raise OSError("临时文件写入失败")
                return original_write_text(candidate, *args, **kwargs)

            with patch.object(Path, "write_text", autospec=True, side_effect=fail_temporary_write):
                with self.assertRaisesRegex(OSError, "临时文件写入失败"):
                    self.repository.write_text(path, "新文本")

            self.assertEqual(path.read_bytes(), old_bytes)


class ArtifactCopyTests(unittest.TestCase):
    def setUp(self):
        self.repository = LocalArtifactRepository()

    def test_embedding_cache_copy(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            target = root / "target"
            source_cache = source / "model-results" / "embedding-cache"
            target_cache = target / "model-results" / "embedding-cache"
            source_cache.mkdir(parents=True)
            target_cache.mkdir(parents=True)
            (source_cache / "new.json").write_text('{"vector": [1]}', encoding="utf-8")
            (target_cache / "stale.json").write_text("stale", encoding="utf-8")

            self.repository.copy_embedding_cache(source, target)

            self.assertEqual((target_cache / "new.json").read_text(encoding="utf-8"), '{"vector": [1]}')
            self.assertFalse((target_cache / "stale.json").exists())

            missing_source = root / "missing-source"
            (target_cache / "stale-again.json").write_text("stale", encoding="utf-8")
            self.repository.copy_embedding_cache(missing_source, target)

            self.assertTrue(target_cache.is_dir())
            self.assertEqual(list(target_cache.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
