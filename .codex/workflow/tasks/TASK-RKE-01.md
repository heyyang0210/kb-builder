# TASK-RKE-01: 将主页知识提取切换为纯规则提取

## 元信息
- 状态: pending
- 分配: backend-worker / test-engineer / doc-writer
- 创建: 2026-08-06
- 预计完成: 2026-08-06
- 预计工时: 4 小时
- 依赖: 人类确认“主页知识提取”切换为纯规则提取的架构与产物契约
- 需人类确认: 是（改变 `formal_knowledge` 的既有模型调用架构和已发布设计契约）
- 可并行: 否（设计契约确认后，文档与接口伪代码先行；测试设计可与后端实现并行）

## SMART 目标

在人类确认后的 4 小时内，使主页“加工任务”的“知识提取”阶段只运行确定性规则，任何模型网关处于 HTTP 502、未配置或不可达状态时均不触发模型检查或模型请求，并以可追溯的规则知识点候选完成该阶段。

## 根因与范围

- `TrainingService._extract_deterministic()` 当前虽使用“确定性提取”阶段名，但会先检查 `self.gateway.status()`，随后执行 `self.extraction_agent.execute()`；Workflow Agent 会调用 `knowledge-point-extraction` Skill 的模型网关。
- 因此前端将网关上游 HTTP 502 归类展示为“模型服务暂时不可用”，阻断了用户期望的规则提取阶段。
- 当前 `docs/12-PingCode知识提取步骤详细设计.md` 和 `app/agents/README.md` 均把 `formal_knowledge` 定义为模型/Agent 提取；本任务必须先更新这一冲突的设计和接口伪代码，不能仅删除一次模型调用。
- 本任务仅覆盖主页训练流水线映射到 `deterministic_extraction` 的知识提取阶段；不改变关键词智能过滤、独立语义补充及其模型调用边界。

## 待确认决策

建议采用以下最小兼容方案，待人类确认后实施：

1. `formal_knowledge` 的该阶段输出仍为 `knowledge_point` 候选，沿用 `knowledge-candidates.jsonl`、关键词上下文、逐字证据和进度契约；候选标记为规则来源，不再产生 `modelCallId`。
2. 规则从已完成的处理单元、标题路径、明确锚点、领域词典命中和可回查原文句段生成候选；证据不足时写中文质量问题，不调用模型补救。
3. `model-results/knowledge-extraction-batches.jsonl` 保留为空审计产物以兼容读取方，模型调用统计固定为零；不删除公共 API 或历史产物读取兼容。
4. 页面文案将“知识提取”描述为规则抽取、证据校验和候选落盘，避免将本阶段显示为模型调用或实体/关系合并。

## 接口与伪代码

```python
def extract_rule_knowledge(task_id, chunks, documents, run_dir, keyword_context_by_chunk):
    set_stage(task_id, "deterministic_extraction", current=0, total=len(chunks))
    candidates, issues = [], []
    for chunk in chunks:
        raise_if_cancelled(task_id)
        for fact in rule_extract(chunk, document_for(chunk), keyword_context_by_chunk[chunk.id]):
            if evidence_is_verbatim(fact, chunk.content):
                candidates.append(to_rule_candidate(task_id, fact, chunk))
            else:
                issues.append(rule_evidence_issue(chunk, fact))
        update_rule_progress(task_id, chunk)
    write_jsonl("extraction-results/knowledge-candidates.jsonl", candidates)
    write_jsonl("model-results/knowledge-extraction-batches.jsonl", [])
    write_json("quality/extraction-issues.json", issues)
    return candidates, issues, {"succeeded": 0, "failed": 0, "skipped": 0}
```

## 执行步骤

1. Doc Writer：先更新 `docs/12-PingCode知识提取步骤详细设计.md` 和受影响 README，定义规则候选 Schema、规则版本、`sourceMethod`、失败分类、空模型审计产物与前端阶段文案边界。
2. Backend Worker：以规则提取器替换 `_extract_deterministic()` 的网关状态检查和 Workflow Agent 调用；复用现有持久化、取消、进度和关键词准入边界，禁止硬编码业务规则，规则配置放入既有规则目录或版本化配置并登记待办。
3. Test Engineer：补充单元和真实后端 API 验收，验证网关返回 502、未配置及抛异常时该阶段仍完成且零模型调用；验证候选证据可回查、失败规则项记录中文质量问题、取消与正式知识输入边界不回归。
4. Frontend Worker（仅在文案与实际阶段语义不一致时）：更新 `PreprocessPage.vue` 的中文描述和成功计数逻辑，不新增 UI 流程。

## 验收标准

- [ ] 设计文档、接口伪代码和 `app/agents/README.md` 已同步为规则提取契约，且明确本阶段禁止模型调用。
- [ ] 主页开始加工经过“知识提取”时不调用 `gateway.status()`、模型网关或 Workflow Agent；模型调用统计为零。
- [ ] 将模型网关模拟为 HTTP 502、未配置和连接异常时，规则知识提取仍产生可回查候选或中文质量问题，任务不因模型服务失败。
- [ ] 规则候选保留 `taskId`、`stageRunId`、`chunkId`、`resourceId`、`keywordContext`、逐字 `evidenceText/evidenceOffsets`、规则版本和规则来源标识；不生成实体、关系或跨 chunk 推断。
- [ ] 真实后端 API 创建任务并轮询至终态，保存事件、阶段、候选、质量问题和零模型调用证据；前端构建通过且展示中文规则阶段描述。
- [ ] 未修改既有真实运行数据、模型配置、关键词过滤及语义补充范围外功能。

## 参考文档

- `docs/12-PingCode知识提取步骤详细设计.md`
- `docs/18-PingCode知识提取与构建测试设计.md`
- `scripts/pingcode/web/backend/app/agents/README.md`
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/frontend/src/views/PreprocessPage.vue`

## 预计变更文件

- `docs/12-PingCode知识提取步骤详细设计.md` (modified)
- `docs/18-PingCode知识提取与构建测试设计.md` (modified)
- `scripts/pingcode/web/backend/app/agents/README.md` (modified)
- `scripts/pingcode/web/backend/app/training_service.py` (modified)
- `scripts/pingcode/web/backend/tests/test_training_service.py` (modified)
- `scripts/pingcode/web/frontend/src/views/PreprocessPage.vue` (modified，如文案需同步)

## 风险

- 规则提取无法覆盖当前模型的自由语义归纳，必须把无法按原文规则确认的内容明确记录为质量问题，不能伪装为模型成功结果。
- `formal_knowledge` 的既有模型审计字段可能被读取方依赖；实施时须保留兼容字段和空批次产物，不能删除 API。
- 主页“知识提取”与后续可选语义补充的边界必须在日志和页面中可辨，防止模型错误再次被归因到规则阶段。

## 执行日志

- 2026-08-06 Planner：确认当前阶段名称为 `deterministic_extraction`，但实现实际调用 Workflow Agent/模型网关；创建待审批的纯规则提取切换任务。
