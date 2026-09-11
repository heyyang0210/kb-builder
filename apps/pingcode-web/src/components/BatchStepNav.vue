<script setup>
defineProps({
  batchId: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <nav class="tabs" aria-label="资料加工任务步骤">
    <router-link :to="`/batches/${batchId}/download`">下载文件</router-link>
    <router-link :to="`/batches/${batchId}/preprocess`">加工任务</router-link>
    <router-link :to="`/batches/${batchId}/quality`">质量分析</router-link>
  </nav>
</template>
