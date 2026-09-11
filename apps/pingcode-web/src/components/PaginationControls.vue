<script setup>
import { computed } from 'vue'

const props = defineProps({
  page: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  total: { type: Number, required: true },
})
const emit = defineEmits(['change'])

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

function go(page) {
  const nextPage = Math.min(Math.max(1, page), pageCount.value)
  if (nextPage !== props.page) emit('change', { page: nextPage, pageSize: props.pageSize })
}

function resize(event) {
  emit('change', { page: 1, pageSize: Number(event.target.value) })
}
</script>

<template>
  <div class="pagination" aria-label="分页">
    <span>共 {{ total }} 条</span>
    <label>每页
      <select :value="pageSize" @change="resize">
        <option :value="20">20</option>
        <option :value="50">50</option>
        <option :value="100">100</option>
      </select>
    </label>
    <button class="button secondary small" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
    <span>{{ page }} / {{ pageCount }}</span>
    <button class="button secondary small" :disabled="page >= pageCount" @click="go(page + 1)">下一页</button>
  </div>
</template>

<style scoped>
.pagination { display: flex; align-items: center; justify-content: flex-end; gap: 10px; min-height: 52px; padding: 9px 14px; color: #637086; font-size: 13px; }
.pagination label { display: flex; align-items: center; gap: 6px; }
.pagination select { padding: 5px 24px 5px 8px; border: 1px solid #ccd6e3; border-radius: 5px; background: white; }
</style>
