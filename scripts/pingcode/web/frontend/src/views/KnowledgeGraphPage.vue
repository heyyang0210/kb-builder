<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, CheckCircle2, Database, Network, RefreshCw, Search } from 'lucide-vue-next'
import { request } from '../api'
import GraphQualityTrend from '../components/GraphQualityTrend.vue'
import GraphVersionDiff from '../components/GraphVersionDiff.vue'
import GraphVersionHistory from '../components/GraphVersionHistory.vue'
import KnowledgeGraph from '../components/KnowledgeGraph.vue'

const route = useRoute()
const router = useRouter()
const datasets = ref([])
const selectedDatasetId = ref(String(route.query.datasetId || ''))
const versions = ref([])
const versionCatalogue = ref([])
const historyPage = ref(1)
const historyPageSize = ref(20)
const historyTotal = ref(0)
const currentDetail = ref(null)
const checks = ref(null)
const trends = ref(null)
const leftVersionId = ref(String(route.query.leftVersionId || ''))
const rightVersionId = ref(String(route.query.rightVersionId || ''))
const viewedVersionId = ref(String(route.query.graphVersionId || ''))
const focusNodeInput = ref(String(route.query.focusNodeId || ''))
const focusNodeId = ref('')
const graphDepth = ref(Number(route.query.depth) === 2 ? 2 : 1)
const localGraph = ref(null)
const selectedNode = ref(null)
const selectedEdge = ref(null)
const loading = ref(true)
const historyLoading = ref(false)
const detailLoading = ref(false)
const graphLoading = ref(false)
const pageError = ref('')
const detailError = ref('')
const graphError = ref('')
let datasetSequence = 0
let graphSequence = 0
let datasetWatchReady = false

const currentVersion = computed(() => versionCatalogue.value.find(item => item.isCurrent) || versionCatalogue.value[0] || null)
const warningItems = computed(() => (checks.value?.items || []).filter(item => item.status === 'warning'))
const otherCheckItems = computed(() => (checks.value?.items || []).filter(item => item.status !== 'warning'))
const currentHealth = computed(() => currentVersion.value?.health || currentDetail.value?.health || {})
const metricDefinitions = [
  { key: 'relationCoverage', label: '关系覆盖率' },
  { key: 'evidenceCompleteness', label: '证据完整率' },
  { key: 'isolatedKnowledgeRatio', label: '孤立知识比例' },
  { key: 'whyMissingRate', label: 'Why 知识缺失率' },
]

function dateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}
function shortId(value) { return !value ? '-' : (value.length > 28 ? `${value.slice(0, 17)}...${value.slice(-7)}` : value) }
function metricValue(metric) {
  const value = typeof metric === 'object' ? metric?.value : metric
  return value === null || value === undefined ? '不适用' : `${Math.round(Number(value) * 100)}%`
}
function datasetLabel(dataset) { return dataset.name || dataset.displayName || dataset.id }
function nodeName(node) { return node?.displayName || node?.name || node?.rawName || node?.id || '-' }
function nodeNameById(nodeId) { return nodeName(localGraph.value?.nodes?.find(item => item.id === nodeId)) || nodeId || '-' }

function syncRoute() {
  const query = {}
  if (selectedDatasetId.value) query.datasetId = selectedDatasetId.value
  if (viewedVersionId.value && viewedVersionId.value !== currentVersion.value?.graphVersionId) query.graphVersionId = viewedVersionId.value
  if (leftVersionId.value) query.leftVersionId = leftVersionId.value
  if (rightVersionId.value) query.rightVersionId = rightVersionId.value
  if (focusNodeId.value) query.focusNodeId = focusNodeId.value
  if (graphDepth.value !== 1) query.depth = String(graphDepth.value)
  router.replace({ query })
}

async function loadDatasets() {
  loading.value = true
  pageError.value = ''
  try {
    const [datasetPayload, latestVersions] = await Promise.all([
      request('/api/datasets'),
      request('/api/graph/versions?page=1&pageSize=100'),
    ])
    datasets.value = datasetPayload.items || []
    if (!datasets.value.some(item => item.id === selectedDatasetId.value)) {
      const preferredDatasetId = (latestVersions.items || []).find(item => item.datasetId)?.datasetId
      selectedDatasetId.value = datasets.value.find(item => item.id === preferredDatasetId)?.id || datasets.value[0]?.id || ''
    }
    if (selectedDatasetId.value) await loadDatasetVersions()
  } catch (reason) { pageError.value = reason.message } finally { loading.value = false }
}

async function loadVersionCatalogue(sequence) {
  const collected = []
  let page = 1
  let total = 0
  do {
    const payload = await request(`/api/graph/versions?datasetId=${encodeURIComponent(selectedDatasetId.value)}&page=${page}&pageSize=100`)
    if (sequence !== datasetSequence) return []
    collected.push(...(payload.items || []))
    total = Number(payload.total || 0)
    page += 1
  } while (collected.length < total)
  return collected
}

async function loadHistoryPage(sequence = datasetSequence) {
  const payload = await request(`/api/graph/versions?datasetId=${encodeURIComponent(selectedDatasetId.value)}&page=${historyPage.value}&pageSize=${historyPageSize.value}`)
  if (sequence !== datasetSequence) return
  versions.value = payload.items || []
  historyTotal.value = payload.total || 0
}

async function loadDatasetVersions() {
  const sequence = ++datasetSequence
  historyLoading.value = true
  detailLoading.value = true
  pageError.value = ''
  historyPage.value = 1
  clearGraph()
  try {
    const [catalogue] = await Promise.all([loadVersionCatalogue(sequence), loadHistoryPage(sequence)])
    if (sequence !== datasetSequence) return
    versionCatalogue.value = catalogue
    const available = catalogue.filter(item => item.integrity !== 'corrupted')
    const current = available.find(item => item.isCurrent) || available[0]
    if (!available.some(item => item.graphVersionId === viewedVersionId.value)) viewedVersionId.value = current?.graphVersionId || ''
    if (!available.some(item => item.graphVersionId === rightVersionId.value)) rightVersionId.value = current?.graphVersionId || ''
    if (!available.some(item => item.graphVersionId === leftVersionId.value) || leftVersionId.value === rightVersionId.value) leftVersionId.value = available.find(item => item.graphVersionId !== rightVersionId.value)?.graphVersionId || ''
    await Promise.all([loadCurrentDetail(sequence), loadChecks(sequence), loadTrends(sequence)])
    syncRoute()
  } catch (reason) {
    if (sequence === datasetSequence) pageError.value = reason.message
  } finally {
    if (sequence === datasetSequence) { historyLoading.value = false; detailLoading.value = false }
  }
}

async function loadCurrentDetail(sequence = datasetSequence) {
  const versionId = currentVersion.value?.graphVersionId
  const payload = versionId ? await request(`/api/graph/versions/${encodeURIComponent(versionId)}`) : null
  if (sequence === datasetSequence) currentDetail.value = payload
}
async function loadChecks(sequence = datasetSequence) {
  detailError.value = ''
  if (!viewedVersionId.value) { checks.value = null; return }
  try {
    const payload = await request(`/api/graph/versions/${encodeURIComponent(viewedVersionId.value)}/checks`)
    if (sequence === datasetSequence) checks.value = payload
  } catch (reason) { if (sequence === datasetSequence) detailError.value = reason.message }
}
async function loadTrends(sequence = datasetSequence) {
  const payload = await request(`/api/graph/versions/trends?datasetId=${encodeURIComponent(selectedDatasetId.value)}&limit=20`)
  if (sequence === datasetSequence) trends.value = payload
}
async function changeHistoryPage(event) {
  historyPage.value = event.page
  historyPageSize.value = event.pageSize
  historyLoading.value = true
  try { await loadHistoryPage() } catch (reason) { pageError.value = reason.message } finally { historyLoading.value = false }
}
async function openVersion(versionId) {
  viewedVersionId.value = versionId
  focusNodeInput.value = ''
  clearGraph()
  detailLoading.value = true
  await loadChecks()
  detailLoading.value = false
  syncRoute()
}
function selectLeft(versionId) { leftVersionId.value = versionId; syncRoute() }
function selectRight(versionId) { rightVersionId.value = versionId; syncRoute() }
function clearGraph() {
  localGraph.value = null
  focusNodeId.value = ''
  selectedNode.value = null
  selectedEdge.value = null
  graphError.value = ''
}

async function loadLocalGraph() {
  const versionId = viewedVersionId.value
  const nodeId = focusNodeInput.value.trim()
  if (!versionId || !nodeId) return
  const sequence = ++graphSequence
  graphLoading.value = true
  graphError.value = ''
  selectedNode.value = null
  selectedEdge.value = null
  try {
    const payload = await request(`/api/graph/versions/${encodeURIComponent(versionId)}/explore?focusNodeId=${encodeURIComponent(nodeId)}&depth=${graphDepth.value}`)
    if (sequence === graphSequence) { localGraph.value = payload; focusNodeId.value = nodeId; syncRoute() }
  } catch (reason) {
    if (sequence === graphSequence) { localGraph.value = null; graphError.value = reason.message }
  } finally { if (sequence === graphSequence) graphLoading.value = false }
}
async function exploreDiffNode({ versionId, nodeId }) {
  if (viewedVersionId.value !== versionId) await openVersion(versionId)
  focusNodeInput.value = nodeId
  await loadLocalGraph()
  document.querySelector('#version-local-graph')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function handleNodeClick(node) { selectedNode.value = node; selectedEdge.value = null; focusNodeInput.value = node.id }
function handleEdgeClick(edge) { selectedEdge.value = edge; selectedNode.value = null }

watch(selectedDatasetId, (value, oldValue) => { if (datasetWatchReady && value !== oldValue) loadDatasetVersions() })
watch(graphDepth, () => { if (focusNodeId.value) loadLocalGraph() })
onMounted(async () => {
  await loadDatasets()
  datasetWatchReady = true
  if (focusNodeInput.value && viewedVersionId.value) await loadLocalGraph()
})
</script>

<template>
  <div class="knowledge-graph-page">
    <header class="page-heading">
      <div><h1>知识图谱质量运营</h1><p>查看正式版本、发布风险、质量趋势与有界局部关系，不读取全量版本图谱。</p></div>
      <div class="dataset-selector">
        <label for="graph-dataset">数据集</label>
        <select id="graph-dataset" v-model="selectedDatasetId" :disabled="loading">
          <option v-if="!datasets.length" value="">暂无数据集</option>
          <option v-for="dataset in datasets" :key="dataset.id" :value="dataset.id">{{ datasetLabel(dataset) }}</option>
        </select>
        <button class="icon-button" type="button" title="刷新版本数据" aria-label="刷新版本数据" :disabled="loading" @click="loadDatasets"><RefreshCw :size="16" /></button>
      </div>
    </header>

    <div v-if="pageError" class="page-error" role="alert"><span>{{ pageError }}</span><button type="button" @click="loadDatasets">重试</button></div>
    <div v-if="loading" class="page-state">正在读取正式图谱版本...</div>
    <div v-else-if="!selectedDatasetId" class="page-state">暂无可查看的数据集。</div>
    <template v-else>
      <section class="current-version-band" aria-labelledby="current-version-title">
        <header class="band-header">
          <div><h2 id="current-version-title">当前正式版本</h2><p>该版本是当前发布级知识资产，历史版本不可覆盖。</p></div>
          <span v-if="currentVersion" :class="['publish-status', currentVersion.warningCount ? 'warning' : 'success']">
            <AlertTriangle v-if="currentVersion.warningCount" :size="15" /><CheckCircle2 v-else :size="15" />
            {{ currentVersion.warningCount ? `${currentVersion.warningCount} 项发布警告` : '发布检查通过' }}
          </span>
        </header>
        <div v-if="historyLoading || detailLoading" class="component-state">正在读取当前正式版本...</div>
        <div v-else-if="!currentVersion" class="component-state">当前数据集尚未产生正式图谱版本。</div>
        <template v-else>
          <dl class="version-lineage">
            <div><dt>版本 ID</dt><dd :title="currentVersion.graphVersionId">{{ shortId(currentVersion.graphVersionId) }}</dd></div>
            <div><dt>发布时间</dt><dd>{{ dateTime(currentVersion.createdAt) }}</dd></div>
            <div><dt>规则版本</dt><dd>{{ currentVersion.rulesVersion || '-' }}</dd></div>
            <div><dt>来源任务</dt><dd :title="currentVersion.sourceTrainingTaskId">{{ shortId(currentVersion.sourceTrainingTaskId) }}</dd></div>
            <div><dt>过滤运行</dt><dd :title="currentVersion.sourceFilterRunId">{{ shortId(currentVersion.sourceFilterRunId) }}</dd></div>
            <div><dt>来源指纹</dt><dd :title="currentDetail?.sourceFingerprint">{{ shortId(currentDetail?.sourceFingerprint) }}</dd></div>
          </dl>
          <div class="current-metrics">
            <article><Database :size="17" /><span>图谱规模</span><strong>{{ currentVersion.nodeCount }} 节点</strong><small>{{ currentVersion.edgeCount }} 条关系</small></article>
            <article v-for="definition in metricDefinitions" :key="definition.key"><span>{{ definition.label }}</span><strong>{{ metricValue(currentHealth[definition.key]) }}</strong><small>{{ currentHealth[definition.key]?.availability === 'available' ? '发布时指标快照' : '当前不适用' }}</small></article>
          </div>
        </template>
      </section>

      <div class="operations-grid">
        <GraphQualityTrend :data="trends" :loading="historyLoading" :error="pageError" />
        <section class="publish-checks panel-band" aria-labelledby="publish-checks-title">
          <header class="band-header"><div><h2 id="publish-checks-title">发布检查</h2><p>检查结果仅告警，不阻断既有正式发布语义。</p></div><span>{{ shortId(viewedVersionId) }}</span></header>
          <div v-if="detailLoading" class="component-state">正在读取发布检查...</div>
          <div v-else-if="detailError" class="component-state error-text">{{ detailError }}</div>
          <template v-else-if="checks">
            <div v-if="warningItems.length" class="warning-list" role="alert">
              <article v-for="item in warningItems" :key="item.code"><AlertTriangle :size="16" /><div><strong>{{ item.label }}</strong><p>{{ item.message }}</p></div></article>
            </div>
            <div v-else class="checks-passed"><CheckCircle2 :size="17" /><span>该版本没有发布警告。</span></div>
            <details v-if="otherCheckItems.length" class="other-checks"><summary>查看其余 {{ otherCheckItems.length }} 项检查</summary><ul><li v-for="item in otherCheckItems" :key="item.code"><strong>{{ item.label }}</strong>：{{ item.message }}</li></ul></details>
          </template>
          <div v-else class="component-state">请选择一个可用版本查看检查结果。</div>
        </section>
      </div>

      <GraphVersionHistory
        :versions="versions" :comparison-versions="versionCatalogue" :loading="historyLoading" :page="historyPage" :page-size="historyPageSize" :total="historyTotal"
        :left-version-id="leftVersionId" :right-version-id="rightVersionId"
        @select-left="selectLeft" @select-right="selectRight" @page-change="changeHistoryPage" @open-version="openVersion"
      />
      <GraphVersionDiff :left-version-id="leftVersionId" :right-version-id="rightVersionId" @explore-node="exploreDiffNode" />

      <section id="version-local-graph" class="local-graph-band panel-band" aria-labelledby="version-local-graph-title">
        <header class="band-header"><div><h2 id="version-local-graph-title">版本局部图谱</h2><p>按稳定节点 ID 查看 1 至 2 跳关系，服务端上限内有界返回。</p></div><Network :size="20" /></header>
        <div class="graph-controls">
          <label>查看版本
            <select v-model="viewedVersionId" @change="openVersion(viewedVersionId)"><option v-for="item in versionCatalogue.filter(value => value.integrity !== 'corrupted')" :key="item.graphVersionId" :value="item.graphVersionId">{{ shortId(item.graphVersionId) }}{{ item.isCurrent ? ' · 当前正式版' : '' }}</option></select>
          </label>
          <label class="focus-field">焦点节点 ID
            <span><Search :size="15" /><input v-model="focusNodeInput" type="search" placeholder="输入稳定节点 ID，或从差异明细进入" @keyup.enter="loadLocalGraph" /></span>
          </label>
          <label>关系深度<select v-model.number="graphDepth"><option :value="1">1 跳</option><option :value="2">2 跳</option></select></label>
          <button class="button" type="button" :disabled="!viewedVersionId || !focusNodeInput.trim() || graphLoading" @click="loadLocalGraph">查看局部图</button>
        </div>
        <div class="graph-workspace">
          <KnowledgeGraph :graph="localGraph || { nodes: [], edges: [] }" height="480px" :loading="graphLoading" :error="graphError" :focus-node-id="focusNodeId" @node-click="handleNodeClick" @edge-click="handleEdgeClick" />
          <aside class="selection-detail">
            <template v-if="selectedNode"><span class="detail-type">节点 · {{ selectedNode.type || '未知类型' }}</span><h3>{{ nodeName(selectedNode) }}</h3><dl><dt>稳定 ID</dt><dd>{{ selectedNode.id }}</dd><dt v-if="selectedNode.evidenceText">证据摘要</dt><dd v-if="selectedNode.evidenceText">{{ selectedNode.evidenceText }}</dd></dl></template>
            <template v-else-if="selectedEdge"><span class="detail-type">关系 · {{ selectedEdge.type || '未知类型' }}</span><h3>{{ nodeNameById(selectedEdge.source) }} → {{ nodeNameById(selectedEdge.target) }}</h3><dl><dt>稳定 ID</dt><dd>{{ selectedEdge.id || '-' }}</dd><dt v-if="selectedEdge.evidenceText">证据摘要</dt><dd v-if="selectedEdge.evidenceText">{{ selectedEdge.evidenceText }}</dd></dl></template>
            <div v-else class="detail-empty">点击局部图中的节点或关系查看摘要。</div>
          </aside>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.knowledge-graph-page { display: grid; gap: 16px; max-width: 1600px; margin: 0 auto; }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.page-heading h1 { margin: 0 0 5px; font-size: 22px; }
.page-heading p { margin: 0; color: #6d7b90; font-size: 13px; }
.dataset-selector { display: flex; align-items: center; gap: 8px; }
.dataset-selector label { color: #637086; font-size: 12px; }
.dataset-selector select { width: min(340px, 34vw); padding: 8px 10px; border: 1px solid #ccd6e3; border-radius: 6px; background: #fff; }
.panel-band, .current-version-band { min-width: 0; overflow: hidden; border: 1px solid #dce4ef; border-radius: 8px; background: #fff; }
.band-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px 18px; border-bottom: 1px solid #e5eaf1; }
.band-header h2 { margin: 0; font-size: 16px; }
.band-header p { margin: 5px 0 0; color: #6d7b90; font-size: 12px; }
.band-header > span:not(.publish-status), .band-header > svg { color: #6d7b90; font-size: 11px; }
.publish-status { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border-radius: 5px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.publish-status.success { color: #147a43; background: #eaf8ef; }
.publish-status.warning { color: #9b6108; background: #fff4d6; }
.version-lineage { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1px; margin: 0; border-bottom: 1px solid #dce4ef; background: #dce4ef; }
.version-lineage div { min-width: 0; padding: 10px 12px; background: #fafbfd; }
.version-lineage dt { color: #6d7b90; font-size: 11px; }
.version-lineage dd { margin: 4px 0 0; overflow: hidden; color: #26384d; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.current-metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; padding: 14px 18px; }
.current-metrics article { display: grid; gap: 4px; min-width: 0; padding: 11px; border: 1px solid #e1e7ef; border-radius: 6px; background: #fff; }
.current-metrics svg { color: #175cd3; }
.current-metrics span, .current-metrics small { color: #6d7b90; font-size: 11px; }
.current-metrics strong { color: #20344d; font-size: 18px; }
.operations-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr); gap: 16px; }
.warning-list { display: grid; gap: 8px; padding: 14px 18px; }
.warning-list article { display: flex; align-items: flex-start; gap: 8px; padding: 10px; border: 1px solid #efcf8a; border-radius: 6px; color: #80520b; background: #fff9eb; }
.warning-list svg { flex: 0 0 auto; }
.warning-list strong { font-size: 12px; }
.warning-list p { margin: 3px 0 0; font-size: 11px; line-height: 1.5; }
.checks-passed { display: flex; align-items: center; gap: 8px; margin: 14px 18px; padding: 11px; color: #147a43; background: #eaf8ef; border-radius: 6px; font-size: 12px; }
.other-checks { margin: 0 18px 16px; color: #526174; font-size: 12px; }
.other-checks summary { cursor: pointer; }
.other-checks ul { display: grid; gap: 7px; padding-left: 20px; line-height: 1.5; }
.graph-controls { display: grid; grid-template-columns: minmax(180px, .8fr) minmax(260px, 1.4fr) 100px auto; align-items: end; gap: 10px; padding: 12px 18px; background: #f8fafc; border-bottom: 1px solid #e5eaf1; }
.graph-controls label { display: grid; gap: 5px; color: #637086; font-size: 12px; }
.graph-controls select, .focus-field span { min-height: 36px; border: 1px solid #ccd6e3; border-radius: 6px; background: #fff; }
.graph-controls select { min-width: 0; width: 100%; padding: 7px 9px; }
.focus-field span { display: flex; align-items: center; gap: 7px; padding: 0 10px; }
.focus-field svg { color: #748196; }
.focus-field input { min-width: 0; width: 100%; border: 0; outline: 0; }
.graph-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 300px; min-height: 480px; }
.graph-workspace :deep(.knowledge-graph) { border: 0; border-radius: 0; }
.selection-detail { min-width: 0; padding: 16px; border-left: 1px solid #e5eaf1; background: #fafbfd; }
.detail-type { display: inline-flex; padding: 3px 7px; border-radius: 4px; color: #175cd3; background: #eaf2ff; font-size: 11px; }
.selection-detail h3 { margin: 10px 0 14px; font-size: 15px; word-break: break-word; }
.selection-detail dl { display: grid; gap: 6px; margin: 0; font-size: 12px; }
.selection-detail dt { color: #6d7b90; }
.selection-detail dd { margin: 0 0 8px; color: #344054; line-height: 1.55; word-break: break-word; }
.detail-empty, .component-state, .page-state { display: grid; min-height: 150px; place-items: center; padding: 24px; color: #6d7b90; text-align: center; font-size: 13px; }
.page-state { min-height: 300px; border: 1px solid #dce4ef; border-radius: 8px; background: #fff; }
.page-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 13px; color: #a61d24; background: #fff1f0; border: 1px solid #ffa39e; border-radius: 7px; font-size: 13px; }
.page-error button { border: 0; color: #a61d24; background: transparent; }
.error-text { color: #a61d24; }
@media (max-width: 1180px) {
  .version-lineage { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .current-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .operations-grid { grid-template-columns: 1fr; }
}
@media (max-width: 700px) {
  .page-heading { flex-direction: column; }
  .dataset-selector { width: 100%; }
  .dataset-selector select { min-width: 0; width: 100%; }
  .version-lineage, .current-metrics { grid-template-columns: 1fr; }
  .band-header { flex-direction: column; }
  .graph-controls { grid-template-columns: 1fr; align-items: stretch; }
  .graph-controls .button { width: 100%; }
  .graph-workspace { grid-template-columns: 1fr; }
  .selection-detail { min-height: 180px; border-top: 1px solid #e5eaf1; border-left: 0; }
}
</style>
