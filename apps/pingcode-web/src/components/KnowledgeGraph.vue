<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-vue-next'

const props = defineProps({
  graph: { type: Object, default: () => ({ nodes: [], edges: [] }) },
  height: { type: String, default: '600px' },
  showEdgeLabels: { type: Boolean, default: false },
  showContextLabels: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }, error: { type: [String, Object], default: '' },
  maxNodes: { type: Number, default: 80 }, maxEdges: { type: Number, default: 160 },
  focusNodeId: { type: String, default: '' }
})
const emit = defineEmits(['nodeClick', 'edgeClick', 'fit', 'reset', 'zoom', 'viewportChange', 'truncated'])
const chartRef = ref(null); const selectedNodeId = ref(''); let chartInstance = null; let resizeObserver = null
const nodeTypeSymbols = { Keyword: 'circle', Parameter: 'diamond', Component: 'roundRect', ErrorCode: 'triangle', YashanDBErrorCode: 'triangle', OracleErrorCode: 'triangle', Version: 'diamond', Configuration: 'diamond', Concept: 'circle', ProcessingUnit: 'rect', Chunk: 'rect', KnowledgePoint: 'roundRect', Document: 'rect', default: 'circle' }
const nodeTypeLabels = { Document: '来源文档', ProcessingUnit: '文档块', Chunk: '文档块', KnowledgePoint: '知识点', Keyword: '关键词', Parameter: '参数', Concept: '概念', Component: '组件', Configuration: '配置项', Version: '版本', ErrorCode: '错误码', YashanDBErrorCode: 'YashanDB 错误码', OracleErrorCode: 'Oracle 错误码' }
const edgeTypeLabels = { DOCUMENT_CONTAINS_UNIT: '结构追溯', HAS_CHUNK: '结构追溯', UNIT_MENTIONS_ENTITY: '提及关系', CONTEXT_MATCHES_CHUNK: '上下文匹配文档块', RELATED_CONTEXT: '相关上下文', MENTIONS: '提及上下文', AFFECTS: '影响', DEPENDS_ON: '依赖', RELATED_TO: '相关', COMPARED_WITH: '对比' }
const nodes = computed(() => Array.isArray(props.graph?.nodes) ? props.graph.nodes : [])
const edges = computed(() => Array.isArray(props.graph?.edges) ? props.graph.edges : [])
const contextFocusId = computed(() => props.focusNodeId || props.graph?.context?.focusNodeId || props.graph?.focusNode?.id || '')
const countMeta = computed(() => props.graph?.counts || {})
const overLimit = computed(() => nodes.value.length > props.maxNodes || edges.value.length > props.maxEdges)
const hasTruncation = computed(() => Boolean(props.graph?.truncated || countMeta.value.nodes?.truncated || countMeta.value.edges?.truncated || overLimit.value))
const empty = computed(() => !props.loading && !props.error && nodes.value.length === 0)
function nodeDisplayName(node) { return node.displayName || node.name || node.rawName || node.id || '' }
function nodeSymbol(type) { return nodeTypeSymbols[type] || nodeTypeSymbols.default }
function getNodeColor(node) {
  const status = String(node.qualityStatus || node.healthStatus || node.status || node.admissionStatus || '').toLowerCase()
  if (['error', 'abnormal', 'excluded', 'invalid', 'poor', 'rejected'].includes(status)) return '#dc2626'
  if (['warning', 'warn', 'stale', 'pending'].includes(status)) return '#d97706'
  if (['healthy', 'available', 'passed', 'kept', 'included', 'valid'].includes(status)) return '#059669'
  return '#64748b'
}
function nodeTypeLabel(type) { return nodeTypeLabels[type] || type || '未知类型' }
function edgeTypeLabel(type) { return edgeTypeLabels[type] || type || '未知关系' }
function isAbnormal(node) { const status = String(node.qualityStatus || node.healthStatus || node.status || node.admissionStatus || '').toLowerCase(); return ['warning', 'warn', 'error', 'abnormal', 'excluded', 'invalid', 'poor'].includes(status) }
function nodeSize(node) { const occurrences = Array.isArray(node.occurrences) ? node.occurrences.length : Number(node.occurrenceCount || 1); return Math.max(16, Math.min(38, 16 + Math.log2(Math.max(1, occurrences)) * 5)) }
function shouldShowLabel(node) { return props.showContextLabels || node.id === contextFocusId.value || node.id === selectedNodeId.value || isAbnormal(node) }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) }
function disposeChart() { if (chartInstance) { chartInstance.off('click'); chartInstance.off('graphRoam'); chartInstance.dispose(); chartInstance = null } }
function buildOption() {
  const graphNodes = nodes.value.slice(0, props.maxNodes); const ids = new Set(graphNodes.map(node => node.id)); const graphEdges = edges.value.filter(edge => ids.has(edge.source) && ids.has(edge.target)).slice(0, props.maxEdges)
  const categoryTypes = [...new Set(graphNodes.map(node => node.type))]; const categories = categoryTypes.map(type => ({ name: nodeTypeLabel(type), symbol: nodeSymbol(type), itemStyle: { color: '#64748b' } }))
  return { animationDuration: 280, tooltip: { trigger: 'item', formatter: params => { if (params.dataType === 'node') { const node = params.data.value || params.data; return `<div style="padding:8px"><strong>${escapeHtml(nodeDisplayName(node))}</strong><div style="color:#666;font-size:12px">类型：${escapeHtml(nodeTypeLabel(node.type))}</div>${node.evidenceText ? `<div style="margin-top:4px;font-size:12px">证据：${escapeHtml(node.evidenceText)}</div>` : ''}</div>` } if (params.dataType === 'edge') { const edge = params.data.value || params.data; return `<div style="padding:8px"><strong>${escapeHtml(edgeTypeLabel(edge.type))}</strong><div style="color:#666;font-size:12px">${escapeHtml(edge.source)} → ${escapeHtml(edge.target)}</div></div>` } return '' } }, legend: { data: categories.map(category => ({ name: category.name, icon: category.symbol })), top: 8, right: 8, type: 'scroll' }, series: [{ type: 'graph', layout: 'force', data: graphNodes.map(node => ({ id: node.id, name: nodeDisplayName(node), category: nodeTypeLabel(node.type), value: node, symbol: nodeSymbol(node.type), symbolSize: nodeSize(node), itemStyle: { color: getNodeColor(node), borderColor: node.id === contextFocusId.value ? '#111827' : '#fff', borderWidth: node.id === contextFocusId.value ? 3 : 1 }, label: { show: shouldShowLabel(node), position: 'right', fontSize: 11, overflow: 'truncate', width: 140 } })), links: graphEdges.map(edge => ({ source: edge.source, target: edge.target, value: edge, label: { show: props.showEdgeLabels, formatter: edgeTypeLabel(edge.type), fontSize: 10 }, lineStyle: { width: Math.min(3, Math.max(1, Number(edge.weight) || 1)), curveness: 0.18 } })), categories, roam: true, draggable: true, force: { repulsion: 180, edgeLength: [80, 150], gravity: 0.08 }, emphasis: { focus: 'adjacency', lineStyle: { width: 3 } }, edgeSymbol: ['none', 'arrow'], edgeSymbolSize: 7 }] }
}
function initChart() {
  if (hasTruncation.value) emit('truncated', { nodes: nodes.value.length, edges: edges.value.length, maxNodes: props.maxNodes, maxEdges: props.maxEdges })
  if (!chartRef.value || props.loading || props.error || empty.value || overLimit.value) return
  disposeChart()
  chartInstance = echarts.init(chartRef.value)
  chartInstance.setOption(buildOption())
  chartInstance.on('click', params => {
    if (params.dataType === 'node') {
      selectedNodeId.value = params.data.id
      chartInstance.setOption(buildOption())
      emit('nodeClick', params.data.value || params.data)
    } else if (params.dataType === 'edge') emit('edgeClick', params.data.value || params.data)
  })
  chartInstance.on('graphRoam', event => emit('viewportChange', event))
}
function handleResize() { chartInstance?.resize() }
function zoom(delta) { if (chartInstance) chartInstance.dispatchAction({ type: 'graphRoam', zoom: delta > 0 ? 1.2 : 0.8 }); emit('zoom', delta) }
function fit() { chartInstance?.dispatchAction({ type: 'restore' }); emit('fit') }
function reset() { selectedNodeId.value = ''; chartInstance?.setOption(buildOption(), true); fit(); emit('reset') }
defineExpose({ zoom, fit, reset })
watch(() => [props.graph, props.loading, props.error, props.showEdgeLabels, props.showContextLabels, props.focusNodeId], async () => { await nextTick(); initChart() }, { deep: true })
onMounted(() => { initChart(); window.addEventListener('resize', handleResize); if (typeof ResizeObserver !== 'undefined') { resizeObserver = new ResizeObserver(handleResize); if (chartRef.value) resizeObserver.observe(chartRef.value) } })
onUnmounted(() => { resizeObserver?.disconnect(); window.removeEventListener('resize', handleResize); disposeChart() })
</script>

<template>
  <div class="knowledge-graph" :style="{ minHeight: height }">
    <div class="graph-toolbar" aria-label="图谱工具">
      <button type="button" title="放大" aria-label="放大" @click="zoom(1)"><ZoomIn :size="16" /></button>
      <button type="button" title="缩小" aria-label="缩小" @click="zoom(-1)"><ZoomOut :size="16" /></button>
      <button type="button" title="适配视口" aria-label="适配视口" @click="fit"><Maximize2 :size="16" /></button>
      <button type="button" title="重置视图" aria-label="重置视图" @click="reset"><RotateCcw :size="16" /></button>
    </div>
    <div v-if="loading" class="graph-state">正在加载局部图谱...</div>
    <div v-else-if="error" class="graph-state graph-error">{{ typeof error === 'string' ? error : (error.message || '图谱加载失败') }}</div>
    <div v-else-if="empty" class="graph-state">请选择一个焦点查看局部图谱</div>
    <div v-else-if="overLimit" class="graph-state graph-warning">局部图谱超过展示上限（{{ nodes.length }}/{{ maxNodes }} 个节点，{{ edges.length }}/{{ maxEdges }} 条关系），请缩小查询范围。</div>
    <div v-else ref="chartRef" class="graph-container" :style="{ height }"></div>
    <div v-if="hasTruncation && !overLimit" class="graph-notice">当前局部图谱已按服务端上限截断，展示 {{ nodes.length }} 个节点、{{ edges.length }} 条关系。</div>
  </div>
</template>

<style scoped>
.knowledge-graph { position: relative; width: 100%; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
.graph-container { width: 100%; }
.graph-toolbar { position: absolute; z-index: 2; top: 8px; left: 8px; display: flex; gap: 4px; }
.graph-toolbar button { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0; color: #374151; background: #fff; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; }
.graph-toolbar button:hover { color: #0f766e; border-color: #0f766e; }
.graph-state { display: flex; align-items: center; justify-content: center; min-height: 180px; padding: 24px; color: #6b7280; font-size: 14px; text-align: center; }
.graph-error { color: #b91c1c; }
.graph-warning { color: #92400e; background: #fffbeb; }
.graph-notice { padding: 8px 12px; color: #92400e; font-size: 12px; background: #fffbeb; border-top: 1px solid #fde68a; }
</style>
