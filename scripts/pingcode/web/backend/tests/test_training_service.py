import hashlib
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from app.models import DatasetVersion, PreprocessConfig, TaskSnapshot, TrainingReviewDecision, TrainingTaskCreate
from app.metadata_service import MetadataConstructionService
from app.training_service import (
    GRAPH_SCHEMA_VERSION,
    ModelGatewayClient,
    STAGES,
    TrainingCancelledError,
    TrainingService,
    error_summary,
    utcnow,
)
from app.prompt_registry import PromptRegistry
from app.services import PreprocessService
from app.store import JsonStore


class FakeEvents:
    def __init__(self):
        self.items = []

    def publish_event(self, task_id, event_name, data):
        self.items.append((task_id, event_name, data))


class FakeTasks:
    def __init__(self, task):
        self.task = task
        self.events = FakeEvents()

    def get(self, task_id):
        if task_id != self.task.id:
            raise KeyError(task_id)
        return self.task

    def list(self, batch_id=None):
        items = [self.task]
        if batch_id:
            items = [item for item in items if item.batch_id == batch_id]
        return items

    def _update(self, task_id, **changes):
        self.get(task_id)
        self.task = self.task.model_copy(update={**changes, "updated_at": utcnow()})
        self.events.publish_event(task_id, "task.progress", self.task.model_dump(mode="json", by_alias=True))
        return self.task


class FakeBatches:
    def __init__(self, batch=None):
        self.batch = batch or SimpleNamespace(id="batch-test", state="downloaded", active_task_ids=[])
        self.updates = []

    def get(self, batch_id):
        if batch_id != self.batch.id:
            raise KeyError(batch_id)
        return self.batch

    def update(self, batch_id, **changes):
        self.updates.append((batch_id, changes))


class FakeStore:
    def __init__(self):
        self.records = {}

    def put_record(self, collection, record_id, value):
        self.records[(collection, record_id)] = value

    def get_record(self, collection, record_id):
        return self.records.get((collection, record_id))

    def list_records(self, collection):
        return [value for (name, _), value in self.records.items() if name == collection]

    def update_record(self, collection, record_id, changes):
        value = self.records.get((collection, record_id))
        if value is None:
            return None
        value.update(changes)
        return value


class FakePreprocess:
    def __init__(self):
        self.cancelled = []

    def cancel(self, task_id):
        self.cancelled.append(task_id)


class FakePreparation:
    def __init__(self, root: Path, batch_id: str = "batch-test"):
        self.root = root
        self.batch_id = batch_id
        self.calls = []

    def prepare(self, batch_id, config, parent_task_id=None, stage_run_id=None):
        self.calls.append((batch_id, stage_run_id))
        run_dir = self.root / "batches" / batch_id / "training-preparation" / "preflight"
        (run_dir / "metadata").mkdir(parents=True, exist_ok=True)
        (run_dir / "final-results").mkdir(parents=True, exist_ok=True)
        (run_dir / "metadata/source-documents.jsonl").write_text(
            "\n".join([
                json.dumps({"resourceId": "resource-1", "formatFamily": "office", "processingStatus": "completed"}),
                json.dumps({"resourceId": "resource-2", "formatFamily": "text", "processingStatus": "completed"}),
            ]),
            encoding="utf-8",
        )
        (run_dir / "metadata/chunks.jsonl").write_text(
            "\n".join([
                json.dumps({"chunkId": "resource-1:0", "resourceId": "resource-1", "content": "A"}),
                json.dumps({"chunkId": "resource-2:0", "resourceId": "resource-2", "content": "B"}),
            ]),
            encoding="utf-8",
        )
        (run_dir / "manifest.json").write_text(json.dumps({
            "resources": [
                {"resourceId": "resource-1", "formatFamily": "office", "processingStatus": "completed"},
                {"resourceId": "resource-2", "formatFamily": "text", "processingStatus": "completed"},
            ],
        }), encoding="utf-8")
        return SimpleNamespace(manifest_path=str(run_dir.relative_to(self.root) / "stage-result.json"))


class FakePromptRegistry:
    def __init__(self, root, defaults=None):
        self.skill = SimpleNamespace(
            root=Path(root),
            version="1.0.1",
            manifest={
                "outputSchema": "output.schema.json",
                "defaults": defaults or {"maxTokens": 1200, "timeoutMs": 90000, "maxRetries": 0, "maxDirectCharacters": 12},
            },
        )
        self.skills = SimpleNamespace(get=lambda skill_id, version=None: self.skill)

    def get(self, prompt_id, version=None):
        content = "系统提示" if prompt_id.endswith(".system") else "标题 {{document_title}} 路径 {{source_path}} 正文 {{content}}"
        return SimpleNamespace(content=content, skill_version="1.0.1")


class FakeGateway:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def chat_json(self, messages, options):
        self.calls.append((messages, options))
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    def status(self):
        return {"configured": True, "capabilities": {"chat": True}, "provider": "fake", "model": "fake-model"}


class TrainingGraphTests(unittest.TestCase):
    def setUp(self):
        self.service = TrainingService(None, None, None, None, None, gateway=None)
        self.chunks = [{
            "id": "resource-1:0",
            "resourceId": "resource-1",
            "sourcePath": "docs/errors.md",
            "content": "YAS-00001 表示参数 p_size 无效。ORA-00942 是 Oracle 错误。",
        }]

    def test_graph_preserves_evidence_and_distinguishes_error_code_domains(self):
        extractions = [{
            "resourceId": "resource-1",
            "chunkId": "resource-1:0",
            "result": {
                "knowledgePoints": [],
                "entities": [
                    {"name": "YAS-00001", "type": "ErrorCode", "evidenceText": "YAS-00001", "confidence": 0.95},
                    {"name": "ORA-00942", "type": "ErrorCode", "evidenceText": "ORA-00942", "confidence": 0.9},
                ],
                "relations": [{
                    "source": "YAS-00001",
                    "target": "ORA-00942",
                    "type": "COMPARED_WITH",
                    "evidenceText": "YAS-00001 表示参数 p_size 无效。ORA-00942 是 Oracle 错误。",
                    "confidence": 0.7,
                }],
            },
        }]
        issues = []
        nodes, edges = self.service._build_graph(self.chunks, extractions, issues)
        types = {node["name"]: node["type"] for node in nodes if node["type"] not in {"Document", "Chunk"}}
        self.assertEqual(types["YAS-00001"], "YashanDBErrorCode")
        self.assertEqual(types["ORA-00942"], "OracleErrorCode")
        relation = next(edge for edge in edges if edge["type"] == "COMPARED_WITH")
        self.assertEqual(relation["sourceResourceId"], "resource-1")
        self.assertEqual(relation["chunkId"], "resource-1:0")
        self.assertTrue(relation["evidenceText"])
        self.assertEqual(issues, [])


class TrainingPreflightTests(unittest.TestCase):
    def setUp(self):
        self.service = TrainingService(None, None, None, None, None, gateway=None)
        self.chunks = [{
            "id": "resource-1:0",
            "resourceId": "resource-1",
            "sourcePath": "docs/errors.md",
            "content": "YAS-00001 表示参数 p_size 无效。ORA-00942 是 Oracle 错误。",
        }]

    def test_preflight_uses_preparation_sources_and_reports_processable_counts(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            preparation = FakePreparation(root)
            batches = FakeBatches(SimpleNamespace(id="batch-test", state="downloaded", active_task_ids=[]))
            task = TaskSnapshot(
                id="task-1",
                batchId="batch-test",
                type="graph",
                state="queued",
                stage="queued",
                createdAt=utcnow(),
                updatedAt=utcnow(),
            )
            service = TrainingService(
                FakeStore(),
                batches,
                FakeTasks(task),
                None,
                FakePromptRegistry(root),
                preparation=preparation,
                gateway=FakeGateway([{"data": {"configured": True, "provider": "fake", "model": "fake"}}]),
            )
            test_request = TrainingTaskCreate(batchId="batch-test")
            with patch("app.training_service.settings", SimpleNamespace(data_root=root, model_gateway_url="", model_gateway_token="", model_gateway_timeout=30)):
                result = service._preflight_with_material_preparation(test_request, {"lastTest": {"latencyMs": 1000}})

        self.assertEqual(result["processableCount"], 2)
        self.assertEqual(result["directTextCount"], 1)
        self.assertEqual(result["convertibleCount"], 1)
        self.assertEqual(result["estimatedChunkCount"], 2)
        self.assertTrue(result["canStart"])
        self.assertTrue(preparation.calls)

    def test_graph_nodes_expose_clean_display_name_and_raw_name(self):
        class DatasetPreprocess:
            def __init__(self, dataset):
                self.dataset = dataset

            def get_dataset(self, dataset_id):
                if dataset_id != self.dataset.id:
                    raise KeyError(dataset_id)
                return self.dataset

        with TemporaryDirectory() as directory, patch("app.training_service.settings", SimpleNamespace(data_root=Path(directory))):
            root = Path(directory)
            store = JsonStore(root / "state.json")
            dataset = DatasetVersion(
                id="dataset-graph-display", batchId="batch-test", preprocessTaskId="prep-test",
                state="candidate", config=PreprocessConfig(), totalDocuments=1, totalChunks=1,
                qualityMetrics={"knowledgeCount": 0}, qualityPassed=True,
                trainingTaskId="training-display", graphAvailable=True,
                graphSummary={"graphSource": "metadata_keyword", "graphSchemaVersion": GRAPH_SCHEMA_VERSION},
                createdAt=utcnow(),
            )
            store.put_record("datasets", dataset.id, dataset.model_dump(mode="json", by_alias=True))
            service = TrainingService(store, None, None, DatasetPreprocess(dataset), None, gateway=FakeGateway([]))
            run_dir = root / "training-runs" / "training-display" / "graph"
            run_dir.mkdir(parents=True)
            nodes = [{
                "id": "node-1",
                "type": "Keyword",
                "name": "93ea96f2-XML_TABLE Claude",
                "sourceResourceId": "resource-1",
                "chunkId": "resource-1:0",
            }]
            edges = []
            service._write_json(run_dir / "nodes.json", nodes)
            service._write_json(run_dir / "edges.json", edges)

            result = service.graph(dataset.id, "nodes")

            self.assertEqual(result[0]["name"], "XML_TABLE Claude")
            self.assertEqual(result[0]["displayName"], "XML_TABLE Claude")
            self.assertEqual(result[0]["rawName"], "93ea96f2-XML_TABLE Claude")
            self.assertEqual(result[0]["knowledgeDomain"], "what")
            self.assertEqual(result[0]["ontologyType"], "Concept")

    def test_graph_neighborhood_limits_edges_and_marks_truncated(self):
        class DatasetPreprocess:
            def __init__(self, dataset):
                self.dataset = dataset

            def get_dataset(self, dataset_id):
                if dataset_id != self.dataset.id:
                    raise KeyError(dataset_id)
                return self.dataset

        with TemporaryDirectory() as directory, patch("app.training_service.settings", SimpleNamespace(data_root=Path(directory))):
            root = Path(directory)
            store = JsonStore(root / "state.json")
            dataset = DatasetVersion(
                id="dataset-neighborhood", batchId="batch-test", preprocessTaskId="prep-test",
                state="candidate", config=PreprocessConfig(), totalDocuments=1, totalChunks=1,
                qualityMetrics={"knowledgeCount": 0}, qualityPassed=True,
                trainingTaskId="training-neighborhood", graphAvailable=True,
                graphSummary={"graphSource": "metadata_keyword", "graphSchemaVersion": GRAPH_SCHEMA_VERSION},
                createdAt=utcnow(),
            )
            store.put_record("datasets", dataset.id, dataset.model_dump(mode="json", by_alias=True))
            service = TrainingService(store, None, None, DatasetPreprocess(dataset), None, gateway=FakeGateway([]))
            run_dir = root / "training-runs" / "training-neighborhood" / "graph"
            run_dir.mkdir(parents=True)
            keyword_id = "node-keyword"
            nodes = [
                {"id": keyword_id, "type": "Keyword", "name": "XML_TABLE Claude", "rawName": "93ea96f2-XML_TABLE Claude", "displayName": "XML_TABLE Claude"},
                {"id": "node-chunk-1", "type": "ProcessingUnit", "name": "chunk-1", "rawName": "chunk-1", "displayName": "chunk-1"},
                {"id": "node-chunk-2", "type": "ProcessingUnit", "name": "chunk-2", "rawName": "chunk-2", "displayName": "chunk-2"},
            ]
            edges = [
                {"id": "edge-1", "type": "CONTEXT_MATCHES_CHUNK", "source": keyword_id, "target": "node-chunk-1"},
                {"id": "edge-2", "type": "CONTEXT_MATCHES_CHUNK", "source": keyword_id, "target": "node-chunk-2"},
            ]
            service._write_json(run_dir / "nodes.json", nodes)
            service._write_json(run_dir / "edges.json", edges)

            result = service.graph_neighborhood(dataset.id, keyword_id, limit=1)

            self.assertEqual(result["focusNode"]["id"], keyword_id)
            self.assertEqual(len(result["edges"]), 1)
            self.assertTrue(result["truncated"])
            self.assertEqual({item["id"] for item in result["nodes"]}, {keyword_id, "node-chunk-1"})
            self.assertEqual(result["focusNode"]["knowledgeDomain"], "what")

    def test_graph_summary_reports_what_how_why_quality_metrics(self):
        nodes = [
            {"id": "what-1", "type": "Keyword", "name": "XML_TABLE"},
            {"id": "how-1", "type": "KnowledgePoint", "name": "如何配置连接池"},
            {"id": "why-1", "type": "KnowledgePoint", "name": "为什么连接失败"},
            {"id": "unit-1", "type": "ProcessingUnit", "name": "resource-1:0"},
        ]
        edges = [
            {"id": "edge-1", "type": "CONTEXT_MATCHES_CHUNK", "source": "how-1", "target": "unit-1", "sourceResourceId": "resource-1", "chunkId": "resource-1:0", "evidenceText": "如何配置连接池"},
            {"id": "edge-2", "type": "CONTEXT_MATCHES_CHUNK", "source": "why-1", "target": "unit-1", "sourceResourceId": "resource-1", "chunkId": "resource-1:0", "evidenceText": "为什么连接失败"},
        ]

        summary = self.service._graph_summary(nodes, edges, [], "metadata_keyword")

        self.assertEqual(summary["knowledgeDomainCounts"]["what"], 1)
        self.assertEqual(summary["knowledgeDomainCounts"]["how"], 1)
        self.assertEqual(summary["knowledgeDomainCounts"]["why"], 1)
        self.assertEqual(summary["relationCoverage"], 0.6667)
        self.assertEqual(summary["isolatedKnowledgeRatio"], 0.3333)
        self.assertEqual(summary["whyMissingRate"], 0.6667)
        self.assertEqual(summary["evidenceCompleteness"], 1.0)
        self.assertEqual(summary["crossDocumentRelationCount"], 0)

    def test_relation_without_evidence_is_excluded(self):
        extractions = [{
            "resourceId": "resource-1",
            "chunkId": "resource-1:0",
            "result": {
                "entities": [{"name": "参数A"}, {"name": "参数B"}],
                "relations": [{"source": "参数A", "target": "参数B", "type": "DEPENDS_ON"}],
            },
        }]
        issues = []
        _, edges = self.service._build_graph(self.chunks, extractions, issues)
        self.assertFalse(any(edge["type"] == "DEPENDS_ON" for edge in edges))
        self.assertEqual(issues[0]["code"], "RELATION_EVIDENCE_INCOMPLETE")

    def test_missing_confidence_is_not_treated_as_certain(self):
        self.assertEqual(self.service._confidence({"entities": [{"name": "参数A"}]}), 0.0)


class KnowledgeValidationAndDatasetTests(unittest.TestCase):
    def setUp(self):
        self.service = TrainingService(None, None, None, None, None, gateway=None)
        self.chunk = {
            "id": "resource-1:0",
            "resourceId": "resource-1",
            "sourcePath": "docs/config.md",
            "content": "参数 max_connections 影响并发连接。",
            "documentOffsets": {"start": 100, "end": 132},
            "sourceLocations": [{"kind": "page", "pageNumber": 3, "blockIndex": 2}],
        }

    def test_quality_issue_display_normalization_hides_title_missing_version_unclear_and_downgrades_category_metadata(self):
        items = [
            {"code": "METADATA_TITLE_MISSING", "severity": "warning", "message": "文档没有可识别标题，已使用文件名作为标题"},
            {"code": "METADATA_VERSION_UNCLEAR", "severity": "warning", "message": "文档未明确出现适用版本"},
            {"code": "METADATA_CATEGORY_CONFLICT", "severity": "warning", "message": "文档分类存在冲突候选：特性设计、测试设计"},
            {"code": "METADATA_CATEGORY_UNRESOLVED", "severity": "warning", "message": "文档分类无法由固定规则确定，已归类为“未分类”"},
            {"code": "OTHER", "severity": "warning", "message": "保留"},
        ]
        normalized = self.service._normalize_quality_issues_for_display(items)
        self.assertEqual([item["code"] for item in normalized], ["METADATA_CATEGORY_CONFLICT", "METADATA_CATEGORY_UNRESOLVED", "OTHER"])
        conflict = normalized[0]
        self.assertEqual(conflict["severity"], "info")
        self.assertEqual(conflict["details"]["severity"], "info")
        self.assertIn("不影响知识提取", conflict["message"])
        unresolved = normalized[1]
        self.assertEqual(unresolved["severity"], "info")
        self.assertEqual(unresolved["details"]["severity"], "info")
        self.assertIn("不影响知识提取", unresolved["message"])

    def _candidate(self, candidate_id, kind, value, evidence, offsets):
        return {
            "candidateId": candidate_id,
            "kind": kind,
            "resourceId": "resource-1",
            "chunkId": "resource-1:0",
            "sourcePath": "docs/config.md",
            "value": value,
            "evidenceText": evidence,
            "evidenceOffsets": offsets,
            "sourceMethod": "knowledge_extraction_workflow_agent",
            "schemaVersion": "2.0.0",
            "inputHash": "sha256:test",
            "confidence": 0.9,
        }

    def test_validation_rejects_bad_offsets_and_unresolved_relation_endpoints(self):
        evidence = "max_connections"
        valid_offsets = {"start": 103, "end": 118}
        candidates = [
            self._candidate("entity-1", "entity", {"name": "max_connections", "type": "Parameter"}, evidence, valid_offsets),
            self._candidate("entity-2", "entity", {"name": "并发连接", "type": "Concept"}, "并发连接", {"start": 121, "end": 125}),
            self._candidate("point-bad", "knowledge_point", {"title": "错误偏移", "statement": "错误偏移", "knowledgeType": "Fact"}, evidence, {"start": 0, "end": 15}),
            self._candidate("relation-bad", "relation", {"source": "max_connections", "target": "不存在", "type": "AFFECTS"}, "参数 max_connections 影响并发连接。", {"start": 100, "end": 126}),
        ]

        accepted, rejected, issues = self.service._validate_knowledge_candidates(candidates, [self.chunk])

        self.assertEqual({item["kind"] for item in accepted}, {"entity"})
        self.assertEqual({item["code"] for item in rejected}, {"KNOWLEDGE_EVIDENCE_INVALID", "KNOWLEDGE_RELATION_ENDPOINT_INVALID"})
        self.assertTrue(all(item["validationState"] == "passed" for item in accepted))
        self.assertTrue(all(item["sourceLocations"] for item in accepted))
        self.assertEqual(len(issues), 2)

    def test_graph_uses_final_knowledge_and_expected_node_layers(self):
        evidence = "max_connections"
        candidates = [
            self._candidate("point-1", "knowledge_point", {"title": "max_connections 影响并发", "statement": "参数 max_connections 影响并发连接。", "knowledgeType": "Fact"}, "参数 max_connections 影响并发连接。", {"start": 100, "end": 126}),
            self._candidate("entity-1", "entity", {"name": "max_connections", "type": "Parameter"}, evidence, {"start": 103, "end": 118}),
            self._candidate("entity-2", "entity", {"name": "并发连接", "type": "Concept"}, "并发连接", {"start": 121, "end": 125}),
            self._candidate("relation-1", "relation", {"source": "max_connections", "target": "并发连接", "type": "AFFECTS"}, "参数 max_connections 影响并发连接。", {"start": 100, "end": 126}),
        ]
        knowledge, rejected, _ = self.service._validate_knowledge_candidates(candidates, [self.chunk])

        nodes, edges = self.service._build_graph_from_knowledge([self.chunk], knowledge, [])

        self.assertEqual(rejected, [])
        self.assertEqual({item["type"] for item in nodes}, {"ProcessingUnit", "KnowledgePoint", "Parameter", "Concept"})
        self.assertEqual({item["type"] for item in edges}, {"CONTEXT_MATCHES_CHUNK", "AFFECTS"})
        self.assertFalse(any(item["type"] == "DOCUMENT_CONTAINS_UNIT" for item in edges))
        context_edge = next(item for item in edges if item["type"] == "CONTEXT_MATCHES_CHUNK")
        self.assertIn("contextText", context_edge)
        relation = next(item for item in edges if item["type"] == "AFFECTS")
        self.assertEqual(relation["sourceLocations"][0]["pageNumber"], 3)

        summary = self.service._graph_summary(nodes, edges, [])
        self.assertEqual(summary["keywordCount"], 3)
        self.assertEqual(summary["chunkCount"], 1)
        self.assertEqual(summary["contextEdgeCount"], 3)

    def test_dataset_graph_falls_back_to_metadata_keywords_when_final_knowledge_empty(self):
        documents = [{
            "resourceId": "resource-1",
            "sourcePath": "docs/config.md",
            "title": "参数配置",
            "keywords": ["max_connections", "MAX_CONNECTIONS", "dataset_a0400362ca354c61", "file_1c34b7d8d3d84e37"],
            "domainTerms": [{
                "termId": "database.parameter.max_connections",
                "canonicalName": "max_connections",
                "matchedAliases": ["max_connections", "MAX_CONNECTIONS"],
                "category": "参数",
                "termType": "database_parameter",
            }],
        }]
        contexts = [{
            "chunkId": "resource-1:0",
            "resourceId": "resource-1",
            "chunkSummary": "参数 max_connections 影响并发连接。",
            "previousChunkSummary": "参数章节",
            "nextChunkSummary": "连接池章节",
            "documentKeywords": ["max_connections", "MAX_CONNECTIONS", "dataset_a0400362ca354c61", "file_1c34b7d8d3d84e37"],
            "domainTerms": documents[0]["domainTerms"],
        }]

        nodes, edges, graph_source = self.service._build_dataset_graph([self.chunk], [], [], documents, contexts)

        self.assertEqual(graph_source, "metadata_keyword")
        keyword_nodes = [item for item in nodes if item["type"] == "Keyword"]
        self.assertEqual(len(keyword_nodes), 1)
        keyword = keyword_nodes[0]
        self.assertEqual(keyword["canonicalName"], "max_connections")
        self.assertIn("MAX_CONNECTIONS", keyword.get("aliases", []))
        self.assertNotIn("dataset_a0400362ca354c61", keyword.get("aliases", []))
        self.assertNotIn("file_1c34b7d8d3d84e37", keyword.get("aliases", []))
        self.assertEqual({item["type"] for item in nodes}, {"Keyword", "ProcessingUnit"})
        self.assertTrue(edges)
        self.assertTrue(all(item["type"] == "CONTEXT_MATCHES_CHUNK" for item in edges))
        self.assertFalse(any(item["type"] == "DOCUMENT_CONTAINS_UNIT" for item in edges))
        edge = next(item for item in edges if item["sourceMethod"] == "metadata_keyword")
        self.assertIn("evidenceText", edge)
        self.assertIn("contextText", edge)
        self.assertEqual(edge["sourceResourceId"], "resource-1")
        self.assertEqual(edge["chunkId"], "resource-1:0")
        self.assertEqual(edge["sourceLocations"][0]["pageNumber"], 3)

        summary = self.service._graph_summary(nodes, edges, [], graph_source)
        self.assertEqual(summary["graphSource"], "metadata_keyword")
        self.assertEqual(summary["keywordCount"], 1)
        self.assertEqual(summary["chunkCount"], 1)
        self.assertGreater(summary["contextEdgeCount"], 0)
        self.assertEqual(summary["graphSchemaVersion"], GRAPH_SCHEMA_VERSION)

    def test_metadata_keyword_term_id_merges_resources_and_alias_returns_all_edges(self):
        term = {
            "termId": "database.object.index",
            "canonicalName": "Index",
            "matchedAliases": ["Index", "index", "索引"],
            "category": "数据库对象",
            "termType": "database_object",
        }
        second_chunk = {
            **self.chunk,
            "id": "resource-2:0",
            "resourceId": "resource-2",
            "sourcePath": "docs/index.md",
            "content": "索引可以加速查询。",
        }
        documents = [
            {"resourceId": "resource-1", "keywords": ["Index", "file_11112222"], "domainTerms": [term]},
            {"resourceId": "resource-2", "keywords": ["索引", "dataset_aaaabbbb"], "domainTerms": [term]},
        ]
        contexts = [
            {"chunkId": "resource-1:0", "resourceId": "resource-1", "chunkSummary": "Index 配置", "documentKeywords": documents[0]["keywords"], "domainTerms": [term]},
            {"chunkId": "resource-2:0", "resourceId": "resource-2", "chunkSummary": "索引原理", "documentKeywords": documents[1]["keywords"], "domainTerms": [term]},
        ]

        nodes, edges, graph_source = self.service._build_dataset_graph(
            [self.chunk, second_chunk], [], [], documents, contexts
        )

        self.assertEqual(graph_source, "metadata_keyword")
        keywords = [item for item in nodes if item["type"] == "Keyword"]
        self.assertEqual(len(keywords), 1)
        keyword = keywords[0]
        self.assertEqual(keyword["canonicalName"], "Index")
        self.assertEqual(set(keyword["sourceResourceIds"]), {"resource-1", "resource-2"})
        self.assertEqual(set(keyword["chunkIds"]), {"resource-1:0", "resource-2:0"})
        self.assertIn("索引", keyword["aliases"])
        self.assertFalse(any(self.service._is_technical_keyword(item["name"]) for item in keywords))
        with patch.object(self.service, "graph", side_effect=[nodes, edges]):
            neighborhood = self.service.graph_neighborhood("dataset-test", "索引", limit=10)
        self.assertEqual(neighborhood["focusNode"]["id"], keyword["id"])
        self.assertEqual(neighborhood["totalEdges"], 2)
        self.assertEqual({item["chunkId"] for item in neighborhood["edges"]}, {"resource-1:0", "resource-2:0"})

    def test_model_keywords_merge_across_documents_and_keep_all_evidence(self):
        second_chunk = {
            **self.chunk,
            "id": "resource-2:0",
            "resourceId": "resource-2",
            "sourcePath": "docs/replication-guide.md",
            "content": "物理复制用于同步主备数据库。",
        }
        documents = [
            {"resourceId": "resource-1", "title": "Replication内幕", "semanticTitle": "Replication"},
            {"resourceId": "resource-2", "title": "复制指南", "semanticTitle": "复制指南"},
        ]
        contexts = [
            {"chunkId": "resource-1:0", "resourceId": "resource-1", "chunkSummary": "Replication 机制"},
            {"chunkId": "resource-2:0", "resourceId": "resource-2", "chunkSummary": "物理复制机制"},
        ]
        candidates = [
            {
                "candidateId": "candidate-1",
                "resourceId": "resource-1",
                "chunkId": "resource-1:0",
                "canonicalName": "Replication",
                "termId": "database.replication.physical_replication",
                "aliases": ["Replication", "物理复制"],
                "matchedAliases": ["Replication"],
                "sourceMethod": "model_keyword",
                "evidenceSource": "title",
                "evidenceText": "Replication",
                "confidence": 0.91,
            },
            {
                "candidateId": "candidate-2",
                "resourceId": "resource-2",
                "chunkId": "resource-2:0",
                "canonicalName": "Replication",
                "termId": "database.replication.physical_replication",
                "aliases": ["Replication", "物理复制"],
                "matchedAliases": ["物理复制"],
                "sourceMethod": "model_keyword",
                "evidenceSource": "content",
                "evidenceText": "物理复制",
                "confidence": 0.88,
            },
        ]

        nodes, edges, graph_source = self.service._build_dataset_graph(
            [self.chunk, second_chunk], [], [], documents, contexts, candidates
        )

        self.assertEqual(graph_source, "model_keyword")
        keyword_nodes = [item for item in nodes if item["type"] == "Keyword"]
        self.assertEqual(len(keyword_nodes), 1)
        keyword = keyword_nodes[0]
        self.assertEqual(keyword["canonicalName"], "Replication")
        self.assertEqual(set(keyword["sourceResourceIds"]), {"resource-1", "resource-2"})
        self.assertEqual(set(keyword["chunkIds"]), {"resource-1:0", "resource-2:0"})
        self.assertEqual(set(keyword["evidenceSources"]), {"title", "content"})
        self.assertEqual(len(keyword["occurrences"]), 2)
        self.assertEqual(keyword["modelConfidence"], 0.91)
        self.assertEqual(len(edges), 2)
        self.assertEqual({item["evidenceSource"] for item in edges}, {"title", "content"})

    def test_model_keyword_graph_is_not_limited_to_glossary_terms(self):
        candidate = {
            "candidateId": "candidate-persistence",
            "resourceId": "resource-1",
            "chunkId": "resource-1:0",
            "canonicalName": "持久化",
            "termId": None,
            "aliases": [],
            "matchedAliases": ["持久化"],
            "sourceMethod": "model_keyword",
            "evidenceSource": "title",
            "evidenceText": "持久化",
            "confidence": 0.86,
        }
        nodes, edges, graph_source = self.service._build_dataset_graph(
            [self.chunk],
            [],
            [],
            [{"resourceId": "resource-1", "title": "持久化", "semanticTitle": "持久化"}],
            [],
            [candidate],
        )

        self.assertEqual(graph_source, "model_keyword")
        self.assertEqual([item["canonicalName"] for item in nodes if item["type"] == "Keyword"], ["持久化"])
        self.assertEqual(len(edges), 1)

    def test_final_knowledge_empty_warning_is_publishable_severity(self):
        warning = {
            "code": "FINAL_KNOWLEDGE_EMPTY",
            "message": "最终知识为空，使用模型关键词降级图谱",
            "details": {"severity": "warning", "degradedGraph": True},
        }
        error = {
            "code": "FINAL_KNOWLEDGE_EMPTY",
            "message": "最终知识和有效关键词均为空",
            "details": {"severity": "error"},
        }

        self.assertFalse(self.service._is_high_severity(warning))
        self.assertTrue(self.service._is_high_severity(error))
        self.assertTrue(self.service._is_high_severity({"code": "FINAL_KNOWLEDGE_EMPTY"}))

    def test_model_knowledge_candidate_adds_offsets_version_and_relation_value(self):
        relation = {
            "chunkId": "resource-1:0",
            "source": "max_connections",
            "target": "并发连接",
            "type": "AFFECTS",
            "evidenceText": "max_connections 影响并发连接",
            "confidence": 0.87,
        }

        candidate = self.service._model_knowledge_candidate(
            "training-test", "relation", relation, self.chunk
        )

        local_start = self.chunk["content"].find(relation["evidenceText"])
        self.assertTrue(candidate["candidateId"].startswith("candidate:"))
        self.assertEqual(candidate["schemaVersion"], "2.0.0")
        self.assertEqual(candidate["evidenceOffsets"], {
            "start": self.chunk["documentOffsets"]["start"] + local_start,
            "end": self.chunk["documentOffsets"]["start"] + local_start + len(relation["evidenceText"]),
        })
        self.assertEqual(candidate["value"], {
            "source": "max_connections",
            "target": "并发连接",
            "type": "AFFECTS",
        })

    def test_metadata_graph_rejects_document_titles_and_scope_words(self):
        self.service.metadata_construction = SimpleNamespace(
            rules={"stopwords": {"yashandb", "dsi"}},
            rule_set_hash="sha256:test-rules",
        )
        titles = [
            "YashanDB DSI_数据字典 (1",
            "YashanDB DSI_数据字典",
            "YashanDB DSI_SEQUENCE",
            "YashanDB DSI(数据字典 && SEQUENCE",
        ]
        data_dictionary = {
            "termId": "database.metadata.data_dictionary",
            "canonicalName": "数据字典",
            "aliases": ["Data Dictionary", "数据字典"],
            "matchedAliases": ["数据字典"],
            "category": "元数据",
            "termType": "database_concept",
        }
        sequence = {
            "termId": "database.object.sequence",
            "canonicalName": "Sequence",
            "aliases": ["SEQUENCE", "序列", "序列号生成器"],
            "matchedAliases": ["SEQUENCE"],
            "category": "数据库对象",
            "termType": "database_object",
        }
        chunks = []
        documents = []
        contexts = []
        for index, title in enumerate(titles):
            resource_id = f"resource-{index}"
            chunk_id = f"{resource_id}:0"
            terms = [data_dictionary] if index < 2 else [sequence]
            chunks.append({
                **self.chunk,
                "id": chunk_id,
                "resourceId": resource_id,
                "sourcePath": f"docs/{title}.docx",
                "content": "数据字典" if index < 2 else "SEQUENCE",
            })
            noisy_keywords = [title, "YashanDB", "DSI", terms[0]["canonicalName"]]
            documents.append({
                "resourceId": resource_id,
                "sourcePath": f"docs/{title}.docx",
                "title": title,
                "keywords": noisy_keywords,
                "domainTerms": terms,
            })
            contexts.append({
                "chunkId": chunk_id,
                "resourceId": resource_id,
                "chunkSummary": chunks[-1]["content"],
                "documentKeywords": noisy_keywords,
                "domainTerms": terms,
            })

        nodes, edges, graph_source = self.service._build_dataset_graph(chunks, [], [], documents, contexts)

        self.assertEqual(graph_source, "metadata_keyword")
        keywords = [item for item in nodes if item["type"] == "Keyword"]
        self.assertEqual({item["canonicalName"] for item in keywords}, {"数据字典", "Sequence"})
        self.assertEqual(len([item for item in keywords if item["canonicalName"] == "数据字典"]), 1)
        self.assertEqual(len([item for item in keywords if item["canonicalName"] == "Sequence"]), 1)
        self.assertEqual(len(edges), 4)
        sequence_node = next(item for item in keywords if item["canonicalName"] == "Sequence")
        self.assertIn("序列", sequence_node["aliases"])

    def test_final_knowledge_nodes_merge_across_resources(self):
        second_chunk = {
            **self.chunk,
            "id": "resource-2:0",
            "resourceId": "resource-2",
            "sourcePath": "docs/config-2.md",
        }

        def final_item(knowledge_id, kind, resource_id, chunk_id, value, evidence):
            return {
                "knowledgeId": knowledge_id,
                "kind": kind,
                "sourceResourceId": resource_id,
                "chunkId": chunk_id,
                "sourcePath": f"docs/{resource_id}.md",
                "value": value,
                "evidenceText": evidence,
                "evidenceOffsets": {"start": 0, "end": len(evidence)},
                "sourceLocations": [],
                "confidence": 0.9,
                "validationState": "passed",
            }

        knowledge = [
            final_item("entity-1", "entity", "resource-1", "resource-1:0", {"name": "max_connections", "type": "Parameter"}, "max_connections"),
            final_item("entity-2", "entity", "resource-2", "resource-2:0", {"name": "MAX_CONNECTIONS", "type": "Parameter"}, "max_connections"),
            final_item("point-1", "knowledge_point", "resource-1", "resource-1:0", {"title": "连接数限制", "statement": "连接数存在上限。"}, "连接数限制"),
            final_item("point-2", "knowledge_point", "resource-2", "resource-2:0", {"title": "连接数限制", "statement": "需要配置连接数上限。"}, "连接数限制"),
            final_item("entity-technical", "entity", "resource-2", "resource-2:0", {"name": "file_28fe54dfcb844e66", "type": "Concept"}, "file_28fe54dfcb844e66"),
        ]

        nodes, edges = self.service._build_graph_from_knowledge([self.chunk, second_chunk], knowledge, [])

        parameters = [item for item in nodes if item["type"] == "Parameter"]
        points = [item for item in nodes if item["type"] == "KnowledgePoint"]
        self.assertEqual(len(parameters), 1)
        self.assertEqual(len(points), 1)
        self.assertEqual(set(parameters[0]["sourceResourceIds"]), {"resource-1", "resource-2"})
        self.assertEqual(set(points[0]["chunkIds"]), {"resource-1:0", "resource-2:0"})
        self.assertFalse(any(item.get("canonicalName") == "file_28fe54dfcb844e66" for item in nodes))
        context_edges = [item for item in edges if item["type"] == "CONTEXT_MATCHES_CHUNK"]
        self.assertEqual(len(context_edges), 4)

    def test_dataset_graph_prefers_final_knowledge_over_metadata_keywords(self):
        candidate = self._candidate(
            "entity-1",
            "entity",
            {"name": "max_connections", "type": "Parameter"},
            "max_connections",
            {"start": 103, "end": 118},
        )
        knowledge, _, _ = self.service._validate_knowledge_candidates([candidate], [self.chunk])

        nodes, edges, graph_source = self.service._build_dataset_graph(
            [self.chunk],
            knowledge,
            [],
            [{"resourceId": "resource-1", "keywords": ["连接池"]}],
            [{"chunkId": "resource-1:0", "chunkSummary": "连接池", "documentKeywords": ["连接池"]}],
        )

        self.assertEqual(graph_source, "final_knowledge")
        self.assertEqual({item["type"] for item in nodes}, {"ProcessingUnit", "Parameter"})
        self.assertEqual({item["type"] for item in edges}, {"CONTEXT_MATCHES_CHUNK"})
        self.assertFalse(any(item.get("sourceMethod") == "metadata_keyword" for item in edges))

    def test_repair_dataset_graph_backfills_metadata_keyword_graph_and_state_summary(self):
        class DatasetPreprocess:
            def __init__(self, dataset):
                self.dataset = dataset

            def get_dataset(self, dataset_id):
                if dataset_id != self.dataset.id:
                    raise KeyError(dataset_id)
                return self.dataset

        with TemporaryDirectory() as directory, patch("app.training_service.settings", SimpleNamespace(data_root=Path(directory))):
            root = Path(directory)
            store = JsonStore(root / "state.json")
            dataset = DatasetVersion(
                id="dataset-repair", batchId="batch-test", preprocessTaskId="prep-test",
                state="candidate", config=PreprocessConfig(), totalDocuments=1, totalChunks=1,
                qualityMetrics={"knowledgeCount": 0}, qualityPassed=True,
                trainingTaskId="training-repair", graphAvailable=True, graphSummary={},
                createdAt=utcnow(),
            )
            store.put_record("datasets", dataset.id, dataset.model_dump(mode="json", by_alias=True))
            store.put_record("tasks", "training-repair", {"id": "training-repair", "graphSummary": {}})
            metadata_construction = MetadataConstructionService(None, None)
            service = TrainingService(
                store, None, None, DatasetPreprocess(dataset), None,
                metadata_construction=metadata_construction,
                gateway=FakeGateway([]),
            )
            run_dir = root / "training-runs" / "training-repair"
            dataset_root = root / "datasets" / dataset.id
            (run_dir / "metadata").mkdir(parents=True)
            (run_dir / "final-results").mkdir(parents=True)
            dataset_root.mkdir(parents=True)
            service._write_jsonl(dataset_root / "processing-units.jsonl", [self.chunk])
            service._write_jsonl(run_dir / "metadata" / "source-documents.jsonl", [{
                "resourceId": "resource-1",
                "sourcePath": "docs/config.md",
                "processingState": "completed",
            }])
            service._write_jsonl(dataset_root / "documents.jsonl", [{
                "resourceId": "resource-1",
                "keywords": ["max_connections"],
                "domainTerms": [],
            }])
            service._write_jsonl(run_dir / "metadata" / "chunk-contexts.jsonl", [{
                "chunkId": "resource-1:0",
                "resourceId": "resource-1",
                "chunkSummary": "参数 max_connections 影响并发连接。",
                "documentKeywords": ["max_connections"],
                "domainTerms": [],
            }])
            service._write_json(dataset_root / "quality-issues.json", [])
            service._write_json(run_dir / "run-report.json", {"graph": {"nodeCount": 0}})
            service._write_json(dataset_root / "run-report.json", {"graph": {"nodeCount": 0}})
            service._write_json(dataset_root / "manifest.json", {"nodeCount": 0, "edgeCount": 0})

            summary = service.repair_dataset_graph(dataset.id)

            self.assertEqual(summary["graphSource"], "metadata_keyword")
            self.assertEqual(summary["graphSchemaVersion"], GRAPH_SCHEMA_VERSION)
            self.assertGreater(summary["contextEdgeCount"], 0)
            nodes = json.loads((run_dir / "graph" / "nodes.json").read_text(encoding="utf-8"))
            self.assertTrue(nodes)
            keyword_node = next(item for item in nodes if item["type"] == "Keyword")
            payload = service.graph_neighborhood(dataset.id, "MAX_CONNECTIONS", limit=5)
            self.assertEqual(payload["focusNode"]["id"], keyword_node["id"])
            self.assertTrue(any(item["id"] == keyword_node["id"] for item in payload["nodes"]))
            self.assertTrue(json.loads((dataset_root / "graph" / "edges.json").read_text(encoding="utf-8")))
            state_dataset = store.get_record("datasets", dataset.id)
            self.assertEqual(state_dataset["graphSummary"]["graphSource"], "metadata_keyword")
            manifest = json.loads((dataset_root / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["graphSource"], "metadata_keyword")
            self.assertEqual(manifest["graphSchemaVersion"], GRAPH_SCHEMA_VERSION)
            self.assertEqual(manifest["metadataRuleSetHash"], metadata_construction.rule_set_hash)
            rebuilt_documents = service._read_jsonl(dataset_root / "documents.jsonl")
            self.assertEqual(rebuilt_documents[0]["title"], "config")
            self.assertNotIn("config", rebuilt_documents[0]["keywords"])
            rebuilt_contexts = service._read_jsonl(run_dir / "metadata" / "chunk-contexts.jsonl")
            self.assertEqual(rebuilt_contexts[0]["ruleSetHash"], metadata_construction.rule_set_hash)

    def test_graph_reader_backfills_metadata_keyword_graph_when_summary_missing(self):
        class DatasetPreprocess:
            def __init__(self, dataset):
                self.dataset = dataset

            def get_dataset(self, dataset_id):
                if dataset_id != self.dataset.id:
                    raise KeyError(dataset_id)
                return self.dataset

        with TemporaryDirectory() as directory, patch("app.training_service.settings", SimpleNamespace(data_root=Path(directory))):
            root = Path(directory)
            store = JsonStore(root / "state.json")
            dataset = DatasetVersion(
                id="dataset-graph-read", batchId="batch-test", preprocessTaskId="prep-test",
                state="candidate", config=PreprocessConfig(), totalDocuments=1, totalChunks=1,
                qualityMetrics={"knowledgeCount": 0}, qualityPassed=False,
                trainingTaskId="training-graph-read", graphAvailable=True, graphSummary={},
                createdAt=utcnow(),
            )
            store.put_record("datasets", dataset.id, dataset.model_dump(mode="json", by_alias=True))
            store.put_record("tasks", "training-graph-read", {"id": "training-graph-read", "graphSummary": {}})
            service = TrainingService(store, None, None, DatasetPreprocess(dataset), None, gateway=FakeGateway([]))
            run_dir = root / "training-runs" / "training-graph-read"
            dataset_root = root / "datasets" / dataset.id
            (run_dir / "metadata").mkdir(parents=True)
            (run_dir / "final-results").mkdir(parents=True)
            dataset_root.mkdir(parents=True)
            service._write_jsonl(dataset_root / "processing-units.jsonl", [self.chunk])
            service._write_jsonl(dataset_root / "documents.jsonl", [{
                "resourceId": "resource-1",
                "keywords": ["max_connections"],
                "domainTerms": [],
            }])
            service._write_jsonl(run_dir / "metadata" / "chunk-contexts.jsonl", [{
                "chunkId": "resource-1:0",
                "resourceId": "resource-1",
                "chunkSummary": "参数 max_connections 影响并发连接。",
                "documentKeywords": ["max_connections"],
                "domainTerms": [],
            }])
            service._write_json(dataset_root / "quality-issues.json", [])
            service._write_json(run_dir / "run-report.json", {"graph": {"nodeCount": 0}})
            service._write_json(dataset_root / "run-report.json", {"graph": {"nodeCount": 0}})
            service._write_json(dataset_root / "manifest.json", {"nodeCount": 0, "edgeCount": 0})

            summary = service.graph(dataset.id, "summary")

            self.assertEqual(summary["graphSource"], "metadata_keyword")
            self.assertEqual(summary["graphSchemaVersion"], GRAPH_SCHEMA_VERSION)
            self.assertGreater(summary["contextEdgeCount"], 0)
            self.assertTrue(json.loads((run_dir / "graph" / "nodes.json").read_text(encoding="utf-8")))
            state_dataset = store.get_record("datasets", dataset.id)
            self.assertEqual(state_dataset["graphSummary"]["graphSource"], "metadata_keyword")

    def test_graph_backfill_uses_schema_version_and_skips_deleted_datasets(self):
        current = SimpleNamespace(
            state="candidate",
            training_task_id="training-current",
            graph_summary={"graphSource": "metadata_keyword", "graphSchemaVersion": GRAPH_SCHEMA_VERSION},
            quality_metrics={"knowledgeCount": 0},
        )
        legacy = SimpleNamespace(
            state="candidate",
            training_task_id="training-legacy",
            graph_summary={"graphSource": "metadata_keyword"},
            quality_metrics={"knowledgeCount": 0},
        )
        deleted = SimpleNamespace(
            state="deleted",
            training_task_id="training-deleted",
            graph_summary={},
            quality_metrics={"knowledgeCount": 0},
        )

        self.assertFalse(self.service._needs_graph_backfill(current))
        self.assertTrue(self.service._needs_graph_backfill(legacy))
        self.assertFalse(self.service._needs_graph_backfill(deleted))

    def test_graph_backfill_rebuilds_when_metadata_rule_hash_changes(self):
        self.service.metadata_construction = SimpleNamespace(rule_set_hash="sha256:current")
        matching = SimpleNamespace(
            state="candidate",
            training_task_id="training-current",
            graph_summary={
                "graphSource": "metadata_keyword",
                "graphSchemaVersion": GRAPH_SCHEMA_VERSION,
                "metadataRuleSetHash": "sha256:current",
            },
            quality_metrics={"knowledgeCount": 0},
        )
        stale = SimpleNamespace(
            state="candidate",
            training_task_id="training-stale",
            graph_summary={
                "graphSource": "metadata_keyword",
                "graphSchemaVersion": GRAPH_SCHEMA_VERSION,
                "metadataRuleSetHash": "sha256:old",
            },
            quality_metrics={"knowledgeCount": 0},
        )

        self.assertFalse(self.service._needs_graph_backfill(matching))
        self.assertTrue(self.service._needs_graph_backfill(stale))

    def test_published_dataset_deletion_retains_originals_and_is_idempotent(self):
        class DatasetBatches:
            def __init__(self):
                self.batch = SimpleNamespace(latest_dataset_version_id="dataset-delete")
                self.updates = []

            def get(self, batch_id):
                return self.batch

            def update(self, batch_id, **changes):
                self.updates.append((batch_id, changes))
                if "latestDatasetVersionId" in changes:
                    self.batch.latest_dataset_version_id = changes["latestDatasetVersionId"]

        with TemporaryDirectory() as directory, patch("app.services.settings", SimpleNamespace(data_root=Path(directory))):
            root = Path(directory)
            store = JsonStore(root / "state.json")
            batches = DatasetBatches()
            service = PreprocessService(store, batches, SimpleNamespace(), SimpleNamespace())
            dataset = DatasetVersion(
                id="dataset-delete", batchId="batch-delete", preprocessTaskId="prep-delete",
                state="published", config=PreprocessConfig(), totalDocuments=1, totalChunks=1,
                qualityMetrics={}, qualityPassed=True, graphAvailable=True,
                datasetPath="datasets/dataset-delete", createdAt=utcnow(),
            )
            store.put_record("datasets", dataset.id, dataset.model_dump(mode="json", by_alias=True))
            dataset_root = root / "datasets/dataset-delete"
            (dataset_root / "originals").mkdir(parents=True)
            (dataset_root / "originals/source.md").write_text("永久原始资料", encoding="utf-8")
            (dataset_root / "mappings").mkdir()
            (dataset_root / "mappings/source.json").write_text("{}", encoding="utf-8")
            (dataset_root / "graph").mkdir()
            (dataset_root / "graph/nodes.json").write_text("[]", encoding="utf-8")
            (dataset_root / "knowledge.jsonl").write_text("{}\n", encoding="utf-8")
            (dataset_root / "manifest.json").write_text(json.dumps({"state": "published"}), encoding="utf-8")

            first = service.delete_dataset(dataset.id, "tester", "质量过低")
            second = service.delete_dataset(dataset.id, "tester", "重复请求")

            self.assertEqual(first.state, "deleted")
            self.assertEqual(second.state, "deleted")
            self.assertTrue((dataset_root / "originals/source.md").is_file())
            self.assertTrue((dataset_root / "mappings/source.json").is_file())
            self.assertFalse((dataset_root / "knowledge.jsonl").exists())
            self.assertFalse((dataset_root / "graph").exists())
            self.assertEqual(len((dataset_root / "deletion-audit.jsonl").read_text(encoding="utf-8").splitlines()), 1)
            self.assertIsNone(batches.batch.latest_dataset_version_id)

    def test_blocked_dataset_requires_force_to_publish(self):
        with TemporaryDirectory() as directory, patch("app.services.settings", SimpleNamespace(data_root=Path(directory))):
            store = JsonStore(Path(directory) / "state.json")
            class DatasetBatches:
                def __init__(self):
                    self.batch = SimpleNamespace(latest_dataset_version_id=None)
                    self.updates = []

                def get(self, batch_id):
                    return self.batch

                def update(self, batch_id, **changes):
                    self.updates.append((batch_id, changes))
                    for key, value in changes.items():
                        snake = "latest_dataset_version_id" if key == "latestDatasetVersionId" else key
                        setattr(self.batch, snake, value)

            batches = DatasetBatches()
            service = PreprocessService(store, batches, SimpleNamespace(), SimpleNamespace())
            dataset = DatasetVersion(
                id="dataset-blocked", batchId="batch-blocked", preprocessTaskId="prep-blocked",
                state="candidate", config=PreprocessConfig(), totalDocuments=1, totalChunks=1,
                qualityMetrics={}, qualityPassed=False, qualityState="blocked", publishable=False,
                createdAt=utcnow(),
            )
            store.put_record("datasets", dataset.id, dataset.model_dump(mode="json", by_alias=True))
            with self.assertRaisesRegex(ValueError, "禁止发布"):
                service.publish(dataset.id)
            published = service.publish(dataset.id, force=True)
            self.assertEqual(published.state, "published")
            self.assertEqual(batches.batch.latest_dataset_version_id, "dataset-blocked")

    def test_dataset_generation_reloads_only_persisted_final_knowledge(self):
        now = utcnow()
        task = TaskSnapshot(
            id="training-dataset", batchId="batch-dataset", type="graph", state="running",
            stage="dataset_generation", total=len(STAGES),
            stages=[{"id": stage, "state": "pending"} for stage in STAGES],
            createdAt=now, updatedAt=now,
        )
        tasks = FakeTasks(task)
        store = FakeStore()
        batches = FakeBatches()
        service = TrainingService(store, batches, tasks, None, None, gateway=None)
        dataset = DatasetVersion(
            id="dataset-final-input", batchId="batch-dataset", preprocessTaskId="prep-dataset",
            state="candidate", config=PreprocessConfig(), totalDocuments=1, totalChunks=1,
            qualityMetrics={}, qualityPassed=True, createdAt=now,
        )
        store.put_record("datasets", dataset.id, dataset.model_dump(mode="json", by_alias=True))
        persisted = {
            "knowledgeId": "knowledge:persisted",
            "kind": "entity",
            "sourceResourceId": "resource-1",
            "chunkId": "resource-1:0",
            "sourcePath": "docs/config.md",
            "value": {"name": "max_connections", "type": "Parameter"},
            "evidenceText": "max_connections",
            "evidenceOffsets": {"start": 3, "end": 18},
            "sourceLocations": [],
            "confidence": 0.9,
            "sourceMethod": "knowledge_extraction_workflow_agent",
            "schemaVersion": "2.0.0",
            "validationState": "passed",
        }
        with TemporaryDirectory() as directory, patch("app.training_service.settings", SimpleNamespace(data_root=Path(directory))):
            run_dir = Path(directory) / "training-runs/training-dataset"
            service._write_jsonl(run_dir / "final-results/knowledge.jsonl", [persisted])
            service._write_jsonl(run_dir / "metadata/source-documents.jsonl", [{"resourceId": "resource-1"}])
            service._write_jsonl(run_dir / "metadata/documents.jsonl", [{"resourceId": "resource-1", "title": "配置"}])
            service._write_jsonl(run_dir / "metadata/chunks.jsonl", [{"chunkId": "resource-1:0", "resourceId": "resource-1", "content": self.chunk["content"]}])

            service._generate_dataset(
                task.id,
                TrainingTaskCreate(batchId="batch-dataset"),
                dataset,
                [{"knowledgeId": "knowledge:memory-only"}],
                [self.chunk],
                run_dir,
                {"succeeded": 0, "failed": 0, "skipped": 0},
                [],
            )
            generated = service._read_jsonl(Path(directory) / "datasets/dataset-final-input/knowledge.jsonl")
            manifest = json.loads((Path(directory) / "datasets/dataset-final-input/manifest.json").read_text(encoding="utf-8"))
            report = json.loads((Path(directory) / "datasets/dataset-final-input/run-report.json").read_text(encoding="utf-8"))

        self.assertEqual([item["knowledgeId"] for item in generated], ["knowledge:persisted"])
        self.assertEqual(manifest["knowledgeCount"], 1)
        self.assertEqual(manifest["state"], "candidate")
        self.assertTrue(manifest["publishable"])
        for artifact in (manifest, report):
            self.assertEqual(artifact["config"]["maxUnitCharacters"], 6000)
            self.assertEqual(artifact["config"]["fallbackOverlapCharacters"], 0)
            self.assertNotIn("chunkSize", artifact["config"])
            self.assertNotIn("chunkOverlap", artifact["config"])


class DeterministicPipelineTests(unittest.TestCase):
    def setUp(self):
        self.service = TrainingService(None, None, None, None, None, gateway=None)

    def test_public_pipeline_has_three_stable_stages(self):
        self.assertEqual(STAGES, [
            "material_preparation",
            "knowledge_extraction",
            "index_generation",
        ])

    def test_training_requires_completed_material_download(self):
        batch = SimpleNamespace(id="batch-downloading", state="downloading", active_task_ids=["task-download"])
        service = TrainingService(None, FakeBatches(batch), None, None, None, gateway=None)
        with self.assertRaisesRegex(ValueError, "资料下载尚未完成"):
            service._require_batch_ready("batch-downloading")

    def test_training_rejects_interrupted_download_task(self):
        now = utcnow()
        batch = SimpleNamespace(id="batch-interrupted", state="downloaded", active_task_ids=[])
        download_task = TaskSnapshot(
            id="task-download",
            batchId="batch-interrupted",
            type="download",
            state="interrupted",
            stage="interrupted",
            createdAt=now,
            updatedAt=now,
        )
        service = TrainingService(None, FakeBatches(batch), FakeTasks(download_task), None, None, gateway=None)
        with self.assertRaisesRegex(ValueError, "资料下载尚未完成"):
            service._require_batch_ready("batch-interrupted")

    def test_rules_extract_explicit_yashandb_knowledge_without_model(self):
        chunk = {
            "id": "resource-1:0",
            "resourceId": "resource-1",
            "sourcePath": "docs/error.md",
            "content": "YAS-00001 表示参数 p_size 无效。适用于 23.2.1。",
        }
        result, uncertain = self.service._rule_extract_chunk(chunk, {"resourceId": "resource-1"})
        names = {item["name"] for item in result["entities"]}
        self.assertIn("YAS-00001", names)
        self.assertIn("p_size", names)
        self.assertIn("23.2.1", names)
        self.assertEqual(uncertain, [])

    def test_ambiguous_reference_becomes_needs_model_item(self):
        chunk = {
            "id": "resource-1:0",
            "resourceId": "resource-1",
            "sourcePath": "docs/config.md",
            "content": "配置项 max_connections 控制连接数。该参数需要配合线程池设置。",
        }
        _, uncertain = self.service._rule_extract_chunk(chunk, {"resourceId": "resource-1"})
        self.assertTrue(uncertain)
        self.assertTrue(all(item["state"] == "needs_model" for item in uncertain))
        self.assertIn("ambiguous_reference", {item["type"] for item in uncertain})

    def test_context_envelope_uses_metadata_and_evidence_not_full_document(self):
        chunks = [
            {"id": "r:0", "resourceId": "r", "sourcePath": "docs/a.md", "chunkIndex": 0, "content": "前一块内容。"},
            {"id": "r:1", "resourceId": "r", "sourcePath": "docs/a.md", "chunkIndex": 1, "content": "该参数影响连接。"},
        ]
        item = self.service._uncertain_item(chunks[1], "ambiguous_reference", "指代不明", "该参数", {})
        envelope = self.service._context_envelope(item, chunks[1], chunks, {
            "resourceId": "r", "sourcePath": "docs/a.md", "title": "a.md",
            "summary": "文档摘要", "category": "配置", "keywords": ["连接"],
        })
        serialized = json.dumps(envelope, ensure_ascii=False)
        self.assertIn("文档摘要", serialized)
        self.assertIn("该参数", serialized)
        self.assertNotIn("前一块内容。", serialized)

    def test_model_result_without_source_evidence_is_rejected(self):
        issues = []
        result = self.service._validated_model_resolution({
            "status": "resolved",
            "knowledgePoints": [],
            "entities": [{"name": "线程池", "type": "Component", "evidenceText": "原文不存在", "confidence": 0.9}],
            "relations": [],
        }, {"id": "r:0", "resourceId": "r", "sourcePath": "docs/a.md", "content": "连接参数说明。"}, issues)
        self.assertEqual(result["entities"], [])
        self.assertEqual(issues[0]["code"], "MODEL_EVIDENCE_INVALID")

    def test_document_profile_selection_is_deterministic(self):
        profile = self.service._document_profile(
            {"title": "优化器问题分析", "sourcePath": "docs/optimizer.md"},
            ["本文给出故障处理与根因分析。"],
        )
        self.assertEqual(profile["documentType"], "problem_analysis")
        self.assertEqual(profile["extractionProfile"], "problem-analysis")

    def test_extraction_validation_rejects_missing_evidence_and_invalid_relation_endpoint(self):
        chunk = {"id": "r:0", "resourceId": "r", "sourcePath": "docs/a.md", "content": "参数 p_size 影响执行计划。"}
        validated, issues = self.service._validated_extraction({
            "knowledgePoints": [],
            "entities": [
                {"name": "p_size", "type": "Parameter", "evidenceText": "p_size", "assertionStatus": "implemented"},
                {"name": "不存在", "type": "Module", "evidenceText": "原文不存在", "assertionStatus": "implemented"},
            ],
            "relations": [{"source": "p_size", "target": "执行计划", "type": "AFFECTS", "evidenceText": "参数 p_size 影响执行计划。", "assertionStatus": "implemented"}],
        }, chunk)
        self.assertEqual([item["name"] for item in validated["entities"]], ["p_size"])
        self.assertEqual(validated["relations"], [])
        self.assertEqual({item["code"] for item in issues}, {"EXTRACTION_EVIDENCE_INVALID", "EXTRACTION_RELATION_INVALID"})

    def test_only_supported_needs_enrichment_is_routed_to_stage_four(self):
        chunk = {"id": "r:0", "resourceId": "r", "sourcePath": "docs/a.md"}
        envelope = {"chunk": "hash-input"}
        routed = self.service._agent_uncertain_item(chunk, {
            "type": "ambiguous_reference", "reason": "该参数指代不明", "evidenceText": "该参数", "state": "needs_enrichment", "candidateValues": ["p_size"]
        }, envelope)
        rejected = self.service._agent_uncertain_item(chunk, {
            "type": "missing_evidence", "reason": "缺少证据", "evidenceText": "", "state": "needs_enrichment"
        }, envelope)
        self.assertEqual(routed["state"], "needs_enrichment")
        self.assertEqual(rejected["state"], "human_required")


# SemanticEnrichmentPipelineTests 已移除（semantic_enrichment 步骤已移除）

# KnowledgeExtractionPipelineTests 已移除（旧架构测试不再适用）

# FormalPreparationOutputTests 已移除（旧架构测试不再适用）

class TrainingErrorSummaryTests(unittest.TestCase):
    def test_model_errors_are_summarized_in_chinese(self):
        cases = [
            ("HTTP 403: Country, region, or territory not supported", "模型服务拒绝访问（HTTP 403，当前网络所在国家或地区不受支持）"),
            ("connect ECONNREFUSED 127.0.0.1:4100", "模型服务连接失败"),
            ("request timed out", "模型调用超时"),
            ("JSONDecodeError: Expecting value", "模型返回格式不正确"),
            ("模型网关 HTTP 502: upstream unavailable", "模型服务暂时不可用（HTTP 502）"),
            ("模型网关 HTTP 502: LLM request timed out", "模型调用超时"),
            ("模型网关 HTTP 502: LLM 返回内容无法解析为 JSON", "模型返回格式不正确"),
        ]
        for technical_error, expected in cases:
            with self.subTest(technical_error=technical_error):
                self.assertEqual(error_summary(RuntimeError(technical_error)), expected)

    def test_python_gateway_timeout_exceeds_step_retry_budget(self):
        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return None

            def read(self):
                return b'{"data": {}}'

        with patch("app.training_service.urlopen", return_value=FakeResponse()) as mocked:
            ModelGatewayClient("http://127.0.0.1:4100", timeout=180).chat_json(
                [{"role": "user", "content": "测试"}],
                {"timeout_ms": 60000, "max_retries": 2},
            )
        self.assertEqual(mocked.call_args.kwargs["timeout"], 190)


class TrainingCancellationTests(unittest.TestCase):
    def setUp(self):
        now = utcnow()
        self.task = TaskSnapshot(
            id="training_cancel_test",
            batch_id="batch_test",
            type="graph",
            state="running",
            stage="knowledge_extraction",
            total=11,
            can_cancel=True,
            created_at=now,
            updated_at=now,
        )
        self.tasks = FakeTasks(self.task)
        self.preprocess = FakePreprocess()
        self.service = TrainingService(
            None,
            FakeBatches(),
            self.tasks,
            self.preprocess,
            None,
            gateway=None,
        )

    def test_cancel_marks_task_cancelling_and_cancels_child_task(self):
        self.service._child_tasks[self.task.id] = "preprocess_child"
        with TemporaryDirectory() as directory, patch(
            "app.training_service.settings",
            SimpleNamespace(data_root=Path(directory)),
        ):
            result = self.service.cancel(self.task.id)
        self.assertEqual(result.state, "cancelling")
        self.assertFalse(result.can_cancel)
        self.assertEqual(self.preprocess.cancelled, ["preprocess_child"])
        self.assertTrue(any(item[1] == "training.log" for item in self.tasks.events.items))

    def test_cancel_is_idempotent_while_cancelling(self):
        self.tasks._update(self.task.id, state="cancelling", can_cancel=False)
        result = self.service.cancel(self.task.id)
        self.assertEqual(result.state, "cancelling")
        self.assertEqual(self.preprocess.cancelled, [])

    def test_terminal_task_cannot_be_cancelled(self):
        self.tasks._update(self.task.id, state="completed", can_cancel=False)
        with self.assertRaisesRegex(ValueError, "已经结束"):
            self.service.cancel(self.task.id)

    def test_checkpoint_raises_dedicated_cancellation_error(self):
        self.tasks._update(self.task.id, state="cancelling", can_cancel=False)
        with self.assertRaises(TrainingCancelledError):
            self.service._raise_if_cancelled(self.task.id)


# TrainingSkillInvocationTests 已移除（旧 skill 架构测试不再适用）

class TrainingObservabilityTests(unittest.TestCase):
    def setUp(self):
        now = utcnow()
        self.task = TaskSnapshot(
            id="training_test",
            batch_id="batch_test",
            type="graph",
            state="running",
            stage="knowledge_extraction",
            total=11,
            created_at=now,
            updated_at=now,
        )
        self.tasks = FakeTasks(self.task)
        self.service = TrainingService(None, None, self.tasks, None, None, gateway=None)

    def test_structured_log_is_persisted_and_published(self):
        with TemporaryDirectory() as directory, patch(
            "app.training_service.settings",
            SimpleNamespace(data_root=Path(directory)),
        ):
            item = self.service._log(
                self.task.id,
                "error",
                "knowledge_extraction",
                "model_call.failed",
                "调用失败",
                current=2,
                total=4,
                details={"resourceId": "resource-1"},
            )
            payload = self.service.logs(self.task.id)
        self.assertEqual(item["sequence"], 1)
        self.assertTrue(item["eventId"].startswith("event_"))
        self.assertEqual(item["taskId"], self.task.id)
        self.assertTrue(item["stageRunId"])
        self.assertEqual(item["resourceId"], "resource-1")
        self.assertEqual(payload["items"][0]["message"], "调用失败")
        self.assertEqual(payload["logPath"], "training-runs/training_test/events.jsonl")
        self.assertEqual(self.tasks.events.items[0][1], "training.log")

    def test_review_decision_is_persisted_with_audit_fields(self):
        with TemporaryDirectory() as directory, patch(
            "app.training_service.settings",
            SimpleNamespace(data_root=Path(directory)),
        ):
            item = self.service._review_item(
                self.task.id,
                "knowledge_extraction",
                "LOW_CONFIDENCE_EXTRACTION",
                "置信度不足",
                chunk_id="chunk-1",
                confidence=0.52,
            )
            self.service._write_review_items(self.task.id, [item])
            result = self.service.decide_review_item(
                self.task.id,
                item["id"],
                TrainingReviewDecision(decision="rejected", note="证据不足", operator_label="tester"),
            )
            persisted = self.service.review_items(self.task.id)[0]
        self.assertEqual(result["state"], "rejected")
        self.assertEqual(persisted["note"], "证据不足")
        self.assertEqual(persisted["operatorLabel"], "tester")
        self.assertTrue(persisted["decidedAt"])


if __name__ == "__main__":
    unittest.main()
