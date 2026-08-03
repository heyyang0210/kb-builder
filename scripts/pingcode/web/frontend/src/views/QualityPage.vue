<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import KnowledgeGraph from '../components/KnowledgeGraph.vue'
import { request } from '../api'

const route = useRoute()
const datasets = ref([])
const selectedId = ref('')
const report = ref(null)
const graphNodes = ref([])
const graphEdges = ref([])
const selectedNode = ref(null)
const selectedEdge = ref(null)
const graphMode = ref('overview')
const graphFocusNode = ref(null)
const graphLoading = ref(false)
const graphInfo = ref('')
const error = ref('')
const loading = ref(false)
const publishing = ref(false)
const formalBuilding = ref(false)
const businessReviewing = ref(false)
const businessReviewView = ref('after')
const businessBeforeNodes = ref([])
const businessReviewNote = ref('')
const filterPrompt = ref('')
const pendingBusinessStatus = ref('')
const reviewCompletedAt = ref('')

const metricLabels = {
  sourceTraceabilityRate: { label: '来源可追溯率', help: '可追溯到原始材料的文档占比' },
  parseSuccessRate: { label: '解析成功率', help: '完成规范化解析的资料占比' },
  encodingWarningRate: { label: '编码警告率', help: '存在编码异常提示的文件占比' },
  emptyFileRate: { label: '空文件率', help: '空文件占全部文件的比例' },
  duplicateGroups: { label: '重复文件组', help: '内容重复的文件分组数量' },
  unsupportedFiles: { label: '待转换文件', help: '当前流水线暂未直接处理的文件数量' },
  preparationIssueCount: { label: '预处理问题', help: '资料预处理阶段记录的问题数量' },
  metadataIssueCount: { label: '元数据提示', help: '元数据构建阶段记录的提示或问题数量' },
  excludedCCodeBlocks: { label: '排除 C/C++ 代码块', help: '规范化视图中排除的 C/C++ 代码片段数量' },
  knowledgeCount: { label: '最终知识记录', help: '通过校验并进入数据集的知识记录数量' },
  keywordCount: { label: '关键词数', help: '质量分析默认档识别并归并后的关键词数量' },
  contextEdgeCount: { label: '上下文证据数', help: '关键词匹配到文档块的证据边数量' },
  pendingKeywordCount: { label: '待确认关键词', help: '需要人工确认是否进入正式知识构建的关键词数量' },
  rejectedKeywordCount: { label: '已排除关键词', help: '已被人工排除，不进入正式知识构建的关键词数量' },
  qualityIssueCount: { label: '质量问题', help: '当前数据集聚合后的质量问题数量' },
  highSeverityIssueCount: { label: '高严重度问题', help: '阻断发布的高严重度质量问题数量' },
}

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

const knowledgeDomainLabels = {
  what: { label: 'What 是什么', help: '概念、对象、参数、规则、错误码等基础知识' },
  how: { label: 'How 怎么做', help: '步骤、配置、流程、实现方式、操作方案' },
  why: { label: 'Why 为什么', help: '原因、约束、设计取舍、风险、故障根因' },
}

const taskContextLabels = {
  troubleshooting: '排障',
  design: '设计',
  configuration: '配置',
  testing: '测试',
  migration: '迁移',
  general: '通用',
}

const sourceMethodLabels = {
  domain_term: '领域词典',
  chunk_context_keyword: '文档块上下文关键词',
  document_keyword: '文档关键词',
  document_title: '文档标题降级候选',
  model_keyword: '模型主题关键词',
  domain_glossary_title: '标题领域术语',
  knowledge_extraction_workflow_agent: '知识提取',
  knowledge_extraction_agent: '知识提取',
}

const approvalStatusLabels = {
  autoAccepted: '自动确认',
  accepted: '已确认',
  pending: '待确认',
  rejected: '已排除',
}

const businessStatusLabels = {
  businessAccepted: '业务准入',
  businessRejected: '业务排除',
  needsReview: '待业务确认',
}

const admissionStatusLabels = {
  admitted: '已生效（包含）',
  excluded: '未准入（排除）',
}

const keywordLevelLabels = {
  L1: 'L1 细粒度',
  L2: 'L2 抽象术语',
}

const businessReasonLabels = {
  scope_word: '范围词',
  file_naming_noise: '命名噪声',
  technical_identifier: '技术标识',
  domain_topic: '领域主题',
  domain_term: '领域术语',
  strong_evidence: '证据充分',
  user_confirmed: '人工确认',
  weak_evidence: '证据不足',
  needs_business_review: '需要业务确认',
  pending_keyword_approval: '关键词待确认',
}

const visibleDatasets = computed(() => datasets.value.filter(item => item.state !== 'deleted'))
const selectedDataset = computed(() => visibleDatasets.value.find(item => item.id === selectedId.value) || null)
const structuralEdgeTypes = new Set(['DOCUMENT_CONTAINS_UNIT', 'HAS_CHUNK', 'UNIT_MENTIONS_ENTITY'])
const semanticGraphEdges = computed(() => graphEdges.value.filter(edge => !structuralEdgeTypes.has(edge.type)))
const businessComparisonNodes = computed(() => {
  const before = businessBeforeNodes.value.length ? businessBeforeNodes.value : graphNodes.value
  const after = graphNodes.value
  const current = businessReviewView.value === 'before' ? before : after
  if (businessReviewView.value === 'accepted') return current.filter(node => businessStatus(node) === 'businessAccepted')
  if (businessReviewView.value === 'needsReview') return current.filter(node => businessStatus(node) === 'needsReview' || !businessStatus(node))
  if (businessReviewView.value === 'injected') return current.filter(isBusinessInjected)
  if (businessReviewView.value === 'changed') {
    const changedIds = new Set(businessChangedNodes.value.map(node => node.id))
    return current.filter(node => changedIds.has(node.id))
  }
  return current
})
const semanticGraphNodes = computed(() => {
  if (graphMode.value === 'overview') {
    return businessComparisonNodes.value.filter(node => node.type === 'Keyword')
  }
  if (!semanticGraphEdges.value.length) return graphNodes.value
  const ids = new Set(semanticGraphEdges.value.flatMap(edge => [edge.source, edge.target]))
  return graphNodes.value.filter(node => ids.has(node.id))
})
const graphPreview = computed(() => ({ nodes: semanticGraphNodes.value, edges: semanticGraphEdges.value }))
const nodeLookup = computed(() => new Map(graphNodes.value.map(node => [node.id, node])))
const metricItems = computed(() => Object.entries(report.value?.metrics || {}).map(([key, value]) => ({
  key,
  value,
  ...(metricLabels[key] || { label: key, help: '后端返回的质量指标' }),
})))
const topNodeTypes = computed(() => typeEntries(report.value?.graph?.nodeTypes, nodeTypeLabel))
const topEdgeTypes = computed(() => typeEntries(report.value?.graph?.edgeTypes, edgeTypeLabel))
const relationCards = computed(() => semanticGraphEdges.value.slice(0, 12))
const approvalState = computed(() => report.value?.graph?.keywordApprovalState || {})
const businessReviewState = computed(() => report.value?.graph?.keywordBusinessReviewState || {})
const admissionState = computed(() => report.value?.graph?.keywordAdmissionState || {})
const keywordLevelStats = computed(() => report.value?.graph?.keywordLevelStats || {})
const entityRelationStage = computed(() => report.value?.graph?.entityRelationStage || {})
const businessBeforeStats = computed(() => businessStats(businessBeforeNodes.value))
const businessAfterStats = computed(() => businessStats(graphNodes.value))
const businessChangedNodes = computed(() => {
  const before = new Map(businessBeforeNodes.value.map(node => [node.id, node]))
  return graphNodes.value
    .filter(node => {
      const previous = before.get(node.id)
      return previous && (previous.businessStatus || previous.properties?.businessStatus || '') !== (node.businessStatus || node.properties?.businessStatus || '')
    })
    .map(node => ({
      ...node,
      previousBusinessStatus: before.get(node.id)?.businessStatus || before.get(node.id)?.properties?.businessStatus || '待执行过滤',
    }))
})
const injectedKeywordCount = computed(() => graphNodes.value.filter(isBusinessInjected).length)
const knowledgeDomainCards = computed(() => ['what', 'how', 'why'].map(key => ({
  key,
  count: report.value?.graph?.knowledgeDomainCounts?.[key] || 0,
  ...(knowledgeDomainLabels[key] || { label: key, help: '未定义知识域' }),
})))
const graphQualityMetrics = computed(() => [
  { key: 'relationCoverage', label: '关系覆盖率', value: report.value?.graph?.relationCoverage ?? 0, help: '已有上下文或语义边连接的知识节点占比' },
  { key: 'isolatedKnowledgeRatio', label: '孤立知识比例', value: report.value?.graph?.isolatedKnowledgeRatio ?? 0, help: '没有任何关系连接的知识节点占比' },
  { key: 'whyMissingRate', label: 'Why 缺失率', value: report.value?.graph?.whyMissingRate ?? 0, help: '未形成 Why 类知识的比例，用于提示原因/约束知识不足' },
  { key: 'evidenceCompleteness', label: '证据完整率', value: report.value?.graph?.evidenceCompleteness ?? 0, help: '上下文边具备来源、文档块和证据文本的比例' },
  { key: 'crossDocumentRelationCount', label: '跨文档关联', value: report.value?.graph?.crossDocumentRelationCount ?? 0, help: '连接不同来源文档的关系数量' },
])
const hasKeywordGraph = computed(() => ['metadata_keyword', 'model_keyword'].includes(report.value?.graph?.graphSource))
const hasOnlyLegacyStructureGraph = computed(() => {
  const graph = report.value?.graph || {}
  return graph.available && !hasKeywordGraph.value && (graph.edgeCount || 0) > 0 && (graph.contextEdgeCount || 0) === 0
})
const graphSourceLabel = computed(() => {
  const source = report.value?.graph?.graphSource
  if (source === 'final_knowledge') return '最终知识图谱'
  if (source === 'model_keyword') return '模型关键词图谱'
  if (source === 'metadata_keyword') return '元数据关键词回退图谱'
  if (source === 'empty') return '空图谱'
  return '图谱来源待确认'
})
const graphSourceDescription = computed(() => {
  const source = report.value?.graph?.graphSource
  if (source === 'final_knowledge') return '当前图谱来自显式构建的正式知识结果；质量分析默认仍以关键词图谱为入口。'
  if (source === 'model_keyword') return '当前图谱由模型主题关键词构建，只用于质量分析和确认关键词，尚未生成正式知识点、实体和关系。'
  if (source === 'metadata_keyword') return '当前图谱来自元数据关键词、领域术语与处理单元上下文，用于质量分析和检索辅助；最终知识记录仍以知识抽取结果为准。'
  if (source === 'empty') return '当前数据集没有可展示的最终知识或元数据关键词图谱。'
  return '当前数据集缺少图谱来源标记，系统会优先尝试基于现有加工产物回填新版上下文图谱。'
})

async function load({ preserveBusinessSnapshot = false } = {}) {
  loading.value = true
  error.value = ''
  try {
    datasets.value = (await request(`/api/datasets?batchId=${route.params.batchId}`)).items || []
    if (!visibleDatasets.value.some(item => item.id === selectedId.value)) selectedId.value = visibleDatasets.value[0]?.id || ''
    if (!preserveBusinessSnapshot) {
      businessBeforeNodes.value = []
      reviewCompletedAt.value = ''
      businessReviewView.value = 'after'
    }
    if (!selectedId.value) {
      report.value = null
      graphNodes.value = []
      graphEdges.value = []
      graphMode.value = 'overview'
      graphFocusNode.value = null
      graphInfo.value = ''
      return
    }
    report.value = await request(`/api/quality/reports/${selectedId.value}`)
    await loadGraphOverview({ preserveInfo: preserveBusinessSnapshot })
    selectedNode.value = null
    selectedEdge.value = null
  } catch (reason) {
    error.value = reason.message
  } finally {
    loading.value = false
  }
}

async function loadGraphOverview({ preserveInfo = false } = {}) {
  if (!preserveInfo) graphInfo.value = ''
  graphFocusNode.value = null
  graphMode.value = 'overview'
  if (!report.value?.graph?.available) {
    graphNodes.value = []
    graphEdges.value = []
    return
  }
  graphLoading.value = true
  try {
    const nodes = await request(`/api/datasets/${selectedId.value}/graph/nodes?limit=1000`)
    graphNodes.value = (nodes.items || []).filter(node => node.type === 'Keyword')
    if (!businessBeforeNodes.value.length) {
      businessBeforeNodes.value = structuredCloneSafe(graphNodes.value)
    }
    graphEdges.value = []
  } catch (reason) {
    graphNodes.value = []
    graphEdges.value = []
    graphInfo.value = reason.message
  } finally {
    graphLoading.value = false
  }
}

async function expandNode(node) {
  if (!node?.id || !selectedId.value) return
  graphLoading.value = true
  error.value = ''
  try {
    const payload = await request(`/api/datasets/${selectedId.value}/graph/neighborhood?nodeId=${encodeURIComponent(node.id)}&limit=50`)
    graphMode.value = 'neighborhood'
    graphFocusNode.value = payload.focusNode || node
    graphNodes.value = payload.nodes || []
    graphEdges.value = payload.edges || []
    graphInfo.value = payload.truncated ? '当前仅显示部分上下文边，已按上限截断。' : '当前显示所选关键词的一层上下文。'
    selectedNode.value = graphFocusNode.value
    selectedEdge.value = null
  } catch (reason) {
    error.value = reason.message
  } finally {
    graphLoading.value = false
  }
}

async function resetGraph() {
  await loadGraphOverview()
  selectedNode.value = null
  selectedEdge.value = null
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value || []))
}

function isBusinessInjected(node) {
  const methods = node?.sourceMethods || node?.properties?.sourceMethods || [node?.sourceMethod || node?.properties?.sourceMethod]
  return methods.some(method => ['domain_term', 'domain_glossary_title', 'deterministic_title_glossary'].includes(method))
}

function businessStatus(node) {
  return node?.businessStatus || node?.properties?.businessStatus || ''
}

function businessStats(nodes) {
  const values = nodes || []
  const stats = { total: values.length, businessAccepted: 0, businessRejected: 0, needsReview: 0, injected: 0 }
  values.forEach(node => {
    const status = businessStatus(node)
    if (status === 'businessAccepted') stats.businessAccepted += 1
    else if (status === 'businessRejected') stats.businessRejected += 1
    else stats.needsReview += 1
    if (isBusinessInjected(node)) stats.injected += 1
  })
  return stats
}

async function publishSelected() {
  if (!selectedDataset.value || publishing.value) return
  const dataset = selectedDataset.value
  const needsForce = !dataset.qualityPassed || dataset.publishable === false
  if (needsForce && !window.confirm(`数据集 ${dataset.id} 当前显示质量未通过。\n\n确认仍要发布该数据集版本吗？`)) return
  publishing.value = true
  error.value = ''
  try {
    await request(`/api/datasets/${dataset.id}/publish?force=${needsForce}`, { method: 'POST' })
    await load({ preserveBusinessSnapshot: true })
  } catch (reason) {
    error.value = reason.message
  } finally {
    publishing.value = false
  }
}

function metricValue(key, value) {
  if (typeof value !== 'number') return value
  if (key.endsWith('Rate') || value <= 1) return `${Math.round(value * 100)}%`
  return value
}

function nodeTypeLabel(type) {
  return nodeTypeLabels[type] || type || '未知类型'
}

function edgeTypeLabel(type) {
  return edgeTypeLabels[type] || type || '未知关系'
}

function knowledgeDomainLabel(domain) {
  return knowledgeDomainLabels[domain]?.label || domain || '未归类知识域'
}

function taskContextLabel(context) {
  return taskContextLabels[context] || context || '通用'
}

function sourceMethodNames(node) {
  const properties = node?.properties || {}
  const methods = node?.sourceMethods || properties.sourceMethods || [node?.sourceMethod || properties.sourceMethod]
  return [...new Set(methods.filter(Boolean))].map(item => sourceMethodLabels[item] || item)
}

function typeEntries(value, labeler) {
  return Object.entries(value || {})
    .map(([type, count]) => ({ type, label: labeler(type), count }))
    .sort((a, b) => b.count - a.count)
}

function nodeName(nodeId) {
  const node = nodeLookup.value.get(nodeId)
  return node?.displayName || node?.name || node?.rawName || nodeId || '-'
}

function confidence(value) {
  if (typeof value !== 'number') return '-'
  return `${Math.round(value * 100)}%`
}

function handleNodeClick(node) {
  selectedNode.value = node
  selectedEdge.value = null
  if (node?.type === 'Keyword') {
    expandNode(node)
  }
}

function handleEdgeClick(edge) {
  selectedEdge.value = edge
  selectedNode.value = null
}

function approvalLabel(value) {
  return approvalStatusLabels[value] || value || '待确认'
}

function admissionLabel(value) {
  return admissionStatusLabels[value] || value || '未准入（排除）'
}

function keywordLevelLabel(value) {
  return keywordLevelLabels[value] || value || '未分层'
}

function readAdmissionStatus(node) {
  if (!node) return 'excluded'
  const explicit = node.admissionStatus || node.properties?.admissionStatus
  if (explicit) return explicit
  const approval = node.approvalStatus || node.properties?.approvalStatus || 'autoAccepted'
  const business = node.businessStatus || node.properties?.businessStatus || ''
  if ((approval === 'autoAccepted' || approval === 'accepted') && business === 'businessAccepted') return 'admitted'
  return 'excluded'
}

function businessStatusLabel(value) {
  return businessStatusLabels[value] || value || '待执行过滤'
}

function businessReasonNames(values) {
  return (values || []).map(item => businessReasonLabels[item] || item)
}

async function updateKeywordStatus(status) {
  if (!selectedId.value || !selectedNode.value?.id) return
  error.value = ''
  try {
    await request(`/api/datasets/${selectedId.value}/keywords/${encodeURIComponent(selectedNode.value.id)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    })
    await load({ preserveBusinessSnapshot: true })
  } catch (reason) {
    error.value = reason.message
  }
}

async function updateAdmissionStatus(admissionStatus) {
  if (!selectedId.value || !selectedNode.value?.id) return
  error.value = ''
  try {
    await request(`/api/datasets/${selectedId.value}/keywords/${encodeURIComponent(selectedNode.value.id)}/admission`, {
      method: 'POST',
      body: JSON.stringify({ admission_status: admissionStatus, note: '', operator_label: '当前用户' }),
    })
    await load({ preserveBusinessSnapshot: true })
  } catch (reason) {
    error.value = reason.message
  }
}

const l2TermName = ref('')
const l2TermCanonical = ref('')
const l2TermDescription = ref('')
const l2TermLinkedIds = ref([])
const creatingL2Term = ref(false)
const termExpansion = ref(null)
const expandingTerm = ref(false)

async function createL2Term() {
  if (!selectedId.value || !l2TermName.value.trim() || creatingL2Term.value) return
  creatingL2Term.value = true
  error.value = ''
  try {
    const result = await request(`/api/datasets/${selectedId.value}/keywords/l2-terms`, {
      method: 'POST',
      body: JSON.stringify({
        name: l2TermName.value.trim(),
        canonical_name: l2TermCanonical.value.trim() || l2TermName.value.trim(),
        description: l2TermDescription.value.trim(),
        linked_l1_ids: l2TermLinkedIds.value,
      }),
    })
    l2TermName.value = ''
    l2TermCanonical.value = ''
    l2TermDescription.value = ''
    l2TermLinkedIds.value = []
    graphInfo.value = `L2 术语「${result.termName}」已创建，关联 ${result.linkedL1Count} 个 L1 关键词。`
    await load({ preserveBusinessSnapshot: true })
  } catch (reason) {
    error.value = reason.message
  } finally {
    creatingL2Term.value = false
  }
}

async function expandTerm(termId) {
  if (!selectedId.value || !termId || expandingTerm.value) return
  expandingTerm.value = true
  error.value = ''
  try {
    termExpansion.value = await request(`/api/datasets/${selectedId.value}/graph/term-expansion?termId=${encodeURIComponent(termId)}&limit=50`)
  } catch (reason) {
    error.value = reason.message
  } finally {
    expandingTerm.value = false
  }
}

function toggleL1Link(l1Id) {
  const idx = l2TermLinkedIds.value.indexOf(l1Id)
  if (idx >= 0) l2TermLinkedIds.value.splice(idx, 1)
  else l2TermLinkedIds.value.push(l1Id)
}

async function reviewKeywordBusiness() {
  if (!selectedId.value || businessReviewing.value) return
  if (!filterPrompt.value.trim()) {
    graphInfo.value = '请输入过滤提示词'
    return
  }
  businessReviewing.value = true
  error.value = ''
  businessReviewView.value = 'after'
  graphInfo.value = '正在根据提示词过滤关键词，请稍候...'
  try {
    if (!businessBeforeNodes.value.length) {
      businessBeforeNodes.value = structuredCloneSafe(graphNodes.value)
    }
    const result = await request(`/api/datasets/${selectedId.value}/keywords/filter-by-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: filterPrompt.value })
    })
    if (result.error) {
      graphInfo.value = `过滤失败：${result.error}`
      return
    }
    await load({ preserveBusinessSnapshot: true })
    reviewCompletedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    graphInfo.value = `关键词过滤完成：保留 ${result.admitted || 0} 个，排除 ${result.excluded || 0} 个。`
  } catch (reason) {
    error.value = reason.message
  } finally {
    businessReviewing.value = false
  }
}

function selectComparisonNode(node) {
  if (!node) return
  selectedNode.value = node
  selectedEdge.value = null
  if (node.type === 'Keyword') expandNode(node)
}

function comparisonModeLabel(mode) {
  return {
    after: '过滤后',
    before: '过滤前',
    accepted: '业务准入',
    needsReview: '待业务确认',
    injected: '业务注入',
    changed: '发生变化',
  }[mode] || mode
}

async function updateKeywordBusinessStatus(status) {
  if (!selectedId.value || !selectedNode.value?.id) return
  pendingBusinessStatus.value = status
  businessReviewNote.value = ''
}

function cancelBusinessDecision() {
  pendingBusinessStatus.value = ''
  businessReviewNote.value = ''
}

async function confirmBusinessStatus() {
  if (!selectedId.value || !selectedNode.value?.id || !pendingBusinessStatus.value) return
  error.value = ''
  try {
    await request(`/api/datasets/${selectedId.value}/keywords/${encodeURIComponent(selectedNode.value.id)}/business-status`, {
      method: 'POST',
      body: JSON.stringify({
        businessStatus: pendingBusinessStatus.value,
        reasonCode: 'human_override',
        note: businessReviewNote.value,
      }),
    })
    pendingBusinessStatus.value = ''
    businessReviewNote.value = ''
    await load({ preserveBusinessSnapshot: true })
  } catch (reason) {
    error.value = reason.message
  }
}

async function buildFormalKnowledge() {
  if (!selectedId.value || formalBuilding.value) return
  formalBuilding.value = true
  error.value = ''
  try {
    const task = await request(`/api/datasets/${selectedId.value}/formal-knowledge/tasks`, { method: 'POST' })
    graphInfo.value = `正式知识构建任务已创建：${task.id}，已按业务准入关键词调度。`
  } catch (reason) {
    error.value = reason.message
  } finally {
    formalBuilding.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="quality-page">
    <div class="page-header">
      <div><h1>质量分析</h1><p class="muted">资料加工任务 {{ route.params.batchId }}</p></div>
      <div class="quality-actions" v-if="selectedDataset">
        <span :class="selectedDataset.qualityPassed ? 'badge completed' : 'badge failed'">{{ selectedDataset.qualityPassed ? '质量通过' : '质量未通过' }}</span>
        <button
          v-if="selectedDataset.state !== 'published'"
          :class="['button', (!selectedDataset.qualityPassed || selectedDataset.publishable === false) ? 'warning-button' : '']"
          :disabled="publishing"
          @click="publishSelected"
        >
          {{ publishing ? '正在发布' : (!selectedDataset.qualityPassed || selectedDataset.publishable === false) ? '强制发布' : '发布数据集' }}
        </button>
        <span v-else class="badge completed">已发布</span>
      </div>
    </div>
    <nav class="tabs"><router-link :to="`/batches/${route.params.batchId}/download`">下载文件</router-link><router-link :to="`/batches/${route.params.batchId}/preprocess`">加工任务</router-link><router-link :to="`/batches/${route.params.batchId}/quality`">质量分析</router-link></nav>
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading && !report" class="panel empty">正在加载质量分析...</div>
    <div v-else-if="!visibleDatasets.length" class="panel empty">尚无数据集版本，请先完成预处理。</div>
    <template v-else-if="report">
      <div class="panel metrics-panel">
        <div class="panel-heading">
          <div><h2>核心质量指标</h2><p class="muted">指标只来自当前数据集实际处理结果，字段已按业务含义中文化。</p></div>
          <select v-model="selectedId" @change="load"><option v-for="dataset in visibleDatasets" :key="dataset.id" :value="dataset.id">{{ dataset.id }}</option></select>
        </div>
        <div class="metric-grid">
          <div v-for="item in metricItems" :key="item.key" class="metric">
            <strong>{{ metricValue(item.key, item.value) }}</strong>
            <span>{{ item.label }}</span>
            <small>{{ item.help }}</small>
          </div>
        </div>
      </div>

      <div class="panel graph-panel">
        <div class="panel-heading">
          <div><h2>图谱分析</h2><p class="muted">关键词默认处于「未准入（排除）」状态，执行「确认并准入」后才会参与检索与正式知识构建。支持 L1 细粒度 → L2 抽象术语的两级图谱管理。</p></div>
          <div class="graph-actions">
            <button class="button" :disabled="formalBuilding || !(admissionState.admitted || 0)" @click="buildFormalKnowledge">
              {{ formalBuilding ? '正在创建任务' : '基于已生效关键词构建正式知识' }}
            </button>
          </div>
        </div>
        <template v-if="report.graph.available">
          <div class="metric-grid graph-metrics">
            <div class="metric"><strong>{{ report.graph.keywordCount ?? 0 }}</strong><span>关键词数</span><small>按标准名和别名归并后的关键词数量</small></div>
            <div class="metric"><strong>{{ report.graph.chunkCount ?? 0 }}</strong><span>关联文档块</span><small>可回查到来源材料的处理单元数量</small></div>
            <div class="metric"><strong>{{ report.graph.contextEdgeCount ?? 0 }}</strong><span>上下文证据</span><small>关键词匹配到文档块的证据边数量</small></div>
            <div class="metric"><strong>{{ admissionState.admitted || 0 }}</strong><span>已生效（包含）</span><small>已确认并准入，参与检索和正式知识构建</small></div>
            <div class="metric"><strong>{{ admissionState.excluded || 0 }}</strong><span>未准入（排除）</span><small>默认状态，不参与检索和正式知识构建</small></div>
            <div class="metric"><strong>{{ keywordLevelStats.L2 || 0 }}</strong><span>L2 抽象术语</span><small>业务抽象的标准术语/概念节点</small></div>
          </div>
          <div class="info graph-source-banner"><strong>{{ graphSourceLabel }}</strong><span>{{ graphSourceDescription }}</span></div>
          <div class="quality-metric-strip">
            <span><b>已生效</b><em>{{ admissionState.admitted || 0 }}</em></span>
            <span><b>未准入</b><em>{{ admissionState.excluded || 0 }}</em></span>
            <span><b>实体/关系阶段</b><em>{{ entityRelationStage.state === 'completed' ? '已完成' : entityRelationStage.state === 'running' ? '进行中' : '未启动' }}</em></span>
          </div>
          <div class="quality-metric-strip">
            <span><b>L1 细粒度</b><em>{{ keywordLevelStats.L1 || 0 }}</em></span>
            <span><b>L2 抽象术语</b><em>{{ keywordLevelStats.L2 || 0 }}</em></span>
            <span v-if="keywordLevelStats.unspecified"><b>未分层</b><em>{{ keywordLevelStats.unspecified }}</em></span>
          </div>
          <div class="business-comparison">
            <div class="business-comparison-heading">
              <div>
                <strong>关键词智能过滤</strong>
                <span class="muted">输入过滤规则（如"排除所有测试相关的关键词"），系统将自动判断并标记关键词。</span>
              </div>
              <span v-if="reviewCompletedAt" class="comparison-time">最近完成：{{ reviewCompletedAt }}</span>
            </div>
            <div style="display: flex; gap: 10px; margin: 12px 0;">
              <input v-model="filterPrompt" placeholder="输入过滤提示词，如：排除所有测试相关的关键词" style="flex: 1; padding: 8px 12px; border: 1px solid #ccd6e3; border-radius: 6px; font-size: 13px;" />
              <button class="button" :disabled="businessReviewing || !filterPrompt.trim()" @click="reviewKeywordBusiness">
                {{ businessReviewing ? '正在过滤...' : '执行过滤' }}
              </button>
            </div>
            <div class="comparison-stats">
              <div class="comparison-stat before"><b>{{ businessBeforeStats.total }}</b><span>过滤前关键词</span><small>业务注入 {{ businessBeforeStats.injected }} 个</small></div>
              <div class="comparison-arrow">→</div>
              <div class="comparison-stat after"><b>{{ businessAfterStats.total }}</b><span>过滤后关键词</span><small>准入 {{ businessAfterStats.businessAccepted }} / 排除 {{ businessAfterStats.businessRejected }}</small></div>
              <div class="comparison-stat pending"><b>{{ businessAfterStats.needsReview }}</b><span>待业务确认</span><small>发生变化 {{ businessChangedNodes.length }} 个</small></div>
            </div>
            <div class="review-mode-tabs" role="tablist" aria-label="业务过滤图谱视图">
              <button v-for="mode in ['after', 'before', 'changed', 'accepted', 'needsReview', 'injected']" :key="mode" :class="{ active: businessReviewView === mode }" class="mode-tab" @click="businessReviewView = mode">
                {{ comparisonModeLabel(mode) }}
              </button>
            </div>
            <div v-if="businessChangedNodes.length" class="business-delta-list">
              <span class="delta-title">状态变化</span>
              <button v-for="node in businessChangedNodes.slice(0, 8)" :key="node.id" class="delta-item" @click="selectComparisonNode(node)">
                <strong>{{ node.canonicalName || node.displayName || node.name }}</strong>
                <span>{{ businessStatusLabel(node.previousBusinessStatus) }} → {{ businessStatusLabel(businessStatus(node)) }}</span>
              </button>
              <span v-if="businessChangedNodes.length > 8" class="muted">还有 {{ businessChangedNodes.length - 8 }} 个变化项，请使用“发生变化”视图查看。</span>
            </div>
            <div v-else class="comparison-empty">尚未检测到业务状态变化。可先执行“业务语义过滤”，再对待确认关键词进行人工调整。</div>
          </div>
          <div class="l2-term-panel">
            <h3 style="margin: 16px 0 10px; color: #34445b; font-size: 14px;">L2 抽象术语管理</h3>
            <p class="muted" style="margin-bottom: 10px;">创建业务抽象术语（L2），并关联细粒度关键词（L1），实现"输入粗粒度概念 → 输出细粒度实体"的语义降维。</p>
            <div class="l2-term-form">
              <input v-model="l2TermName" placeholder="术语名称（如：事务锁超时）" style="flex: 1; padding: 7px 9px; border: 1px solid #ccd6e3; border-radius: 6px; font-size: 13px;" />
              <input v-model="l2TermCanonical" placeholder="标准名（可选）" style="flex: 1; padding: 7px 9px; border: 1px solid #ccd6e3; border-radius: 6px; font-size: 13px;" />
              <input v-model="l2TermDescription" placeholder="描述（可选）" style="flex: 2; padding: 7px 9px; border: 1px solid #ccd6e3; border-radius: 6px; font-size: 13px;" />
              <button class="button" :disabled="creatingL2Term || !l2TermName.trim()" @click="createL2Term">
                {{ creatingL2Term ? '正在创建' : '创建 L2 术语' }}
              </button>
            </div>
            <div v-if="l2TermLinkedIds.length" class="l2-linked-hint">
              已关联 {{ l2TermLinkedIds.length }} 个 L1 关键词（点击图谱中的 L1 关键词可切换关联）
            </div>
          </div>
                    <div class="domain-grid">
            <article v-for="domain in knowledgeDomainCards" :key="domain.key" :class="['domain-card', `domain-${domain.key}`]">
              <strong>{{ domain.count }}</strong>
              <span>{{ domain.label }}</span>
              <small>{{ domain.help }}</small>
            </article>
          </div>
          <div class="quality-metric-strip">
            <span v-for="item in graphQualityMetrics" :key="item.key" :title="item.help">
              <b>{{ item.label }}</b><em>{{ metricValue(item.key, item.value) }}</em>
            </span>
          </div>
          <div v-if="hasOnlyLegacyStructureGraph" class="warning">当前数据集只有旧版结构追溯图，尚未生成关键词与文档块的上下文关联图。重新执行质量分析后可查看新版关键词图谱。</div>
          <div class="graph-layout">
            <section class="graph-visual">
              <KnowledgeGraph v-if="semanticGraphNodes.length" :graph="graphPreview" :show-edge-labels="graphMode !== 'overview'" height="520px" @nodeClick="handleNodeClick" @edgeClick="handleEdgeClick" />
              <div v-else class="empty compact">暂无可展示的关键词图谱。</div>
              <div v-if="graphLoading" class="info">正在加载图谱数据...</div>
              <div v-else-if="graphInfo" class="info">{{ graphInfo }}</div>
              <div v-if="graphMode === 'neighborhood'" class="graph-toolbar">
                <button class="button" @click="resetGraph">返回关键词总览</button>
                <span class="muted">点击关键词可继续展开一层上下文。</span>
              </div>
            </section>
            <aside class="graph-inspector">
              <h3>当前选择</h3>
              <div v-if="selectedNode" class="inspect-card">
                <span class="type-pill">{{ nodeTypeLabel(selectedNode.type) }}</span>
                <strong>{{ selectedNode.displayName || selectedNode.name || selectedNode.rawName }}</strong>
                <p v-if="selectedNode.canonicalName">标准名：{{ selectedNode.canonicalName }}</p>
                <p v-if="selectedNode.aliases && selectedNode.aliases.length">别名：{{ selectedNode.aliases.join('、') }}</p>
                <p v-if="selectedNode.matchedAliases && selectedNode.matchedAliases.length">命中别名：{{ selectedNode.matchedAliases.join('、') }}</p>
                <p v-if="selectedNode.type === 'Keyword'">层级：{{ keywordLevelLabel(selectedNode.keywordLevel || selectedNode.properties?.keywordLevel) }}</p>
                <p v-if="selectedNode.type === 'Keyword'">准入状态：{{ admissionLabel(readAdmissionStatus(selectedNode)) }}</p>
                <p v-if="isBusinessInjected(selectedNode)" class="injected-hint">业务注入关键词：已命中领域词典或业务规则</p>
                <p v-if="selectedNode.businessEvidenceCoverage">证据覆盖：{{ selectedNode.businessEvidenceCoverage.total || 0 }} 条，{{ selectedNode.businessEvidenceCoverage.chunkCount || 0 }} 个文档块</p>
                <p>置信度：{{ confidence(selectedNode.confidence ?? selectedNode.modelConfidence ?? selectedNode.properties?.confidence) }}</p>
                <p v-if="sourceMethodNames(selectedNode).length">命中来源：{{ sourceMethodNames(selectedNode).join('、') }}</p>
                <p v-if="selectedNode.evidenceSources && selectedNode.evidenceSources.length">证据类型：{{ selectedNode.evidenceSources.join('、') }}</p>
                <p v-if="selectedNode.rawName && selectedNode.rawName !== (selectedNode.displayName || selectedNode.name)">原名：{{ selectedNode.rawName }}</p>
                <p>来源：{{ selectedNode.sourceResourceId || '-' }}</p>
                <p>文档块：{{ selectedNode.chunkId || '-' }}</p>
                <p v-if="selectedNode.sourceResourceIds && selectedNode.sourceResourceIds.length">关联来源：{{ selectedNode.sourceResourceIds.length }} 个</p>
                <p v-if="selectedNode.chunkIds && selectedNode.chunkIds.length">关联文档块：{{ selectedNode.chunkIds.length }} 个</p>
                <p v-if="selectedNode.occurrences && selectedNode.occurrences.length">证据文本：{{ selectedNode.occurrences[0].evidenceText || '-' }}</p>
                <div v-if="selectedNode.type === 'Keyword'" class="keyword-actions">
                  <span class="muted">使用上方提示词批量过滤关键词</span>
                  <button v-if="selectedNode.keywordLevel === 'L2'" class="button small" @click="expandTerm(selectedNode.id)">展开关联 L1 实体</button>
                  <button v-if="selectedNode.keywordLevel !== 'L2'" class="button small" @click="toggleL1Link(selectedNode.id)">关联到 L2 术语</button>
                </div>
                <div v-if="termExpansion && selectedNode.keywordLevel === 'L2'" class="decision-panel" style="background: #eff6ff; border-color: #bfd7ff;">
                  <strong>L2 术语展开：{{ termExpansion.l2Node?.name }}</strong>
                  <p v-if="termExpansion.expansions.length">关联 {{ termExpansion.totalExpansionCount }} 个 L1 实体，其中 {{ termExpansion.admittedExpansionCount }} 个已生效。</p>
                  <p v-else>该术语尚未关联任何 L1 细粒度关键词。</p>
                  <div v-for="exp in termExpansion.expansions.slice(0, 10)" :key="exp.l1Node.id" class="delta-item" style="margin-top: 6px;">
                    <strong>{{ exp.l1Node.name }}</strong>
                    <span>权重 {{ (exp.weight * 100).toFixed(0) }}%</span>
                    <span>{{ exp.l1Node.admissionStatus === 'admitted' ? '已生效' : '未准入' }}</span>
                  </div>
                </div>
              </div>
              <div v-else-if="selectedEdge" class="inspect-card">
                <span class="type-pill">{{ edgeTypeLabel(selectedEdge.type) }}</span>
                <strong>{{ nodeName(selectedEdge.source) }} → {{ nodeName(selectedEdge.target) }}</strong>
                <p>置信度：{{ confidence(selectedEdge.confidence) }}</p>
                <p v-if="selectedEdge.evidenceText">证据上下文：{{ selectedEdge.evidenceText }}</p>
                <p v-if="selectedEdge.contextText">匹配上下文：{{ selectedEdge.contextText }}</p>
              </div>
              <div v-else class="empty compact">点击图中的节点或关系查看详情。</div>
              <h3>节点类型分布</h3>
              <div class="type-list"><span v-for="item in topNodeTypes" :key="item.type"><b>{{ item.label }}</b><em>{{ item.count }}</em></span></div>
              <h3>关系类型分布</h3>
              <div class="type-list"><span v-for="item in topEdgeTypes" :key="item.type"><b>{{ item.label }}</b><em>{{ item.count }}</em></span></div>
            </aside>
          </div>
          <h3>上下文关联与原文证据</h3>
          <div v-if="graphMode === 'overview'" class="warning">当前默认仅展示关键词总览，点击某个关键词后再加载对应的文档块上下文。</div>
          <div class="relation-grid">
            <article v-for="edge in relationCards" :key="edge.id" class="relation-card">
              <header><span>{{ edgeTypeLabel(edge.type) }}</span><strong>{{ confidence(edge.confidence) }}</strong></header>
              <p class="relation-path">{{ nodeName(edge.source) }} → {{ nodeName(edge.target) }}</p>
              <p class="evidence">{{ edge.evidenceText || '该上下文关联未记录原文证据' }}</p>
            </article>
          </div>
        </template>
        <div v-else class="warning">{{ report.graph.reason }}</div>
      </div>

      <div class="panel retrieval-panel"><h2>检索验证</h2><div class="warning">{{ report.retrievalEvaluation.reason }}</div><p class="muted">未配置固定评测查询前，不展示伪造命中率。</p></div>
    </template>
  </section>
</template>

<style scoped>
.quality-page { max-width: 1680px; margin: 0 auto; }
.quality-actions, .panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.quality-actions { justify-content: flex-end; }
.graph-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
select { min-width: 320px; padding: 9px 11px; border: 1px solid #ccd6e3; border-radius: 6px; background: white; }
.metrics-panel, .graph-panel { margin-bottom: 16px; }
.panel-heading { margin-bottom: 14px; }
.panel-heading h2, .panel-heading p { margin: 0; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.metric { min-width: 0; padding: 16px; background: #f6f8fb; border-radius: 8px; }
.metric strong { display: block; font-size: 22px; color: #183b66; }
.metric span { display: block; margin-top: 4px; color: #34445b; font-size: 13px; font-weight: 600; }
.metric small { display: block; margin-top: 6px; color: #718096; font-size: 11px; line-height: 1.5; }
.graph-metrics { grid-template-columns: repeat(4, minmax(0, 220px)); margin-bottom: 14px; }
.domain-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 12px 0; }
.domain-card { min-width: 0; padding: 14px; border: 1px solid #dde4ee; border-radius: 10px; background: #fbfcfe; }
.domain-card strong { display: block; font-size: 24px; color: #183b66; }
.domain-card span { display: block; margin-top: 4px; font-size: 14px; font-weight: 700; color: #24364d; }
.domain-card small { display: block; margin-top: 6px; font-size: 12px; line-height: 1.5; color: #66758a; }
.domain-what { border-color: #b7d8ff; background: #f3f8ff; }
.domain-how { border-color: #bee3d0; background: #f3fbf7; }
.domain-why { border-color: #f5d0a9; background: #fff8ef; }
.quality-metric-strip { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 14px; }
.quality-metric-strip span { display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; border-radius: 999px; background: #f6f8fb; border: 1px solid #dde4ee; color: #536176; font-size: 12px; }
.quality-metric-strip b { color: #34445b; }
.quality-metric-strip em { color: #183b66; font-style: normal; font-weight: 700; }
.business-comparison { margin: 12px 0 16px; padding: 14px; border: 1px solid #cfe0f5; border-radius: 8px; background: #f8fbff; }
.business-comparison-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.business-comparison-heading strong { display: block; color: #183b66; font-size: 15px; }
.business-comparison-heading span { display: block; margin-top: 3px; font-size: 12px; }
.comparison-time { flex: 0 0 auto; padding: 4px 8px; border-radius: 999px; background: #eaf2ff; color: #175cd3; font-size: 12px; }
.comparison-stats { display: grid; grid-template-columns: minmax(0, 1fr) 28px minmax(0, 1fr) minmax(0, 1fr); gap: 10px; align-items: center; }
.comparison-stat { min-width: 0; padding: 11px; border: 1px solid #dde4ee; border-radius: 7px; background: white; }
.comparison-stat b { display: block; color: #183b66; font-size: 22px; }
.comparison-stat span { display: block; margin-top: 2px; color: #34445b; font-weight: 700; font-size: 12px; }
.comparison-stat small { display: block; margin-top: 4px; color: #66758a; font-size: 11px; }
.comparison-stat.after { border-color: #b9dfc8; background: #f5fbf7; }
.comparison-stat.pending { border-color: #f2d4a7; background: #fffaf0; }
.comparison-arrow { text-align: center; color: #175cd3; font-weight: 800; }
.review-mode-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.mode-tab { padding: 7px 10px; border: 1px solid #ccd6e3; border-radius: 999px; background: white; color: #536176; cursor: pointer; font-size: 12px; }
.mode-tab.active { border-color: #175cd3; background: #eaf2ff; color: #175cd3; font-weight: 700; }
.business-delta-list { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.delta-title { color: #34445b; font-size: 12px; font-weight: 700; }
.delta-item { display: inline-flex; align-items: center; gap: 7px; max-width: 280px; padding: 7px 9px; border: 1px solid #dde4ee; border-radius: 7px; background: white; color: #536176; cursor: pointer; font-size: 12px; }
.delta-item strong { min-width: 0; color: #183b66; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.delta-item span { flex: 0 0 auto; color: #66758a; }
.comparison-empty { margin-top: 10px; color: #66758a; font-size: 12px; }
.graph-layout { display: grid; grid-template-columns: minmax(620px, 1fr) 360px; gap: 14px; align-items: stretch; }
.graph-visual { min-width: 0; }
.graph-toolbar { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.graph-inspector { padding: 12px; border: 1px solid #dde4ee; border-radius: 8px; background: #fbfcfe; }
.graph-inspector h3, .graph-panel h3 { margin: 14px 0 10px; color: #34445b; font-size: 14px; }
.graph-inspector h3:first-child { margin-top: 0; }
.inspect-card { padding: 12px; border: 1px solid #dde4ee; border-radius: 7px; background: white; }
.inspect-card strong, .inspect-card p { display: block; margin: 6px 0 0; overflow-wrap: anywhere; }
.inspect-card strong { color: #183b66; font-size: 13px; }
.inspect-card p { color: #66758a; font-size: 11px; line-height: 1.5; }
.injected-hint { padding: 7px 9px; border-radius: 6px; background: #eff6ff; color: #175cd3 !important; border: 1px solid #bfd7ff; }
.type-pill { display: inline-flex; padding: 3px 7px; border-radius: 999px; color: #175cd3; background: #eaf2ff; font-size: 11px; }
.type-list { display: grid; gap: 6px; }
.type-list span { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 9px; border-radius: 6px; background: white; color: #536176; font-size: 12px; }
.type-list em { font-style: normal; color: #183b66; font-weight: 700; }
.relation-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.relation-card { min-width: 0; padding: 12px; border: 1px solid #dde4ee; border-radius: 8px; background: #fbfcfe; }
.relation-card header { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #175cd3; font-size: 12px; }
.relation-path { margin: 8px 0; color: #24364d; font-weight: 600; overflow-wrap: anywhere; }
.evidence { margin: 0; color: #66758a; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.info, .warning { margin: 10px 0 14px; padding: 10px 12px; border-radius: 7px; font-size: 13px; line-height: 1.5; }
.info { color: #175cd3; background: #eff6ff; border: 1px solid #bfd7ff; }
.warning { color: #9b6108; background: #fff7e6; border: 1px solid #f0d7ac; }
.graph-source-banner { display: flex; align-items: flex-start; gap: 10px; }
.graph-source-banner strong { flex: 0 0 auto; }
.graph-source-banner span { min-width: 0; }
.warning-button { color: #9b6108; border-color: #f0d7ac; background: #fffaf0; }
.warning-button:hover:not(:disabled) { background: #fff4d6; }
.keyword-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.button.small { padding: 6px 9px; font-size: 12px; }
.decision-panel { margin-top: 12px; padding: 10px; border: 1px solid #f0d7ac; border-radius: 7px; background: #fffaf0; }
.decision-panel strong { color: #9b6108; }
.decision-panel textarea { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 8px; border: 1px solid #d8c09a; border-radius: 6px; resize: vertical; font-size: 12px; }
.decision-actions { display: flex; gap: 8px; margin-top: 8px; }
.retrieval-panel { max-width: none; }
.l2-term-panel { margin: 14px 0; padding: 14px; border: 1px solid #cfe0f5; border-radius: 8px; background: #f8fbff; }
.l2-term-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.l2-linked-hint { margin-top: 8px; padding: 7px 9px; border-radius: 6px; background: #eff6ff; color: #175cd3; font-size: 12px; border: 1px solid #bfd7ff; }

@media (max-width: 1200px) {
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .domain-grid { grid-template-columns: 1fr; }
  .comparison-stats { grid-template-columns: 1fr; }
  .comparison-arrow { display: none; }
  .graph-layout { grid-template-columns: 1fr; }
  .relation-grid { grid-template-columns: 1fr; }
}
</style>
