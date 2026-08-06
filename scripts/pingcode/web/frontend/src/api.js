let runtime = {}

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
