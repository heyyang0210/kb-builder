<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import BatchStepNav from '../components/BatchStepNav.vue'
import GraphDiagnosisWorkbench from '../components/GraphDiagnosisWorkbench.vue'
import GraphObservabilitySummary from '../components/GraphObservabilitySummary.vue'
import KeywordFilterHistory from '../components/KeywordFilterHistory.vue'
import KeywordReviewDecision from '../components/KeywordReviewDecision.vue'
import KeywordIssueOverview from '../components/KeywordIssueOverview.vue'
import KeywordEvidenceDrawer from '../components/KeywordEvidenceDrawer.vue'
import { baseUrl, datasetGovernanceView, governancePublishErrorMessage, request } from '../api'

const route = useRoute()
const router = useRouter()
const datasets = ref([])
const selectedId = ref('')
const graphObservability = ref(null)
const localGraph = ref({ nodes: [], edges: [], counts: null })
const graphFocusNodeId = ref('')
const graphDepth = ref(1)
const graphLabelDensity = ref('focus')
const graphError = ref('')
const graphCanvas = ref(null)
const graphCanvasKey = ref(0)
let graphRequestSequence = 0
let observabilityRequestSequence = 0
const appliedFilterState = ref(null)
const graphView = ref('after')
const selectedNode = ref(null)
const selectedEdge = ref(null)
const graphLoading = ref(false)
const graphInfo = ref('')
const error = ref('')
const loading = ref(false)
const publishing = ref(false)
const formalBuilding = ref(false)

const filterResults = ref([])
const filterResultsExpanded = ref(false)
const previewResults = ref([])
const previewLoading = ref(false)
const applyLoading = ref(false)
const previewExpanded = ref(true)
const streamingDecisions = ref([])
const streamProgress = ref({ total: 0, current: 0, stage: '', batch: 0, batchTotal: 0, pending: 0, status: '' })
const filterIncomplete = ref(false)
const skillStatus = ref('')
const filterElapsed = ref(0)
const filterTimer = { id: null }
const showSkillEditor = ref(false)
const skillContent = ref('')
const resultActionFilter = ref('all')
const resultCategoryFilter = ref('all')
const resultSearch = ref('')
const resultSearchQuery = ref('')
const resultPage = ref(1)
const resultPageSize = ref(50)
const filterView = ref(route.query.filterView === 'history' ? 'history' : 'current')
const activeFilterRunId = ref(typeof route.query.filterRunId === 'string' ? route.query.filterRunId : '')
const activeFilterRunRevision = ref(null)
const activeFilterRunStatus = ref('')
const filterHistoryRefreshKey = ref(0)
const reviewCategories = ref([])
const reviewSummary = ref(null)
const reviewSaving = ref(false)
const reviewConflict = ref(false)
const reviewInvalidOnly = ref(false)
const dirtyReviewIds = ref(new Set())
const savingReviewIds = ref(new Set())
const reviewTimer = { id: null }
const issueOverview = ref(null)
const issueOverviewLoading = ref(false)
const evidenceDrawerOpen = ref(Boolean(route.query.category && route.query.filterRunId))
const evidenceCategory = ref(typeof route.query.category === 'string' ? route.query.category : '')
const evidenceKeywordId = ref(typeof route.query.keywordId === 'string' ? route.query.keywordId : '')
const evidenceResourceId = ref(typeof route.query.resourceId === 'string' ? route.query.resourceId : '')
let resultSearchTimer = null

const skillLoading = ref(false)

const nodeTypeLabels = {
  Document: '来源文档',
  ProcessingUnit: '文档块',
  Chunk: '文档块',
  KnowledgePoint: '知识点',
  Keyword: '关键词',
  Parameter: '参数',
  Concept: '概念',
  Component: '组件',
  Configuration: '配置项',
  Version: '版本',
  ErrorCode: '错误码',
  YashanDBErrorCode: 'YashanDB 错误码',
  OracleErrorCode: 'Oracle 错误码',
}

const edgeTypeLabels = {
  DOCUMENT_CONTAINS_UNIT: '结构追溯',
  HAS_CHUNK: '结构追溯',
  UNIT_MENTIONS_ENTITY: '旧版提及关系',
  CONTEXT_MATCHES_CHUNK: '上下文匹配文档块',
  RELATED_CONTEXT: '相关上下文',
  DEFINES: '定义',
  IMPLEMENTS: '实现',
  EXPLAINS: '解释原因',
  CAUSES: '导致',
  MENTIONS: '提及上下文',
  AFFECTS: '影响',
  DEPENDS_ON: '依赖',
  CONSTRAINS: '约束',
  SOLVES: '解决',
  VALIDATED_BY: '验证依据',
  RELATED_TO: '相关',
  COMPARED_WITH: '对比',
}

const sourceMethodLabels = {
  domain_term: '领域词典',
  chunk_context_keyword: '文档块上下文关键词',
  document_keyword: '文档关键词',
  document_title: '文档标题候选',
  model_keyword: '模型主题关键词',
  domain_glossary_title: '标题领域术语',
  knowledge_extraction_workflow_agent: '知识提取',
  knowledge_extraction_agent: '知识提取',
}

const visibleDatasets = computed(() => datasets.value.filter(item => item.state !== 'deleted'))
const selectedDataset = computed(() => visibleDatasets.value.find(item => item.id === selectedId.value) || null)
const selectedGovernance = computed(() => datasetGovernanceView(selectedDataset.value))
const keywordCount = computed(() => {
  const state = normalizedFilterState.value
  return state.beforeTotal
})
const filterEstimatedSeconds = computed(() => {
  if (!keywordCount.value) return 0
  return Math.min(300, 60 + (Math.floor(keywordCount.value / 10) + 1) * 30)
})

const normalizedFilterState = computed(() => {
  const observabilityState = graphObservability.value?.counts?.keywords
    ? { beforeTotal: graphObservability.value.counts.keywords.before, kept: graphObservability.value.counts.keywords.kept, excluded: graphObservability.value.counts.keywords.excluded }
    : {}
  const state = appliedFilterState.value || observabilityState
  const admitted = numberValue(state.afterTotal, state.kept, state.admitted)
  const excluded = numberValue(state.excluded, state.excludedCount)
  const total = numberValue(state.beforeTotal, state.totalKeywordCount, admitted + excluded)
  return {
    beforeTotal: total,
    afterTotal: admitted,
    kept: admitted,
    excluded: Math.max(0, excluded || total - admitted),
  }
})

const filterStateError = computed(() => {
  const state = normalizedFilterState.value
  if (state.beforeTotal !== state.kept + state.excluded) {
    return `关键词统计不一致：过滤前 ${state.beforeTotal}，保留 ${state.kept}，排除 ${state.excluded}`
  }
  if (state.afterTotal !== state.kept) {
    return `关键词统计不一致：过滤后 ${state.afterTotal}，保留 ${state.kept}`
  }
  return ''
})

const graphPreview = computed(() => localGraph.value)
const graphViewDescription = computed(() => ({
  before: '过滤前视图需要稳定快照；当前阶段展示可用性状态，不拼接临时数据',
  after: '先查看范围和质量，再选择关键词加载有界局部关系',
  changed: '变化视图需要稳定快照；当前阶段展示可用性状态，不拼接临时数据',
}[graphView.value]))
const nodeLookup = computed(() => new Map(graphPreview.value.nodes.map(node => [node.id, node])))
const graphKeywordCandidates = computed(() => {
  const candidates = new Map()
  const add = item => {
    const id = item?.keywordId || item?.id
    if (!id) return
    candidates.set(id, {
      id,
      displayName: item.keywordName || item.displayName || item.canonicalName || item.name || item.rawName || id,
      canonicalName: item.canonicalName,
      rawName: item.keywordRawName || item.rawName,
      aliases: item.aliases || [],
    })
  }
  previewResults.value.forEach(add)
  streamingDecisions.value.forEach(add)
  filterResults.value.forEach(item => add({ ...item, keywordName: item.name }))
  localGraph.value.nodes.filter(node => node.type === 'Keyword').forEach(add)
  return [...candidates.values()]
})
const canBuildFormalKnowledge = computed(() => {
  if (graphObservability.value?.scope?.graphSource === 'final_knowledge') return false
  return normalizedFilterState.value.kept > 0 && selectedDataset.value?.qualityPassed === true
})
const formalBuildTooltip = computed(() => {
  if (graphObservability.value?.scope?.graphSource === 'final_knowledge') return '当前已是正式知识图谱，无需重复构建'
  if (!normalizedFilterState.value.kept) return '请先执行关键词智能过滤并保留有效关键词'
  if (!selectedDataset.value?.qualityPassed) return '数据集未通过发布基础质量门禁'
  return '基于保留关键词构建正式知识库'
})

function numberValue(...values) {
  const value = values.find(item => Number.isFinite(Number(item)))
  return value === undefined ? 0 : Number(value)
}

function readAdmissionStatus(node) {
  return node?.admissionStatus || node?.properties?.admissionStatus || 'excluded'
}

function normalizeAppliedState(result, decisions, beforeTotal) {
  const source = result.keywordFilterState || result.filterState || result.statistics || result.applied || {}
  const kept = numberValue(source.kept, source.keep, source.admitted, decisions.filter(item => item.action === 'keep').length)
  const excluded = numberValue(source.excluded, source.exclude, source.excludedCount, decisions.filter(item => item.action === 'exclude').length)
  const total = numberValue(source.beforeTotal, source.total, beforeTotal, kept + excluded)
  return { beforeTotal: total, afterTotal: kept, kept, excluded }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    datasets.value = (await request(`/api/datasets?batchId=${route.params.batchId}`)).items || []
    if (!visibleDatasets.value.some(item => item.id === selectedId.value)) {
      selectedId.value = visibleDatasets.value[0]?.id || ''
    }
    if (!selectedId.value) {
      graphObservability.value = null
      clearLocalGraph()
      return
    }
    await loadGraph()
    if (activeFilterRunId.value) {
      try {
        const detail = await request(`/api/datasets/${selectedId.value}/keyword-filter-runs/${encodeURIComponent(activeFilterRunId.value)}`)
        restoreFilterRun(detail)
      } catch (reason) {
        error.value = `恢复过滤运行失败：${reason.message}`
      }
    }
  } catch (reason) {
    error.value = reason.message
  } finally {
    loading.value = false
  }
}

async function loadGraphObservability() {
  const requestSequence = ++observabilityRequestSequence
  const datasetId = selectedId.value
  const view = graphView.value
  const runParam = activeFilterRunId.value ? `&filterRunId=${encodeURIComponent(activeFilterRunId.value)}` : ''
  try {
    const data = await request(`/api/datasets/${encodeURIComponent(datasetId)}/graph/observability?view=${view}${runParam}`)
    if (requestSequence !== observabilityRequestSequence) return
    graphObservability.value = data
    graphError.value = ''
  } catch (reason) {
    if (requestSequence !== observabilityRequestSequence) return
    graphObservability.value = null
    graphError.value = reason.message
  }
}

function clearLocalGraph({ clearFocus = true } = {}) {
  graphRequestSequence += 1
  localGraph.value = { nodes: [], edges: [], counts: null }
  if (clearFocus) graphFocusNodeId.value = ''
  selectedNode.value = null
  selectedEdge.value = null
  graphCanvasKey.value += 1
}

async function loadNeighborhood(nodeId = graphFocusNodeId.value) {
  if (!selectedId.value || !nodeId || graphView.value !== 'after') return
  const requestSequence = ++graphRequestSequence
  graphFocusNodeId.value = nodeId
  graphLoading.value = true
  graphError.value = ''
  selectedNode.value = null
  selectedEdge.value = null
  try {
    const payload = await request(`/api/datasets/${encodeURIComponent(selectedId.value)}/graph/neighborhood?nodeId=${encodeURIComponent(nodeId)}&limit=80&depth=${graphDepth.value}`)
    if (requestSequence !== graphRequestSequence) return
    localGraph.value = payload
  } catch (reason) {
    if (requestSequence !== graphRequestSequence) return
    localGraph.value = { nodes: [], edges: [], counts: null }
    graphError.value = reason.code === 'GRAPH_NODE_NOT_FOUND' ? '该关键词在当前投影中不可见，请重新选择焦点。' : reason.message
  } finally {
    if (requestSequence === graphRequestSequence) graphLoading.value = false
  }
}

async function loadGraph() {
  graphLoading.value = true
  graphInfo.value = ''
  graphError.value = ''
  graphObservability.value = null
  clearLocalGraph()
  await loadGraphObservability()
  graphLoading.value = false
}

async function changeGraphView(view) {
  if (graphView.value === view) return
  graphView.value = view
  graphObservability.value = null
  clearLocalGraph()
  graphLoading.value = true
  await loadGraphObservability()
  graphLoading.value = false
}

function changeGraphDepth(value) {
  graphDepth.value = value
  if (graphFocusNodeId.value) loadNeighborhood()
}

function resetLocalGraph() {
  graphDepth.value = 1
  graphLabelDensity.value = 'focus'
  clearLocalGraph()
}

function runGraphCommand(command) {
  if (command === 'zoomIn') graphCanvas.value?.zoom(1)
  else if (command === 'zoomOut') graphCanvas.value?.zoom(-1)
  else graphCanvas.value?.[command]?.()
}

async function changeDataset() {
  if (dirtyReviewIds.value.size && !window.confirm('尚有未保存的复核修改，确认切换数据集吗？')) return
  appliedFilterState.value = null
  filterResults.value = []
  previewResults.value = []
  resultActionFilter.value = 'all'
  resultCategoryFilter.value = 'all'
  resultSearch.value = ''
  resultSearchQuery.value = ''
  resultPage.value = 1
  activeFilterRunId.value = ''
  activeFilterRunRevision.value = null
  activeFilterRunStatus.value = ''
  issueOverview.value = null
  evidenceDrawerOpen.value = false
  evidenceCategory.value = ''
  evidenceKeywordId.value = ''
  evidenceResourceId.value = ''
  reviewSummary.value = null
  reviewConflict.value = false
  dirtyReviewIds.value = new Set()
  skillStatus.value = ''
  graphView.value = 'after'
  graphDepth.value = 1
  graphLabelDensity.value = 'focus'
  syncFilterRoute()
  await loadGraph()
}

async function publishSelected() {
  if (!selectedDataset.value || publishing.value) return
  const dataset = selectedDataset.value
  const governance = selectedGovernance.value
  if (governance.governed && !governance.canPublish) return
  if (governance.requiresForce && !window.confirm(`数据集 ${dataset.id} 是历史数据，且未通过旧版质量检查。\n\n确认使用历史兼容方式发布吗？`)) return
  const query = governance.governed
    ? `expectedStatusVersion=${encodeURIComponent(dataset.governance.statusVersion)}`
    : `force=${governance.requiresForce}`
  publishing.value = true
  error.value = ''
  try {
    await request(`/api/datasets/${encodeURIComponent(dataset.id)}/publish?${query}`, { method: 'POST' })
    await load()
  } catch (reason) {
    if (reason.code === 'STATE_VERSION_CONFLICT') await load()
    error.value = governancePublishErrorMessage(reason)
  } finally {
    publishing.value = false
  }
}

async function loadSkill() {
  skillLoading.value = true
  try {
    const data = await request('/api/skills/keyword-filter')
    skillContent.value = data.content || ''
  } catch (reason) {
    error.value = `加载过滤策略失败：${reason.message}`
  } finally {
    skillLoading.value = false
  }
}

async function saveSkill() {
  skillLoading.value = true
  try {
    const result = await request('/api/skills/keyword-filter', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: skillContent.value }),
    })
    if (result.success) {
      skillStatus.value = '过滤策略已更新'
      showSkillEditor.value = false
    }
  } catch (reason) {
    error.value = `保存过滤策略失败：${reason.message}`
  } finally {
    skillLoading.value = false
  }
}

function toggleSkillEditor() {
  if (!showSkillEditor.value) loadSkill()
  showSkillEditor.value = !showSkillEditor.value
}

const filterStages = [
  '正在读取过滤策略...',
  '正在加载关键词列表...',
  '模型正在逐条分析关键词质量...',
  '即将完成，正在生成决策建议...',
]

function buildFilterStatus(keywordTotal, estimatedSeconds, elapsedSeconds, progress) {
  if (progress.stage === 'calling_model' && progress.current > 0) {
    return `模型分析中：已处理 ${progress.current}/${progress.total} 个关键词（已用时 ${elapsedSeconds}s / 预计 ${estimatedSeconds}s）`
  }
  const stageLabel = progress.stage === 'preparing' ? filterStages[0]
    : progress.stage === 'keywords_loaded' ? filterStages[1]
      : progress.stage === 'calling_model' ? filterStages[2]
        : filterStages[Math.min(3, elapsedSeconds >= estimatedSeconds - 5 ? 3 : elapsedSeconds >= 5 ? 2 : elapsedSeconds >= 2 ? 1 : 0)]
  return `${stageLabel}（${keywordTotal} 个关键词，已用时 ${elapsedSeconds}s / 预计 ${estimatedSeconds}s）`
}

function syncFilterRoute() {
  const query = { ...route.query }
  if (filterView.value === 'history') query.filterView = 'history'
  else delete query.filterView
  if (activeFilterRunId.value) query.filterRunId = activeFilterRunId.value
  else delete query.filterRunId
  if (evidenceDrawerOpen.value && evidenceCategory.value) query.category = evidenceCategory.value
  else delete query.category
  if (evidenceDrawerOpen.value && evidenceKeywordId.value) query.keywordId = evidenceKeywordId.value
  else delete query.keywordId
  if (evidenceDrawerOpen.value && evidenceResourceId.value) query.resourceId = evidenceResourceId.value
  else delete query.resourceId
  router.replace({ query })
}

function switchFilterView(view) {
  if (view !== filterView.value && dirtyReviewIds.value.size && !window.confirm('尚有未保存的复核修改，确认离开当前视图吗？')) return
  filterView.value = view
  syncFilterRoute()
}

function normalizeRunDecision(item) {
  const action = item.finalAction || item.reviewAction || item.userAction || item.modelAction || item.suggestedAction
  return {
    keywordId: item.keywordId,
    keywordName: item.keywordName || item.name || item.keywordId,
    keywordRawName: item.keywordRawName || item.rawName,
    aliases: item.aliases || [],
    suggestedAction: item.modelAction || item.suggestedAction || action,
    userAction: action,
    userOverride: Boolean(item.userOverride),
    modelAction: item.modelAction || item.suggestedAction,
    modelIssueCategory: item.modelIssueCategory || item.issueCategory,
    modelIssueCategoryLabel: item.modelIssueCategoryLabel || item.issueCategoryLabel,
    modelReason: item.modelReason || item.reason || '',
    reason: item.modelReason || item.reason || '',
    reviewNote: item.reviewNote || item.note || item.reviewReason || '',
    issueCategory: item.finalIssueCategory || item.reviewIssueCategory || item.modelIssueCategory || item.issueCategory,
    issueCategoryLabel: item.finalIssueCategoryLabel || item.reviewIssueCategoryLabel || item.modelIssueCategoryLabel || item.issueCategoryLabel,
  }
}

function restoreFilterRun(detail) {
  const models = detail?.decisions || detail?.modelDecisions || detail?.items || []
  if (!models.length) {
    error.value = '该历史运行暂无可恢复的决策详情。'
    return
  }
  const reviews = new Map((detail.reviewDecisions || []).map(item => [item.keywordId, item]))
  const finals = new Map((detail.finalDecisions || []).map(item => [item.keywordId, item]))
  const decisions = models.map(model => ({ ...model, ...(reviews.get(model.keywordId) || {}), ...(finals.get(model.keywordId) || {}) }))
  activeFilterRunId.value = detail.filterRunId || activeFilterRunId.value
  activeFilterRunRevision.value = detail.revision ?? null
  activeFilterRunStatus.value = detail.status || ''
  previewResults.value = decisions.map(normalizeRunDecision)
  streamingDecisions.value = []
  const candidateTotal = Number(detail.candidateTotal || previewResults.value.length)
  const decisionTotal = Number(detail.decisionTotal || previewResults.value.length)
  filterIncomplete.value = !['reviewable', 'applied'].includes(detail.status) || decisionTotal !== candidateTotal
  streamProgress.value = {
    total: candidateTotal,
    current: decisionTotal,
    stage: '',
    batch: 0,
    batchTotal: 0,
    pending: Number(detail.pendingTotal || Math.max(0, candidateTotal - decisionTotal)),
    status: detail.status,
  }
  previewExpanded.value = true
  filterView.value = 'current'
  skillStatus.value = `已恢复过滤运行 ${activeFilterRunId.value}，共 ${decisionTotal} 条决策。`
  syncFilterRoute()
  loadReviewSummary()
  loadIssueOverview()
  loadGraphObservability()
}

function selectHistoryRun(filterRunId) {
  activeFilterRunId.value = filterRunId
  syncFilterRoute()
  graphObservability.value = null
  clearLocalGraph()
  loadGraphObservability()
}

async function loadIssueOverview() {
  if (!selectedId.value || !activeFilterRunId.value) {
    issueOverview.value = null
    return
  }
  issueOverviewLoading.value = true
  try {
    issueOverview.value = await request(`/api/datasets/${selectedId.value}/keyword-filter-runs/${encodeURIComponent(activeFilterRunId.value)}/issue-overview`)
  } catch {
    issueOverview.value = null
  } finally {
    issueOverviewLoading.value = false
  }
}

function openEvidenceDrawer(category) {
  evidenceCategory.value = category
  evidenceKeywordId.value = ''
  evidenceResourceId.value = ''
  evidenceDrawerOpen.value = true
  syncFilterRoute()
}

function selectIssueCategory(category) {
  resultActionFilter.value = 'exclude'
  resultCategoryFilter.value = category
  resultPage.value = 1
}

function updateEvidenceState(state) {
  evidenceCategory.value = state.category || evidenceCategory.value
  evidenceKeywordId.value = state.keywordId || ''
  evidenceResourceId.value = state.resourceId || ''
  syncFilterRoute()
}

function closeEvidenceDrawer() {
  evidenceDrawerOpen.value = false
  evidenceKeywordId.value = ''
  evidenceResourceId.value = ''
  syncFilterRoute()
}

async function openRunStream(filterRunId) {
  const response = await fetch(`${baseUrl()}/api/datasets/${encodeURIComponent(selectedId.value)}/keyword-filter-runs/${encodeURIComponent(filterRunId)}/stream`)
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}: ${await response.text()}`), { status: response.status })
  return response
}

async function createFilterRun() {
  const created = await request(`/api/datasets/${selectedId.value}/keyword-filter-runs`, { method: 'POST' })
  const filterRunId = created.filterRunId || created.run?.filterRunId
  if (!filterRunId) throw new Error('创建过滤运行未返回 filterRunId')
  activeFilterRunId.value = filterRunId
  activeFilterRunRevision.value = created.revision ?? created.run?.revision ?? null
  activeFilterRunStatus.value = created.status || created.run?.status || 'created'
  syncFilterRoute()
  loadGraphObservability()
  return filterRunId
}

async function previewFilterBySkill() {
  if (!selectedId.value || previewLoading.value) return
  previewLoading.value = true
  error.value = ''
  previewResults.value = []
  streamingDecisions.value = []
  resultPage.value = 1
  resultSearch.value = ''
  resultSearchQuery.value = ''
  streamProgress.value = { total: 0, current: 0, stage: '', batch: 0, batchTotal: 0, pending: 0, status: '' }
  filterIncomplete.value = false
  const estimatedSeconds = filterEstimatedSeconds.value
  const total = keywordCount.value
  filterElapsed.value = 0
  skillStatus.value = buildFilterStatus(total, estimatedSeconds, 0, streamProgress.value)
  if (filterTimer.id) clearInterval(filterTimer.id)
  filterTimer.id = setInterval(() => {
    filterElapsed.value += 1
    skillStatus.value = buildFilterStatus(total, estimatedSeconds, filterElapsed.value, streamProgress.value)
  }, 1000)

  let completed = false
  let usingRunApi = false
  try {
    let response
    try {
      const filterRunId = await createFilterRun()
      response = await openRunStream(filterRunId)
      usingRunApi = true
    } catch (runError) {
      const compatibilityError = [404, 405, 501].includes(runError.status)
        || runError.code === 'HTTP_ERROR'
        || /HTTP (404|405|501)/.test(runError.message || '')
      if (!compatibilityError) throw runError
      activeFilterRunId.value = ''
      activeFilterRunRevision.value = null
      activeFilterRunStatus.value = ''
      syncFilterRoute()
      skillStatus.value = '新版运行接口暂不可用，已切换兼容模式...'
      response = await fetch(`${baseUrl()}/api/datasets/${selectedId.value}/keywords/filter-by-skill/stream`)
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop()
      for (const event of events) {
        let eventType = 'message'
        let dataText = ''
        for (const line of event.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim()
          if (line.startsWith('data: ')) dataText += line.slice(6)
        }
        if (!dataText) continue
        let data
        try { data = JSON.parse(dataText) } catch { continue }
        if (eventType === 'stage') {
          streamProgress.value = { ...streamProgress.value, stage: data.stage }
        } else if (eventType === 'decision') {
          streamProgress.value = { ...streamProgress.value, total: data.total, current: data.index, batch: data.batch || 0, batchTotal: data.batchTotal || 0, pending: Math.max(0, (data.total || total) - data.index) }
          streamingDecisions.value.push({
            keywordId: data.keywordId,
            keywordName: data.keywordName,
            keywordRawName: data.keywordRawName,
            aliases: data.aliases || [],
            suggestedAction: data.shouldExclude ? 'exclude' : 'keep',
            modelAction: data.shouldExclude ? 'exclude' : 'keep',
            userAction: data.shouldExclude ? 'exclude' : 'keep',
            userOverride: false,
            reason: data.reason,
            modelReason: data.reason,
            issueCategory: data.issueCategory,
            issueCategoryLabel: data.issueCategoryLabel,
            modelIssueCategory: data.issueCategory,
            modelIssueCategoryLabel: data.issueCategoryLabel,
            reviewNote: '',
          })
        } else if (eventType === 'complete') {
          completed = true
          activeFilterRunRevision.value = data.revision ?? activeFilterRunRevision.value
          activeFilterRunStatus.value = data.status || activeFilterRunStatus.value
          filterIncomplete.value = !['complete', 'reviewable'].includes(data.status) || Number(data.decisionTotal || data.total || 0) !== total
          streamProgress.value = { ...streamProgress.value, total: data.candidateTotal || total, current: data.decisionTotal || data.total || 0, pending: data.pendingTotal || 0, status: data.status || 'incomplete' }
          previewResults.value = [...streamingDecisions.value]
          previewExpanded.value = true
          skillStatus.value = filterIncomplete.value
            ? `分析未完成：已决策 ${data.decisionTotal || data.total || 0}/${data.candidateTotal || total}，待处理 ${data.pendingTotal || 0}。`
            : `分析完成（耗时 ${filterElapsed.value}s）：共 ${data.candidateTotal || total} 个关键词，建议保留 ${data.keep || 0} 个，建议排除 ${data.exclude || 0} 个。`
        } else if (eventType === 'error') {
          throw new Error(data.error || '流式分析失败')
        }
      }
    }
    if (!completed && streamingDecisions.value.length) {
      previewResults.value = [...streamingDecisions.value]
      previewExpanded.value = true
      skillStatus.value = `分析完成（耗时 ${filterElapsed.value}s）：共 ${streamingDecisions.value.length} 个关键词。`
    } else if (!completed) {
      throw new Error('分析未返回任何结果')
    }
    if (usingRunApi) filterHistoryRefreshKey.value += 1
    if (usingRunApi) await loadReviewSummary()
    if (usingRunApi) await loadIssueOverview()
  } catch (streamError) {
    if (!completed && !streamingDecisions.value.length) {
      try {
        skillStatus.value = '流式连接失败，正在使用普通模式重试...'
        const result = await request(`/api/datasets/${selectedId.value}/keywords/filter-by-skill`, { method: 'POST' })
        if (result.error && !result.suggestions?.length) throw new Error(result.error)
        filterIncomplete.value = result.summary?.status === 'incomplete'
        previewResults.value = (result.suggestions || []).map(item => ({
          ...item,
          modelAction: item.suggestedAction,
          modelIssueCategory: item.issueCategory,
          modelIssueCategoryLabel: item.issueCategoryLabel,
          modelReason: item.reason,
          userAction: item.suggestedAction,
          userOverride: false,
          reviewNote: '',
        }))
        previewExpanded.value = true
        const summary = result.summary || {}
        streamProgress.value = { ...streamProgress.value, total: summary.candidateTotal || total, current: summary.decisionTotal || summary.total || 0, pending: summary.pendingTotal || 0, status: summary.status || 'complete' }
        skillStatus.value = filterIncomplete.value
          ? `分析未完成：已决策 ${summary.decisionTotal || 0}/${summary.candidateTotal || total}，待处理 ${summary.pendingTotal || 0}。`
          : `分析完成（耗时 ${filterElapsed.value}s）：共 ${summary.total || 0} 个关键词，建议保留 ${summary.suggested_keep || 0} 个，建议排除 ${summary.suggested_exclude || 0} 个。`
      } catch (fallbackError) {
        error.value = fallbackError.message
        skillStatus.value = ''
      }
    } else {
      error.value = streamError.message
    }
  } finally {
    clearInterval(filterTimer.id)
    filterTimer.id = null
    previewLoading.value = false
  }
}

function isReviewInvalid(item) {
  if (!activeFilterRunId.value) return item.userAction === 'exclude' && !item.issueCategory
  if (item.userAction !== 'exclude') return false
  if (!item.issueCategory || !reviewCategories.value.some(category => category.id === item.issueCategory)) return true
  return item.issueCategory === 'other' && !String(item.reviewNote || '').trim()
}

function updateReviewDecision(item, change) {
  if (reviewConflict.value || activeFilterRunStatus.value === 'applied') return
  item.userAction = change.action
  item.issueCategory = change.action === 'keep' ? null : change.issueCategory
  item.issueCategoryLabel = change.action === 'keep' ? '无' : change.issueCategoryLabel
  item.reviewNote = String(change.note || '').slice(0, 500)
  item.userOverride = item.userAction !== item.modelAction
    || item.issueCategory !== (item.modelIssueCategory || null)
    || Boolean(item.reviewNote.trim())
  if (activeFilterRunId.value) {
    dirtyReviewIds.value = new Set([...dirtyReviewIds.value, item.keywordId])
    scheduleReviewSave()
  }
}

function scheduleReviewSave() {
  clearTimeout(reviewTimer.id)
  reviewTimer.id = setTimeout(saveReviewChanges, 300)
}

async function loadReviewCategories() {
  try {
    const detail = await request(`/api/datasets/${selectedId.value}/keyword-filter-runs/${encodeURIComponent(activeFilterRunId.value)}`)
    reviewCategories.value = detail.issueCategories || detail.run?.issueCategories || []
    if (!reviewCategories.value.length) {
      reviewCategories.value = [...new Map(previewResults.value.filter(item => item.modelIssueCategory).map(item => [item.modelIssueCategory, {
        id: item.modelIssueCategory,
        label: item.modelIssueCategoryLabel || item.modelIssueCategory,
      }])).values()]
    }
  } catch {
    reviewCategories.value = []
  }
}

async function loadReviewSummary() {
  if (!activeFilterRunId.value) return
  try {
    reviewSummary.value = await request(`/api/datasets/${selectedId.value}/keyword-filter-runs/${encodeURIComponent(activeFilterRunId.value)}/review-summary`)
  } catch {
    reviewSummary.value = null
  }
  await loadReviewCategories()
}

async function saveReviewChanges() {
  if (!activeFilterRunId.value || !dirtyReviewIds.value.size || reviewSaving.value || reviewConflict.value) return
  const ids = [...dirtyReviewIds.value]
  const items = ids.map(id => previewResults.value.find(item => item.keywordId === id)).filter(Boolean)
  if (items.some(isReviewInvalid)) return
  reviewSaving.value = true
  savingReviewIds.value = new Set(ids)
  try {
    const result = await request(`/api/datasets/${selectedId.value}/keyword-filter-runs/${encodeURIComponent(activeFilterRunId.value)}/review-decisions`, {
      method: 'PATCH',
      body: JSON.stringify({
        expectedRevision: activeFilterRunRevision.value,
        changes: items.map(item => ({
          keywordId: item.keywordId,
          action: item.userAction,
          issueCategory: item.userAction === 'exclude' ? item.issueCategory : null,
          note: String(item.reviewNote || '').trim(),
        })),
      }),
    })
    activeFilterRunRevision.value = result.revision ?? result.run?.revision ?? activeFilterRunRevision.value
    reviewSummary.value = result.summary || reviewSummary.value
    const saved = new Set(ids)
    dirtyReviewIds.value = new Set([...dirtyReviewIds.value].filter(id => !saved.has(id)))
    await loadIssueOverview()
  } catch (reason) {
    if (reason.code === 'KEYWORD_FILTER_RUN_REVISION_CONFLICT' || reason.status === 409) {
      reviewConflict.value = true
      error.value = '结果已在其他窗口更新，已停止自动保存。请重新加载最新结果。'
    } else {
      error.value = `保存人工复核失败：${reason.message}`
    }
  } finally {
    reviewSaving.value = false
    savingReviewIds.value = new Set()
  }
}

async function reloadReviewRun() {
  if (!activeFilterRunId.value) return
  try {
    const detail = await request(`/api/datasets/${selectedId.value}/keyword-filter-runs/${encodeURIComponent(activeFilterRunId.value)}`)
    dirtyReviewIds.value = new Set()
    reviewConflict.value = false
    restoreFilterRun(detail)
  } catch (reason) {
    error.value = `重新加载复核结果失败：${reason.message}`
  }
}

const previewKeepCount = computed(() => previewResults.value.filter(item => item.userAction === 'keep').length)
const previewExcludeCount = computed(() => previewResults.value.filter(item => item.userAction === 'exclude').length)
const reviewInvalidCount = computed(() => previewResults.value.filter(isReviewInvalid).length)
const localReviewSummary = computed(() => ({
  modelKeep: previewResults.value.filter(item => item.modelAction === 'keep').length,
  modelExclude: previewResults.value.filter(item => item.modelAction === 'exclude').length,
  changedToKeep: previewResults.value.filter(item => item.modelAction === 'exclude' && item.userAction === 'keep').length,
  changedToExclude: previewResults.value.filter(item => item.modelAction === 'keep' && item.userAction === 'exclude').length,
  categoryChanged: previewResults.value.filter(item => item.userAction === 'exclude' && item.issueCategory !== item.modelIssueCategory).length,
  finalKeep: previewKeepCount.value,
  finalExclude: previewExcludeCount.value,
  invalidDecisionCount: reviewInvalidCount.value,
}))
const displayedReviewSummary = computed(() => dirtyReviewIds.value.size ? localReviewSummary.value : (reviewSummary.value || localReviewSummary.value))
const filterCanApply = computed(() => !filterIncomplete.value
  && activeFilterRunStatus.value !== 'applied'
  && !reviewInvalidCount.value
  && (!activeFilterRunId.value || !dirtyReviewIds.value.size)
  && !reviewSaving.value
  && !reviewConflict.value
  && previewResults.value.length === keywordCount.value
  && streamProgress.value.current === keywordCount.value)

function categoryLabel(item) {
  return item?.issueCategoryLabel || (item?.userAction === 'exclude' ? '未分类' : '无')
}

const resultCategoryOptions = computed(() => {
  const counts = new Map()
  previewResults.value.filter(item => item.userAction === 'exclude').forEach(item => {
    const id = item.issueCategory || 'other'
    counts.set(id, (counts.get(id) || 0) + 1)
  })
  return [...counts.entries()].map(([id, count]) => {
    const source = previewResults.value.find(item => (item.issueCategory || 'other') === id)
    return { id, label: source?.issueCategoryLabel || '未分类', count }
  })
})
const filteredPreviewResults = computed(() => {
  const query = resultSearchQuery.value.trim().toLocaleLowerCase()
  return previewResults.value.filter(item => {
    if (reviewInvalidOnly.value && !isReviewInvalid(item)) return false
    if (resultActionFilter.value !== 'all' && item.userAction !== resultActionFilter.value) return false
    if (resultCategoryFilter.value !== 'all'
      && (item.userAction !== 'exclude' || (item.issueCategory || 'other') !== resultCategoryFilter.value)) return false
    if (!query) return true
    const haystack = [item.keywordName, item.keywordRawName, item.rawName, item.keywordId, ...(item.aliases || [])]
      .filter(Boolean).join(' ').toLocaleLowerCase()
    return haystack.includes(query)
  })
})
const resultPageCount = computed(() => Math.max(1, Math.ceil(filteredPreviewResults.value.length / resultPageSize.value)))
const pagedPreviewResults = computed(() => {
  const start = (resultPage.value - 1) * resultPageSize.value
  return filteredPreviewResults.value.slice(start, start + resultPageSize.value)
})
const resultRangeLabel = computed(() => {
  const total = filteredPreviewResults.value.length
  if (!total) return '当前无匹配结果'
  const start = (resultPage.value - 1) * resultPageSize.value + 1
  return `当前显示 ${start}-${Math.min(resultPage.value * resultPageSize.value, total)} / ${total}`
})
function resetResultPage() { resultPage.value = 1 }
function updateResultSearch(value) {
  resultSearch.value = value
  clearTimeout(resultSearchTimer)
  resultSearchTimer = setTimeout(() => { resultSearchQuery.value = value; resetResultPage() }, 300)
}
function changeResultPage(delta) { resultPage.value = Math.min(resultPageCount.value, Math.max(1, resultPage.value + delta)) }

async function applyFilterDecisions() {
  if (!selectedId.value || applyLoading.value || !filterCanApply.value) return
  applyLoading.value = true
  error.value = ''
  try {
    const beforeTotal = keywordCount.value
    const decisions = previewResults.value.map(item => ({
      keywordId: item.keywordId,
      action: item.userAction,
      issueCategory: item.userAction === 'exclude' ? item.issueCategory : null,
      reason: item.reason,
      overridden: item.userOverride,
    }))
    const useRunApply = Boolean(activeFilterRunId.value)
    const path = useRunApply
      ? `/api/datasets/${selectedId.value}/keyword-filter-runs/${encodeURIComponent(activeFilterRunId.value)}/apply`
      : `/api/datasets/${selectedId.value}/keywords/filter-apply`
    const body = useRunApply
      ? { revision: activeFilterRunRevision.value, expectedRevision: activeFilterRunRevision.value, decisions }
      : { decisions }
    const result = await request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (result.error) throw new Error(result.error)
    appliedFilterState.value = normalizeAppliedState(result, decisions, beforeTotal)
    filterResults.value = previewResults.value.map(item => ({
      keywordId: item.keywordId,
      name: item.keywordName,
      excluded: item.userAction === 'exclude',
      issueCategory: item.issueCategory,
      issueCategoryLabel: item.issueCategoryLabel,
      reason: item.reason,
    }))
    filterResultsExpanded.value = filterResults.value.length <= 15
    previewResults.value = []
    graphView.value = 'after'
    await load()
    const state = normalizedFilterState.value
    skillStatus.value = `已应用过滤决策：保留 ${state.kept} 个，排除 ${state.excluded} 个。`
    filterHistoryRefreshKey.value += 1
    await loadIssueOverview()
  } catch (reason) {
    error.value = reason.message
  } finally {
    applyLoading.value = false
  }
}

function handleNodeClick(node) {
  selectedNode.value = node
  selectedEdge.value = null
}

function handleEdgeClick(edge) {
  selectedEdge.value = edge
  selectedNode.value = null
}

function nodeTypeLabel(type) {
  return nodeTypeLabels[type] || type || '未知类型'
}

function edgeTypeLabel(type) {
  return edgeTypeLabels[type] || type || '未知关系'
}

function nodeName(nodeId) {
  const node = nodeLookup.value.get(nodeId)
  return node?.displayName || node?.name || node?.rawName || nodeId || '-'
}

function confidence(value) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '-'
}

function sourceMethodNames(node) {
  const properties = node?.properties || {}
  const methods = node?.sourceMethods || properties.sourceMethods || [node?.sourceMethod || properties.sourceMethod]
  return [...new Set(methods.filter(Boolean))].map(item => sourceMethodLabels[item] || item)
}

async function buildFormalKnowledge() {
  if (!selectedId.value || formalBuilding.value || !canBuildFormalKnowledge.value) return
  formalBuilding.value = true
  error.value = ''
  try {
    const task = await request(`/api/datasets/${selectedId.value}/formal-knowledge/tasks`, { method: 'POST' })
    graphInfo.value = `正式知识构建任务已创建：${task.id}，已按保留关键词调度。`
  } catch (reason) {
    error.value = reason.message
  } finally {
    formalBuilding.value = false
  }
}

function handleBeforeUnload(event) {
  if (!dirtyReviewIds.value.size) return
  event.preventDefault()
  event.returnValue = ''
}

onBeforeRouteLeave(() => {
  if (!dirtyReviewIds.value.size) return true
  return window.confirm('尚有未保存的复核修改，确认离开当前页面吗？')
})

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  load()
})
onUnmounted(() => {
  if (filterTimer.id) clearInterval(filterTimer.id)
  clearTimeout(reviewTimer.id)
  clearTimeout(resultSearchTimer)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<template>
  <section class="quality-page">
    <header class="page-header">
      <div>
        <h1>质量分析</h1>
        <p class="muted">资料加工任务 {{ route.params.batchId }}</p>
      </div>
      <div v-if="selectedDataset" class="page-actions">
        <button v-if="selectedDataset.state !== 'published'" class="button" :disabled="publishing || !selectedGovernance.canPublish" :title="selectedGovernance.canPublish ? selectedGovernance.nextAction : `暂不可发布：${selectedGovernance.nextAction}`" @click="publishSelected">
          {{ publishing ? '正在发布' : (selectedGovernance.requiresForce ? '历史兼容发布' : '发布数据集') }}
        </button>
        <span v-else class="dataset-state">当前版本已发布</span>
        <button class="button primary" :disabled="formalBuilding || !canBuildFormalKnowledge" :title="formalBuildTooltip" @click="buildFormalKnowledge">
          {{ formalBuilding ? '正在创建任务' : '基于保留关键词构建正式知识' }}
        </button>
      </div>
    </header>

    <BatchStepNav :batch-id="route.params.batchId" />

    <div class="panel dataset-bar">
      <label for="dataset-select">数据集</label>
      <select id="dataset-select" v-model="selectedId" :disabled="loading" @change="changeDataset">
        <option v-for="dataset in visibleDatasets" :key="dataset.id" :value="dataset.id">{{ dataset.id }}</option>
      </select>
      <span v-if="selectedDataset" class="dataset-state">{{ selectedGovernance.statusLabel }}</span>
    </div>

    <section v-if="selectedDataset" class="panel governance-panel" aria-label="发布治理状态">
      <div>
        <strong>{{ selectedGovernance.reasonLabel }}</strong>
        <span v-if="selectedDataset.governance">状态版本 {{ selectedDataset.governance.statusVersion }}</span>
        <span v-else>该版本尚无新治理数据，沿用历史兼容规则</span>
      </div>
      <div v-if="selectedGovernance.blockedChecks.length" class="blocked-checks">
        <span v-for="item in selectedGovernance.blockedChecks" :key="item.key">{{ item.label }}未通过</span>
      </div>
      <p><strong>下一步：</strong>{{ selectedGovernance.nextAction }}</p>
    </section>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="filterStateError" class="alert error">{{ filterStateError }}</div>
    <div v-if="loading" class="panel empty">正在加载数据集...</div>
    <div v-else-if="!selectedId" class="panel empty">当前任务暂无可用数据集。</div>

    <template v-else>
      <section class="panel filter-panel">
        <div class="section-heading">
          <div>
            <h2>关键词智能过滤</h2>
            <p class="muted">使用关键词过滤策略生成保留或排除建议，确认后统一应用。</p>
          </div>
          <button class="button" :disabled="skillLoading" @click="toggleSkillEditor">{{ showSkillEditor ? '关闭策略编辑' : '编辑过滤策略' }}</button>
        </div>

        <div class="filter-view-tabs" role="tablist" aria-label="关键词过滤视图">
          <button role="tab" :aria-selected="filterView === 'current'" :class="{ active: filterView === 'current' }" @click="switchFilterView('current')">本次过滤</button>
          <button role="tab" :aria-selected="filterView === 'history'" :class="{ active: filterView === 'history' }" @click="switchFilterView('history')">历史运行</button>
        </div>

        <KeywordFilterHistory
          v-if="filterView === 'history'"
          :dataset-id="selectedId"
          :active-run-id="activeFilterRunId"
          :refresh-key="filterHistoryRefreshKey"
          @select-run="selectHistoryRun"
          @restore-run="restoreFilterRun"
        />

        <div v-else>

        <div class="filter-toolbar">
          <div>
            <strong>关键词质量过滤</strong>
            <span v-if="keywordCount && !previewLoading">当前 {{ keywordCount }} 个关键词，预计耗时约 {{ filterEstimatedSeconds }} 秒</span>
            <span v-if="skillStatus" :class="['filter-status', { done: skillStatus.includes('完成') || skillStatus.includes('已应用') }]">{{ skillStatus }}</span>
          </div>
          <button class="button primary" :disabled="previewLoading || !keywordCount" @click="previewFilterBySkill">
            {{ previewLoading ? '分析中...' : '执行过滤' }}
          </button>
        </div>

        <div v-if="previewLoading" class="progress-block">
          <div class="progress-summary">
            <span>{{ streamProgress.current || 0 }}/{{ streamProgress.total || keywordCount }}</span>
            <strong>{{ Math.round(((streamProgress.current || 0) / (streamProgress.total || keywordCount || 1)) * 100) }}%</strong>
          </div>
          <div class="muted">{{ streamProgress.batchTotal ? `后端批次：${streamProgress.batch || 0}/${streamProgress.batchTotal}` : '正在准备批次' }} · 待处理 {{ streamProgress.pending || 0 }}</div>
          <div class="progress-track"><div class="progress-value" :style="{ width: `${Math.round(((streamProgress.current || 0) / (streamProgress.total || keywordCount || 1)) * 100)}%` }"></div></div>
        </div>

        <div v-if="showSkillEditor" class="skill-editor">
          <textarea v-model="skillContent" rows="18" :disabled="skillLoading" aria-label="关键词过滤策略"></textarea>
          <div class="editor-actions">
            <button class="button primary" :disabled="skillLoading" @click="saveSkill">{{ skillLoading ? '保存中...' : '保存策略' }}</button>
            <button class="button" :disabled="skillLoading" @click="loadSkill">重新加载</button>
          </div>
        </div>

        <div v-if="streamingDecisions.length && previewLoading" class="result-list compact-list">
          <article v-for="item in streamingDecisions" :key="item.keywordId" :class="item.userAction">
            <span>{{ item.userAction === 'exclude' ? '排除' : '保留' }}</span>
            <strong>{{ item.keywordName }}</strong>
            <span class="category-pill">{{ categoryLabel(item) }}</span>
            <p>{{ item.reason }}</p>
          </article>
        </div>

        <KeywordIssueOverview
          v-if="activeFilterRunId && !previewLoading"
          :overview="issueOverview"
          :loading="issueOverviewLoading"
          :selected-category="resultCategoryFilter !== 'all' ? resultCategoryFilter : (evidenceDrawerOpen ? evidenceCategory : '')"
          @select="selectIssueCategory"
          @inspect="openEvidenceDrawer"
        />

        <div v-if="previewResults.length" class="results-panel">
          <button class="collapse-heading" @click="previewExpanded = !previewExpanded">
            <strong>过滤建议</strong>
            <span>保留 {{ previewKeepCount }}，排除 {{ previewExcludeCount }}</span>
          </button>
          <div v-show="previewExpanded" class="result-controls">
            <div class="review-summary" aria-label="人工复核差异汇总">
              <span>模型：保留 {{ displayedReviewSummary.modelKeep ?? 0 }} / 排除 {{ displayedReviewSummary.modelExclude ?? 0 }}</span>
              <span>改为保留 {{ displayedReviewSummary.changedToKeep ?? 0 }}</span>
              <span>改为排除 {{ displayedReviewSummary.changedToExclude ?? 0 }}</span>
              <span>类别变化 {{ displayedReviewSummary.categoryChanged ?? 0 }}</span>
              <strong>最终：保留 {{ displayedReviewSummary.finalKeep ?? previewKeepCount }} / 排除 {{ displayedReviewSummary.finalExclude ?? previewExcludeCount }}</strong>
            </div>
            <div v-if="reviewConflict" class="review-conflict" role="alert">
              <span>结果已在其他窗口更新，自动保存已停止。</span>
              <button class="button" @click="reloadReviewRun">重新加载最新结果</button>
            </div>
            <div class="result-filters">
              <select v-model="resultActionFilter" aria-label="动作筛选" @change="resetResultPage">
                <option value="all">全部动作</option><option value="keep">保留</option><option value="exclude">排除</option>
              </select>
              <select v-model="resultCategoryFilter" aria-label="问题类别筛选" @change="resetResultPage">
                <option value="all">全部问题类别</option>
                <option v-for="option in resultCategoryOptions" :key="option.id" :value="option.id">{{ option.label }}（{{ option.count }}）</option>
              </select>
              <input :value="resultSearch" type="search" placeholder="全局搜索关键词、别名或 ID" aria-label="全局搜索关键词" @input="updateResultSearch($event.target.value)">
              <select v-model.number="resultPageSize" aria-label="每页条数" @change="resetResultPage"><option :value="50">每页 50 条</option><option :value="100">每页 100 条</option></select>
              <button type="button" :class="['button', { active: reviewInvalidOnly }]" :disabled="!reviewInvalidCount" @click="reviewInvalidOnly = !reviewInvalidOnly; resetResultPage()">问题项 {{ reviewInvalidCount }}</button>
            </div>
            <span class="muted">{{ resultRangeLabel }}，共 {{ previewResults.length }} 条决策 · {{ reviewSaving ? '正在自动保存' : (dirtyReviewIds.size ? `待保存 ${dirtyReviewIds.size} 条` : '已保存') }}</span>
          </div>
          <div v-show="previewExpanded" class="result-list review-list">
            <KeywordReviewDecision
              v-for="item in pagedPreviewResults"
              :key="item.keywordId"
              :item="item"
              :categories="reviewCategories"
              :disabled="reviewConflict || activeFilterRunStatus === 'applied'"
              :saving="savingReviewIds.has(item.keywordId)"
              :invalid="isReviewInvalid(item)"
              @change="updateReviewDecision(item, $event)"
            />
            <div v-if="!pagedPreviewResults.length" class="empty-result">未找到匹配关键词</div>
          </div>
          <div v-show="previewExpanded && filteredPreviewResults.length" class="pagination">
            <button class="button" :disabled="resultPage <= 1" @click="changeResultPage(-1)">上一页</button>
            <span>第 {{ resultPage }} / {{ resultPageCount }} 页</span>
            <button class="button" :disabled="resultPage >= resultPageCount" @click="changeResultPage(1)">下一页</button>
          </div>
          <div class="apply-actions">
            <span>仅“保留/排除”控件会修改决策。<span v-if="reviewInvalidCount">尚有 {{ reviewInvalidCount }} 条问题项需处理。</span></span>
            <button class="button primary" :disabled="applyLoading || !filterCanApply" @click="applyFilterDecisions">{{ applyLoading ? '正在应用' : (filterCanApply ? '应用决策' : '等待完整决策') }}</button>
          </div>
        </div>

        <div v-if="filterResults.length" class="results-panel applied-results">
          <button class="collapse-heading" @click="filterResultsExpanded = !filterResultsExpanded">
            <strong>已应用决策</strong>
            <span>共 {{ filterResults.length }} 个</span>
          </button>
          <div v-show="filterResultsExpanded" class="result-list compact-list">
            <article v-for="item in filterResults" :key="item.keywordId" :class="item.excluded ? 'exclude' : 'keep'">
              <span>{{ item.excluded ? '排除' : '保留' }}</span>
              <strong>{{ item.name }}</strong>
              <span class="category-pill">{{ item.issueCategoryLabel || (item.excluded ? '未分类' : '无') }}</span>
              <p>{{ item.reason }}</p>
            </article>
          </div>
        </div>
        </div>
      </section>

      <section class="stats-grid" aria-label="关键词过滤统计">
        <article><strong>{{ normalizedFilterState.beforeTotal }}</strong><span>过滤前关键词</span></article>
        <article><strong>{{ normalizedFilterState.afterTotal }}</strong><span>过滤后关键词</span></article>
        <article class="keep"><strong>{{ normalizedFilterState.kept }}</strong><span>保留关键词</span></article>
        <article class="exclude"><strong>{{ normalizedFilterState.excluded }}</strong><span>排除关键词</span></article>
      </section>

      <section class="panel graph-panel">
        <div class="section-heading">
          <div>
            <h2>知识图谱诊断工作台</h2>
            <p class="muted">从完整投影搜索问题节点，查看局部关系并下钻来源证据。</p>
          </div>
        </div>
        <GraphObservabilitySummary
          class="graph-summary"
          :data="graphObservability"
          :local-counts="localGraph.counts"
          :loading="graphLoading && !graphObservability"
          :error="!graphObservability ? graphError : ''"
        />
        <GraphDiagnosisWorkbench
          v-if="selectedId"
          :dataset-id="selectedId"
          :filter-run-id="activeFilterRunId"
          :categories="issueOverview?.categories || []"
        />
      </section>
    </template>

    <KeywordEvidenceDrawer
      :open="evidenceDrawerOpen"
      :dataset-id="selectedId"
      :filter-run-id="activeFilterRunId"
      :category="evidenceCategory"
      :keyword-id="evidenceKeywordId"
      :resource-id="evidenceResourceId"
      @close="closeEvidenceDrawer"
      @state-change="updateEvidenceState"
    />
  </section>
</template>

<style scoped>
.quality-page { max-width: 1680px; margin: 0 auto; }
.page-header, .section-heading, .page-actions, .filter-toolbar, .apply-actions, .editor-actions, .progress-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.page-header { margin-bottom: 16px; }
.page-header h1, .section-heading h2 { margin: 0; }
.page-actions { justify-content: flex-end; flex-wrap: wrap; }
.panel { margin-bottom: 16px; padding: 16px; border: 1px solid #dce3ec; border-radius: 8px; background: #fff; }
.dataset-bar { display: flex; align-items: center; gap: 10px; }
.dataset-bar label { font-weight: 700; color: #243447; }
.dataset-bar select { min-width: 320px; padding: 8px 10px; border: 1px solid #b9c5d3; border-radius: 6px; background: #fff; }
.dataset-state { color: #5c6878; font-size: 13px; }
.governance-panel { display: grid; grid-template-columns: minmax(240px, 1fr) auto minmax(260px, 1fr); align-items: center; gap: 16px; padding-block: 12px; }
.governance-panel > div:first-child { display: grid; gap: 4px; color: #66758a; font-size: 12px; }
.governance-panel > div:first-child strong { color: #243447; font-size: 13px; }
.governance-panel p { margin: 0; color: #526174; font-size: 13px; }
.blocked-checks { display: flex; flex-wrap: wrap; gap: 6px; }
.blocked-checks span { padding: 4px 7px; border: 1px solid #efb4b4; border-radius: 4px; color: #a12622; background: #fff2f2; font-size: 11px; }
.muted { margin: 4px 0 0; color: #66758a; font-size: 13px; }
.button { min-height: 34px; padding: 7px 12px; border: 1px solid #b9c5d3; border-radius: 6px; background: #fff; color: #26384d; cursor: pointer; }
.button.primary { border-color: #1769aa; background: #1769aa; color: #fff; }
.button:disabled { cursor: not-allowed; opacity: .55; }
.alert { margin-bottom: 12px; padding: 10px 12px; border-radius: 6px; }
.alert.error { border: 1px solid #efb4b4; background: #fff2f2; color: #a12622; }
.alert.info { margin-top: 10px; border: 1px solid #b9d4ee; background: #eef6fd; color: #24557a; }
.empty { padding: 36px 16px; text-align: center; color: #6b7787; }
.empty.compact { padding: 18px 8px; }
.filter-view-tabs { display: inline-flex; margin-top: 14px; border: 1px solid #b9c5d3; border-radius: 6px; overflow: hidden; }
.filter-view-tabs button { min-height: 34px; padding: 7px 14px; border: 0; border-right: 1px solid #b9c5d3; background: #fff; color: #40536a; cursor: pointer; }
.filter-view-tabs button:last-child { border-right: 0; }
.filter-view-tabs button.active { background: #1769aa; color: #fff; }
.filter-view-tabs + * { margin-top: 12px; }
.filter-toolbar { margin-top: 14px; padding: 12px; border: 1px solid #cbd9e8; border-radius: 6px; background: #f7fafc; }
.filter-toolbar > div { display: grid; gap: 4px; }
.filter-toolbar span { color: #66758a; font-size: 13px; }
.filter-status.done { color: #18733c; }
.progress-block { margin-top: 10px; }
.progress-summary { margin-bottom: 6px; color: #40536a; font-size: 13px; }
.progress-track { height: 8px; overflow: hidden; border-radius: 4px; background: #e1e8f0; }
.progress-value { height: 100%; min-width: 0; background: #1976d2; transition: width .2s ease; }
.skill-editor { margin-top: 12px; padding: 12px; border: 1px solid #cbd9e8; border-radius: 6px; }
.skill-editor textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #b9c5d3; border-radius: 6px; resize: vertical; font: 13px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }
.editor-actions { justify-content: flex-end; margin-top: 8px; }
.results-panel { margin-top: 12px; border: 1px solid #cbd9e8; border-radius: 6px; overflow: hidden; }
.collapse-heading { width: 100%; display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 0; background: #f5f8fb; color: #26384d; cursor: pointer; }
.result-controls { display: grid; gap: 8px; padding: 10px; border-bottom: 1px solid #dce3ec; background: #fafbfd; }
.review-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; padding: 8px 10px; border-radius: 6px; background: #eef6fd; color: #40536a; font-size: 12px; }
.review-summary strong { margin-left: auto; color: #20344d; }
.review-conflict { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border: 1px solid #efb4b4; border-radius: 6px; background: #fff2f2; color: #a12622; }
.result-filters { display: grid; grid-template-columns: auto auto minmax(180px, 1fr) auto auto; gap: 8px; }
.result-filters select, .result-filters input { min-width: 0; padding: 7px 9px; border: 1px solid #b9c5d3; border-radius: 5px; background: #fff; color: #26384d; }
.result-filters .button.active { border-color: #ad351f; background: #fff0ed; color: #ad351f; }
.result-list { display: grid; gap: 8px; max-height: 420px; padding: 10px; overflow: auto; }
.result-list.review-list { max-height: 620px; }
.result-list:not(.review-list) article { display: grid; grid-template-columns: 58px minmax(120px, 220px) minmax(90px, 150px) 1fr auto; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid #dce3ec; border-radius: 6px; background: #fff; text-align: left; }
.result-item { cursor: pointer; }
.result-item > span, .result-list:not(.review-list) article > span { padding: 3px 6px; border-radius: 4px; text-align: center; font-size: 12px; font-weight: 700; }
.result-item.keep > span, article.keep > span { background: #e9f7ef; color: #176b38; }
.result-item.exclude > span, article.exclude > span { background: #fff0ed; color: #ad351f; }
.result-item p, .result-list:not(.review-list) article p { margin: 0; color: #5f6d7d; font-size: 13px; }
.result-item small { color: #1769aa; }
.category-pill { padding: 3px 6px; border-radius: 4px; background: #eef3f8; color: #526174; font-size: 12px; }
.empty-result { padding: 24px; color: #66758a; text-align: center; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 8px 10px; border-top: 1px solid #dce3ec; }
.compact-list { max-height: 300px; }
.apply-actions { padding: 10px 12px; border-top: 1px solid #dce3ec; color: #66758a; font-size: 13px; }
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.stats-grid article { min-height: 92px; display: grid; align-content: center; gap: 5px; padding: 14px; border: 1px solid #dce3ec; border-radius: 8px; background: #fff; }
.stats-grid strong { color: #20344d; font-size: 28px; }
.stats-grid span { color: #66758a; }
.stats-grid .keep { border-top: 3px solid #25884b; }
.stats-grid .exclude { border-top: 3px solid #c64832; }
.view-tabs { display: inline-flex; border: 1px solid #b9c5d3; border-radius: 6px; overflow: hidden; }
.view-tabs button { min-height: 32px; padding: 6px 10px; border: 0; border-right: 1px solid #b9c5d3; background: #fff; color: #40536a; cursor: pointer; }
.view-tabs button:last-child { border-right: 0; }
.view-tabs button.active { background: #1769aa; color: #fff; }
.graph-summary { margin-top: 14px; }
.local-graph-toolbar { margin-top: 12px; }
.graph-candidate-note { margin: 8px 0 0; color: #66758a; font-size: 12px; }
.graph-layout { display: grid; grid-template-columns: minmax(620px, 1fr) 340px; gap: 14px; margin-top: 14px; }
.graph-visual { min-width: 0; }
.graph-inspector { padding: 12px; border: 1px solid #dce3ec; border-radius: 8px; background: #fafbfd; }
.graph-inspector h3 { margin: 0 0 12px; font-size: 15px; }
.inspect-card { display: grid; gap: 8px; }
.inspect-card p { margin: 0; color: #526174; font-size: 13px; line-height: 1.5; }
.type-pill { width: fit-content; padding: 3px 7px; border-radius: 4px; background: #e9f2fa; color: #24557a; font-size: 12px; }
@media (max-width: 980px) {
  .graph-layout { grid-template-columns: 1fr; }
  .governance-panel { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .section-heading, .page-header { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 640px) {
  .dataset-bar, .filter-toolbar, .apply-actions { align-items: stretch; flex-direction: column; }
  .dataset-bar select { width: 100%; min-width: 0; }
  .stats-grid { grid-template-columns: 1fr; }
  .result-filters { grid-template-columns: 1fr; }
  .result-item, .result-list:not(.review-list) article { grid-template-columns: 58px 1fr; }
  .category-pill { width: fit-content; }
  .result-item p, .result-list:not(.review-list) article p { grid-column: 1 / -1; }
}
</style>
