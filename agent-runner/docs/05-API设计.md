# API 设计文档

## 1. 概述

后端提供 RESTful API 和 WebSocket 实时推送，支持配置管理、任务执行和状态查询。

## 2. API 总览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/config/model | 更新模型配置 |
| POST | /api/config/mcp | 更新 MCP 配置 |
| POST | /api/config/agent | 保存 Agent 预设 |
| GET | /api/config/model | 获取模型配置 |
| GET | /api/config/mcp | 获取 MCP 配置 |
| GET | /api/config/agents | 获取 Agent 预设列表 |
| POST | /api/agent/execute | 执行 Agent |
| GET | /api/agent/status/:taskId | 查询执行状态 |
| POST | /api/agent/cancel/:taskId | 取消执行 |
| POST | /api/agent/force-continue/:taskId | 强制继续执行 |
| GET | /api/logs | 查询执行日志 |
| WS | /ws | WebSocket 实时推送 |

## 3. 配置 API

### 3.1 更新模型配置

```http
POST /api/config/model
Content-Type: application/json

{
  "provider": "openai",
  "api_key": "sk-***",
  "model": "gpt-4",
  "base_url": "https://api.openai.com/v1",
  "temperature": 0.7,
  "max_tokens": 4000
}
```

**响应：**

```json
{
  "success": true,
  "message": "模型配置已保存"
}
```

### 3.2 更新 MCP 配置

```http
POST /api/config/mcp
Content-Type: application/json

{
  "server_url": "http://localhost:8080",
  "api_key": "***",
  "timeout": 30000,
  "cache": {
    "enabled": true,
    "ttl": 3600
  }
}
```

**响应：**

```json
{
  "success": true,
  "message": "MCP 配置已保存"
}
```

### 3.3 获取配置

```http
GET /api/config/model
```

**响应：**

```json
{
  "provider": "openai",
  "model": "gpt-4",
  "base_url": "https://api.openai.com/v1",
  "temperature": 0.7,
  "max_tokens": 4000,
  "api_key_configured": true
}
```

> 注意：API Key 不会明文返回，只返回是否已配置的状态。

## 4. 执行 API

### 4.1 执行 Agent

```http
POST /api/agent/execute
Content-Type: application/json

{
  "agent_type": "workflow",
  "knowledge_point": {
    "id": "2.1.2",
    "name": "直接路径插入提示",
    "type": "兼容性差异",
    "description": "...",
    "part": "业务领域 - 第1部分：兼容性领域",
    "chapter": "2 DML 兼容性"
  },
  "workflow_config": {
    "steps": [
      { "name": "planner", "agent": "planner", "config": {} },
      { "name": "retriever", "agent": "retriever", "config": {} },
      { "name": "generator", "agent": "generator", "config": {} },
      { "name": "validator", "agent": "validator", "config": {} }
    ]
  },
  "output_path": "output/兼容性领域/02-DML兼容性/",
  "filename": "2.1.2-直接路径插入提示.md"
}
```

**响应：**

```json
{
  "success": true,
  "task_id": "task_abc123",
  "message": "任务已启动"
}
```

### 4.2 查询执行状态

```http
GET /api/agent/status/task_abc123
```

**响应：**

```json
{
  "task_id": "task_abc123",
  "status": "running",
  "progress": 50,
  "current_step": "generator",
  "steps": [
    {
      "name": "planner",
      "status": "completed",
      "duration": 5200,
      "output_preview": "{\"knowledge_point\":...}"
    },
    {
      "name": "retriever",
      "status": "completed",
      "duration": 8300,
      "output_preview": "# 参考资料汇总\n\n..."
    },
    {
      "name": "generator",
      "status": "running",
      "duration": 0,
      "output_preview": null
    },
    {
      "name": "validator",
      "status": "pending",
      "duration": 0,
      "output_preview": null
    }
  ],
  "error": null
}
```

### 4.3 取消执行

```http
POST /api/agent/cancel/task_abc123
```

**响应：**

```json
{
  "success": true,
  "message": "任务已取消"
}
```

### 4.4 强制继续执行

当步骤失败重试3次后，用户可以选择强制继续：

```http
POST /api/agent/force-continue/task_abc123
Content-Type: application/json

{
  "step": "retriever"
}
```

**响应：**

```json
{
  "success": true,
  "message": "已跳过失败步骤，继续执行"
}
```

## 5. WebSocket 实时推送

### 5.1 连接

```javascript
const socket = io('http://localhost:4100');
```

### 5.2 订阅任务进度

```javascript
// 订阅特定任务
socket.emit('subscribe', { task_id: 'task_abc123' });

// 接收进度更新
socket.on('progress', (data) => {
    console.log('进度:', data.progress);
    console.log('当前步骤:', data.current_step);
    console.log('步骤详情:', data.steps);
});

// 接收步骤失败通知
socket.on('step_failed', (data) => {
    console.log('步骤失败:', data.step);
    console.log('错误信息:', data.error);
    // 显示用户选择界面
});
```

### 5.3 消息类型

| 事件 | 方向 | 说明 |
|------|------|------|
| subscribe | Client → Server | 订阅任务进度 |
| unsubscribe | Client → Server | 取消订阅 |
| progress | Server → Client | 进度更新 |
| step_failed | Server → Client | 步骤失败通知 |
| completed | Server → Client | 任务完成 |
| error | Server → Client | 任务错误 |

## 6. 日志 API

### 6.1 查询执行日志

```http
GET /api/logs?limit=50&offset=0&status=completed
```

**响应：**

```json
{
  "logs": [
    {
      "task_id": "task_abc123",
      "timestamp": "2024-01-01T10:00:00Z",
      "knowledge_point": "2.1.2 直接路径插入提示",
      "agent_type": "workflow",
      "status": "completed",
      "duration": 28000,
      "tokens_used": 3847,
      "output_path": "output/兼容性领域/02-DML兼容性/2.1.2-直接路径插入提示.md"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

## 7. 错误处理

### 7.1 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "缺少必填参数: knowledge_point",
    "details": {}
  }
}
```

### 7.2 错误码

| 错误码 | 说明 |
|--------|------|
| VALIDATION_ERROR | 参数验证失败 |
| NOT_FOUND | 资源不存在 |
| CONFIG_MISSING | 配置缺失 |
| MCP_ERROR | MCP 调用失败 |
| LLM_ERROR | 大模型调用失败 |
| FILE_ERROR | 文件操作失败 |
| TASK_NOT_FOUND | 任务不存在 |
| TASK_ALREADY_RUNNING | 任务已在运行 |

## 8. 频率限制

```javascript
// 每分钟最多 10 次执行
const executeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT',
            message: '请求过于频繁，请稍后再试'
        }
    }
});

app.post('/api/agent/execute', executeLimiter, executeHandler);
```

## 9. 认证

当前版本使用简单的 API Key 认证：

```javascript
// 请求头
Authorization: Bearer <api_key>

// 验证
function authenticate(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token !== process.env.API_KEY) {
        return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: '认证失败' }
        });
    }
    next();
}
```

## 10. CORS 配置

```javascript
app.use(cors({
    origin: ['http://localhost:*', 'http://127.0.0.1:*'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```
