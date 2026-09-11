<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Check,
  ChevronRight,
  CircleHelp,
  CloudDownload,
  Copy,
  Database,
  GitBranch,
  RefreshCw,
  Search,
  Ticket,
  Upload,
  X,
} from 'lucide-vue-next'
import { request } from '../api'
import PaginationControls from '../components/PaginationControls.vue'
import ProcessSummary from '../components/ProcessSummary.vue'
import QualitySummary from '../components/QualitySummary.vue'
import TaskDetailDrawer from '../components/TaskDetailDrawer.vue'
import WorkbenchStatBar from '../components/WorkbenchStatBar.vue'
import { PROCESS_STATES } from '../material-ui'

const route = useRoute()
const router = useRouter()
const batches = ref([])
const loading = ref(true)
const error = ref('')
const total = ref(0)
const facets = ref({ all: 0, sourceTypes: {}, ownership: {}, failed: 0 })
const page = ref(positiveNumber(route.query.page, 1))
const pageSize = ref([20, 50, 100].includes(Number(route.query.pageSize)) ? Number(route.query.pageSize) : 20)
const sort = ref(['updatedAt:desc', 'updatedAt:asc', 'createdAt:desc', 'name:asc'].includes(route.query.sort) ? route.query.sort : 'updatedAt:desc')
const copiedId = ref('')
const detailTask = ref(null)
const detailLoading = ref(false)
let requestController = null
let filterTimer = null
let initialized = false

const sourceOptions = [
  { value: 'upload', label: '本地上传' },
  { value: 'pingcode', label: 'PingCode' },
  { value: 'ticket', label: '工单' },
  { value: 'repository', label: '代码仓库' },
  { value: 'object_storage', label: '对象存储' },
  { value: 'unknown', label: '来源未知' },
]
const stateOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'staging', label: '暂存中' },
  { value: 'uploaded', label: '已上传' },
  { value: 'downloading', label: '下载中' },
  { value: 'downloaded', label: '已下载' },
  { value: 'processing', label: '加工中' },
  { value: 'ready', label: '就绪' },
  { value: 'failed', label: '失败' },
]
const sourceLabels = Object.fromEntries(sourceOptions.map(item => [item.value, item.label]))
const stateLabels = Object.fromEntries(stateOptions.map(item => [item.value, item.label]))
const ownershipLabels = { all: '全部归属', temporary: '临时区', mapped: '已绑定', unmapped: '未映射' }
const completenessLabels = { all: '全部完整性', complete: '完整', partial: '部分', unknown: '未知' }
const timeLabels = { all: '全部时间', today: '今天', '7d': '最近 7 天', '30d': '最近 30 天', custom: '自定义时间' }

const filters = ref({
  keyword: stringQuery(route.query.keyword),
  sourceTypes: csvQuery(route.query.sourceType),
  states: csvQuery(route.query.state),
  ownership: stringQuery(route.query.ownership) || 'all',
  completeness: stringQuery(route.query.completeness) || 'all',
  timePreset: stringQuery(route.query.time) || 'all',
  updatedFrom: stringQuery(route.query.from),
  updatedTo: stringQuery(route.query.to),
  localSpace: stringQuery(route.query.localSpace),
  pingcodeSpace: stringQuery(route.query.pingcodeSpace),
  hasActiveTask: stringQuery(route.query.hasActiveTask) || 'all',
  published: stringQuery(route.query.published) || 'all',
  workbenchState: stringQuery(route.query.workbenchState),
})

const summaryTabs = computed(() => [
  { key: 'all', label: '全部任务', count: facets.value.all || 0 },
  ...['pending', 'running', 'review', 'failed', 'publishable'].map(key => ({
    key, label: PROCESS_STATES[key].label, count: facets.value.processStates?.[key] || 0,
  })),
])

const activeFilterTags = computed(() => {
  const tags = []
  for (const value of filters.value.sourceTypes) tags.push({ key: `source:${value}`, label: sourceLabels[value] || value })
  for (const value of filters.value.states) tags.push({ key: `state:${value}`, label: stateLabels[value] || value })
  if (filters.value.ownership !== 'all') tags.push({ key: 'ownership', label: ownershipLabels[filters.value.ownership] })
  if (filters.value.completeness !== 'all') tags.push({ key: 'completeness', label: completenessLabels[filters.value.completeness] })
  if (filters.value.timePreset !== 'all') tags.push({ key: 'time', label: timeLabels[filters.value.timePreset] })
  if (filters.value.localSpace) tags.push({ key: 'localSpace', label: `归属：${filters.value.localSpace}` })
  if (filters.value.pingcodeSpace) tags.push({ key: 'pingcodeSpace', label: `PingCode：${filters.value.pingcodeSpace}` })
  if (filters.value.hasActiveTask !== 'all') tags.push({ key: 'activeTask', label: filters.value.hasActiveTask === 'true' ? '有活动任务' : '无活动任务' })
  if (filters.value.published !== 'all') tags.push({ key: 'published', label: filters.value.published === 'true' ? '已发布数据集' : '未发布数据集' })
  if (filters.value.workbenchState) tags.push({ key: 'workbenchState', label: PROCESS_STATES[filters.value.workbenchState]?.label || filters.value.workbenchState })
  return tags
})

const hasFilters = computed(() => Boolean(filters.value.keyword.trim() || activeFilterTags.value.length))

function stringQuery(value) {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}

function csvQuery(value) {
  return stringQuery(value).split(',').map(item => item.trim()).filter(Boolean)
}

function positiveNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function dateRange() {
  if (filters.value.timePreset === 'all') return {}
  if (filters.value.timePreset === 'custom') {
    return {
      updatedFrom: filters.value.updatedFrom ? new Date(`${filters.value.updatedFrom}T00:00:00`).toISOString() : '',
      updatedTo: filters.value.updatedTo ? new Date(`${filters.value.updatedTo}T23:59:59.999`).toISOString() : '',
    }
  }
  const end = new Date()
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (filters.value.timePreset === '7d') start.setDate(start.getDate() - 6)
  if (filters.value.timePreset === '30d') start.setDate(start.getDate() - 29)
  return { updatedFrom: start.toISOString(), updatedTo: end.toISOString() }
}

function apiQuery() {
  const query = new URLSearchParams({
    page: String(page.value),
    pageSize: String(pageSize.value),
    sort: sort.value,
  })
  if (filters.value.keyword.trim()) query.set('keyword', filters.value.keyword.trim())
  if (filters.value.sourceTypes.length) query.set('sourceType', filters.value.sourceTypes.join(','))
  if (filters.value.states.length) query.set('state', filters.value.states.join(','))
  if (filters.value.ownership !== 'all') query.set('ownership', filters.value.ownership)
  if (filters.value.completeness !== 'all') query.set('completeness', filters.value.completeness)
  if (filters.value.localSpace.trim()) query.set('localSpace', filters.value.localSpace.trim())
  if (filters.value.pingcodeSpace.trim()) query.set('pingcodeSpace', filters.value.pingcodeSpace.trim())
  if (filters.value.hasActiveTask !== 'all') query.set('hasActiveTask', filters.value.hasActiveTask)
  if (filters.value.published !== 'all') query.set('published', filters.value.published)
  if (filters.value.workbenchState) query.set('workbenchState', filters.value.workbenchState)
  const range = dateRange()
  if (range.updatedFrom) query.set('updatedFrom', range.updatedFrom)
  if (range.updatedTo) query.set('updatedTo', range.updatedTo)
  return query
}

function routeQuery() {
  const query = {}
  if (filters.value.keyword.trim()) query.keyword = filters.value.keyword.trim()
  if (filters.value.sourceTypes.length) query.sourceType = filters.value.sourceTypes.join(',')
  if (filters.value.states.length) query.state = filters.value.states.join(',')
  if (filters.value.ownership !== 'all') query.ownership = filters.value.ownership
  if (filters.value.completeness !== 'all') query.completeness = filters.value.completeness
  if (filters.value.timePreset !== 'all') query.time = filters.value.timePreset
  if (filters.value.timePreset === 'custom' && filters.value.updatedFrom) query.from = filters.value.updatedFrom
  if (filters.value.timePreset === 'custom' && filters.value.updatedTo) query.to = filters.value.updatedTo
  if (filters.value.localSpace.trim()) query.localSpace = filters.value.localSpace.trim()
  if (filters.value.pingcodeSpace.trim()) query.pingcodeSpace = filters.value.pingcodeSpace.trim()
  if (filters.value.hasActiveTask !== 'all') query.hasActiveTask = filters.value.hasActiveTask
  if (filters.value.published !== 'all') query.published = filters.value.published
  if (filters.value.workbenchState) query.workbenchState = filters.value.workbenchState
  if (page.value !== 1) query.page = String(page.value)
  if (pageSize.value !== 20) query.pageSize = String(pageSize.value)
  if (sort.value !== 'updatedAt:desc') query.sort = sort.value
  return query
}

function syncRoute() {
  router.replace({ query: routeQuery() })
}

async function load() {
  requestController?.abort()
  const controller = new AbortController()
  requestController = controller
  loading.value = true
  error.value = ''
  try {
    const result = await request(`/api/material-batches?${apiQuery().toString()}`, { signal: controller.signal })
    batches.value = result.items
    total.value = result.total
    facets.value = result.facets || facets.value
  } catch (reason) {
    if (reason.name !== 'AbortError') error.value = reason.message
  } finally {
    if (requestController === controller) loading.value = false
  }
}

function scheduleLoad() {
  if (!initialized) return
  page.value = 1
  syncRoute()
  clearTimeout(filterTimer)
  filterTimer = setTimeout(load, 300)
}

function changePage(event) {
  page.value = event.page
  pageSize.value = event.pageSize
  syncRoute()
  load()
  document.querySelector('.batch-table-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function setQuickFilter(key) {
  filters.value.workbenchState = key === 'all' ? '' : key
}

function removeFilter(key) {
  const [type, value] = key.split(':')
  if (type === 'source') filters.value.sourceTypes = filters.value.sourceTypes.filter(item => item !== value)
  else if (type === 'state') filters.value.states = filters.value.states.filter(item => item !== value)
  else if (key === 'ownership') filters.value.ownership = 'all'
  else if (key === 'completeness') filters.value.completeness = 'all'
  else if (key === 'time') filters.value.timePreset = 'all'
  else if (key === 'localSpace') filters.value.localSpace = ''
  else if (key === 'pingcodeSpace') filters.value.pingcodeSpace = ''
  else if (key === 'activeTask') filters.value.hasActiveTask = 'all'
  else if (key === 'published') filters.value.published = 'all'
  else if (key === 'workbenchState') filters.value.workbenchState = ''
}

function clearFilters() {
  filters.value = {
    keyword: '', sourceTypes: [], states: [], ownership: 'all', completeness: 'all',
    timePreset: 'all', updatedFrom: '', updatedTo: '', localSpace: '', pingcodeSpace: '',
    hasActiveTask: 'all', published: 'all', workbenchState: '',
  }
}

async function openDetail(batch) {
  detailTask.value = batch
  detailLoading.value = true
  try {
    detailTask.value = await request(`/api/material-batches/${batch.id}/workbench-summary`)
  } catch (reason) {
    error.value = reason.message
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  detailTask.value = null
}

function sourceIcon(type) {
  return { upload: Upload, pingcode: CloudDownload, ticket: Ticket, repository: GitBranch, object_storage: Database }[type] || CircleHelp
}

function sourceMenuLabel() {
  if (!filters.value.sourceTypes.length) return '全部来源'
  if (filters.value.sourceTypes.length === 1) return sourceLabels[filters.value.sourceTypes[0]]
  return `来源 ${filters.value.sourceTypes.length} 项`
}

function stateMenuLabel() {
  if (!filters.value.states.length) return '全部状态'
  if (filters.value.states.length === 1) return stateLabels[filters.value.states[0]]
  return `状态 ${filters.value.states.length} 项`
}

function completenessText(batch) {
  return completenessLabels[batch.sourceSnapshot.completeness] || '未知'
}

function formatDate(value) {
  const date = new Date(value)
  const now = new Date()
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function copyBatchId(id) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(id)
    else {
      const input = document.createElement('textarea')
      input.value = id
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    copiedId.value = id
    setTimeout(() => { if (copiedId.value === id) copiedId.value = '' }, 1500)
  } catch {
    copiedId.value = ''
  }
}

watch(filters, scheduleLoad, { deep: true })
watch(sort, () => {
  if (!initialized) return
  page.value = 1
  syncRoute()
  load()
})

onMounted(() => {
  initialized = true
  load()
})

onBeforeUnmount(() => {
  requestController?.abort()
  clearTimeout(filterTimer)
})
</script>

<template>
  <section class="batches-page">
    <div class="page-header batch-page-header">
      <div><h1>资料加工任务</h1><p class="muted">统一查看资料接入、加工、复核和发布进度。</p></div>
      <div class="actions">
        <router-link class="button" to="/upload"><Upload :size="16" />本地上传</router-link>
        <router-link class="button secondary" to="/spaces"><CloudDownload :size="16" />PingCode 下载</router-link>
        <button class="icon-button refresh-button" :disabled="loading" title="刷新任务" aria-label="刷新任务" @click="load">
          <RefreshCw :size="16" :class="{ spinning: loading }" />
        </button>
      </div>
    </div>

    <WorkbenchStatBar :items="summaryTabs" :active="filters.workbenchState || 'all'" @select="setQuickFilter" />

    <section class="batch-filter-panel" aria-label="资料加工任务筛选">
      <div class="filter-primary-row">
        <label class="batch-search">
          <Search :size="16" />
          <input v-model="filters.keyword" placeholder="搜索任务名称、ID 或来源名称" aria-label="搜索资料加工任务" />
          <button v-if="filters.keyword" type="button" title="清除搜索" aria-label="清除搜索" @click="filters.keyword = ''"><X :size="15" /></button>
        </label>

        <details class="filter-menu">
          <summary>{{ sourceMenuLabel() }}</summary>
          <div class="filter-menu-content">
            <label v-for="option in sourceOptions" :key="option.value">
              <input v-model="filters.sourceTypes" type="checkbox" :value="option.value" />
              <span>{{ option.label }}</span>
              <small>{{ facets.sourceTypes?.[option.value] || 0 }}</small>
            </label>
          </div>
        </details>

        <details class="filter-menu">
          <summary>{{ stateMenuLabel() }}</summary>
          <div class="filter-menu-content state-options">
            <label v-for="option in stateOptions" :key="option.value">
              <input v-model="filters.states" type="checkbox" :value="option.value" />
              <span>{{ option.label }}</span>
            </label>
          </div>
        </details>

        <select v-model="filters.ownership" aria-label="归属状态">
          <option v-for="(label, value) in ownershipLabels" :key="value" :value="value">{{ label }}</option>
        </select>
      </div>

      <div class="filter-secondary-row">
        <select v-model="filters.completeness" aria-label="来源完整性">
          <option v-for="(label, value) in completenessLabels" :key="value" :value="value">{{ label }}</option>
        </select>
        <select v-model="filters.timePreset" aria-label="更新时间">
          <option v-for="(label, value) in timeLabels" :key="value" :value="value">{{ label }}</option>
        </select>
        <template v-if="filters.timePreset === 'custom'">
          <input v-model="filters.updatedFrom" type="date" aria-label="更新时间开始日期" />
          <span class="date-separator">至</span>
          <input v-model="filters.updatedTo" type="date" aria-label="更新时间结束日期" />
        </template>
        <details class="more-filter-menu">
          <summary>更多筛选</summary>
          <div class="more-filter-content">
            <label><span>归属空间</span><input v-model="filters.localSpace" placeholder="名称或逻辑路径" /></label>
            <label><span>PingCode 空间</span><input v-model="filters.pingcodeSpace" placeholder="名称或空间 Key" /></label>
            <label><span>活动任务</span><select v-model="filters.hasActiveTask"><option value="all">全部</option><option value="true">有活动任务</option><option value="false">无活动任务</option></select></label>
            <label><span>数据集发布</span><select v-model="filters.published"><option value="all">全部</option><option value="true">已发布</option><option value="false">未发布</option></select></label>
          </div>
        </details>
        <span class="filter-count">已启用 {{ activeFilterTags.length }} 项</span>
        <button class="text-button clear-filter" :disabled="!hasFilters" @click="clearFilters">清空筛选</button>
        <select v-model="sort" class="sort-select" aria-label="排序方式">
          <option value="updatedAt:desc">最近更新</option>
          <option value="updatedAt:asc">最早更新</option>
          <option value="createdAt:desc">最近创建</option>
          <option value="name:asc">名称升序</option>
        </select>
      </div>

      <div v-if="activeFilterTags.length" class="active-filter-tags" aria-label="当前筛选条件">
        <span>筛选条件</span>
        <button v-for="tag in activeFilterTags" :key="tag.key" @click="removeFilter(tag.key)">{{ tag.label }}<X :size="13" /></button>
      </div>
    </section>

    <div v-if="error" class="error batch-error"><span>{{ error }}</span><button class="text-button" @click="load">重新加载</button></div>

    <div class="panel batch-table-panel">
      <div class="table-scroll">
        <table class="table batch-table">
          <thead><tr><th>资料加工任务</th><th>素材来源</th><th>归属空间</th><th>加工进度</th><th>资料与质量</th><th>更新时间</th><th>下一步</th></tr></thead>
          <tbody v-if="loading">
            <tr v-for="index in 8" :key="index" class="skeleton-row"><td v-for="cell in 7" :key="cell"><span></span></td></tr>
          </tbody>
          <tbody v-else>
            <tr v-for="batch in batches" :key="batch.id" class="task-table-row" tabindex="0" @click="openDetail(batch)" @keydown.enter="openDetail(batch)">
              <td class="batch-name-cell">
                <strong :title="batch.name">{{ batch.name }}</strong>
                <div class="cell-secondary batch-id"><span>{{ batch.id }}</span><button :title="copiedId === batch.id ? '已复制' : '复制任务 ID'" :aria-label="`复制任务 ${batch.name} 的 ID`" @click.stop="copyBatchId(batch.id)"><Check v-if="copiedId === batch.id" :size="13" /><Copy v-else :size="13" /></button></div>
              </td>
              <td class="source-cell">
                <span :class="['source-badge', `source-${batch.sourceSummary.type}`]"><component :is="sourceIcon(batch.sourceSummary.type)" :size="13" />{{ batch.sourceSummary.typeLabel }}</span>
                <strong :title="batch.sourceSummary.name">{{ batch.sourceSummary.name }}</strong>
                <div class="cell-secondary" :title="batch.sourceSummary.sourceId">{{ batch.sourceSummary.sourceId }}<span v-if="batch.sourceSummary.legacy" class="legacy-mark">历史数据</span></div>
              </td>
              <td class="ownership-cell">
                <strong>{{ batch.ownershipSummary.name }}</strong>
                <div class="cell-secondary">{{ batch.ownershipSummary.logicalPath || (batch.ownershipSummary.type === 'temporary' ? '暂存区，尚未绑定正式空间' : '历史任务') }}</div>
              </td>
              <td><ProcessSummary :summary="batch.processSummary" compact /></td>
              <td class="material-quality-cell">
                <strong>{{ batch.materialSummary.pages }} 页面 · {{ batch.materialSummary.attachments }} 附件</strong>
                <div class="cell-secondary">{{ batch.materialSummary.documents ?? '-' }} 有效文档 · {{ batch.materialSummary.chunks ?? '-' }} 知识分块</div>
                <QualitySummary :summary="batch.qualitySummary" />
              </td>
              <td class="date-cell" :title="new Date(batch.updatedAt).toLocaleString()">{{ formatDate(batch.updatedAt) }}</td>
              <td class="action-cell"><router-link :to="batch.recommendedAction.route" :aria-label="`${batch.recommendedAction.label}：${batch.name}`" @click.stop>{{ batch.recommendedAction.label }}<ChevronRight :size="15" /></router-link><button class="text-button" @click.stop="openDetail(batch)">详情</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!loading && !batches.length" class="empty batch-empty">
        <template v-if="facets.all === 0">
          <strong>还没有资料加工任务</strong><p>可以上传本地资料，或从 PingCode 接入资料并创建任务。</p>
          <div class="actions"><router-link class="button" to="/upload">本地上传</router-link><router-link class="button secondary" to="/spaces">PingCode 下载</router-link></div>
        </template>
        <template v-else>
          <strong>没有符合当前条件的任务</strong><p>调整筛选条件或清空筛选后重试。</p><button class="button secondary" @click="clearFilters">清空筛选</button>
        </template>
      </div>

      <PaginationControls v-if="!loading && total > 0" :page="page" :page-size="pageSize" :total="total" @change="changePage" />
    </div>
    <TaskDetailDrawer v-if="detailTask" :task="detailTask" :loading="detailLoading" @close="closeDetail" />
  </section>
</template>

<style scoped>
.batches-page { min-width: 0; }
.batch-page-header .actions { align-items: center; }
.batch-page-header .button { display: inline-flex; align-items: center; gap: 7px; text-decoration: none; }
.refresh-button { display: grid; place-items: center; }
.spinning { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.batch-filter-panel { margin-bottom: 14px; border: 1px solid #dce4ef; border-radius: 8px; background: white; }
.filter-primary-row, .filter-secondary-row { display: flex; align-items: center; gap: 9px; padding: 11px 13px; }
.filter-primary-row { border-bottom: 1px solid #e6ebf2; }
.filter-primary-row > select, .filter-secondary-row > select, .filter-secondary-row > input { height: 36px; padding: 0 30px 0 10px; border: 1px solid #ccd6e3; border-radius: 6px; color: #44536a; background: white; }
.batch-search { display: flex; align-items: center; flex: 1 1 360px; min-width: 280px; height: 36px; padding: 0 9px; border: 1px solid #b8c5d6; border-radius: 6px; color: #76859a; background: white; }
.batch-search:focus-within { border-color: #175cd3; box-shadow: 0 0 0 2px rgba(23, 92, 211, .12); }
.batch-search input { min-width: 0; flex: 1; height: 100%; padding: 0 8px; border: 0; outline: 0; }
.batch-search button { display: grid; place-items: center; padding: 3px; border: 0; color: #6d7b90; background: transparent; }

.filter-menu, .more-filter-menu { position: relative; }
.filter-menu summary, .more-filter-menu summary { display: flex; align-items: center; justify-content: space-between; min-width: 132px; height: 36px; padding: 0 30px 0 11px; border: 1px solid #ccd6e3; border-radius: 6px; color: #44536a; background: white; list-style: none; cursor: pointer; }
.filter-menu summary::after, .more-filter-menu summary::after { position: absolute; right: 11px; content: '▾'; color: #7a879a; }
.filter-menu summary::-webkit-details-marker, .more-filter-menu summary::-webkit-details-marker { display: none; }
.filter-menu[open] summary, .more-filter-menu[open] summary { border-color: #175cd3; }
.filter-menu-content, .more-filter-content { position: absolute; z-index: 5; top: 42px; left: 0; min-width: 220px; padding: 7px; border: 1px solid #cbd6e3; border-radius: 7px; background: white; box-shadow: 0 10px 24px rgba(16, 36, 64, .16); }
.filter-menu-content label { display: grid; grid-template-columns: 18px 1fr auto; align-items: center; gap: 7px; min-height: 34px; padding: 5px 7px; border-radius: 5px; color: #44536a; font-size: 13px; }
.filter-menu-content label:hover { background: #f4f7fb; }
.filter-menu-content small { color: #8794a6; }
.state-options { display: grid; grid-template-columns: 1fr 1fr; min-width: 300px; }
.more-filter-menu { margin-left: 2px; }
.more-filter-content { display: grid; grid-template-columns: 1fr 1fr; left: auto; right: 0; width: 480px; padding: 14px; gap: 12px; }
.more-filter-content label { display: grid; gap: 5px; color: #56657b; font-size: 12px; }
.more-filter-content input, .more-filter-content select { width: 100%; height: 34px; padding: 0 9px; border: 1px solid #ccd6e3; border-radius: 5px; background: white; }
.date-separator, .filter-count { color: #7a879a; font-size: 12px; }
.filter-count { margin-left: auto; white-space: nowrap; }
.clear-filter:disabled { color: #9aa5b4; cursor: not-allowed; text-decoration: none; }
.sort-select { margin-left: 4px; }
.active-filter-tags { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; min-height: 42px; padding: 8px 13px; border-top: 1px solid #e6ebf2; color: #6d7b90; font-size: 12px; }
.active-filter-tags button { display: inline-flex; align-items: center; gap: 5px; padding: 4px 7px; border: 1px solid #c9d7e8; border-radius: 5px; color: #35506f; background: #f3f7fc; }

.batch-error { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.batch-table-panel { padding: 0; overflow: hidden; border-radius: 8px; box-shadow: none; }
.table-scroll { overflow-x: hidden; }
.batch-table { width: 100%; table-layout: fixed; }
.batch-table th:nth-child(1) { width: 17%; }
.batch-table th:nth-child(2) { width: 17%; }
.batch-table th:nth-child(3) { width: 15%; }
.batch-table th:nth-child(4) { width: 16%; }
.batch-table th:nth-child(5) { width: 18%; }
.batch-table th:nth-child(6) { width: 9%; }
.batch-table th:nth-child(7) { width: 8%; }
.batch-table td { height: 88px; vertical-align: middle; }
.task-table-row { cursor: pointer; }
.task-table-row:hover, .task-table-row:focus { outline: 0; background: #fafcff; }
.batch-name-cell > strong, .source-cell > strong, .ownership-cell > strong { display: block; overflow: hidden; margin-bottom: 5px; text-overflow: ellipsis; white-space: nowrap; }
.cell-secondary { overflow: hidden; color: #7a879a; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.batch-id { display: flex; align-items: center; gap: 5px; }
.batch-id button { display: grid; flex: 0 0 22px; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 4px; color: #6d7b90; background: transparent; }
.batch-id button:hover { color: #175cd3; background: #edf4ff; }
.source-badge { display: inline-flex; align-items: center; gap: 5px; min-height: 22px; margin-bottom: 5px; padding: 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.source-upload { color: #475467; background: #eef1f5; }
.source-pingcode { color: #175cd3; background: #eaf2ff; }
.source-ticket { color: #8a4d08; background: #fff4d6; }
.source-repository { color: #147a43; background: #eaf8ef; }
.source-object_storage { color: #087a72; background: #e7f8f6; }
.source-unknown { color: #a61d24; background: #fff1f0; }
.legacy-mark { margin-left: 6px; color: #9b6a14; }
.material-quality-cell > strong { display: block; margin-bottom: 5px; color: #29445f; font-size: 12px; }
.completeness { display: inline-flex; align-items: center; gap: 5px; }
.completeness::before { width: 7px; height: 7px; border-radius: 50%; content: ''; background: #98a2b3; }
.completeness.complete::before { background: #2e9d5b; }
.completeness.partial::before { background: #d99a2b; }
.batch-state { font-weight: 500; }
.badge.uploaded, .badge.staging { color: #475467; background: #eef1f5; }
.badge.downloading, .badge.processing, .badge.running { color: #175cd3; background: #eaf2ff; }
.badge.ready, .badge.completed, .badge.downloaded { color: #147a43; background: #eaf8ef; }
.date-cell { color: #56657b; }
.action-cell { display: grid; justify-items: start; gap: 8px; }
.action-cell a { display: inline-flex; align-items: center; gap: 2px; color: #175cd3; text-decoration: none; white-space: nowrap; }
.action-cell a:hover { text-decoration: underline; }
.skeleton-row td span { display: block; width: 78%; height: 12px; border-radius: 4px; background: linear-gradient(90deg, #edf1f5 25%, #f7f9fb 50%, #edf1f5 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }
.batch-empty { display: grid; justify-items: center; gap: 8px; min-height: 260px; align-content: center; }
.batch-empty strong { color: #344054; font-size: 15px; }
.batch-empty p { margin: 0 0 8px; }
.batch-empty .actions { justify-content: center; }
.batch-empty .actions a { text-decoration: none; }

@media (max-width: 1279px) {
  .filter-primary-row, .filter-secondary-row { flex-wrap: wrap; }
  .filter-count { margin-left: 0; }
  .sort-select { margin-left: auto; }
  .batch-table th:nth-child(2), .batch-table td:nth-child(2) { display: none; }
  .batch-table th:nth-child(1) { width: 20%; }
  .batch-table th:nth-child(3) { width: 17%; }
  .batch-table th:nth-child(4) { width: 20%; }
  .batch-table th:nth-child(5) { width: 23%; }
  .batch-table th:nth-child(6) { width: 10%; }
  .batch-table th:nth-child(7) { width: 10%; }
}
</style>
