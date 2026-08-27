from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class GraphRulesConfigError(RuntimeError):
    pass


class GraphQualityCheckService:
    """按发布时规则快照计算健康指标和非阻断检查项。"""

    _EVIDENCE_NODE_TYPES = {"ProcessingUnit", "Chunk", "Evidence"}

    def __init__(self, config_path: Path):
        self.config_path = Path(config_path)

    def rules(self) -> dict[str, Any]:
        try:
            value = json.loads(self.config_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise GraphRulesConfigError("图谱治理规则配置不可读") from exc
        if (
            not isinstance(value, dict)
            or not isinstance(value.get("rulesVersion"), str)
            or any(not isinstance(value.get(key), dict) for key in ("renderLimits", "healthThresholds", "versionGovernance"))
        ):
            raise GraphRulesConfigError("图谱治理规则配置结构不完整")
        return value

    def evaluate(
        self,
        nodes: list[dict[str, Any]],
        edges: list[dict[str, Any]],
        summary: dict[str, Any],
        previous_manifest: dict[str, Any] | None,
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        rules = self.rules()
        thresholds = rules["healthThresholds"]
        version_rules = rules["versionGovernance"]
        node_ids = [str(item.get("id") or "") for item in nodes]
        known = {value for value in node_ids if value}
        edge_ids = [str(item.get("id") or "") for item in edges]
        node_id_issues = sum(1 for value in node_ids if not value) + len([value for value in node_ids if value]) - len(known)
        known_edges = {value for value in edge_ids if value}
        edge_id_issues = sum(1 for value in edge_ids if not value) + len([value for value in edge_ids if value]) - len(known_edges)
        dangling = [item for item in edges if str(item.get("source") or "") not in known or str(item.get("target") or "") not in known]

        knowledge = [item for item in nodes if str(item.get("type") or "") not in self._EVIDENCE_NODE_TYPES]
        connected = {str(value) for item in edges for value in (item.get("source"), item.get("target")) if value}
        connected_knowledge = sum(1 for item in knowledge if str(item.get("id") or "") in connected)
        evidence_edges = [item for item in edges if item.get("type") == "CONTEXT_MATCHES_CHUNK"]
        complete_evidence = [item for item in evidence_edges if item.get("sourceResourceId") and item.get("chunkId") and item.get("evidenceText")]
        why_count = sum(1 for item in knowledge if item.get("knowledgeDomain") == "why")
        knowledge_count = len(knowledge)

        health = {
            "relationCoverage": self._ratio_metric(connected_knowledge, knowledge_count),
            "evidenceCompleteness": self._ratio_metric(len(complete_evidence), len(evidence_edges)),
            "isolatedKnowledgeRatio": self._ratio_metric(knowledge_count - connected_knowledge, knowledge_count),
            "whyMissingRate": self._ratio_metric(knowledge_count - why_count, knowledge_count),
            "crossDocumentRelationCount": {
                "value": int(summary.get("crossDocumentRelationCount") or 0),
                "numerator": int(summary.get("crossDocumentRelationCount") or 0),
                "denominator": None,
                "availability": "available",
            },
        }
        items: list[dict[str, Any]] = []
        self._append_count_check(items, "NODE_ID_UNIQUE", "节点 ID 唯一", node_id_issues, "发现重复或缺失的节点 ID")
        self._append_count_check(items, "EDGE_ID_UNIQUE", "关系 ID 唯一", edge_id_issues, "发现重复或缺失的关系 ID")
        self._append_count_check(items, "EDGE_ENDPOINT_COMPLETE", "关系端点完整", len(dangling), "发现关系引用不存在的节点")
        items.append(self._item("ARTIFACT_HASH_READABLE", "图谱产物可读", "passed", "发布源图谱 JSON 已成功读取，提交后将再次校验哈希"))

        filter_state = summary.get("keywordFilterState") if isinstance(summary.get("keywordFilterState"), dict) else None
        if filter_state:
            before = int(filter_state.get("beforeTotal") or 0)
            retained = int(filter_state.get("retained") or 0)
            excluded = int(filter_state.get("excluded") or 0)
            after = int(filter_state.get("afterTotal") or 0)
            inconsistent = before != retained + excluded or after != retained
            items.append(self._item("KEYWORD_FILTER_STATS_CONSISTENT", "关键词过滤统计一致", "warning" if inconsistent else "passed", "过滤前、保留、排除和过滤后统计不一致" if inconsistent else "关键词过滤统计一致"))
        else:
            items.append(self._item("KEYWORD_FILTER_STATS_CONSISTENT", "关键词过滤统计一致", "not_applicable", "该正式图谱未提供关键词过滤统计"))

        self._append_threshold_check(items, "RELATION_COVERAGE", "关系覆盖率", health["relationCoverage"], "below", float(thresholds["relationCoverageWarningBelow"]))
        self._append_threshold_check(items, "EVIDENCE_COMPLETENESS", "证据完整率", health["evidenceCompleteness"], "below", float(thresholds["evidenceCompletenessWarningBelow"]))
        self._append_threshold_check(items, "ISOLATED_KNOWLEDGE_RATIO", "孤立知识比例", health["isolatedKnowledgeRatio"], "above", float(thresholds["isolatedKnowledgeWarningAbove"]))
        self._append_threshold_check(items, "WHY_MISSING_RATE", "Why 知识缺失率", health["whyMissingRate"], "above", float(thresholds["whyMissingWarningAbove"]))
        self._append_change_checks(items, len(nodes), len(edges), previous_manifest, version_rules)

        warning_count = sum(1 for item in items if item["status"] == "warning")
        checks = {
            "status": "warning" if warning_count else "passed",
            "warningCount": warning_count,
            "errorCount": 0,
            "items": items,
        }
        return checks, health, rules

    @staticmethod
    def _ratio_metric(numerator: int, denominator: int) -> dict[str, Any]:
        return {
            "value": round(numerator / denominator, 4) if denominator else None,
            "numerator": numerator,
            "denominator": denominator,
            "availability": "available" if denominator else "not_applicable",
        }

    @staticmethod
    def _item(code: str, label: str, status: str, message: str, **details: Any) -> dict[str, Any]:
        return {"code": code, "label": label, "status": status, "severity": "warning" if status == "warning" else "info", "message": message, **details}

    def _append_count_check(self, items: list[dict[str, Any]], code: str, label: str, count: int, warning_message: str) -> None:
        items.append(self._item(code, label, "warning" if count else "passed", warning_message if count else f"{label}检查通过", actual=count))

    def _append_threshold_check(self, items: list[dict[str, Any]], code: str, label: str, metric: dict[str, Any], direction: str, threshold: float) -> None:
        if metric["availability"] != "available":
            items.append(self._item(code, label, "not_applicable", f"{label}缺少可计算分母", metric=metric, threshold=threshold))
            return
        value = float(metric["value"])
        warning = value < threshold if direction == "below" else value > threshold
        message = f"{label}为 {value:.2%}，{'低于' if direction == 'below' else '高于'}告警阈值 {threshold:.2%}" if warning else f"{label}在规则阈值内"
        items.append(self._item(code, label, "warning" if warning else "passed", message, metric=metric, threshold=threshold))

    def _append_change_checks(self, items: list[dict[str, Any]], node_count: int, edge_count: int, previous: dict[str, Any] | None, rules: dict[str, Any]) -> None:
        if not previous:
            items.append(self._item("VERSION_CHANGE_RATIO", "版本变化幅度", "not_applicable", "首个正式版本无上一版本可比较"))
            return
        artifacts = previous.get("artifacts") if isinstance(previous.get("artifacts"), dict) else {}
        previous_nodes = int((artifacts.get("nodes") or {}).get("count") or 0)
        previous_edges = int((artifacts.get("edges") or {}).get("count") or 0)
        node_ratio = abs(node_count - previous_nodes) / max(previous_nodes, 1)
        edge_ratio = abs(edge_count - previous_edges) / max(previous_edges, 1)
        warning = node_ratio > float(rules["nodeChangeWarningRatioAbove"]) or edge_ratio > float(rules["edgeChangeWarningRatioAbove"])
        items.append(self._item("VERSION_CHANGE_RATIO", "版本变化幅度", "warning" if warning else "passed", "节点或关系数量变化幅度超过发布告警阈值" if warning else "节点和关系数量变化幅度在规则阈值内", nodeChangeRatio=round(node_ratio, 4), edgeChangeRatio=round(edge_ratio, 4), nodeThreshold=float(rules["nodeChangeWarningRatioAbove"]), edgeThreshold=float(rules["edgeChangeWarningRatioAbove"])))
