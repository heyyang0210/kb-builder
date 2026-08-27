<script setup>
import { Search } from 'lucide-vue-next'

defineProps({
  items: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  query: { type: String, default: '' },
  category: { type: String, default: '' },
  resourceId: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  loading: { type: Boolean, default: false },
  availability: { type: String, default: 'available' },
  selectedId: { type: String, default: '' },
})
defineEmits(['query-change', 'category-change', 'resource-change', 'page-change', 'select'])
</script>

<template>
  <section class="issue-navigator" aria-label="图谱问题与全局搜索">
    <header><h3>问题与搜索</h3><span>{{ total }} 项</span></header>
    <label class="search-field">
      <Search :size="16" aria-hidden="true" />
      <input :value="query" placeholder="全局搜索节点、别名或 ID" @input="$emit('query-change', $event.target.value)" />
    </label>
    <div class="filters">
      <select :value="category" aria-label="问题类别" @change="$emit('category-change', $event.target.value)">
        <option value="">全部问题类别</option>
        <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.label || item.id }}</option>
      </select>
      <input :value="resourceId" aria-label="文档资源 ID" placeholder="文档资源 ID" @change="$emit('resource-change', $event.target.value.trim())" />
    </div>
    <p v-if="availability === 'stale'" class="state warning">历史图谱已过期，未拼接当前同名节点。</p>
    <p v-else-if="loading" class="state">正在搜索完整投影...</p>
    <div v-else class="results">
      <button v-for="item in items" :key="item.id" :class="{ active: selectedId === item.id }" @click="$emit('select', item)">
        <strong>{{ item.displayName || item.canonicalName || item.name || item.id }}</strong>
        <span>{{ item.type || '未知类型' }}<template v-if="item.issueCategory"> · {{ item.issueCategory }}</template></span>
      </button>
      <p v-if="!items.length" class="state">没有符合当前条件的节点。</p>
    </div>
    <footer v-if="total > pageSize">
      <button :disabled="page <= 1" @click="$emit('page-change', page - 1)">上一页</button>
      <span>第 {{ page }} / {{ Math.ceil(total / pageSize) }} 页</span>
      <button :disabled="page * pageSize >= total" @click="$emit('page-change', page + 1)">下一页</button>
    </footer>
  </section>
</template>

<style scoped>
.issue-navigator { min-width: 0; border-right: 1px solid #dce3ec; }
header, footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; }
h3 { margin: 0; font-size: 14px; }
header span, footer span { color: #66758a; font-size: 12px; }
.search-field { display: flex; align-items: center; gap: 7px; margin: 0 12px 9px; padding: 0 9px; border: 1px solid #b9c5d3; border-radius: 5px; }
.search-field input { width: 100%; min-width: 0; height: 34px; border: 0; outline: 0; }
.filters { display: grid; gap: 7px; padding: 0 12px 10px; }
.filters select, .filters input { width: 100%; min-width: 0; height: 34px; padding: 6px 8px; border: 1px solid #b9c5d3; border-radius: 5px; background: white; }
.results { display: grid; max-height: 520px; overflow: auto; }
.results button { display: grid; gap: 4px; padding: 10px 12px; border: 0; border-top: 1px solid #edf0f4; color: #26384d; background: white; text-align: left; }
.results button:hover, .results button.active { background: #eef6fd; }
.results strong { overflow-wrap: anywhere; font-size: 13px; }
.results span { color: #66758a; font-size: 11px; }
.state { margin: 0; padding: 18px 12px; color: #66758a; font-size: 12px; }
.state.warning { color: #8a5508; background: #fff8e8; }
footer button { padding: 5px 8px; border: 1px solid #b9c5d3; border-radius: 5px; background: white; }
</style>
