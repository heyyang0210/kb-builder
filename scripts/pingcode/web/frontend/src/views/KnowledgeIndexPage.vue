<script setup>
import { ref, computed, onMounted } from 'vue'
import { Search, Filter, BookOpen } from 'lucide-vue-next'
import DirectoryTree from '../components/DirectoryTree.vue'
import KnowledgeCard from '../components/KnowledgeCard.vue'
import { request } from '../api'

const directoryTree = ref(null)
const knowledgePoints = ref([])
const selectedNode = ref(null)
const searchQuery = ref('')
const showCompact = ref(false)
const loading = ref(true)
const error = ref('')

// 加载数据
async function loadData() {
  loading.value = true
  error.value = ''
  try {
    // 加载目录树
    const treeData = await request('/api/index/directory-tree')
    directoryTree.value = treeData
    
    // 加载所有知识点（通过搜索空查询）
    const searchData = await request('/api/index/search?query=&limit=100')
    knowledgePoints.value = searchData.items || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// 搜索知识点
async function searchKnowledge() {
  if (!searchQuery.value.trim()) {
    // 如果搜索词为空，加载所有知识点
    const searchData = await request('/api/index/search?query=&limit=100')
    knowledgePoints.value = searchData.items || []
  } else {
    const searchData = await request(`/api/index/search?query=${encodeURIComponent(searchQuery.value)}&limit=100`)
    knowledgePoints.value = searchData.items || []
  }
}

// 过滤知识点
const filteredKnowledgePoints = computed(() => {
  let filtered = knowledgePoints.value
  
  // 按选中节点过滤
  if (selectedNode.value) {
    filtered = filtered.filter(kp => kp.sectionId === selectedNode.value.id)
  }
  
  return filtered
})

const stats = computed(() => ({
  totalDocuments: directoryTree.value ? Object.keys(directoryTree.value.documents || {}).length : 0,
  totalKnowledgePoints: knowledgePoints.value.length,
  filteredCount: filteredKnowledgePoints.value.length
}))

function handleNodeSelect(node) {
  selectedNode.value = node
}

function clearSelection() {
  selectedNode.value = null
}

onMounted(loadData)
</script>

<template>
  <div class="knowledge-index-page">
    <div class="page-header">
      <div>
        <h1>知识点索引</h1>
        <p class="muted">浏览和搜索从文档中提取的知识点</p>
      </div>
      <div class="stats">
        <div class="stat-item">
          <BookOpen :size="16" />
          <span>{{ stats.totalDocuments }} 篇文档</span>
        </div>
        <div class="stat-item">
          <span>{{ stats.totalKnowledgePoints }} 个知识点</span>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
      <button @click="loadData">重试</button>
    </div>

    <div class="content-layout">
      <!-- 左侧：目录树 -->
      <aside class="sidebar-panel">
        <div class="panel-header">
          <h2>文档目录</h2>
        </div>
        <div class="panel-content">
          <div v-if="loading" class="loading">加载中...</div>
          <DirectoryTree 
            v-else-if="directoryTree"
            :tree="directoryTree.tree" 
            :selectedId="selectedNode?.id"
            @select="handleNodeSelect"
          />
          <div v-else class="empty">暂无文档</div>
        </div>
      </aside>

      <!-- 中间：知识点列表 -->
      <main class="main-panel">
        <div class="panel-header">
          <h2>
            知识点列表
            <span class="count-badge">{{ filteredKnowledgePoints.length }}</span>
          </h2>
          <div class="panel-actions">
            <div class="search-box">
              <Search :size="16" />
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="搜索知识点..."
                @input="searchKnowledge"
              />
            </div>
            <label class="compact-toggle">
              <input type="checkbox" v-model="showCompact" />
              <span>紧凑模式</span>
            </label>
          </div>
        </div>

        <div class="panel-content">
          <div v-if="loading" class="loading">加载中...</div>
          <template v-else>
            <div v-if="selectedNode" class="selection-info">
              <span>当前筛选：{{ selectedNode.name }}</span>
              <button class="text-button" @click="clearSelection">清除筛选</button>
            </div>

            <div v-if="filteredKnowledgePoints.length === 0" class="empty-state">
              <p>没有找到匹配的知识点</p>
            </div>

            <div v-else class="knowledge-list">
              <KnowledgeCard 
                v-for="kp in filteredKnowledgePoints" 
                :key="kp.id"
                :knowledge="kp"
                :compact="showCompact"
              />
            </div>
          </template>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.knowledge-index-page {
  padding: 24px;
  max-width: 1400px;
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
  grid-template-columns: 280px 1fr;
  gap: 20px;
  min-height: 600px;
}

.sidebar-panel, .main-panel {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h2 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-badge {
  background: #1976d2;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.panel-content {
  padding: 16px;
  max-height: 600px;
  overflow-y: auto;
}

.panel-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
}

.search-box input {
  border: none;
  outline: none;
  font-size: 13px;
  width: 200px;
}

.compact-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.compact-toggle input {
  cursor: pointer;
}

.selection-info {
  padding: 10px 12px;
  background: #e3f2fd;
  border-radius: 6px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.text-button {
  background: none;
  border: none;
  color: #1976d2;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.text-button:hover {
  text-decoration: underline;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
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

.knowledge-list {
  display: flex;
  flex-direction: column;
}
</style>
