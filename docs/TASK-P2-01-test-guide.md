# TASK-P2-01: 正式知识构建测试指南

## 修复内容

**问题**: 正式知识构建任务因模型网关超时而失败  
**根因**: `formalKnowledge.timeoutMs` 配置为 60秒，模型响应时间可能超过此限制  
**修复**: 将超时时间从 60秒 调整为 120秒

### 修改文件
1. `apps/pingcode-api/app/training_service.py:260`
   - `"timeoutMs": int(formal_defaults.get("timeoutMs", 120000))`

2. `tools/knowledge-processing/pingcode-processing/skills/knowledge-point-extraction/skill.yaml`
   - `timeoutMs: 120000`

### 配置验证
```bash
curl -s http://localhost:8001/api/training/model-config | jq .formalKnowledge
```

预期输出：
```json
{
  "maxTokens": 4000,
  "timeoutMs": 120000,  // ✓ 已修改
  "maxRetries": 2,
  "concurrency": 3,
  "batchSize": 1
}
```

## 测试前置条件

### 必需条件
1. **数据集状态**: 需要至少一个已完成图谱构建的数据集
   - `state`: `completed` 或 `ready`
   - `graphSummary.graphAvailable`: `true`
   - `graphSummary.keywordCount`: > 0

2. **关键词准入**: 需要至少一个已准入的关键词
   - 在质量分析页面执行"确认并准入"操作
   - `admissionStatus`: `admitted`

3. **模型网关**: 已配置并可用
   - `configured`: `true`
   - `capabilities.chat`: `true`

### 当前环境状态
```bash
# 检查数据集
curl -s http://localhost:8001/api/datasets | jq '.items[] | {id, state, graphAvailable: .graphSummary.graphAvailable}'

# 检查模型网关
curl -s http://localhost:8001/api/training/model-config | jq '{configured, capabilities}'
```

**当前状态**: 
- 有图谱的数据集: 0 个
- 需要先完成一个数据集的完整处理流程

## 测试步骤

### 阶段 1: 准备测试数据集（如需要）

如果当前没有可用的数据集，需要先完成以下步骤：

1. **上传素材**
   - 访问 http://localhost:3500/prompt-generator.html
   - 在"文档生成"标签页上传文档

2. **关键词分析**
   - 切换到"质量分析"标签页
   - 选择刚创建的数据集
   - 等待关键词分析完成

3. **关键词准入**
   - 在关键词列表中选择相关关键词
   - 点击"确认并准入"按钮
   - 确保至少有一个关键词的 `admissionStatus` 变为 `admitted`

### 阶段 2: 触发正式知识构建

1. **前端操作**
   - 访问 http://localhost:3500/prompt-generator.html
   - 切换到"质量分析"标签页
   - 选择有已准入关键词的数据集
   - 点击"基于已生效关键词构建正式知识"按钮

2. **监控任务创建**
   - 前端应显示："正式知识构建任务已创建：{task_id}，已按业务准入关键词调度。"
   - 记录 task_id

### 阶段 3: 监控任务执行

#### 方法 1: API 轮询
```bash
# 检查任务状态
curl -s http://localhost:8001/api/tasks/{task_id} | jq '{state, stage, progressDetail}'

# 持续监控（每 5 秒）
while true; do
  echo "=== $(date) ==="
  curl -s http://localhost:8001/api/tasks/{task_id} | jq '{state, stage, current: .progressDetail.current, total: .progressDetail.total, message: .progressDetail.message}'
  sleep 5
done
```

#### 方法 2: 查看事件日志
```bash
# 查看任务事件流
curl -s http://localhost:8001/api/tasks/{task_id}/events | jq '.items[-10:]'
```

#### 方法 3: 查看后端日志
```bash
tail -f apps/pingcode-api/backend.log | grep -E "formal|knowledge|timeout"
```

### 阶段 4: 验证生成结果

#### 4.1 检查任务状态
```bash
curl -s http://localhost:8001/api/tasks/{task_id} | jq '{state, stage, message}'
```

预期输出：
```json
{
  "state": "completed",
  "stage": "completed",
  "message": "任务已完成"
}
```

#### 4.2 检查生成的文件
```bash
# 查找任务目录
TASK_DIR=$(find apps/pingcode-api/data -name "{task_id}" -type d)
echo "任务目录: $TASK_DIR"

# 检查关键文件
ls -lh $TASK_DIR/extraction-results/
ls -lh $TASK_DIR/final-results/

# 查看正式知识输入计划
cat $TASK_DIR/extraction-results/formal-knowledge-input.json | jq .

# 查看知识候选
cat $TASK_DIR/extraction-results/knowledge-candidates.jsonl | head -5 | jq .

# 查看最终知识（如果有）
cat $TASK_DIR/final-results/knowledge.jsonl | head -5 | jq .
```

#### 4.3 验证 knowledge-candidates.jsonl 结构

每条记录应包含：
```json
{
  "candidateId": "candidate:xxx",
  "taskId": "{task_id}",
  "state": "agent_resolved",           // ✓ 必需
  "kind": "knowledge_point",           // ✓ 必需
  "keywordIds": ["kw:xxx", "kw:yyy"],  // ✓ 必需，已去重排序
  "keywordContext": [...],             // ✓ 必需，已去重排序
  "chunkId": "chunk-xxx",              // ✓ 必需
  "evidenceText": "...",               // ✓ 必需
  "sourceResourceId": "resource-xxx",  // ✓ 必需
  "sourcePath": "xxx.md",              // ✓ 必需
  "confidence": 0.95,                  // ✓ 必需
  "schemaVersion": "2.0.0"
}
```

#### 4.4 验证数据完整性
```bash
# 统计候选数量
wc -l $TASK_DIR/extraction-results/knowledge-candidates.jsonl

# 检查所有必需字段
cat $TASK_DIR/extraction-results/knowledge-candidates.jsonl | jq '
  has("state") and 
  has("kind") and 
  has("keywordIds") and 
  has("keywordContext") and 
  has("chunkId") and 
  has("evidenceText") and 
  has("sourceResourceId") and 
  has("sourcePath") and 
  has("confidence")
' | sort | uniq -c
```

预期输出：所有记录都应返回 `true`

## 常见问题排查

### 问题 1: 任务创建失败
**错误信息**: "没有已准入（生效）的关键词，不能构建正式知识"

**解决方案**:
```bash
# 检查关键词准入状态
curl -s http://localhost:8001/api/datasets/{dataset_id}/graph/nodes | jq '
  .[] | select(.type == "Keyword") | {
    keywordId, 
    canonicalName, 
    admissionStatus
  }' | grep -A2 "admitted"
```

**操作**: 在质量分析页面执行"确认并准入"操作

### 问题 2: 任务超时失败
**错误信息**: "模型网关超时" 或 "timed out"

**解决方案**:
1. 检查配置是否生效：
```bash
curl -s http://localhost:8001/api/training/model-config | jq .formalKnowledge.timeoutMs
```

2. 如果仍为 60000，重启后端服务：
```bash
pkill -f "uvicorn app.main"
cd apps/pingcode-api
nohup uvicorn app.main:app --host 127.0.0.1 --port 8001 > backend.log 2>&1 &
```

3. 检查模型网关状态：
```bash
curl -s http://localhost:4100/api/model-provider/status | jq .
```

### 问题 3: 任务卡在某个阶段
**现象**: 任务状态长时间不变

**排查步骤**:
```bash
# 1. 检查当前阶段
curl -s http://localhost:8001/api/tasks/{task_id} | jq '{stage, progressDetail}'

# 2. 查看最近事件
curl -s http://localhost:8001/api/tasks/{task_id}/events | jq '.items[-5:]'

# 3. 查看后端日志
tail -100 apps/pingcode-api/backend.log | grep -i "{task_id}"
```

### 问题 4: 生成的文件为空
**现象**: knowledge-candidates.jsonl 不存在或为空

**排查步骤**:
```bash
# 1. 检查 formal-knowledge-input.json
cat $TASK_DIR/extraction-results/formal-knowledge-input.json | jq .

# 2. 检查 acceptedKeywordIds 是否为空
cat $TASK_DIR/extraction-results/formal-knowledge-input.json | jq '.acceptedKeywordIds | length'

# 3. 检查 scheduledChunkIds 是否为空
cat $TASK_DIR/extraction-results/formal-knowledge-input.json | jq '.scheduledChunkIds | length'
```

**可能原因**:
- 所有关键词都被业务审核拒绝
- keyword-chunk-index.json 不存在或为空
- 模型调用全部失败

## 验收标准检查清单

- [ ] 任务成功创建（返回 task_id）
- [ ] 任务状态变为 `completed`
- [ ] `formal-knowledge-input.json` 存在且结构正确
- [ ] `knowledge-candidates.jsonl` 存在且非空
- [ ] 每条候选包含所有必需字段
- [ ] `keywordIds` 已去重并按字典序排序
- [ ] `keywordContext` 已去重并按 `keywordId` 排序
- [ ] `evidenceText` 能在原文中回查
- [ ] 无证据的知识点被过滤
- [ ] 输出不包含敏感信息（Prompt、API Key）

## 性能基准

### 超时配置
- 模型网关超时: 180秒
- 正式知识提取超时: 120秒
- 安全边际: 60秒

### 预期执行时间
- 单个 chunk 处理: 30-90秒
- 10 个 chunk: 5-15分钟
- 50 个 chunk: 25-75分钟

### 并发配置
- `batchSize`: 1（每个 chunk 单独处理）
- `concurrency`: 3（最多 3 个并行）

## 测试报告模板

```markdown
## 测试报告

**测试日期**: YYYY-MM-DD  
**测试人员**: XXX  
**数据集 ID**: dataset_xxx  
**任务 ID**: training_xxx  

### 测试结果
- [ ] 任务创建成功
- [ ] 任务执行完成
- [ ] 生成文件验证通过
- [ ] 数据结构验证通过

### 执行时间
- 任务创建: HH:MM:SS
- 任务完成: HH:MM:SS
- 总耗时: XX 分钟

### 生成统计
- 准入关键词数: XX
- 调度 chunk 数: XX
- 生成候选数: XX
- 通过验证数: XX

### 问题记录
（如有问题，记录错误信息、日志片段、截图等）

### 结论
- [ ] ✓ 测试通过，功能正常
- [ ] ✗ 测试失败，需要修复
```

## 联系支持

如遇到问题，请提供以下信息：
1. 数据集 ID 和任务 ID
2. 任务状态和错误信息
3. 后端日志片段（最后 100 行）
4. 生成的文件内容（如有）

**日志位置**: `apps/pingcode-api/backend.log`
