import unittest
import time
import json
from types import SimpleNamespace

from app.agents import AgentTask, KnowledgeExtractionWorkflowAgent
from app.agents.tools.extraction_tool import ExtractionTool
from app.agents.tools.validation_tool import ValidationTool
from app.config import settings
from app.config import runtime_profile
from app.training_service import TrainingService


class FakePrompts:
    def __init__(self, defaults=None):
        self.skill = SimpleNamespace(
            manifest={"defaults": defaults or {}},
        )
        self.skills = SimpleNamespace(get=lambda skill_id, version=None: self.skill)

    def get(self, prompt_id, version=None):
        if prompt_id.endswith(".system"):
            return SimpleNamespace(content="提取主题关键词", skill_version="1.1.0")
        return SimpleNamespace(content="输入：{{context_envelope}}", skill_version="1.1.0")


class FakeGateway:
    def __init__(self, data, delay=0):
        self.data = data
        self.delay = delay
        self.messages = None
        self.options = None
        self.call_count = 0

    def chat_json(self, messages, options=None):
        self.call_count += 1
        self.messages = messages
        self.options = options
        if self.delay:
            time.sleep(self.delay)
        if isinstance(self.data, Exception):
            raise self.data
        return {"data": self.data, "usage": {"total_tokens": 10}}


class TrainingCancelledError(RuntimeError):
    pass


class KnowledgeExtractionToolTests(unittest.TestCase):
    def _tool(self, data):
        gateway = FakeGateway(data)
        tool = ExtractionTool({
            "prompts": FakePrompts(),
            "gateway": gateway,
            "skill_root": str(settings.processing_skill_root),
        })
        return tool, gateway

    def test_prompt_renders_json_envelope_without_template_markers(self):
        data = {
            "results": [{
                "chunkId": "chunk-1",
                "knowledgePoints": [{
                    "title": "复制机制",
                    "statement": "Replication 使用物理日志同步数据。",
                    "knowledgeType": "technical_fact",
                    "evidenceText": "Replication 使用物理日志同步数据。",
                    "confidence": 0.9,
                }],
            }],
        }
        tool, gateway = self._tool(data)

        result = tool.extract_batch({
            "document": {"semanticTitle": "Replication"},
            "chunks": [{"chunkId": "chunk-1", "content": "复制机制"}],
        })

        self.assertTrue(result["success"])
        self.assertIn('"semanticTitle": "Replication"', gateway.messages[1]["content"])
        self.assertNotIn("{{", gateway.messages[1]["content"])

    def test_agent_envelope_uses_enterprise_profile_domain_and_trace(self):
        agent = KnowledgeExtractionWorkflowAgent({
            "prompts": FakePrompts(),
            "gateway": FakeGateway({"results": []}),
            "skill_root": str(settings.processing_skill_root),
        })

        envelope = agent._build_extraction_envelope({
            "chunks": [{"chunkId": "chunk-1", "content": "YAS-00001"}],
            "document": {"title": "错误码"},
        })

        self.assertEqual(runtime_profile.domain_id, envelope["domain"])
        self.assertEqual(runtime_profile.domain_version, envelope["domainContextVersion"])
        self.assertEqual(runtime_profile.profile_id, envelope["enterpriseProfileId"])
        self.assertEqual(runtime_profile.profile_version, envelope["enterpriseProfileVersion"])
        self.assertEqual(runtime_profile.config_fingerprint, envelope["configFingerprint"])
        self.assertIn("errorCode:YAS-00001", envelope["domainContextHits"])

    def test_profile_migration_preserves_historical_error_code_types(self):
        anchors = TrainingService._explicit_anchors("YAS-00001 与 ORA-00001")

        self.assertIn(
            {"value": "YAS-00001", "candidateType": "YashanDBErrorCode"},
            anchors,
        )
        self.assertIn(
            {"value": "ORA-00001", "candidateType": "OracleErrorCode"},
            anchors,
        )

    def test_normalized_output_records_enterprise_profile_trace(self):
        normalized = TrainingService._normalize_skill_output(
            "knowledge-extraction",
            {"knowledgePoints": [], "entities": [], "relations": []},
            {"context_envelope": json.dumps({
                "domain": runtime_profile.domain_id,
                "domainContextVersion": runtime_profile.domain_version,
                "enterpriseProfileId": runtime_profile.profile_id,
                "enterpriseProfileVersion": runtime_profile.profile_version,
                "configFingerprint": runtime_profile.config_fingerprint,
            })},
            "2.0.0",
        )

        metadata = normalized["metadata"]
        self.assertEqual(runtime_profile.profile_id, metadata["enterpriseProfileId"])
        self.assertEqual(runtime_profile.profile_version, metadata["enterpriseProfileVersion"])
        self.assertEqual(runtime_profile.config_fingerprint, metadata["configFingerprint"])

    def test_empty_model_result_is_an_explicit_failure(self):
        tool, _ = self._tool({
            "results": [{
                "chunkId": "chunk-1",
                "knowledgePoints": [],
            }],
        })

        result = tool.extract_batch({"chunks": [{"chunkId": "chunk-1", "content": "正文"}]})

        self.assertFalse(result["success"])
        self.assertEqual(result["errorCode"], "KNOWLEDGE_EXTRACTION_EMPTY_RESULT")
        self.assertIn("没有知识点候选", result["error"])
        self.assertIsInstance(result["durationMs"], int)

    def test_legacy_summary_is_normalized_to_statement_before_schema_validation(self):
        tool, _ = self._tool({
            "results": [{
                "chunkId": "chunk-1",
                "knowledgePoints": [{
                    "title": "复制机制",
                    "summary": "主库通过物理日志向备库同步数据。",
                    "keywords": ["复制"],
                    "evidenceText": "主库通过物理日志向备库同步数据。",
                }],
            }],
        })

        result = tool.extract_batch({"chunks": [{"chunkId": "chunk-1", "content": "主库通过物理日志向备库同步数据。"}]})

        self.assertTrue(result["success"])
        point = result["result"]["results"][0]["knowledgePoints"][0]
        self.assertEqual(point["statement"], point["summary"])
        self.assertEqual(point["knowledgeType"], "technical_fact")

    def test_formal_knowledge_defaults_and_model_call_events_are_used(self):
        data = {
            "results": [{
                "chunkId": "chunk-1",
                "knowledgePoints": [{
                    "title": "LOB 存储",
                    "statement": "LOB 用于保存大对象。",
                    "knowledgeType": "technical_fact",
                    "evidenceText": "LOB 用于保存大对象。",
                    "confidence": 0.9,
                }],
            }],
        }
        gateway = FakeGateway(data)
        tool = ExtractionTool({
            "prompts": FakePrompts({"maxTokens": 1234, "timeoutMs": 45000, "maxRetries": 0}),
            "gateway": gateway,
            "skill_root": str(settings.processing_skill_root),
        })
        events = []

        result = tool.extract_batch(
            {"chunks": [{"chunkId": "chunk-1", "content": "LOB 用于保存大对象。"}]},
            context={
                "trace": {"taskId": "task-1", "stageRunId": "stage-1", "agentTaskId": "agent-1", "chunkId": "chunk-1"},
                "progress_callback": lambda event, details: events.append((event, details)),
            },
        )

        self.assertTrue(result["success"])
        self.assertEqual(gateway.options["max_tokens"], 1234)
        self.assertEqual(gateway.options["timeout_ms"], 45000)
        self.assertEqual(gateway.options["max_retries"], 0)
        self.assertTrue(result["modelCallId"].startswith("model_call_"))
        self.assertEqual(result["modelCalls"], {"succeeded": 1, "failed": 0})
        self.assertEqual([item[0] for item in events], ["model_call.started", "model_call.completed"])
        for _, details in events:
            self.assertEqual(details["taskId"], "task-1")
            self.assertEqual(details["stageRunId"], "stage-1")
            self.assertEqual(details["agentTaskId"], "agent-1")
            self.assertEqual(details["chunkId"], "chunk-1")
            self.assertTrue(details["modelCallId"].startswith("model_call_"))

    def test_failed_batch_returns_model_call_audit(self):
        gateway = FakeGateway(RuntimeError("timeout"))
        tool = ExtractionTool({
            "prompts": FakePrompts({"maxRetries": 0}),
            "gateway": gateway,
            "skill_root": str(settings.processing_skill_root),
        })
        events = []

        result = tool.extract_batch(
            {"chunks": [{"chunkId": "chunk-1", "content": "正文"}]},
            context={"progress_callback": lambda event, details: events.append((event, details))},
        )

        self.assertFalse(result["success"])
        self.assertEqual(result["errorCode"], "KNOWLEDGE_EXTRACTION_TIMEOUT")
        self.assertIn("timeout", result["technicalError"])
        self.assertTrue(result["modelCallId"].startswith("model_call_"))
        self.assertEqual(result["modelCalls"], {"succeeded": 0, "failed": 1})
        self.assertEqual([item[0] for item in events], ["model_call.started", "model_call.failed"])

    def test_schema_invalid_output_is_classified(self):
        gateway = FakeGateway({"results": "bad"})
        tool = ExtractionTool({
            "prompts": FakePrompts({"maxRetries": 0}),
            "gateway": gateway,
            "skill_root": str(settings.processing_skill_root),
        })

        result = tool.extract_batch({"chunks": [{"chunkId": "chunk-1", "content": "正文"}]})

        self.assertFalse(result["success"])
        self.assertEqual(result["errorCode"], "KNOWLEDGE_EXTRACTION_SCHEMA_INVALID")
        self.assertTrue(result["modelCallId"].startswith("model_call_"))

    def test_knowledge_point_skill_rejects_entity_and_relation_outputs(self):
        gateway = FakeGateway({
            "results": [{
                "chunkId": "chunk-1",
                "knowledgePoints": [],
                "entities": [{"name": "事务", "type": "Concept"}],
                "relations": [{"source": "事务", "target": "REDO", "type": "USES"}],
            }],
        })
        tool = ExtractionTool({
            "prompts": FakePrompts({"maxRetries": 0}),
            "gateway": gateway,
            "skill_root": str(settings.processing_skill_root),
        })

        result = tool.extract_batch({"chunks": [{"chunkId": "chunk-1", "content": "事务使用 REDO。"}]})

        self.assertFalse(result["success"])
        self.assertEqual(result["errorCode"], "KNOWLEDGE_EXTRACTION_SCHEMA_INVALID")
        self.assertEqual(result["modelCalls"], {"succeeded": 0, "failed": 1})

    def test_invalid_formal_input_is_rejected_before_model_call(self):
        data = {"results": []}
        gateway = FakeGateway(data)
        tool = ExtractionTool({
            "prompts": FakePrompts({"maxRetries": 0}),
            "gateway": gateway,
            "skill_root": str(settings.processing_skill_root),
        })

        result = tool.extract_batch({
            "chunks": [
                {"chunkId": f"chunk-{index}", "content": "正文"}
                for index in range(2)
            ],
        })

        self.assertFalse(result["success"])
        self.assertEqual(result["errorCode"], "KNOWLEDGE_EXTRACTION_SCHEMA_INVALID")
        self.assertIn("知识提取输入校验失败", result["error"])
        self.assertEqual(gateway.call_count, 0)
        self.assertEqual(result["modelCalls"], {"succeeded": 0, "failed": 0})
        self.assertIsNone(result.get("modelCallId"))

    def test_cancellation_propagates_instead_of_becoming_batch_failure(self):
        data = {
            "results": [{
                "chunkId": "chunk-1",
                "knowledgePoints": [{
                    "title": "事务提交",
                    "statement": "事务提交完成。",
                    "knowledgeType": "technical_fact",
                    "evidenceText": "事务提交。",
                    "confidence": 0.9,
                }],
            }],
        }
        gateway = FakeGateway(data, delay=0.4)
        tool = ExtractionTool({
            "prompts": FakePrompts(),
            "gateway": gateway,
            "skill_root": str(settings.processing_skill_root),
        })
        events = []
        checks = {"count": 0}

        def cancel_check():
            checks["count"] += 1
            if checks["count"] >= 2:
                raise TrainingCancelledError("用户取消了知识加工任务")

        with self.assertRaises(TrainingCancelledError):
            tool.extract_batch(
                {"chunks": [{"chunkId": "chunk-1", "content": "事务提交。"}]},
                context={
                    "cancel_check": cancel_check,
                    "progress_callback": lambda event, details: events.append((event, details)),
                },
            )

        self.assertEqual([item[0] for item in events], ["model_call.started", "model_call.cancelled"])

    def test_keyword_evidence_is_checked_against_declared_source(self):
        validator = ValidationTool({})
        extraction = {
            "success": True,
            "task": {"document": {"semanticTitle": "LOB", "domainTerms": []}},
            "chunks": [{"chunkId": "chunk-1", "content": "LOB 用于保存大对象。", "headingPath": ["存储机制"]}],
            "result": {
                "results": [{
                    "chunkId": "chunk-1",
                    "keywordCandidates": [
                        {"name": "LOB", "evidenceSource": "title", "evidenceText": "LOB"},
                        {"name": "大对象", "evidenceSource": "content", "evidenceText": "大对象"},
                        {"name": "事务", "evidenceSource": "content", "evidenceText": "事务"},
                    ],
                    "knowledgePoints": [],
                    "entities": [],
                    "relations": [],
                }],
            },
        }

        verified, rejected = validator.verify_and_repair(extraction)

        self.assertEqual([item["name"] for item in verified[0]["keywordCandidates"]], ["LOB", "大对象"])
        self.assertEqual(len(rejected), 1)
        self.assertIn("正文关键词证据", rejected[0]["reason"])

    def test_workflow_planning_assigns_exactly_one_chunk_to_each_agent_task(self):
        tool, gateway = self._tool({"results": []})
        agent = KnowledgeExtractionWorkflowAgent({
            "prompts": tool.prompts,
            "gateway": gateway,
            "skill_root": str(settings.processing_skill_root),
        })
        plan = agent._task_planning({
            "task_id": "task-1",
            "stage_run_id": "stage-1",
            "chunks": [
                {"id": "r:0", "resourceId": "r", "content": "第一段"},
                {"id": "r:1", "resourceId": "r", "content": "第二段"},
            ],
            "documents": [{"resourceId": "r"}],
            "keyword_context_by_chunk": {"r:0": [{"keywordId": "keyword-1"}]},
        })
        self.assertEqual(len(plan["task_queue"]), 2)
        self.assertTrue(all(len(item["chunks"]) == 1 for item in plan["task_queue"]))
        self.assertEqual(plan["task_queue"][0]["keyword_context"][0]["keywordId"], "keyword-1")

    def test_workflow_keeps_successful_chunk_when_another_chunk_fails(self):
        class PerChunkGateway:
            def chat_json(self, messages, options=None):
                envelope = json.loads(messages[1]["content"].removeprefix("输入："))
                chunk = envelope["chunks"][0]
                if chunk["chunkId"] == "chunk-failed":
                    raise RuntimeError("timeout")
                return {
                    "data": {
                        "results": [{
                            "chunkId": chunk["chunkId"],
                            "knowledgePoints": [{
                                "title": "复制机制",
                                "statement": "Replication 使用物理日志同步数据。",
                                "knowledgeType": "technical_fact",
                                "evidenceText": "Replication 使用物理日志同步数据。",
                                "confidence": 0.9,
                            }],
                        }],
                    },
                    "usage": {},
                }

        events = []
        agent = KnowledgeExtractionWorkflowAgent({
            "prompts": FakePrompts({"maxRetries": 0, "concurrency": 2}),
            "gateway": PerChunkGateway(),
            "skill_root": str(settings.processing_skill_root),
        })
        result = agent.execute(AgentTask(
            task_id="task-1",
            input_data={
                "task_id": "task-1",
                "stage_run_id": "stage-1",
                "chunks": [
                    {"id": "chunk-ok", "resourceId": "resource-1", "content": "Replication 使用物理日志同步数据。"},
                    {"id": "chunk-failed", "resourceId": "resource-1", "content": "失败单元。"},
                ],
                "documents": [{"resourceId": "resource-1"}],
                "progress_callback": lambda event, details: events.append((event, details)),
            },
        ))

        self.assertEqual(len(result.output_data["knowledgePoints"]), 1)
        self.assertEqual(len(result.output_data["_batchAudits"]), 2)
        self.assertEqual(sum(1 for item in result.output_data["_batchAudits"] if item["success"]), 1)
        self.assertEqual(sum(1 for event, _ in events if event == "agent_task.completed"), 1)
        self.assertEqual(sum(1 for event, _ in events if event == "agent_task.failed"), 1)


if __name__ == "__main__":
    unittest.main()
