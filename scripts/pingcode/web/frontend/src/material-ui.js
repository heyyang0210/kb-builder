export const TERMS = {
  platform: 'YashanDB 资料加工平台',
  workbench: '工作台',
  materialTask: '资料加工任务',
  taskName: '任务名称',
  taskId: '任务 ID',
  executionTask: '执行任务',
  processingState: '加工状态',
}

export const PROCESS_STATES = {
  pending: { label: '待处理', tone: 'neutral' },
  running: { label: '运行中', tone: 'info' },
  review: { label: '待复核', tone: 'warning' },
  failed: { label: '异常', tone: 'danger' },
  publishable: { label: '可发布', tone: 'success' },
  completed: { label: '已完成', tone: 'success' },
  unknown: { label: '状态未知', tone: 'neutral' },
}

export const STAGE_LABELS = {
  queued: '排队等待',
  running: '执行中',
  completed: '执行完成',
  cancelled: '已取消',
  paused: '已暂停',
  cancelling: '取消中',
  pausing: '暂停中',
  page_content: '下载页面正文',
  material_preparation: '资料预处理',
  metadata_construction: '元数据构建',
  knowledge_extraction: '知识提取',
  index_generation: '索引生成',
  deterministic_extraction: '确定知识提取',
  knowledge_validation: '知识校验与合并',
  validation_graph: '知识校验与合并',
  graph_dataset_generation: '图谱与数据集生成',
  dataset_generation: '图谱与数据集生成',
  draft: '等待下载',
  staging: '资料暂存',
  uploaded: '上传完成',
  downloaded: '下载完成',
  processing: '加工中',
  ready: '加工完成',
  failed: '加工失败',
}

export function processState(value) {
  return PROCESS_STATES[value] || PROCESS_STATES.unknown
}

export function stageLabel(value) {
  return STAGE_LABELS[value] || value || '等待处理'
}
