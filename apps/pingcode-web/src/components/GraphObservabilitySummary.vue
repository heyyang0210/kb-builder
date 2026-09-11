<script setup>
import { computed } from 'vue'
import { AlertTriangle, CheckCircle2, Clock3, HelpCircle } from 'lucide-vue-next'

const props = defineProps({
  data: { type: Object, default: null },
  localCounts: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

const metricDefinitions = [
  { key: 'relationCoverage', label: '关系覆盖率', percent: true },
  { key: 'evidenceCompleteness', label: '证据完整率', percent: true },
  { key: 'isolatedKnowledgeRatio', label: '孤立知识比例', percent: true },
  { key: 'whyMissingRate', label: 'Why 知识缺失率', percent: true },
  { key: 'crossDocumentRelationCount', label: '跨文档关系数', percent: false }
]
const scope = computed(() => props.data?.scope || {})
const counts = computed(() => props.data?.counts || {})
const warnings = computed(() => Array.isArray(props.data?.warnings) ? props.data.warnings : [])
const overallAvailability = computed(() => scope.value.availability !== 'available'
  ? scope.value.availability
  : scope.value.sourceAvailability)
const graphSourceLabels = {
  metadata_keyword: '元数据关键词图谱',
  final_knowledge: '正式知识图谱',
}
function availabilityLabel(value) {
  return ({ available: '可用', not_applicable: '不适用', pending: '待支持', stale: '已过期', unknown: '未知' })[value] || '未知'
}
function availabilityIcon(value) {
  if (value === 'available') return CheckCircle2
  if (value === 'pending') return Clock3
  if (value === 'stale') return AlertTriangle
  return HelpCircle
}
function metricValue(definition) {
  const metric = props.data?.health?.[definition.key]
  if (!metric || metric.availability !== 'available' || metric.value === null || metric.value === undefined) return availabilityLabel(metric?.availability)
  return definition.percent ? `${Math.round(Number(metric.value) * 100)}%` : Number(metric.value).toLocaleString('zh-CN')
}
function metricBasis(definition) {
  const metric = props.data?.health?.[definition.key]
  if (!metric) return '暂无统计依据'
  if (metric.denominator === null || metric.denominator === undefined) return `统计数量 ${metric.numerator ?? 0}`
  return `统计依据 ${metric.numerator ?? 0} / ${metric.denominator ?? 0}`
}
function dateTime(value) {
  if (!value) return '未知'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}
function shortFingerprint(value) {
  if (!value) return '未知'
  return value.length > 24 ? `${value.slice(0, 18)}...${value.slice(-6)}` : value
}
</script>

<template>
  <section class="observability-summary" aria-labelledby="graph-observability-title">
    <div class="summary-heading">
      <div>
        <h3 id="graph-observability-title">图谱范围与质量概览</h3>
        <p>完整事实、当前投影与画布渲染采用独立统计口径。</p>
      </div>
      <span v-if="data" :class="['availability', overallAvailability]">
        <component :is="availabilityIcon(overallAvailability)" :size="15" />
        {{ availabilityLabel(overallAvailability) }}
      </span>
    </div>
    <div v-if="loading" class="summary-state" role="status">正在读取图谱质量概览...</div>
    <div v-else-if="error" class="summary-state error" role="alert">{{ error }}</div>
    <template v-else-if="data">
      <dl class="scope-grid">
        <div><dt>数据集</dt><dd>{{ data.datasetId || '-' }}</dd></div>
        <div><dt>过滤运行</dt><dd>{{ data.filterRunId || '未绑定' }}</dd></div>
        <div><dt>当前视图</dt><dd>{{ scope.view === 'after' ? '过滤后' : (scope.view === 'before' ? '过滤前' : '发生变化') }}</dd></div>
        <div><dt>图谱来源</dt><dd>{{ graphSourceLabels[scope.graphSource] || scope.graphSource || '未知' }}</dd></div>
        <div><dt>来源指纹</dt><dd :title="scope.sourceFingerprint">{{ shortFingerprint(scope.sourceFingerprint) }}</dd></div>
        <div><dt>指纹状态</dt><dd>{{ availabilityLabel(scope.sourceAvailability) }}</dd></div>
        <div><dt>更新时间</dt><dd>{{ dateTime(scope.updatedAt) }}</dd></div>
      </dl>
      <div class="count-grid" aria-label="图谱规模">
        <article><span>完整事实</span><strong>{{ counts.fact?.nodes ?? 0 }} 节点</strong><small>{{ counts.fact?.edges ?? 0 }} 条关系</small></article>
        <article><span>当前投影</span><strong>{{ counts.projected?.nodes ?? 0 }} 节点</strong><small>{{ counts.projected?.edges ?? 0 }} 条关系</small></article>
        <article><span>当前渲染</span><strong>{{ localCounts?.nodes?.visible ?? 0 }} / {{ localCounts?.nodes?.total ?? 0 }} 节点</strong><small>{{ localCounts?.edges?.visible ?? 0 }} / {{ localCounts?.edges?.total ?? 0 }} 条关系</small></article>
      </div>
      <div class="metric-grid" aria-label="图谱健康指标">
        <article v-for="definition in metricDefinitions" :key="definition.key">
          <span>{{ definition.label }}</span>
          <strong>{{ metricValue(definition) }}</strong>
          <small>{{ metricBasis(definition) }} · {{ availabilityLabel(data.health?.[definition.key]?.availability) }}</small>
        </article>
      </div>
      <div v-if="scope.sourceAvailability === 'stale' || warnings.length" class="warning-list" role="alert">
        <AlertTriangle :size="17" />
        <div><strong>来源状态需要关注</strong><p v-for="warning in warnings" :key="warning">{{ warning }}</p><p v-if="scope.sourceAvailability === 'stale' && !warnings.length">当前过滤运行与图谱来源不一致，请刷新或重新选择运行。</p></div>
      </div>
    </template>
    <div v-else class="summary-state">当前数据集暂无可观测性数据。</div>
  </section>
</template>

<style scoped>
.observability-summary { display: grid; gap: 12px; }
.summary-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.summary-heading h3 { margin: 0; color: #20344d; font-size: 16px; }
.summary-heading p { margin: 4px 0 0; color: #66758a; font-size: 13px; }
.availability { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 4px; background: #eef3f8; color: #526174; font-size: 12px; white-space: nowrap; }
.availability.available { background: #e9f7ef; color: #176b38; }
.availability.stale { background: #fff4df; color: #8a5300; }
.scope-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; margin: 0; border: 1px solid #dce3ec; border-radius: 6px; overflow: hidden; background: #dce3ec; }
.scope-grid div { min-width: 0; padding: 9px 10px; background: #fafbfd; }
.scope-grid dt { color: #66758a; font-size: 11px; }
.scope-grid dd { margin: 4px 0 0; overflow: hidden; color: #26384d; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.count-grid, .metric-grid { display: grid; gap: 8px; }
.count-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.metric-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.count-grid article, .metric-grid article { display: grid; gap: 4px; min-width: 0; padding: 10px; border: 1px solid #dce3ec; border-radius: 6px; background: #fff; }
.count-grid span, .metric-grid span, .count-grid small, .metric-grid small { color: #66758a; font-size: 12px; }
.count-grid strong, .metric-grid strong { color: #20344d; font-size: 18px; }
.warning-list { display: flex; align-items: flex-start; gap: 8px; padding: 10px; border: 1px solid #efcf8a; border-radius: 6px; background: #fff9eb; color: #80520b; }
.warning-list p { margin: 3px 0 0; font-size: 12px; }
.summary-state { padding: 20px; color: #66758a; text-align: center; }
.summary-state.error { color: #a12622; }
@media (max-width: 1100px) { .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .summary-heading { flex-direction: column; } .scope-grid, .count-grid, .metric-grid { grid-template-columns: 1fr; } }
</style>
