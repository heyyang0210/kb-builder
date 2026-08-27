<script setup>
import { onMounted, ref } from 'vue'
import { request, runtimeBrand } from './api'
import { materialTerms } from './material-ui'

const TERMS = materialTerms(runtimeBrand())

const status = ref({ pingcode: { session: 'not_checked' }, activeTasks: 0 })
const statusError = ref('')

async function loadStatus() {
  try {
    status.value = await request('/api/system/status')
    statusError.value = ''
  } catch (error) {
    statusError.value = error.message
  }
}

onMounted(loadStatus)
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <strong>{{ TERMS.platform }}</strong>
        <span class="subtitle">资料接入、加工、复核与发布工作台</span>
      </div>
      <div class="status-row">
        <span :class="['status-dot', statusError ? 'danger' : 'success']"></span>
        <span>{{ statusError || '后端已连接' }}</span>
        <span class="divider"></span>
        <span>PingCode：{{ status.pingcode?.session === 'connected' ? '已连接' : '待验证' }}</span>
        <span>运行任务：{{ status.activeTasks || 0 }}</span>
        <button class="button ghost small" @click="loadStatus">刷新</button>
      </div>
    </header>
    <aside class="sidebar">
      <router-link to="/workbench">工作台</router-link>
      <router-link to="/knowledge">知识点索引</router-link>
      <router-link to="/knowledge/graph">知识图谱</router-link>
    </aside>
    <main class="content"><router-view /></main>
  </div>
</template>
