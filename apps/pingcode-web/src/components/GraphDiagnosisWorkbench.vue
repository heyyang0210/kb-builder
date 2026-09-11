<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { request } from '../api'
import GraphEvidencePanel from './GraphEvidencePanel.vue'
import GraphIssueNavigator from './GraphIssueNavigator.vue'
import KnowledgeGraph from './KnowledgeGraph.vue'

const props = defineProps({
  datasetId: { type: String, required: true },
  filterRunId: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
})
const route = useRoute()
const router = useRouter()
const context = reactive({
  view: typeof route.query.view === 'string' ? route.query.view : 'after',
  query: typeof route.query.query === 'string' ? route.query.query : '',
  issueCategory: typeof route.query.issueCategory === 'string' ? route.query.issueCategory : '',
  resourceId: typeof route.query.resourceId === 'string' ? route.query.resourceId : '',
  focusNodeId: typeof route.query.focusNodeId === 'string' ? route.query.focusNodeId : '',
  focusEdgeId: typeof route.query.focusEdgeId === 'string' ? route.query.focusEdgeId : '',
  depth: Number(route.query.depth) === 2 ? 2 : 1,
  page: 1,
})
const searchResult = ref({ items: [], total: 0, sourceAvailability: 'available' })
const graph = ref({ nodes: [], edges: [] })
const evidence = ref(null)
const searchLoading = ref(false)
const graphLoading = ref(false)
const evidenceLoading = ref(false)
const graphError = ref('')
const evidenceError = ref('')
const activePanel = ref('issues')
let searchTimer = null
let searchSequence = 0
let graphSequence = 0
let evidenceSequence = 0

const categoryOptions = computed(() => props.categories.map(item => ({ id: item.id, label: item.label || item.id })))

function params(includeFocus = false) {
  const value = new URLSearchParams({ view: context.view })
  if (props.filterRunId) value.set('filterRunId', props.filterRunId)
  if (context.issueCategory) value.set('issueCategory', context.issueCategory)
  if (context.resourceId) value.set('resourceId', context.resourceId)
  if (includeFocus && context.focusNodeId) value.set('focusNodeId', context.focusNodeId)
  return value
}

function syncRoute() {
  const query = { ...route.query }
  for (const key of ['view', 'query', 'issueCategory', 'resourceId', 'focusNodeId', 'focusEdgeId', 'depth']) delete query[key]
  if (context.view !== 'after') query.view = context.view
  if (context.query) query.query = context.query
  if (context.issueCategory) query.issueCategory = context.issueCategory
  if (context.resourceId) query.resourceId = context.resourceId
  if (context.focusNodeId) query.focusNodeId = context.focusNodeId
  if (context.focusEdgeId) query.focusEdgeId = context.focusEdgeId
  if (context.depth !== 1) query.depth = String(context.depth)
  router.replace({ query })
}

async function loadSearch() {
  if (!props.datasetId) return
  const sequence = ++searchSequence
  searchLoading.value = true
  try {
    const query = params()
    if (context.query) query.set('query', context.query)
    query.set('nodeType', 'Keyword')
    query.set('page', String(context.page))
    query.set('pageSize', '20')
    const result = await request(`/api/datasets/${encodeURIComponent(props.datasetId)}/graph/search?${query}`)
    if (sequence === searchSequence) searchResult.value = result
  } catch (error) {
    if (sequence === searchSequence) searchResult.value = { items: [], total: 0, sourceAvailability: 'available', warnings: [error.message] }
  } finally {
    if (sequence === searchSequence) searchLoading.value = false
  }
}

async function loadGraph() {
  const sequence = ++graphSequence
  graph.value = { nodes: [], edges: [] }
  graphError.value = ''
  if (!props.datasetId || !context.focusNodeId) return
  graphLoading.value = true
  try {
    const query = params(true)
    query.set('depth', String(context.depth))
    const result = await request(`/api/datasets/${encodeURIComponent(props.datasetId)}/graph/explore?${query}`)
    if (sequence === graphSequence) {
      graph.value = result
      if (result.scope?.projectionAvailability === 'stale') graphError.value = result.warnings?.[0] || '历史图谱已过期'
    }
  } catch (error) {
    if (sequence === graphSequence) graphError.value = error.message
  } finally {
    if (sequence === graphSequence) graphLoading.value = false
  }
}

async function loadEvidence() {
  const sequence = ++evidenceSequence
  evidence.value = null
  evidenceError.value = ''
  if (!props.datasetId || (!context.focusNodeId && !context.focusEdgeId)) return
  evidenceLoading.value = true
  try {
    const query = params()
    if (context.focusEdgeId) query.set('edgeId', context.focusEdgeId)
    else query.set('nodeId', context.focusNodeId)
    query.set('pageSize', '50')
    const result = await request(`/api/datasets/${encodeURIComponent(props.datasetId)}/graph/evidence?${query}`)
    if (sequence === evidenceSequence) evidence.value = result
  } catch (error) {
    if (sequence === evidenceSequence) evidenceError.value = error.message
  } finally {
    if (sequence === evidenceSequence) evidenceLoading.value = false
  }
}

function reloadAll() {
  syncRoute()
  loadSearch()
  loadGraph()
  loadEvidence()
}

function scheduleSearch(query) {
  context.query = query
  context.page = 1
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { syncRoute(); loadSearch() }, 250)
}

function selectNode(node) {
  context.focusNodeId = String(node.id)
  context.focusEdgeId = ''
  activePanel.value = 'graph'
  syncRoute()
  loadGraph()
  loadEvidence()
}

function selectEdge(edge) {
  context.focusEdgeId = String(edge.id || '')
  activePanel.value = 'evidence'
  syncRoute()
  loadEvidence()
}

function changeFilter(key, value) {
  context[key] = value
  context.page = 1
  context.focusNodeId = ''
  context.focusEdgeId = ''
  reloadAll()
}

watch(() => [props.datasetId, props.filterRunId], () => {
  context.focusNodeId = ''
  context.focusEdgeId = ''
  reloadAll()
})

onMounted(reloadAll)
onUnmounted(() => clearTimeout(searchTimer))
</script>

<template>
  <section class="diagnosis-workbench">
    <nav class="mobile-tabs" aria-label="诊断视图">
      <button v-for="item in [{ id: 'issues', label: '问题' }, { id: 'graph', label: '图谱' }, { id: 'evidence', label: '证据' }]" :key="item.id" :class="{ active: activePanel === item.id }" @click="activePanel = item.id">{{ item.label }}</button>
    </nav>
    <div class="workbench-grid">
      <GraphIssueNavigator
        :class="{ 'mobile-hidden': activePanel !== 'issues' }"
        :items="searchResult.items"
        :total="searchResult.total"
        :query="context.query"
        :category="context.issueCategory"
        :resource-id="context.resourceId"
        :categories="categoryOptions"
        :page="context.page"
        :loading="searchLoading"
        :availability="searchResult.sourceAvailability"
        :selected-id="context.focusNodeId"
        @query-change="scheduleSearch"
        @category-change="changeFilter('issueCategory', $event)"
        @resource-change="changeFilter('resourceId', $event)"
        @page-change="context.page = $event; loadSearch()"
        @select="selectNode"
      />
      <section :class="['graph-stage', { 'mobile-hidden': activePanel !== 'graph' }]" aria-label="局部图谱">
        <header>
          <div class="view-switch">
            <button v-for="item in [{ id: 'before', label: '过滤前' }, { id: 'after', label: '过滤后' }, { id: 'changed', label: '变化' }]" :key="item.id" :class="{ active: context.view === item.id }" @click="changeFilter('view', item.id)">{{ item.label }}</button>
          </div>
          <div class="depth-switch"><button :class="{ active: context.depth === 1 }" @click="context.depth = 1; reloadAll()">1 跳</button><button :class="{ active: context.depth === 2 }" @click="context.depth = 2; reloadAll()">2 跳</button></div>
        </header>
        <KnowledgeGraph :graph="graph" height="520px" :focus-node-id="context.focusNodeId" :loading="graphLoading" :error="graphError" :show-edge-labels="false" @nodeClick="selectNode" @edgeClick="selectEdge" />
      </section>
      <GraphEvidencePanel :class="{ 'mobile-hidden': activePanel !== 'evidence' }" :data="evidence" :loading="evidenceLoading" :error="evidenceError" />
    </div>
  </section>
</template>

<style scoped>
.diagnosis-workbench { margin-top: 14px; border: 1px solid #dce3ec; border-radius: 6px; overflow: hidden; background: white; }
.workbench-grid { display: grid; grid-template-columns: minmax(220px, 280px) minmax(420px, 1fr) minmax(240px, 320px); }
.graph-stage { min-width: 0; }
.graph-stage > header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border-bottom: 1px solid #edf0f4; }
.view-switch, .depth-switch { display: inline-flex; }
.view-switch button, .depth-switch button, .mobile-tabs button { min-height: 30px; padding: 5px 9px; border: 1px solid #b9c5d3; background: white; }
.view-switch button:first-child, .depth-switch button:first-child { border-radius: 5px 0 0 5px; }
.view-switch button:last-child, .depth-switch button:last-child { border-radius: 0 5px 5px 0; }
.view-switch button.active, .depth-switch button.active, .mobile-tabs button.active { color: white; background: #1769aa; border-color: #1769aa; }
.mobile-tabs { display: none; }
@media (max-width: 1100px) { .workbench-grid { grid-template-columns: 240px minmax(380px, 1fr); } .workbench-grid > :last-child { grid-column: 1 / -1; border-top: 1px solid #dce3ec; border-left: 0; } }
@media (max-width: 700px) {
  .mobile-tabs { display: grid; grid-template-columns: repeat(3, 1fr); padding: 8px; }
  .mobile-tabs button:first-child { border-radius: 5px 0 0 5px; }
  .mobile-tabs button:last-child { border-radius: 0 5px 5px 0; }
  .workbench-grid { display: block; }
  .mobile-hidden { display: none; }
  .workbench-grid > :last-child { border: 0; }
  .graph-stage > header { align-items: flex-start; flex-direction: column; }
}
</style>
