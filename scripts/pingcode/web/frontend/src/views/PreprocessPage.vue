<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Activity, AlertTriangle, ChevronDown, ChevronRight, Clock3, FileText, RefreshCw, X } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { request, taskEventUrl } from '../api'
import MarkdownWorkbench from '../components/MarkdownWorkbench.vue'
import PaginationControls from '../components/PaginationControls.vue'

const route = useRoute()
const batch = ref(null)
const files = ref([])
const report = ref(null)
const preview = ref(null)
const previewMode = ref('metadata')
const trainingTask = ref(null)
const downloadTask = ref(null)
const trainingLogs = ref([])
const reviewItems = ref([])
const qualityIssues = ref([])
const qualityIssueTotal = ref(0)
const qualityIssueOverallTotal = ref(0)
const qualityIssueCounts = ref({})
const qualityIssueSeverity = ref('all')
const qualityIssueOffset = ref(0)
const qualityIssueLimit = ref(100)
const cancelLoading = ref(false)
const datasets = ref([])
const error = ref('')
const loading = ref(false)
const selectedResourceId = ref('')
const textPage = ref(1)
const textPageSize = ref(20)
const textTotal = ref(0)
const pendingOpen = ref(false)
const pendingLoaded = ref(false)
const pendingLoading = ref(false)
const pendingFiles = ref([])
const pendingPage = ref(1)
const pendingPageSize = ref(20)
const pendingTotal = ref(0)
const sourceFilter = ref('all')
const sourceQuery = ref('')
const streamState = ref('idle')
const stageExpansion = ref({})
const activityExpanded = ref(false)
const qualityIssuePreviewCache = ref({})
const qualityIssuePreviewLoading = ref('')
const qualityIssuePreviewErrors = ref({})
const qualityIssuePreviewDialog = ref(null)
const failureDrawer = ref(null)
const preflightDialog = ref(null)
const preflightLoading = ref(false)
const trainingStartLoading = ref(false)
const now = ref(Date.now())
let trainingEvents = null
let trainingPoll = null
let clockTimer = null

const terminalStates = ['completed', 'failed', 'cancelled']
const qualityIssueCount = computed(() => qualityIssueOverallTotal.value || qualityIssueTotal.value || reviewItems.value.length)
const activeTrainingStates = ['queued', 'running', 'cancelling']
const blockingDownloadTask = computed(() => downloadTask.value && downloadTask.value.state !== 'completed')
const batchReadyForTraining = computed(() => ['uploaded', 'downloaded', 'ready'].includes(batch.value?.state) && !batch.value?.activeTaskIds?.length && !blockingDownloadTask.value)
const processableTotal = computed(() => report.value?.processableCount ?? textTotal.value)
const canStartTraining = computed(() => Boolean(processableTotal.value && batchReadyForTraining.value && !activeTrainingStates.includes(trainingTask.value?.state)))
const canCancelTraining = computed(() => activeTrainingStates.includes(trainingTask.value?.state))
const stageNames = {
  material_preparation: '资料预处理',
  knowledge_extraction: '知识提取',
  index_generation: '索引生成',
  metadata_construction: '资料预处理',
  deterministic_extraction: '知识提取',
  semantic_enrichment: '知识提取',
  validation_graph: '知识提取',
  dataset_generation: '索引生成',
  queued: '排队等待', completed: '加工完成', failed: '加工失败',
}
const stageDescriptions = {
  material_preparation: '扫描、规范化、清洗、结构解析、处理单元生成和元数据整理',
  knowledge_extraction: '批量抽取知识点、校验证据、合并实体和跨处理单元关系',
  index_generation: '构建层次目录、倒排索引、知识图谱和候选数据集',
}
const stageOrder = [
  'material_preparation',
  'knowledge_extraction',
  'index_generation',
]
const stateNames = {
  pending: '等待中', queued: '排队中', running: '执行中', completed: '已完成', failed: '失败',
  skipped: '已跳过', cancelling: '正在取消', cancelled: '已取消', paused: '已暂停',
}
const eventNames = {
  'task.queued': '任务已排队', 'task.interrupted': '任务因服务重启中断', 'task.failed': '任务执行失败',
  'task.completed': '任务执行完成', 'task.cancel.requested': '已请求取消任务', 'task.cancelled': '任务已取消',
  'stage.started': '步骤开始', 'stage.completed': '步骤完成',
  'stage.skipped': '步骤已跳过', 'stage.failed': '步骤失败', 'work_item.completed': '处理项完成',
  'model_call.completed': '模型调用成功', 'model_call.failed': '模型调用失败',
  'model_gateway.ready': '模型服务可用',
}
const detailNames = {
  resourceId: '源文件标识', chunkId: '处理单元标识', sourcePath: '源文件', reason: '中断原因',
  previousState: '中断前状态', technicalError: '技术信息', uncertainItemId: '不确定项标识',
  confidence: '置信度', qualityIssueCount: '质量问题数量', modelCalls: '模型调用统计',
  graphSummary: '图谱统计', fallback: '降级方式',
}
const reasonNames = { backend_restart: '后端服务重启' }
const severityNames = {
  critical: '严重',
  high: '高',
  error: '错误',
  warning: '警告',
  info: '提示',
  unknown: '未知',
}
const processingStatusLabels = {
  direct_text: '可直接处理',
  convertible: '可转换处理',
  ocr_required: '需要 OCR',
  conversion_pending: '缺少转换器',
  conversion_failed: '转换失败',
  unsupported: '不支持',
  archive: '归档文件',
  asset: '关联资源',
}
const conversionReadinessLabels = {
  direct: '可直接读取',
  direct_html: 'HTML 解析可用',
  tool_ready: '转换器就绪',
  tool_missing: '缺少转换器',
  ocr_required: '等待 OCR',
  unsupported: '不支持',
  archive: '归档文件',
  asset: '关联资源',
}
const featureStateLabels = {
  ok: '已统计',
  zero_value: '0',
  not_applicable: '不适用',
  not_implemented: '未统计',
  parse_failed: '解析失败',
}
const formatFamilyLabels = {
  text: '文本',
  web: 'HTML',
  office: 'Office',
  pdf: 'PDF',
  archive: '归档',
  image: '图片',
  unknown: '未知',
}
const previewTabs = [
  { id: 'metadata', label: '源文件总览' },
  { id: 'rendered', label: '渲染预览' },
  { id: 'original', label: '原始 Markdown' },
  { id: 'cleaned', label: '清洗 Markdown' },
  { id: 'diff', label: '差异对比' },
  { id: 'units', label: '处理单元' },
]
const displayStages = computed(() => {
  const source = trainingTask.value?.stages || []
  const byId = new Map(source.map(stage => [stage.id, stage]))
  return stageOrder.map(id => ({
    id,
    state: 'pending',
    message: stageDescriptions[id],
    ...(byId.get(id) || {}),
    id,
    logStageIds: stageLogStageIds(id),
  }))
})
const displayCompleted = computed(() => displayStages.value.filter(stage => ['completed', 'failed', 'skipped'].includes(stage.state)).length)
const trainingPercent = computed(() => trainingTask.value ? Math.round(displayCompleted.value / stageOrder.length * 100) : 0)
const displayCurrentStage = computed(() => {
  const current = trainingTask.value?.stage
  if (['metadata_construction'].includes(current)) return 'material_preparation'
  if (['deterministic_extraction', 'semantic_enrichment', 'validation_graph'].includes(current)) return 'knowledge_extraction'
  if (current === 'dataset_generation') return 'index_generation'
  return current
})
const fileActivity = computed(() => {
  const result = new Map()
  for (const log of trainingLogs.value) {
    const resourceId = log.details?.resourceId
    if (!resourceId) continue
    const current = result.get(resourceId) || { succeeded: 0, failed: 0, review: 0, lastMessage: '', lastEvent: '' }
    if (log.event === 'model_call.failed') current.failed += 1
    if (log.event === 'model_call.completed') current.succeeded += 1
    if (log.event === 'model_call.review_required' || log.event === 'review.created') current.review += 1
    current.lastMessage = log.message
    current.lastEvent = log.event
    result.set(resourceId, current)
  }
  for (const issue of reviewItems.value) {
    const resourceId = issue.resourceId
    if (!resourceId) continue
    const current = result.get(resourceId) || { succeeded: 0, failed: 0, review: 0, lastMessage: '', lastEvent: '' }
    current.review += 1
    if (!current.lastMessage) current.lastMessage = issue.message || '存在需要查看的质量问题'
    result.set(resourceId, current)
  }
  return result
})

const sourceRows = computed(() => files.value.map(file => {
  const activity = fileActivity.value.get(file.id) || { succeeded: 0, failed: 0, review: 0, lastMessage: '' }
  let state = 'pending'
  if (activity.failed) state = 'failed'
  else if (activity.review) state = 'review'
  else if (activity.succeeded) state = 'completed'
  const currentResourceId = [...trainingLogs.value].reverse().find(item => item.details?.resourceId)?.details?.resourceId
  if (trainingTask.value?.state === 'running' && currentResourceId === file.id) state = 'running'
  return { ...file, ...activity, processState: state }
}))

const filteredSourceRows = computed(() => sourceRows.value.filter(file => {
  const matchesFilter = sourceFilter.value === 'all'
    || (sourceFilter.value === 'failed' && file.processState === 'failed')
    || (sourceFilter.value === 'review' && file.review > 0)
  const query = sourceQuery.value.trim().toLowerCase()
  return matchesFilter && (!query || file.name.toLowerCase().includes(query))
}))

const recentLogs = computed(() => [...trainingLogs.value].reverse())
const visibleRecentLogs = computed(() => activityExpanded.value ? recentLogs.value : recentLogs.value.slice(0, 8))
const drawerFailures = computed(() => {
  if (!failureDrawer.value) return []
  const stageIds = failureDrawer.value.logStageIds || [failureDrawer.value.stage]
  return trainingLogs.value.filter(log => log.level === 'error' && (
    failureDrawer.value.stage ? stageIds.includes(log.stage) : log.sequence === failureDrawer.value.sequence
  )).reverse()
})
const selectedFile = computed(() => files.value.find(item => item.id === selectedResourceId.value) || pendingFiles.value.find(item => item.id === selectedResourceId.value))
const scanSummaryItems = computed(() => {
  const current = report.value
  if (!current) return []
  return [
    ['总文件', current.totalFiles],
    ['可加工来源', current.processableCount ?? current.textFiles],
    ['可直接处理', current.directTextCount ?? 0],
    ['可转换处理', current.convertibleCount ?? 0],
    ['需要 OCR', current.ocrRequiredCount ?? 0],
    ['不支持/隔离', current.unsupportedCount ?? current.unsupportedFiles],
    ['转换失败', current.conversionFailedCount ?? 0],
    ['重复文件组', current.duplicateGroups ?? 0],
    ['空文件', current.emptyFiles ?? 0],
    ['总大小', formatBytes(current.totalBytes ?? 0)],
    ['预计处理单元', current.estimatedProcessingUnitCount ?? 0],
    ['问题总数', current.issues?.length ?? 0],
  ]
})
const issueSummaryItems = computed(() => {
  const summary = report.value?.issueSummary || {}
  return [
    ['错误', summary.error || 0, 'error'],
    ['警告', summary.warning || 0, 'warning'],
    ['提示', summary.info || 0, 'info'],
  ]
})
const toolStatusItems = computed(() => Object.entries(report.value?.toolStatus || {}).map(([key, value]) => ({
  key,
  label: toolLabel(key),
  available: Boolean(value?.available),
  formats: (value?.requiredFormats || []).join(' / '),
})))

function visibleDatasets(items = []) {
  return items.filter(item => item.state !== 'deleted')
}

async function load() {
  try {
    batch.value = await request(`/api/material-batches/${route.params.batchId}`)
    const downloadTasks = await request(`/api/download/tasks?batchId=${encodeURIComponent(route.params.batchId)}`)
    downloadTask.value = downloadTasks.items?.find(item => item.type === 'download') || null
    await loadTextFiles(textPage.value)
    datasets.value = visibleDatasets((await request(`/api/datasets?batchId=${route.params.batchId}`)).items || [])
    await restoreTrainingTask()
  } catch (reason) {
    error.value = reason.message
  }
}

async function restoreTrainingTask() {
  const result = await request(`/api/training/tasks?batchId=${route.params.batchId}`)
  const latest = result.items?.[0]
  if (!latest) return
  trainingTask.value = latest
  await Promise.all([loadTrainingLogs(true), loadReviewItems(), loadQualityIssues(0)])
  if (!terminalStates.includes(latest.state)) subscribeTraining(latest.id)
}

async function loadTextFiles(page = 1) {
  const result = await request(`/api/material-batches/${route.params.batchId}/files?category=text&page=${page}&pageSize=${textPageSize.value}`)
  files.value = result.items
  textPage.value = result.page
  textTotal.value = result.total
  if (!files.value.some(item => item.id === selectedResourceId.value)) {
    selectedResourceId.value = files.value[0]?.id || ''
    preview.value = null
  }
}

async function changeTextPage({ page, pageSize }) {
  textPageSize.value = pageSize
  await loadTextFiles(page)
}

async function loadPendingFiles(page = 1) {
  pendingLoading.value = true
  try {
    const result = await request(`/api/material-batches/${route.params.batchId}/files?category=conversion_pending&page=${page}&pageSize=${pendingPageSize.value}`)
    pendingFiles.value = result.items
    pendingPage.value = result.page
    pendingTotal.value = result.total
    pendingLoaded.value = true
  } catch (reason) {
    error.value = reason.message
  } finally {
    pendingLoading.value = false
  }
}

async function togglePending(event) {
  pendingOpen.value = event.target.open
  if (pendingOpen.value && !pendingLoaded.value) await loadPendingFiles(1)
}

async function changePendingPage({ page, pageSize }) {
  pendingPageSize.value = pageSize
  await loadPendingFiles(page)
}

async function scan() {
  loading.value = true
  error.value = ''
  try {
    report.value = await request('/api/preprocess/scan', { method: 'POST', body: JSON.stringify({ batchId: route.params.batchId }) })
    if (pendingOpen.value) await loadPendingFiles(1)
  } catch (reason) {
    error.value = reason.message
  } finally {
    loading.value = false
  }
}

async function loadPreview(resourceId = selectedResourceId.value) {
  if (!resourceId) return
  selectedResourceId.value = resourceId
  loading.value = true
  error.value = ''
  try {
    preview.value = await request('/api/preprocess/preview', {
      method: 'POST', body: JSON.stringify({ batchId: route.params.batchId, resourceId }),
    })
    previewMode.value = 'metadata'
  } catch (reason) {
    error.value = reason.message
  } finally {
    loading.value = false
  }
}

async function startTraining() {
  if (!canStartTraining.value) {
    if (!batchReadyForTraining.value) error.value = downloadTask.value?.canResume
      ? '资料下载已中断，请先到“下载文件”继续下载'
      : '资料下载尚未完成，请等待下载任务结束后再启动知识加工'
    else error.value = processableTotal.value ? '当前已有知识加工任务正在执行' : '当前资料加工任务没有可加工的源文件'
    return
  }
  error.value = ''
  preflightLoading.value = true
  try {
    await request('/api/training/model-test', { method: 'POST' })
    const preflight = await request('/api/training/preflight', {
      method: 'POST',
      body: JSON.stringify(trainingRequestPayload()),
    })
    preflightDialog.value = preflight.estimate || preflight.estimates || preflight
  } catch (reason) {
    error.value = reason.message
  } finally {
    preflightLoading.value = false
  }
}

function statusLabel(value) {
  return processingStatusLabels[value] || value || '-'
}

function formatLabel(value) {
  return formatFamilyLabels[value] || value || '-'
}

function toolLabel(key) {
  return { libreoffice: 'LibreOffice', pdftotext: 'pdftotext', htmlParser: 'HTML 解析器' }[key] || key
}

function readinessLabel(value) {
  return conversionReadinessLabels[value] || value || '-'
}

function featureValue(value) {
  return value === null || value === undefined || value === '' ? '未统计' : value
}

function featureStateLabel(state) {
  return featureStateLabels[state] || state || '-'
}

function percentValue(value) {
  if (typeof value !== 'number') return '-'
  return `${Math.round(value * 100)}%`
}

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function previewMetaRows() {
  const metadata = preview.value?.sourceMetadata || {}
  const fileName = metadata.fileName || selectedFile.value?.name
  const formatFamily = metadata.formatFamily || selectedFile.value?.formatFamily
  return [
    ['文件名', fileName],
    ['格式族', formatLabel(formatFamily)],
    ['处理状态', statusLabel(metadata.processingStatus || selectedFile.value?.processingStatus)],
    ['文件大小', formatBytes(metadata.size || selectedFile.value?.size)],
    ['预览状态', preview.value?.previewState === 'preview_only' ? '仅预览，不作为正式加工输入' : preview.value?.previewState],
  ]
}

function denseHeaderMeta() {
  const metadata = preview.value?.sourceMetadata || {}
  const fileName = metadata.fileName || selectedFile.value?.name || '未命名源文件'
  const formatFamily = metadata.formatFamily || selectedFile.value?.formatFamily
  const previewState = preview.value?.previewState === 'preview_only' ? '仅预览' : featureValue(preview.value?.previewState)
  return {
    fileName,
    chips: [
      formatLabel(formatFamily),
      formatBytes(metadata.size || selectedFile.value?.size),
      statusLabel(metadata.processingStatus || selectedFile.value?.processingStatus),
      previewState,
    ].filter(Boolean),
  }
}

function sourceFeatureRows() {
  const metadata = preview.value?.sourceMetadata || {}
  const features = metadata.features || {}
  const states = metadata.featureStates || {}
  const diagnostics = metadata.featureDiagnostics || {}
  const formatFamily = metadata.formatFamily || selectedFile.value?.formatFamily
  const formatSuffix = String(selectedFile.value?.name || metadata.fileName || '').toLowerCase()
  const isDocx = formatFamily === 'office' && formatSuffix.endsWith('.docx')
  const isPdf = formatFamily === 'pdf'
  const inferState = (key, value, state) => {
    if (state) return state
    if (value === 0) return 'zero_value'
    if (typeof value === 'number') return 'ok'
    if (formatFamily === 'text' || formatFamily === 'web') {
      if (key === 'pageCount' || key === 'worksheetCount' || key === 'slideCount') return 'not_applicable'
      return 'not_implemented'
    }
    if (formatFamily === 'office') {
      if (key === 'pageCount') return 'not_applicable'
      if (key === 'worksheetCount') return isDocx ? 'not_applicable' : 'not_implemented'
      if (key === 'slideCount') return isDocx || isPdf ? 'not_applicable' : 'not_implemented'
      if (isDocx && ['paragraphCount', 'tableCount', 'headingHintCount', 'characterCount'].includes(key)) return 'ok'
      return 'not_implemented'
    }
    if (isPdf && key === 'worksheetCount') return 'not_applicable'
    if (isPdf && key === 'slideCount') return 'not_applicable'
    return 'not_implemented'
  }
  return [
    ['页数', 'pageCount', features.pageCount, states.pageCount, diagnostics.pageCount],
    ['段落数', 'paragraphCount', features.paragraphCount, states.paragraphCount, diagnostics.paragraphCount],
    ['表格数', 'tableCount', features.tableCount, states.tableCount, diagnostics.tableCount],
    ['图片数', 'imageCount', features.imageCount, states.imageCount, diagnostics.imageCount],
    ['工作表数', 'worksheetCount', features.worksheetCount, states.worksheetCount, diagnostics.worksheetCount],
    ['幻灯片数', 'slideCount', features.slideCount, states.slideCount, diagnostics.slideCount],
    ['标题线索', 'headingHintCount', features.headingHintCount, states.headingHintCount, diagnostics.headingHintCount],
    ['字符数', 'characterCount', features.characterCount, states.characterCount, diagnostics.characterCount],
  ].map(([label, key, value, state, reason]) => ({
    label,
    key,
    value,
    state: inferState(key, value, state),
    reason,
  }))
}

function featureDisplayValue(row) {
  if (!row) return '-'
  if (row.state === 'not_applicable') return '不适用'
  if (row.state === 'not_implemented') return '未统计'
  if (row.state === 'parse_failed') return '解析失败'
  return featureValue(row.value)
}

function featureDisplayReason(row) {
  if (!row) return ''
  if (row.reason) return row.reason
  if (row.state && !['ok', 'zero_value'].includes(row.state)) return featureStateLabel(row.state)
  return ''
}

function diagnosticsRows() {
  const metadata = preview.value?.sourceMetadata || {}
  const states = metadata.featureStates || {}
  const diagnostics = metadata.featureDiagnostics || {}
  const labels = {
    pageCount: '页数',
    paragraphCount: '段落数',
    tableCount: '表格数',
    imageCount: '图片数',
    worksheetCount: '工作表数',
    slideCount: '幻灯片数',
    headingHintCount: '标题线索',
    characterCount: '字符数',
  }
  const rows = Object.entries(states).map(([key, state]) => ({
    key,
    label: labels[key] || key,
    state,
    reason: diagnostics[key] || '',
  }))
  for (const [key, reason] of Object.entries(diagnostics)) {
    if (key in states || !reason) continue
    rows.push({ key, label: key, state: 'parse_failed', reason })
  }
  return rows
}

function overviewStats() {
  const rows = sourceFeatureRows()
  return [
    { label: '已统计', value: rows.filter(row => ['ok', 'zero_value'].includes(row.state)).length },
    { label: '不适用', value: rows.filter(row => row.state === 'not_applicable').length },
    { label: '未统计', value: rows.filter(row => row.state === 'not_implemented').length },
    { label: '解析失败', value: rows.filter(row => row.state === 'parse_failed').length },
  ]
}

function compactDiagnosticsRows() {
  const rows = diagnosticsRows()
  const abnormal = rows.filter(row => !['ok', 'zero_value', 'not_applicable'].includes(row.state))
  const visibleRows = abnormal.length ? abnormal : rows
  return visibleRows.slice(0, 8)
}

function summaryRows() {
  const metadata = preview.value?.sourceMetadata || {}
  const features = metadata.features || {}
  return [
    ['图片保留', metadata.preservedImageCount ?? preview.value?.conversionAssets?.length ?? 0],
    ['图片引用', preview.value?.markdownFeatures?.imageReferenceCount ?? 0],
    ['原文字符', features.characterCount],
    ['Markdown 字符', preview.value?.markdownFeatures?.characterCount],
    ['表格变化', preview.value?.diffSummary?.tableCountDelta],
    ['图片变化', preview.value?.diffSummary?.imageReferenceDelta],
  ]
}

function fidelityCompactRows() {
  const metadata = preview.value?.sourceMetadata || {}
  const features = metadata.features || {}
  const markdownFeatures = preview.value?.markdownFeatures || {}
  const diffSummary = preview.value?.diffSummary || {}
  return [
    ['字符', `${featureValue(features.characterCount)} / ${featureValue(markdownFeatures.characterCount)}`, '源文件 / Markdown'],
    ['图片', `${featureValue(features.imageCount)} / ${featureValue(metadata.preservedImageCount ?? preview.value?.conversionAssets?.length ?? 0)} / ${featureValue(markdownFeatures.imageReferenceCount)}`, '源文件 / 保留 / 引用'],
    ['表格', `${featureValue(features.tableCount)} / ${featureValue(markdownFeatures.tableCount)}`, '源文件 / Markdown'],
    ['段落', `${featureValue(features.paragraphCount)} / ${featureValue(markdownFeatures.paragraphCount)}`, '源文件 / Markdown'],
    ['标题', `${featureValue(features.headingHintCount)} / ${featureValue(markdownFeatures.headingCount)}`, '线索 / Markdown'],
    ['处理单元', featureValue(markdownFeatures.processingUnitCount), '转换后生成'],
    ['来源映射', percentValue(markdownFeatures.sourceMappingCoverage), 'Markdown 覆盖率'],
    ['结构问题', featureValue(diffSummary.structureIssueCount), diffSummary.mappingIncomplete ? '映射部分缺失' : '完整或无需映射'],
    ['转换器', featureValue(metadata.converterId || preview.value?.converterId), featureValue(metadata.conversionProfile || preview.value?.conversionProfile)],
  ]
}

function detailRows() {
  const metadata = preview.value?.sourceMetadata || {}
  return [
    ['媒体类型', metadata.mediaType || selectedFile.value?.mediaType],
    ['来源路径', metadata.logicalPath || selectedFile.value?.logicalPath],
    ['SHA-256', metadata.sha256],
    ['转换器', metadata.converterId || preview.value?.converterId],
    ['转换器版本', metadata.converterVersion || preview.value?.converterVersion],
    ['转换策略', metadata.conversionProfile || preview.value?.conversionProfile],
  ]
}

function markdownFeatureRows() {
  const features = preview.value?.markdownFeatures || {}
  return [
    ['标题数', features.headingCount],
    ['段落数', features.paragraphCount],
    ['表格数', features.tableCount],
    ['列表数', features.listCount],
    ['代码块数', features.codeBlockCount],
    ['图片引用数', features.imageReferenceCount],
    ['字符数', features.characterCount],
    ['处理单元数', features.processingUnitCount],
    ['来源映射覆盖率', percentValue(features.sourceMappingCoverage)],
  ]
}

function diffSummaryRows() {
  const summary = preview.value?.diffSummary || {}
  return [
    ['结构问题数', summary.structureIssueCount],
    ['来源映射是否完整', summary.mappingIncomplete ? '部分映射' : '完整或无需映射'],
    ['字符量变化比例', percentValue(summary.characterChangeRatio)],
    ['表格数量变化', summary.tableCountDelta],
    ['图片引用变化', summary.imageReferenceDelta],
  ]
}

function trainingRequestPayload() {
  return { batchId: route.params.batchId }
}

async function confirmStartTraining() {
  if (!preflightDialog.value || trainingStartLoading.value) return
  trainingStartLoading.value = true
  error.value = ''
  try {
    trainingLogs.value = []
    reviewItems.value = []
    qualityIssues.value = []
    qualityIssueTotal.value = 0
    qualityIssueOverallTotal.value = 0
    qualityIssueCounts.value = {}
    qualityIssueOffset.value = 0
    stageExpansion.value = {}
    trainingTask.value = await request('/api/training/tasks', {
      method: 'POST',
      body: JSON.stringify(trainingRequestPayload()),
    })
    preflightDialog.value = null
    subscribeTraining(trainingTask.value.id)
  } catch (reason) {
    error.value = reason.message
  } finally {
    trainingStartLoading.value = false
  }
}

async function cancelTraining() {
  if (!trainingTask.value?.id || !canCancelTraining.value || cancelLoading.value) return
  cancelLoading.value = true
  error.value = ''
  try {
    trainingTask.value = await request(`/api/training/tasks/${trainingTask.value.id}/cancel`, { method: 'POST' })
  } catch (reason) {
    error.value = reason.message
  } finally {
    cancelLoading.value = false
  }
}

function subscribeTraining(taskId) {
  stopTrainingStream()
  streamState.value = 'connecting'
  trainingEvents = new EventSource(taskEventUrl(taskId))
  trainingEvents.onopen = () => { streamState.value = 'connected' }
  trainingEvents.addEventListener('task.progress', async event => {
    trainingTask.value = JSON.parse(event.data)
    await loadQualityIssues(qualityIssueOffset.value)
    if (terminalStates.includes(trainingTask.value.state)) {
      stopTrainingStream()
      streamState.value = 'completed'
      await Promise.all([load(), loadTrainingLogs(true), loadReviewItems(), loadQualityIssues(0)])
    }
  })
  trainingEvents.addEventListener('training.log', event => {
    appendLog(JSON.parse(event.data))
  })
  trainingEvents.onerror = () => {
    trainingEvents?.close()
    trainingEvents = null
    streamState.value = 'polling'
    startTrainingPolling(taskId)
  }
}

function appendLog(item) {
  if (trainingLogs.value.some(current => current.sequence === item.sequence)) return
  trainingLogs.value = [...trainingLogs.value, item].sort((a, b) => a.sequence - b.sequence)
}

function startTrainingPolling(taskId) {
  clearInterval(trainingPoll)
  trainingPoll = setInterval(async () => {
    try {
      trainingTask.value = await request(`/api/training/tasks/${taskId}`)
      await loadTrainingLogs()
      if (terminalStates.includes(trainingTask.value.state)) {
        clearInterval(trainingPoll)
        trainingPoll = null
        streamState.value = 'completed'
        await Promise.all([loadReviewItems(), loadQualityIssues(0)])
      }
    } catch (reason) {
      streamState.value = 'disconnected'
      error.value = reason.message
    }
  }, 2000)
}

function stopTrainingStream() {
  trainingEvents?.close()
  trainingEvents = null
  clearInterval(trainingPoll)
  trainingPoll = null
}

async function loadTrainingLogs(reset = false) {
  if (!trainingTask.value?.id) return
  const offset = reset ? 0 : trainingLogs.value.length
  const result = await request(`/api/training/tasks/${trainingTask.value.id}/logs?offset=${offset}&limit=1000`)
  if (reset) trainingLogs.value = result.items
  else result.items.forEach(appendLog)
}

async function loadReviewItems() {
  if (!trainingTask.value?.id) return
  const result = await request(`/api/training/tasks/${trainingTask.value.id}/review-items`)
  reviewItems.value = result.items
}

async function loadQualityIssues(offset = 0) {
  if (!trainingTask.value?.id) return
  const query = new URLSearchParams({
    offset: String(offset),
    limit: String(qualityIssueLimit.value),
  })
  if (qualityIssueSeverity.value !== 'all') query.set('severity', qualityIssueSeverity.value)
  const result = await request(`/api/training/tasks/${trainingTask.value.id}/quality-issues?${query.toString()}`)
  qualityIssues.value = result.items || []
  qualityIssueTotal.value = result.total || 0
  qualityIssueOverallTotal.value = result.overallTotal || result.total || 0
  qualityIssueCounts.value = result.counts || {}
  qualityIssueOffset.value = result.offset || 0
}

async function setQualityIssueSeverity(value) {
  qualityIssueSeverity.value = value
  await loadQualityIssues(0)
}

async function previousQualityIssues() {
  await loadQualityIssues(Math.max(0, qualityIssueOffset.value - qualityIssueLimit.value))
}

async function nextQualityIssues() {
  if (qualityIssueOffset.value + qualityIssues.value.length < qualityIssueTotal.value) {
    await loadQualityIssues(qualityIssueOffset.value + qualityIssueLimit.value)
  }
}

function qualityIssueId(issue) {
  return issue.issueId || issue.id || `${issue.code}-${issue.resourceId}-${issue.chunkId}-${issue.message}`
}

function qualityIssueEvidence(issue) {
  return issue.evidenceText || issue.evidence || issue.details?.evidenceText || issue.details?.evidence || ''
}

function qualityIssueDetails(issue) {
  const details = issue.details || {}
  const entries = Object.entries(details)
    .filter(([key, value]) => !['severity', 'evidence', 'evidenceText'].includes(key) && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${detailNames[key] || key}：${typeof value === 'object' ? JSON.stringify(value) : value}`)
  return entries.join('；')
}

function qualityIssueSource(issue) {
  return issue.sourcePath || issue.source_path || issue.resourceId || '-'
}

function qualityIssueSeverityLabel(issue) {
  const severity = qualityIssueSeverityValue(issue)
  return severityNames[severity] || severity
}

function qualityIssueSeverityValue(issue) {
  return issue.severity || issue.details?.severity || 'info'
}

function qualityIssuePreview(issue) {
  return issue.resourceId ? qualityIssuePreviewCache.value[issue.resourceId] : null
}

function qualityIssuePreviewError(issue) {
  return qualityIssuePreviewErrors.value[qualityIssueId(issue)] || ''
}

function qualityIssuePreviewTitle(issue) {
  const resourceId = issue.resourceId
  const previewData = qualityIssuePreview(issue)
  const resource = previewData?.resource
  return files.value.find(item => item.id === resourceId)?.name || resource?.name || qualityIssueSource(issue)
}

async function ensureQualityIssuePreview(issue) {
  const issueId = qualityIssueId(issue)
  if (!issue.resourceId || qualityIssuePreview(issue)) return
  qualityIssuePreviewLoading.value = issueId
  qualityIssuePreviewErrors.value = { ...qualityIssuePreviewErrors.value, [issueId]: '' }
  try {
    const result = await request('/api/preprocess/preview', {
      method: 'POST',
      body: JSON.stringify({ batchId: route.params.batchId, resourceId: issue.resourceId }),
    })
    qualityIssuePreviewCache.value = { ...qualityIssuePreviewCache.value, [issue.resourceId]: result }
  } catch (reason) {
    qualityIssuePreviewErrors.value = { ...qualityIssuePreviewErrors.value, [issueId]: reason.message }
  } finally {
    qualityIssuePreviewLoading.value = ''
  }
}

async function openQualityIssuePreview(issue) {
  qualityIssuePreviewDialog.value = issue
  await ensureQualityIssuePreview(issue)
}

function qualityIssueContext(issue) {
  const previewData = qualityIssuePreview(issue)
  if (!previewData) return null
  const evidence = qualityIssueEvidence(issue)
  const units = previewData.processingUnits || []
  const unit = units.find(item => item.chunkId === issue.chunkId || item.id === issue.chunkId)
  if (unit?.content) {
    return {
      label: '已定位到处理单元',
      chunkId: unit.chunkId || issue.chunkId,
      heading: (unit.headingPath || []).join(' / '),
      content: unit.content,
      evidence,
      precise: true,
    }
  }
  const sourceText = previewData.cleaned || previewData.original || ''
  if (evidence && sourceText.includes(evidence)) {
    const index = sourceText.indexOf(evidence)
    const start = Math.max(0, index - 500)
    const end = Math.min(sourceText.length, index + evidence.length + 500)
    return {
      label: '已通过证据文本定位',
      chunkId: issue.chunkId || '-',
      heading: '',
      content: sourceText.slice(start, end),
      evidence,
      precise: true,
    }
  }
  return {
    label: '未定位到精确片段，展示文档开头摘要',
    chunkId: issue.chunkId || '-',
    heading: '',
    content: sourceText.slice(0, 1200),
    evidence,
    precise: false,
  }
}

function closeQualityIssuePreview() {
  qualityIssuePreviewDialog.value = null
}

async function deleteDataset(dataset) {
  if (!window.confirm(`确认删除数据集版本 ${dataset.id}？\n\n系统会清理派生知识、规范化副本和图谱，并保留原始材料、质量问题和删除审计。`)) return
  error.value = ''
  try {
    await request(`/api/datasets/${dataset.id}`, {
      method: 'DELETE',
      body: JSON.stringify({
        operator: '前端用户',
        reason: '前端手动删除数据集版本',
        confirmed: true,
      }),
    })
    datasets.value = visibleDatasets((await request(`/api/datasets?batchId=${route.params.batchId}`)).items || [])
  } catch (reason) {
    error.value = reason.message
  }
}

function toggleStage(stage) {
  stageExpansion.value = { ...stageExpansion.value, [stage.id]: !isStageExpanded(stage) }
}

function isStageExpanded(stage) {
  if (stageExpansion.value[stage.id] !== undefined) return stageExpansion.value[stage.id]
  return ['running', 'failed'].includes(stage.state)
}

function stageFailures(stage) {
  const stageIds = stage.logStageIds || [stage.id]
  return trainingLogs.value.filter(log => stageIds.includes(log.stage) && log.level === 'error').length
}

function stageSuccesses(stage) {
  const stageIds = stage.logStageIds || [stage.id]
  return trainingLogs.value.filter(log => stageIds.includes(log.stage) && ['model_call.completed', 'work_item.completed'].includes(log.event)).length
}

function openFailureDrawer(stage, log = null) {
  failureDrawer.value = log
    ? { ...log, stage: displayStageId(log.stage), logStageIds: [log.stage] }
    : { stage: stage.id, logStageIds: stage.logStageIds || [stage.id], message: stage.message || `${stageNames[stage.id]}失败` }
}

function displayStageId(stageId) {
  if (stageId === 'metadata_construction') return 'material_preparation'
  if (['deterministic_extraction', 'semantic_enrichment', 'validation_graph'].includes(stageId)) return 'knowledge_extraction'
  if (stageId === 'dataset_generation') return 'index_generation'
  return stageId
}

function stageLogStageIds(stageId) {
  return {
    material_preparation: ['material_preparation', 'metadata_construction'],
    knowledge_extraction: ['knowledge_extraction', 'deterministic_extraction', 'semantic_enrichment', 'validation_graph'],
    index_generation: ['index_generation', 'dataset_generation'],
  }[stageId] || [stageId]
}

function summarizeTechnicalError(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized.includes('country, region, or territory not supported')) return '模型服务拒绝访问（HTTP 403，当前网络所在国家或地区不受支持）'
  if (/\b(http\s*)?401\b/.test(normalized)) return '模型服务身份认证失败（HTTP 401）'
  if (/\b(http\s*)?403\b/.test(normalized)) return '模型服务拒绝访问（HTTP 403）'
  if (/\b(http\s*)?429\b/.test(normalized)) return '模型服务请求过于频繁（HTTP 429）'
  const serverError = normalized.match(/\b(?:http\s*)?(5\d{2})\b/)
  if (serverError) return `模型服务暂时不可用（HTTP ${serverError[1]}）`
  if (normalized.includes('connection refused') || normalized.includes('econnrefused') || normalized.includes('errno 111')) return '模型服务连接失败'
  if (normalized.includes('timed out') || normalized.includes('timeout')) return '模型调用超时'
  if (normalized.includes('jsondecodeerror') || normalized.includes('invalid json') || normalized.includes('expecting value')) return '模型返回格式不正确'
  return '模型服务返回错误'
}

function displayLogMessage(log) {
  const technicalError = log.details?.technicalError
  if (technicalError && log.message?.includes(technicalError)) return log.message.replace(technicalError, summarizeTechnicalError(technicalError))
  if (!['model_call.failed', 'task.failed'].includes(log.event)) return log.message
  const summary = summarizeTechnicalError(log.message)
  const separator = log.message?.indexOf(' - ') ?? -1
  if (separator >= 0) return `${log.message.slice(0, separator)} - ${summary}`
  return log.event === 'task.failed' ? `知识加工任务失败：${summary}` : summary
}

function detailLabel(key) {
  return detailNames[key] || '补充信息'
}

function detailValue(key, value) {
  if (key === 'reason') return reasonNames[value] || '任务执行环境发生变化'
  if (key === 'previousState') return stateNames[value] || '未知状态'
  if (typeof value === 'object' && value !== null) return JSON.stringify(value, null, 2)
  return value || '-'
}

function stageExplanation(stage) {
  if (stage.message) return stage.message
  if (stage.state === 'failed') return '该步骤未能完成，请在失败详情中查看具体原因'
  return stageDescriptions[stage.id] || ''
}

function preflightValue(...keys) {
  for (const key of keys) {
    const value = preflightDialog.value?.[key]
    if (value !== undefined && value !== null) return value
  }
  return '待计算'
}

function preflightDuration() {
  const direct = preflightDialog.value?.durationText || preflightDialog.value?.estimatedDuration
  if (direct) return direct
  const range = preflightDialog.value?.estimatedDurationMs
  if (!range) return '按实际不确定项数量计算'
  return `${formatDuration(range.minimum)} ～ ${formatDuration(range.maximum)}`
}

function formatDuration(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) return '--'
  const seconds = Math.max(0, Math.round(milliseconds / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes} 分 ${String(remaining).padStart(2, '0')} 秒`
}

function stageDuration(stage) {
  if (stage.durationMs !== undefined) return formatDuration(stage.durationMs)
  if (stage.startedAt && stage.state === 'running') return formatDuration(now.value - new Date(stage.startedAt).getTime())
  return '--'
}

function taskDuration() {
  if (!trainingTask.value?.createdAt) return '--'
  const end = terminalStates.includes(trainingTask.value.state) ? new Date(trainingTask.value.updatedAt).getTime() : now.value
  return formatDuration(end - new Date(trainingTask.value.createdAt).getTime())
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString('zh-CN', { hour12: false }) : '--'
}

function streamLabel() {
  return {
    connected: '实时连接', connecting: '正在连接', polling: '轮询恢复', disconnected: '连接中断', completed: '任务已结束', idle: '尚未连接',
  }[streamState.value]
}

async function publish(dataset, force = false) {
  const needsForce = force || !dataset.qualityPassed || dataset.publishable === false
  if (needsForce && !window.confirm(`数据集 ${dataset.id} 当前显示质量未通过。\n\n确认仍要发布该数据集版本吗？`)) return
  try {
    await request(`/api/datasets/${dataset.id}/publish?force=${needsForce}`, { method: 'POST' })
    await load()
  } catch (reason) {
    error.value = reason.message
  }
}

onMounted(() => {
  load()
  clockTimer = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => {
  stopTrainingStream()
  clearInterval(clockTimer)
})
</script>

<template>
  <section>
    <div class="page-header">
      <div><h1>加工任务</h1><p class="muted">{{ batch?.name || route.params.batchId }}</p></div>
    </div>
    <nav class="tabs">
      <router-link :to="`/batches/${route.params.batchId}/download`">下载文件</router-link>
      <router-link :to="`/batches/${route.params.batchId}/preprocess`">加工任务</router-link>
      <router-link :to="`/batches/${route.params.batchId}/quality`">质量分析</router-link>
    </nav>
    <div v-if="error" class="error page-error">{{ error }}</div>

    <div class="setup-grid">
      <section class="panel setup-panel">
        <div class="compact-heading">
          <div><h2>源文件检查</h2><p class="muted">识别可直接处理、可转换处理、需要 OCR、不支持和转换失败的来源。</p></div>
          <div class="training-actions">
            <button class="button secondary" :disabled="loading" @click="scan"><RefreshCw :size="15" />扫描</button>
          </div>
        </div>
        <div v-if="report" class="scan-summary">
          <span v-for="item in scanSummaryItems" :key="item[0]"><strong>{{ item[1] }}</strong>{{ item[0] }}</span>
        </div>
        <div v-if="report" class="scan-detail-grid">
          <section class="scan-detail-card">
            <h3>转换环境</h3>
            <div class="tool-list">
              <span v-for="tool in toolStatusItems" :key="tool.key" :class="['tool-pill', tool.available ? 'ready' : 'missing']">
                <strong>{{ tool.label }}</strong>
                <small>{{ tool.available ? '可用' : '缺失' }} · {{ tool.formats }}</small>
              </span>
            </div>
          </section>
          <section class="scan-detail-card">
            <h3>问题分布</h3>
            <div class="issue-strip">
              <span v-for="item in issueSummaryItems" :key="item[0]" :class="['issue-pill', item[2]]"><strong>{{ item[1] }}</strong>{{ item[0] }}</span>
            </div>
          </section>
        </div>
        <div v-else class="empty compact">尚未执行源文件扫描。</div>
        <details v-if="report" class="pending-files" @toggle="togglePending">
          <summary>扫描问题与非直接处理文件 <span class="badge">{{ (report.issues?.length || 0) + (report.unsupportedFiles || 0) }}</span></summary>
          <div v-if="pendingLoading" class="empty compact">正在加载...</div>
          <template v-else-if="pendingLoaded">
            <table v-if="pendingFiles.length" class="table scan-file-table">
              <thead><tr><th>文件</th><th>格式族</th><th>处理状态</th><th>转换就绪</th><th>大小</th><th>预览</th></tr></thead>
              <tbody>
                <tr v-for="file in pendingFiles" :key="file.id">
                  <td>{{ file.name }}</td>
                  <td>{{ formatLabel(file.formatFamily) }}</td>
                  <td><span :class="['status-pill', file.processingStatus]">{{ statusLabel(file.processingStatus) }}</span></td>
                  <td>{{ readinessLabel(file.conversionReadiness) }}</td>
                  <td>{{ formatBytes(file.size) }}</td>
                  <td><button class="button small secondary" :disabled="!file.previewableAfterConversion" @click="loadPreview(file.id)">预览</button></td>
                </tr>
              </tbody>
            </table>
            <PaginationControls v-if="pendingTotal" :page="pendingPage" :page-size="pendingPageSize" :total="pendingTotal" @change="changePendingPage" />
          </template>
        </details>
        <p class="muted execution-note">正式资料预处理将在启动知识加工后，作为六步骤流水线第一步统一执行。</p>
      </section>

    </div>

    <section class="panel training-panel">
      <header class="training-header">
          <div>
            <div class="title-line"><h2>知识加工流水线</h2><span v-if="trainingTask" :class="['badge', trainingTask.state]">{{ stateNames[trainingTask.state] || trainingTask.state }}</span></div>
            <p v-if="!batchReadyForTraining" class="warning inline-warning">
              {{ downloadTask?.canResume ? '资料下载已中断，请先到“下载文件”继续下载。' : '资料下载尚未完成，知识加工流水线将在下载结束后可启动。' }}
            </p>
            <p v-if="trainingTask" class="muted">{{ trainingTask.id }} · 当前步骤：{{ stageNames[displayCurrentStage] || displayCurrentStage }} · 已用 {{ taskDuration() }}</p>
          <p v-else class="muted">资料预处理、知识提取、索引生成。</p>
          </div>
        <div class="training-actions">
          <span v-if="trainingTask" :class="['stream-status', streamState]"><i></i>{{ streamLabel() }}</span>
          <button v-if="canCancelTraining" class="button cancel-button" :disabled="cancelLoading || trainingTask?.state === 'cancelling'" @click="cancelTraining">
            <X :size="15" />{{ trainingTask?.state === 'cancelling' ? '正在取消' : '取消任务' }}
          </button>
          <button class="button" :disabled="!canStartTraining || preflightLoading" @click="startTraining">
            {{ preflightLoading ? '正在检查模型与任务' : '开始知识加工' }}
          </button>
        </div>
      </header>

      <template v-if="trainingTask">
        <div class="metric-strip">
          <span><strong>{{ trainingPercent }}%</strong>总进度</span>
          <span title="模型或 Workflow Agent 成功返回且通过结构校验的结果"><strong>{{ trainingTask.modelCalls?.succeeded || 0 }}</strong>模型成功</span>
          <span title="模型调用、网关连接或返回格式错误"><strong>{{ trainingTask.modelCalls?.failed || 0 }}</strong>模型失败</span>
          <span title="关键词、知识点、实体和文档块的去重对象总数"><strong>{{ trainingTask.graphSummary?.nodeCount || 0 }}</strong>图谱节点</span>
          <span title="关键词或知识点匹配到文档块的上下文关联，以及具有原文证据的实体关系总数"><strong>{{ trainingTask.graphSummary?.edgeCount || 0 }}</strong>上下文关联</span>
          <span title="输入缺失、证据不足或模型无法可靠判断的只读质量问题"><strong>{{ qualityIssueCount }}</strong>质量问题</span>
        </div>
        <div class="progress training-progress"><span :style="{ width: `${trainingPercent}%` }"></span></div>

        <div class="pipeline-workbench">
          <section class="source-pane">
            <div class="pane-heading"><FileText :size="16" /><strong>可加工来源</strong><span>{{ processableTotal }}</span></div>
            <div class="source-filters">
              <button :class="{ active: sourceFilter === 'all' }" @click="sourceFilter = 'all'">全部</button>
              <button :class="{ active: sourceFilter === 'failed' }" @click="sourceFilter = 'failed'">失败</button>
              <button :class="{ active: sourceFilter === 'review' }" @click="sourceFilter = 'review'">质量问题</button>
            </div>
            <input v-model="sourceQuery" class="source-search" placeholder="搜索文件" />
            <div class="source-list">
              <button v-for="file in filteredSourceRows" :key="file.id" class="source-row" :class="file.processState" @click="loadPreview(file.id)">
                <i></i><span class="source-main"><strong>{{ file.name }}</strong><small>{{ statusLabel(file.processingStatus) }} · {{ formatLabel(file.formatFamily) }} · {{ file.lastMessage || '等待进入流水线' }}</small></span>
                <span class="source-counts"><b v-if="file.succeeded">{{ file.succeeded }} 成功</b><b v-if="file.failed" class="danger">{{ file.failed }} 失败</b></span>
              </button>
              <div v-if="!filteredSourceRows.length" class="empty compact">当前筛选没有文件。</div>
            </div>
            <PaginationControls v-if="textTotal" :page="textPage" :page-size="textPageSize" :total="textTotal" @change="changeTextPage" />
          </section>

          <section class="pipeline-pane">
            <div class="pane-heading"><Activity :size="16" /><strong>三步知识加工流水线</strong><span>{{ displayCompleted }}/3</span></div>
            <ol class="stage-list">
              <li v-for="(stage, index) in displayStages" :key="stage.id" :class="stage.state">
                <button class="stage-summary" @click="toggleStage(stage)">
                  <span class="stage-index">{{ index + 1 }}</span>
                  <span class="stage-title"><strong>{{ stageNames[stage.id] || stage.id }}</strong><small>{{ stage.message || stateNames[stage.state] }}</small></span>
                  <span class="stage-count">{{ stage.current ?? 0 }}<template v-if="stage.total !== undefined">/{{ stage.total }}</template> {{ stage.unit || '' }}</span>
                  <span v-if="stageSuccesses(stage)" class="stage-success">{{ stageSuccesses(stage) }} 成功</span>
                  <span v-if="stageFailures(stage)" class="stage-failure">{{ stageFailures(stage) }} 失败</span>
                  <span class="stage-duration"><Clock3 :size="13" />{{ stageDuration(stage) }}</span>
                  <span :class="['badge', stage.state]">{{ stateNames[stage.state] || stage.state }}</span>
                  <ChevronDown v-if="isStageExpanded(stage)" :size="16" />
                  <ChevronRight v-else :size="16" />
                </button>
                <div v-if="isStageExpanded(stage)" class="stage-detail">
                  <div class="stage-detail-grid">
                    <span><b>开始</b>{{ formatTime(stage.startedAt) }}</span>
                    <span><b>结束</b>{{ formatTime(stage.completedAt) }}</span>
                    <span><b>处理结果</b>成功 {{ stageSuccesses(stage) }} / 失败 {{ stageFailures(stage) }}</span>
                  </div>
                  <p v-if="stageExplanation(stage)" class="stage-explanation"><b>{{ stage.state === 'skipped' ? '跳过说明' : stage.state === 'failed' ? '失败说明' : '步骤说明' }}</b>{{ stageExplanation(stage) }}</p>
                  <div v-if="stage.total" class="progress slim"><span :style="{ width: `${Math.min(100, Math.round((stage.current || 0) / stage.total * 100))}%` }"></span></div>
                  <button v-if="stageFailures(stage) || stage.state === 'failed'" class="text-button failure-link" @click.stop="openFailureDrawer(stage)"><AlertTriangle :size="14" />查看失败详情</button>
                </div>
              </li>
            </ol>
          </section>

          <aside class="activity-pane">
            <section class="activity-section">
              <div class="pane-heading"><Activity :size="16" /><strong>实时活动</strong><span>{{ trainingLogs.length }}</span></div>
              <div class="activity-list">
                <button v-for="log in visibleRecentLogs" :key="log.sequence" class="activity-row" :class="log.level" @click="log.level === 'error' && openFailureDrawer({ id: log.stage }, log)">
                  <time>{{ formatTime(log.timestamp) }}</time><i></i><span><strong>{{ stageNames[displayStageId(log.stage)] || '加工任务' }}</strong><small>{{ displayLogMessage(log) }}</small></span>
                </button>
                <div v-if="!recentLogs.length" class="empty compact">等待流水线事件。</div>
                <button v-if="recentLogs.length > 8" class="activity-toggle" @click="activityExpanded = !activityExpanded">
                  {{ activityExpanded ? '收起到最近 8 条' : `展开全部 ${recentLogs.length} 条` }}
                </button>
              </div>
            </section>
          </aside>
        </div>
        <section class="quality-issues-panel">
          <header>
            <div>
              <h3>质量问题明细</h3>
              <p>展示本次加工运行落盘的自动质量问题，来源于运行目录 `quality/issues.json`。</p>
            </div>
            <div class="quality-issue-filters">
              <button :class="{ active: qualityIssueSeverity === 'all' }" @click="setQualityIssueSeverity('all')">全部 {{ qualityIssueOverallTotal || qualityIssueTotal }}</button>
              <button :class="{ active: qualityIssueSeverity === 'warning' }" @click="setQualityIssueSeverity('warning')">警告 {{ qualityIssueCounts.warning || 0 }}</button>
              <button :class="{ active: qualityIssueSeverity === 'info' }" @click="setQualityIssueSeverity('info')">提示 {{ qualityIssueCounts.info || 0 }}</button>
              <button :class="{ active: qualityIssueSeverity === 'error' }" @click="setQualityIssueSeverity('error')">错误 {{ qualityIssueCounts.error || 0 }}</button>
              <button :class="{ active: qualityIssueSeverity === 'unknown' }" @click="setQualityIssueSeverity('unknown')">未知 {{ qualityIssueCounts.unknown || 0 }}</button>
            </div>
          </header>
          <div v-if="qualityIssues.length" class="quality-issue-table-wrap">
            <table class="quality-issue-table">
              <thead>
                <tr><th>级别</th><th>问题代码</th><th>来源</th><th>处理单元</th><th>说明</th><th>文档预览</th></tr>
              </thead>
              <tbody>
                <tr v-for="issue in qualityIssues" :key="qualityIssueId(issue)">
                  <td><span :class="['quality-severity', qualityIssueSeverityValue(issue)]">{{ qualityIssueSeverityLabel(issue) }}</span></td>
                  <td>{{ issue.code || '-' }}</td>
                  <td>{{ qualityIssueSource(issue) }}</td>
                  <td>{{ issue.chunkId || '-' }}</td>
                  <td>
                    <strong>{{ issue.message || '-' }}</strong>
                    <small v-if="qualityIssueEvidence(issue)" class="quality-evidence-inline">证据：{{ qualityIssueEvidence(issue) }}</small>
                    <small v-if="qualityIssueDetails(issue)" class="quality-evidence-inline">详情：{{ qualityIssueDetails(issue) }}</small>
                  </td>
                  <td>
                    <button class="button small secondary" :disabled="!issue.resourceId || qualityIssuePreviewLoading === qualityIssueId(issue)" @click="openQualityIssuePreview(issue)">
                      {{ !issue.resourceId ? '无源文档' : qualityIssuePreviewLoading === qualityIssueId(issue) ? '加载中' : '预览' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty compact">当前运行没有可展示的质量问题。</div>
          <footer v-if="qualityIssueTotal > qualityIssueLimit" class="quality-issue-pager">
            <button class="button small secondary" :disabled="qualityIssueOffset === 0" @click="previousQualityIssues">上一页</button>
            <span>{{ qualityIssueOffset + 1 }} - {{ qualityIssueOffset + qualityIssues.length }} / {{ qualityIssueTotal }}</span>
            <button class="button small secondary" :disabled="qualityIssueOffset + qualityIssues.length >= qualityIssueTotal" @click="nextQualityIssues">下一页</button>
          </footer>
        </section>
        <div v-if="trainingTask.message" class="error task-message">{{ trainingTask.message }}</div>
      </template>
      <div v-else class="empty compact">尚未启动知识加工流水线。</div>
    </section>

    <div v-if="preview" class="preview-backdrop" @click.self="preview = null">
      <section class="panel preview-panel">
        <div class="compact-heading preview-dense-heading">
          <div>
            <h2>{{ denseHeaderMeta().fileName }}</h2>
            <p class="preview-heading-chips">
              <span v-for="chip in denseHeaderMeta().chips" :key="chip">{{ chip }}</span>
            </p>
          </div>
          <button class="icon-action" title="关闭预览" @click="preview = null"><X :size="16" /></button>
        </div>
        <div class="preview-tabs">
          <button v-for="tab in previewTabs" :key="tab.id" :class="{ active: previewMode === tab.id }" @click="previewMode = tab.id">{{ tab.label }}</button>
        </div>
        <section v-if="previewMode === 'metadata'" class="preview-section">
          <div class="preview-dashboard">
            <div class="preview-cockpit">
              <div class="preview-card dense-card features-card">
                <h3>结构特征矩阵</h3>
                <table class="dense-matrix">
                  <tbody>
                    <tr v-for="row in sourceFeatureRows()" :key="row.key" :class="row.state">
                      <th>{{ row.label }}</th>
                      <td>{{ featureDisplayValue(row) }}</td>
                      <td><span :class="['state-chip', row.state]">{{ featureStateLabel(row.state) }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="preview-card dense-card diagnosis-card">
                <h3>解析诊断</h3>
                <div class="diagnosis-strip">
                  <span v-for="item in overviewStats()" :key="item.label"><strong>{{ item.value }}</strong>{{ item.label }}</span>
                </div>
                <ul class="diagnosis-feed">
                  <li v-for="row in compactDiagnosticsRows()" :key="row.key" :class="row.state">
                    <span class="status-dot"></span>
                    <strong>{{ row.label }}</strong>
                    <span>{{ featureStateLabel(row.state) }}</span>
                    <small>{{ row.reason || featureDisplayReason(row) || '无额外诊断' }}</small>
                  </li>
                </ul>
              </div>

              <div class="preview-card dense-card fidelity-card">
                <h3>源文件 → Markdown 保真</h3>
                <table class="dense-matrix fidelity-matrix">
                  <tbody>
                    <tr v-for="row in fidelityCompactRows()" :key="row[0]">
                      <th>{{ row[0] }}</th>
                      <td>{{ row[1] }}</td>
                      <td><small>{{ row[2] }}</small></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <details class="preview-card wide-card detail-card">
              <summary>文件详情</summary>
              <div class="detail-grid">
                <dl class="meta-dl compact-dl"><template v-for="row in previewMetaRows()" :key="row[0]"><dt>{{ row[0] }}</dt><dd>{{ featureValue(row[1]) }}</dd></template></dl>
                <dl class="meta-dl compact-dl"><template v-for="row in detailRows()" :key="row[0]"><dt>{{ row[0] }}</dt><dd>{{ featureValue(row[1]) }}</dd></template></dl>
              </div>
            </details>

          </div>
        </section>
        <section v-else-if="previewMode === 'rendered'" class="preview-section">
          <MarkdownWorkbench
            :original="preview.convertedMarkdown || preview.original"
            :cleaned="preview.cleanedMarkdown || preview.cleaned"
            :assets="preview.assets || {}"
            mode="rendered"
            :show-tabs="false"
          />
        </section>
        <section v-else-if="previewMode === 'original'" class="preview-section">
          <MarkdownWorkbench
            :original="preview.convertedMarkdown || preview.original"
            :cleaned="preview.cleanedMarkdown || preview.cleaned"
            :assets="preview.assets || {}"
            mode="original"
            :show-tabs="false"
          />
        </section>
        <section v-else-if="previewMode === 'cleaned'" class="preview-section">
          <MarkdownWorkbench
            :original="preview.convertedMarkdown || preview.original"
            :cleaned="preview.cleanedMarkdown || preview.cleaned"
            :assets="preview.assets || {}"
            mode="cleaned"
            :show-tabs="false"
          />
        </section>
        <section v-else-if="previewMode === 'diff'" class="preview-section">
          <div class="preview-grid diff-grid">
            <div class="preview-card">
              <h3>结构化差异摘要</h3>
              <dl class="meta-dl compact-dl"><template v-for="row in diffSummaryRows()" :key="row[0]"><dt>{{ row[0] }}</dt><dd>{{ featureValue(row[1]) }}</dd></template></dl>
            </div>
            <div class="preview-card wide-card">
              <h3>源文件元信息 / 结构特征 与原始 Markdown 对照</h3>
              <table class="table comparison-table">
                <thead><tr><th>结构项</th><th>源文件侧</th><th>Markdown 侧</th></tr></thead>
                <tbody><tr v-for="item in preview.structureComparison?.differences || []" :key="item.key"><td>{{ item.label }}</td><td>{{ featureValue(item.sourceValue) }}</td><td>{{ featureValue(item.markdownValue) }}</td></tr></tbody>
              </table>
            </div>
            <div class="preview-card wide-card">
              <h3>转换清洗文本差异</h3>
              <MarkdownWorkbench
                :original="preview.convertedMarkdown || preview.original"
                :cleaned="preview.cleanedMarkdown || preview.cleaned"
                :assets="preview.assets || {}"
                mode="diff"
                :show-tabs="false"
              />
            </div>
            <div v-if="preview.issues?.length" class="preview-card wide-card">
              <h3>质量提示</h3>
              <ul class="preview-issue-list"><li v-for="issue in preview.issues" :key="issue.code"><span :class="['quality-severity', issue.severity]">{{ severityNames[issue.severity] || issue.severity }}</span>{{ issue.message }}</li></ul>
            </div>
          </div>
        </section>
        <section v-else class="preview-section">
          <div class="unit-list">
            <article v-for="unit in preview.processingUnits || []" :key="unit.chunkId || unit.id">
              <header><strong>{{ unit.chunkId || unit.id }}</strong><span>{{ (unit.content || '').length }} 字</span></header>
              <p v-if="unit.headingPath?.length">{{ unit.headingPath.join(' / ') }}</p>
              <pre>{{ unit.content }}</pre>
            </article>
            <div v-if="!(preview.processingUnits || []).length" class="empty compact">当前预览没有生成处理单元。</div>
          </div>
        </section>
        <p class="muted chunk-summary">清洗后共生成 {{ preview.totalChunks }} 个处理单元；本预览为调试产物，不会作为正式知识加工输入。</p>
      </section>
    </div>

    <div v-if="qualityIssuePreviewDialog" class="quality-preview-backdrop" @click.self="closeQualityIssuePreview">
      <section class="quality-preview-dialog" role="dialog" aria-modal="true" :aria-label="`${qualityIssuePreviewTitle(qualityIssuePreviewDialog)} Markdown 预览`">
        <header>
          <div>
            <h2>质量问题文档预览</h2>
            <p>{{ qualityIssuePreviewTitle(qualityIssuePreviewDialog) }}</p>
          </div>
          <button class="icon-action" title="关闭预览" @click="closeQualityIssuePreview"><X :size="17" /></button>
        </header>
        <div class="quality-preview-meta">
          <span><strong>问题代码</strong>{{ qualityIssuePreviewDialog.code || '-' }}</span>
          <span><strong>处理单元</strong>{{ qualityIssueContext(qualityIssuePreviewDialog)?.chunkId || qualityIssuePreviewDialog.chunkId || '-' }}</span>
          <span><strong>定位状态</strong>{{ qualityIssueContext(qualityIssuePreviewDialog)?.label || '正在加载文档' }}</span>
        </div>
        <div v-if="qualityIssuePreviewError(qualityIssuePreviewDialog)" class="quality-context-error">{{ qualityIssuePreviewError(qualityIssuePreviewDialog) }}</div>
        <div v-else-if="qualityIssuePreviewLoading === qualityIssueId(qualityIssuePreviewDialog)" class="quality-context-loading">正在加载完整 Markdown 预览...</div>
        <div v-else-if="qualityIssuePreview(qualityIssuePreviewDialog)" class="quality-markdown-workbench">
          <MarkdownWorkbench
            :original="qualityIssuePreview(qualityIssuePreviewDialog).original"
            :cleaned="qualityIssuePreview(qualityIssuePreviewDialog).cleaned"
            :assets="qualityIssuePreview(qualityIssuePreviewDialog).assets || {}"
            initial-tab="rendered"
          />
        </div>
      </section>
    </div>

    <section class="panel datasets-panel">
      <h2>数据集版本</h2>
      <div v-if="!datasets.length" class="empty compact">预处理完成后生成候选版本。</div>
      <div class="dataset-list">
        <div v-for="dataset in datasets" :key="dataset.id" class="dataset-row">
          <div><strong>{{ dataset.id }}</strong><p class="muted">{{ dataset.totalDocuments }} 文档 · {{ dataset.totalChunks }} 个处理单元</p></div>
          <span v-if="dataset.graphAvailable">{{ dataset.graphSummary?.keywordCount ?? dataset.graphSummary?.nodeCount ?? 0 }} 知识点/关键词 · {{ dataset.graphSummary?.contextEdgeCount ?? dataset.graphSummary?.edgeCount ?? 0 }} 上下文关联</span>
          <span :class="dataset.qualityPassed ? 'badge completed' : 'badge failed'">{{ dataset.qualityPassed ? '质量通过' : '质量未通过' }}</span>
          <button v-if="dataset.state !== 'published'" :class="['button', 'small', (!dataset.qualityPassed || dataset.publishable === false) ? 'warning-button' : '']" @click="publish(dataset)">
            {{ (!dataset.qualityPassed || dataset.publishable === false) ? '强制发布' : '发布' }}
          </button>
          <span v-else class="badge completed">已发布</span>
          <button class="button small danger-button" @click="deleteDataset(dataset)">删除</button>
        </div>
      </div>
    </section>

    <div v-if="preflightDialog" class="dialog-backdrop" @click.self="preflightDialog = null">
      <section class="preflight-dialog">
        <header>
          <div><h2>确认启动知识加工</h2><p>模型连接测试已通过，请确认本次任务规模。</p></div>
          <button class="icon-action" title="关闭" @click="preflightDialog = null"><X :size="17" /></button>
        </header>
        <div class="preflight-summary">
          <span><strong>{{ preflightValue('documentCount', 'documents') }}</strong>篇文档</span>
          <span><strong>{{ preflightValue('estimatedChunkCount', 'chunkCount', 'chunks') }}</strong>个预计处理单元</span>
          <span><strong>{{ preflightValue('semanticUncertainItems', 'totalModelCalls', 'modelCalls') }}</strong>个语义不确定项</span>
          <span><strong>{{ preflightDuration() }}</strong>预计语义耗时</span>
        </div>
        <div class="preflight-principle">
          <strong>执行原则</strong>
          <p>固定流程由代码执行；大模型仅处理“确定知识提取”内部识别出的语义不确定项，不接收完整文档。</p>
        </div>
        <ul v-if="preflightDialog.risks?.length" class="preflight-risks">
          <li v-for="risk in preflightDialog.risks" :key="risk">{{ risk }}</li>
        </ul>
        <footer>
          <button class="button secondary" :disabled="trainingStartLoading" @click="preflightDialog = null">返回检查</button>
          <button class="button" :disabled="trainingStartLoading" @click="confirmStartTraining">
            {{ trainingStartLoading ? '正在启动' : '确认启动六步骤加工' }}
          </button>
        </footer>
      </section>
    </div>

    <div v-if="failureDrawer" class="drawer-backdrop" @click.self="failureDrawer = null">
      <aside class="failure-drawer">
        <header><div><h2>失败详情</h2><p>{{ stageNames[failureDrawer.stage] || failureDrawer.stage }}</p></div><button class="icon-action" title="关闭" @click="failureDrawer = null"><X :size="17" /></button></header>
        <div v-if="drawerFailures.length" class="drawer-content">
          <article v-for="item in drawerFailures" :key="item.sequence" class="failure-item">
            <div class="failure-meta"><span>{{ formatTime(item.timestamp) }}</span><span>{{ eventNames[item.event] || '加工失败' }}</span></div>
            <h3>{{ displayLogMessage(item) }}</h3>
            <dl><template v-for="(value, key) in item.details" :key="key"><template v-if="key !== 'technicalError'"><dt>{{ detailLabel(key) }}</dt><dd>{{ detailValue(key, value) }}</dd></template></template></dl>
            <details v-if="item.details?.technicalError" class="technical-details"><summary>查看技术信息</summary><pre>{{ item.details.technicalError }}</pre></details>
          </article>
        </div>
        <div v-else class="empty">该步骤没有结构化失败事件。</div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.page-error { margin-bottom: 14px; }
.button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.setup-grid { display: grid; grid-template-columns: 1fr; gap: 14px; margin-bottom: 14px; }
.setup-panel { min-height: 160px; }
.compact-heading, .training-header, .title-line, .training-actions, .pane-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.compact-heading h2, .training-header h2 { margin-bottom: 4px; }
.scan-summary { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); margin-top: 18px; border-top: 1px solid #e5eaf1; border-bottom: 1px solid #e5eaf1; }
.scan-summary span { padding: 10px 12px; color: #6d7b90; font-size: 11px; border-right: 1px solid #e5eaf1; }
.scan-summary span:nth-child(6n) { border-right: 0; }
.scan-summary span:nth-child(n + 7) { border-top: 1px solid #e5eaf1; }
.scan-summary strong { display: block; color: #183b66; font-size: 17px; }
.scan-detail-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, .6fr); gap: 12px; margin-top: 12px; }
.scan-detail-card { min-width: 0; padding: 11px 12px; border: 1px solid #e1e7ef; border-radius: 7px; background: #fbfcfe; }
.scan-detail-card h3, .preview-card h3 { margin: 0 0 9px; color: #34445b; font-size: 12px; }
.tool-list, .issue-strip { display: flex; flex-wrap: wrap; gap: 8px; }
.tool-pill, .issue-pill { display: inline-flex; flex-direction: column; gap: 3px; min-width: 132px; padding: 8px 10px; border: 1px solid #dde4ee; border-radius: 6px; color: #536176; background: white; font-size: 11px; }
.tool-pill strong, .issue-pill strong { color: #183b66; font-size: 13px; }
.tool-pill small { color: #78869a; line-height: 1.35; }
.tool-pill.ready { border-color: #b7dfc5; background: #f2fbf5; }
.tool-pill.missing { border-color: #f0d7ac; background: #fffaf0; }
.issue-pill.error { color: #b42318; background: #fff0ed; border-color: #edb4ae; }
.issue-pill.warning { color: #8a4d08; background: #fffaf0; border-color: #f0d7ac; }
.issue-pill.info { color: #475467; background: #f2f5f9; }
.pending-files { margin-top: 12px; }
.pending-files summary { cursor: pointer; color: #44536a; font-size: 12px; }
.scan-file-table th:nth-child(1) { width: 38%; }
.status-pill { display: inline-flex; padding: 3px 7px; border-radius: 999px; color: #475467; background: #eef1f5; font-size: 10px; white-space: nowrap; }
.status-pill.direct_text, .status-pill.convertible { color: #168653; background: #e7f6ed; }
.status-pill.ocr_required, .status-pill.conversion_pending { color: #9b6108; background: #fff4d6; }
.status-pill.conversion_failed, .status-pill.unsupported { color: #b42318; background: #fff0ed; }
.source-search, .review-row input { width: 100%; min-width: 0; padding: 8px 9px; border: 1px solid #ccd6e3; border-radius: 5px; background: white; }
.execution-note { margin: 12px 0 0; }
.training-panel { padding: 0; overflow: hidden; }
.training-header { padding: 16px 18px 13px; border-bottom: 1px solid #dde4ee; }
.title-line { justify-content: flex-start; }
.stream-status { display: inline-flex; align-items: center; gap: 6px; color: #66758a; font-size: 12px; }
.stream-status i { width: 7px; height: 7px; border-radius: 50%; background: #9aa8ba; }
.stream-status.connected i { background: #168653; box-shadow: 0 0 0 3px #daf3e5; }
.stream-status.polling i, .stream-status.connecting i { background: #d18b20; }
.stream-status.disconnected i { background: #b42318; }
.cancel-button { color: #b42318; border-color: #edb4ae; background: white; }
.cancel-button:hover:not(:disabled) { background: #fff4f2; }
.danger-button { color: #b42318; border-color: #edb4ae; background: white; }
.danger-button:hover:not(:disabled) { background: #fff4f2; }
.warning-button { color: #9b6108; border-color: #f0d7ac; background: #fffaf0; }
.warning-button:hover:not(:disabled) { background: #fff4d6; }
.metric-strip { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); border-bottom: 1px solid #dde4ee; }
.metric-strip span { min-width: 0; padding: 10px 14px; color: #6d7b90; font-size: 11px; border-right: 1px solid #e5eaf1; }
.metric-strip span:last-child { border-right: 0; }
.metric-strip strong { display: block; color: #183b66; font-size: 17px; }
.training-progress { height: 4px; border-radius: 0; }
.pipeline-workbench { display: grid; grid-template-columns: 280px minmax(500px, 1fr) 360px; min-height: 570px; }
.quality-issues-panel { margin: 12px; border: 1px solid #dde4ee; border-radius: 7px; background: white; overflow: hidden; }
.quality-issues-panel header { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 58px; padding: 12px 14px; border-bottom: 1px solid #e5eaf1; }
.quality-issues-panel h3, .quality-issues-panel p { margin: 0; }
.quality-issues-panel h3 { color: #34445b; font-size: 14px; }
.quality-issues-panel p { margin-top: 4px; color: #78869a; font-size: 11px; }
.quality-issue-filters { display: flex; gap: 5px; flex-wrap: wrap; }
.quality-issue-filters button { padding: 5px 9px; border: 0; border-radius: 4px; color: #66758a; background: transparent; font-size: 11px; }
.quality-issue-filters button.active { color: #175cd3; background: #eaf2ff; }
.quality-issue-table-wrap { max-height: min(72vh, 760px); overflow: auto; }
.quality-issue-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.quality-issue-table th, .quality-issue-table td { padding: 8px 10px; border-bottom: 1px solid #edf0f5; text-align: left; font-size: 11px; vertical-align: top; overflow-wrap: anywhere; }
.quality-issue-table th { position: sticky; top: 0; z-index: 1; color: #637086; background: #f7f9fc; }
.quality-issue-table th:nth-child(1) { width: 64px; }
.quality-issue-table th:nth-child(2) { width: 160px; }
.quality-issue-table th:nth-child(4) { width: 130px; }
.quality-issue-table th:nth-child(6) { width: 150px; }
.quality-issue-table td:nth-child(6) .button { width: 100%; }
.quality-severity { display: inline-flex; padding: 2px 6px; border-radius: 999px; font-size: 10px; }
.quality-severity.warning { color: #9b6108; background: #fff4d6; }
.quality-severity.error, .quality-severity.critical, .quality-severity.high { color: #b42318; background: #fff0ed; }
.quality-severity.info { color: #475467; background: #eef1f5; }
.quality-evidence-inline { display: block; margin-top: 5px; color: #78869a; line-height: 1.45; }
.quality-context-row td { padding: 0; background: #fbfcfe; }
.quality-context-card { margin: 10px; padding: 12px; border: 1px solid #cdddf3; border-radius: 7px; background: #f7fbff; }
.quality-context-card.imprecise { border-color: #f0d7ac; background: #fffaf0; }
.quality-context-card header { padding: 0 0 8px; border-bottom: 1px solid #e2eaf5; }
.quality-context-card header strong, .quality-context-card header small { display: block; }
.quality-context-card header strong { color: #24364d; font-size: 12px; }
.quality-context-card header small { margin-top: 3px; color: #6d7b90; font-size: 10px; }
.quality-context-card dl { display: grid; grid-template-columns: 72px minmax(0, 1fr); margin: 10px 0; font-size: 10px; }
.quality-context-card dt, .quality-context-card dd { margin: 0; padding: 5px 7px; border-bottom: 1px solid #e7edf5; overflow-wrap: anywhere; }
.quality-context-card dt { color: #637086; background: rgba(255, 255, 255, .7); }
.quality-context-card pre { max-height: min(58vh, 620px); margin: 0; padding: 11px; overflow: auto; border: 1px solid #dce5ef; border-radius: 6px; color: #34445b; background: white; font: 10px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.quality-context-snippet { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 6px; margin: 10px 0 0; color: #536176; font-size: 10px; line-height: 1.5; }
.quality-context-snippet strong { color: #34445b; }
.quality-context-card mark { padding: 1px 2px; color: #7a3a00; background: #ffe08a; border-radius: 2px; }
.quality-context-loading, .quality-context-error { margin: 10px; padding: 12px; border-radius: 6px; font-size: 11px; }
.quality-context-loading { color: #536176; background: #f2f5f9; }
.quality-context-error { color: #b42318; background: #fff0ed; }
.quality-preview-backdrop { position: fixed; z-index: 45; inset: 0; display: grid; place-items: center; padding: 22px; background: rgba(23, 32, 51, .42); }
.quality-preview-dialog { display: flex; flex-direction: column; width: min(1320px, 96vw); height: min(900px, 94vh); overflow: hidden; border-radius: 10px; background: white; box-shadow: 0 24px 80px rgba(16, 36, 64, .3); }
.quality-preview-dialog > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 18px 20px 14px; border-bottom: 1px solid #dde4ee; }
.quality-preview-dialog h2, .quality-preview-dialog p { margin: 0; }
.quality-preview-dialog h2 { color: #24364d; font-size: 18px; }
.quality-preview-dialog header p { margin-top: 5px; color: #78869a; font-size: 12px; overflow-wrap: anywhere; }
.quality-preview-meta { display: grid; grid-template-columns: 220px 220px minmax(0, 1fr); gap: 0; border-bottom: 1px solid #e5eaf1; }
.quality-preview-meta span { min-width: 0; padding: 10px 14px; color: #536176; font-size: 11px; border-right: 1px solid #e5eaf1; overflow-wrap: anywhere; }
.quality-preview-meta span:last-child { border-right: 0; }
.quality-preview-meta strong { display: block; margin-bottom: 4px; color: #183b66; font-size: 12px; }
.quality-markdown-workbench { min-height: 0; padding: 12px; overflow: hidden; }
.quality-markdown-workbench :deep(.markdown-workbench) { height: calc(min(900px, 94vh) - 145px); }
.quality-markdown-workbench :deep(.editor-host), .quality-markdown-workbench :deep(.rendered-markdown) { height: calc(min(900px, 94vh) - 188px); }
.quality-issue-pager { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 10px 12px; color: #66758a; font-size: 11px; border-top: 1px solid #edf0f5; }
.source-pane, .pipeline-pane, .activity-pane { min-width: 0; }
.source-pane, .pipeline-pane { border-right: 1px solid #dde4ee; }
.pane-heading { height: 42px; justify-content: flex-start; padding: 0 12px; border-bottom: 1px solid #e5eaf1; color: #44536a; font-size: 12px; }
.pane-heading span { margin-left: auto; color: #78869a; }
.source-filters { display: flex; gap: 4px; padding: 9px 10px 6px; }
.source-filters button { padding: 5px 9px; border: 0; border-radius: 4px; color: #66758a; background: transparent; font-size: 11px; }
.source-filters button.active { color: #175cd3; background: #eaf2ff; }
.source-search { width: calc(100% - 20px); margin: 0 10px 8px; font-size: 12px; }
.source-list { height: 410px; overflow: auto; border-top: 1px solid #edf0f5; }
.source-row { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; gap: 8px; width: 100%; padding: 9px 10px; border: 0; border-bottom: 1px solid #edf0f5; text-align: left; background: white; }
.source-row:hover { background: #f7f9fc; }
.source-row > i { width: 7px; height: 7px; margin-top: 5px; border-radius: 50%; background: #aab5c4; }
.source-row.running > i { background: #175cd3; }
.source-row.completed > i { background: #168653; }
.source-row.failed > i { background: #b42318; }
.source-row.review > i { background: #d18b20; }
.source-main { min-width: 0; }
.source-main strong, .source-main small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-main strong { color: #34445b; font-size: 12px; }
.source-main small { margin-top: 3px; color: #7a8799; font-size: 10px; }
.source-counts { text-align: right; font-size: 9px; }
.source-counts b { display: block; color: #168653; font-weight: 500; }
.source-counts .danger { color: #b42318; }
.pipeline-pane { background: #fbfcfe; }
.stage-list { margin: 0; padding: 10px 12px; list-style: none; }
.stage-list li { position: relative; margin-bottom: 5px; border: 1px solid #e1e7ef; border-radius: 6px; background: white; }
.stage-list li.running { border-color: #8bb5ee; box-shadow: inset 3px 0 #2f75d6; }
.stage-list li.failed { border-color: #f0aaa5; box-shadow: inset 3px 0 #b42318; }
.stage-summary { display: grid; grid-template-columns: 24px minmax(130px, 1fr) auto auto auto 62px auto 16px; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 6px 9px; border: 0; text-align: left; background: transparent; }
.stage-index { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; color: #6e7d91; background: #edf1f6; font-size: 10px; font-weight: 700; }
.running .stage-index { color: white; background: #2f75d6; }
.completed .stage-index { color: white; background: #168653; }
.failed .stage-index { color: white; background: #b42318; }
.stage-title { min-width: 0; }
.stage-title strong, .stage-title small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stage-title strong { color: #34445b; font-size: 12px; }
.stage-title small { margin-top: 2px; color: #78869a; font-size: 10px; }
.stage-count, .stage-duration, .stage-success, .stage-failure { color: #6d7b90; font-size: 10px; white-space: nowrap; }
.stage-duration { display: inline-flex; align-items: center; gap: 3px; }
.stage-success { color: #168653; }
.stage-failure { color: #b42318; }
.stage-detail { padding: 8px 10px 10px 42px; border-top: 1px solid #edf0f5; background: #fafbfd; }
.stage-detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; color: #637086; font-size: 10px; }
.stage-detail-grid span { display: flex; gap: 5px; }
.stage-explanation { display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 6px; margin: 8px 0 0; color: #536176; font-size: 10px; line-height: 1.5; }
.stage-explanation b { color: #34445b; }
.progress.slim { height: 4px; margin-top: 8px; }
.failure-link { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; color: #b42318; font-size: 11px; }
.activity-pane { min-height: 0; background: white; }
.activity-section { height: 100%; min-height: 0; }
.activity-list { height: calc(100% - 42px); overflow: auto; }
.review-list { height: calc(100% - 74px); overflow: auto; }
.activity-row { display: grid; grid-template-columns: 50px 7px minmax(0, 1fr); gap: 7px; width: 100%; padding: 8px 10px; border: 0; border-bottom: 1px solid #edf0f5; text-align: left; background: white; }
.activity-row:hover { background: #f7f9fc; }
.activity-row time { color: #8a96a8; font-size: 9px; }
.activity-row > i { width: 6px; height: 6px; margin-top: 4px; border-radius: 50%; background: #2f75d6; }
.activity-row.error > i { background: #b42318; }
.activity-row.warning > i { background: #d18b20; }
.activity-row strong, .activity-row small { display: block; }
.activity-row strong { color: #536176; font-size: 10px; }
.activity-row small { margin-top: 2px; color: #7a8799; font-size: 10px; line-height: 1.4; }
.activity-toggle { width: calc(100% - 20px); margin: 8px 10px 10px; padding: 7px 10px; border: 1px solid #cdddf3; border-radius: 5px; color: #175cd3; background: #f3f7fd; font-size: 11px; }
.review-row { padding: 9px 10px; border-bottom: 1px solid #edf0f5; }
.review-row strong, .review-row small { display: block; }
.review-row strong { color: #8a4d08; font-size: 10px; }
.review-row small { margin-top: 3px; color: #657388; font-size: 10px; line-height: 1.4; }
.review-row input { margin-top: 7px; padding: 6px 7px; font-size: 10px; }
.review-filters { display: flex; gap: 4px; height: 32px; padding: 5px 9px; border-bottom: 1px solid #edf0f5; }
.review-filters button { padding: 3px 7px; border: 0; border-radius: 4px; color: #66758a; background: transparent; font-size: 10px; }
.review-filters button.active { color: #175cd3; background: #eaf2ff; }
.review-summary { display: grid; grid-template-columns: minmax(0, 1fr) 16px; align-items: start; gap: 6px; width: 100%; padding: 0; border: 0; text-align: left; background: transparent; }
.review-details { margin-top: 8px; padding: 8px; border: 1px solid #e1e7ef; border-radius: 5px; background: #fafbfd; }
.review-details dl { display: grid; grid-template-columns: 72px minmax(0, 1fr); margin: 0; font-size: 9px; }
.review-details dt, .review-details dd { margin: 0; padding: 4px 5px; border-bottom: 1px solid #edf0f5; overflow-wrap: anywhere; }
.review-details dt { color: #78869a; }
.review-details pre { max-height: 130px; margin: 0; overflow: auto; font: 9px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; }
.review-details details { margin-top: 7px; color: #536176; font-size: 9px; }
.review-actions { display: flex; gap: 5px; margin-top: 7px; }
.review-action { display: inline-flex; align-items: center; gap: 4px; padding: 5px 8px; border: 1px solid #ccd6e3; border-radius: 5px; color: #536176; background: white; font-size: 10px; }
.review-action.accept { color: #168653; border-color: #a8dabc; }
.review-action.reject { color: #b42318; border-color: #edb4ae; }
.review-decision { display: inline-block; margin-top: 7px; font-size: 10px; }
.review-decision.accepted { color: #168653; }
.review-decision.rejected { color: #b42318; }
.icon-action { display: inline-grid; place-items: center; width: 29px; height: 29px; padding: 0; border: 1px solid #ccd6e3; border-radius: 5px; color: #536176; background: white; }
.icon-action.accept { color: #168653; border-color: #a8dabc; }
.icon-action.reject { color: #b42318; border-color: #edb4ae; }
.task-message { margin: 0 12px 12px; }
.preview-backdrop { position: fixed; z-index: 46; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(23, 32, 51, .42); }
.preview-panel { width: min(1320px, 96vw); height: min(900px, 94vh); margin-top: 0; overflow: hidden; border-radius: 10px; background: white; box-shadow: 0 24px 70px rgba(16, 36, 64, .3); }
.preview-panel, .datasets-panel { margin-top: 14px; }
.preview-dense-heading { align-items: center; padding-bottom: 8px; }
.preview-dense-heading h2 { max-width: 980px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-heading-chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 5px 0 0; }
.preview-heading-chips span { padding: 2px 7px; border: 1px solid #d9e2ef; border-radius: 999px; color: #506179; background: #f8fbff; font-size: 10px; line-height: 1.5; }
.preview-tabs { display: inline-flex; flex-wrap: wrap; gap: 2px; margin: 6px 0 8px; padding: 3px; border: 1px solid #dfe6ef; border-radius: 8px; background: #f7f9fc; }
.preview-tabs button { padding: 5px 9px; border: 0; border-radius: 6px; color: #66758a; background: transparent; font-size: 11px; line-height: 1.35; }
.preview-tabs button.active { color: #175cd3; background: white; box-shadow: 0 1px 3px rgba(16, 36, 64, .08); }
.preview-section { min-width: 0; overflow: auto; }
.preview-dashboard { display: grid; gap: 7px; }
.eyebrow { margin: 0; color: #7a8799; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
.preview-cockpit { display: grid; grid-template-columns: minmax(260px, .9fr) minmax(300px, 1fr) minmax(340px, 1.15fr); gap: 7px; align-items: start; }
.preview-grid, .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.diff-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.preview-card { min-width: 0; padding: 12px; border: 1px solid #e1e7ef; border-radius: 7px; background: #fbfcfe; }
.dense-card { padding: 7px 8px; border-radius: 6px; background: #fcfdff; }
.dense-card h3 { margin: 0 0 6px; color: #24364d; font-size: 12px; line-height: 1.35; }
.wide-card { grid-column: 1 / -1; }
.meta-dl { display: grid; grid-template-columns: 120px minmax(0, 1fr); margin: 0; font-size: 11px; }
.compact-dl { grid-template-columns: 110px minmax(0, 1fr); }
.meta-dl dt, .meta-dl dd { margin: 0; padding: 7px 8px; border-bottom: 1px solid #edf0f5; overflow-wrap: anywhere; }
.meta-dl dt { color: #66758a; background: rgba(255, 255, 255, .72); }
.meta-dl dd { display: flex; flex-direction: column; gap: 4px; color: #34445b; }
.meta-dl dd strong { font-weight: 600; }
.meta-dl dd small { color: #7a8799; font-size: 10px; line-height: 1.4; }
.comparison-table th, .comparison-table td { font-size: 11px; }
.diagnosis-card, .features-card, .fidelity-card { box-shadow: 0 1px 0 rgba(16, 36, 64, .02); }
.diagnosis-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.diagnosis-stats span { display: grid; gap: 2px; padding: 9px 10px; border: 1px solid #e3e9f1; border-radius: 8px; color: #66758a; background: white; font-size: 11px; text-align: center; }
.diagnosis-stats strong { color: #183b66; font-size: 18px; }
.diagnosis-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.diagnosis-list li { display: flex; gap: 10px; align-items: flex-start; padding: 9px 10px; border: 1px solid #e7ebf1; border-radius: 8px; background: white; }
.status-dot { flex: none; width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: #b6c2d0; }
.diagnosis-list li.ok .status-dot, .diagnosis-list li.zero_value .status-dot { background: #17a34a; }
.diagnosis-list li.not_applicable .status-dot { background: #6b7280; }
.diagnosis-list li.not_implemented .status-dot { background: #d97706; }
.diagnosis-list li.parse_failed .status-dot { background: #dc2626; }
.diagnosis-list li div { display: grid; gap: 3px; min-width: 0; }
.diagnosis-list li strong { color: #24364d; font-size: 11px; }
.diagnosis-list li small { color: #7a8799; font-size: 10px; line-height: 1.35; }
.diagnosis-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; margin-bottom: 6px; }
.diagnosis-strip span { display: flex; align-items: baseline; justify-content: center; gap: 3px; padding: 4px 5px; border: 1px solid #e3e9f1; border-radius: 5px; color: #66758a; background: white; font-size: 10px; }
.diagnosis-strip strong { color: #183b66; font-size: 14px; }
.diagnosis-feed { display: grid; gap: 4px; max-height: 292px; margin: 0; padding: 0; overflow: auto; list-style: none; }
.diagnosis-feed li { display: grid; grid-template-columns: 10px minmax(56px, .8fr) auto minmax(0, 1.4fr); align-items: center; gap: 5px; padding: 5px 6px; border: 1px solid #e7ebf1; border-radius: 5px; background: white; }
.diagnosis-feed li strong { color: #24364d; font-size: 11px; }
.diagnosis-feed li span:not(.status-dot) { color: #536176; font-size: 10px; }
.diagnosis-feed li small { min-width: 0; overflow: hidden; color: #7a8799; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.feature-tile-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.feature-tile { display: grid; gap: 4px; padding: 12px; border: 1px solid #e1e7ef; border-radius: 10px; background: white; }
.feature-tile span { color: #6b7788; font-size: 11px; }
.feature-tile strong { color: #183b66; font-size: 20px; line-height: 1.1; }
.feature-tile em { color: #7a8799; font-style: normal; font-size: 10px; }
.feature-tile.ok, .feature-tile.zero_value { border-color: #cde9d9; background: linear-gradient(180deg, #fff 0%, #f7fcf9 100%); }
.feature-tile.not_applicable { border-color: #dbe2ea; background: #fbfcfe; }
.feature-tile.not_implemented { border-color: #fde2b3; background: #fffaf1; }
.feature-tile.parse_failed { border-color: #f4c4c4; background: #fff7f7; }
.fidelity-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.fidelity-grid article { display: grid; gap: 4px; padding: 10px 12px; border: 1px solid #e1e7ef; border-radius: 10px; background: white; }
.fidelity-grid span { color: #6b7788; font-size: 11px; }
.fidelity-grid strong { color: #183b66; font-size: 18px; overflow-wrap: anywhere; }
.dense-matrix { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
.dense-matrix tr { border-bottom: 1px solid #edf0f5; }
.dense-matrix tr:last-child { border-bottom: 0; }
.dense-matrix th, .dense-matrix td { padding: 5px 6px; text-align: left; vertical-align: middle; overflow-wrap: anywhere; }
.dense-matrix th { width: 74px; color: #66758a; font-weight: 500; background: rgba(255, 255, 255, .7); }
.dense-matrix td { color: #34445b; }
.dense-matrix td:nth-child(2) { color: #183b66; font-weight: 650; }
.dense-matrix td:last-child { width: 72px; text-align: right; }
.fidelity-matrix th { width: 72px; }
.fidelity-matrix td:last-child { width: 112px; color: #7a8799; text-align: left; }
.fidelity-matrix small { font-size: 10px; line-height: 1.35; }
.state-chip { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; padding: 1px 5px; border: 1px solid #dbe2ea; border-radius: 999px; color: #536176; background: #f8fafc; font-size: 10px; line-height: 1.45; white-space: nowrap; }
.state-chip.ok, .state-chip.zero_value { border-color: #bfe5ce; color: #168653; background: #f2fbf5; }
.state-chip.not_applicable { border-color: #dbe2ea; color: #66758a; background: #f8fafc; }
.state-chip.not_implemented { border-color: #f7d18f; color: #9a630f; background: #fff8ea; }
.state-chip.parse_failed { border-color: #efb4b4; color: #b42318; background: #fff1f1; }
.detail-card { padding: 0; overflow: hidden; }
.detail-card summary { padding: 7px 9px; color: #24364d; background: #f9fbfe; font-size: 11px; font-weight: 600; cursor: pointer; list-style: none; }
.detail-card summary::-webkit-details-marker { display: none; }
.detail-card[open] summary { border-bottom: 1px solid #e5eaf1; }
.detail-card .detail-grid { padding: 7px; }
.preview-issue-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; color: #536176; font-size: 11px; }
.preview-issue-list li { display: flex; align-items: center; gap: 7px; padding: 8px 9px; border: 1px solid #e1e7ef; border-radius: 6px; background: white; }
.unit-list { display: grid; gap: 10px; max-height: 680px; overflow: auto; }
.unit-list article { border: 1px solid #e1e7ef; border-radius: 7px; background: #fbfcfe; overflow: hidden; }
.unit-list header { display: flex; justify-content: space-between; gap: 10px; padding: 9px 11px; border-bottom: 1px solid #edf0f5; color: #34445b; font-size: 11px; }
.unit-list header span { color: #78869a; }
.unit-list p { margin: 9px 11px 0; color: #66758a; font-size: 11px; }
.unit-list pre { max-height: 220px; margin: 9px 11px 11px; padding: 10px; overflow: auto; border: 1px solid #dde4ee; border-radius: 5px; color: #34445b; background: white; font: 10px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.chunk-summary { margin-top: 10px; }
.dataset-list { display: grid; }
.dataset-row { display: grid; grid-template-columns: minmax(280px, 1fr) auto auto auto auto; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 1px solid #e5eaf1; font-size: 12px; }
.dialog-backdrop { position: fixed; z-index: 40; inset: 0; display: grid; place-items: center; padding: 24px; background: rgba(23, 32, 51, .38); }
.preflight-dialog { width: min(680px, 92vw); overflow: hidden; border-radius: 10px; background: white; box-shadow: 0 24px 70px rgba(16, 36, 64, .28); }
.preflight-dialog header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 16px; border-bottom: 1px solid #dde4ee; }
.preflight-dialog h2, .preflight-dialog p { margin: 0; }
.preflight-dialog h2 { color: #24364d; font-size: 18px; }
.preflight-dialog header p { margin-top: 5px; color: #78869a; font-size: 12px; }
.preflight-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-bottom: 1px solid #e5eaf1; }
.preflight-summary span { min-width: 0; padding: 15px 16px; color: #6d7b90; font-size: 11px; border-right: 1px solid #e5eaf1; }
.preflight-summary span:last-child { border-right: 0; }
.preflight-summary strong { display: block; margin-bottom: 4px; color: #183b66; font-size: 17px; overflow-wrap: anywhere; }
.preflight-principle { margin: 16px 22px 0; padding: 13px 14px; border: 1px solid #cdddf3; border-radius: 7px; color: #44536a; background: #f3f7fd; }
.preflight-principle strong { color: #175cd3; font-size: 12px; }
.preflight-principle p { margin-top: 5px; font-size: 11px; line-height: 1.6; }
.preflight-risks { max-height: 150px; margin: 14px 22px 0; padding: 10px 14px 10px 30px; overflow: auto; border: 1px solid #f0d7ac; border-radius: 7px; color: #7b571d; background: #fffaf0; font-size: 11px; line-height: 1.7; }
.preflight-dialog footer { display: flex; justify-content: flex-end; gap: 8px; padding: 18px 22px 20px; }
.drawer-backdrop { position: fixed; z-index: 30; inset: 0; background: rgba(23, 32, 51, .25); }
.failure-drawer { position: absolute; top: 0; right: 0; width: min(560px, 48vw); height: 100%; background: white; box-shadow: -12px 0 36px rgba(16, 36, 64, .18); }
.failure-drawer header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #dde4ee; }
.failure-drawer h2, .failure-drawer p { margin: 0; }
.failure-drawer h2 { font-size: 17px; }
.failure-drawer p { margin-top: 4px; color: #78869a; font-size: 11px; }
.drawer-content { height: calc(100% - 74px); overflow: auto; padding: 14px 18px; }
.failure-item { padding: 14px 0; border-bottom: 1px solid #e5eaf1; }
.failure-meta { display: flex; justify-content: space-between; color: #8a96a8; font-size: 10px; }
.failure-item h3 { margin: 8px 0 12px; color: #9d2520; font-size: 13px; line-height: 1.5; }
.failure-item dl { display: grid; grid-template-columns: 110px 1fr; margin: 0; font-size: 11px; }
.failure-item dt, .failure-item dd { margin: 0; padding: 5px 7px; border-bottom: 1px solid #edf0f5; overflow-wrap: anywhere; }
.failure-item dt { color: #6d7b90; background: #f7f9fc; }
.technical-details { margin-top: 12px; color: #536176; font-size: 11px; }
.technical-details summary { cursor: pointer; color: #175cd3; }
.technical-details pre { max-height: 220px; margin: 8px 0 0; padding: 10px; overflow: auto; border: 1px solid #dde4ee; border-radius: 5px; color: #46566d; background: #f7f9fc; font: 10px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.empty.compact { padding: 22px 12px; font-size: 11px; }
@media (max-width: 1350px) {
  .pipeline-workbench { grid-template-columns: 240px minmax(460px, 1fr) 310px; }
  .stage-summary { grid-template-columns: 24px minmax(120px, 1fr) auto auto 58px auto 16px; }
  .stage-success { display: none; }
}
@media (max-width: 760px) {
  .scan-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .scan-summary span { border-top: 1px solid #e5eaf1; }
  .scan-summary span:nth-child(-n + 2) { border-top: 0; }
  .scan-detail-grid, .preview-grid, .diff-grid, .preview-cockpit, .detail-grid, .feature-tile-grid, .fidelity-grid, .diagnosis-stats, .diagnosis-strip { grid-template-columns: 1fr; }
  .preview-dense-heading h2 { white-space: normal; }
  .diagnosis-feed li { grid-template-columns: 10px minmax(48px, .8fr) auto; }
  .diagnosis-feed li small { grid-column: 2 / -1; white-space: normal; }
  .preflight-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .preflight-summary span:nth-child(2) { border-right: 0; }
  .preflight-summary span:nth-child(-n + 2) { border-bottom: 1px solid #e5eaf1; }
}
</style>
