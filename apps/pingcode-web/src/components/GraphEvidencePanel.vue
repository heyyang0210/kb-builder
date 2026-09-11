<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Download, ExternalLink, Eye, X } from 'lucide-vue-next'
import { baseUrl, request } from '../api'

defineProps({
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const statusLabels = {
  available: '可核验', snippet_missing: '片段缺失', source_unavailable: '来源不可用',
  unlinked: '未关联来源', stale: '历史已失效', missing: '证据缺失',
}
const locationLabels = { exact: '原句定位', section: '章节定位', document: '文档定位', unavailable: '无法定位' }
const preview = ref(null)
const previewLoading = ref(false)
const previewError = ref('')
const highlighted = ref(null)
let returnFocus = null

const previewParts = computed(() => {
  const content = String(preview.value?.content || '')
  const location = preview.value?.item?.location || {}
  const start = Number(location.start)
  const end = Number(location.end)
  if (location.level !== 'exact' || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > content.length) {
    return { before: content, match: '', after: '' }
  }
  return { before: content.slice(0, start), match: content.slice(start, end), after: content.slice(end) }
})

function absoluteUrl(path) {
  return path ? `${baseUrl()}${path}` : ''
}

function closePreview() {
  preview.value = null
  previewError.value = ''
  nextTick(() => returnFocus?.focus())
}

async function openPreview(item, event) {
  if (item.source?.previewMode !== 'structured_text') {
    window.open(absoluteUrl(item.source?.previewUrl || item.source?.contentUrl), '_blank', 'noopener')
    return
  }
  returnFocus = event?.currentTarget || null
  preview.value = { item, content: '' }
  previewLoading.value = true
  previewError.value = ''
  try {
    const result = await request(item.source.previewUrl)
    preview.value = { item, content: result.content || '', name: result.name || item.documentTitle }
    await nextTick()
    highlighted.value?.scrollIntoView({ block: 'center' })
  } catch (error) {
    previewError.value = error.message
  } finally {
    previewLoading.value = false
  }
}

function onKeydown(event) {
  if (event.key === 'Escape' && preview.value) closePreview()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="evidence-panel" aria-label="图谱证据详情">
    <header class="panel-header"><h3>证据详情</h3><span v-if="data">{{ data.total || 0 }} 条</span></header>
    <p v-if="loading" class="state">正在加载证据...</p>
    <p v-else-if="error" class="state error">{{ error }}</p>
    <p v-else-if="data?.evidenceAvailability === 'stale'" class="state warning">历史证据源已过期，未关联当前同名节点，无法继续下钻原文。</p>
    <div v-else-if="data?.items?.length" class="evidence-list">
      <article v-for="(item, index) in data.items" :key="`${item.resourceId}-${item.chunkId}-${index}`">
        <div class="record-title"><strong>{{ item.documentTitle || item.resourceId || '未关联文档' }}</strong><span :class="['status', item.evidenceAvailability]">{{ statusLabels[item.evidenceAvailability] || item.evidenceAvailability }}</span></div>
        <dl>
          <template v-if="item.sourcePath"><dt>来源</dt><dd>{{ item.sourcePath }}</dd></template>
          <template v-if="item.headingPath?.length"><dt>章节</dt><dd>{{ item.headingPath.join(' / ') }}</dd></template>
          <template v-if="item.chunkId"><dt>处理单元</dt><dd>{{ item.chunkId }}</dd></template>
          <template v-if="item.location"><dt>原文位置</dt><dd>{{ locationLabels[item.location.level] || item.location.level }} · {{ item.location.message }}</dd></template>
        </dl>
        <blockquote v-if="item.evidenceText">{{ item.evidenceText }}</blockquote>
        <p v-else class="missing-copy">{{ item.diagnostic?.message || '该项未找到可展示的原文证据。' }}</p>
        <p v-if="item.evidenceText && item.diagnostic?.message" class="diagnostic">{{ item.diagnostic.message }}</p>
        <div v-if="item.source?.availability === 'available'" class="actions">
          <button v-if="item.source.previewMode !== 'download_only'" type="button" @click="openPreview(item, $event)"><Eye :size="14" />预览原文</button>
          <a :href="absoluteUrl(item.source.contentUrl)" target="_blank" rel="noopener"><ExternalLink :size="14" />打开原文</a>
          <a :href="absoluteUrl(item.source.downloadUrl)"><Download :size="14" />下载</a>
        </div>
        <p v-else class="resolution">建议：{{ item.diagnostic?.suggestedAction === 'repair_link' ? '重新加工并补齐稳定资源引用。' : '检查源文件保留状态或重新加工该文档。' }}</p>
      </article>
    </div>
    <p v-else class="state">选择图谱节点或关系后查看来源证据。</p>
    <div v-if="preview" class="preview-overlay" role="presentation" @click.self="closePreview">
      <section class="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="graph-source-preview-title">
        <header><div><h3 id="graph-source-preview-title">{{ preview.name || preview.item.documentTitle || '原文预览' }}</h3><p>{{ locationLabels[preview.item.location?.level] || '文档定位' }} · {{ preview.item.location?.message }}</p></div><button class="icon-button" type="button" title="关闭原文预览" aria-label="关闭原文预览" @click="closePreview"><X :size="18" /></button></header>
        <p v-if="previewLoading" class="state">正在加载原文...</p>
        <p v-else-if="previewError" class="state error">{{ previewError }}</p>
        <pre v-else class="source-content"><span>{{ previewParts.before }}</span><mark v-if="previewParts.match" ref="highlighted">{{ previewParts.match }}</mark><span>{{ previewParts.after }}</span></pre>
      </section>
    </div>
  </section>
</template>

<style scoped>
.evidence-panel { min-width: 0; border-left: 1px solid #dce3ec; }
.panel-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #edf0f4; }
h3 { margin: 0; font-size: 14px; }
.panel-header > span { color: #66758a; font-size: 12px; }
.state { margin: 0; padding: 22px 12px; color: #66758a; font-size: 12px; }
.state.error { color: #a12622; background: #fff2f2; }
.state.warning { color: #8a5508; background: #fff8e8; }
.evidence-list { display: grid; gap: 12px; max-height: 600px; overflow: auto; padding: 10px; }
article { padding-bottom: 12px; border-bottom: 1px solid #e5eaf1; }
.record-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
article strong { overflow-wrap: anywhere; font-size: 13px; }
.status { flex: 0 0 auto; padding: 2px 5px; border-radius: 4px; color: #18733c; background: #eaf8ef; font-size: 10px; }
.status.snippet_missing, .status.missing { color: #8a5508; background: #fff4d6; }
.status.source_unavailable, .status.unlinked, .status.stale { color: #a12622; background: #fff0f0; }
dl { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 4px 6px; margin: 8px 0 0; font-size: 11px; }
dt { color: #66758a; }
dd { min-width: 0; margin: 0; color: #344054; overflow-wrap: anywhere; }
blockquote { margin: 8px 0 0; padding: 8px 10px; border-left: 3px solid #5a78a0; color: #344054; background: #f7f9fc; font-size: 12px; line-height: 1.6; }
.missing-copy, .diagnostic, .resolution { margin: 7px 0 0; color: #66758a; font-size: 11px; line-height: 1.5; }
.resolution { color: #8a5508; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.actions button, .actions a { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 4px 7px; border: 1px solid #b9c5d3; border-radius: 4px; color: #344054; background: white; font: inherit; font-size: 11px; text-decoration: none; cursor: pointer; }
.actions button:hover, .actions a:hover { border-color: #1769aa; color: #1769aa; }
.preview-overlay { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 20px; background: rgb(15 23 42 / 45%); }
.preview-dialog { display: grid; grid-template-rows: auto minmax(0, 1fr); width: min(900px, 100%); height: min(760px, 88vh); overflow: hidden; border-radius: 6px; background: white; box-shadow: 0 18px 48px rgb(15 23 42 / 25%); }
.preview-dialog > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #dce3ec; }
.preview-dialog header p { margin: 4px 0 0; color: #66758a; font-size: 11px; }
.icon-button { display: grid; flex: 0 0 auto; place-items: center; width: 32px; height: 32px; padding: 0; border: 1px solid #b9c5d3; border-radius: 4px; background: white; cursor: pointer; }
.source-content { min-width: 0; margin: 0; overflow: auto; padding: 16px; color: #263244; background: #f8fafc; font: 12px/1.7 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
mark { padding: 1px 0; color: #17202f; background: #ffe08a; }
@media (max-width: 700px) {
  .evidence-panel { border-left: 0; }
  .preview-overlay { align-items: stretch; padding: 0; }
  .preview-dialog { width: 100%; height: 100%; border-radius: 0; }
}
</style>
