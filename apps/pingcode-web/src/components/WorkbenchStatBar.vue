<script setup>
defineProps({ items: { type: Array, required: true }, active: { type: String, default: '' } })
defineEmits(['select'])
</script>

<template>
  <nav class="workbench-stat-bar" aria-label="资料加工状态统计">
    <button v-for="item in items" :key="item.key" :class="{ active: active === item.key }" @click="$emit('select', item.key)">
      <span>{{ item.label }}</span><strong>{{ item.count }}</strong>
    </button>
  </nav>
</template>
