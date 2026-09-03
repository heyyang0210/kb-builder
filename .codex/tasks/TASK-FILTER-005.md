# TASK-FILTER-005: 前端预设规则选择器

## 基本信息
- **标题**: 新增前端预设规则下拉选择器
- **优先级**: P0
- **预估时间**: 20分钟
- **状态**: completed
- **负责人**: frontend-worker

## 任务描述
在关键词智能过滤输入框前增加预设规则下拉选择器，用户可选择预设规则或自定义输入。

## 实现细节

### UI 布局
```
┌─────────────────────────────────────────────────────────┐
│ 关键词智能过滤                                            │
├─────────────────────────────────────────────────────────┤
│ 预设规则: [排除通用词 ▼]  [分析建议]  [应用建议]  [重新] │
│ 自定义:  [输入过滤提示词...                                ] │
└─────────────────────────────────────────────────────────┘
```

### 组件结构
```vue
<template>
  <div class="filter-preset-selector">
    <select v-model="selectedRuleId" @change="onRuleChange">
      <option value="">自定义规则</option>
      <option v-for="rule in presetRules" :key="rule.id" :value="rule.id">
        {{ rule.label }}
      </option>
    </select>

    <input
      v-model="filterPrompt"
      :placeholder="selectedRuleId ? presetRules.find(r => r.id === selectedRuleId)?.prompt : '输入过滤提示词...'"
      :disabled="!!selectedRuleId"
    />

    <button @click="analyze" :disabled="!filterPrompt.trim()">
      分析建议
    </button>
  </div>
</template>
```

### 数据流
1. 页面加载时请求 `GET /api/config/filter-rules`
2. 用户选择预设规则 → 自动填充提示词
3. 用户选择"自定义规则" → 清空提示词，允许手动输入
4. 点击"分析建议" → 调用 preview API

## 验收标准
- [x] 下拉框显示5个预设规则
- [x] 选择预设规则后自动填充提示词
- [x] 选择"自定义规则"后允许手动输入
- [x] 预设规则提示词只读（防止意外修改）
- [x] 点击"分析建议"正确调用 preview API
- [x] 规则加载失败时降级为纯手动输入

## 依赖关系
- TASK-FILTER-004（配置文件）完成后执行
- TASK-FILTER-001（preview API）完成后执行

## 相关文件
- `scripts/pingcode/web/frontend/src/views/QualityPage.vue`
