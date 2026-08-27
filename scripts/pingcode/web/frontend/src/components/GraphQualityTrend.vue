<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { AlertTriangle, TrendingUp } from 'lucide-vue-next'

const props = defineProps({
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const chartRef = ref(null)
const metric = ref('relationCoverage')
let chart = null
let resizeObserver = null

const metricDefinitions = {
  relationCoverage: { label: '关系覆盖率', percent: true, inverse: false },
  evidenceCompleteness: { label: '证据完整率', percent: true, inverse: false },
  isolatedKnowledgeRatio: { label: '孤立知识比例', percent: true, inverse: true },
  whyMissingRate: { label: 'Why 知识缺失率', percent: true, inverse: true },
  crossDocumentRelationCount: { label: '跨文档关系数', percent: false, inverse: false },
}
const items = computed(() => Array.isArray(props.data?.items) ? props.data.items : [])
const segments = computed(() => {
  const grouped = new Map()
  for (const item of items.value) {
    const key = `${item.rulesSegment ?? 0}:${item.rulesVersion || '未知规则'}`
    if (!grouped.has(key)) grouped.set(key, { key, rulesVersion: item.rulesVersion || '未知规则', items: [] })
    grouped.get(key).items.push(item)
  }
  return [...grouped.values()]
})
const hasRuleChanges = computed(() => items.value.some(item => item.rulesChanged))

function metricValue(item) {
  const value = item.health?.[metric.value]
  return typeof value === 'object' ? value?.value : value
}

function dateLabel(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value || '-') : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function dispose() {
  chart?.dispose()
  chart = null
}

function renderChart() {
  if (!chartRef.value || props.loading || props.error || !items.value.length) {
    dispose()
    return
  }
  dispose()
  chart = echarts.init(chartRef.value)
  const definition = metricDefinitions[metric.value]
  const xValues = items.value.map((item, index) => `${index + 1}\n${dateLabel(item.createdAt)}`)
  chart.setOption({
    animationDuration: 220,
    grid: { left: 48, right: 20, top: 28, bottom: 50 },
    tooltip: {
      trigger: 'axis',
      formatter(params) {
        const point = params.find(item => item.value !== null && item.value !== undefined)
        if (!point) return '该版本无可用指标'
        const source = items.value[point.dataIndex]
        const value = definition.percent ? `${Math.round(Number(point.value) * 100)}%` : Number(point.value).toLocaleString('zh-CN')
        return `<strong>${definition.label}：${value}</strong><br/>规则：${source.rulesVersion || '未知'}<br/>版本：${source.graphVersionId || '-'}`
      },
    },
    xAxis: { type: 'category', data: xValues, axisLabel: { color: '#6d7b90', fontSize: 10 }, axisTick: { alignWithLabel: true } },
    yAxis: {
      type: 'value', min: definition.percent ? 0 : undefined, max: definition.percent ? 1 : undefined,
      axisLabel: { color: '#6d7b90', formatter: value => definition.percent ? `${Math.round(value * 100)}%` : value },
      splitLine: { lineStyle: { color: '#edf0f4' } },
    },
    series: segments.value.map((segment, segmentIndex) => ({
      name: segment.rulesVersion,
      type: 'line',
      connectNulls: false,
      symbolSize: 7,
      lineStyle: { width: 2 },
      itemStyle: { color: ['#175cd3', '#147a43', '#9b6108', '#7a5af8'][segmentIndex % 4] },
      data: items.value.map(item => `${item.rulesSegment ?? 0}:${item.rulesVersion || '未知规则'}` === segment.key ? metricValue(item) : null),
    })),
  })
}

watch(() => [props.data, props.loading, props.error, metric.value], async () => { await nextTick(); renderChart() }, { deep: true })
onMounted(() => {
  renderChart()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => chart?.resize())
    if (chartRef.value) resizeObserver.observe(chartRef.value)
  }
})
onUnmounted(() => { resizeObserver?.disconnect(); dispose() })
</script>

<template>
  <section class="quality-trend panel-band" aria-labelledby="quality-trend-title">
    <header class="band-header">
      <div><h2 id="quality-trend-title">质量趋势</h2><p>指标读取发布时快照，规则变化后以新分段展示。</p></div>
      <TrendingUp :size="20" />
    </header>
    <div class="trend-toolbar">
      <label>趋势指标
        <select v-model="metric">
          <option v-for="(definition, key) in metricDefinitions" :key="key" :value="key">{{ definition.label }}</option>
        </select>
      </label>
      <div class="rule-legend" aria-label="规则版本分段">
        <span v-for="(segment, index) in segments" :key="segment.key"><i :class="`color-${index % 4}`"></i>{{ segment.rulesVersion }}（{{ segment.items.length }} 版）</span>
      </div>
    </div>
    <div v-if="hasRuleChanges" class="rules-warning" role="alert"><AlertTriangle :size="16" /><span>检测到规则版本变化，折线已断开分段；跨分段数据仅供参考，不代表同一统计口径。</span></div>
    <div v-if="loading" class="component-state">正在读取质量趋势...</div>
    <div v-else-if="error" class="component-state error-state" role="alert">{{ error }}</div>
    <div v-else-if="!items.length" class="component-state">当前数据集尚无历史质量快照。</div>
    <div v-else ref="chartRef" class="trend-chart" role="img" :aria-label="`${metricDefinitions[metric].label}分段趋势图`"></div>
  </section>
</template>

<style scoped>
.panel-band { min-width: 0; overflow: hidden; border: 1px solid #dce4ef; border-radius: 8px; background: #fff; }
.band-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px 18px; border-bottom: 1px solid #e5eaf1; }
.band-header h2 { margin: 0; font-size: 16px; }
.band-header p { margin: 5px 0 0; color: #6d7b90; font-size: 12px; }
.band-header svg { color: #526174; }
.trend-toolbar { display: flex; align-items: end; justify-content: space-between; gap: 16px; padding: 12px 18px; background: #f8fafc; border-bottom: 1px solid #e5eaf1; }
.trend-toolbar label { display: grid; gap: 5px; flex: 0 0 190px; color: #637086; font-size: 12px; }
.trend-toolbar select { padding: 8px 10px; border: 1px solid #ccd6e3; border-radius: 6px; background: #fff; }
.rule-legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px 12px; color: #637086; font-size: 11px; }
.rule-legend span { display: inline-flex; align-items: center; gap: 5px; }
.rule-legend i { width: 14px; height: 3px; border-radius: 2px; background: #175cd3; }
.rule-legend i.color-1 { background: #147a43; }
.rule-legend i.color-2 { background: #9b6108; }
.rule-legend i.color-3 { background: #7a5af8; }
.rules-warning { display: flex; align-items: flex-start; gap: 8px; margin: 12px 18px 0; padding: 10px; border: 1px solid #efcf8a; border-radius: 6px; color: #80520b; background: #fff9eb; font-size: 12px; }
.trend-chart { width: 100%; height: 310px; }
.component-state { display: grid; min-height: 220px; place-items: center; padding: 24px; color: #6d7b90; text-align: center; }
.error-state { color: #a61d24; }
@media (max-width: 700px) {
  .trend-toolbar { align-items: stretch; flex-direction: column; }
  .trend-toolbar label { flex-basis: auto; width: 100%; }
  .rule-legend { justify-content: flex-start; }
  .trend-chart { height: 280px; }
}
</style>
