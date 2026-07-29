from datetime import datetime, timezone
import unittest
from pathlib import Path

from app.ingestion import (
    ComponentRegistry,
    ComponentRegistryError,
    IngestionContext,
    MaterialSource,
    PipelineDefinition,
    PipelineRunner,
    SourceType,
    StageResult,
    StageStatus,
    build_default_framework,
)
from app.ingestion.defaults import DeclaredStage


class RegistryTests(unittest.TestCase):
    def test_registry_rejects_duplicate_keys(self):
        registry = ComponentRegistry("测试组件")
        registry.register(DeclaredStage("one", "一个"))
        with self.assertRaisesRegex(ComponentRegistryError, "已注册"):
            registry.register(DeclaredStage("one", "重复"))

    def test_default_framework_declares_upload_and_pingcode(self):
        framework = build_default_framework()
        capabilities = framework.capabilities()
        self.assertEqual(
            [item["key"] for item in capabilities["sourceTypes"]],
            ["upload", "pingcode"],
        )
        self.assertTrue(capabilities["sourceTypes"][0]["supportsResume"])
        self.assertEqual(capabilities["pipeline"]["stageKeys"][0], "ingest")

    def test_upload_source_plan_is_resumable(self):
        framework = build_default_framework()
        plan = framework.prepare_source(
            SourceType.UPLOAD,
            {"sourceId": "upload-1", "displayName": "本地上传"},
        )
        self.assertEqual(plan.source_type, SourceType.UPLOAD)
        self.assertEqual(plan.source_id, "upload-1")
        self.assertTrue(plan.supports_resume)


class PipelineRunnerTests(unittest.TestCase):
    def setUp(self):
        self.context = IngestionContext(
            batch_id="batch-framework",
            source=MaterialSource(
                source_type=SourceType.UPLOAD,
                source_id="upload-1",
                display_name="测试上传",
                captured_at=datetime.now(timezone.utc),
            ),
            input_root=Path("/tmp/input"),
        )

    def test_runner_preserves_order_and_emits_events(self):
        events = []

        class Logger:
            def emit(self, event):
                events.append(event)

        definition = PipelineDefinition(
            key="test",
            display_name="测试",
            stages=(
                DeclaredStage("first", "第一步"),
                DeclaredStage("second", "第二步"),
            ),
        )
        result = PipelineRunner(Logger()).run(definition, self.context)
        self.assertEqual(result.status, StageStatus.COMPLETED)
        self.assertEqual([item.stage_id for item in result.stage_results], ["first", "second"])
        self.assertEqual([item["event"] for item in events], [
            "stage_started", "stage_finished", "stage_started", "stage_finished"
        ])

    def test_runner_stops_after_failed_stage(self):
        class FailingStage:
            key = "failing"
            display_name = "失败"

            def execute(self, context):
                return StageResult(stage_id=self.key, status=StageStatus.FAILED, message="boom")

        class ShouldNotRun:
            key = "after"
            display_name = "不应执行"

            def execute(self, context):
                raise AssertionError("failed stage 后不应继续执行")

        result = PipelineRunner().run(
            PipelineDefinition("test", "测试", (FailingStage(), ShouldNotRun())),
            self.context,
        )
        self.assertEqual(result.status, StageStatus.FAILED)
        self.assertEqual([item.stage_id for item in result.stage_results], ["failing"])


if __name__ == "__main__":
    unittest.main()
