# LangGraph 改造补充示例

## 一、实际运行日志示例

### 1.1 标准流程执行日志

```bash
# 启动服务
npm start

# 发送请求
curl -X POST http://localhost:4100/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "knowledge_point": {
      "name": "表空间管理",
      "type": "通用基础",
      "description": "YashanDB 表空间的创建和管理"
    },
    "output_path": "output/数据库基础/",
    "filename": "表空间管理.md"
  }'
```

**执行日志输出**：

```
14:30:15 [info]: Workflow created: task_1720512615123_abc123
14:30:15 [info]: Workflow started: task_1720512615123_abc123
14:30:15 [info]: [graph] planner completed, 5 sections
14:30:15 [info]: [graph] Route: standard type → retriever
14:30:16 [info]: [retriever] MCP queries: 3 queries
14:30:17 [info]: [retriever] MCP queries completed, success: 3, duration: 1234ms
14:30:17 [info]: [graph] retriever completed, refs length: 8542
14:30:17 [info]: [graph] generator completed, doc length: 4521
14:30:18 [info]: [graph] validator completed, score: 95, passed: true
14:30:18 [info]: [graph] Route: validation passed (score: 95) → END
14:30:18 [info]: Workflow completed: task_1720512615123_abc123
```

### 1.2 兼容性类型执行日志

```bash
curl -X POST http://localhost:4100/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "knowledge_point": {
      "name": "直接路径插入提示",
      "type": "兼容性差异",
      "description": "/*+ APPEND */ 提示的使用差异"
    }
  }'
```

**执行日志输出**：

```
14:31:20 [info]: Workflow started: task_1720512680456_def456
14:31:20 [info]: [graph] planner completed, 6 sections
14:31:20 [info]: [graph] Route: compatibility type → comparator
14:31:21 [info]: [graph] comparator completed, comparison length: 3254
14:31:21 [info]: [graph] retriever completed, refs length: 6789
14:31:22 [info]: [graph] generator completed, doc length: 5832
14:31:23 [info]: [graph] validator completed, score: 92, passed: true
14:31:23 [info]: [graph] Route: validation passed (score: 92) → END
14:31:23 [info]: Workflow completed: task_1720512680456_def456
```

### 1.3 验证重试执行日志

```bash
# 假设生成的文档缺少 SQL 示例
```

**执行日志输出**：

```
14:32:30 [info]: Workflow started: task_1720512750789_ghi789
14:32:30 [info]: [graph] planner completed, 4 sections
14:32:30 [info]: [graph] Route: standard type → retriever
14:32:31 [info]: [graph] retriever completed, refs length: 5432
14:32:32 [info]: [graph] generator completed, doc length: 3210
14:32:33 [info]: [graph] validator completed, score: 60, passed: false
14:32:33 [info]: [graph] Route: validation failed (score: 60), retry 1 → generator
14:32:33 [info]: [graph] Preparing retry #1, feedback: 缺少 SQL 示例
请添加实际代码示例
14:32:34 [info]: [graph] generator completed (retry 1), doc length: 4567
14:32:35 [info]: [graph] validator completed, score: 93, passed: true
14:32:35 [info]: [graph] Route: validation passed (score: 93) → END
14:32:35 [info]: Workflow completed: task_1720512750789_ghi789
```

## 二、前端集成示例

### 2.1 WebSocket 连接和订阅

```javascript
// 前端代码（prompt-generator.html）
const socket = io('http://localhost:4100');

// 连接成功
socket.on('connect', () => {
  console.log('WebSocket connected:', socket.id);
});

// 订阅任务进度
function subscribeTask(taskId) {
  socket.emit('subscribe', { task_id: taskId });
  console.log('Subscribed to task:', taskId);
}

// 监听进度更新
socket.on('progress', (data) => {
  console.log('Progress update:', {
    taskId: data.task_id,
    status: data.status,
    progress: data.progress,
    currentStep: data.current_step,
  });
  
  // 更新 UI
  updateProgressBar(data.progress);
  updateCurrentStep(data.current_step);
  
  if (data.status === 'completed') {
    showSuccess('文档生成完成！');
    loadDocument(data.task_id);
  } else if (data.status === 'failed') {
    showError('生成失败: ' + data.error);
  }
});

// 监听步骤详情
socket.on('step_detail', (data) => {
  console.log('Step detail:', {
    step: data.step,
    type: data.detail_type,
    detail: data.detail,
  });
  
  // 显示详细信息（可折叠）
  addStepDetail(data);
});

// 监听步骤失败
socket.on('step_failed', (data) => {
  console.error('Step failed:', data);
  showWarning(`步骤 ${data.step} 失败: ${data.error}`);
});
```

### 2.2 执行任务并订阅

```javascript
async function executeDocumentGeneration() {
  const knowledgePoint = getSelectedKnowledgePoint();
  
  // 发送执行请求
  const response = await fetch('/api/agent/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      knowledge_point: knowledgePoint,
      output_path: 'output/数据库基础/',
      filename: `${knowledgePoint.name}.md`,
    }),
  });
  
  const result = await response.json();
  
  if (result.success) {
    const taskId = result.task_id;
    
    // 订阅任务进度
    subscribeTask(taskId);
    
    // 显示执行中状态
    showExecuting(taskId);
  }
}
```

### 2.3 显示步骤详情

```javascript
function addStepDetail(data) {
  const container = document.getElementById('step-details');
  
  const detail = document.createElement('div');
  detail.className = 'step-detail';
  
  const header = document.createElement('div');
  header.className = 'step-detail-header';
  header.innerHTML = `
    <span class="step-name">${data.step}</span>
    <span class="step-type">${data.detail_type}</span>
    <span class="step-duration">${data.detail.duration}ms</span>
  `;
  
  const content = document.createElement('div');
  content.className = 'step-detail-content';
  content.style.display = 'none';
  
  if (data.detail_type === 'llm_call') {
    content.innerHTML = `
      <div>模型: ${data.detail.model}</div>
      <div>输入: ${data.detail.input.system_prompt_length} + ${data.detail.input.user_prompt_length} tokens</div>
      <div>输出: ${data.detail.output.content_length} chars</div>
      <div>Tokens: ${data.detail.tokens}</div>
    `;
  } else if (data.detail_type === 'tool_call') {
    content.innerHTML = `
      <div>工具: ${data.detail.tool}</div>
      <div>状态: ${data.detail.status}</div>
      <div>耗时: ${data.detail.duration}ms</div>
    `;
  }
  
  // 点击展开/折叠
  header.onclick = () => {
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
  };
  
  detail.appendChild(header);
  detail.appendChild(content);
  container.appendChild(detail);
}
```

## 三、配置示例

### 3.1 标准模式（默认）

```json
{
  "steps": [
    { "name": "planner", "agent": "planner", "config": {} },
    { "name": "retriever", "agent": "retriever", "config": {} },
    { "name": "generator", "agent": "generator", "config": {} },
    { "name": "validator", "agent": "validator", "config": {} }
  ]
}
```

**执行路径**：
- 标准类型：`planner → retriever → generator → validator → END`
- 兼容性类型：`planner → comparator → retriever → generator → validator → END`
- 最大重试次数：3

### 3.2 快速模式（跳过验证）

```json
{
  "steps": [
    { "name": "planner", "agent": "planner", "config": {} },
    { "name": "retriever", "agent": "retriever", "config": {} },
    { "name": "generator", "agent": "generator", "config": {} }
  ]
}
```

**执行路径**：
- 所有类型：`planner → retriever → generator → END`
- 无验证，无重试
- 适用于快速预览或简单知识点

### 3.3 高质量模式（严格验证）

```json
{
  "steps": [
    { "name": "planner", "agent": "planner", "config": {} },
    { "name": "retriever", "agent": "retriever", "config": {} },
    { "name": "generator", "agent": "generator", "config": {} },
    { "name": "reviewer", "agent": "validator", "config": { "strict_mode": true } },
    { "name": "validator", "agent": "validator", "config": {} }
  ]
}
```

**执行路径**：
- 最大重试次数：5（strict_mode 触发）
- 双重验证（reviewer + validator）
- 适用于重要文档

### 3.4 模型配置

```json
{
  "provider": "alibaba",
  "model": "qwen3.7-plus",
  "base_url": "https://ai-green.yasdb.com/compatible-mode/v1",
  "temperature": 0.7,
  "max_tokens": 60000,
  "timeout": 180000
}
```

**不同 Agent 的推荐配置**：

```javascript
// Planner: 低温度，确保结构化输出稳定
{ "temperature": 0.3, "max_tokens": 4000 }

// Retriever: 中等温度，平衡创造性和准确性
{ "temperature": 0.5, "max_tokens": 8000 }

// Comparator: 低温度，确保对比分析准确
{ "temperature": 0.4, "max_tokens": 6000 }

// Generator: 较高温度，提升文档可读性
{ "temperature": 0.7, "max_tokens": 60000 }

// Validator: 低温度，确保验证结果稳定
{ "temperature": 0.2, "max_tokens": 4000 }
```

## 四、错误处理示例

### 4.1 LLM 调用失败

```javascript
// 在 base-agent.js 中
async callLLM(messages, stepConfig) {
  try {
    const response = await this.llmClient.chat(messages, stepConfig);
    return response;
  } catch (error) {
    logger.error(`LLM call failed: ${error.message}`);
    
    // 自动重试（最多 2 次）
    if (this.retryCount < 2) {
      this.retryCount++;
      logger.info(`Retrying LLM call (${this.retryCount}/2)`);
      await this.sleep(1000 * this.retryCount);  // 指数退避
      return this.callLLM(messages, stepConfig);
    }
    
    throw new Error(`LLM 调用失败: ${error.message}`);
  }
}
```

**日志输出**：

```
14:33:40 [error]: LLM call failed: Request timeout
14:33:40 [info]: Retrying LLM call (1/2)
14:33:41 [info]: LLM call succeeded on retry
```

### 4.2 MCP 查询失败

```javascript
// 在 retriever-agent.js 中
async _retrieveContent(plan) {
  const parts = [];
  
  // MCP 查询
  if (mcpQueries.length > 0) {
    try {
      const results = await mcpClient.batchQuery(mcpQueries);
      
      results.forEach((r, i) => {
        if (r.success && r.data) {
          parts.push(r.data);
        } else {
          logger.warn(`MCP query failed: ${mcpQueries[i]} - ${r.error}`);
          parts.push(`### MCP 查询失败\n\n${r.error}`);
        }
      });
    } catch (err) {
      logger.error(`MCP batch query failed: ${err.message}`);
      parts.push('### MCP 服务不可用\n\n将仅使用本地参考资料');
    }
  }
  
  return parts.join('\n\n---\n\n');
}
```

**处理策略**：
- MCP 查询失败不会中断流程
- 降级为仅使用本地参考资料
- 在文档中标注"部分参考资料不可用"

### 4.3 验证持续失败

```javascript
// 在 langgraph-workflow.js 中
function routeAfterValidation(state) {
  const report = state.validationReport;
  
  if (!report || report.passed) {
    return '__end__';
  }
  
  if (state.retryCount >= state.maxRetries) {
    logger.warn(`Max retries reached (${state.retryCount}/${state.maxRetries})`);
    
    // 记录失败原因
    const failureReport = {
      taskId: state.taskId,
      knowledgePoint: state.knowledgePoint,
      retryCount: state.retryCount,
      lastScore: report.score,
      warnings: report.warnings,
      suggestions: report.suggestions,
    };
    
    logger.error('Validation failed after max retries', failureReport);
    
    return '__end__';  // 强制结束，保留当前文档
  }
  
  return 'retry_generator';
}
```

**处理策略**：
- 达到最大重试次数后强制结束
- 保留最后生成的文档（即使质量不达标）
- 记录详细失败报告供人工审查
- 前端显示警告："文档已生成，但质量验证未通过，建议人工审查"

## 五、性能优化示例

### 5.1 并行检索

```javascript
// 在 retriever-agent.js 中
async _retrieveContent(plan) {
  const mcpQueries = plan.retrieval_plan?.mcp_queries || [];
  const refFiles = plan.retrieval_plan?.reference_files || [];
  
  // 并行执行 MCP 查询和文件读取
  const [mcpResults, fileResults] = await Promise.all([
    this._queryMCP(mcpQueries),
    this._readFiles(refFiles),
  ]);
  
  return [...mcpResults, ...fileResults].join('\n\n---\n\n');
}

async _queryMCP(queries) {
  const results = await Promise.all(
    queries.map(q => mcpClient.query(q).catch(err => ({ error: err.message })))
  );
  return results.filter(r => !r.error).map(r => r.data);
}

async _readFiles(files) {
  const results = await Promise.all(
    files.map(f => fileReader.read(f).catch(err => ({ error: err.message })))
  );
  return results.filter(r => !r.error).map(r => r.content);
}
```

**性能提升**：
- 3 个 MCP 查询 + 2 个文件读取：从串行 5s 降低到并行 2s
- 总体执行时间减少 60%

### 5.2 缓存执行计划

```javascript
// 在 workflow-engine.js 中
async startWorkflow(taskId) {
  const workflow = this.workflows.get(taskId);
  const kp = workflow.inputData.knowledge_point;
  
  // 检查缓存
  const cacheKey = `${kp.type}:${kp.name}`;
  const cachedPlan = this.planCache.get(cacheKey);
  
  if (cachedPlan && Date.now() - cachedPlan.timestamp < 3600000) {  // 1 小时缓存
    logger.info('Using cached execution plan');
    workflow.cachedPlan = cachedPlan.plan;
  }
  
  // 执行图
  const result = await compiledGraph.invoke(initialState);
  
  // 缓存执行计划
  if (result.executionPlan) {
    this.planCache.set(cacheKey, {
      plan: result.executionPlan,
      timestamp: Date.now(),
    });
  }
}
```

**性能提升**：
- 相同知识点的重复生成：跳过 planner 步骤
- 节省 1 次 LLM 调用（约 2-3 秒）

### 5.3 流式输出

```javascript
// 在 generator-agent.js 中
async execute(input, stepConfig) {
  const messages = this.buildPrompt(input, stepConfig);
  
  // 使用流式输出
  const stream = await this.llmClient.chatStream(messages, stepConfig);
  
  let fullContent = '';
  for await (const chunk of stream) {
    fullContent += chunk.content;
    
    // 实时发送进度
    this._emitDetail({
      type: 'stream_chunk',
      content_length: fullContent.length,
      timestamp: Date.now(),
    });
  }
  
  return { document: fullContent };
}
```

**用户体验提升**：
- 前端可以实时显示生成进度
- 长文档生成时不会感觉卡住
- 可以提前预览部分内容

## 六、监控和调试

### 6.1 执行指标收集

```javascript
// 在 workflow-engine.js 中
_syncStepsFromState(workflow, finalState) {
  const metrics = {
    taskId: workflow.taskId,
    knowledgePoint: workflow.inputData.knowledge_point,
    totalDuration: Date.now() - workflow.startTime,
    steps: finalState.stepDetails.map(d => ({
      step: d.step,
      duration: d.duration,
      tokens: d.tokens,
      status: d.status,
    })),
    retryCount: finalState.retryCount,
    finalScore: finalState.validationReport?.score,
  };
  
  // 发送到监控系统
  this.emit('metrics', metrics);
  
  // 记录到日志
  logger.info('Workflow metrics', metrics);
}
```

**指标示例**：

```json
{
  "taskId": "task_1720512615123_abc123",
  "knowledgePoint": { "name": "表空间管理", "type": "通用基础" },
  "totalDuration": 8234,
  "steps": [
    { "step": "planner", "duration": 1234, "tokens": 450, "status": "completed" },
    { "step": "retriever", "duration": 2345, "tokens": 1200, "status": "completed" },
    { "step": "generator", "duration": 3456, "tokens": 5200, "status": "completed" },
    { "step": "validator", "duration": 1199, "tokens": 380, "status": "completed" }
  ],
  "retryCount": 0,
  "finalScore": 95
}
```

### 6.2 调试模式

```javascript
// 在 .env 中设置
LOG_LEVEL=debug

// 在 langgraph-workflow.js 中
function createPlannerNode(agentManager) {
  return async (state) => {
    logger.debug('[planner] Input state:', {
      knowledgePoint: state.knowledgePoint,
      template: state.template,
    });
    
    const output = await agent.execute(input, {});
    
    logger.debug('[planner] Output:', {
      sections: output.document_structure?.sections?.length,
      retrievalPlan: output.retrieval_plan,
    });
    
    return { executionPlan: output, ... };
  };
}
```

**调试输出**：

```
14:30:15 [debug]: [planner] Input state: {
  knowledgePoint: { name: '表空间管理', type: '通用基础' },
  template: 'templates/01-通用基础模板.md'
}
14:30:15 [debug]: [planner] Output: {
  sections: 5,
  retrievalPlan: {
    mcp_queries: ['表空间创建', '表空间管理', '表空间优化'],
    reference_files: ['templates/01-通用基础模板.md']
  }
}
```

## 七、最佳实践

### 7.1 节点设计原则

1. **单一职责**：每个节点只负责一个明确的任务
2. **无副作用**：节点函数不修改外部状态，只返回状态更新
3. **错误隔离**：节点内部的错误不影响其他节点
4. **可测试性**：每个节点可以独立测试

### 7.2 状态设计原则

1. **最小化状态**：只保留必要的字段
2. **明确类型**：使用 TypeScript 或 JSDoc 标注类型
3. **默认值**：为所有字段提供合理的默认值
4. **不可变更新**：使用展开运算符创建新对象，而不是修改原对象

### 7.3 路由设计原则

1. **明确条件**：路由条件应该清晰、可预测
2. **兜底路径**： always 提供一个默认路径
3. **防止循环**：设置 `recursionLimit` 和重试上限
4. **日志记录**：记录每次路由决策的原因

## 八、常见问题排查

### 8.1 图编译失败

**错误**：`UnreachableNodeError: Node 'generator' is not reachable`

**原因**：某些节点没有边连接

**解决**：
```javascript
// 确保所有节点都有入边和出边
graph.addEdge('retriever', 'generator');  // 添加入边
graph.addEdge('generator', 'validator');  // 添加出边
```

### 8.2 无限循环

**错误**：`GraphRecursionError: Recursion limit reached`

**原因**：路由函数没有正确的终止条件

**解决**：
```javascript
function routeAfterValidation(state) {
  // 添加终止条件
  if (state.retryCount >= state.maxRetries) {
    return '__end__';
  }
  // ...
}
```

### 8.3 状态更新丢失

**现象**：节点返回的更新没有生效

**原因**：使用了错误的 reducer

**解决**：
```javascript
// 错误：默认 reducer 会覆盖
retryCount: Annotation,

// 正确：使用自定义 reducer
retryCount: Annotation({
  reducer: (prev, update) => update,
  default: () => 0,
}),
```

### 8.4 WebSocket 连接失败

**错误**：`WebSocket connection to 'ws://localhost:4100' failed`

**原因**：CORS 配置或端口问题

**解决**：
```javascript
// server.js
const io = new SocketServer(httpServer, {
  cors: {
    origin: ['http://localhost:*', 'http://127.0.0.1:*', 'file://*'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

## 九、总结

LangGraph 状态图改造为 agent-runner 带来了：

1. **灵活性**：条件路由支持不同知识点类型走不同路径
2. **可靠性**：自动重试机制提升文档质量
3. **可观测性**：完整的状态追踪和日志记录
4. **可维护性**：声明式流程定义，易于理解和修改
5. **可扩展性**：新增节点只需添加函数和边

通过本文档的示例，你可以：
- 理解 LangGraph 的核心概念和工作原理
- 参考实际运行日志调试问题
- 集成前端 WebSocket 实时显示进度
- 配置不同模式满足各种需求
- 处理各种异常情况
- 优化性能提升用户体验
- 遵循最佳实践编写高质量代码
