# TASK-FILTER-007: 前端手动调整单个建议

## 基本信息
- **标题**: 支持用户在预览阶段手动调整单个关键词的建议
- **优先级**: P1
- **预估时间**: 20分钟
- **状态**: completed
- **负责人**: frontend-worker

## 任务描述
在预览结果面板中，允许用户通过勾选框调整单个关键词的建议操作（保留/排除），提供更大的灵活性。

## 实现细节

### UI 布局
```
┌─────────────────────────────────────────────────────────┐
│ 过滤建议详情 ▼                              (共43个)    │
├─────────────────────────────────────────────────────────┤
│ 汇总: 建议保留 32 个 | 建议排除 11 个                     │
├─────────────────────────────────────────────────────────┤
│ 🟢 ☑ 保留  索引                                          │
│      原因: 核心数据库功能，用户检索必需                    │
│                                                         │
│ 🔴 ☑ 排除  YAS-00402                                     │
│      原因: 应作为"权限错误"的别名                        │
│                                                         │
│ 🟢 ☐ 保留  系统管理  ← 用户取消勾选                      │
│      原因: 用户确认保留                                  │
└─────────────────────────────────────────────────────────┘
```

### 组件结构
```vue
<template>
  <div class="preview-item">
    <div class="item-main">
      <input
        type="checkbox"
        :checked="item.userConfirmed !== false"
        @change="toggleConfirmation(item)"
      />
      <span :class="['badge', item.suggestedAction]">
        {{ item.suggestedAction === 'keep' ? '保留' : '排除' }}
      </span>
      <strong>{{ item.keywordName }}</strong>
    </div>
    <div class="item-reason">{{ item.reason }}</div>
  </div>
</template>
```

### 数据流
1. preview API 返回建议列表
2. 每个建议添加 `userConfirmed: true` 字段
3. 用户取消勾选 → `userConfirmed: false`
4. 点击"应用建议"时，只提交 `userConfirmed: true` 的决策

## 验收标准
- [x] 每个关键词前有勾选框
- [x] 默认全部勾选（接受 Agent 建议）
- [x] 用户可取消勾选特定关键词
- [x] 取消勾选的关键词不会在应用时修改状态
- [x] 汇总统计实时更新（反映用户调整）
- [x] 提供"全选/全不选"快捷操作（可选）

## 依赖关系
- TASK-FILTER-006（预览模式 UI）完成后执行

## 相关文件
- `scripts/pingcode/web/frontend/src/views/QualityPage.vue`
