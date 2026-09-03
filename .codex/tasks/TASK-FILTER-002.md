# TASK-FILTER-002: 后端新增 apply API

## 基本信息
- **标题**: 新增关键词过滤应用 API
- **优先级**: P0
- **预估时间**: 15分钟
- **状态**: completed
- **负责人**: backend-worker

## 任务描述
新增 `POST /api/datasets/{id}/keywords/filter-apply` 端点，接收用户确认的决策列表并应用过滤结果到数据库。

## 实现细节

### API 端点
```
POST /api/datasets/{dataset_id}/keywords/filter-apply
Content-Type: application/json

{
  "decisions": [
    {
      "keywordId": "keyword-1",
      "action": "exclude",
      "reason": "用户确认排除"
    },
    {
      "keywordId": "keyword-2",
      "action": "keep",
      "reason": "用户确认保留"
    }
  ]
}
```

### 返回格式
```json
{
  "success": true,
  "applied": {
    "total": 43,
    "excluded": 11,
    "kept": 32
  },
  "updatedKeywords": ["keyword-1", "keyword-3"]
}
```

### 关键实现点
1. 验证输入决策列表格式
2. 批量更新关键词状态（admissionStatus）
3. 记录操作日志
4. 返回应用结果统计

## 验收标准
- [x] API 端点可正常调用
- [x] 正确批量更新关键词状态
- [x] 支持部分更新（某些关键词状态不变）
- [x] 返回准确的应用统计
- [x] 输入格式错误时返回明确错误信息

## 依赖关系
- TASK-FILTER-001（预览 API）完成后执行

## 相关文件
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/app/main.py`
