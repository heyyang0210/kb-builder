<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useRoute } from 'vue-router'
import { fileUrl, request, taskEventUrl } from '../api'
import PaginationControls from '../components/PaginationControls.vue'
import { createRequestId } from '../utils/ids'

const route = useRoute()
const batch = ref(null)
const task = ref(null)
const files = ref([])
const error = ref('')
const preview = ref(null)
const previewMode = ref('document')
const filePage = ref(1)
const filePageSize = ref(20)
const fileTotal = ref(0)
const diagnosticItems = ref([])
const diagnosticTotal = ref(0)
const diagnosticPage = ref(1)
const diagnosticPageSize = ref(20)
const diagnosticFilter = ref('failed')
let events = null

const percent = computed(() => task.value?.total ? Math.round(task.value.completed / task.value.total * 100) : 0)
const terminal = computed(() => ['completed', 'failed', 'cancelled', 'interrupted'].includes(task.value?.state))
const previewAssetCount = computed(() => new Set(Object.values(preview.value?.assets || {})).size)
const progressDetail = computed(() => task.value?.progressDetail || {})
const stateLabels = {
  queued: '等待中',
  running: '下载中',
  interrupted: '已中断',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
}
const itemStateLabels = {
  failed: '失败',
  warning: '告警',
  completed: '完成',
  pending: '待处理',
}
const filterLabels = {
  failed: '失败项',
  warning: '告警项',
  completed: '完成项',
  pending: '待处理',
}

async function load() {
  error.value = ''
  try {
    batch.value = await request(`/api/material-batches/${route.params.batchId}`)
    const taskList = await request(`/api/download/tasks?batchId=${encodeURIComponent(batch.value.id)}`)
    task.value = taskList.items.find(item => item.batchId === batch.value.id) || null
    await loadFiles()
    await loadDiagnosticItems()
    if (task.value && !terminal.value) subscribe(task.value.id)
  } catch (reason) {
    error.value = reason.message
  }
}

async function loadFiles(page = filePage.value) {
  const result = await request(`/api/material-batches/${route.params.batchId}/files?category=all&page=${page}&pageSize=${filePageSize.value}`)
  files.value = result.items
  filePage.value = result.page
  fileTotal.value = result.total
}

async function changeFilePage({ page, pageSize }) {
  filePageSize.value = pageSize
  closePreview()
  await loadFiles(page)
}

async function startDownload() {
  if (task.value && terminal.value && !window.confirm('将重新全量下载当前批次。已完成文件会按稳定路径覆盖，继续执行吗？')) return
  try {
    task.value = await request('/api/download/tasks', {
      method: 'POST',
      headers: { 'Idempotency-Key': createRequestId() },
      body: JSON.stringify({ batchId: batch.value.id }),
    })
    await loadDiagnosticItems()
    subscribe(task.value.id)
  } catch (reason) {
    error.value = reason.message
  }
}

async function retry() {
  task.value = await request(`/api/download/tasks/${task.value.id}/retry`, { method: 'POST' })
  await loadDiagnosticItems()
  subscribe(task.value.id)
}

async function resume() {
  task.value = await request(`/api/download/tasks/${task.value.id}/resume`, { method: 'POST' })
  await loadDiagnosticItems()
  subscribe(task.value.id)
}

async function loadDiagnosticItems(page = diagnosticPage.value) {
  if (!task.value) {
    diagnosticItems.value = []
    diagnosticTotal.value = 0
    return
  }
  const result = await request(`/api/download/tasks/${encodeURIComponent(task.value.id)}/items?state=${diagnosticFilter.value}&page=${page}&pageSize=${diagnosticPageSize.value}`)
  diagnosticItems.value = result.items
  diagnosticPage.value = result.page
  diagnosticTotal.value = result.total
}

async function setDiagnosticFilter(value) {
  diagnosticFilter.value = value
  await loadDiagnosticItems(1)
}

async function changeDiagnosticPage({ page, pageSize }) {
  diagnosticPageSize.value = pageSize
  await loadDiagnosticItems(page)
}

function assetUrl(source) {
  const assets = preview.value?.assets || {}
  if (assets[source]) return fileUrl(assets[source], 'content')
  try {
    const decoded = decodeURIComponent(source)
    if (assets[decoded]) return fileUrl(assets[decoded], 'content')
  } catch {
    return source
  }
  return source
}

const renderedPreview = computed(() => {
  if (!preview.value) return ''
  const html = marked.parse(preview.value.content, {
    breaks: true,
    gfm: true,
    walkTokens(token) {
      if (token.type === 'image') token.href = assetUrl(token.href)
    },
  })
  const safe = DOMPurify.sanitize(html)
  return safe.replace(/<table>/g, '<div class="table-wrapper"><table>').replace(/<\/table>/g, '</table></div>')
})

async function openPreview(file) {
  const textSuffixes = ['.md', '.txt', '.json', '.html', '.htm']
  if (!textSuffixes.some(suffix => file.name.toLowerCase().endsWith(suffix))) {
    window.open(fileUrl(file.id, 'preview'), '_blank', 'noopener')
    return
  }
  try {
    preview.value = await request(`/api/files/${encodeURIComponent(file.id)}/preview-data`)
    previewMode.value = 'document'
  } catch (reason) {
    error.value = reason.message
  }
}

function closePreview() {
  preview.value = null
}

function onKeydown(event) {
  if (event.key === 'Escape') closePreview()
}

function subscribe(taskId) {
  events?.close()
  events = new EventSource(taskEventUrl(taskId))
  events.addEventListener('task.progress', async event => {
    task.value = JSON.parse(event.data)
    if (['completed', 'failed', 'cancelled'].includes(task.value.state)) {
      events.close()
      await loadFiles(1)
      batch.value = await request(`/api/material-batches/${route.params.batchId}`)
    }
    await loadDiagnosticItems()
  })
  for (const eventName of ['download.item.completed', 'download.item.failed', 'download.item.warning', 'download.task.interrupted']) {
    events.addEventListener(eventName, async () => {
      await loadDiagnosticItems()
    })
  }
  events.onerror = () => { error.value = '实时进度连接中断，浏览器正在自动重连。' }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  load()
})
onBeforeUnmount(() => {
  events?.close()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <section v-if="batch">
    <div class="page-header">
      <div><h1>{{ batch.name }}</h1><p class="muted">{{ batch.source?.displayName || batch.sourceSelection?.spaceKey || '本地上传' }} · {{ batch.id }}</p></div>
      <div class="actions"><button class="button secondary" @click="load">刷新</button></div>
    </div>
    <nav class="tabs">
      <router-link :to="`/batches/${batch.id}/download`">下载文件</router-link>
      <router-link :to="`/batches/${batch.id}/preprocess`">加工任务</router-link>
      <router-link :to="`/batches/${batch.id}/quality`">质量分析</router-link>
    </nav>
    <div v-if="batch.sourceSnapshot.completeness !== 'complete'" class="warning">该任务基于部分来源：{{ batch.sourceSnapshot.incompleteReason }}</div>
    <div v-if="error" class="warning">{{ error }}</div>
    <div class="panel" style="margin-bottom: 16px">
      <div class="page-header">
        <div><h2>资料下载</h2><p class="muted">页面和附件通过服务器安全下载到当前资料加工任务。</p></div>
        <button v-if="!task" class="button" @click="startDownload">开始下载</button>
        <button v-else-if="task.state === 'interrupted' && task.canResume" class="button" @click="resume">继续下载</button>
        <button v-else-if="task.state === 'failed' && task.canRetry" class="button" @click="retry">重试失败任务</button>
        <button v-else-if="terminal" class="button secondary" @click="startDownload">重新全量下载</button>
      </div>
      <template v-if="task">
        <div v-if="task.state === 'interrupted'" class="warning">上次下载因后端重启或进程退出中断，已保留成功页面，可从未完成页面继续。</div>
        <div class="actions" style="align-items: center; margin-bottom: 10px"><span :class="['badge', task.state]">{{ stateLabels[task.state] || task.state }}</span><span>{{ task.stage }}</span><span>{{ task.completed }} / {{ task.total ?? '?' }}</span><span>任务 ID：{{ task.id }}</span></div>
        <div class="progress"><span :style="{ width: `${percent}%` }"></span></div>
        <p v-if="task.message" class="muted" style="margin-top: 10px">{{ task.message }}</p>
        <div class="stats download-stats">
          <div class="stat"><strong>{{ progressDetail.completedPages ?? task.completed }}</strong><span>已完成页面</span></div>
          <div class="stat"><strong>{{ progressDetail.pendingPages ?? '-' }}</strong><span>待处理页面</span></div>
          <div class="stat"><strong>{{ task.failed }}</strong><span>失败页面</span></div>
          <div class="stat"><strong>{{ task.warnings }}</strong><span>下载告警</span></div>
          <div class="stat"><strong>{{ progressDetail.skippedPages ?? 0 }}</strong><span>续传跳过</span></div>
          <div class="stat"><strong>{{ batch.sourceSnapshot.attachmentEstimateState === 'unknown' ? '待确认' : batch.sourceSnapshot.estimatedAttachments }}</strong><span>附件数量</span></div>
        </div>
      </template>
      <div v-else class="empty">任务尚未开始。</div>
    </div>
    <div v-if="task" class="panel" style="margin-bottom: 16px; padding: 0; overflow: hidden">
      <div class="page-header" style="padding: 18px; margin: 0">
        <div><h2>失败与告警</h2><p class="muted">按页面和资源记录下载过程中的失败、告警和续传状态。</p></div>
        <div class="actions">
          <button v-for="(label, value) in filterLabels" :key="value" :class="['button', 'small', diagnosticFilter === value ? '' : 'secondary']" @click="setDiagnosticFilter(value)">{{ label }}</button>
        </div>
      </div>
      <div v-if="!diagnosticItems.length" class="empty compact">当前筛选下暂无记录。</div>
      <table v-else class="table">
        <thead><tr><th>页面</th><th>资源</th><th>状态</th><th>错误或告警</th><th>重试</th><th>更新时间</th></tr></thead>
        <tbody><tr v-for="item in diagnosticItems" :key="`${item.pageId}-${item.assetType}-${item.name || item.updatedAt}`">
          <td>{{ item.pageName || item.pageId }}</td>
          <td>{{ item.name || item.assetType }}</td>
          <td><span :class="['status-tag', item.state === 'failed' ? 'danger' : item.state === 'warning' ? 'warning' : item.state === 'completed' ? 'success' : 'neutral']">{{ itemStateLabels[item.state] || item.state }}</span></td>
          <td>{{ item.message || '-' }}</td>
          <td>{{ item.retryCount || 0 }}</td>
          <td>{{ item.updatedAt || '-' }}</td>
        </tr></tbody>
      </table>
      <PaginationControls v-if="diagnosticTotal" :page="diagnosticPage" :page-size="diagnosticPageSize" :total="diagnosticTotal" @change="changeDiagnosticPage" />
    </div>
    <div class="panel" style="padding: 0; overflow: hidden">
      <div class="page-header" style="padding: 18px; margin: 0"><div><h2>文件清单</h2><p class="muted">已入库 {{ fileTotal }} 个文档与附件，不包含页面图片；下载未完成时该数量不是最终总量。</p></div></div>
      <div v-if="!files.length" class="empty">下载完成后在此查看文件。</div>
      <table v-else class="table">
        <thead><tr><th>文件名</th><th>类型</th><th>大小</th><th>逻辑路径</th><th></th></tr></thead>
        <tbody><tr v-for="file in files" :key="file.id">
          <td>{{ file.name }}</td><td>{{ file.mediaType }}</td><td>{{ Math.ceil(file.size / 1024) }} KB</td><td>{{ file.logicalPath }}</td>
          <td><button v-if="file.previewable" class="text-button" @click="openPreview(file)">预览</button> <a :href="fileUrl(file.id, 'download')">下载</a></td>
        </tr></tbody>
      </table>
      <PaginationControls v-if="fileTotal" :page="filePage" :page-size="filePageSize" :total="fileTotal" @change="changeFilePage" />
    </div>
    <div v-if="preview" class="preview-backdrop" @click.self="closePreview">
      <section class="document-preview" role="dialog" aria-modal="true" :aria-label="`${preview.name} 预览`">
        <header class="document-preview-header">
          <div><h2>{{ preview.name }}</h2><p class="muted">{{ preview.format }} · {{ previewAssetCount }} 个页面资源</p></div>
          <div class="actions">
            <button :class="['button', 'small', previewMode === 'document' ? '' : 'secondary']" @click="previewMode = 'document'">文档预览</button>
            <button :class="['button', 'small', previewMode === 'source' ? '' : 'secondary']" @click="previewMode = 'source'">Markdown 源码</button>
            <button class="icon-button" title="关闭预览" aria-label="关闭预览" @click="closePreview">×</button>
          </div>
        </header>
        <article v-if="previewMode === 'document'" class="markdown-preview" v-html="renderedPreview"></article>
        <pre v-else class="markdown-source">{{ preview.content }}</pre>
      </section>
    </div>
  </section>
  <div v-else class="empty">正在加载资料加工任务...</div>
</template>
