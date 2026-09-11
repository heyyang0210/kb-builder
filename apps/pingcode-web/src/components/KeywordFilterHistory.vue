<script setup>
import { computed, ref, watch } from 'vue'
import { request } from '../api'

const props = defineProps({
  datasetId: { type: String, required: true },
  activeRunId: { type: String, default: '' },
  refreshKey: { type: Number, default: 0 },
})

const emit = defineEmits(['select-run', 'restore-run'])

const statusLabels = {
  created: '已创建',
  running: '执行中',
  reviewable: '待复核',
  incomplete: '未完成',
  applied: '已应用',
  failed: '失败',
  superseded: '已被替代',
}

const loading = ref(false)
const detailLoading = ref(false)
const diffLoading = ref(false)
const error = ref('')
const runs = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const selectedRunId = ref('')
const detail = ref(null)
const leftRunId = ref('')
const rightRunId = ref('')
const diffResult = ref(null)
const detailPage = ref(1)
const detailPageSize = ref(50)

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const detailDecisions = computed(() => {
  const models = detail.value?.decisions || detail.value?.modelDecisions || detail.value?.items || []
  const reviews = new Map((detail.value?.reviewDecisions || []).map(item => [item.keywordId, item]))
  const finals = new Map((detail.value?.finalDecisions || []).map(item => [item.keywordId, item]))
  return models.map(model => {
    const review = reviews.get(model.keywordId) || {}
    const final = finals.get(model.keywordId) || {}
    return {
      ...model,
      reviewAction: review.action || review.finalAction,
      reviewIssueCategory: review.issueCategory || review.finalIssueCategory,
      reviewIssueCategoryLabel: review.issueCategoryLabel || review.finalIssueCategoryLabel,
      reviewReason: review.reason || review.note,
      ...final,
      userOverride: Boolean(final.userOverride ?? review.userOverride ?? model.userOverride),
    }
  })
})
const pagedDecisions = computed(() => {
  const start = (detailPage.value - 1) * detailPageSize.value
  return detailDecisions.value.slice(start, start + detailPageSize.value)
})
const detailPageCount = computed(() => Math.max(1, Math.ceil(detailDecisions.value.length / detailPageSize.value)))
const comparableRuns = computed(() => runs.value.filter(item => ['reviewable', 'applied'].includes(item.status)))
const diffItems = computed(() => diffResult.value?.items || diffResult.value?.differences || diffResult.value?.changedItems || [])
const diffSummary = computed(() => {
  const source = diffResult.value?.summary || diffResult.value?.statistics || diffResult.value || {}
  let newlyExcluded = 0
  let restoredKeep = 0
  for (const item of diffItems.value) {
    const before = item.left?.finalAction || item.left?.modelAction || item.leftAction || item.fromAction
    const after = item.right?.finalAction || item.right?.modelAction || item.rightAction || item.toAction
    if (before !== 'exclude' && after === 'exclude') newlyExcluded += 1
    if (before === 'exclude' && after === 'keep') restoredKeep += 1
  }
  return { ...source, newlyExcluded, restoredKeep }
})

function statusLabel(status) {
  return statusLabels[status] || status || '未知'
}

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function shortVersion(value) {
  if (!value) return '未记录'
  return value.length > 18 ? `${value.slice(0, 15)}...` : value
}

function actionLabel(value) {
  if (value === 'exclude') return '排除'
  if (value === 'keep') return '保留'
  return '未决定'
}

function categoryLabel(item, prefix = 'model') {
  const title = prefix === 'final' ? item.finalIssueCategoryLabel : item.modelIssueCategoryLabel
  const value = prefix === 'final' ? item.finalIssueCategory : item.modelIssueCategory
  return title || value || '无'
}

async function loadRuns() {
  if (!props.datasetId) return
  loading.value = true
  error.value = ''
  try {
    const offset = (page.value - 1) * pageSize
    const payload = await request(`/api/datasets/${encodeURIComponent(props.datasetId)}/keyword-filter-runs?offset=${offset}&limit=${pageSize}`)
    runs.value = payload.items || []
    total.value = Number(payload.total || runs.value.length)
    if (!leftRunId.value && comparableRuns.value[0]) leftRunId.value = comparableRuns.value[0].filterRunId
    if (!rightRunId.value && comparableRuns.value[1]) rightRunId.value = comparableRuns.value[1].filterRunId
  } catch (reason) {
    error.value = `加载过滤历史失败：${reason.message}`
  } finally {
    loading.value = false
  }
}

async function selectRun(filterRunId, { notify = true } = {}) {
  if (!filterRunId || !props.datasetId) return
  selectedRunId.value = filterRunId
  detailLoading.value = true
  detailPage.value = 1
  error.value = ''
  try {
    detail.value = await request(`/api/datasets/${encodeURIComponent(props.datasetId)}/keyword-filter-runs/${encodeURIComponent(filterRunId)}`)
    if (notify) emit('select-run', filterRunId)
  } catch (reason) {
    detail.value = null
    error.value = `加载运行详情失败：${reason.message}`
  } finally {
    detailLoading.value = false
  }
}

async function compareRuns() {
  if (!leftRunId.value || !rightRunId.value || leftRunId.value === rightRunId.value) return
  diffLoading.value = true
  error.value = ''
  try {
    diffResult.value = await request(`/api/datasets/${encodeURIComponent(props.datasetId)}/keyword-filter-runs/${encodeURIComponent(leftRunId.value)}/diff/${encodeURIComponent(rightRunId.value)}`)
  } catch (reason) {
    diffResult.value = null
    error.value = `对比运行失败：${reason.message}`
  } finally {
    diffLoading.value = false
  }
}

function diffSide(item, side, field) {
  const value = item?.[side]
  if (!value) return null
  if (field === 'action') return value.finalAction || value.modelAction
  if (field === 'category') return value.finalIssueCategoryLabel || value.modelIssueCategoryLabel || value.finalIssueCategory || value.modelIssueCategory
  return null
}

function restoreRun() {
  if (detail.value) emit('restore-run', detail.value)
}

function changePage(delta) {
  page.value = Math.min(pageCount.value, Math.max(1, page.value + delta))
  loadRuns()
}

function changeDetailPage(delta) {
  detailPage.value = Math.min(detailPageCount.value, Math.max(1, detailPage.value + delta))
}

watch(() => [props.datasetId, props.refreshKey], () => {
  page.value = 1
  selectedRunId.value = ''
  detail.value = null
  diffResult.value = null
  leftRunId.value = ''
  rightRunId.value = ''
  loadRuns().then(() => {
    if (props.activeRunId) selectRun(props.activeRunId, { notify: false })
  })
}, { immediate: true })

watch(() => props.activeRunId, value => {
  if (value && value !== selectedRunId.value) selectRun(value, { notify: false })
})
</script>

<template>
  <section class="history-shell" aria-label="关键词过滤历史">
    <div v-if="error" class="history-alert" role="alert">{{ error }}</div>

    <div class="history-grid">
      <div class="run-list-panel">
        <header>
          <div><h3>历史运行</h3><p>按创建时间倒序，每页 20 条</p></div>
          <button class="history-button" :disabled="loading" @click="loadRuns">{{ loading ? '加载中' : '刷新' }}</button>
        </header>
        <div v-if="!loading && !runs.length" class="history-empty">暂无过滤运行记录。</div>
        <button
          v-for="run in runs"
          :key="run.filterRunId"
          :class="['run-card', { active: selectedRunId === run.filterRunId }]"
          @click="selectRun(run.filterRunId)"
        >
          <span :class="['status', run.status]">{{ statusLabel(run.status) }}</span>
          <strong>{{ formatTime(run.createdAt) }}</strong>
          <span>候选 {{ run.candidateTotal ?? 0 }} · 决策 {{ run.decisionTotal ?? 0 }} · 排除 {{ run.finalExclude ?? run.suggestedExclude ?? 0 }}</span>
          <small>{{ run.modelName || '模型未记录' }} · 规则 {{ shortVersion(run.rulesVersion) }}</small>
        </button>
        <footer v-if="total" class="history-pagination">
          <button class="history-button" :disabled="page <= 1 || loading" @click="changePage(-1)">上一页</button>
          <span>第 {{ page }} / {{ pageCount }} 页，共 {{ total }} 次</span>
          <button class="history-button" :disabled="page >= pageCount || loading" @click="changePage(1)">下一页</button>
        </footer>
      </div>

      <div class="run-detail-panel">
        <div v-if="detailLoading" class="history-empty">正在加载运行详情...</div>
        <div v-else-if="!detail" class="history-empty">选择一次历史运行查看完整决策。</div>
        <template v-else>
          <header class="detail-heading">
            <div>
              <h3>运行详情</h3>
              <p>{{ detail.filterRunId || selectedRunId }} · {{ statusLabel(detail.status) }} · revision {{ detail.revision ?? '-' }}</p>
            </div>
            <button class="history-button primary" :disabled="!detailDecisions.length" @click="restoreRun">恢复到本次过滤</button>
          </header>
          <dl class="metadata-grid">
            <div><dt>Skill 版本</dt><dd :title="detail.skillVersion">{{ shortVersion(detail.skillVersion) }}</dd></div>
            <div><dt>规则版本</dt><dd :title="detail.rulesVersion">{{ shortVersion(detail.rulesVersion) }}</dd></div>
            <div><dt>图谱版本</dt><dd :title="detail.sourceGraphVersion">{{ shortVersion(detail.sourceGraphVersion) }}</dd></div>
            <div><dt>实际模型</dt><dd>{{ detail.modelProvider || '未记录' }} / {{ detail.modelName || '未记录' }}</dd></div>
          </dl>
          <div class="detail-table-wrap">
            <table class="detail-table">
              <thead><tr><th>关键词</th><th>模型建议</th><th>复核/最终</th><th>问题类别</th><th>理由</th></tr></thead>
              <tbody>
                <tr v-for="item in pagedDecisions" :key="item.keywordId">
                  <td><strong>{{ item.keywordName || item.keywordId }}</strong><small>{{ item.keywordId }}</small></td>
                  <td>{{ actionLabel(item.modelAction || item.suggestedAction) }}</td>
                  <td>{{ actionLabel(item.finalAction || item.reviewAction || item.userAction) }}<small v-if="item.userOverride">已人工调整</small></td>
                  <td>{{ item.finalIssueCategoryLabel || item.reviewIssueCategoryLabel || item.finalIssueCategory || item.reviewIssueCategory || categoryLabel(item) }}</td>
                  <td>{{ item.finalReason || item.reviewReason || item.modelReason || item.reason || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <footer v-if="detailDecisions.length" class="history-pagination">
            <button class="history-button" :disabled="detailPage <= 1" @click="changeDetailPage(-1)">上一页</button>
            <span>第 {{ detailPage }} / {{ detailPageCount }} 页，共 {{ detailDecisions.length }} 条决策</span>
            <select v-model.number="detailPageSize" aria-label="详情每页条数" @change="detailPage = 1"><option :value="50">每页 50 条</option><option :value="100">每页 100 条</option></select>
            <button class="history-button" :disabled="detailPage >= detailPageCount" @click="changeDetailPage(1)">下一页</button>
          </footer>
        </template>
      </div>
    </div>

    <section class="diff-panel">
      <header><div><h3>运行对比</h3><p>选择两次已完整运行，查看动作和类别变化。</p></div></header>
      <div class="diff-controls">
        <select v-model="leftRunId" aria-label="对比基准运行"><option value="">选择基准运行</option><option v-for="run in comparableRuns" :key="`left-${run.filterRunId}`" :value="run.filterRunId">{{ formatTime(run.createdAt) }} · {{ run.filterRunId }}</option></select>
        <span>对比</span>
        <select v-model="rightRunId" aria-label="对比目标运行"><option value="">选择目标运行</option><option v-for="run in comparableRuns" :key="`right-${run.filterRunId}`" :value="run.filterRunId">{{ formatTime(run.createdAt) }} · {{ run.filterRunId }}</option></select>
        <button class="history-button primary" :disabled="diffLoading || !leftRunId || !rightRunId || leftRunId === rightRunId" @click="compareRuns">{{ diffLoading ? '对比中' : '开始对比' }}</button>
      </div>
      <template v-if="diffResult">
        <div class="diff-summary">
          <article><strong>{{ diffSummary.newlyExcluded ?? diffSummary.addedExclude ?? 0 }}</strong><span>新增排除</span></article>
          <article><strong>{{ diffSummary.restoredKeep ?? diffSummary.restoredToKeep ?? 0 }}</strong><span>恢复保留</span></article>
          <article><strong>{{ diffSummary.categoryChanged ?? diffSummary.categoryChanges ?? 0 }}</strong><span>类别变化</span></article>
          <article><strong>{{ diffSummary.unchanged ?? 0 }}</strong><span>未变化</span></article>
        </div>
        <div v-if="diffItems.length" class="diff-items">
          <article v-for="(item, index) in diffItems" :key="item.keywordId || index">
            <strong>{{ item.keywordName || item.keywordId }}</strong>
            <span>{{ actionLabel(diffSide(item, 'left', 'action') || item.leftAction || item.fromAction) }} → {{ actionLabel(diffSide(item, 'right', 'action') || item.rightAction || item.toAction) }}</span>
            <small>{{ diffSide(item, 'left', 'category') || item.leftIssueCategoryLabel || item.fromIssueCategory || '无' }} → {{ diffSide(item, 'right', 'category') || item.rightIssueCategoryLabel || item.toIssueCategory || '无' }}</small>
          </article>
        </div>
      </template>
    </section>
  </section>
</template>

<style scoped>
.history-shell { display: grid; gap: 14px; }
.history-grid { display: grid; grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); gap: 14px; }
.run-list-panel, .run-detail-panel, .diff-panel { min-width: 0; padding: 12px; border: 1px solid #dce3ec; border-radius: 8px; background: #fff; }
header, .history-pagination, .diff-controls { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
h3, p { margin: 0; }
header p { margin-top: 3px; color: #66758a; font-size: 12px; }
.history-button { min-height: 32px; padding: 6px 10px; border: 1px solid #b9c5d3; border-radius: 6px; background: #fff; color: #26384d; cursor: pointer; }
.history-button.primary { border-color: #1769aa; background: #1769aa; color: #fff; }
.history-button:disabled { cursor: not-allowed; opacity: .55; }
.run-card { width: 100%; display: grid; grid-template-columns: auto 1fr; gap: 5px 8px; margin-top: 8px; padding: 10px; border: 1px solid #dce3ec; border-radius: 7px; background: #fff; color: #26384d; text-align: left; cursor: pointer; }
.run-card.active { border-color: #1769aa; box-shadow: inset 3px 0 #1769aa; background: #f5f9fd; }
.run-card > span:not(.status), .run-card small { grid-column: 1 / -1; color: #66758a; }
.status { align-self: start; padding: 2px 6px; border-radius: 10px; background: #eef3f8; color: #526174; font-size: 11px; }
.status.reviewable { background: #fff5d9; color: #8a6200; }
.status.applied { background: #e9f7ef; color: #176b38; }
.status.incomplete, .status.failed { background: #fff0ed; color: #ad351f; }
.history-pagination { justify-content: center; flex-wrap: wrap; margin-top: 10px; color: #66758a; font-size: 12px; }
.history-pagination select { padding: 6px; border: 1px solid #b9c5d3; border-radius: 5px; background: #fff; }
.history-empty { padding: 36px 12px; color: #66758a; text-align: center; }
.history-alert { padding: 9px 11px; border: 1px solid #efb4b4; border-radius: 6px; background: #fff2f2; color: #a12622; }
.detail-heading { margin-bottom: 10px; }
.metadata-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 0 0 10px; }
.metadata-grid div { min-width: 0; padding: 8px; border-radius: 6px; background: #f5f8fb; }
.metadata-grid dt { color: #66758a; font-size: 11px; }
.metadata-grid dd { overflow: hidden; margin: 4px 0 0; color: #26384d; text-overflow: ellipsis; white-space: nowrap; }
.detail-table-wrap { max-height: 430px; overflow: auto; border: 1px solid #dce3ec; border-radius: 6px; }
.detail-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.detail-table th { position: sticky; top: 0; z-index: 1; background: #f5f8fb; }
.detail-table th, .detail-table td { padding: 8px; border-bottom: 1px solid #e5eaf0; text-align: left; vertical-align: top; }
.detail-table td:first-child { min-width: 130px; }
.detail-table small { display: block; margin-top: 3px; color: #66758a; }
.diff-panel { display: grid; gap: 10px; }
.diff-controls { justify-content: flex-start; flex-wrap: wrap; }
.diff-controls select { max-width: 340px; min-width: 220px; padding: 7px; border: 1px solid #b9c5d3; border-radius: 5px; background: #fff; }
.diff-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.diff-summary article { display: grid; gap: 3px; padding: 10px; border: 1px solid #dce3ec; border-radius: 6px; }
.diff-summary strong { font-size: 21px; color: #20344d; }
.diff-summary span { color: #66758a; font-size: 12px; }
.diff-items { display: grid; gap: 6px; max-height: 260px; overflow: auto; }
.diff-items article { display: grid; grid-template-columns: minmax(140px, 1fr) auto auto; gap: 10px; padding: 8px; border: 1px solid #e1e6ec; border-radius: 6px; }
.diff-items small { color: #66758a; }
@media (max-width: 980px) {
  .history-grid { grid-template-columns: 1fr; }
  .metadata-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  header, .detail-heading, .diff-controls { align-items: stretch; flex-direction: column; }
  .metadata-grid, .diff-summary { grid-template-columns: 1fr 1fr; }
  .diff-controls select { width: 100%; max-width: none; min-width: 0; }
  .diff-items article { grid-template-columns: 1fr; }
  .detail-table-wrap { overflow-x: auto; }
  .detail-table { min-width: 720px; }
}
</style>
