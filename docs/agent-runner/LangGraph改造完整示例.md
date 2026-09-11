# LangGraph 状态图改造完整示例

## 一、改造目标

将原有的固定流水线（Pipeline）升级为 LangGraph 状态图，实现：
1. **条件路由**：根据知识点类型自动选择不同的处理路径
2. **验证-重试循环**：验证失败时自动回退到生成器重试
3. **状态追踪**：完整记录每个节点的执行状态和中间结果

## 二、核心架构对比

### 改造前：固定流水线
```
Planner → Retriever → Generator → Validator → END
```
- 所有知识点走相同路径
- 验证失败只能重试 3 次后暂停
- 无法根据类型动态调整流程

### 改造后：LangGraph 状态图
```
                    ┌─────────────────────────────┐
                    │                             │
START → planner ──route_by_type                    │
              │         │                          │
     ┌────────┴────────┐                          │
     │ (兼容性差异)     │ (其他类型)                │
     ▼                 │                          │
 comparator            │                          │
     │                 │                          │
     └────────┬────────┘                          │
              ▼                                    │
         retriever ────────────────────────────────┘
              │
              ▼
         generator ◄──────────────────────┐
              │                            │
              ▼                            │
         validator ──route_after_validation┤
              │          │                 │
         (pass/max)   (fail+retry)─────────┘
              │
              ▼
             END
```

## 三、完整代码示例

### 3.1 状态定义（WorkflowState）

```javascript
const { Annotation } = require('@langchain/langgraph');

const WorkflowState = Annotation.Root({
  // 输入数据
  knowledgePoint: Annotation,      // 知识点信息
  template: Annotation,            // 文档模板
  prompt: Annotation,              // 用户提示词
  
  // 中间结果
  executionPlan: Annotation,       // 执行计划（planner 输出）
  references: Annotation,          // 参考资料（retriever 输出）
  comparison: Annotation,          // 对比分析（comparator 输出）
  document: Annotation,            // 生成的文档（generator 输出）
  validationReport: Annotation,    // 验证报告（validator 输出）
  
  // 重试机制
  feedback: Annotation,            // 验证反馈
  retryCount: Annotation({
    reducer: (prev, update) => update,
    default: () => 0,
  }),
  maxRetries: Annotation,
  
  // 进度追踪
  currentStep: Annotation,
  completedSteps: Annotation,
  stepDetails: Annotation,
});
```

**关键点**：
- `Annotation` 定义状态的每个字段
- `reducer` 控制状态如何更新（默认是覆盖，可自定义合并逻辑）
- `default` 提供初始值

### 3.2 节点函数（Node Functions）

每个节点是一个异步函数，接收当前状态，返回状态更新：

```javascript
// Planner 节点
function createPlannerNode(agentManager) {
  return async (state) => {
    const agent = agentManager.getAgent('planner');
    const input = {
      knowledgePoint: state.knowledgePoint,
      template: state.template,
    };
    
    const output = await agent.execute(input, {});
    
    return {
      executionPlan: output,
      currentStep: 'planner',
      completedSteps: [...(state.completedSteps || []), 'planner'],
      stepDetails: [...(state.stepDetails || []), {
        step: 'planner',
        status: 'completed',
        duration: output._meta?.duration || 0,
      }],
    };
  };
}

// Retriever 节点
function createRetrieverNode(agentManager, toolManager) {
  return async (state) => {
    const agent = agentManager.getAgent('retriever');
    if (toolManager) agent.setToolManager(toolManager);
    
    const output = await agent.execute({
      executionPlan: state.executionPlan,
    }, {});
    
    return {
      references: output.references,
      currentStep: 'retriever',
      completedSteps: [...state.completedSteps, 'retriever'],
    };
  };
}

// Comparator 节点（新增）
function createComparatorNode(agentManager) {
  return async (state) => {
    const agent = agentManager.getAgent('comparator');
    const output = await agent.execute({
      executionPlan: state.executionPlan,
      references: state.references,
    }, {});
    
    return {
      comparison: output.comparison,
      currentStep: 'comparator',
      completedSteps: [...state.completedSteps, 'comparator'],
    };
  };
}

// Generator 节点（支持反馈）
function createGeneratorNode(agentManager) {
  return async (state) => {
    const agent = agentManager.getAgent('generator');
    const output = await agent.execute({
      executionPlan: state.executionPlan,
      references: state.references,
      feedback: state.feedback,        // 接收验证反馈
      comparison: state.comparison,    // 接收对比分析
    }, {});
    
    return {
      document: output.document,
      feedback: null,                  // 清除反馈
      currentStep: 'generator',
      completedSteps: [...state.completedSteps, 'generator'],
    };
  };
}

// Validator 节点
function createValidatorNode(agentManager) {
  return async (state) => {
    const agent = agentManager.getAgent('validator');
    const output = await agent.execute({
      document: state.document,
      validationCriteria: state.executionPlan?.validation_criteria || {},
    }, {});
    
    return {
      validationReport: output,
      currentStep: 'validator',
      completedSteps: [...state.completedSteps, 'validator'],
    };
  };
}

// Retry 准备节点
async function retryPrepNode(state) {
  const report = state.validationReport;
  const feedbackText = [
    ...(report?.warnings || []),
    ...(report?.suggestions || []),
  ].join('\n');
  
  return {
    retryCount: state.retryCount + 1,
    feedback: feedbackText,
    currentStep: 'retry_generator',
    completedSteps: [...state.completedSteps, 'retry_generator'],
  };
}
```

**关键点**：
- 节点函数返回**状态更新对象**，不是完整状态
- LangGraph 自动合并更新到当前状态
- 每个节点记录执行信息到 `stepDetails`

### 3.3 条件路由函数

```javascript
// 根据知识点类型选择路径
function routeByType(state) {
  const kpType = state.knowledgePoint?.type || '';
  
  if (kpType === '兼容性差异' || kpType.includes('兼容性')) {
    return 'comparator';  // 走对比分析路径
  }
  
  return 'retriever';     // 走标准路径
}

// 验证后决定下一步
function routeAfterValidation(state) {
  const report = state.validationReport;
  
  if (!report) {
    return '__end__';  // 无验证报告，结束
  }
  
  if (report.passed) {
    return '__end__';  // 验证通过，结束
  }
  
  if (state.retryCount >= (state.maxRetries || 3)) {
    return '__end__';  // 达到最大重试次数，结束
  }
  
  return 'retry_generator';  // 验证失败，重试
}
```

**关键点**：
- 路由函数返回**下一个节点的名称**
- `__end__` 是 LangGraph 的特殊标记，表示结束
- 路由函数接收当前状态，可以基于状态做决策

### 3.4 构建状态图

```javascript
const { StateGraph, START, END } = require('@langchain/langgraph');

function buildWorkflowGraph(agentManager, toolManager, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const skipValidation = options.skipValidation || false;
  
  // 创建状态图
  const graph = new StateGraph(WorkflowState)
    .addNode('planner', createPlannerNode(agentManager))
    .addNode('retriever', createRetrieverNode(agentManager, toolManager))
    .addNode('comparator', createComparatorNode(agentManager))
    .addNode('generator', createGeneratorNode(agentManager));
  
  if (!skipValidation) {
    graph.addNode('validator', createValidatorNode(agentManager));
    graph.addNode('retry_generator', retryPrepNode);
  }
  
  // 定义边（固定路径）
  graph.addEdge(START, 'planner');
  graph.addEdge('comparator', 'retriever');
  graph.addEdge('retriever', 'generator');
  
  if (skipValidation) {
    graph.addEdge('generator', END);
  } else {
    graph.addEdge('generator', 'validator');
    graph.addEdge('retry_generator', 'generator');
  }
  
  // 定义条件边（动态路径）
  graph.addConditionalEdges('planner', routeByType, {
    comparator: 'comparator',
    retriever: 'retriever',
  });
  
  if (!skipValidation) {
    graph.addConditionalEdges('validator', routeAfterValidation, {
      __end__: END,
      retry_generator: 'retry_generator',
    });
  }
  
  // 编译图
  return graph.compile();
}
```

**关键点**：
- `addEdge` 定义固定路径
- `addConditionalEdges` 定义动态路径，第三个参数是路由映射
- `compile()` 返回可执行的图实例

### 3.5 执行示例

```javascript
// 创建图
const agentManager = new AgentManager(config);
const toolManager = new ToolManager(config);
const graph = buildWorkflowGraph(agentManager, toolManager, {
  maxRetries: 3,
  skipValidation: false,
});

// 准备初始状态
const initialState = {
  knowledgePoint: {
    name: '直接路径插入提示',
    type: '兼容性差异',
    description: '/*+ APPEND */ 提示的使用',
  },
  template: 'templates/07-兼容性差异类模板.md',
  prompt: null,
  executionPlan: null,
  references: null,
  comparison: null,
  document: null,
  validationReport: null,
  feedback: null,
  retryCount: 0,
  maxRetries: 3,
  currentStep: null,
  completedSteps: [],
  stepDetails: [],
};

// 执行图
const result = await graph.invoke(initialState, {
  recursionLimit: 50,  // 防止无限循环
});

// 查看结果
console.log('执行路径:', result.completedSteps);
// 输出: ['planner', 'comparator', 'retriever', 'generator', 'validator']

console.log('重试次数:', result.retryCount);
// 输出: 0

console.log('文档长度:', result.document?.length);
// 输出: 5234
```

## 四、执行流程示例

### 场景 1：标准知识点（通用基础）

```
输入: { type: '通用基础', name: '表空间管理' }

执行路径:
1. planner → 生成执行计划
2. retriever → 检索参考资料
3. generator → 生成文档
4. validator → 验证通过（score: 95）
5. END

completedSteps: ['planner', 'retriever', 'generator', 'validator']
retryCount: 0
```

### 场景 2：兼容性知识点

```
输入: { type: '兼容性差异', name: '直接路径插入' }

执行路径:
1. planner → 生成执行计划
2. routeByType → 检测到兼容性类型，路由到 comparator
3. comparator → 生成 Oracle vs YashanDB 对比分析
4. retriever → 检索参考资料
5. generator → 生成文档（包含对比分析）
6. validator → 验证通过
7. END

completedSteps: ['planner', 'comparator', 'retriever', 'generator', 'validator']
comparison: 'Oracle 使用 /*+ APPEND */，YashanDB 支持但行为略有不同...'
```

### 场景 3：验证失败后重试

```
输入: { type: '通用基础', name: '索引优化' }

执行路径:
1. planner → 生成执行计划
2. retriever → 检索参考资料
3. generator → 生成文档（第 1 版）
4. validator → 验证失败（score: 60, warnings: ['缺少 SQL 示例']）
5. routeAfterValidation → 重试次数 0 < 3，路由到 retry_generator
6. retry_generator → 准备反馈，retryCount = 1
7. generator → 根据反馈重新生成文档（第 2 版）
8. validator → 验证通过（score: 92）
9. END

completedSteps: ['planner', 'retriever', 'generator', 'validator', 'retry_generator', 'generator', 'validator']
retryCount: 1
feedback: '缺少 SQL 示例'
```

### 场景 4：达到最大重试次数

```
执行路径:
1. planner → retriever → generator → validator (score: 40, fail)
2. retry_generator → generator → validator (score: 45, fail)
3. retry_generator → generator → validator (score: 50, fail)
4. routeAfterValidation → 重试次数 3 >= 3，路由到 END

completedSteps: [..., 'validator', 'retry_generator', 'generator', 'validator', 'retry_generator', 'generator', 'validator']
retryCount: 3
```

## 五、与 WorkflowEngine 集成

```javascript
class WorkflowEngine extends EventEmitter {
  async startWorkflow(taskId) {
    const workflow = this.workflows.get(taskId);
    
    // 构建 LangGraph 图
    const graphOptions = this._resolveGraphOptions(workflow);
    const compiledGraph = buildWorkflowGraph(
      this.agentManager,
      this.toolManager,
      graphOptions
    );
    
    // 准备初始状态
    const initialState = this._buildInitialState(workflow, graphOptions);
    
    // 执行图
    const result = await compiledGraph.invoke(initialState, {
      recursionLimit: 50,
    });
    
    // 同步结果到 workflow 对象
    workflow.finalState = result;
    workflow.status = 'completed';
    this._syncStepsFromState(workflow, result);
    
    this._emitProgress(workflow);
  }
  
  _resolveGraphOptions(workflow) {
    const steps = workflow.steps.map(s => s.name);
    const skipValidation = !steps.includes('validator');
    const maxRetries = this.config.retryCount || 3;
    
    return { skipValidation, maxRetries };
  }
  
  _buildInitialState(workflow, graphOptions) {
    const input = workflow.inputData || {};
    const kp = input.knowledge_point || {};
    
    return {
      knowledgePoint: kp,
      template: input.template,
      prompt: input.prompt,
      executionPlan: null,
      references: null,
      comparison: null,
      document: null,
      validationReport: null,
      feedback: null,
      retryCount: 0,
      maxRetries: graphOptions.maxRetries,
      currentStep: null,
      completedSteps: [],
      stepDetails: [],
    };
  }
  
  _syncStepsFromState(workflow, finalState) {
    // 从 LangGraph 状态同步到 workflow.steps
    const stepDetails = finalState.stepDetails || [];
    
    for (const step of workflow.steps) {
      const details = stepDetails.filter(d => d.step === step.name);
      if (details.length > 0) {
        step.status = 'completed';
        step.attempt = details.length;
        step.details = details;
        step.duration = details.reduce((sum, d) => sum + (d.duration || 0), 0);
      }
    }
    
    // 同步输出
    const outputMap = {
      planner: finalState.executionPlan,
      retriever: { references: finalState.references },
      comparator: { comparison: finalState.comparison },
      generator: { document: finalState.document },
      validator: finalState.validationReport,
    };
    
    for (const step of workflow.steps) {
      if (outputMap[step.name] !== undefined) {
        step.output = outputMap[step.name];
      }
    }
  }
}
```

## 六、测试示例

```javascript
test('验证失败后重试成功', async () => {
  let validatorCallCount = 0;
  
  const agentManager = createMockAgentManager({
    validatorExecute: jest.fn().mockImplementation(async (input) => {
      validatorCallCount++;
      if (validatorCallCount === 1) {
        return {
          passed: false,
          score: 60,
          warnings: ['缺少 SQL 示例'],
          suggestions: ['请添加 SQL 代码'],
          _meta: { duration: 5 },
        };
      }
      return {
        passed: true,
        score: 92,
        warnings: [],
        suggestions: [],
        _meta: { duration: 5 },
      };
    }),
  });
  
  const graph = buildWorkflowGraph(agentManager, null, { maxRetries: 3 });
  const result = await graph.invoke(createInitialState());
  
  expect(result.retryCount).toBe(1);
  expect(result.completedSteps).toEqual([
    'planner', 'retriever', 'generator', 'validator',
    'retry_generator', 'generator', 'validator'
  ]);
});
```

## 七、核心优势总结

1. **声明式流程定义**：用状态图描述流程，而不是硬编码 if-else
2. **条件路由**：根据运行时状态动态选择路径
3. **自动重试**：验证失败自动回退，无需手动管理循环
4. **状态追踪**：完整记录每个节点的执行信息和中间结果
5. **可测试性**：每个节点和路由函数都可以独立测试
6. **可扩展性**：新增节点只需添加函数和边，不影响现有逻辑

## 八、迁移检查清单

- [ ] 安装 `@langchain/langgraph` 依赖
- [ ] 创建 `lib/langgraph-workflow.js`，定义状态和图
- [ ] 新增 `lib/agents/comparator-agent.js`
- [ ] 修改 `lib/agents/generator-agent.js`，支持 feedback 输入
- [ ] 修改 `lib/agent-manager.js`，注册 comparator agent
- [ ] 重写 `lib/workflow-engine.js`，使用 LangGraph 驱动
- [ ] 更新测试用例，覆盖条件路由和重试场景
- [ ] 验证 API 兼容性，确保前端无需修改

## 九、常见问题

**Q: LangGraph 的 `__end__` 是什么？**  
A: 这是 LangGraph 的特殊标记，表示图执行结束。在 `addConditionalEdges` 的映射中使用。

**Q: 如何防止无限循环？**  
A: 设置 `recursionLimit`（如 50），并在路由函数中检查 `retryCount >= maxRetries`。

**Q: 状态更新是覆盖还是合并？**  
A: 默认是覆盖。如果需要合并（如数组追加），使用 `reducer` 函数自定义。

**Q: 如何调试状态图执行？**  
A: 在每个节点函数中添加 `logger.info`，记录输入状态和输出更新。查看 `stepDetails` 数组了解完整执行路径。

**Q: 性能影响？**  
A: LangGraph 本身开销很小（< 10ms）。主要性能瓶颈仍然是 LLM 调用。状态图的优势在于减少了不必要的手动重试和错误处理代码。
