let runtime = {}

const governanceStatusLabels = {
  keyword: '待完成关键词治理',
  formal: '正式知识已构建',
  index: '索引已生成',
  evaluated: '发布评测已完成',
  published: '已发布',
  failed: '治理失败',
  cancelled: '治理已取消',
}

const governanceGateLabels = {
  entity_relation: '实体与关系',
  evidence: '证据完整性',
  acl: '访问权限',
  quality: '质量门禁',
  evaluation: '发布评测',
  manifest: '血缘清单',
}

const governanceReasonLabels = {
  READY_TO_PUBLISH: '所有发布前置检查已通过',
  ACL_EVALUATION_PENDING: '访问权限尚未完成评估',
  ENTITY_RELATION_OR_EVIDENCE_REQUIRED: '实体、关系或证据仍不完整',
  PUBLISH_GATE_BLOCKED: '发布前置检查未通过',
}

const governanceGateActions = {
  entity_relation: '先构建并校验正式实体与关系',
  evidence: '先补全并验证可回放证据',
  acl: '先完成数据集访问权限评估',
  quality: '先修复 P0 质量问题并重新校验',
  evaluation: '先完成发布评测',
  manifest: '先生成并验证血缘清单',
}

export async function initRuntimeConfig() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}runtime-config.json`, { cache: 'no-store' })
    if (response.ok) runtime = await response.json()
  } catch {
    runtime = {}
  }
}

export function baseUrl() {
  return (runtime.apiBaseUrl || '').replace(/\/$/, '')
}

export function rawRequest(path, options = {}) {
  return fetch(`${baseUrl()}${path}`, options)
}

export async function request(path, options = {}) {
  const url = `${baseUrl()}${path}`
  let response
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch (reason) {
    if (reason?.name === 'AbortError') throw reason
    throw new Error(`无法连接后端服务：${url}。请检查服务地址和 CORS 配置。${reason?.message ? ` ${reason.message}` : ''}`)
  }
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json() : null
  if (!response.ok) {
    const error = payload?.error || { code: 'HTTP_ERROR', message: `请求失败：HTTP ${response.status}` }
    throw Object.assign(new Error(error.message), error)
  }
  return payload
}

export function taskEventUrl(taskId) {
  const eventBase = (runtime.eventBaseUrl || baseUrl()).replace(/\/$/, '')
  return `${eventBase}/api/tasks/${encodeURIComponent(taskId)}/events`
}

export function fileUrl(resourceId, action) {
  return `${baseUrl()}/api/files/${encodeURIComponent(resourceId)}/${action}`
}

export function datasetGovernanceView(dataset) {
  const governance = dataset?.governance
  if (!governance) {
    const requiresForce = dataset?.qualityPassed !== true || dataset?.publishable === false
    return {
      governed: false,
      statusLabel: dataset?.state === 'published' ? '已发布' : '历史兼容模式',
      canPublish: dataset?.state !== 'published',
      requiresForce,
      blockedChecks: [],
      reasonLabel: requiresForce ? '历史数据未通过旧版质量检查' : '历史数据沿用旧版发布规则',
      nextAction: requiresForce ? '核对质量结果后使用历史兼容发布' : '可发布当前历史版本',
    }
  }

  const checks = governance.gateChecks || {}
  const blockedChecks = Object.entries(governanceGateLabels)
    .filter(([key]) => checks[key] !== true)
    .map(([key, label]) => ({ key, label }))
  const canPublish = dataset?.state !== 'published'
    && governance.status === 'evaluated'
    && blockedChecks.length === 0

  let nextAction = '可发布当前数据集版本'
  if (governance.status === 'published' || dataset?.state === 'published') nextAction = '无需重复发布'
  else if (['failed', 'cancelled'].includes(governance.status)) nextAction = '重新执行知识加工并生成新版本'
  else if (blockedChecks.length) nextAction = governanceGateActions[blockedChecks[0].key]
  else if (governance.status === 'keyword') nextAction = '先构建正式知识'
  else if (governance.status === 'formal') nextAction = '先生成可发布索引'
  else if (governance.status === 'index') nextAction = '先完成发布评测'

  return {
    governed: true,
    statusLabel: governanceStatusLabels[governance.status] || '未知治理状态',
    canPublish,
    requiresForce: false,
    blockedChecks,
    reasonLabel: governanceReasonLabels[governance.reasonCode] || (governance.reasonCode ? `阻断原因：${governance.reasonCode}` : '等待发布前置检查'),
    nextAction,
  }
}

export function governancePublishErrorMessage(reason) {
  if (reason?.code === 'STATE_VERSION_CONFLICT') return '治理状态已变化，已刷新最新状态，请重新确认后发布。'
  if (reason?.code === 'PUBLISH_GATE_BLOCKED') return '发布已阻止：存在未通过的 P0 前置检查。'
  if (String(reason?.code || '').startsWith('ACL_')) return '当前身份无权发布该数据集，请联系管理员确认权限。'
  return reason?.message || '发布失败，请稍后重试。'
}
