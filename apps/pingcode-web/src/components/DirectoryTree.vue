<script setup>
import { ref, computed } from 'vue'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen } from 'lucide-vue-next'

const props = defineProps({
  tree: { type: Object, required: true },
  selectedId: { type: String, default: null }
})

const emit = defineEmits(['select'])

const expandedIds = ref(new Set())

function toggleExpand(node) {
  if (expandedIds.value.has(node.id)) {
    expandedIds.value.delete(node.id)
  } else {
    expandedIds.value.add(node.id)
  }
}

function isExpanded(node) {
  return expandedIds.value.has(node.id)
}

function isSelected(node) {
  return props.selectedId === node.id
}

function getNodeIcon(node) {
  if (node.type === 'document') return FileText
  if (node.type === 'section') return isExpanded(node) ? FolderOpen : Folder
  return Folder
}

function hasChildren(node) {
  return node.children && node.children.length > 0
}
</script>

<template>
  <div class="directory-tree">
    <div v-if="!tree || !tree.children || tree.children.length === 0" class="empty">
      暂无文档
    </div>
    <div v-else class="tree-nodes">
      <template v-for="doc in tree.children" :key="doc.id">
        <div 
          :class="['tree-node', { selected: isSelected(doc) }]"
          @click="emit('select', doc)"
        >
          <button 
            v-if="hasChildren(doc)" 
            class="expand-btn"
            @click.stop="toggleExpand(doc)"
          >
            <component :is="isExpanded(doc) ? ChevronDown : ChevronRight" :size="14" />
          </button>
          <span v-else class="expand-placeholder"></span>
          <component :is="getNodeIcon(doc)" :size="14" class="node-icon" />
          <span class="node-label">{{ doc.name }}</span>
        </div>
        
        <div v-if="isExpanded(doc) && hasChildren(doc)" class="tree-children">
          <template v-for="section in doc.children" :key="section.id">
            <div 
              :class="['tree-node', 'level-1', { selected: isSelected(section) }]"
              @click="emit('select', section)"
            >
              <button 
                v-if="hasChildren(section)" 
                class="expand-btn"
                @click.stop="toggleExpand(section)"
              >
                <component :is="isExpanded(section) ? ChevronDown : ChevronRight" :size="14" />
              </button>
              <span v-else class="expand-placeholder"></span>
              <component :is="getNodeIcon(section)" :size="14" class="node-icon" />
              <span class="node-label">{{ section.name }}</span>
            </div>
            
            <div v-if="isExpanded(section) && hasChildren(section)" class="tree-children">
              <template v-for="subsection in section.children" :key="subsection.id">
                <div 
                  :class="['tree-node', 'level-2', { selected: isSelected(subsection) }]"
                  @click="emit('select', subsection)"
                >
                  <span class="expand-placeholder"></span>
                  <component :is="getNodeIcon(subsection)" :size="14" class="node-icon" />
                  <span class="node-label">{{ subsection.name }}</span>
                </div>
              </template>
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.directory-tree {
  font-size: 13px;
}

.empty {
  padding: 20px;
  text-align: center;
  color: #999;
}

.tree-nodes {
  padding: 8px 0;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.15s;
  gap: 6px;
}

.tree-node:hover {
  background-color: #f5f5f5;
}

.tree-node.selected {
  background-color: #e3f2fd;
  font-weight: 500;
}

.tree-node.level-1 {
  padding-left: 28px;
}

.tree-node.level-2 {
  padding-left: 44px;
}

.expand-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: #666;
}

.expand-btn:hover {
  color: #333;
}

.expand-placeholder {
  width: 16px;
  height: 16px;
}

.node-icon {
  color: #666;
  flex-shrink: 0;
}

.node-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-children {
  /* 子节点容器 */
}
</style>
