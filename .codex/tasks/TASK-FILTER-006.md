# TASK-FILTER-006: 前端预览模式 UI

## 基本信息
- **标题**: 实现关键词过滤预览结果展示界面
- **优先级**: P0
- **预估时间**: 25分钟
- **状态**: completed
- **负责人**: frontend-worker

## 任务描述
在调用 preview API 后，展示详细的预览结果面板，包含每个关键词的建议操作和原因说明，支持折叠/展开。

## 实现细节

### UI 布局
```
┌─────────────────────────────────────────────────────────┐
│ 过滤建议详情 ▼                              (共43个)    │
├─────────────────────────────────────────────────────────┤
│ 汇总: 建议保留 32 个 | 建议排除 11 个                     │
├─────────────────────────────────────────────────────────┤
│ 🟢 保留  索引                                            │
│    原因: 核心数据库功能，用户检索必需                      │
│                                                         │
│ 🔴 排除  YAS-00402                                       │
│    原因: 应作为"权限错误"的别名，而非独立关键词            │
│                                                         │
│ 🟢 保留  备份恢复                                        │
│    原因: 重要的运维功能，用户常查询                        │
│                                                         │
│ ... (可滚动，最大高度400px)                               │
└─────────────────────────────────────────────────────────┘
```

### 组件结构
```vue
<template>
  <div v-if="previewResults.length" class="preview-panel">
    <div class="preview-header" @click="toggleExpand">
      <strong>过滤建议详情</strong>
      <span class="summary">
        建议保留 {{ keepCount }} 个 | 建议排除 {{ excludeCount }} 个
      </span>
      <span class="toggle-icon">{{ expanded ? '▼' : '▶' }}</span>
    </div>

    <div v-show="expanded" class="preview-list">
      <div v-for="item in previewResults" :key="item.keywordId" class="preview-item">
        <div class="item-main">
          <span :class="['badge', item.suggestedAction]">
            {{ item.suggestedAction === 'keep' ? '保留' : '排除' }}
          </span>
          <strong>{{ item.keywordName }}</strong>
        </div>
        <div class="item-reason">{{ item.reason }}</div>
      </div>
    </div>
  </div>
</template>
```

### 样式要点
- 绿色徽章 = 建议保留
- 红色徽章 = 建议排除
- 面板可折叠/展开
- 列表最大高度 400px，超出可滚动
- 默认展开（如果结果 ≤ 15 个）

## 验收标准
- [x] preview API 返回后自动展示预览面板
- [x] 显示每个关键词的建议操作（保留/排除）
- [x] 显示详细的过滤原因说明
- [x] 支持折叠/展开操作
- [x] 汇总统计正确（保留数、排除数）
- [x] 样式清晰易读（绿色/红色区分）
- [x] 超过15个结果时默认折叠

## 依赖关系
- TASK-FILTER-001（preview API）完成后执行
- TASK-FILTER-005（预设规则选择器）完成后执行

## 相关文件
- `scripts/pingcode/web/frontend/src/views/QualityPage.vue`
