<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import mermaid from 'mermaid'
import * as monaco from 'monaco-editor/editor/editor.api.js'
import 'monaco-editor/languages/definitions/markdown/register.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import { fileUrl } from '../api'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' })

const props = defineProps({
  original: { type: String, default: '' },
  cleaned: { type: String, default: '' },
  assets: { type: Object, default: () => ({}) },
  initialTab: { type: String, default: 'diff' },
  mode: { type: String, default: '' },
  showTabs: { type: Boolean, default: true },
})
const activeTab = ref(props.mode || props.initialTab)
const editorHost = ref(null)
const renderedHost = ref(null)
let editor = null
let originalModel = null
let cleanedModel = null
let mermaidRenderSequence = 0

const svgTags = ['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'marker', 'defs', 'text', 'tspan', 'style', 'foreignObject', 'span', 'div']
const svgAttrs = [
  'id', 'class', 'style', 'viewBox', 'xmlns', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'points', 'marker-end', 'marker-start', 'transform',
  'text-anchor', 'dominant-baseline', 'font-family', 'font-size', 'fill', 'stroke',
  'stroke-width', 'stroke-dasharray', 'opacity', 'height', 'width',
]
const mermaidLanguages = new Set([
  'mermaid',
  'flowchart',
  'graph',
  'sequencediagram',
  'statediagram',
  'classdiagram',
  'erdiagram',
  'gantt',
  'pie',
  'journey',
  'gitgraph',
  'mindmap',
  'timeline',
  'quadrantchart',
  'requirementdiagram',
])

function assetUrl(source = '') {
  const value = String(source || '')
  if (!value || /^(https?:|data:|blob:|\/api\/)/i.test(value)) return value
  const assets = props.assets || {}
  const candidates = [value]
  try {
    candidates.push(decodeURIComponent(value))
  } catch {
    // 保留原始路径
  }
  const normalized = value.replace(/^\.\//, '')
  candidates.push(normalized)
  for (const candidate of candidates) {
    if (assets[candidate]) {
      if (/^(data:|blob:|https?:|\/api\/)/i.test(assets[candidate])) return assets[candidate]
      return fileUrl(assets[candidate], 'content')
    }
  }
  return value
}

const rendered = computed(() => {
  const html = marked.parse(props.cleaned || '', {
    walkTokens(token) {
      if (token.type === 'image') token.href = assetUrl(token.href)
    },
  })
  return DOMPurify.sanitize(html, {
    ADD_TAGS: svgTags,
    ADD_ATTR: svgAttrs,
  })
})

function disposeEditor() {
  editor?.dispose()
  originalModel?.dispose()
  cleanedModel?.dispose()
  editor = originalModel = cleanedModel = null
}

async function renderEditor() {
  disposeEditor()
  if (activeTab.value === 'rendered') {
    await renderMermaidBlocks()
    return
  }
  await nextTick()
  if (!editorHost.value) return
  originalModel = monaco.editor.createModel(props.original, 'markdown')
  cleanedModel = monaco.editor.createModel(props.cleaned, 'markdown')
  const options = { readOnly: true, automaticLayout: true, minimap: { enabled: true }, wordWrap: 'on', fontSize: 13 }
  if (activeTab.value === 'diff') {
    editor = monaco.editor.createDiffEditor(editorHost.value, options)
    editor.setModel({ original: originalModel, modified: cleanedModel })
  } else {
    editor = monaco.editor.create(editorHost.value, { ...options, model: activeTab.value === 'original' ? originalModel : cleanedModel })
  }
}

watch(() => props.mode, value => {
  if (value && value !== activeTab.value) activeTab.value = value
})
watch([activeTab, () => props.original, () => props.cleaned], renderEditor)
watch(rendered, async () => {
  if (activeTab.value === 'rendered') await renderMermaidBlocks()
})
onMounted(renderEditor)
onBeforeUnmount(disposeEditor)

function isMermaidCodeBlock(block) {
  const classes = Array.from(block.classList || []).map(item => item.toLowerCase())
  return classes.some(item => {
    const language = item.replace(/^language-/, '')
    return mermaidLanguages.has(language)
  })
}

function showMermaidError(wrapper, source, reason) {
  wrapper.classList.add('mermaid-error')
  wrapper.innerHTML = ''
  const message = document.createElement('div')
  message.className = 'mermaid-error-message'
  message.textContent = `Mermaid 渲染失败：${reason?.message || reason}`
  const code = document.createElement('pre')
  const codeText = document.createElement('code')
  codeText.className = 'language-mermaid'
  codeText.textContent = source
  code.appendChild(codeText)
  wrapper.append(message, code)
}

async function renderMermaidBlocks() {
  await nextTick()
  if (!renderedHost.value) return
  const blocks = Array.from(renderedHost.value.querySelectorAll('pre > code')).filter(isMermaidCodeBlock)
  const diagrams = []
  const batchId = `mermaid-batch-${Date.now()}-${mermaidRenderSequence++}`
  for (const block of blocks) {
    const source = block.textContent || ''
    const pre = block.parentElement
    if (!source.trim() || !pre) continue
    const wrapper = document.createElement('div')
    wrapper.className = 'mermaid-render'
    const diagram = document.createElement('div')
    diagram.className = 'mermaid'
    diagram.dataset.mermaidBatch = batchId
    diagram.textContent = source
    wrapper.appendChild(diagram)
    pre.replaceWith(wrapper)
    diagrams.push({ wrapper, diagram, source })
  }
  if (!diagrams.length) return
  try {
    await mermaid.run({ querySelector: `[data-mermaid-batch="${batchId}"]` })
  } catch (reason) {
    for (const item of diagrams) showMermaidError(item.wrapper, item.source, reason)
  }
}
</script>

<template>
  <div class="markdown-workbench">
    <div v-if="showTabs" class="preview-tabs">
      <button v-for="tab in ['original', 'cleaned', 'diff', 'rendered']" :key="tab" :class="{ active: activeTab === tab }" @click="activeTab = tab">
        {{ { original: '原始 Markdown', cleaned: '清洗 Markdown', diff: '差异对比', rendered: '渲染预览' }[tab] }}
      </button>
    </div>
    <article v-if="activeTab === 'rendered'" ref="renderedHost" class="rendered-markdown markdown-preview" v-html="rendered"></article>
    <div v-else ref="editorHost" class="editor-host"></div>
  </div>
</template>

<style scoped>
.markdown-workbench { overflow: hidden; border: 1px solid #d8e0eb; border-radius: 7px; }
.preview-tabs { display: flex; gap: 2px; padding: 6px; border-bottom: 1px solid #d8e0eb; background: #f5f7fa; }
.preview-tabs button { padding: 7px 10px; border: 0; border-radius: 4px; color: #53647a; background: transparent; }
.preview-tabs button.active { color: #175cd3; background: white; box-shadow: 0 1px 2px rgba(20, 48, 82, .14); }
.editor-host, .rendered-markdown { height: 620px; }
.rendered-markdown { overflow: auto; padding: 30px 42px; color: #26364c; line-height: 1.8; background: white; }
.rendered-markdown :deep(h1) { margin: 30px 0 16px; padding-bottom: 10px; border-bottom: 2px solid #175cd3; font-size: 28px; }
.rendered-markdown :deep(h2) { margin: 26px 0 14px; padding-bottom: 8px; border-bottom: 1px solid #dde4ee; font-size: 23px; }
.rendered-markdown :deep(h3) { margin: 22px 0 12px; font-size: 19px; }
.rendered-markdown :deep(p) { margin: 0 0 16px; }
.rendered-markdown :deep(pre) { overflow: auto; padding: 16px 18px; border: 1px solid #dfe5ee; border-radius: 6px; background: #f6f8fb; line-height: 1.6; }
.rendered-markdown :deep(code) { padding: 2px 5px; border-radius: 4px; background: #f0f4fa; color: #9d174d; font-family: "SF Mono", Consolas, monospace; }
.rendered-markdown :deep(pre code) { padding: 0; color: inherit; background: transparent; }
.rendered-markdown :deep(blockquote) { margin: 16px 0; padding: 10px 16px; border-left: 4px solid #175cd3; background: #f5f9ff; color: #536176; }
.rendered-markdown :deep(table) { width: 100%; overflow: hidden; border: 1px solid #dfe5ee; border-collapse: collapse; }
.rendered-markdown :deep(th), .rendered-markdown :deep(td) { padding: 9px 12px; border: 1px solid #dfe5ee; text-align: left; }
.rendered-markdown :deep(th) { background: #f4f7fb; }
.rendered-markdown :deep(img) { display: block; max-width: 100%; height: auto; margin: 14px 0; border: 1px solid #dfe5ee; border-radius: 6px; box-shadow: 0 2px 8px rgba(16, 36, 64, .08); }
.rendered-markdown :deep(a) { color: #175cd3; }
.rendered-markdown :deep(.mermaid-render) { margin: 18px 0; padding: 16px; overflow: auto; border: 1px solid #dfe5ee; border-radius: 8px; background: #fbfcfe; text-align: center; }
.rendered-markdown :deep(.mermaid-render svg) { max-width: 100%; height: auto; }
.rendered-markdown :deep(.mermaid-error) { border-color: #f0aaa5; background: #fff7f6; }
.rendered-markdown :deep(.mermaid-error-message) { margin: 0 0 10px; padding: 8px 10px; border-radius: 5px; color: #b42318; background: #fff0ed; font-family: system-ui, sans-serif; font-size: 12px; }
</style>
