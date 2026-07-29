<script setup>
defineProps({ summary: { type: Object, required: true } })
</script>

<template>
  <div class="quality-summary">
    <span v-if="summary.errors" class="quality-count danger">{{ summary.errors }} 错误</span>
    <span v-if="summary.pendingReview" class="quality-count warning">{{ summary.pendingReview }} 待复核</span>
    <span v-if="summary.warnings" class="quality-count warning">{{ summary.warnings }} 警告</span>
    <span v-if="!summary.errors && !summary.pendingReview && !summary.warnings" :class="['quality-count', summary.state === 'passed' ? 'success' : 'neutral']">{{ summary.state === 'passed' ? '质量通过' : '暂无质量结论' }}</span>
  </div>
</template>
