import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.models import (
    MaterialBatch,
    MaterialSourceRecord,
    SelectionRule,
    SourceFilters,
    SourceSelection,
    SourceSnapshot,
    TaskSnapshot,
)
from app.pingcode_service import PingCodeService
from app.models import DatasetVersion, PreprocessConfig, SpaceMappingUpdate
from app.services import PreprocessService, SpaceMappingService, TaskService, BatchService, utcnow
from app.store import JsonStore
from app.prompt_registry import PromptNotFoundError, PromptRegistry, PromptRegistryError
from app.skill_registry import SkillNotFoundError, SkillRegistry, SkillRegistryError
from app.indexing.knowledge_graph import KnowledgeGraphBuilder
from pingcode.core.attachment_policy import AttachmentPolicy
from pingcode.core.client import PingCodeClient
from pingcode.core.config import PingCodeConfig
from pingcode.core.tree_builder import TreeBuilder


class SelectionTests(unittest.TestCase):
    def setUp(self):
        self.service = PingCodeService()
        self.pages = [
            {"_id": "root", "parent_id": None, "name": "根", "word_count": 1},
            {"_id": "child-a", "parent_id": "root", "name": "索引原理", "word_count": 10},
            {"_id": "child-b", "parent_id": "root", "name": "空页面", "word_count": 0},
            {"_id": "grandchild", "parent_id": "child-a", "name": "B+树", "word_count": 10},
        ]

    def tearDown(self):
        self.service.close()

    def test_subtree_include_and_exclude(self):
        selection = SourceSelection(
            space_key="TEST",
            include_rules=[SelectionRule(node_id="root", scope="subtree")],
            exclude_rules=[SelectionRule(node_id="child-a", scope="self")],
            filters=SourceFilters(skip_empty=True),
        )
        selected = set(self.service.resolve_selection(self.pages, selection))
        self.assertEqual(selected, {"root", "grandchild"})

    def test_keyword_filter(self):
        selection = SourceSelection(
            space_key="TEST",
            include_rules=[SelectionRule(node_id="root", scope="subtree")],
            filters=SourceFilters(keyword="索引", skip_empty=False),
        )
        self.assertEqual(self.service.resolve_selection(self.pages, selection), ["child-a"])

    def test_all_zero_word_counts_are_treated_as_unknown(self):
        pages = [
            {"_id": "root", "parent_id": None, "name": "根", "word_count": 0, "attachment_count": 0},
            {"_id": "child", "parent_id": "root", "name": "正文", "word_count": 0, "attachment_count": 0},
        ]
        selection = SourceSelection(
            space_key="TEST",
            include_rules=[SelectionRule(node_id="root", scope="subtree")],
            filters=SourceFilters(skip_empty=True),
        )
        self.assertEqual(set(self.service.resolve_selection(pages, selection)), {"root", "child"})
        self.assertEqual(self.service._estimate_states(pages, selection), ("upper_bound", "unknown"))

    def test_pages_for_batch_collapses_identical_duplicate_pages(self):
        page = {"_id": "page-1", "name": "同一页面", "parent_id": None}
        self.service._space_cache["TEST"] = ({}, [page, dict(page)], {})
        with patch.object(self.service, "_get_space_tree_sync"):
            result = self.service._pages_for_batch_sync("TEST", ["page-1"])

        self.assertEqual(result, [page])

    def test_pages_for_batch_rejects_conflicting_page_id(self):
        pages = [
            {"_id": "page-1", "name": "页面甲", "parent_id": None},
            {"_id": "page-1", "name": "页面乙", "parent_id": None},
        ]
        self.service._space_cache["TEST"] = ({}, pages, {})
        with (
            patch.object(self.service, "_get_space_tree_sync"),
            self.assertRaisesRegex(ValueError, "页面 ID 冲突.*page-1"),
        ):
            self.service._pages_for_batch_sync("TEST", ["page-1"])


class PingCodeClientLoginTests(unittest.TestCase):
    def test_login_uses_safe_wiki_entry_instead_of_first_target(self):
        with tempfile.TemporaryDirectory() as directory:
            config_path = Path(directory) / "pingcode.json"
            config_path.write_text(
                '{"base_url":"https://pingcode.example",'
                '"credentials":{"email":"u","password":"p"},'
                '"targets":[{"name":"旧存储空间","url":"https://pingcode.example/wiki/spaces/YASSTORAGE/pages/old"}]}',
                encoding="utf-8",
            )
            page = Mock()
            page.url = "https://pingcode.example/login"
            page.title.return_value = "Login"
            page.click.side_effect = lambda *_args, **_kwargs: setattr(
                page, "url", "https://pingcode.example/wiki"
            )

            client = PingCodeClient(PingCodeConfig(config_path), headless=True)
            client._page = page
            client._login()

            page.goto.assert_called_once_with(
                "https://pingcode.example/wiki",
                wait_until="domcontentloaded",
                timeout=30000,
            )

    def test_login_can_use_current_space_entry(self):
        with tempfile.TemporaryDirectory() as directory:
            config_path = Path(directory) / "pingcode.json"
            config_path.write_text(
                '{"base_url":"https://pingcode.example",'
                '"credentials":{"email":"u","password":"p"},"targets":[]}',
                encoding="utf-8",
            )
            page = Mock()
            page.url = "https://pingcode.example/login"
            page.title.return_value = "Login"
            page.click.side_effect = lambda *_args, **_kwargs: setattr(
                page, "url", "https://pingcode.example/wiki"
            )

            client = PingCodeClient(
                PingCodeConfig(config_path),
                headless=True,
                login_url="https://pingcode.example/wiki/spaces/YASDOC",
            )
            client._page = page
            client._login()

            page.goto.assert_called_once_with(
                "https://pingcode.example/wiki/spaces/YASDOC",
                wait_until="domcontentloaded",
                timeout=30000,
            )


class PingCodeServiceLifecycleTests(unittest.TestCase):
    def test_submit_recreates_executor_after_close(self):
        service = PingCodeService()
        try:
            self.assertEqual(service._submit(lambda: "first"), "first")
            service.close()
            self.assertEqual(service._submit(lambda: "second"), "second")
        finally:
            service.close()


class JsonStoreTests(unittest.TestCase):
    def test_round_trip_and_update(self):
        with tempfile.TemporaryDirectory() as directory:
            store = JsonStore(Path(directory) / "state.json")
            store.put_record("batches", "batch-1", {"id": "batch-1", "state": "draft"})
            updated = store.update_record("batches", "batch-1", {"state": "downloaded"})
            self.assertEqual(updated["state"], "downloaded")
            self.assertEqual(store.get_record("batches", "batch-1")["state"], "downloaded")


class PreprocessTests(unittest.TestCase):
    def test_preprocess_config_uses_design_field_names_and_defaults(self):
        config = PreprocessConfig()
        payload = config.model_dump(mode="json", by_alias=True)
        self.assertEqual(payload["maxUnitCharacters"], 6000)
        self.assertEqual(payload["fallbackOverlapCharacters"], 0)
        self.assertNotIn("chunkSize", payload)
        self.assertNotIn("chunkOverlap", payload)

    def test_preprocess_config_accepts_legacy_camel_and_snake_case_fields(self):
        camel = PreprocessConfig.model_validate({"chunkSize": 1200, "chunkOverlap": 120})
        snake = PreprocessConfig(chunk_size=2000, chunk_overlap=200)
        self.assertEqual((camel.max_unit_characters, camel.fallback_overlap_characters), (1200, 120))
        self.assertEqual((snake.max_unit_characters, snake.fallback_overlap_characters), (2000, 200))

    def test_preprocess_config_rejects_conflicting_new_and_legacy_fields(self):
        with self.assertRaisesRegex(ValueError, "maxUnitCharacters"):
            PreprocessConfig.model_validate({"maxUnitCharacters": 6000, "chunkSize": 1200})
        with self.assertRaisesRegex(ValueError, "fallbackOverlapCharacters"):
            PreprocessConfig.model_validate({"fallbackOverlapCharacters": 0, "chunkOverlap": 120})

    def test_historical_dataset_config_is_read_and_serialized_with_design_fields(self):
        dataset = DatasetVersion.model_validate({
            "id": "dataset-history",
            "batchId": "batch-history",
            "preprocessTaskId": "prep-history",
            "state": "candidate",
            "config": {"preset": "training_standard", "chunkSize": 1200, "chunkOverlap": 120},
            "totalDocuments": 1,
            "totalChunks": 1,
            "qualityMetrics": {},
            "qualityPassed": True,
            "createdAt": "2026-07-28T00:00:00Z",
        })
        payload = dataset.model_dump(mode="json", by_alias=True)
        self.assertEqual(payload["config"]["maxUnitCharacters"], 1200)
        self.assertEqual(payload["config"]["fallbackOverlapCharacters"], 120)
        self.assertNotIn("chunkSize", payload["config"])

    def test_clean_and_chunk(self):
        text = "标题\u200b  \r\n\r\n\r\n第一段。第二段。第三段。"
        cleaned = PreprocessService._clean(text)
        self.assertNotIn("\u200b", cleaned)
        self.assertNotIn("\r", cleaned)
        chunks = PreprocessService._chunk(
            cleaned,
            PreprocessConfig(chunk_size=200, chunk_overlap=20),
        )
        self.assertEqual(chunks, [cleaned])

    def test_cleaning_presets_have_distinct_lossless_normalization(self):
        text = "\ufeff#标题\r\n\r\n\r\n正文\u00a0内容  \r\n"
        basic = PreprocessService._clean(text, "basic_clean")
        standard = PreprocessService._clean(text, "training_standard")
        self.assertEqual(basic, "#标题\n\n\n正文\u00a0内容")
        self.assertEqual(standard, "# 标题\n\n正文 内容")

    def test_unknown_cleaning_preset_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "不支持的清洗预设"):
            PreprocessService._clean("正文", "unknown")

    def test_training_clean_excludes_c_fence_and_preserves_surrounding_content(self):
        text = "#标题\n\n```c\n#include <stdio.h>\n\n\nreturn 0;\n```\n\n\n\n正文"
        cleaned = PreprocessService._clean(text, "training_standard")
        self.assertNotIn("#include", cleaned)
        self.assertNotIn("return 0", cleaned)
        self.assertIn("processing-excluded:c-code", cleaned)
        self.assertTrue(cleaned.startswith("# 标题"))
        self.assertTrue(cleaned.endswith("正文"))

    def test_training_clean_preserves_sql_fence(self):
        text = "```sql\nSELECT * FROM dual;\n```"
        cleaned = PreprocessService._clean(text, "training_standard")
        self.assertEqual(cleaned, text)

    def test_unlabelled_fence_requires_strong_c_signature(self):
        c_text = "```\n#include <stdio.h>\nint main(void) { return 0; }\n```"
        prose = "```\n参数 max_connections 用于控制连接数。\n```"
        self.assertNotIn("#include", PreprocessService._clean(c_text))
        self.assertIn("max_connections", PreprocessService._clean(prose))


class KnowledgeGraphBuilderTests(unittest.TestCase):
    def test_builder_merges_keyword_aliases_and_skips_technical_ids(self):
        builder = KnowledgeGraphBuilder()
        graph = builder.build([
            {
                "resourceId": "resource-1",
                "sourcePath": "docs/config.md",
                "results": [
                    {
                        "chunkId": "resource-1:0",
                        "content": "max_connections 控制并发连接。",
                        "knowledgePoints": [
                            {"title": "max_connections", "confidence": 0.9},
                            {"title": "Max_Connections", "confidence": 0.8},
                            {"title": "dataset_a0400362ca354c61", "confidence": 0.7},
                        ],
                        "entities": [
                            {"name": "max_connections", "type": "Parameter", "evidenceText": "max_connections"},
                            {"name": "file_1c34b7d8d3d84e37", "type": "Parameter", "evidenceText": "file_1c34b7d8d3d84e37"},
                        ],
                        "relations": [],
                    }
                ],
            }
        ])

        knowledge_points = [node for node in graph["nodes"] if node["type"] == "KnowledgePoint"]
        self.assertEqual(len(knowledge_points), 1)
        self.assertEqual(knowledge_points[0]["canonicalName"], "max_connections")
        self.assertIn("max_connections", [item.casefold() for item in knowledge_points[0]["aliases"]])
        self.assertNotIn("dataset_a0400362ca354c61", knowledge_points[0]["aliases"])
        self.assertFalse(any(node.get("rawName") == "dataset_a0400362ca354c61" for node in graph["nodes"]))


class DownloadResumeTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.data_root = Path(self.directory.name)
        self.settings_patch = patch("app.services.settings", SimpleNamespace(data_root=self.data_root))
        self.settings_patch.start()
        self.store = JsonStore(self.data_root / "state.json")
        self.batch = MaterialBatch(
            id="batch-download",
            name="下载批次",
            state="downloading",
            source_selection=SourceSelection(
                space_key="YASDOC",
                include_rules=[SelectionRule(node_id="root", scope="subtree")],
                filters=SourceFilters(),
            ),
            source_snapshot=SourceSnapshot(
                captured_at=utcnow(),
                completeness="complete",
                estimated_pages=2,
                estimated_attachments=0,
            ),
            source=MaterialSourceRecord(
                source_type="pingcode",
                source_id="YASDOC",
                display_name="YASDOC",
                captured_at=utcnow(),
            ),
            local_space_logical_path="spaces/yasdoc",
            active_task_ids=["task-download"],
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        self.store.put_record("batches", self.batch.id, self.batch.model_dump(mode="json", by_alias=True))
        self.store.put_record("tasks", "task-download", TaskSnapshot(
            id="task-download",
            batch_id=self.batch.id,
            type="download",
            state="running",
            stage="page_content",
            completed=1,
            total=2,
            warnings=0,
            failed=0,
            message=None,
            stages=[],
            can_pause=False,
            can_cancel=False,
            can_retry=False,
            created_at=utcnow(),
            updated_at=utcnow(),
        ).model_dump(mode="json", by_alias=True))
        state_dir = self.data_root / "spaces" / "yasdoc" / "batches" / self.batch.id / "download-state"
        state_dir.mkdir(parents=True, exist_ok=True)
        (state_dir / "pages.jsonl").write_text(
            "\n".join([
                '{"taskId":"task-download","pageId":"page-1","pageName":"已完成","state":"completed","resourceCount":1,"warningCount":0,"message":null,"retryCount":0,"startedAt":"2026-07-28T00:00:00Z","updatedAt":"2026-07-28T00:00:01Z","durationMs":1000}',
                '{"taskId":"task-download","pageId":"page-2","pageName":"失败页","state":"failed","resourceCount":0,"warningCount":1,"message":"后端重启","retryCount":2,"startedAt":"2026-07-28T00:00:00Z","updatedAt":"2026-07-28T00:00:02Z","durationMs":2000}',
            ]),
            encoding="utf-8",
        )
        (state_dir / "items.jsonl").write_text(
            "\n".join([
                '{"taskId":"task-download","pageId":"page-2","pageName":"失败页","kind":"error","assetType":"attachment","name":"manual.pdf","state":"warning","message":"下载失败","retryCount":0,"updatedAt":"2026-07-28T00:00:02Z"}',
            ]),
            encoding="utf-8",
        )
        self.tasks = TaskService(self.store, BatchService(self.store, None), type("P", (), {"pages_for_batch": lambda *_: [], "api_call": lambda self, fn: fn(None)})())

    def tearDown(self):
        self.settings_patch.stop()
        self.directory.cleanup()

    def test_reconcile_marks_running_download_as_interrupted(self):
        self.tasks.reconcile_interrupted()
        task = self.tasks.get("task-download")
        self.assertEqual(task.state, "interrupted")
        self.assertTrue(task.can_resume)
        self.assertIn("可继续未完成页面", task.message)

    def test_retry_does_not_complete_when_unattempted_pages_remain(self):
        summary = self.tasks._download_summary(
            {
                "page-1": {"state": "completed", "warningCount": 0},
                "page-2": {"state": "completed", "warningCount": 0},
            },
            total=5,
            skipped=3,
        )
        self.assertEqual(summary["completed"], 2)
        self.assertEqual(summary["progressDetail"]["pendingPages"], 3)

    def test_rewrite_resources_collapses_identical_history(self):
        batch_dir = self.data_root / "spaces/yasdoc/batches" / self.batch.id
        state_dir = batch_dir / "download-state"
        resource = {
            "id": "resource-1",
            "batchId": self.batch.id,
            "kind": "page",
            "pageId": "page-1",
            "logicalPath": "spaces/yasdoc/page-1.md",
            "size": 12,
            "state": "completed",
            "taskId": "task-download",
        }
        (state_dir / "items.jsonl").write_text(
            "\n".join(json.dumps(item) for item in [resource, dict(resource)]),
            encoding="utf-8",
        )

        self.tasks._rewrite_resources_from_state(batch_dir, state_dir)

        resources = json.loads((batch_dir / "resources.json").read_text(encoding="utf-8"))
        issues = json.loads((state_dir / "resource-view-issues.json").read_text(encoding="utf-8"))
        self.assertEqual([item["id"] for item in resources], ["resource-1"])
        self.assertEqual(issues[0]["code"], "DUPLICATE_SOURCE_RESOURCE_COLLAPSED")
        self.assertEqual(issues[0]["severity"], "warning")

    def test_append_download_items_collapses_duplicate_page_resource(self):
        state_dir = self.data_root / "append-state"
        resource = {
            "id": "asset-1",
            "batchId": self.batch.id,
            "kind": "page_asset",
            "pageId": "page-1",
            "logicalPath": "spaces/yasdoc/assets/image.png",
            "size": 24,
        }

        self.tasks._append_download_items(
            state_dir,
            [resource, dict(resource)],
            "task-download",
            0,
        )

        items = self.tasks._read_jsonl(state_dir / "items.jsonl")
        matching = [item for item in items if item.get("id") == "asset-1"]
        issues = self.tasks._read_jsonl(state_dir / "resource-issues.jsonl")
        self.assertEqual(len(matching), 1)
        self.assertEqual(issues[-1]["code"], "DUPLICATE_SOURCE_RESOURCE_COLLAPSED")

    def test_append_download_items_rejects_conflicting_page_resource(self):
        state_dir = self.data_root / "append-conflict-state"
        common = {
            "id": "asset-1",
            "batchId": self.batch.id,
            "kind": "page_asset",
            "pageId": "page-1",
            "size": 24,
        }

        with self.assertRaisesRegex(ValueError, "SOURCE_RESOURCE_ID_CONFLICT"):
            self.tasks._append_download_items(
                state_dir,
                [
                    {**common, "logicalPath": "spaces/yasdoc/assets/first.png"},
                    {**common, "logicalPath": "spaces/yasdoc/assets/second.png"},
                ],
                "task-download",
                0,
            )

        self.assertEqual(self.tasks._read_jsonl(state_dir / "items.jsonl"), [])
        issues = self.tasks._read_jsonl(state_dir / "resource-issues.jsonl")
        self.assertEqual(issues[-1]["severity"], "error")

    def test_rewrite_resources_isolates_conflicting_id(self):
        batch_dir = self.data_root / "spaces/yasdoc/batches" / self.batch.id
        state_dir = batch_dir / "download-state"
        common = {
            "id": "resource-1",
            "batchId": self.batch.id,
            "kind": "page",
            "pageId": "page-1",
            "size": 12,
            "state": "completed",
        }
        records = [
            {**common, "logicalPath": "spaces/yasdoc/page-1.md"},
            {**common, "logicalPath": "spaces/yasdoc/conflict.md"},
            {**common, "id": "resource-2", "logicalPath": "spaces/yasdoc/page-2.md"},
        ]
        (state_dir / "items.jsonl").write_text(
            "\n".join(json.dumps(item) for item in records),
            encoding="utf-8",
        )

        self.tasks._rewrite_resources_from_state(batch_dir, state_dir)

        resources = json.loads((batch_dir / "resources.json").read_text(encoding="utf-8"))
        issues = json.loads((state_dir / "resource-view-issues.json").read_text(encoding="utf-8"))
        self.assertEqual([item["id"] for item in resources], ["resource-2"])
        self.assertEqual(issues[0]["code"], "SOURCE_RESOURCE_ID_CONFLICT")
        self.assertEqual(issues[0]["severity"], "error")

    def test_retry_with_pending_pages_finishes_as_interrupted(self):
        class FakeApi:
            def get_page(self, _page_id):
                return {"data": {"value": {"document": []}}}

            def get_attachments(self, _page_id):
                return []

        class FakePingCode:
            def pages_for_batch(self, *_args):
                return [
                    {"_id": "page-1", "name": "已完成"},
                    {"_id": "page-2", "name": "失败页"},
                    {"_id": "page-3", "name": "未处理页"},
                ]

            def api_call(self, callback, *_args):
                return callback(FakeApi())

        tasks = TaskService(self.store, BatchService(self.store, None), FakePingCode())
        tasks._run_download("task-download", "retry")

        task = tasks.get("task-download")
        batch = tasks.batches.get(self.batch.id)
        self.assertEqual(task.state, "interrupted")
        self.assertTrue(task.can_resume)
        self.assertEqual(task.progress_detail["pendingPages"], 1)
        self.assertIn("还有 1 个页面未处理", task.message)
        self.assertEqual(batch.state, "downloading")

    def test_reconcile_repairs_completed_task_with_pending_pages(self):
        task = self.tasks.get("task-download").model_copy(
            update={
                "state": "completed",
                "stage": "completed",
                "total": 3,
                "completed": 1,
                "failed": 0,
                "progress_detail": {"pendingPages": 2},
                "can_resume": False,
            }
        )
        self.store.put_record("tasks", task.id, task.model_dump(mode="json", by_alias=True))
        self.tasks.batches.update(self.batch.id, state="downloaded", activeTaskIds=[])
        state_dir = self.data_root / "spaces" / "yasdoc" / "batches" / self.batch.id / "download-state"
        (state_dir / "pages.jsonl").write_text(
            '{"taskId":"task-download","pageId":"page-1","pageName":"已完成","state":"completed","resourceCount":1,"warningCount":0,"message":null,"retryCount":0,"startedAt":"2026-07-28T00:00:00Z","updatedAt":"2026-07-28T00:00:01Z","durationMs":1000}',
            encoding="utf-8",
        )

        self.tasks.reconcile_interrupted()

        repaired = self.tasks.get("task-download")
        batch = self.tasks.batches.get(self.batch.id)
        self.assertEqual(repaired.state, "interrupted")
        self.assertTrue(repaired.can_resume)
        self.assertEqual(repaired.progress_detail["pendingPages"], 2)
        self.assertEqual(batch.state, "downloading")

    def test_list_download_items_filters_warning_and_failed(self):
        failed = self.tasks.list_download_items("task-download", "failed", 1, 20)
        warning = self.tasks.list_download_items("task-download", "warning", 1, 20)
        self.assertEqual(failed["total"], 1)
        self.assertEqual(failed["items"][0]["pageId"], "page-2")
        self.assertEqual(warning["total"], 2)
        self.assertTrue(any(item["assetType"] == "attachment" for item in warning["items"]))

    def test_c_filter_can_be_disabled_for_preview_compatibility(self):
        text = "```c\nint main(void) { return 0; }\n```"
        result = PreprocessService._clean_with_events(
            text, PreprocessConfig(exclude_c_code_blocks=False)
        )
        self.assertEqual(result.content, text)
        self.assertEqual(result.excluded_ranges, [])

    def test_processing_content_removes_exclusion_placeholders(self):
        text = "正文一\n\n```c\nint main(void) { return 0; }\n```\n\n正文二"
        result = PreprocessService._clean_with_events(text, PreprocessConfig())
        self.assertIn("processing-excluded:c-code", result.content)
        self.assertNotIn("processing-excluded", result.processing_content)
        self.assertEqual(result.processing_content, "正文一\n\n正文二")

    def test_source_code_path_markers_are_removed_from_processing_view(self):
        text = "\n".join([
            "# 表函数说明",
            "",
            "位置：`src/plsql/interface/dml_def.h:310`",
            "",
            "正文保留。",
            "",
            "  // src/plsql/verifier/vrfr_select.c",
            "  TableFuncVerify verify;",
            "",
            "## 相关源文件",
            "",
            "### 校验器",
            "- `src/plsql/verifier/vrfr_select.c` - SELECT 校验中表函数处理",
            "- `src/plsql/interface/dml_def.h` - QueryTable 定义",
            "",
            "## 后续说明",
            "SQL 示例保留。",
        ])
        result = PreprocessService._clean_with_events(text, PreprocessConfig())

        self.assertNotIn("src/plsql/interface/dml_def.h", result.content)
        self.assertNotIn("src/plsql/verifier/vrfr_select.c", result.content)
        self.assertIn("TableFuncVerify verify;", result.content)
        self.assertIn("## 后续说明", result.content)
        self.assertIn("SQL 示例保留。", result.processing_content)
        self.assertTrue(any(item["event"] == "source_references_removed" for item in result.normalization_events))

    def test_unclosed_explicit_c_fence_is_excluded_and_audited(self):
        text = "正文\n\n```C\n#include <stdio.h>\nint main(void) {"
        result = PreprocessService._clean_with_events(text, PreprocessConfig())
        self.assertNotIn("#include", result.content)
        self.assertEqual(result.excluded_ranges[0]["language"], "c")
        self.assertFalse(result.excluded_ranges[0]["closedFence"])
        self.assertEqual(result.excluded_ranges[0]["originalOffsets"]["end"], len(text))


class SpaceMappingTests(unittest.TestCase):
    def test_mapping_uses_logical_path(self):
        with tempfile.TemporaryDirectory() as directory:
            store = JsonStore(Path(directory) / "state.json")
            service = SpaceMappingService(store)
            mapping = service.upsert(
                {"id": "remote-1", "key": "YASSTORAGE", "name": "存储引擎"},
                SpaceMappingUpdate(local_name="存储素材", local_slug="yasstorage"),
            )
            self.assertEqual(mapping.local_logical_path, "spaces/yasstorage")
            self.assertEqual(service.get("YASSTORAGE").local_name, "存储素材")


class TreeBuilderTests(unittest.TestCase):
    def test_only_true_roots_and_pingcode_position_order(self):
        pages = [
            {"_id": "root", "parent_id": None, "name": "根", "position": 1},
            {"_id": "later", "parent_id": "root", "name": "后", "position": 20},
            {"_id": "first", "parent_id": "root", "name": "前", "position": 10},
            {"_id": "orphan", "parent_id": "missing", "name": "悬空", "position": 1},
        ]
        roots, unresolved = TreeBuilder().build_with_diagnostics(pages)
        self.assertEqual([item.id for item in roots], ["root"])
        self.assertEqual([item.id for item in roots[0].children], ["first", "later"])
        self.assertEqual(unresolved, ["missing"])


class AttachmentPolicyTests(unittest.TestCase):
    def test_default_policy_allows_sql_and_skips_archives_and_code(self):
        self.assertTrue(AttachmentPolicy.should_download("schema.sql"))
        self.assertTrue(AttachmentPolicy.should_download("manual.pdf"))
        self.assertFalse(AttachmentPolicy.should_download("source.py"))
        self.assertFalse(AttachmentPolicy.should_download("bundle.zip"))
        self.assertTrue(AttachmentPolicy.should_download("bundle.zip", {"zip"}))


class SkillRegistryTests(unittest.TestCase):
    def test_repository_contains_new_skill_architecture(self):
        """新架构：默认关键词抽取和正式知识提取分离为两个 skill"""
        root = Path(__file__).resolve().parents[3] / "processing" / "skills"
        registry = SkillRegistry(root)
        skills = registry.list_published()
        skill_ids = {item.skill_id for item in skills}
        self.assertIn("keyword-extraction", skill_ids)
        self.assertIn("knowledge-point-extraction", skill_ids)

    def test_get_without_version_returns_highest_published_version(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for version in ("1.0.0", "1.2.0"):
                skill = root / "demo-skill" / "versions" / version
                (skill / "schemas").mkdir(parents=True)
                (skill / "prompts").mkdir()
                (skill / "SKILL.md").write_text("# demo", encoding="utf-8")
                (skill / "prompts/system.md").write_text("system", encoding="utf-8")
                (skill / "prompts/user.md").write_text("user", encoding="utf-8")
                (skill / "schemas/input.json").write_text("{}", encoding="utf-8")
                (skill / "schemas/output.json").write_text("{}", encoding="utf-8")
                (skill / "skill.yaml").write_text(
                    f"id: demo-skill\nversion: {version}\nstatus: published\n"
                    "capability: chat\ndescription: demo\n"
                    "inputSchema: schemas/input.json\n"
                    "outputSchema: schemas/output.json\n"
                    "prompts:\n  system: prompts/system.md\n  user: prompts/user.md\n",
                    encoding="utf-8",
                )
            self.assertEqual(SkillRegistry(root).get("demo-skill").version, "1.2.0")
            self.assertEqual(SkillRegistry(root).get("demo-skill", "1.0.0").version, "1.0.0")
            with self.assertRaises(SkillNotFoundError):
                SkillRegistry(root).get("demo-skill", "2.0.0")

    def test_registry_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            skill = root / "unsafe"
            skill.mkdir()
            (skill / "SKILL.md").write_text("# unsafe", encoding="utf-8")
            (skill / "skill.yaml").write_text(
                "id: unsafe\nversion: 1.0.0\nstatus: published\n"
                "capability: chat\ninputSchema: ../input.json\n"
                "outputSchema: ../output.json\n",
                encoding="utf-8",
            )
            with self.assertRaises(SkillRegistryError):
                SkillRegistry(root).list_published()


class PromptRegistryTests(unittest.TestCase):
    def test_repository_contains_new_prompt_architecture(self):
        """新架构：关键词抽取和正式知识提取都有独立 prompts"""
        root = Path(__file__).resolve().parents[3] / "processing" / "skills"
        prompts = PromptRegistry(root).list_published()
        prompt_ids = {p.prompt_id for p in prompts}
        self.assertTrue({
            "keyword-extraction.system",
            "keyword-extraction.user",
            "knowledge-point-extraction.system",
            "knowledge-point-extraction.user",
        }.issubset(prompt_ids))

    def test_detail_contains_content_without_server_path(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_skill(root, "demo-skill", "1.0.0", "demo prompt")
            detail = PromptRegistry(root).get("demo-skill.system").detail()
            self.assertEqual(detail["content"], "demo prompt")
            self.assertEqual(detail["file"], "prompts/system.md")
            self.assertNotIn(str(root), str(detail))

    def test_get_without_version_returns_highest_prompt_version(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_skill(root, "demo-skill", "1.0.0", "old")
            self._write_skill(root, "demo-skill", "1.2.0", "new")
            registry = PromptRegistry(root)
            self.assertEqual(registry.get("demo-skill.system").skill_version, "1.2.0")
            self.assertEqual(
                registry.get("demo-skill.system", "1.0.0").content,
                "old",
            )
            with self.assertRaises(PromptNotFoundError):
                registry.get("demo-skill.system", "2.0.0")

    def test_rejects_invalid_prompt_file_and_empty_content(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_skill(root, "unsafe", "1.0.0", "ok", "../outside.md")
            with self.assertRaises(PromptRegistryError):
                PromptRegistry(root).list_published()

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_skill(root, "empty-prompt", "1.0.0", "   ")
            with self.assertRaises(PromptRegistryError):
                PromptRegistry(root).list_published()

    def test_rejects_invalid_utf8_and_version_directory_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            skill = root / "binary-prompt" / "versions" / "1.0.0"
            self._write_skill(root, "binary-prompt", "1.0.0", "ok")
            (skill / "prompts/system.md").write_bytes(b"\xff")
            with self.assertRaises(PromptRegistryError):
                PromptRegistry(root).list_published()

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_skill(root, "mismatch", "1.0.0", "ok")
            manifest = root / "mismatch" / "versions" / "1.0.0" / "skill.yaml"
            manifest.write_text(manifest.read_text(encoding="utf-8").replace("1.0.0", "1.1.0"), encoding="utf-8")
            with self.assertRaises(PromptRegistryError):
                PromptRegistry(root).list_published()

    @staticmethod
    def _write_skill(
        root: Path,
        skill_id: str,
        version: str,
        prompt: str,
        prompt_file: str = "prompts/system.md",
    ) -> None:
        skill = root / skill_id / "versions" / version
        (skill / "schemas").mkdir(parents=True)
        (skill / "prompts").mkdir()
        (skill / "SKILL.md").write_text("# demo", encoding="utf-8")
        (skill / "prompts/system.md").write_text(prompt, encoding="utf-8")
        (skill / "schemas/input.json").write_text("{}", encoding="utf-8")
        (skill / "schemas/output.json").write_text("{}", encoding="utf-8")
        (skill / "skill.yaml").write_text(
            f"id: {skill_id}\nversion: {version}\nstatus: published\n"
            "capability: chat\ndescription: demo\n"
            "inputSchema: schemas/input.json\n"
            "outputSchema: schemas/output.json\n"
            f"prompts:\n  system: {prompt_file}\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    unittest.main()
