<script setup>
import { X } from 'lucide-vue-next'
import ProcessSummary from './ProcessSummary.vue'
import QualitySummary from './QualitySummary.vue'

defineProps({ task: { type: Object, default: null }, loading: Boolean })
defineEmits(['close'])
</script>

<template>
  <div class="drawer-backdrop task-drawer-backdrop" @click.self="$emit('close')">
    <aside class="task-detail-drawer" role="dialog" aria-modal="true" aria-label="资料加工任务详情">
      <header>
        <div><h2>{{ task?.name || '任务详情' }}</h2><p>{{ task?.id || '正在读取任务信息' }}</p></div>
        <button class="icon-button" title="关闭任务详情" aria-label="关闭任务详情" @click="$emit('close')"><X :size="17" /></button>
      </header>
      <div v-if="loading || !task" class="empty">正在读取任务详情...</div>
      <div v-else class="task-drawer-content">
        <section><h3>加工进度</h3><ProcessSummary :summary="task.processSummary" /></section>
        <section><h3>来源与归属</h3><dl><dt>素材来源</dt><dd>{{ task.sourceSummary.typeLabel }} · {{ task.sourceSummary.name }}</dd><dt>归属空间</dt><dd>{{ task.ownershipSummary.name }}</dd><dt>来源完整性</dt><dd>{{ task.sourceSnapshot.completeness }}</dd></dl></section>
        <section><h3>资料与质量</h3><div class="drawer-metrics"><span><strong>{{ task.materialSummary.pages }}</strong>页面</span><span><strong>{{ task.materialSummary.attachments }}</strong>附件</span><span><strong>{{ task.materialSummary.documents ?? '-' }}</strong>有效文档</span><span><strong>{{ task.materialSummary.chunks ?? '-' }}</strong>知识分块</span></div><QualitySummary :summary="task.qualitySummary" /></section>
        <section><h3>最近动态</h3><p class="drawer-activity">{{ task.latestActivity.message }}<time>{{ new Date(task.latestActivity.at).toLocaleString() }}</time></p></section>
      </div>
      <footer v-if="task"><router-link class="button" :to="task.recommendedAction.route">{{ task.recommendedAction.label }}</router-link></footer>
    </aside>
  </div>
</template>
