<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { AlertTriangle, GitCompareArrows, Search } from 'lucide-vue-next'
import { request } from '../api'
import PaginationControls from './PaginationControls.vue'

const props = defineProps({
  leftVersionId: { type: String, default: '' },
  rightVersionId: { type: String, default: '' },
})
const emit = defineEmits(['explore-node'])

const data = ref(null)
const loading = ref(false)
const error = ref('')
const changeType = ref('all')
const queryInput = ref('')
const query = ref('')
const page = ref(1)
const pageSize = ref(20)
let searchTimer = null
let requestSequence = 0

const canCompare = computed(() => props.leftVersionId && props.rightVersionId && props.leftVersionId !== props.rightVersionId)
const changeLabels = { added: '新增', removed: '删除', changed: '属性变化' }
const entityLabels = { node: '节点', edge: '关系' }
const metricLabels = {
  relationCoverage: '关系覆盖率', evidenceCompleteness: '证据完整率', isolatedKnowledgeRatio: '孤立知识比例',
  whyMissingRate: 'Why 知识缺失率', crossDocumentRelationCount: '跨文档关系数',
}

function entityName(item) {
  const value = item.after || item.before || {}
  return value.displayName || value.name || value.rawName || item.id
}

function formatMetric(value) {
  if (value === null || value === undefined) return '-'
  return typeof value === 'number' && Math.abs(value) <= 1 ? `${Math.round(value * 100)}%` : String(value)
}

async function loadDiff() {
  const sequence = ++requestSequence
  if (!canCompare.value) {
    data.value = null
    error.value = ''
    return
  }
  loading.value = true
  error.value = ''
  const params = new URLSearchParams({ changeType: changeType.value, page: String(page.value), pageSize: String(pageSize.value) })
  if (query.value) params.set('query', query.value)
  try {
    const result = await request(`/api/graph/versions/${encodeURIComponent(props.leftVersionId)}/diff/${encodeURIComponent(props.rightVersionId)}?${params}`)
    if (sequence === requestSequence) data.value = result
  } catch (reason) {
    if (sequence === requestSequence) error.value = reason.message
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function scheduleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    query.value = queryInput.value.trim()
    page.value = 1
    loadDiff()
  }, 320)
}

function changePage(event) {
  page.value = event.page
  pageSize.value = event.pageSize
  loadDiff()
}

function explore(item) {
  if (item.entityType !== 'node') return
  emit('explore-node', { versionId: props.rightVersionId, nodeId: item.id })
}

watch(() => [props.leftVersionId, props.rightVersionId], () => { page.value = 1; loadDiff() }, { immediate: true })
watch(changeType, () => { page.value = 1; loadDiff() })
onBeforeUnmount(() => clearTimeout(searchTimer))
</script>

<template>
  <section class="version-diff panel-band" aria-labelledby="version-diff-title">
    <header class="band-header">
      <div><h2 id="version-diff-title">双版本差异</h2><p>节点和关系只按稳定 ID 比较，不按显示名称合并。</p></div>
      <GitCompareArrows :size="20" />
    </header>

    <div v-if="!canCompare" class="component-state">请在版本历史中选择两个不同的正式版本。</div>
    <template v-else>
      <div class="diff-toolbar">
        <label>变化类型
          <select v-model="changeType"><option value="all">全部变化</option><option value="added">新增</option><option value="removed">删除</option><option value="changed">属性变化</option></select>
        </label>
        <label class="search-field"><Search :size="15" /><input v-model="queryInput" type="search" placeholder="搜索全部差异明细" @input="scheduleSearch" /></label>
      </div>
      <div v-if="error" class="error-state" role="alert">{{ error }} <button type="button" @click="loadDiff">重试</button></div>
      <div v-else-if="loading" class="component-state">正在计算版本差异...</div>
      <template v-else-if="data">
        <div class="summary-grid" aria-label="差异汇总">
          <article><span>全部变化</span><strong>{{ data.summary?.total ?? 0 }}</strong></article>
          <article><span>节点</span><strong>{{ data.summary?.nodes?.total ?? 0 }}</strong><small>+{{ data.summary?.nodes?.added ?? 0 }} / -{{ data.summary?.nodes?.removed ?? 0 }} / 变更 {{ data.summary?.nodes?.changed ?? 0 }}</small></article>
          <article><span>关系</span><strong>{{ data.summary?.edges?.total ?? 0 }}</strong><small>+{{ data.summary?.edges?.added ?? 0 }} / -{{ data.summary?.edges?.removed ?? 0 }} / 变更 {{ data.summary?.edges?.changed ?? 0 }}</small></article>
        </div>
        <div v-if="data.rulesChange?.changed" class="rules-warning" role="alert"><AlertTriangle :size="16" /><span>规则版本已变化：{{ data.rulesChange.before || '-' }} → {{ data.rulesChange.after || '-' }}，质量指标不可直接视为同口径连续变化。</span></div>
        <div v-if="data.healthChanges?.length" class="metric-changes">
          <strong>健康指标变化</strong>
          <span v-for="item in data.healthChanges" :key="item.metric">{{ metricLabels[item.metric] || item.metric }}：{{ formatMetric(item.before) }} → {{ formatMetric(item.after) }}</span>
        </div>
        <div class="diff-list">
          <article v-for="item in data.items" :key="`${item.entityType}-${item.changeType}-${item.id}`">
            <div class="change-meta"><span :class="['change-tag', item.changeType]">{{ changeLabels[item.changeType] || item.changeType }}</span><span>{{ entityLabels[item.entityType] || item.entityType }}</span></div>
            <div class="change-main"><strong>{{ entityName(item) }}</strong><small :title="item.id">稳定 ID：{{ item.id }}</small></div>
            <button v-if="item.entityType === 'node'" class="text-button" type="button" @click="explore(item)">在目标版本查看</button>
          </article>
          <div v-if="!data.items?.length" class="component-state compact">当前条件下没有差异。</div>
        </div>
        <PaginationControls :page="page" :page-size="pageSize" :total="data.total || 0" @change="changePage" />
      </template>
    </template>
  </section>
</template>

<style scoped>
.panel-band { min-width: 0; overflow: hidden; border: 1px solid #dce4ef; border-radius: 8px; background: #fff; }
.band-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px 18px; border-bottom: 1px solid #e5eaf1; }
.band-header h2 { margin: 0; font-size: 16px; }
.band-header p { margin: 5px 0 0; color: #6d7b90; font-size: 12px; }
.band-header svg { color: #526174; }
.diff-toolbar { display: flex; align-items: end; gap: 12px; padding: 12px 18px; background: #f8fafc; border-bottom: 1px solid #e5eaf1; }
.diff-toolbar > label:not(.search-field) { display: grid; gap: 5px; color: #637086; font-size: 12px; }
.diff-toolbar select, .search-field { min-height: 36px; border: 1px solid #ccd6e3; border-radius: 6px; background: #fff; }
.diff-toolbar select { padding: 7px 30px 7px 9px; }
.search-field { display: flex; flex: 1; align-items: center; gap: 7px; padding: 0 10px; color: #748196; }
.search-field input { min-width: 0; width: 100%; border: 0; outline: 0; }
.summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 14px 18px; }
.summary-grid article { display: grid; gap: 3px; padding: 11px; border: 1px solid #e1e7ef; border-radius: 6px; background: #fafbfd; }
.summary-grid span, .summary-grid small { color: #6d7b90; font-size: 11px; }
.summary-grid strong { color: #20344d; font-size: 20px; }
.rules-warning { display: flex; align-items: flex-start; gap: 8px; margin: 0 18px 12px; padding: 10px; border: 1px solid #efcf8a; border-radius: 6px; color: #80520b; background: #fff9eb; font-size: 12px; }
.metric-changes { display: flex; flex-wrap: wrap; gap: 7px 12px; margin: 0 18px 12px; padding: 10px; color: #526174; background: #f6f8fb; font-size: 12px; }
.metric-changes strong { color: #26384d; }
.diff-list { border-top: 1px solid #e5eaf1; }
.diff-list article { display: grid; grid-template-columns: 130px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 58px; padding: 9px 18px; border-bottom: 1px solid #edf0f4; }
.change-meta { display: flex; align-items: center; gap: 7px; color: #6d7b90; font-size: 11px; }
.change-tag { padding: 2px 6px; border-radius: 4px; font-weight: 600; }
.change-tag.added { color: #147a43; background: #eaf8ef; }
.change-tag.removed { color: #b42318; background: #fff0ed; }
.change-tag.changed { color: #9b6108; background: #fff4d6; }
.change-main { min-width: 0; }
.change-main strong, .change-main small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.change-main small { margin-top: 4px; color: #7a8799; }
.component-state { padding: 32px 18px; color: #6d7b90; text-align: center; }
.component-state.compact { padding: 20px; }
.error-state { margin: 14px 18px; padding: 11px; color: #a61d24; background: #fff1f0; border: 1px solid #ffa39e; border-radius: 6px; }
.error-state button { float: right; border: 0; color: #a61d24; background: transparent; }
@media (max-width: 700px) {
  .diff-toolbar { align-items: stretch; flex-direction: column; }
  .diff-toolbar > label { width: 100%; }
  .summary-grid { grid-template-columns: 1fr; }
  .diff-list article { grid-template-columns: 1fr; align-items: start; }
  .diff-list .text-button { justify-self: start; }
}
</style>
