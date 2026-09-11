<script setup>
import { computed, onMounted, ref } from 'vue'
import { rawRequest } from '../api'
import { createRequestId } from '../utils/ids'

const operatorLabel = ref('')
const sessionName = ref(`本地素材上传-${formatTimestamp()}`)
const selectedFiles = ref([])
const sessions = ref([])
const session = ref(null)
const batch = ref(null)
const paused = ref(false)
const uploading = ref(false)
const loadingSessions = ref(false)
const error = ref('')
const message = ref('')
const input = ref(null)

function formatTimestamp(date = new Date()) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

async function jsonRequest(path, options = {}) {
  const response = await rawRequest(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const payload = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : null
  if (!response.ok) throw new Error(payload?.error?.message || `请求失败：HTTP ${response.status}`)
  return payload
}

async function binaryRequest(path, body, options = {}) {
  const response = await rawRequest(path, {
    ...options,
    body,
    headers: options.headers || {},
  })
  const payload = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : null
  if (!response.ok) throw new Error(payload?.error?.message || `分片上传失败：HTTP ${response.status}`)
  return payload
}

function chooseFiles(event) {
  selectedFiles.value = [...event.target.files].map(file => ({
    file,
    path: file.webkitRelativePath || file.name,
    id: null,
    received: new Set(),
    uploadedBytes: 0,
    status: '待上传',
    error: '',
  }))
  error.value = ''
  message.value = `${selectedFiles.value.length} 个文件已加入队列`
}

const totalBytes = computed(() => selectedFiles.value.reduce((sum, item) => sum + item.file.size, 0))
const uploadedBytes = computed(() => selectedFiles.value.reduce((sum, item) => sum + item.uploadedBytes, 0))
const progress = computed(() => totalBytes.value ? Math.floor(uploadedBytes.value / totalBytes.value * 100) : 0)

function formatBytes(value) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
}

async function digest(buffer) {
  if (!crypto.subtle?.digest) return null
  const result = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(result)].map(value => value.toString(16).padStart(2, '0')).join('')
}

async function uploadFile(item) {
  const chunkSize = session.value.chunkSize
  if (!item.id) {
    const registered = await jsonRequest(`/api/upload-sessions/${session.value.id}/files`, {
      method: 'POST',
      body: JSON.stringify({
        relativePath: item.path,
        size: item.file.size,
        mediaType: item.file.type || null,
      }),
    })
    item.id = registered.id
    item.received = new Set(registered.receivedChunks || [])
  }
  const chunkCount = Math.ceil(item.file.size / chunkSize)
  for (let index = 0; index < chunkCount; index += 1) {
    if (paused.value) return false
    if (item.received.has(index)) continue
    const start = index * chunkSize
    const end = Math.min(item.file.size, start + chunkSize)
    const buffer = await item.file.slice(start, end).arrayBuffer()
    const hash = await digest(buffer)
    item.status = `上传分片 ${index + 1}/${chunkCount}`
    await binaryRequest(`/api/upload-sessions/${session.value.id}/files/${item.id}/chunks/${index}`, buffer, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${start}-${end - 1}/${item.file.size}`,
        ...(hash ? { 'X-Chunk-SHA256': hash } : {}),
      },
    })
    item.received.add(index)
    item.uploadedBytes = end
  }
  await jsonRequest(`/api/upload-sessions/${session.value.id}/files/${item.id}/complete`, { method: 'POST' })
  item.uploadedBytes = item.file.size
  item.status = '已校验'
  return true
}

async function runUpload() {
  if (!selectedFiles.value.length) {
    error.value = '请先选择文件'
    return
  }
  paused.value = false
  uploading.value = true
  error.value = ''
  message.value = ''
  try {
    if (!session.value) {
      session.value = await jsonRequest('/api/upload-sessions', {
        method: 'POST',
        headers: { 'Idempotency-Key': createRequestId() },
        body: JSON.stringify({
          name: sessionName.value.trim(),
          operatorLabel: operatorLabel.value.trim(),
          totalFiles: selectedFiles.value.length,
          totalBytes: totalBytes.value,
        }),
      })
    }
    for (const item of selectedFiles.value) {
      if (item.status === '已校验') continue
      const completed = await uploadFile(item)
      if (!completed) {
        message.value = '上传已暂停，可继续上传'
        return
      }
    }
    session.value = await jsonRequest(`/api/upload-sessions/${session.value.id}/complete`, { method: 'POST' })
    message.value = '上传完成，临时素材会话已就绪'
    await loadSessions()
  } catch (reason) {
    error.value = reason.message
  } finally {
    uploading.value = false
  }
}

function pauseUpload() {
  paused.value = true
}

function resetUpload() {
  selectedFiles.value = []
  session.value = null
  batch.value = null
  paused.value = false
  message.value = ''
  error.value = ''
  if (input.value) input.value.value = ''
}

async function createBatch() {
  if (!session.value?.id) return
  try {
    batch.value = await jsonRequest(`/api/upload-sessions/${session.value.id}/create-batch`, {
      method: 'POST',
      headers: { 'Idempotency-Key': createRequestId() },
      body: JSON.stringify({ name: sessionName.value.trim() }),
    })
    session.value = { ...session.value, batchId: batch.value.id }
    message.value = '资料加工任务已创建，可进入文件清单和加工流程'
    await loadSessions()
  } catch (reason) {
    error.value = reason.message
  }
}

async function loadSessions() {
  loadingSessions.value = true
  try {
    const result = await jsonRequest('/api/upload-sessions?pageSize=20')
    sessions.value = result.items
  } catch (reason) {
    error.value = reason.message
  } finally {
    loadingSessions.value = false
  }
}

onMounted(loadSessions)
</script>

<template>
  <section>
    <div class="page-header">
      <div><h1>本地素材上传</h1><p class="muted">大文件采用分片上传，上传完成后进入临时素材区，再进入统一加工流程。</p></div>
      <button class="button secondary" :disabled="loadingSessions" @click="loadSessions">刷新会话</button>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="message" class="success-box">{{ message }}</div>

    <div class="workspace upload-workspace">
      <div class="panel">
        <h2>创建上传会话</h2>
        <div class="upload-form-grid">
          <label class="field"><span>会话名称</span><input v-model="sessionName" :disabled="uploading || !!session" /></label>
          <label class="field"><span>操作人标识</span><input v-model="operatorLabel" placeholder="例如 knowledge-team" /></label>
        </div>
        <div class="upload-dropzone" @click="input?.click()">
          <input ref="input" type="file" multiple hidden @change="chooseFiles" />
          <strong>选择多个文件</strong>
          <span>支持 Markdown、Office、PDF、压缩包和图片等原始素材</span>
        </div>
        <div v-if="selectedFiles.length" class="upload-summary">
          <span>{{ selectedFiles.length }} 个文件</span><span>{{ formatBytes(totalBytes) }}</span><span>已上传 {{ progress }}%</span>
        </div>
        <div v-if="selectedFiles.length" class="progress upload-progress"><span :style="{ width: `${progress}%` }"></span></div>
        <div class="actions upload-actions">
          <button class="button" :disabled="uploading || !selectedFiles.length" @click="runUpload">{{ paused ? '继续上传' : session ? '开始上传' : '创建并上传' }}</button>
          <button v-if="uploading" class="button secondary" @click="pauseUpload">暂停</button>
          <button class="button secondary" :disabled="uploading" @click="resetUpload">清空</button>
          <button v-if="session?.state === 'ready' && !batch" class="button secondary" :disabled="uploading" @click="createBatch">创建加工任务</button>
          <router-link v-if="batch" class="button secondary" :to="`/batches/${batch.id}/download`">查看任务</router-link>
        </div>
        <div v-if="selectedFiles.length" class="upload-file-list">
          <div v-for="item in selectedFiles" :key="item.path" class="upload-file-row">
            <div class="upload-file-name"><strong>{{ item.path }}</strong><small>{{ formatBytes(item.file.size) }}</small></div>
            <span class="badge" :class="item.status === '已校验' ? 'completed' : ''">{{ item.status }}</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <h2>临时上传会话</h2>
        <div v-if="loadingSessions" class="empty compact">正在加载会话...</div>
        <div v-else-if="!sessions.length" class="empty compact">暂无上传会话。</div>
        <div v-else class="session-list">
          <div v-for="item in sessions" :key="item.id" class="session-item">
            <strong>{{ item.name }}</strong>
            <small>{{ item.state }} · {{ item.totalFiles }} 个文件 · {{ formatBytes(item.totalBytes) }}</small>
            <small>到期：{{ new Date(item.expiresAt).toLocaleString() }}</small>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.upload-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.upload-dropzone { display: grid; gap: 6px; place-items: center; padding: 32px 20px; margin: 10px 0 14px; border: 1px dashed #7ca7df; border-radius: 8px; color: #315b8d; background: #f5f9ff; cursor: pointer; }
.upload-dropzone span { color: #718096; font-size: 12px; }
.upload-summary { display: flex; gap: 18px; margin: 10px 0 7px; color: #637086; font-size: 12px; }
.upload-progress { margin-bottom: 15px; }
.upload-actions { margin-bottom: 16px; }
.upload-file-list { max-height: 360px; overflow: auto; border-top: 1px solid #e5eaf1; }
.upload-file-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #e5eaf1; }
.upload-file-name { min-width: 0; }
.upload-file-name strong, .upload-file-name small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.upload-file-name strong { color: #35465d; font-size: 12px; }
.upload-file-name small { margin-top: 3px; color: #8591a3; font-size: 11px; }
.session-list { display: grid; gap: 9px; }
.session-item { display: grid; gap: 4px; padding: 11px; border: 1px solid #e1e7ef; border-radius: 7px; background: #fbfcfe; }
.session-item strong { overflow: hidden; color: #35465d; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.session-item small { color: #758299; font-size: 11px; }
small { color: #7a8799; font-size: 11px; }
@media (max-width: 1250px) { .upload-workspace { grid-template-columns: 1fr; } }
</style>
