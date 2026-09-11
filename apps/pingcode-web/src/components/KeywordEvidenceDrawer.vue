<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { request } from '../api'

const props = defineProps({
  open: { type: Boolean, default: false },
  datasetId: { type: String, required: true },
  filterRunId: { type: String, required: true },
  category: { type: String, default: '' },
  keywordId: { type: String, default: '' },
  resourceId: { type: String, default: '' },
})

const emit = defineEmits(['close', 'state-change'])
const loading = ref(false)
const error = ref('')
const query = ref('')
const queryApplied = ref('')
const missingOnly = ref(false)
const page = ref(1)
const pageSize = ref(50)
const total = ref(0)
const items = ref([])
const selectedKeywordId = ref(props.keywordId)
const selectedResourceId = ref(props.resourceId)
const searchInput = ref(null)
let searchTimer = null
let returnFocusElement = null

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function emitState() {
  emit('state-change', {
    category: props.category,
    keywordId: selectedKeywordId.value,
    resourceId: selectedResourceId.value,
  })
}

async function loadEvidence() {
  if (!props.open || !props.datasetId || !props.filterRunId || !props.category) return
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ category: props.category, page: String(page.value), pageSize: String(pageSize.value) })
    if (selectedKeywordId.value) params.set('keywordId', selectedKeywordId.value)
    if (selectedResourceId.value) params.set('resourceId', selectedResourceId.value)
    if (queryApplied.value.trim()) params.set('query', queryApplied.value.trim())
    if (missingOnly.value) params.set('missingEvidence', 'true')
    const payload = await request(`/api/datasets/${encodeURIComponent(props.datasetId)}/keyword-filter-runs/${encodeURIComponent(props.filterRunId)}/issue-evidence?${params}`)
    items.value = payload.items || []
    total.value = Number(payload.total || 0)
  } catch (reason) {
    items.value = []
    total.value = 0
    error.value = `加载证据失败：${reason.message}`
  } finally {
    loading.value = false
  }
}

function updateSearch(value) {
  query.value = value
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    queryApplied.value = value
    page.value = 1
    loadEvidence()
  }, 300)
}

function selectKeyword(item) {
  selectedKeywordId.value = selectedKeywordId.value === item.keywordId ? '' : item.keywordId
  selectedResourceId.value = ''
  page.value = 1
  emitState()
  loadEvidence()
}

function selectDocument(document) {
  selectedResourceId.value = selectedResourceId.value === document.resourceId ? '' : document.resourceId
  page.value = 1
  emitState()
  loadEvidence()
}

function clearPosition() {
  selectedKeywordId.value = ''
  selectedResourceId.value = ''
  page.value = 1
  emitState()
  loadEvidence()
}

function changePage(delta) {
  page.value = Math.min(pageCount.value, Math.max(1, page.value + delta))
  loadEvidence()
}

function evidenceStatus(item) {
  if (item.evidenceAvailability === 'stale') return '运行对应的图谱版本已不可用，无法安全关联证据。'
  if (item.evidenceAvailability === 'missing') return '未保存可用的来源或证据。'
  return ''
}

function handleKeydown(event) {
  if (event.key === 'Escape' && props.open) emit('close')
}

watch(() => [props.open, props.filterRunId, props.category], async () => {
  if (!props.open) return
  selectedKeywordId.value = props.keywordId || ''
  selectedResourceId.value = props.resourceId || ''
  page.value = 1
  await nextTick()
  loadEvidence()
}, { immediate: true })

watch(() => [props.keywordId, props.resourceId], () => {
  selectedKeywordId.value = props.keywordId || ''
  selectedResourceId.value = props.resourceId || ''
})

watch(() => props.open, value => {
  if (value) {
    returnFocusElement = document.activeElement
    window.addEventListener('keydown', handleKeydown)
    nextTick(() => searchInput.value?.focus())
  } else {
    window.removeEventListener('keydown', handleKeydown)
    if (returnFocusElement instanceof HTMLElement) nextTick(() => returnFocusElement.focus())
    returnFocusElement = null
  }
}, { immediate: true })

onUnmounted(() => {
  clearTimeout(searchTimer)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div v-if="open" class="drawer-layer" role="presentation" @click.self="emit('close')">
    <aside class="evidence-drawer" role="dialog" aria-modal="true" aria-label="关键词问题证据下钻">
      <header>
        <div><h2>问题证据下钻</h2><p>类别 → 关键词 → 文档 → 证据</p></div>
        <button type="button" aria-label="关闭证据下钻" @click="emit('close')">关闭</button>
      </header>
      <div class="drawer-controls">
        <input ref="searchInput" :value="query" type="search" placeholder="全局搜索关键词或文档" aria-label="全局搜索证据" @input="updateSearch($event.target.value)">
        <label><input v-model="missingOnly" type="checkbox" @change="page = 1; loadEvidence()"> 仅看无证据</label>
        <select v-model.number="pageSize" aria-label="证据每页条数" @change="page = 1; loadEvidence()"><option :value="50">每页 50 条</option><option :value="100">每页 100 条</option></select>
        <button v-if="selectedKeywordId || selectedResourceId" type="button" @click="clearPosition">返回类别全部结果</button>
      </div>
      <div class="breadcrumb">当前类别：{{ category }}<template v-if="selectedKeywordId"> → 关键词 {{ selectedKeywordId }}</template><template v-if="selectedResourceId"> → 文档 {{ selectedResourceId }}</template></div>
      <div v-if="error" class="alert" role="alert">{{ error }}</div>
      <div v-if="loading" class="empty">正在加载证据...</div>
      <div v-else-if="!items.length" class="empty">当前服务端筛选条件下暂无结果。</div>
      <div v-else class="evidence-results">
        <article v-for="item in items" :key="item.keywordId" class="keyword-evidence">
          <button class="keyword-heading" type="button" @click="selectKeyword(item)"><strong>{{ item.keywordName || item.keywordId }}</strong><span>{{ item.finalCategoryLabel || item.finalCategory }}</span><small>{{ item.userOverride ? '已人工调整' : '未人工调整' }}</small></button>
          <p class="reason">判定理由：{{ item.reason || '未记录' }}</p>
          <p v-if="evidenceStatus(item)" class="fact-status">{{ evidenceStatus(item) }}</p>
          <section v-for="document in item.documents || []" :key="document.resourceId" class="document-group">
            <button type="button" @click="selectDocument(document)"><strong>{{ document.documentTitle || '未命名文档' }}</strong><span>{{ document.occurrences?.length || 0 }} 条证据</span><small>{{ document.sourcePath || document.resourceId }}</small></button>
            <div v-if="!document.occurrences?.length" class="missing">该文档未返回证据片段。</div>
            <blockquote v-for="(occurrence, index) in document.occurrences || []" :key="`${occurrence.chunkId}-${index}`">
              <small>{{ occurrence.headingPath?.join(' / ') || '未记录章节' }} · {{ occurrence.chunkId || '未记录文档块' }}</small>
              <p>{{ occurrence.evidenceText || '该条记录没有证据文本。' }}</p>
            </blockquote>
          </section>
          <div v-if="!(item.documents || []).length && !evidenceStatus(item)" class="missing">未返回来源文档。</div>
        </article>
      </div>
      <footer v-if="total">
        <button type="button" :disabled="page <= 1" @click="changePage(-1)">上一页</button>
        <span>第 {{ page }} / {{ pageCount }} 页，共 {{ total }} 个关键词</span>
        <button type="button" :disabled="page >= pageCount" @click="changePage(1)">下一页</button>
      </footer>
    </aside>
  </div>
</template>

<style scoped>
.drawer-layer { position: fixed; inset: 0; z-index: 80; display: flex; justify-content: flex-end; background: rgba(27, 39, 54, .28); }
.evidence-drawer { width: min(760px, 72vw); height: 100%; box-sizing: border-box; display: grid; grid-template-rows: auto auto auto auto minmax(0, 1fr) auto; padding: 16px; background: #fff; box-shadow: -8px 0 24px rgba(31, 50, 74, .16); }
header, footer, .keyword-heading, .document-group > button { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
h2, p { margin: 0; }
header p { margin-top: 3px; color: #66758a; font-size: 12px; }
button, input, select { min-height: 34px; padding: 6px 9px; border: 1px solid #b9c5d3; border-radius: 5px; background: #fff; color: #26384d; }
button { cursor: pointer; }
.drawer-controls { display: grid; grid-template-columns: minmax(180px, 1fr) auto auto auto; gap: 8px; margin-top: 12px; }
.drawer-controls label { display: flex; align-items: center; white-space: nowrap; color: #526174; font-size: 12px; }
.drawer-controls label input { min-height: auto; }
.breadcrumb { margin-top: 10px; padding: 7px 9px; border-radius: 5px; background: #eef6fd; color: #40536a; font-size: 12px; overflow-wrap: anywhere; }
.alert { margin-top: 8px; padding: 8px; border: 1px solid #efb4b4; border-radius: 5px; background: #fff2f2; color: #a12622; }
.empty { padding: 30px 10px; color: #66758a; text-align: center; }
.evidence-results { min-height: 0; display: grid; align-content: start; gap: 10px; margin-top: 10px; overflow: auto; }
.keyword-evidence { padding: 10px; border: 1px solid #dce3ec; border-radius: 7px; }
.keyword-heading { width: 100%; border: 0; padding: 0; text-align: left; }
.keyword-heading strong { margin-right: auto; }
.keyword-heading span { padding: 2px 6px; border-radius: 4px; background: #fff0ed; color: #ad351f; font-size: 11px; }
.keyword-heading small { color: #66758a; }
.reason { margin-top: 7px; color: #526174; font-size: 12px; }
.fact-status, .missing { margin-top: 8px; padding: 8px; border-radius: 5px; background: #fff5e8; color: #8a5b14; font-size: 12px; }
.document-group { margin-top: 9px; border-top: 1px solid #e1e6ec; padding-top: 8px; }
.document-group > button { width: 100%; border: 0; padding: 0; text-align: left; }
.document-group > button small { color: #66758a; overflow-wrap: anywhere; }
blockquote { margin: 8px 0 0; padding: 8px 10px; border-left: 3px solid #9eb8d1; background: #f7fafc; }
blockquote small { color: #66758a; }
blockquote p { margin-top: 5px; color: #34475d; line-height: 1.55; white-space: pre-wrap; }
footer { justify-content: center; margin-top: 10px; color: #66758a; font-size: 12px; }
@media (max-width: 700px) {
  .evidence-drawer { width: 100%; padding: 12px; }
  .drawer-controls { grid-template-columns: 1fr; }
  header { align-items: flex-start; }
  .keyword-heading, .document-group > button { align-items: flex-start; flex-direction: column; }
}
</style>
