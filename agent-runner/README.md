# Agent Runner - YashanDB 知识库文档生成器

基于 Workflow Agent 的自动化文档生成系统，通过多步骤协作（Planner → Retriever → Generator → Validator）生成高质量的 YashanDB 知识库文档。

## 目录

- [快速开始](#快速开始)
- [系统架构](#系统架构)
- [配置说明](#配置说明)
- [API 文档](#api-文档)
- [开发指南](#开发指南)
- [测试](#测试)
- [故障排查](#故障排查)

---

## 快速开始

### 1. 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- 有效的 LLM API Key（OpenAI / 阿里云百炼 / 智谱 AI）

### 2. 安装依赖

```bash
cd agent-runner
npm install
```

### 3. 初始化配置

```bash
npm run init-config
```

这会创建以下配置文件：
- `config/model-config.json` - 模型配置
- `config/mcp-config.json` - MCP 服务配置
- `config/agent-presets.json` - Agent 预设
- `config/system-config.json` - 系统配置

### 4. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# 配置加密密钥（必须设置，用于加密 API Key）
AGENT_RUNNER_KEY=your-secret-key-here

# 服务端口（默认 4100）
PORT=4100

# 运行环境
NODE_ENV=development

# 日志级别
LOG_LEVEL=info
```

### 5. 启动服务

```bash
# 生产模式
npm start

# 开发模式（自动重启）
npm run dev
```

服务启动后会显示：
```
Agent Runner server started at http://localhost:4100
WebSocket available at ws://localhost:3000
Health check: http://localhost:4100/api/health
```

### 6. 使用前端界面

打开浏览器访问 `prompt-generator.html`（位于上级目录）：

测试服务器启动后，访问 `http://192.168.130.180:3500/prompt-generator.html`。前端固定连接 `http://192.168.130.180:4100` 后端。前后端进程均监听 `0.0.0.0`，需确保 Windows 宿主机已将 TCP 3500 和 4100 转发至当前运行环境，并在防火墙中放行这两个端口。

1. 点击右上角 **⚙️ 配置** 按钮
2. 选择 Provider（推荐阿里云百炼或智谱 AI，OpenAI 在某些地区受限）
3. 输入 API Key 和 Base URL
4. 点击 **🔗 测试连接** 验证配置
5. 点击 **💾 保存配置**

然后在左侧导航树选择知识点，填写表单后点击 **🚀 执行 Agent** 开始生成文档。

执行过程中，前端进度面板以紧凑时间线展示阶段摘要、工具调用数量、模型调用和写入状态；详细输入/输出只以摘要形式折叠展示，不暴露模型真实内部思维链。生成文件名会优先使用提示词首个 `yaml/yml` 代码块中的 `title` 或 `标题` 字段，并自动替换文件名非法字符。

直写模式相关逻辑位于 `lib/direct-generate/`：路由只负责分发请求，提示词解析、直写任务状态、执行日志和最终文档生成分别由独立模块维护。后续计划将提示词解析规则升级为 Prompt Profile 配置化。

---

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│  前端 (prompt-generator.html)                            │
│  - 知识点选择                                            │
│  - 配置面板（Modal）                                     │
│  - 执行进度面板                                          │
│  - 结果预览                                              │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/WebSocket
┌────────────────────▼────────────────────────────────────┐
│  后端 (agent-runner)                                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │  API Server (Express)                            │   │
│  │  - /api/config/*  配置管理                        │   │
│  │  - /api/agent/*   任务执行                        │   │
│  │  - WebSocket      实时进度推送                     │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │  Workflow Engine                                 │   │
│  │  - 工作流编排                                     │   │
│  │  - 步骤执行器                                     │   │
│  │  - 错误重试（3 次）                                │   │
│  │  - 并发控制                                       │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │  Agent Manager                                   │   │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌───────┐ │   │
│  │  │Planner  │→│Retriever │→│Generator│→│Validator│ │   │
│  │  └─────────┘ └──────────┘ └─────────┘ └───────┘ │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │  Tool Manager                                    │   │
│  │  - MCP Client (知识库查询)                        │   │
│  │  - File Reader (读取参考文档)                      │   │
│  │  - File Writer (写入生成文档)                      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼────┐  ┌────▼────┐  ┌───▼────┐
   │LLM API  │  │MCP Server│  │文件系统 │
   │(OpenAI/ │  │(知识库)   │  │(output/│
   │阿里云/  │  │          │  │templates│
   │智谱)    │  │          │  │等)     │
   └─────────┘  └──────────┘  └────────┘
```

### 工作流程

1. **Planner** - 分析知识点，生成执行计划（JSON）
2. **Retriever** - 根据计划检索 MCP 知识库和参考文档（Markdown）
3. **Generator** - 结合计划和资料生成文档草稿（Markdown）
4. **Validator** - 验证文档质量，输出验证报告（JSON）

每个步骤失败后会自动重试 3 次，如果仍然失败则暂停执行，用户可以选择：
- **强制继续** - 跳过失败步骤
- **终止执行** - 取消任务

---

## 配置说明

### 模型配置

通过前端配置面板或 API 设置：

```bash
curl -X POST http://localhost:4100/api/config/model \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "alibaba",
    "api_key": "sk-your-api-key",
    "base_url": "https://dashscope.aliyuncs.com/api/v1",
    "model": "qwen-max",
    "temperature": 0.7,
    "max_tokens": 60000
  }'
```

**支持的 Provider：**

| Provider | Base URL | 推荐模型 |
|----------|----------|----------|
| `openai` | https://api.openai.com/v1 | gpt-4, gpt-3.5-turbo |
| `alibaba` | https://dashscope.aliyuncs.com/api/v1 | qwen-max, qwen-plus |
| `zhipu` | https://open.bigmodel.cn/api/paas/v4 | glm-4, glm-3-turbo |
| `custom` | 自定义 | 任意兼容 OpenAI API 的服务 |

### MCP 配置

```bash
curl -X POST http://localhost:4100/api/config/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "server_url": "http://localhost:8080",
    "api_key": "your-mcp-key",
    "timeout": 30000,
    "cache": {
      "enabled": true,
      "ttl": 3600
    }
  }'
```

### Agent 预设

预设定义了工作流的步骤配置：

```bash
curl -X POST http://localhost:4100/api/config/agent \
  -H "Content-Type: application/json" \
  -d '{
    "id": "custom",
    "name": "自定义流程",
    "steps": [
      {"name": "plan", "agent": "planner", "config": {"temperature": 0.3}},
      {"name": "retrieve", "agent": "retriever", "config": {}},
      {"name": "generate", "agent": "generator", "config": {"temperature": 0.7}},
      {"name": "validate", "agent": "validator", "config": {}}
    ]
  }'
```

---

## API 文档

### 健康检查

```bash
GET /api/health
```

响应：
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600
}
```

### 配置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config/model` | 获取模型配置 |
| POST | `/api/config/model` | 保存模型配置 |
| GET | `/api/config/mcp` | 获取 MCP 配置 |
| POST | `/api/config/mcp` | 保存 MCP 配置 |
| GET | `/api/config/agents` | 获取 Agent 预设列表 |
| POST | `/api/config/agent` | 保存 Agent 预设 |

### 任务执行

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/agent/execute` | 执行工作流 |
| GET | `/api/agent/status/:taskId` | 查询任务状态 |
| POST | `/api/agent/cancel/:taskId` | 取消任务 |
| POST | `/api/agent/force-continue/:taskId` | 强制继续 |

### WebSocket

连接：
```javascript
const socket = io('http://localhost:4100');
```

订阅任务：
```javascript
socket.emit('subscribe', { task_id: 'task_xxx' });
```

监听事件：
- `progress` - 进度更新
- `step_failed` - 步骤失败
- `completed` - 任务完成

---

## 开发指南

### 项目结构

```
agent-runner/
├── config/              # 配置文件（AES-256 加密）
├── docs/                # 设计文档
├── lib/
│   ├── agents/          # Agent 实现
│   │   ├── base-agent.js
│   │   ├── planner-agent.js
│   │   ├── retriever-agent.js
│   │   ├── generator-agent.js
│   │   ├── validator-agent.js
│   │   └── prompts/     # Prompt 模板
│   ├── tools/           # 工具模块
│   │   ├── mcp-client.js
│   │   ├── file-reader.js
│   │   ├── file-writer.js
│   │   └── tool-manager.js
│   ├── workflow-engine.js
│   ├── step-executor.js
│   ├── agent-manager.js
│   ├── llm-client.js
│   ├── config-manager.js
│   └── logger.js
├── middleware/           # 中间件
├── routes/              # API 路由
├── scripts/             # 脚本
├── tests/               # 单元测试
├── logs/                # 日志
├── tmp/                 # 临时文件
├── server.js            # 服务入口
└── package.json
```

### 添加自定义 Agent

1. 创建 `lib/agents/my-agent.js`：

```javascript
const BaseAgent = require('./base-agent');

class MyAgent extends BaseAgent {
  constructor(config) {
    super('my-agent', '我的自定义 Agent', config);
  }

  buildPrompt(input) {
    return [
      { role: 'system', content: '你是...' },
      { role: 'user', content: JSON.stringify(input) }
    ];
  }

  parseResponse(response) {
    return { result: response.content };
  }
}

module.exports = MyAgent;
```

2. 在 `lib/agent-manager.js` 中注册：

```javascript
const MyAgent = require('./agents/my-agent');
this.registerAgent('my-agent', new MyAgent(config));
```

3. 在 Agent 预设中使用：

```json
{
  "steps": [
    {"name": "custom", "agent": "my-agent", "config": {}}
  ]
}
```

---

## 测试

### 运行所有测试

```bash
npm test
```

### 运行特定测试

```bash
npx jest tests/config-validator.test.js
```

### 测试覆盖率

```bash
npm run test:coverage
```

### 测试套件

- `config-validator.test.js` - 配置验证（17 个测试）
- `config-manager.test.js` - 配置管理（9 个测试）
- `llm-client.test.js` - LLM 客户端（7 个测试）
- `agents.test.js` - Agent 模块（25 个测试）
- `step-executor.test.js` - 步骤执行器（8 个测试）
- `workflow-engine.test.js` - 工作流引擎（11 个测试）
- `tools.test.js` - 工具模块（22 个测试）
- `api.test.js` - API 集成（14 个测试）

**总计：113 个测试用例**

---

## 故障排查

### OpenAI API 403 错误

**问题：** `403 Country, region, or territory not supported`

**解决：** 切换到阿里云百炼或智谱 AI：
```bash
curl -X POST http://localhost:4100/api/config/model \
  -H "Content-Type: application/json" \
  -d '{"provider": "alibaba", "api_key": "your-key", "model": "qwen-max"}'
```

### MCP 连接失败

**问题：** `MCP request failed`

**解决：**
1. 检查 MCP Server 是否运行
2. 验证 `server_url` 配置
3. 测试连接：
```bash
curl http://localhost:8080/health
```

### API Key 未配置

**问题：** `No API key configured`

**解决：** 通过前端配置面板或 API 设置 API Key

### 端口被占用

**问题：** `EADDRINUSE: address already in use :::4100`

**解决：** 修改 `.env` 中的 `PORT` 或停止占用端口的进程

### 日志查看

```bash
# 实时查看日志
tail -f logs/execution.log

# 查看错误日志
tail -f logs/error.log
```

---

## 许可证

MIT

## 联系方式

如有问题或建议，请联系开发团队。
