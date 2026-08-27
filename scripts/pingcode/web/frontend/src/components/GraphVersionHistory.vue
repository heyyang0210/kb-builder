<script setup>
import { computed } from 'vue'
import { AlertTriangle, CheckCircle2, GitCompareArrows } from 'lucide-vue-next'
import PaginationControls from './PaginationControls.vue'

const props = defineProps({
  versions: { type: Array, default: () => [] },
  comparisonVersions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  total: { type: Number, default: 0 },
  leftVersionId: { type: String, default: '' },
  rightVersionId: { type: String, default: '' },
})
const emit = defineEmits(['select-left', 'select-right', 'page-change', 'open-version'])

const availableVersions = computed(() => (props.comparisonVersions.length ? props.comparisonVersions : props.versions).filter(item => item.integrity !== 'corrupted'))

function dateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function shortId(value) {
  if (!value) return '-'
  return value.length > 24 ? `${value.slice(0, 14)}...${value.slice(-7)}` : value
}
</script>

<template>
  <section class="version-history panel-band" aria-labelledby="version-history-title">
    <header class="band-header">
      <div>
        <h2 id="version-history-title">版本历史</h2>
        <p>正式发布快照只读保留，可选择两个版本按稳定 ID 对比。</p>
      </div>
      <span class="record-count">{{ total }} 个版本</span>
    </header>

    <div class="compare-selector" aria-label="版本对比选择">
      <GitCompareArrows :size="18" />
      <label>
        基准版本
        <select :value="leftVersionId" @change="emit('select-left', $event.target.value)">
          <option value="">请选择</option>
          <option v-for="item in availableVersions" :key="`left-${item.graphVersionId}`" :value="item.graphVersionId">
            {{ shortId(item.graphVersionId) }} · {{ dateTime(item.createdAt) }}
          </option>
        </select>
      </label>
      <span class="compare-arrow">→</span>
      <label>
        目标版本
        <select :value="rightVersionId" @change="emit('select-right', $event.target.value)">
          <option value="">请选择</option>
          <option v-for="item in availableVersions" :key="`right-${item.graphVersionId}`" :value="item.graphVersionId">
            {{ shortId(item.graphVersionId) }} · {{ dateTime(item.createdAt) }}
          </option>
        </select>
      </label>
    </div>

    <div v-if="loading" class="component-state">正在读取正式版本...</div>
    <div v-else-if="!versions.length" class="component-state">当前数据集尚无正式图谱版本。</div>
    <div v-else class="history-table-wrap">
      <table class="history-table">
        <thead><tr><th>正式版本</th><th>发布时间</th><th>规模</th><th>规则</th><th>发布检查</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="item in versions" :key="item.graphVersionId" :class="{ corrupted: item.integrity === 'corrupted' }">
            <td>
              <strong :title="item.graphVersionId">{{ shortId(item.graphVersionId) }}</strong>
              <span v-if="item.isCurrent" class="current-tag">当前正式版</span>
              <small>{{ item.graphSource === 'final_knowledge' ? '正式知识图谱' : (item.graphSource || '来源未知') }}</small>
            </td>
            <td>{{ dateTime(item.createdAt) }}</td>
            <td>{{ item.nodeCount ?? '-' }} 节点<br><small>{{ item.edgeCount ?? '-' }} 条关系</small></td>
            <td>{{ item.rulesVersion || '-' }}</td>
            <td>
              <span v-if="item.integrity === 'corrupted'" class="check-state danger"><AlertTriangle :size="14" />版本损坏</span>
              <span v-else-if="item.warningCount" class="check-state warning"><AlertTriangle :size="14" />{{ item.warningCount }} 项警告</span>
              <span v-else class="check-state success"><CheckCircle2 :size="14" />检查通过</span>
            </td>
            <td><button class="text-button" type="button" :disabled="item.integrity === 'corrupted'" @click="emit('open-version', item.graphVersionId)">查看版本</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <PaginationControls v-if="total > pageSize" :page="page" :page-size="pageSize" :total="total" @change="emit('page-change', $event)" />
  </section>
</template>

<style scoped>
.panel-band { min-width: 0; overflow: hidden; border: 1px solid #dce4ef; border-radius: 8px; background: #fff; }
.band-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px 18px; border-bottom: 1px solid #e5eaf1; }
.band-header h2 { margin: 0; font-size: 16px; }
.band-header p { margin: 5px 0 0; color: #6d7b90; font-size: 12px; }
.record-count { color: #175cd3; font-size: 13px; font-weight: 600; white-space: nowrap; }
.compare-selector { display: grid; grid-template-columns: auto minmax(180px, 1fr) auto minmax(180px, 1fr); align-items: end; gap: 10px; padding: 13px 18px; background: #f8fafc; border-bottom: 1px solid #e5eaf1; }
.compare-selector > svg { align-self: center; color: #526174; }
.compare-selector label { display: grid; gap: 5px; color: #637086; font-size: 12px; }
.compare-selector select { min-width: 0; width: 100%; padding: 8px 10px; border: 1px solid #ccd6e3; border-radius: 6px; background: #fff; color: #172033; }
.compare-arrow { align-self: center; color: #8a98aa; }
.history-table-wrap { overflow-x: auto; }
.history-table { width: 100%; border-collapse: collapse; }
.history-table th, .history-table td { padding: 11px 13px; border-bottom: 1px solid #e9edf3; text-align: left; vertical-align: middle; font-size: 12px; }
.history-table th { color: #637086; background: #fafbfd; white-space: nowrap; }
.history-table td:first-child { min-width: 185px; }
.history-table strong, .history-table small { display: block; }
.history-table small { margin-top: 3px; color: #7a8799; }
.history-table tr.corrupted { background: #fff8f7; }
.current-tag { display: inline-flex; margin: 0 0 0 7px; padding: 2px 5px; border-radius: 4px; color: #175cd3; background: #eaf2ff; font-size: 10px; }
.check-state { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.check-state.success { color: #147a43; }
.check-state.warning { color: #9b6108; }
.check-state.danger { color: #b42318; }
.component-state { padding: 32px 18px; color: #6d7b90; text-align: center; }
.text-button:disabled { color: #9aa4b2; cursor: not-allowed; text-decoration: none; }
@media (max-width: 700px) {
  .band-header { flex-direction: column; }
  .compare-selector { grid-template-columns: 1fr; align-items: stretch; }
  .compare-selector > svg, .compare-arrow { display: none; }
}
</style>
