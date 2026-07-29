import unittest
from types import SimpleNamespace

from app.agents.tools.extraction_tool import ExtractionTool
from app.agents.tools.validation_tool import ValidationTool
from app.config import settings


class FakePrompts:
    def get(self, prompt_id, version=None):
        if prompt_id.endswith(".system"):
            return SimpleNamespace(content="提取主题关键词", skill_version="1.1.0")
        return SimpleNamespace(content="输入：{{context_envelope}}", skill_version="1.1.0")


class FakeGateway:
    def __init__(self, data):
        self.data = data
        self.messages = None

    def chat_json(self, messages, options=None):
        self.messages = messages
        return {"data": self.data, "usage": {"total_tokens": 10}}


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
                "keywordCandidates": [{
                    "name": "Replication",
                    "aliases": ["物理复制"],
                    "category": "高可用",
                    "evidenceSource": "title",
                    "evidenceText": "Replication",
                    "confidence": 0.9,
                }],
                "knowledgePoints": [],
                "entities": [],
                "relations": [],
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

    def test_empty_model_result_is_an_explicit_failure(self):
        tool, _ = self._tool({
            "results": [{
                "chunkId": "chunk-1",
                "keywordCandidates": [],
                "knowledgePoints": [],
                "entities": [],
                "relations": [],
            }],
        })

        result = tool.extract_batch({"chunks": [{"chunkId": "chunk-1", "content": "正文"}]})

        self.assertFalse(result["success"])
        self.assertIn("没有任何关键词或知识候选", result["error"])

    def test_legacy_summary_is_normalized_to_statement_before_schema_validation(self):
        tool, _ = self._tool({
            "results": [{
                "chunkId": "chunk-1",
                "keywordCandidates": [],
                "knowledgePoints": [{
                    "title": "复制机制",
                    "summary": "主库通过物理日志向备库同步数据。",
                    "keywords": ["复制"],
                    "evidenceText": "主库通过物理日志向备库同步数据。",
                }],
                "entities": [],
                "relations": [],
            }],
        })

        result = tool.extract_batch({"chunks": [{"chunkId": "chunk-1", "content": "主库通过物理日志向备库同步数据。"}]})

        self.assertTrue(result["success"])
        point = result["result"]["results"][0]["knowledgePoints"][0]
        self.assertEqual(point["statement"], point["summary"])
        self.assertEqual(point["knowledgeType"], "technical_fact")

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


if __name__ == "__main__":
    unittest.main()
