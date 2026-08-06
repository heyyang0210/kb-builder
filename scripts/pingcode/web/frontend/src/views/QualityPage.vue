<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import BatchStepNav from '../components/BatchStepNav.vue'
import KnowledgeGraph from '../components/KnowledgeGraph.vue'
import { baseUrl, request } from '../api'

const route = useRoute()
const datasets = ref([])
const selectedId = ref('')
const graphSummary = ref(null)
const graphNodes = ref([])
const graphEdges = ref([])
const beforeGraph = ref({ nodes: [], edges: [] })
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
const streamProgress = ref({ total: 0, current: 0, stage: '' })
const skillStatus = ref('')
const filterElapsed = ref(0)
const filterTimer = { id: null }
const showSkillEditor = ref(false)
const skillContent = ref('')
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
const keywordNodes = computed(() => graphNodes.value.filter(node => node.type === 'Keyword'))
const keywordCount = computed(() => {
  const state = normalizedFilterState.value
  return state.beforeTotal || keywordNodes.value.length
})
const filterEstimatedSeconds = computed(() => {
  if (!keywordCount.value) return 0
  return Math.min(300, 60 + (Math.floor(keywordCount.value / 10) + 1) * 30)
})

const normalizedFilterState = computed(() => {
  const summaryState = graphSummary.value?.keywordFilterState
    || graphSummary.value?.filterState
    || graphSummary.value?.keywordAdmissionState
    || {}
  const state = Object.keys(summaryState).length ? summaryState : (appliedFilterState.value || {})
  const admitted = numberValue(state.afterTotal, state.kept, state.admitted)
  const excluded = numberValue(state.excluded, state.excludedCount)
  const total = numberValue(state.beforeTotal, state.totalKeywordCount, admitted + excluded, keywordNodes.value.length)
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

const admittedGraph = computed(() => projectAdmittedGraph(graphNodes.value, graphEdges.value))
const beforeGraphSnapshot = computed(() => beforeGraph.value.nodes.length ? beforeGraph.value : admittedGraph.value)
const changedGraph = computed(() => {
  const afterKeywordIds = new Set(admittedGraph.value.nodes.filter(node => node.type === 'Keyword').map(node => node.id))
  const changedKeywords = beforeGraphSnapshot.value.nodes.filter(node => node.type === 'Keyword' && !afterKeywordIds.has(node.id))
  const changedIds = new Set(changedKeywords.map(node => node.id))
  const changedEdges = beforeGraphSnapshot.value.edges.filter(edge => changedIds.has(edge.source) || changedIds.has(edge.target))
  const visibleIds = new Set(changedEdges.flatMap(edge => [edge.source, edge.target]))
  changedKeywords.forEach(node => visibleIds.add(node.id))
  return {
    nodes: beforeGraphSnapshot.value.nodes.filter(node => visibleIds.has(node.id)),
    edges: changedEdges,
  }
})
const graphPreview = computed(() => {
  if (graphView.value === 'before') return beforeGraphSnapshot.value
  if (graphView.value === 'changed') return changedGraph.value
  return admittedGraph.value
})
const graphViewDescription = computed(() => ({
  before: '应用决策前的关键词与上下文快照',
  after: '仅展示已保留关键词及两端可见的关系',
  changed: '展示本次被排除的关键词及受影响关系',
}[graphView.value]))
const nodeLookup = computed(() => new Map(graphPreview.value.nodes.map(node => [node.id, node])))
const canBuildFormalKnowledge = computed(() => {
  if (graphSummary.value?.graphSource === 'final_knowledge') return false
  return normalizedFilterState.value.kept > 0 && selectedDataset.value?.qualityPassed === true
})
const formalBuildTooltip = computed(() => {
  if (graphSummary.value?.graphSource === 'final_knowledge') return '当前已是正式知识图谱，无需重复构建'
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

function projectAdmittedGraph(nodes, edges) {
  const admittedKeywordIds = new Set(
    nodes.filter(node => node.type === 'Keyword' && readAdmissionStatus(node) === 'admitted').map(node => node.id),
  )
  const visibleEdges = edges.filter(edge => admittedKeywordIds.has(edge.source) || admittedKeywordIds.has(edge.target))
  const visibleIds = new Set(visibleEdges.flatMap(edge => [edge.source, edge.target]))
  admittedKeywordIds.forEach(id => visibleIds.add(id))
  const visibleNodes = nodes.filter(node => {
    if (node.type === 'Keyword') return admittedKeywordIds.has(node.id)
    return visibleIds.has(node.id)
  })
  const nodeIds = new Set(visibleNodes.map(node => node.id))
  return {
    nodes: visibleNodes,
    edges: visibleEdges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
  }
}

function cloneGraph(nodes, edges) {
  return JSON.parse(JSON.stringify({ nodes: nodes || [], edges: edges || [] }))
}

function normalizeAppliedState(result, decisions, beforeTotal) {
  const source = result.keywordFilterState || result.filterState || result.statistics || result.applied || {}
  const kept = numberValue(source.kept, source.keep, source.admitted, decisions.filter(item => item.action === 'keep').length)
  const excluded = numberValue(source.excluded, source.exclude, source.excludedCount, decisions.filter(item => item.action === 'exclude').length)
  const total = numberValue(source.beforeTotal, source.total, beforeTotal, kept + excluded)
  return { beforeTotal: total, afterTotal: kept, kept, excluded }
}

async function load({ preserveSnapshot = false } = {}) {
  loading.value = true
  error.value = ''
  try {
    datasets.value = (await request(`/api/datasets?batchId=${route.params.batchId}`)).items || []
    if (!visibleDatasets.value.some(item => item.id === selectedId.value)) {
      selectedId.value = visibleDatasets.value[0]?.id || ''
    }
    if (!selectedId.value) {
      graphSummary.value = null
      graphNodes.value = []
      graphEdges.value = []
      return
    }
    await loadGraph({ preserveSnapshot })
  } catch (reason) {
    error.value = reason.message
  } finally {
    loading.value = false
  }
}

async function loadGraph({ preserveSnapshot = false } = {}) {
  graphLoading.value = true
  graphInfo.value = ''
  try {
    const [summary, nodesPayload, edgesPayload] = await Promise.all([
      request(`/api/datasets/${selectedId.value}/graph/summary`),
      request(`/api/datasets/${selectedId.value}/graph/nodes?limit=1000`),
      request(`/api/datasets/${selectedId.value}/graph/edges?limit=1000`),
    ])
    graphSummary.value = summary
    graphNodes.value = nodesPayload.items || []
    graphEdges.value = edgesPayload.items || []
    if (!preserveSnapshot || !beforeGraph.value.nodes.length) {
      beforeGraph.value = cloneGraph(graphNodes.value, graphEdges.value)
    }
    selectedNode.value = null
    selectedEdge.value = null
  } catch (reason) {
    graphSummary.value = null
    graphNodes.value = []
    graphEdges.value = []
    graphInfo.value = reason.message
  } finally {
    graphLoading.value = false
  }
}

async function changeDataset() {
  beforeGraph.value = { nodes: [], edges: [] }
  appliedFilterState.value = null
  filterResults.value = []
  previewResults.value = []
  skillStatus.value = ''
  graphView.value = 'after'
  await loadGraph()
}

async function publishSelected() {
  if (!selectedDataset.value || publishing.value) return
  const dataset = selectedDataset.value
  const needsForce = !dataset.qualityPassed || dataset.publishable === false
  if (needsForce && !window.confirm(`数据集 ${dataset.id} 未通过发布基础质量门禁，确认仍要发布吗？`)) return
  publishing.value = true
  error.value = ''
  try {
    await request(`/api/datasets/${dataset.id}/publish?force=${needsForce}`, { method: 'POST' })
    await load({ preserveSnapshot: true })
  } catch (reason) {
    error.value = reason.message
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

async function previewFilterBySkill() {
  if (!selectedId.value || previewLoading.value) return
  previewLoading.value = true
  error.value = ''
  previewResults.value = []
  streamingDecisions.value = []
  streamProgress.value = { total: 0, current: 0, stage: '' }
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
  try {
    const response = await fetch(`${baseUrl()}/api/datasets/${selectedId.value}/keywords/filter-by-skill/stream`)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
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
          streamProgress.value = { ...streamProgress.value, total: data.total, current: data.index }
          streamingDecisions.value.push({
            keywordId: data.keywordId,
            keywordName: data.keywordName,
            suggestedAction: data.shouldExclude ? 'exclude' : 'keep',
            userAction: data.shouldExclude ? 'exclude' : 'keep',
            userOverride: false,
            reason: data.reason,
          })
        } else if (eventType === 'complete') {
          completed = true
          previewResults.value = [...streamingDecisions.value]
          previewExpanded.value = true
          skillStatus.value = `分析完成（耗时 ${filterElapsed.value}s）：共 ${data.total || 0} 个关键词，建议保留 ${data.keep || 0} 个，建议排除 ${data.exclude || 0} 个。`
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
  } catch (streamError) {
    if (!completed && !streamingDecisions.value.length) {
      try {
        skillStatus.value = '流式连接失败，正在使用普通模式重试...'
        const result = await request(`/api/datasets/${selectedId.value}/keywords/filter-by-skill`, { method: 'POST' })
        if (result.error && !result.suggestions?.length) throw new Error(result.error)
        previewResults.value = (result.suggestions || []).map(item => ({
          ...item,
          userAction: item.suggestedAction,
          userOverride: false,
        }))
        previewExpanded.value = true
        const summary = result.summary || {}
        skillStatus.value = `分析完成（耗时 ${filterElapsed.value}s）：共 ${summary.total || 0} 个关键词，建议保留 ${summary.suggested_keep || 0} 个，建议排除 ${summary.suggested_exclude || 0} 个。`
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

function toggleSuggestion(index) {
  const item = previewResults.value[index]
  if (!item) return
  item.userAction = item.userAction === 'exclude' ? 'keep' : 'exclude'
  item.userOverride = true
}

const previewKeepCount = computed(() => previewResults.value.filter(item => item.userAction === 'keep').length)
const previewExcludeCount = computed(() => previewResults.value.filter(item => item.userAction === 'exclude').length)

async function applyFilterDecisions() {
  if (!selectedId.value || applyLoading.value || !previewResults.value.length) return
  applyLoading.value = true
  error.value = ''
  try {
    beforeGraph.value = cloneGraph(graphNodes.value, graphEdges.value)
    const decisions = previewResults.value.map(item => ({
      keywordId: item.keywordId,
      action: item.userAction,
      reason: item.reason,
      overridden: item.userOverride,
    }))
    const result = await request(`/api/datasets/${selectedId.value}/keywords/filter-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions }),
    })
    if (result.error) throw new Error(result.error)
    appliedFilterState.value = normalizeAppliedState(result, decisions, beforeGraph.value.nodes.filter(node => node.type === 'Keyword').length)
    filterResults.value = previewResults.value.map(item => ({
      keywordId: item.keywordId,
      name: item.keywordName,
      excluded: item.userAction === 'exclude',
      reason: item.reason,
    }))
    filterResultsExpanded.value = filterResults.value.length <= 15
    previewResults.value = []
    graphView.value = 'after'
    await load({ preserveSnapshot: true })
    const state = normalizedFilterState.value
    skillStatus.value = `已应用过滤决策：保留 ${state.kept} 个，排除 ${state.excluded} 个。`
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

onMounted(load)
onUnmounted(() => {
  if (filterTimer.id) clearInterval(filterTimer.id)
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
        <button class="button" :disabled="publishing" :title="selectedDataset.qualityPassed ? '发布当前数据集' : '当前数据集未通过发布基础质量门禁'" @click="publishSelected">
          {{ publishing ? '正在发布' : '发布数据集' }}
        </button>
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
      <span v-if="selectedDataset" class="dataset-state">{{ selectedDataset.state === 'published' ? '已发布' : '未发布' }}</span>
    </div>

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
            <p>{{ item.reason }}</p>
          </article>
        </div>

        <div v-if="previewResults.length" class="results-panel">
          <button class="collapse-heading" @click="previewExpanded = !previewExpanded">
            <strong>过滤建议</strong>
            <span>保留 {{ previewKeepCount }}，排除 {{ previewExcludeCount }}</span>
          </button>
          <div v-show="previewExpanded" class="result-list">
            <button v-for="(item, index) in previewResults" :key="item.keywordId" :class="['result-item', item.userAction]" @click="toggleSuggestion(index)">
              <span>{{ item.userAction === 'exclude' ? '排除' : '保留' }}</span>
              <strong>{{ item.keywordName }}</strong>
              <p>{{ item.reason }}</p>
              <small v-if="item.userOverride">已人工调整</small>
            </button>
          </div>
          <div class="apply-actions">
            <span>点击关键词可切换保留或排除。</span>
            <button class="button primary" :disabled="applyLoading" @click="applyFilterDecisions">{{ applyLoading ? '正在应用' : '应用决策' }}</button>
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
              <p>{{ item.reason }}</p>
            </article>
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
            <h2>关键词图谱</h2>
            <p class="muted">{{ graphViewDescription }}</p>
          </div>
          <div class="view-tabs" role="tablist" aria-label="关键词图谱视图">
            <button v-for="view in [{ key: 'before', label: '过滤前' }, { key: 'after', label: '过滤后' }, { key: 'changed', label: '发生变化' }]" :key="view.key" :class="{ active: graphView === view.key }" @click="graphView = view.key">{{ view.label }}</button>
          </div>
        </div>
        <div class="graph-layout">
          <div class="graph-visual">
            <KnowledgeGraph v-if="graphPreview.nodes.length" :graph="graphPreview" height="540px" :show-edge-labels="false" :show-context-labels="false" @nodeClick="handleNodeClick" @edgeClick="handleEdgeClick" />
            <div v-else class="empty">{{ graphLoading ? '正在加载图谱...' : '当前视图暂无可展示的关键词图谱。' }}</div>
            <div v-if="graphInfo" class="alert info">{{ graphInfo }}</div>
          </div>
          <aside class="graph-inspector">
            <h3>当前选择</h3>
            <div v-if="selectedNode" class="inspect-card">
              <span class="type-pill">{{ nodeTypeLabel(selectedNode.type) }}</span>
              <strong>{{ selectedNode.displayName || selectedNode.name || selectedNode.rawName }}</strong>
              <p v-if="selectedNode.canonicalName">标准名：{{ selectedNode.canonicalName }}</p>
              <p v-if="selectedNode.aliases?.length">别名：{{ selectedNode.aliases.join('、') }}</p>
              <p v-if="selectedNode.type === 'Keyword'">过滤状态：{{ readAdmissionStatus(selectedNode) === 'admitted' ? '保留' : '排除' }}</p>
              <p>置信度：{{ confidence(selectedNode.confidence ?? selectedNode.modelConfidence ?? selectedNode.properties?.confidence) }}</p>
              <p v-if="sourceMethodNames(selectedNode).length">命中来源：{{ sourceMethodNames(selectedNode).join('、') }}</p>
              <p v-if="selectedNode.occurrences?.length">证据文本：{{ selectedNode.occurrences[0].evidenceText || '-' }}</p>
            </div>
            <div v-else-if="selectedEdge" class="inspect-card">
              <span class="type-pill">{{ edgeTypeLabel(selectedEdge.type) }}</span>
              <strong>{{ nodeName(selectedEdge.source) }} → {{ nodeName(selectedEdge.target) }}</strong>
              <p>置信度：{{ confidence(selectedEdge.confidence) }}</p>
              <p v-if="selectedEdge.evidenceText">证据上下文：{{ selectedEdge.evidenceText }}</p>
            </div>
            <div v-else class="empty compact">点击图中的节点或关系查看详情。</div>
          </aside>
        </div>
      </section>
    </template>
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
.muted { margin: 4px 0 0; color: #66758a; font-size: 13px; }
.button { min-height: 34px; padding: 7px 12px; border: 1px solid #b9c5d3; border-radius: 6px; background: #fff; color: #26384d; cursor: pointer; }
.button.primary { border-color: #1769aa; background: #1769aa; color: #fff; }
.button:disabled { cursor: not-allowed; opacity: .55; }
.alert { margin-bottom: 12px; padding: 10px 12px; border-radius: 6px; }
.alert.error { border: 1px solid #efb4b4; background: #fff2f2; color: #a12622; }
.alert.info { margin-top: 10px; border: 1px solid #b9d4ee; background: #eef6fd; color: #24557a; }
.empty { padding: 36px 16px; text-align: center; color: #6b7787; }
.empty.compact { padding: 18px 8px; }
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
.result-list { display: grid; gap: 8px; max-height: 420px; padding: 10px; overflow: auto; }
.result-item, .result-list article { display: grid; grid-template-columns: 58px minmax(120px, 220px) 1fr auto; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid #dce3ec; border-radius: 6px; background: #fff; text-align: left; }
.result-item { cursor: pointer; }
.result-item > span, .result-list article > span { padding: 3px 6px; border-radius: 4px; text-align: center; font-size: 12px; font-weight: 700; }
.result-item.keep > span, article.keep > span { background: #e9f7ef; color: #176b38; }
.result-item.exclude > span, article.exclude > span { background: #fff0ed; color: #ad351f; }
.result-item p, .result-list article p { margin: 0; color: #5f6d7d; font-size: 13px; }
.result-item small { color: #1769aa; }
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
.graph-layout { display: grid; grid-template-columns: minmax(620px, 1fr) 340px; gap: 14px; margin-top: 14px; }
.graph-visual { min-width: 0; }
.graph-inspector { padding: 12px; border: 1px solid #dce3ec; border-radius: 8px; background: #fafbfd; }
.graph-inspector h3 { margin: 0 0 12px; font-size: 15px; }
.inspect-card { display: grid; gap: 8px; }
.inspect-card p { margin: 0; color: #526174; font-size: 13px; line-height: 1.5; }
.type-pill { width: fit-content; padding: 3px 7px; border-radius: 4px; background: #e9f2fa; color: #24557a; font-size: 12px; }
@media (max-width: 980px) {
  .graph-layout { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .section-heading, .page-header { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 640px) {
  .dataset-bar, .filter-toolbar, .apply-actions { align-items: stretch; flex-direction: column; }
  .dataset-bar select { width: 100%; min-width: 0; }
  .stats-grid { grid-template-columns: 1fr; }
  .result-item, .result-list article { grid-template-columns: 58px 1fr; }
  .result-item p, .result-list article p { grid-column: 1 / -1; }
}
</style>
