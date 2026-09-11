<script setup>
import { computed, ref, watch } from 'vue'
import { Maximize2, RotateCcw, Search, ZoomIn, ZoomOut } from 'lucide-vue-next'

const props = defineProps({
  candidates: { type: Array, default: () => [] },
  focusNodeId: { type: String, default: '' },
  depth: { type: Number, default: 1 },
  density: { type: String, default: 'focus' },
  loading: { type: Boolean, default: false }
})
const emit = defineEmits(['focusChange', 'depthChange', 'densityChange', 'zoomIn', 'zoomOut', 'fit', 'reset'])
const query = ref('')
const opened = ref(false)
const matches = computed(() => {
  const value = query.value.trim().toLocaleLowerCase()
  if (!value) return []
  return props.candidates.filter(item => [item.displayName, item.canonicalName, item.name, item.rawName, item.id, ...(item.aliases || [])].filter(Boolean).join(' ').toLocaleLowerCase().includes(value)).slice(0, 20)
})
const focusName = computed(() => {
  const item = props.candidates.find(candidate => candidate.id === props.focusNodeId)
  return item?.displayName || item?.canonicalName || item?.name || item?.rawName || ''
})
watch(() => props.focusNodeId, () => { query.value = focusName.value; opened.value = false })
function select(item) { query.value = item.displayName || item.canonicalName || item.name || item.rawName || item.id; opened.value = false; emit('focusChange', item.id) }
function submit() { const exact = matches.value.find(item => [item.displayName, item.canonicalName, item.name, item.rawName, item.id].filter(Boolean).some(value => value.toLocaleLowerCase() === query.value.trim().toLocaleLowerCase())); if (exact) select(exact); else opened.value = true }
</script>

<template>
  <div class="graph-toolbar-panel" aria-label="局部图谱工具栏">
    <div class="focus-search">
      <Search :size="17" aria-hidden="true" />
      <input v-model="query" type="search" placeholder="全局搜索关键词、别名或 ID" aria-label="全局搜索图谱关键词" :disabled="loading" @focus="opened = true" @input="opened = true" @keydown.enter.prevent="submit">
      <button type="button" :disabled="loading || !query.trim()" @click="submit">定位</button>
      <div v-if="opened && query.trim()" class="search-results" role="listbox" aria-label="关键词搜索结果">
        <button v-for="item in matches" :key="item.id" type="button" role="option" :aria-selected="item.id === focusNodeId" @click="select(item)">
          <strong>{{ item.displayName || item.canonicalName || item.name || item.rawName || item.id }}</strong><small>{{ item.id }}</small>
        </button>
        <p v-if="!matches.length">未找到匹配关键词</p>
      </div>
    </div>
    <div class="segmented" aria-label="探索深度">
      <button v-for="value in [1, 2]" :key="value" type="button" :class="{ active: depth === value }" :disabled="loading" @click="$emit('depthChange', value)">{{ value }} 跳</button>
    </div>
    <label>标签<select :value="density" :disabled="loading" @change="$emit('densityChange', $event.target.value)"><option value="focus">焦点与异常</option><option value="all">全部标签</option></select></label>
    <div class="icon-actions">
      <button type="button" title="放大" aria-label="放大" @click="$emit('zoomIn')"><ZoomIn :size="17" /></button>
      <button type="button" title="缩小" aria-label="缩小" @click="$emit('zoomOut')"><ZoomOut :size="17" /></button>
      <button type="button" title="适配视口" aria-label="适配视口" @click="$emit('fit')"><Maximize2 :size="17" /></button>
      <button type="button" title="重置局部图" aria-label="重置局部图" @click="$emit('reset')"><RotateCcw :size="17" /></button>
    </div>
  </div>
</template>

<style scoped>
.graph-toolbar-panel { display: grid; grid-template-columns: minmax(260px, 1fr) auto auto auto; align-items: center; gap: 10px; padding: 10px; border: 1px solid #dce3ec; border-radius: 6px; background: #fafbfd; }
.focus-search { position: relative; display: flex; align-items: center; gap: 7px; min-width: 0; }
.focus-search input { width: 100%; min-width: 0; height: 34px; padding: 7px 9px; border: 1px solid #b9c5d3; border-radius: 5px; }
.focus-search > button, .segmented button { min-height: 34px; padding: 6px 10px; border: 1px solid #b9c5d3; background: #fff; color: #40536a; cursor: pointer; }
.focus-search > button { border-radius: 5px; }
.search-results { position: absolute; z-index: 6; top: 39px; left: 24px; right: 55px; max-height: 280px; overflow: auto; border: 1px solid #b9c5d3; border-radius: 5px; background: #fff; box-shadow: 0 8px 20px rgb(31 52 77 / 16%); }
.search-results button { display: grid; gap: 2px; width: 100%; padding: 8px 10px; border: 0; border-bottom: 1px solid #edf1f5; background: #fff; color: #26384d; text-align: left; cursor: pointer; }
.search-results button:hover, .search-results button[aria-selected="true"] { background: #eef6fd; }
.search-results small { overflow: hidden; color: #66758a; text-overflow: ellipsis; }
.search-results p { margin: 0; padding: 14px; color: #66758a; text-align: center; }
.segmented { display: inline-flex; }
.segmented button:first-child { border-radius: 5px 0 0 5px; }
.segmented button:last-child { border-left: 0; border-radius: 0 5px 5px 0; }
.segmented button.active { border-color: #1769aa; background: #1769aa; color: #fff; }
label { display: flex; align-items: center; gap: 5px; color: #526174; font-size: 12px; }
select { height: 34px; padding: 5px 8px; border: 1px solid #b9c5d3; border-radius: 5px; background: #fff; color: #26384d; }
.icon-actions { display: flex; gap: 4px; }
.icon-actions button { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0; border: 1px solid #b9c5d3; border-radius: 5px; background: #fff; color: #40536a; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .55; }
@media (max-width: 900px) { .graph-toolbar-panel { grid-template-columns: 1fr auto; } .focus-search { grid-column: 1 / -1; } }
@media (max-width: 560px) { .graph-toolbar-panel { grid-template-columns: 1fr; align-items: stretch; } .focus-search { grid-column: auto; } .icon-actions { justify-content: flex-start; } .search-results { left: 0; right: 0; } }
</style>
