<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  graph: { type: Object, required: true },
  height: { type: String, default: '600px' },
  showEdgeLabels: { type: Boolean, default: true }
})

const emit = defineEmits(['nodeClick', 'edgeClick'])

const chartRef = ref(null)
let chartInstance = null

// 节点类型颜色映射
const nodeTypeColors = {
  'Keyword': '#00897b',
  'Parameter': '#1976d2',
  'Component': '#388e3c',
  'ErrorCode': '#d32f2f',
  'YashanDBErrorCode': '#d32f2f',
  'OracleErrorCode': '#c62828',
  'Version': '#f57c00',
  'Configuration': '#7b1fa2',
  'Concept': '#455a64',
  'ProcessingUnit': '#546e7a',
  'Chunk': '#546e7a',
  'KnowledgePoint': '#0097a7',
  'Document': '#5d4037',
  'default': '#757575'
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
  MENTIONS: '提及上下文',
  AFFECTS: '影响',
  DEPENDS_ON: '依赖',
  RELATED_TO: '相关',
  COMPARED_WITH: '对比',
}

function nodeDisplayName(node) {
  return node.displayName || node.name || node.rawName || node.id || ''
}

function getNodeColor(type) {
  return nodeTypeColors[type] || nodeTypeColors.default
}

function getBusinessStatus(node) {
  return node.businessStatus || node.properties?.businessStatus || ''
}

function getBusinessBorder(node) {
  const status = getBusinessStatus(node)
  if (status === 'businessAccepted') return '#1a7f37'
  if (status === 'businessRejected') return '#c2410c'
  if (status === 'needsReview') return '#d97706'
  return '#ffffff'
}

function isBusinessInjected(node) {
  const methods = node.sourceMethods || node.properties?.sourceMethods || [node.sourceMethod || node.properties?.sourceMethod]
  return methods.some(method => ['domain_term', 'domain_glossary_title', 'deterministic_title_glossary'].includes(method))
}

function businessStatusLabel(status) {
  return {
    businessAccepted: '业务准入',
    businessRejected: '业务排除',
    needsReview: '待业务确认',
  }[status] || '待执行业务过滤'
}

function nodeTypeLabel(type) {
  return nodeTypeLabels[type] || type || '未知类型'
}

function edgeTypeLabel(type) {
  return edgeTypeLabels[type] || type || '未知关系'
}

function initChart() {
  if (!chartRef.value || !props.graph) return
  
  chartInstance = echarts.init(chartRef.value)
  
  const nodes = (props.graph.nodes || []).map(node => ({
    id: node.id,
    name: nodeDisplayName(node),
    symbolSize: 30 + (node.occurrences?.length || 1) * 5,
    category: nodeTypeLabel(node.type),
    itemStyle: {
      color: getNodeColor(node.type),
      borderColor: getBusinessBorder(node),
      borderWidth: node.type === 'Keyword' ? (isBusinessInjected(node) ? 5 : 3) : 1,
      opacity: getBusinessStatus(node) === 'businessRejected' ? 0.45 : 1
    },
    label: {
      show: true,
      position: 'right',
      formatter: function(params) {
        const value = params.data.value
        if (value?.type === 'Keyword' && getBusinessStatus(value) === 'needsReview') return `${params.name}\n待业务确认`
        if (value?.type === 'Keyword' && isBusinessInjected(value)) return `${params.name}\n业务注入`
        return params.name
      },
      fontSize: 11
    },
    value: node
  }))
  
  const categoryTypes = [...new Set((props.graph.nodes || []).map(node => node.type))]
  const categories = categoryTypes.map(type => ({
    name: nodeTypeLabel(type),
    itemStyle: {
      color: getNodeColor(type)
    }
  }))
  
  const edges = (props.graph.edges || []).map(edge => ({
    source: edge.source,
    target: edge.target,
    label: {
      show: props.showEdgeLabels,
      formatter: edgeTypeLabel(edge.type),
      fontSize: 10
    },
    lineStyle: {
      width: edge.weight || 1,
      curveness: 0.2
    },
    value: edge
  }))
  
  const option = {
	    title: {
	      text: '知识图谱',
	      subtext: `节点: ${nodes.length}, 上下文关联: ${edges.length}`,
      top: 10,
      left: 10
    },
    tooltip: {
      trigger: 'item',
      formatter: function(params) {
        if (params.dataType === 'node') {
          const node = params.data.value
      return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${node.displayName || node.name || node.rawName || ''}</div>
              ${node.canonicalName && node.canonicalName !== (node.displayName || node.name) ? `<div style="color: #666; font-size: 12px;">标准名: ${node.canonicalName}</div>` : ''}
              ${Array.isArray(node.aliases) && node.aliases.length ? `<div style="color: #888; font-size: 12px;">别名: ${node.aliases.join('、')}</div>` : ''}
              ${Array.isArray(node.matchedAliases) && node.matchedAliases.length ? `<div style="color: #888; font-size: 12px;">命中别名: ${node.matchedAliases.join('、')}</div>` : ''}
              ${node.rawName && node.rawName !== (node.displayName || node.name) ? `<div style="color: #888; font-size: 12px;">原名: ${node.rawName}</div>` : ''}
              <div style="color: #666; font-size: 12px;">类型: ${nodeTypeLabel(node.type)}</div>
              ${node.type === 'Keyword' ? `<div style="color: #666; font-size: 12px;">业务状态: ${businessStatusLabel(getBusinessStatus(node))}</div>` : ''}
              ${node.type === 'Keyword' && isBusinessInjected(node) ? '<div style="color: #175cd3; font-size: 12px;">业务注入关键词</div>' : ''}
		              ${node.evidenceText ? `<div style="margin-top: 4px; font-size: 12px;">证据上下文: ${node.evidenceText}</div>` : ''}
            </div>
          `
        } else if (params.dataType === 'edge') {
          const edge = params.data.value
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${edgeTypeLabel(edge.type)}</div>
              <div style="color: #666; font-size: 12px;">${edge.source} → ${edge.target}</div>
	              ${edge.evidenceText ? `<div style="margin-top: 4px; font-size: 12px;">证据上下文: ${edge.evidenceText}</div>` : ''}
            </div>
          `
        }
        return ''
      }
    },
    legend: {
      data: categories.map(c => c.name),
      top: 10,
      right: 10
    },
    series: [{
      type: 'graph',
      layout: 'force',
      data: nodes,
      links: edges,
      categories: categories,
      roam: true,
      draggable: true,
      force: {
        repulsion: 300,
        edgeLength: [100, 200],
        gravity: 0.1
      },
      emphasis: {
        focus: 'adjacency',
        lineStyle: {
          width: 3
        }
      },
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 8
    }]
  }
  
  chartInstance.setOption(option)
  
  // 节点点击事件
  chartInstance.on('click', 'series.graph', function(params) {
    if (params.dataType === 'node') {
      emit('nodeClick', params.data.value)
    } else if (params.dataType === 'edge') {
      emit('edgeClick', params.data.value)
    }
  })
}

function handleResize() {
  if (chartInstance) {
    chartInstance.resize()
  }
}

watch(() => props.graph, () => {
  if (chartInstance) {
    chartInstance.dispose()
  }
  initChart()
}, { deep: true })

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="knowledge-graph">
    <div ref="chartRef" class="graph-container" :style="{ height }"></div>
  </div>
</template>

<style scoped>
.knowledge-graph {
  width: 100%;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.graph-container {
  width: 100%;
}
</style>
