import io
import json
import tarfile
import tempfile
import unittest
import zipfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import app.preparation_service as preparation_module
import app.services as services_module
import app.metadata_service as metadata_module
from app.config import settings
from app.preparation_service import (
    ArchiveLimits,
    DefaultFormatDetector,
    MaterialPreparationService,
)
from app.services import FileService, PreprocessService, TaskService
from app.store import JsonStore
from app.metadata_service import MetadataConstructionService
from app.models import PreprocessConfig, PreprocessPreviewRequest


class _BatchLookup:
    def get(self, batch_id):
        if batch_id != "batch_test0000000000":
            raise KeyError(batch_id)
        return {"id": batch_id}


class FormatDetectorTests(unittest.TestCase):
    def test_office_extension_takes_precedence_over_zip_magic(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "example.docx"
            path.write_bytes(b"PK\x03\x04office")
            detection = DefaultFormatDetector().detect(path)
        self.assertEqual(detection.format_family, "office")
        self.assertEqual(detection.processing_status, "processable")

    def test_archive_member_path_rejects_traversal(self):
        with self.assertRaises(ValueError):
            MaterialPreparationService._safe_member_path("../outside.txt")
        with self.assertRaises(ValueError):
            MaterialPreparationService._safe_member_path("/absolute.txt")

    def test_executable_magic_is_quarantined_even_with_text_suffix(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "renamed.txt"
            path.write_bytes(b"MZ" + (b"\x00" * 30))
            detection = DefaultFormatDetector().detect(path)
        self.assertEqual(detection.processing_status, "quarantined")
        self.assertEqual(detection.format_family, "unknown")


class MaterialPreparationTests(unittest.TestCase):
    batch_id = "batch_test0000000000"

    def test_metadata_build_requires_explicit_preparation_snapshot(self):
        service = MetadataConstructionService(_BatchLookup(), FileService())
        with self.assertRaises(TypeError):
            service.build(self.batch_id)

    def test_safe_zip_is_extracted_and_images_are_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive_path = self._write_batch_archive(
                root,
                {
                    "docs/readme.md": b"# readme",
                    "assets/diagram.png": b"\x89PNG\r\n\x1a\nimage",
                },
            )
            report = self._prepare(root)
            self.assertEqual(report.state, "completed")
            self.assertEqual(report.archive_resources, 1)
            self.assertEqual(report.extracted_resources, 2)
            self.assertEqual(report.processable_resources, 1)
            self.assertEqual(report.image_resources, 1)
            manifest = json.loads((root / report.manifest_path).read_text(encoding="utf-8"))
            children = [item for item in manifest["resources"] if item["isExtracted"]]
            self.assertTrue(all(item["parentResourceId"] == "archive-resource" for item in children))
            self.assertEqual({item["formatFamily"] for item in children}, {"text", "image"})
            self.assertTrue(archive_path.exists())

    def test_unsafe_zip_is_quarantined_without_writing_outside(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_batch_archive(root, {"../outside.txt": b"unsafe"})
            report = self._prepare(root)
            self.assertEqual(report.state, "completed_with_warnings")
            self.assertEqual(report.extracted_resources, 0)
            self.assertEqual(report.quarantined_resources, 1)
            self.assertEqual(report.security_issue_count, 1)
            self.assertIn("ARCHIVE_UNSAFE_PATH", {item.code for item in report.issues})
            self.assertFalse((root / "outside.txt").exists())

    def test_safe_tar_is_extracted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / self.batch_id
            archive_path = batch_root / "original" / "files" / "bundle.tar"
            archive_path.parent.mkdir(parents=True)
            content = b"# tar document"
            with tarfile.open(archive_path, "w") as archive:
                member = tarfile.TarInfo("docs/readme.md")
                member.size = len(content)
                archive.addfile(member, io.BytesIO(content))
            self._register_archive(root, archive_path)
            report = self._prepare(root)
            self.assertEqual(report.state, "completed")
            self.assertEqual(report.archive_resources, 1)
            self.assertEqual(report.extracted_resources, 1)
            self.assertEqual(report.processable_resources, 1)

    def test_nested_archive_stops_at_configured_depth(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            nested = io.BytesIO()
            with zipfile.ZipFile(nested, "w") as archive:
                archive.writestr("deep.md", "deep")
            self._write_batch_archive(root, {"nested.zip": nested.getvalue()})
            limits = ArchiveLimits(
                max_files=20,
                max_bytes=1024 * 1024,
                max_depth=1,
                max_expansion_ratio=1000,
            )
            report = self._prepare(root, limits)
            self.assertEqual(report.archive_resources, 2)
            self.assertEqual(report.extracted_resources, 1)
            self.assertEqual(report.quarantined_resources, 1)
            self.assertIn("ARCHIVE_MAX_DEPTH", {item.code for item in report.issues})

    def test_text_document_writes_three_layer_artifacts_and_structure_units(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / self.batch_id
            source = batch_root / "original" / "files" / "guide.md"
            source.parent.mkdir(parents=True)
            source.write_text("# 总览\n\n第一段。\n\n- 条目一\n- 条目二\n\n## 细节\n\n第二段。", encoding="utf-8")
            self._register_archive(root, source)
            resources = json.loads((batch_root / "resources.json").read_text(encoding="utf-8"))
            resources[0]["id"] = "text-resource"
            (batch_root / "resources.json").write_text(json.dumps(resources), encoding="utf-8")
            report = self._prepare(root)
            run_root = root / report.manifest_path
            run_root = run_root.parent
            self.assertTrue((run_root / "originals" / "text-resource.md").exists())
            self.assertTrue((run_root / "normalized" / "text-resource.md").exists())
            chunks = (run_root / "metadata" / "chunks.jsonl").read_text(encoding="utf-8").splitlines()
            blocks = (run_root / "metadata" / "structure-blocks.jsonl").read_text(encoding="utf-8").splitlines()
            source_resources = [json.loads(line) for line in (run_root / "metadata/source-resources.jsonl").read_text(encoding="utf-8").splitlines()]
            source_assets = (run_root / "metadata/source-assets.jsonl").read_text(encoding="utf-8").splitlines()
            ingestion_report = json.loads((run_root / "metadata/ingestion-report.json").read_text(encoding="utf-8"))
            self.assertGreaterEqual(len(chunks), 1)
            self.assertGreaterEqual(len(blocks), 3)
            self.assertEqual(source_resources[0]["resourceId"], "text-resource")
            self.assertEqual(source_resources[0]["processingState"], "completed")
            self.assertEqual(source_resources[0]["normalizedArtifact"], "batches/batch_test0000000000/preparation/runs/" + report.run_id + "/normalized/text-resource.md")
            self.assertEqual(source_assets, [])
            self.assertEqual(ingestion_report["resourceCount"], 1)
            self.assertEqual(ingestion_report["processingUnitCount"], len(chunks))
            self.assertTrue((run_root / "stage-result.json").exists())

    def test_c_code_is_excluded_from_processing_view_but_original_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / self.batch_id
            source = batch_root / "original" / "files" / "guide.md"
            source.parent.mkdir(parents=True)
            original = "# 参数说明\n\n配置项 max_connections 控制连接数。\n\n位置：`src/plsql/interface/dml_def.h:310`\n\n```c\n#include <stdio.h>\nint main(void) { return 0; }\n```\n\n```sql\nSELECT * FROM dual;\n```\n\n## 相关源文件\n\n- `src/plsql/verifier/vrfr_select.c` - SELECT 校验中表函数处理\n\n## 后续说明\n\n文档正文继续保留。"
            source.write_text(original, encoding="utf-8")
            self._register_archive(root, source)
            resources = json.loads((batch_root / "resources.json").read_text(encoding="utf-8"))
            resources[0]["id"] = "code-resource"
            (batch_root / "resources.json").write_text(json.dumps(resources), encoding="utf-8")

            report = self._prepare(root)
            run_root = (root / report.manifest_path).parent
            persisted_original = (run_root / "originals/code-resource.md").read_text(encoding="utf-8")
            normalized = (run_root / "normalized/code-resource.md").read_text(encoding="utf-8")
            source_document = json.loads((run_root / "metadata/source-documents.jsonl").read_text(encoding="utf-8").splitlines()[0])
            chunks = [json.loads(line) for line in (run_root / "metadata/chunks.jsonl").read_text(encoding="utf-8").splitlines()]

            self.assertEqual(persisted_original, original)
            self.assertNotIn("#include", normalized)
            self.assertNotIn("src/plsql/interface/dml_def.h", normalized)
            self.assertNotIn("src/plsql/verifier/vrfr_select.c", normalized)
            self.assertIn("SELECT * FROM dual", normalized)
            self.assertIn("文档正文继续保留", normalized)
            self.assertEqual(source_document["excludedRanges"][0]["detectionMethod"], "language_tag")
            self.assertTrue(all("#include" not in item["content"] for item in chunks))
            self.assertTrue(all("src/plsql/" not in item["content"] for item in chunks))
            self.assertTrue(all("processing-excluded:c-code" not in item["content"] for item in chunks))
            self.assertTrue(any(item.code == "C_CODE_BLOCK_EXCLUDED" for item in report.issues))

    def test_structure_split_preserves_heading_offsets_and_neighbors_after_exclusion(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / self.batch_id
            source = batch_root / "original" / "files" / "long.md"
            source.parent.mkdir(parents=True)
            paragraph = "参数 p_size 控制数据块大小。" * 12
            source.write_text(
                f"# 参数设计\n\n{paragraph}\n\n```c\nint main(void) {{ return 0; }}\n```\n\n## 限制\n\n{paragraph}",
                encoding="utf-8",
            )
            self._register_archive(root, source)
            resources = json.loads((batch_root / "resources.json").read_text(encoding="utf-8"))
            resources[0]["id"] = "long-resource"
            (batch_root / "resources.json").write_text(json.dumps(resources), encoding="utf-8")
            test_settings = replace(settings, data_root=root)
            with (
                patch.object(preparation_module, "settings", test_settings),
                patch.object(services_module, "settings", test_settings),
            ):
                report = MaterialPreparationService(_BatchLookup(), FileService()).prepare(
                    self.batch_id,
                    PreprocessConfig(chunk_size=200),
                )
            run_root = (root / report.manifest_path).parent
            chunks = [json.loads(line) for line in (run_root / "metadata/chunks.jsonl").read_text(encoding="utf-8").splitlines()]
            self.assertGreater(len(chunks), 2)
            self.assertTrue(all(len(item["content"]) <= 200 for item in chunks))
            self.assertTrue(all(item["normalizedOffsets"]["start"] < item["normalizedOffsets"]["end"] for item in chunks))
            self.assertIsNone(chunks[0]["previousChunkId"])
            self.assertIsNone(chunks[-1]["nextChunkId"])
            self.assertTrue(all("int main" not in item["content"] for item in chunks))

    def test_docx_preparation_preserves_embedded_images_as_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / self.batch_id
            source = batch_root / "original" / "files" / "guide.docx"
            source.parent.mkdir(parents=True)
            source.write_bytes(self._docx_with_image_bytes())
            self._register_archive(root, source)

            report = self._prepare(root)

            run_root = (root / report.manifest_path).parent
            source_docs = [json.loads(line) for line in (run_root / "metadata/source-documents.jsonl").read_text(encoding="utf-8").splitlines()]
            normalized = (root / source_docs[0]["normalizedArtifact"]).read_text(encoding="utf-8")
            self.assertIn("![DOCX 图片](../assets/archive-resource/image1.png)", normalized)
            self.assertTrue((run_root / "assets/archive-resource/image1.png").is_file())
            self.assertEqual(source_docs[0]["imageCount"], 1)
            self.assertEqual(source_docs[0]["preservedImageCount"], 1)
            self.assertEqual(source_docs[0]["assetPaths"], [(run_root / "assets/archive-resource/image1.png").relative_to(root).as_posix()])

    def test_metadata_builds_rule_contexts_without_model(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / self.batch_id
            source = batch_root / "original" / "files" / "guide.md"
            source.parent.mkdir(parents=True)
            source.write_text("# 连接配置\n\nYAS-00001 适用于 v23.2.1。\n\n## 测试设计\n\n测试步骤。", encoding="utf-8")
            self._register_archive(root, source)
            resources = json.loads((batch_root / "resources.json").read_text(encoding="utf-8"))
            resources[0]["id"] = "metadata-resource"
            (batch_root / "resources.json").write_text(json.dumps(resources), encoding="utf-8")
            test_settings = replace(settings, data_root=root)
            with (
                patch.object(preparation_module, "settings", test_settings),
                patch.object(metadata_module, "settings", test_settings),
                patch.object(services_module, "settings", test_settings),
            ):
                preparation = MaterialPreparationService(_BatchLookup(), FileService())
                preparation_report = preparation.prepare(self.batch_id)
                report = MetadataConstructionService(_BatchLookup(), FileService()).build(
                    self.batch_id, preparation_snapshot=preparation_report.snapshot_ref
                )
            self.assertEqual(report.documents_count, 1)
            metadata_root = root / report.stage_result_path
            metadata_root = metadata_root.parent
            documents = [json.loads(item) for item in (metadata_root / "metadata/documents.jsonl").read_text(encoding="utf-8").splitlines()]
            contexts = [json.loads(item) for item in (metadata_root / "metadata/chunk-contexts.jsonl").read_text(encoding="utf-8").splitlines()]
            self.assertEqual(documents[0]["summaryMethod"], "extractive_rule")
            self.assertEqual(documents[0]["titleSource"], "heading")
            self.assertIn("titleNoiseRemoved", documents[0])
            self.assertIn("topicCandidates", documents[0])
            self.assertIn("YAS-00001", documents[0]["keywords"])
            self.assertEqual(contexts[0]["summaryMethod"], "extractive_rule")
            self.assertIn("titleNoiseRemoved", contexts[0])
            self.assertIn("topicCandidates", contexts[0])
            self.assertTrue(any(item["termId"] == "yashandb.error_code" for item in documents[0]["domainTerms"]))
            self.assertIn("ruleSetHash", documents[0])

    def test_metadata_writes_title_audit_topic_candidates_and_preselection_report(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / self.batch_id
            source = batch_root / "original" / "files" / "YashanDB DSI_Replication内幕文档 (1).md"
            source.parent.mkdir(parents=True)
            source.write_text("Replication 负责复制日志。", encoding="utf-8")
            self._register_archive(root, source)
            resources = json.loads((batch_root / "resources.json").read_text(encoding="utf-8"))
            resources[0]["id"] = "metadata-resource"
            (batch_root / "resources.json").write_text(json.dumps(resources), encoding="utf-8")
            test_settings = replace(settings, data_root=root)
            with (
                patch.object(preparation_module, "settings", test_settings),
                patch.object(metadata_module, "settings", test_settings),
                patch.object(services_module, "settings", test_settings),
            ):
                preparation_report = MaterialPreparationService(_BatchLookup(), FileService()).prepare(self.batch_id)
                report = MetadataConstructionService(_BatchLookup(), FileService()).build(
                    self.batch_id, preparation_snapshot=preparation_report.snapshot_ref
                )
            metadata_root = (root / report.stage_result_path).parent
            documents = [json.loads(item) for item in (metadata_root / "metadata/documents.jsonl").read_text(encoding="utf-8").splitlines()]
            contexts = [json.loads(item) for item in (metadata_root / "metadata/chunk-contexts.jsonl").read_text(encoding="utf-8").splitlines()]
            preselection = json.loads((metadata_root / "metadata/preselection-report.json").read_text(encoding="utf-8"))

            self.assertEqual(documents[0]["semanticTitle"], "Replication")
            removed_values = {item["value"] for item in documents[0]["titleNoiseRemoved"]}
            self.assertIn("YashanDB", removed_values)
            self.assertIn("DSI", removed_values)
            self.assertTrue(documents[0]["topicCandidates"])
            self.assertEqual(documents[0]["topicCandidates"][0]["sourceMethod"], "deterministic_title_glossary")
            self.assertEqual(contexts[0]["topicCandidates"][0]["name"], "Replication")
            self.assertEqual(preselection["items"][0]["preselectionState"], "deterministic_ready")
            self.assertEqual(preselection["items"][0]["sourceMethods"], ["deterministic_title_glossary"])
            embedding_index = [json.loads(item) for item in (metadata_root / "metadata/embedding-index.jsonl").read_text(encoding="utf-8").splitlines()]
            embedding_issues = json.loads((metadata_root / "quality/embedding-issues.json").read_text(encoding="utf-8"))
            cluster_report = json.loads((metadata_root / "metadata/cluster-report.json").read_text(encoding="utf-8"))
            cluster_issues = json.loads((metadata_root / "quality/cluster-issues.json").read_text(encoding="utf-8"))
            self.assertEqual(len(embedding_index), 1)
            self.assertEqual(embedding_index[0]["provider"], "deterministic_hash")
            self.assertIn("embeddingId", embedding_index[0])
            self.assertIn("vectorHash", embedding_index[0])
            self.assertEqual(embedding_issues, [])
            self.assertEqual(cluster_report["summary"]["embeddingCount"], 1)
            self.assertEqual(cluster_issues, [])
            self.assertNotIn("apiKey", json.dumps(embedding_index, ensure_ascii=False))

    def test_preselection_report_marks_model_required_and_skip(self):
        service = MetadataConstructionService(_BatchLookup(), FileService())
        service.rules = {
            "version": "test",
            "titleCleaning": {"titleTopicMaxCharacters": 40},
            "stopwords": set(),
            "keywordExclusionPatterns": [],
        }
        service.rule_set_hash = "sha256:test"
        report = service.build_preselection_report(
            [
                {"resourceId": "model", "semanticTitle": "事务机制", "topicCandidates": []},
                {"resourceId": "skip", "semanticTitle": "", "topicCandidates": []},
            ],
            [{"resourceId": "model", "chunkId": "model:0"}],
        )
        states = {item["resourceId"]: item["preselectionState"] for item in report["items"]}
        self.assertEqual(states["model"], "model_required")
        self.assertEqual(states["skip"], "skip")

    def test_metadata_uses_filename_title_without_missing_title_issue(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / self.batch_id
            source = batch_root / "original" / "files" / "feature-test-plan.md"
            source.parent.mkdir(parents=True)
            source.write_text("设计和测试内容同时出现，适用于 v23.2.1。\n\n这里没有 Markdown 标题。", encoding="utf-8")
            self._register_archive(root, source)
            resources = json.loads((batch_root / "resources.json").read_text(encoding="utf-8"))
            resources[0]["id"] = "metadata-resource"
            (batch_root / "resources.json").write_text(json.dumps(resources), encoding="utf-8")
            test_settings = replace(settings, data_root=root)
            with (
                patch.object(preparation_module, "settings", test_settings),
                patch.object(metadata_module, "settings", test_settings),
                patch.object(services_module, "settings", test_settings),
            ):
                preparation = MaterialPreparationService(_BatchLookup(), FileService())
                preparation_report = preparation.prepare(self.batch_id)
                report = MetadataConstructionService(_BatchLookup(), FileService()).build(
                    self.batch_id, preparation_snapshot=preparation_report.snapshot_ref
                )
            metadata_root = (root / report.stage_result_path).parent
            documents = [json.loads(item) for item in (metadata_root / "metadata/documents.jsonl").read_text(encoding="utf-8").splitlines()]
            issues = json.loads((metadata_root / "quality/metadata-issues.json").read_text(encoding="utf-8"))
            self.assertEqual(documents[0]["title"], "feature-test-plan")
            self.assertEqual(documents[0]["titleSource"], "filename")
            self.assertNotIn("feature-test-plan", documents[0]["keywords"])
            self.assertNotIn("METADATA_TITLE_MISSING", {item["code"] for item in issues})
            conflict = next(item for item in issues if item["code"] == "METADATA_CATEGORY_CONFLICT")
            self.assertEqual(conflict["severity"], "info")

    def test_metadata_glossary_builds_data_dictionary_and_sequence_terms(self):
        service = MetadataConstructionService(_BatchLookup(), FileService())
        source_docs = [{
            "resourceId": "metadata-resource",
            "sourcePath": "YashanDB DSI_数据字典 (1).docx",
            "processingState": "completed",
        }]
        chunks = [{
            "id": "metadata-resource:0",
            "resourceId": "metadata-resource",
            "chunkIndex": 0,
            "content": "数据字典记录对象定义，SEQUENCE 用于生成序列值。",
            "headingPath": [],
        }]

        documents, contexts, issues = service.build_records(source_docs, chunks)

        self.assertFalse(any(item["severity"] == "error" for item in issues))
        self.assertEqual(documents[0]["title"], "YashanDB DSI_数据字典 (1)")
        self.assertNotIn(documents[0]["title"], documents[0]["keywords"])
        terms = {item["termId"]: item for item in documents[0]["domainTerms"]}
        self.assertIn("database.metadata.data_dictionary", terms)
        self.assertIn("database.object.sequence", terms)
        self.assertEqual(terms["database.metadata.data_dictionary"]["canonicalName"], "数据字典")
        self.assertEqual(terms["database.object.sequence"]["canonicalName"], "Sequence")
        self.assertIn("序列", terms["database.object.sequence"]["aliases"])
        self.assertEqual(contexts[0]["ruleSetHash"], service.rule_set_hash)

    def test_metadata_cleans_filename_noise_into_semantic_titles(self):
        service = MetadataConstructionService(_BatchLookup(), FileService())
        examples = {
            "Replication内幕": "Replication",
            "事务内幕文档": "事务",
            "LOB内幕文档": "LOB",
            "YashanDB-可变列式存储": "可变列式存储",
            "持久化": "持久化",
            "YashanDB DSI_数据字典 (1)": "数据字典",
        }

        self.assertEqual(
            {title: service._semantic_title(title) for title in examples},
            examples,
        )

    def test_metadata_does_not_warn_when_applicable_version_is_missing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / self.batch_id
            source = batch_root / "original" / "files" / "guide.md"
            source.parent.mkdir(parents=True)
            source.write_text("# 连接配置\n\n本文说明连接参数配置。", encoding="utf-8")
            self._register_archive(root, source)
            resources = json.loads((batch_root / "resources.json").read_text(encoding="utf-8"))
            resources[0]["id"] = "metadata-resource"
            (batch_root / "resources.json").write_text(json.dumps(resources), encoding="utf-8")
            test_settings = replace(settings, data_root=root)
            with (
                patch.object(preparation_module, "settings", test_settings),
                patch.object(metadata_module, "settings", test_settings),
                patch.object(services_module, "settings", test_settings),
            ):
                preparation = MaterialPreparationService(_BatchLookup(), FileService())
                preparation_report = preparation.prepare(self.batch_id)
                report = MetadataConstructionService(_BatchLookup(), FileService()).build(
                    self.batch_id, preparation_snapshot=preparation_report.snapshot_ref
                )
            metadata_root = (root / report.stage_result_path).parent
            documents = [json.loads(item) for item in (metadata_root / "metadata/documents.jsonl").read_text(encoding="utf-8").splitlines()]
            issues = json.loads((metadata_root / "quality/metadata-issues.json").read_text(encoding="utf-8"))
            self.assertEqual(documents[0]["applicableVersions"], [])
            self.assertNotIn("METADATA_VERSION_UNCLEAR", {item["code"] for item in issues})

    def test_unresolved_metadata_category_is_info_only(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_root = root / "batches" / self.batch_id
            source = batch_root / "original" / "files" / "misc.md"
            source.parent.mkdir(parents=True)
            source.write_text("# 临时说明\n\n这里只是普通说明内容，没有命中固定分类规则。", encoding="utf-8")
            self._register_archive(root, source)
            resources = json.loads((batch_root / "resources.json").read_text(encoding="utf-8"))
            resources[0]["id"] = "metadata-resource"
            (batch_root / "resources.json").write_text(json.dumps(resources), encoding="utf-8")
            test_settings = replace(settings, data_root=root)
            with (
                patch.object(preparation_module, "settings", test_settings),
                patch.object(metadata_module, "settings", test_settings),
                patch.object(services_module, "settings", test_settings),
            ):
                preparation = MaterialPreparationService(_BatchLookup(), FileService())
                preparation_report = preparation.prepare(self.batch_id)
                report = MetadataConstructionService(_BatchLookup(), FileService()).build(
                    self.batch_id, preparation_snapshot=preparation_report.snapshot_ref
                )
            metadata_root = (root / report.stage_result_path).parent
            documents = [json.loads(item) for item in (metadata_root / "metadata/documents.jsonl").read_text(encoding="utf-8").splitlines()]
            issues = json.loads((metadata_root / "quality/metadata-issues.json").read_text(encoding="utf-8"))
            self.assertEqual(documents[0]["category"], "未分类")
            unresolved = next(item for item in issues if item["code"] == "METADATA_CATEGORY_UNRESOLVED")
            self.assertEqual(unresolved["severity"], "info")
            self.assertIn("不影响知识提取", unresolved["message"])

    def _prepare(self, root, limits=None):
        test_settings = replace(settings, data_root=root)
        effective_limits = limits or ArchiveLimits(
            max_files=20,
            max_bytes=1024 * 1024,
            max_depth=3,
            max_expansion_ratio=1000,
        )
        with (
            patch.object(preparation_module, "settings", test_settings),
            patch.object(services_module, "settings", test_settings),
        ):
            service = MaterialPreparationService(
                _BatchLookup(),
                FileService(),
                limits=effective_limits,
            )
            return service.prepare(self.batch_id)

    def test_concurrent_same_input_reuses_one_committed_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "batches" / self.batch_id / "original/files/readme.md"
            source.parent.mkdir(parents=True)
            source.write_text("# 并发快照\n\n同一份输入只应计算一次。", encoding="utf-8")
            self._register_archive(root, source)
            test_settings = replace(settings, data_root=root)
            with (
                patch.object(preparation_module, "settings", test_settings),
                patch.object(services_module, "settings", test_settings),
            ):
                service = MaterialPreparationService(_BatchLookup(), FileService())
                with ThreadPoolExecutor(max_workers=8) as executor:
                    reports = list(executor.map(lambda _: service.prepare(self.batch_id), range(8)))

            self.assertEqual(len({report.run_id for report in reports}), 1)
            runs = root / "batches" / self.batch_id / "preparation/runs"
            self.assertEqual(len([path for path in runs.iterdir() if path.is_dir()]), 1)

    def _write_batch_archive(self, root, entries):
        batch_root = root / "batches" / self.batch_id
        archive_path = batch_root / "original" / "files" / "bundle.zip"
        archive_path.parent.mkdir(parents=True)
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, content in entries.items():
                archive.writestr(name, content)
        self._register_archive(root, archive_path)
        return archive_path

    def _register_archive(self, root, archive_path):
        batch_root = root / "batches" / self.batch_id
        resources = [
            {
                "id": "archive-resource",
                "batchId": self.batch_id,
                "name": archive_path.name,
                "logicalPath": archive_path.relative_to(root).as_posix(),
                "kind": "attachment",
                "sourceType": "upload",
                "size": archive_path.stat().st_size,
            }
        ]
        (batch_root / "resources.json").write_text(
            json.dumps(resources),
            encoding="utf-8",
        )

    @staticmethod
    def _docx_with_image_bytes() -> bytes:
        buffer = io.BytesIO()
        document = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>架构说明</w:t></w:r></w:p>
    <w:p><w:r><w:t>下面是架构图。</w:t></w:r><w:r><w:drawing><a:blip r:embed="rId1"/></w:drawing></w:r></w:p>
  </w:body>
</w:document>"""
        rels = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>"""
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", document)
            archive.writestr("word/_rels/document.xml.rels", rels)
            archive.writestr("word/media/image1.png", b"\x89PNG\r\n\x1a\nimage")
        return buffer.getvalue()


class SourceInspectionTests(unittest.TestCase):
    batch_id = "batch_test0000000000"

    def test_scan_counts_convertible_and_direct_sources_as_processable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_resources(root, {
                "guide.docx": self._docx_bytes(),
                "manual.pdf": b"%PDF-1.4\n% text pdf placeholder",
                "page.html": "<h1>标题</h1><p>正文</p>".encode("utf-8"),
                "readme.md": "# 标题\n\n正文".encode("utf-8"),
            })
            test_settings = replace(settings, data_root=root)
            tool_status = {
                "libreoffice": {"available": True, "requiredFormats": ["docx"]},
                "pdftotext": {"available": True, "requiredFormats": ["pdf"]},
                "htmlParser": {"available": True, "requiredFormats": ["html", "htm"]},
            }
            with (
                patch.object(services_module, "settings", test_settings),
                patch.object(FileService, "_tool_status", return_value=tool_status),
                patch.object(FileService, "_pdf_has_text", return_value=True),
                patch.object(PreprocessService, "_convert_resource_to_markdown", return_value=("# 标题\n\n正文", "mock-converter")),
            ):
                report = PreprocessService(None, _BatchLookup(), None, FileService()).scan(self.batch_id)

            self.assertEqual(report.total_files, 4)
            self.assertEqual(report.processable_count, 4)
            self.assertEqual(report.direct_text_count, 2)
            self.assertEqual(report.convertible_count, 2)
            self.assertGreater(report.estimated_processing_unit_count, 0)

    def test_async_scan_returns_immediately_and_persists_report(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_resources(root, {"readme.md": b"# Title\n\nContent"})
            test_settings = replace(settings, data_root=root)
            batch = SimpleNamespace(id=self.batch_id, active_task_ids=[])

            class Batches:
                def get(self, batch_id):
                    if batch_id != batch.id:
                        raise KeyError(batch_id)
                    return batch

                def update(self, batch_id, **changes):
                    for key, value in changes.items():
                        setattr(batch, {"activeTaskIds": "active_task_ids"}.get(key, key), value)

            with patch.object(services_module, "settings", test_settings):
                store = JsonStore(root / "state.json")
                tasks = TaskService(store, Batches(), SimpleNamespace())
                preprocess = PreprocessService(store, Batches(), tasks, FileService())
                with patch.object(services_module.threading, "Thread") as thread:
                    created = preprocess.create_scan_task(self.batch_id)
                    again = preprocess.create_scan_task(self.batch_id)

                self.assertEqual(created.id, again.id)
                self.assertEqual(created.state, "queued")
                thread.assert_called_once()

                preprocess._run_scan_task(created.id)
                report = preprocess.latest_scan_report(self.batch_id)
                completed = tasks.get(created.id)

            self.assertEqual(report.total_files, 1)
            self.assertEqual(report.processable_count, 1)
            self.assertEqual(completed.state, "completed")
            self.assertEqual(batch.active_task_ids, [])

    def test_docx_preview_returns_metadata_markdown_and_structure_comparison(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            resources = self._write_resources(root, {"guide.docx": self._docx_bytes()})
            resource_id = resources[0]["id"]
            test_settings = replace(settings, data_root=root)
            tool_status = {
                "libreoffice": {"available": True, "requiredFormats": ["docx"]},
                "pdftotext": {"available": True, "requiredFormats": ["pdf"]},
                "htmlParser": {"available": True, "requiredFormats": ["html", "htm"]},
            }
            converted = "# 转换标题\n\n| A | B |\n| 1 | 2 |\n\n正文"
            with (
                patch.object(services_module, "settings", test_settings),
                patch.object(FileService, "_tool_status", return_value=tool_status),
                patch.object(PreprocessService, "_convert_resource_to_markdown", return_value=(converted, "mock-libreoffice")),
            ):
                preview = PreprocessService(None, _BatchLookup(), None, FileService()).preview(
                    PreprocessPreviewRequest(batchId=self.batch_id, resourceId=resource_id)
                )

            self.assertEqual(preview["previewState"], "preview_only")
            self.assertEqual(preview["sourceMetadata"]["formatFamily"], "office")
            self.assertEqual(preview["convertedMarkdown"], converted)
            self.assertTrue(preview["cleanedMarkdown"])
            self.assertIn("structureComparison", preview)
            self.assertIn("differences", preview["structureComparison"])
            self.assertGreaterEqual(len(preview["processingUnits"]), 1)

    def test_docx_source_features_expose_states_and_diagnostics(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "guide.docx"
            path.write_bytes(MaterialPreparationTests._docx_with_image_bytes())
            service = object.__new__(PreprocessService)
            features = service._source_features(path, "office")
            self.assertEqual(features["states"]["pageCount"], "not_applicable")
            self.assertEqual(features["states"]["characterCount"], "ok")
            self.assertGreater(features["values"]["characterCount"], 0)
            self.assertIn("DOCX OOXML 可见文本", features["diagnostics"]["characterCount"])
            self.assertEqual(features["diagnostics"]["characterCountSource"], "docx_ooxml_visible_text")

    def test_docx_character_count_includes_headers_footnotes_and_comments(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rich.docx"
            path.write_bytes(self._docx_with_extra_text_bytes())
            service = object.__new__(PreprocessService)
            features = service._source_features(path, "office")
            self.assertEqual(features["states"]["characterCount"], "ok")
            self.assertEqual(features["values"]["characterCount"], len("正文表格页眉脚注批注"))
            self.assertEqual(features["values"]["tableCount"], 1)

    def test_pptx_character_count_and_slide_count_use_ooxml(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "slides.pptx"
            path.write_bytes(self._pptx_bytes())
            service = object.__new__(PreprocessService)
            features = service._source_features(path, "office")
            self.assertEqual(features["states"]["slideCount"], "ok")
            self.assertEqual(features["values"]["slideCount"], 2)
            self.assertEqual(features["states"]["characterCount"], "ok")
            self.assertEqual(features["values"]["characterCount"], len("第一页第二页42"))
            self.assertIn("PPTX 幻灯片 OOXML", features["diagnostics"]["characterCount"])

    def test_xlsx_character_count_and_worksheet_count_use_ooxml(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sheet.xlsx"
            path.write_bytes(self._xlsx_bytes())
            service = object.__new__(PreprocessService)
            features = service._source_features(path, "office")
            self.assertEqual(features["states"]["worksheetCount"], "ok")
            self.assertEqual(features["values"]["worksheetCount"], 2)
            self.assertEqual(features["states"]["characterCount"], "ok")
            self.assertEqual(features["values"]["characterCount"], len("共享内联123"))
            self.assertIn("XLSX 单元格 OOXML", features["diagnostics"]["characterCount"])

    def test_legacy_office_character_count_is_not_derived_from_libreoffice(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "legacy.doc"
            path.write_bytes(b"legacy binary")
            service = object.__new__(PreprocessService)
            features = service._source_features(path, "office")
            self.assertEqual(features["states"]["characterCount"], "not_implemented")
            self.assertIsNone(features["values"]["characterCount"])
            self.assertIn("不使用 LibreOffice", features["diagnostics"]["characterCount"])

    def test_docx_missing_document_xml_is_marked_parse_failed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "broken.docx"
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as archive:
                archive.writestr("[Content_Types].xml", "<Types/>")
                archive.writestr("word/_rels/document.xml.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"/>")
            path.write_bytes(buffer.getvalue())
            service = object.__new__(PreprocessService)
            features = service._source_features(path, "office")
            self.assertEqual(features["states"]["paragraphCount"], "parse_failed")
            self.assertEqual(features["states"]["characterCount"], "parse_failed")
            self.assertIn("缺少 word/document.xml", features["diagnostics"]["package"])

    def test_docx_preview_preserves_embedded_images_as_inline_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            resources = self._write_resources(root, {"guide.docx": MaterialPreparationTests._docx_with_image_bytes()})
            resource_id = resources[0]["id"]
            test_settings = replace(settings, data_root=root)
            with (
                patch.object(services_module, "settings", test_settings),
            ):
                preview = PreprocessService(None, _BatchLookup(), None, FileService()).preview(
                    PreprocessPreviewRequest(batchId=self.batch_id, resourceId=resource_id)
                )

            self.assertIn("![DOCX 图片](assets/guide/image1.png)", preview["convertedMarkdown"])
            self.assertEqual(preview["sourceMetadata"]["preservedImageCount"], 1)
            self.assertEqual(preview["markdownFeatures"]["imageReferenceCount"], 1)
            self.assertEqual(len(preview["conversionAssets"]), 1)
            self.assertTrue(preview["assets"]["assets/guide/image1.png"].startswith("data:image/png;base64,"))

    def test_structure_comparison_flags_missing_source_structures(self):
        result = PreprocessService._structure_comparison(
            {"headingHintCount": 2, "tableCount": 1, "imageCount": 1, "characterCount": 200},
            {"headingCount": 0, "tableCount": 0, "imageReferenceCount": 0, "characterCount": 100},
            {"formatFamily": "office"},
        )
        codes = {item["code"] for item in result["issues"]}
        self.assertIn("HEADING_MISSING", codes)
        self.assertIn("TABLE_MISSING", codes)
        self.assertIn("IMAGE_MISSING", codes)
        self.assertTrue(result["summary"]["mappingIncomplete"])
        self.assertEqual(result["summary"]["tableCountDelta"], -1)

    def test_pdf_without_extractable_text_is_ocr_required(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_resources(root, {"scan.pdf": b"%PDF-1.4\n% scanned"})
            test_settings = replace(settings, data_root=root)
            tool_status = {
                "libreoffice": {"available": True, "requiredFormats": ["docx"]},
                "pdftotext": {"available": True, "requiredFormats": ["pdf"]},
                "htmlParser": {"available": True, "requiredFormats": ["html", "htm"]},
            }
            with (
                patch.object(services_module, "settings", test_settings),
                patch.object(FileService, "_tool_status", return_value=tool_status),
                patch.object(FileService, "_pdf_has_text", return_value=False),
            ):
                report = PreprocessService(None, _BatchLookup(), None, FileService()).scan(self.batch_id)

            self.assertEqual(report.processable_count, 0)
            self.assertEqual(report.ocr_required_count, 1)
            self.assertIn("PDF_OCR_REQUIRED", {item.code for item in report.issues})

    def _write_resources(self, root: Path, entries: dict[str, bytes]) -> list[dict[str, object]]:
        batch_root = root / "batches" / self.batch_id
        files_root = batch_root / "original" / "files"
        files_root.mkdir(parents=True)
        resources = []
        for index, (name, content) in enumerate(entries.items(), start=1):
            path = files_root / name
            path.write_bytes(content)
            resources.append({
                "id": f"resource-{index}",
                "batchId": self.batch_id,
                "name": name,
                "logicalPath": path.relative_to(root).as_posix(),
                "kind": "attachment",
                "sourceType": "upload",
                "size": path.stat().st_size,
            })
        (batch_root / "resources.json").write_text(json.dumps(resources), encoding="utf-8")
        return resources

    @staticmethod
    def _docx_bytes() -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", "<w:document><w:p><w:pStyle w:val=\"Heading1\"/></w:p><w:tbl/></w:document>")
        return buffer.getvalue()

    @staticmethod
    def _docx_with_extra_text_bytes() -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr(
                "word/document.xml",
                f"<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
                f"<w:body><w:p><w:r><w:t>正文</w:t></w:r></w:p>"
                f"<w:tbl><w:tr><w:tc><w:p><w:r><w:t>表格</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>",
            )
            archive.writestr(
                "word/header1.xml",
                "<w:hdr xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:p><w:r><w:t>页眉</w:t></w:r></w:p></w:hdr>",
            )
            archive.writestr(
                "word/footnotes.xml",
                "<w:footnotes xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:footnote><w:p><w:r><w:t>脚注</w:t></w:r></w:p></w:footnote></w:footnotes>",
            )
            archive.writestr(
                "word/comments.xml",
                "<w:comments xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:comment><w:p><w:r><w:t>批注</w:t></w:r></w:p></w:comment></w:comments>",
            )
        return buffer.getvalue()

    @staticmethod
    def _pptx_bytes() -> bytes:
        buffer = io.BytesIO()
        slide = "<p:sld xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>{}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>"
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("ppt/slides/slide1.xml", slide.format("第一页"))
            archive.writestr("ppt/slides/slide2.xml", slide.format("第二页42"))
        return buffer.getvalue()

    @staticmethod
    def _xlsx_bytes() -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr(
                "xl/sharedStrings.xml",
                "<sst xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><si><t>共享</t></si></sst>",
            )
            archive.writestr(
                "xl/worksheets/sheet1.xml",
                "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData><row><c t=\"s\"><v>0</v></c><c t=\"inlineStr\"><is><t>内联</t></is></c></row></sheetData></worksheet>",
            )
            archive.writestr(
                "xl/worksheets/sheet2.xml",
                "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData><row><c><v>123</v></c></row></sheetData></worksheet>",
            )
        return buffer.getvalue()

if __name__ == "__main__":
    unittest.main()
