# TASK-FILTER-001: 后端新增 preview API

## 基本信息
- **标题**: 新增关键词过滤预览 API
- **优先级**: P0
- **预估时间**: 20分钟
- **状态**: completed
- **负责人**: backend-worker

## 任务描述
新增 `POST /api/datasets/{id}/keywords/filter-preview` 端点，调用 LLM 分析关键词并返回建议列表，但不实际修改数据。

## 实现细节

### API 端点
```
POST /api/datasets/{dataset_id}/keywords/filter-preview
Content-Type: application/json

{
  "prompt": "用户输入的过滤规则",
  "rule_id": "preset-rule-id" // 可选，预设规则ID
}
```

### 返回格式
```json
{
  "success": true,
  "preview": true,
  "suggestions": [
    {
      "keywordId": "keyword-1",
      "keywordName": "索引",
      "currentStatus": "admitted",
      "suggestedAction": "keep",
      "reason": "核心数据库功能，用户检索必需"
    }
  ],
  "summary": {
    "total": 43,
    "suggested_keep": 32,
    "suggested_exclude": 11
  }
}
```

### 关键实现点
1. 读取关键词列表
2. 调用 LLM 分析（使用 preview 专用 prompt）
3. 不修改任何数据（只读操作）
4. 返回详细建议列表

## 验收标准
- [x] API 端点可正常调用
- [x] 返回格式符合规范
- [x] 不修改数据库中的关键词状态
- [x] 包含详细的过滤原因说明
- [x] 支持 prompt 和 rule_id 两种输入

## 依赖关系
- 无前置依赖

## 相关文件
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/app/main.py`
