<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  includeRules: { type: Array, default: () => [] },
  excludeRules: { type: Array, default: () => [] },
  keyword: { type: String, default: '' },
})
const emit = defineEmits(['update:includeRules', 'update:excludeRules'])

const expanded = ref(new Set())
const scrollTop = ref(0)
const rowHeight = 38
const viewportHeight = 560

const parentMap = computed(() => {
  const map = new Map()
  function visit(nodes, ancestors = []) {
    for (const node of nodes) {
      map.set(node.id, ancestors)
      visit(node.children || [], [...ancestors, node.id])
    }
  }
  visit(props.items)
  return map
})

const matchingNodeIds = computed(() => {
  const query = props.keyword.trim().toLowerCase()
  if (!query) return null
  const matches = new Set()
  function visit(nodes) {
    let subtreeMatches = false
    for (const node of nodes) {
      const childMatches = visit(node.children || [])
      const selfMatches = node.name.toLowerCase().includes(query)
      if (selfMatches || childMatches) matches.add(node.id)
      subtreeMatches ||= selfMatches || childMatches
    }
    return subtreeMatches
  }
  visit(props.items)
  return matches
})

const rows = computed(() => {
  const result = []
  const query = props.keyword.trim().toLowerCase()
  function visit(nodes, depth = 0) {
    for (const node of nodes) {
      const matches = !query || matchingNodeIds.value.has(node.id)
      if (matches) result.push({ node, depth })
      if ((expanded.value.has(node.id) || query) && node.children?.length) visit(node.children, depth + 1)
    }
  }
  visit(props.items)
  return result
})

const start = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight) - 5))
const end = computed(() => Math.min(rows.value.length, start.value + Math.ceil(viewportHeight / rowHeight) + 10))
const visibleRows = computed(() => rows.value.slice(start.value, end.value))

function coveredBy(rules, nodeId) {
  const ancestors = parentMap.value.get(nodeId) || []
  return rules.some(rule => rule.nodeId === nodeId || (rule.scope === 'subtree' && ancestors.includes(rule.nodeId)))
}

function checked(nodeId) {
  return coveredBy(props.includeRules, nodeId) && !coveredBy(props.excludeRules, nodeId)
}

function toggleSelection(nodeId) {
  const directInclude = props.includeRules.find(rule => rule.nodeId === nodeId)
  const directExclude = props.excludeRules.find(rule => rule.nodeId === nodeId)
  let includes = [...props.includeRules]
  let excludes = [...props.excludeRules]
  if (directExclude) {
    excludes = excludes.filter(rule => rule !== directExclude)
  } else if (directInclude) {
    includes = includes.filter(rule => rule !== directInclude)
  } else if (checked(nodeId)) {
    excludes.push({ nodeId, scope: 'subtree' })
  } else {
    includes.push({ nodeId, scope: 'subtree' })
  }
  emit('update:includeRules', includes)
  emit('update:excludeRules', excludes)
}

function toggleExpanded(nodeId) {
  const next = new Set(expanded.value)
  next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId)
  expanded.value = next
}
</script>

<template>
  <div class="tree" :style="{ height: `${viewportHeight}px` }" @scroll="scrollTop = $event.target.scrollTop">
    <div :style="{ height: `${rows.length * rowHeight}px`, position: 'relative' }">
      <div
        v-for="({ node, depth }, index) in visibleRows"
        :key="node.id"
        class="tree-row"
        :style="{ top: `${(start + index) * rowHeight}px`, paddingLeft: `${12 + depth * 22}px` }"
      >
        <button v-if="node.children?.length" class="tree-toggle" @click="toggleExpanded(node.id)">
          {{ expanded.has(node.id) ? '▾' : '▸' }}
        </button>
        <span v-else class="tree-toggle"></span>
        <input type="checkbox" :checked="checked(node.id)" @change="toggleSelection(node.id)" />
        <span class="node-icon" aria-hidden="true">{{ node.emojiIcon || (node.hasChildren ? '▣' : '▤') }}</span>
        <span class="tree-name" :title="node.name">{{ node.name }}</span>
        <span v-if="node.attachmentCount" class="tree-count">{{ node.attachmentCount }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree { overflow: auto; border: 1px solid #dde4ee; border-radius: 8px; }
.tree-row { position: absolute; left: 0; right: 0; height: 38px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f0f2f6; font-size: 13px; }
.tree-row:hover { background: #f5f8fd; }
.tree-toggle { width: 20px; padding: 0; border: 0; color: #607189; background: transparent; }
.node-icon { width: 18px; color: #607189; text-align: center; }
.tree-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-count { margin-left: auto; margin-right: 12px; min-width: 24px; padding: 2px 6px; border-radius: 999px; color: #4f6078; background: #edf1f6; text-align: center; font-size: 11px; }
</style>
