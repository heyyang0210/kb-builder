<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  keyword: { type: String, default: '' },
  includeRules: { type: Array, default: () => [] },
  excludeRules: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:includeRules', 'update:excludeRules'])
const scrollTop = ref(0)
const rowHeight = 42
const viewportHeight = 560

const rows = computed(() => {
  const query = props.keyword.trim().toLowerCase()
  return query
    ? props.items.filter(item => item.name.toLowerCase().includes(query))
    : props.items
})
const start = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight) - 5))
const end = computed(() => Math.min(rows.value.length, start.value + Math.ceil(viewportHeight / rowHeight) + 10))
const visibleRows = computed(() => rows.value.slice(start.value, end.value))

function checked(nodeId) {
  return props.includeRules.some(rule => rule.nodeId === nodeId)
    && !props.excludeRules.some(rule => rule.nodeId === nodeId)
}

function toggle(nodeId) {
  const includes = props.includeRules.filter(rule => rule.nodeId !== nodeId)
  if (!checked(nodeId)) includes.push({ nodeId, scope: 'self' })
  emit('update:includeRules', includes)
  emit('update:excludeRules', props.excludeRules.filter(rule => rule.nodeId !== nodeId))
}
</script>

<template>
  <div class="page-list" :style="{ height: `${viewportHeight}px` }" @scroll="scrollTop = $event.target.scrollTop">
    <div :style="{ height: `${rows.length * rowHeight}px`, position: 'relative' }">
      <label
        v-for="(node, index) in visibleRows"
        :key="node.id"
        class="page-row"
        :style="{ top: `${(start + index) * rowHeight}px` }"
      >
        <input type="checkbox" :checked="checked(node.id)" @change="toggle(node.id)" />
        <span class="page-name" :title="node.breadcrumb?.join(' / ') || node.name">{{ node.name }}</span>
        <span class="page-path">{{ node.breadcrumb?.slice(0, -1).join(' / ') }}</span>
        <span v-if="node.attachmentCount" class="page-count">{{ node.attachmentCount }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.page-list { overflow: auto; border: 1px solid #dde4ee; border-radius: 8px; }
.page-row { position: absolute; left: 0; right: 0; display: grid; grid-template-columns: 20px minmax(160px, .8fr) minmax(220px, 1.2fr) 42px; align-items: center; gap: 9px; height: 42px; padding: 0 12px; border-bottom: 1px solid #f0f2f6; font-size: 13px; }
.page-row:hover { background: #f5f8fd; }
.page-name, .page-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-path { color: #7a8799; font-size: 12px; }
.page-count { color: #53647a; text-align: right; }
</style>
