<script setup>
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle, CloudDownload, Upload } from 'lucide-vue-next'
import { request } from '../api'
import { PROCESS_STATES } from '../material-ui'
import ProcessSummary from '../components/ProcessSummary.vue'
import QualitySummary from '../components/QualitySummary.vue'
import WorkbenchStatBar from '../components/WorkbenchStatBar.vue'

const summary = ref(null)
const error = ref('')
const loading = ref(true)

const stats = computed(() => {
  const counts = summary.value?.counts || {}
  return [
    { key: 'all', label: '全部任务', count: counts.all || 0 },
    ...['pending', 'running', 'review', 'failed', 'publishable'].map(key => ({ key, label: PROCESS_STATES[key].label, count: counts[key] || 0 })),
  ]
})

async function load() {
  loading.value = true
  error.value = ''
  try { summary.value = await request('/api/workbench/summary') }
  catch (reason) { error.value = reason.message }
  finally { loading.value = false }
}

function statusRoute(key) {
  return key === 'all' ? '/batches' : `/batches?workbenchState=${key}`
}

onMounted(load)
</script>

<template>
  <section class="workbench-page">
    <div class="page-header">
      <div><h1>工作台</h1><p class="muted">查看资料接入、加工、人工复核和数据集发布状态。</p></div>
      <div class="actions"><router-link class="button" to="/upload"><Upload :size="16" />本地上传</router-link><router-link class="button secondary" to="/spaces"><CloudDownload :size="16" />PingCode 接入</router-link></div>
    </div>
    <div v-if="error" class="error"><span>{{ error }}</span><button class="text-button" @click="load">重新加载</button></div>
    <WorkbenchStatBar :items="stats" active="all" @select="key => $router.push(statusRoute(key))" />
    <div class="workbench-grid">
      <section class="workbench-main-band">
        <header><div><h2>最近资料加工任务</h2><p>优先展示最近更新的任务及下一步操作。</p></div><router-link to="/batches">查看全部</router-link></header>
        <div v-if="loading" class="empty">正在读取工作台...</div>
        <div v-else-if="!summary?.recentTasks?.length" class="empty">还没有资料加工任务。</div>
        <table v-else class="table workbench-table"><thead><tr><th>任务</th><th>来源与归属</th><th>加工进度</th><th>质量</th><th></th></tr></thead><tbody><tr v-for="task in summary.recentTasks" :key="task.id"><td><strong>{{ task.name }}</strong><small>{{ task.id }}</small></td><td><strong>{{ task.sourceSummary.typeLabel }}</strong><small>{{ task.sourceSummary.name }} → {{ task.ownershipSummary.name }}</small></td><td><ProcessSummary :summary="task.processSummary" compact /></td><td><QualitySummary :summary="task.qualitySummary" /></td><td><router-link class="button small secondary" :to="task.recommendedAction.route">{{ task.recommendedAction.label }}</router-link></td></tr></tbody></table>
      </section>
      <aside class="workbench-side-band">
        <header><h2>运行中的执行任务</h2><span>{{ summary?.activeTasks?.length || 0 }}</span></header>
        <div v-if="!loading && !summary?.activeTasks?.length" class="empty compact">当前没有运行中的执行任务。</div>
        <router-link v-for="task in summary?.activeTasks || []" :key="task.id" class="active-task-row" :to="task.type === 'download' ? `/batches/${task.batchId}/download` : `/batches/${task.batchId}/preprocess`"><span class="status-dot success"></span><div><strong>{{ task.stage || task.type }}</strong><small>{{ task.batchId }} · {{ task.completed }}/{{ task.total ?? '?' }}</small></div></router-link>
        <div class="workbench-notice"><AlertTriangle :size="16" /><span>异常和待复核项应优先处理，工作台不会伪造缺失的质量指标。</span></div>
      </aside>
    </div>
  </section>
</template>
