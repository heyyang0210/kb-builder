<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { request } from '../api'
import VirtualTree from '../components/VirtualTree.vue'
import VirtualPageList from '../components/VirtualPageList.vue'
import { createRequestId } from '../utils/ids'

const router = useRouter()
const spaces = ref([])
const selectedSpace = ref(null)
const tree = ref(null)
const loadingSpaces = ref(false)
const loadingTree = ref(false)
const savingMapping = ref(false)
const error = ref('')
const spaceSearch = ref('')
const pageSearch = ref('')
const showMappedOnly = ref(false)
const includeRules = ref([])
const excludeRules = ref([])
const includePageBody = ref(true)
const includeAttachments = ref(true)
const selectedAttachmentGroups = ref([])
const customFileTypes = ref('')
const viewMode = ref(localStorage.getItem('pingcode-space-view-mode') || 'tree')
const batchName = ref('')
const estimate = ref(null)
const creating = ref(false)
const mappingForm = ref({ localName: '', localSlug: '', enabled: true })
const attachmentTypeGroups = [
  { label: 'Markdown / 文本', types: ['md', 'markdown', 'txt'] },
  { label: 'Word', types: ['doc', 'docx'] },
  { label: 'PowerPoint', types: ['ppt', 'pptx'] },
  { label: 'Excel', types: ['xls', 'xlsx', 'csv'] },
  { label: 'PDF', types: ['pdf'] },
  { label: 'SQL', types: ['sql'] },
  { label: '压缩包', types: ['zip', 'tar', '7z', 'gz'] },
]

function normalizeFileTypes(values) {
  return [...new Set(values.map(item => item.trim().toLowerCase().replace(/^\./, '')).filter(Boolean))]
}

const configuredFileTypes = computed(() => normalizeFileTypes([
  ...attachmentTypeGroups
    .filter(group => selectedAttachmentGroups.value.includes(group.label))
    .flatMap(group => group.types),
  ...customFileTypes.value.split(','),
]))

function formatBatchTimestamp(date = new Date()) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function defaultBatchName(localName) {
  return `${localName}-${formatBatchTimestamp()}`
}

const filteredSpaces = computed(() => {
  const query = spaceSearch.value.trim().toLowerCase()
  return spaces.value.filter(space => {
    if (showMappedOnly.value && !space.mapped) return false
    return !query || space.name.toLowerCase().includes(query) || space.key.toLowerCase().includes(query)
  })
})

const mappedCount = computed(() => spaces.value.filter(space => space.mapped).length)
const estimatedPageText = computed(() => {
  if (!estimate.value) return '-'
  if (estimate.value.pageEstimateState === 'unknown') return '待确认'
  if (estimate.value.pageEstimateState === 'upper_bound') return `最多 ${estimate.value.estimatedPages}`
  return String(estimate.value.estimatedPages)
})
const estimatedAttachmentText = computed(() => {
  if (!estimate.value) return '-'
  if (estimate.value.attachmentEstimateState === 'unknown') return '待确认'
  if (estimate.value.attachmentEstimateState === 'upper_bound') return `最多 ${estimate.value.estimatedAttachments}`
  return String(estimate.value.estimatedAttachments)
})
const estimateNeedsConfirmation = computed(() => estimate.value && (
  estimate.value.pageEstimateState !== 'exact' || estimate.value.attachmentEstimateState !== 'exact'
))
const flatPages = computed(() => {
  const result = []
  function visit(nodes, ancestors = []) {
    for (const node of nodes) {
      result.push({ ...node, children: undefined, breadcrumb: [...ancestors, node.name] })
      visit(node.children || [], [...ancestors, node.name])
    }
  }
  visit(tree.value?.items || [])
  return result
})

function setViewMode(mode) {
  viewMode.value = mode
  localStorage.setItem('pingcode-space-view-mode', mode)
}

function selectionPayload() {
  return {
    spaceKey: selectedSpace.value?.key,
    includeRules: includeRules.value,
    excludeRules: excludeRules.value,
    includePageBody: includePageBody.value,
    includeAttachments: includeAttachments.value,
    filters: {
      keyword: pageSearch.value || null,
      fileTypes: configuredFileTypes.value,
      skipEmpty: true,
      skipDeleted: true,
    },
  }
}

async function loadSpaces(refresh = false) {
  loadingSpaces.value = true
  error.value = ''
  try {
    const result = await request(`/api/pingcode/spaces?refresh=${refresh}`)
    spaces.value = result.items
    if (selectedSpace.value) {
      selectedSpace.value = spaces.value.find(item => item.key === selectedSpace.value.key) || null
    }
    if (!selectedSpace.value && spaces.value.length) {
      const preferred = spaces.value.find(item => item.key === 'YASSTORAGE') || spaces.value[0]
      await selectSpace(preferred)
    }
  } catch (reason) {
    error.value = reason.message
  } finally {
    loadingSpaces.value = false
  }
}

async function selectSpace(space) {
  selectedSpace.value = space
  tree.value = null
  estimate.value = null
  includeRules.value = []
  excludeRules.value = []
  mappingForm.value = space.mapping
    ? { localName: space.mapping.localName, localSlug: space.mapping.localSlug, enabled: space.mapping.enabled }
    : { localName: space.name, localSlug: space.key.toLowerCase(), enabled: true }
  selectedAttachmentGroups.value = []
  customFileTypes.value = ''
  batchName.value = defaultBatchName(space.mapping?.localName || space.name)
  await loadTree()
}

async function loadTree(refresh = false) {
  if (!selectedSpace.value) return
  loadingTree.value = true
  error.value = ''
  try {
    tree.value = await request(`/api/pingcode/spaces/${encodeURIComponent(selectedSpace.value.key)}/tree?refresh=${refresh}`)
  } catch (reason) {
    error.value = reason.message
  } finally {
    loadingTree.value = false
  }
}

async function saveMapping() {
  if (!selectedSpace.value) return
  savingMapping.value = true
  error.value = ''
  try {
    const mapping = await request(`/api/pingcode/spaces/${encodeURIComponent(selectedSpace.value.key)}/mapping`, {
      method: 'PUT', body: JSON.stringify(mappingForm.value),
    })
    selectedSpace.value = { ...selectedSpace.value, mapped: true, mapping }
    spaces.value = spaces.value.map(item => item.key === selectedSpace.value.key ? selectedSpace.value : item)
    batchName.value = defaultBatchName(mapping.localName)
  } catch (reason) {
    error.value = reason.message
  } finally {
    savingMapping.value = false
  }
}

async function estimateSelection() {
  if (!includeRules.value.length || !selectedSpace.value?.mapped) return
  error.value = ''
  try {
    estimate.value = await request('/api/material-batches/estimate', {
      method: 'POST', body: JSON.stringify(selectionPayload()),
    })
  } catch (reason) { error.value = reason.message }
}

async function createBatch() {
  if (!estimate.value || !batchName.value.trim()) return
  creating.value = true
  error.value = ''
  try {
    const batch = await request('/api/material-batches', {
      method: 'POST',
      headers: { 'Idempotency-Key': createRequestId() },
      body: JSON.stringify({ name: batchName.value.trim(), sourceSelection: selectionPayload() }),
    })
    router.push(`/batches/${batch.id}/download`)
  } catch (reason) { error.value = reason.message } finally { creating.value = false }
}

onMounted(() => loadSpaces())

watch(
  [selectedAttachmentGroups, customFileTypes, includePageBody, includeAttachments, pageSearch, includeRules, excludeRules],
  () => { estimate.value = null },
  { deep: true },
)
</script>

<template>
  <section class="spaces-page">
    <div class="page-header">
      <div><h1>PingCode 接入</h1><p class="muted">选择 PingCode 空间和文档范围，配置归属后创建资料加工任务。</p></div>
      <button class="button secondary" :disabled="loadingSpaces" @click="loadSpaces(true)">同步 PingCode 空间</button>
    </div>
    <div v-if="error" class="error global-error">{{ error }}</div>
    <div class="space-summary">
      <span>PingCode 空间 <strong>{{ spaces.length }}</strong></span>
      <span>已映射 <strong>{{ mappedCount }}</strong></span>
      <span>当前空间 <strong>{{ selectedSpace?.name || '-' }}</strong></span>
      <span :class="['mapping-status', selectedSpace?.mapped ? 'mapped' : 'unmapped']">{{ selectedSpace?.mapped ? '已映射' : '未映射' }}</span>
    </div>

    <div class="space-workbench">
      <aside class="space-list-panel">
        <div class="space-list-header"><strong>PingCode 空间</strong><span>{{ filteredSpaces.length }}</span></div>
        <input v-model="spaceSearch" class="search-input" placeholder="搜索空间名称或 Key" />
        <label class="mapped-filter"><input v-model="showMappedOnly" type="checkbox" /> 仅显示已映射</label>
        <div v-if="loadingSpaces" class="empty compact">正在读取空间列表...</div>
        <div v-else class="space-list">
          <button
            v-for="space in filteredSpaces"
            :key="space.id"
            :class="['space-item', { active: selectedSpace?.key === space.key }]"
            @click="selectSpace(space)"
          >
            <span class="space-avatar" :style="{ background: space.color }">{{ space.name.slice(0, 1) }}</span>
            <span class="space-copy"><strong>{{ space.name }}</strong><small>{{ space.key }}</small></span>
            <span :class="['mapping-dot', space.mapped ? 'mapped' : '']" :title="space.mapped ? '已映射' : '未映射'"></span>
          </button>
        </div>
      </aside>

      <main class="document-panel">
        <div v-if="selectedSpace" class="remote-space-card">
          <span class="space-avatar large" :style="{ background: selectedSpace.color }">{{ selectedSpace.name.slice(0, 1) }}</span>
          <div><h2>{{ selectedSpace.name }}</h2><p>{{ selectedSpace.description || '该空间暂无描述' }}</p><small>PingCode Key：{{ selectedSpace.key }} · {{ selectedSpace.archived ? '已归档' : '使用中' }}</small></div>
          <button class="button secondary small" :disabled="loadingTree" @click="loadTree(true)">刷新文档树</button>
        </div>
        <div class="tree-toolbar">
          <input v-model="pageSearch" class="search-input" placeholder="筛选当前空间的页面名称" />
          <div class="segmented" aria-label="文件浏览模式">
            <button :class="{ active: viewMode === 'tree' }" title="树状结构" @click="setViewMode('tree')">树状</button>
            <button :class="{ active: viewMode === 'flat' }" title="平铺列表" @click="setViewMode('flat')">平铺</button>
          </div>
          <span v-if="tree">{{ tree.total }} / {{ tree.reportedTotal }} 页</span>
        </div>
        <div v-if="tree?.completeness !== 'complete'" class="warning">当前只读取到部分空间文档：{{ tree?.incompleteReason || '完整性未知' }}</div>
        <div v-if="loadingTree" class="empty">正在读取 {{ selectedSpace?.name }} 文档树...</div>
        <VirtualTree v-else-if="viewMode === 'tree'" :items="tree?.items || []" :keyword="pageSearch" v-model:include-rules="includeRules" v-model:exclude-rules="excludeRules" />
        <VirtualPageList v-else :items="flatPages" :keyword="pageSearch" v-model:include-rules="includeRules" v-model:exclude-rules="excludeRules" />
      </main>

      <aside class="mapping-panel">
        <div class="mapping-section">
          <h2>空间映射</h2>
          <p class="muted">将 PingCode 空间映射为稳定的本地素材空间。浏览器只显示逻辑目录，不暴露服务器绝对路径。</p>
          <label class="field"><span>PingCode 空间</span><input :value="selectedSpace?.name || ''" disabled /></label>
          <label class="field"><span>本地素材空间名称</span><input v-model="mappingForm.localName" /></label>
          <label class="field"><span>本地目录标识</span><input v-model="mappingForm.localSlug" placeholder="例如 yasstorage" /></label>
          <label class="enabled-row"><input v-model="mappingForm.enabled" type="checkbox" /> 启用该映射</label>
          <div class="logical-path">逻辑目录：spaces/{{ mappingForm.localSlug || '-' }}</div>
          <button class="button" :disabled="!selectedSpace || savingMapping" @click="saveMapping">{{ savingMapping ? '保存中...' : selectedSpace?.mapped ? '更新映射' : '创建映射' }}</button>
        </div>

        <div class="mapping-section selection-section">
          <h2>下载范围</h2>
          <div v-if="!selectedSpace?.mapped" class="warning">请先创建空间映射，再选择文档并创建加工任务。</div>
          <div class="selection-stats"><span>包含规则 <strong>{{ includeRules.length }}</strong></span><span>排除规则 <strong>{{ excludeRules.length }}</strong></span></div>
          <label class="field"><span>任务名称</span><input v-model="batchName" :disabled="!selectedSpace?.mapped" /></label>
          <fieldset class="attachment-types" :disabled="!selectedSpace?.mapped">
            <legend>附件类型</legend>
            <label v-for="group in attachmentTypeGroups" :key="group.label" class="type-option">
              <input v-model="selectedAttachmentGroups" type="checkbox" :value="group.label" />
              <span>{{ group.label }}</span>
            </label>
          </fieldset>
          <label class="field"><span>自定义附件类型</span><input v-model="customFileTypes" :disabled="!selectedSpace?.mapped" placeholder="例如 xml,json,drawio" /><small>不选择任何类型表示下载全部默认允许类型；选择后仅下载所选和自定义类型。源码、脚本、可执行文件始终排除。</small></label>
          <div v-if="configuredFileTypes.length" class="selected-types">当前类型：{{ configuredFileTypes.map(item => `.${item}`).join('、') }}</div>
          <label class="enabled-row"><input v-model="includePageBody" type="checkbox" /> 页面正文</label>
          <label class="enabled-row"><input v-model="includeAttachments" type="checkbox" /> 页面附件</label>
          <div class="actions"><button class="button secondary" :disabled="!selectedSpace?.mapped || !includeRules.length" @click="estimateSelection">预估范围</button></div>
          <template v-if="estimate">
            <div class="estimate-grid"><div><strong>{{ estimatedPageText }}</strong><span>页面</span></div><div><strong>{{ estimatedAttachmentText }}</strong><span>附件</span></div></div>
            <div v-if="estimateNeedsConfirmation" class="warning">当前空间缺少可靠的字数或附件统计，空页面和附件数量将在实际下载时确认。</div>
            <div v-if="estimate.completeness !== 'complete'" class="warning">该任务基于当前可读取的部分来源。</div>
            <button class="button" :disabled="creating || !batchName.trim()" @click="createBatch">{{ creating ? '创建中...' : '创建加工任务' }}</button>
          </template>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.spaces-page { min-width: 1180px; }
.global-error { margin-bottom: 12px; }
.space-summary { display: flex; align-items: center; gap: 22px; padding: 10px 14px; margin-bottom: 12px; border: 1px solid #dce4ef; border-radius: 8px; background: white; color: #637086; font-size: 13px; }
.space-summary strong { color: #183b66; }
.mapping-status { margin-left: auto; padding: 4px 10px; border-radius: 999px; }
.mapping-status.mapped { color: #147a43; background: #eaf8ef; }
.mapping-status.unmapped { color: #8a4d08; background: #fff7e6; }
.space-workbench { display: grid; grid-template-columns: 270px minmax(520px, 1fr) 360px; height: calc(100vh - 184px); min-height: 650px; overflow: hidden; border: 1px solid #dce4ef; border-radius: 10px; background: white; }
.space-list-panel, .mapping-panel { overflow: auto; background: #fbfcfe; }
.space-list-panel { padding: 14px 10px; border-right: 1px solid #e1e7ef; }
.space-list-header { display: flex; justify-content: space-between; padding: 0 4px 10px; }
.space-list-header span { color: #7a8799; font-size: 12px; }
.search-input { width: 100%; padding: 9px 11px; border: 1px solid #ccd6e3; border-radius: 6px; }
.mapped-filter { display: block; margin: 10px 3px; color: #65748a; font-size: 12px; }
.space-list { display: grid; gap: 5px; }
.space-item { display: grid; grid-template-columns: 34px 1fr 10px; align-items: center; gap: 9px; width: 100%; padding: 9px; border: 1px solid transparent; border-radius: 7px; background: transparent; text-align: left; }
.space-item:hover { background: #f0f5fc; }
.space-item.active { border-color: #9fc0ed; background: #eaf2ff; }
.space-avatar { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 7px; color: white; font-weight: 700; }
.space-avatar.large { width: 44px; height: 44px; font-size: 18px; }
.space-copy { min-width: 0; }
.space-copy strong, .space-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.space-copy strong { color: #28384f; font-size: 13px; }
.space-copy small { margin-top: 3px; color: #8190a4; font-size: 11px; }
.mapping-dot { width: 8px; height: 8px; border-radius: 50%; background: #c9d1dc; }
.mapping-dot.mapped { background: #35a866; }
.document-panel { min-width: 0; padding: 16px; overflow: auto; }
.remote-space-card { display: grid; grid-template-columns: 44px 1fr auto; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid #e5eaf1; }
.remote-space-card h2 { margin: 0; font-size: 17px; }
.remote-space-card p { margin: 4px 0; color: #6e7c90; font-size: 12px; }
.remote-space-card small { color: #8491a3; }
.tree-toolbar { display: flex; align-items: center; gap: 12px; margin: 14px 0; }
.tree-toolbar span { flex: none; color: #708096; font-size: 12px; }
.segmented { display: flex; flex: none; padding: 2px; border: 1px solid #ccd6e3; border-radius: 6px; background: #f4f6f9; }
.segmented button { padding: 5px 9px; border: 0; border-radius: 4px; color: #66758a; background: transparent; font-size: 12px; }
.segmented button.active { color: #174f9d; background: white; box-shadow: 0 1px 2px rgba(23, 59, 102, .15); }
.mapping-panel { border-left: 1px solid #e1e7ef; }
.mapping-section { padding: 16px; border-bottom: 1px solid #e1e7ef; }
.mapping-section h2 { margin: 0 0 8px; font-size: 16px; }
.enabled-row { display: block; margin: 11px 0; color: #56657b; font-size: 13px; }
.logical-path { padding: 9px 10px; margin: 10px 0 12px; border-radius: 6px; color: #4f6078; background: #edf2f7; font-family: monospace; font-size: 12px; }
.attachment-types { display: flex; flex-wrap: wrap; gap: 7px; padding: 9px 10px 10px; margin: 12px 0; border: 1px solid #ccd6e3; border-radius: 6px; }
.attachment-types legend { padding: 0 4px; color: #56657b; font-size: 13px; }
.type-option { display: inline-flex; align-items: center; gap: 4px; padding: 5px 8px; border-radius: 5px; background: #edf2f7; color: #4f6078; font-size: 12px; }
.selected-types { padding: 8px 10px; margin-top: -4px; border-radius: 6px; background: #eef6ff; color: #315b8d; font-size: 12px; line-height: 1.5; }
.selection-stats { display: flex; gap: 16px; margin: 12px 0; color: #6d7b90; font-size: 12px; }
.selection-stats strong { color: #183b66; }
.estimate-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
.estimate-grid div { padding: 11px; border-radius: 7px; background: #f1f5fa; }
.estimate-grid strong, .estimate-grid span { display: block; }
.estimate-grid strong { font-size: 20px; color: #183b66; }
.estimate-grid span { color: #78869a; font-size: 11px; }
.empty.compact { padding: 24px 8px; }
</style>
