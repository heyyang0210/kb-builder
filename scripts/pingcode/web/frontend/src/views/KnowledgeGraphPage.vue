<script setup>
import { ref, computed, onMounted } from 'vue'
import { Network, Info, Filter } from 'lucide-vue-next'
import KnowledgeGraph from '../components/KnowledgeGraph.vue'
import { request } from '../api'

const graph = ref(null)
const selectedNode = ref(null)
const selectedEdge = ref(null)
const filterType = ref('all')
const showOnlyDiscovered = ref(false)
const loading = ref(true)
const error = ref('')

// 加载数据
async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const graphData = await request('/api/index/graph?depth=2')
    graph.value = graphData
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// 节点类型列表
const nodeTypes = computed(() => {
  if (!graph.value || !graph.value.nodes) return ['all']
  const types = new Set(graph.value.nodes.map(n => n.type))
  return ['all', ...Array.from(types)]
})

// 过滤后的图谱
const filteredGraph = computed(() => {
  if (!graph.value) return { nodes: [], edges: [] }
  
  let nodes = [...graph.value.nodes]
  let edges = [...graph.value.edges]

  // 按类型过滤
  if (filterType.value !== 'all') {
    nodes = nodes.filter(n => n.type === filterType.value)
    const nodeIds = new Set(nodes.map(n => n.id))
    edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
  }

  // 只显示发现的关系
  if (showOnlyDiscovered.value) {
    edges = edges.filter(e => e.discovered)
  }

  return { nodes, edges }
})

function handleNodeClick(node) {
  selectedNode.value = node
  selectedEdge.value = null
}

function handleEdgeClick(edge) {
  selectedEdge.value = edge
  selectedNode.value = null
}

function clearSelection() {
  selectedNode.value = null
  selectedEdge.value = null
}

function nodeName(node) {
  return node?.displayName || node?.name || node?.rawName || node?.id || '-'
}

function nodeNameById(nodeId) {
  const node = graph.value?.nodes?.find(item => item.id === nodeId)
  return nodeName(node) || nodeId || '-'
}

const stats = computed(() => {
  if (!graph.value) return { totalNodes: 0, totalEdges: 0, filteredNodes: 0, filteredEdges: 0 }
  return {
    totalNodes: graph.value.nodes?.length || 0,
    totalEdges: graph.value.edges?.length || 0,
    filteredNodes: filteredGraph.value.nodes.length,
    filteredEdges: filteredGraph.value.edges.length
  }
})

onMounted(loadData)
</script>

<template>
  <div class="knowledge-graph-page">
    <div class="page-header">
      <div>
        <h1>知识图谱</h1>
        <p class="muted">全局索引视图：可视化关键词/知识点与文档块的上下文关联</p>
      </div>
      <div class="stats">
        <div class="stat-item">
          <Network :size="16" />
          <span>{{ stats.totalNodes }} 个节点</span>
        </div>
        <div class="stat-item">
          <span>{{ stats.totalEdges }} 条上下文关联</span>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
      <button @click="loadData">重试</button>
    </div>

    <div class="content-layout">
      <!-- 左侧：控制面板 -->
      <aside class="control-panel">
        <div class="panel-section">
          <h3>
            <Filter :size="14" />
            过滤器
          </h3>
          
          <div class="filter-group">
            <label>节点类型</label>
            <select v-model="filterType">
              <option v-for="type in nodeTypes" :key="type" :value="type">
                {{ type === 'all' ? '全部' : type }}
              </option>
            </select>
          </div>

          <div class="filter-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="showOnlyDiscovered" />
              <span>只显示自动发现的相关上下文</span>
            </label>
          </div>

          <div class="filter-stats">
            <div class="stat-row">
              <span>显示节点：</span>
              <strong>{{ stats.filteredNodes }}</strong>
            </div>
            <div class="stat-row">
              <span>显示关联：</span>
              <strong>{{ stats.filteredEdges }}</strong>
            </div>
          </div>
        </div>

        <div class="panel-section">
          <h3>
            <Info :size="14" />
            详细信息
          </h3>

          <div v-if="loading" class="empty-detail">
            <p>加载中...</p>
          </div>

          <div v-else-if="selectedNode" class="detail-card">
            <div class="detail-header">
              <span class="detail-type">{{ selectedNode.type }}</span>
              <button class="close-btn" @click="clearSelection">×</button>
            </div>
            <div class="detail-name">{{ nodeName(selectedNode) }}</div>
            <div v-if="selectedNode.rawName && selectedNode.rawName !== nodeName(selectedNode)" class="detail-evidence">
              <div class="evidence-label">原名：</div>
              <div class="evidence-text">{{ selectedNode.rawName }}</div>
            </div>
            <div v-if="selectedNode.evidenceText" class="detail-evidence">
              <div class="evidence-label">证据上下文：</div>
              <div class="evidence-text">{{ selectedNode.evidenceText }}</div>
            </div>
            <div v-if="selectedNode.occurrences" class="detail-occurrences">
              <div class="occurrences-label">出现次数：{{ selectedNode.occurrences.length }}</div>
            </div>
          </div>

          <div v-else-if="selectedEdge" class="detail-card">
            <div class="detail-header">
              <span class="detail-type">{{ selectedEdge.type }}</span>
              <button class="close-btn" @click="clearSelection">×</button>
            </div>
            <div class="detail-relation">
              {{ nodeNameById(selectedEdge.source) }} → {{ nodeNameById(selectedEdge.target) }}
            </div>
            <div v-if="selectedEdge.evidenceText" class="detail-evidence">
              <div class="evidence-label">证据上下文：</div>
              <div class="evidence-text">{{ selectedEdge.evidenceText }}</div>
            </div>
            <div v-if="selectedEdge.discovered" class="detail-badge">
              自动发现的相关上下文
            </div>
          </div>

          <div v-else class="empty-detail">
            <p>点击节点或关系查看详情</p>
          </div>
        </div>
      </aside>

      <!-- 右侧：图谱可视化 -->
      <main class="graph-panel">
        <div v-if="loading" class="loading">加载中...</div>
        <KnowledgeGraph 
          v-else-if="graph"
          :graph="filteredGraph" 
          height="650px"
          @nodeClick="handleNodeClick"
          @edgeClick="handleEdgeClick"
        />
        <div v-else class="empty">暂无知识图谱数据</div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.knowledge-graph-page {
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.page-header .muted {
  color: #666;
  font-size: 14px;
  margin: 0;
}

.stats {
  display: flex;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 13px;
  color: #555;
}

.error-message {
  padding: 12px 16px;
  background: #ffebee;
  color: #c62828;
  border-radius: 6px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-message button {
  background: #c62828;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.content-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
  min-height: 700px;
}

.control-panel {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.panel-section {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.panel-section:last-child {
  border-bottom: none;
}

.panel-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #333;
}

.filter-group {
  margin-bottom: 12px;
}

.filter-group label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.filter-group select {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.checkbox-label input {
  cursor: pointer;
}

.filter-stats {
  background: #f9f9f9;
  padding: 10px;
  border-radius: 6px;
  margin-top: 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 4px;
}

.stat-row:last-child {
  margin-bottom: 0;
}

.stat-row strong {
  color: #1976d2;
}

.detail-card {
  background: #f9f9f9;
  border-radius: 6px;
  padding: 12px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.detail-type {
  display: inline-block;
  padding: 2px 8px;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.detail-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.detail-relation {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #333;
}

.detail-evidence {
  background: white;
  border-left: 3px solid #1976d2;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.evidence-label, .occurrences-label {
  font-size: 11px;
  color: #666;
  margin-bottom: 4px;
  font-weight: 500;
}

.evidence-text {
  font-size: 13px;
  line-height: 1.5;
  color: #555;
  font-style: italic;
}

.detail-badge {
  display: inline-block;
  padding: 4px 8px;
  background: #fff3e0;
  color: #f57c00;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.empty-detail {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 13px;
}

.loading {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.graph-panel {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}
</style>
