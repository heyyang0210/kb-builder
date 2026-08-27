<script setup>
defineProps({
  overview: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  selectedCategory: { type: String, default: '' },
})

const emit = defineEmits(['select', 'inspect'])

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`
}
</script>

<template>
  <section class="issue-overview" aria-label="文档共性问题总览">
    <header>
      <div><h3>文档共性问题</h3><p>按当前运行的有效排除决策统计，类别集中仅表示过滤结果存在共性。</p></div>
      <span v-if="overview">排除 {{ overview.excludedTotal ?? 0 }} · 影响文档 {{ overview.affectedDocumentTotal ?? 0 }}</span>
    </header>
    <div v-if="loading" class="empty">正在加载问题总览...</div>
    <div v-else-if="!overview?.categories?.length" class="empty">当前运行暂无排除类别统计。</div>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>问题类别</th><th>排除</th><th>占比</th><th>影响文档</th><th>证据</th><th>待复核</th><th><span class="sr-only">操作</span></th></tr></thead>
        <tbody>
          <tr v-for="item in overview.categories" :key="item.id" :class="{ active: selectedCategory === item.id }" tabindex="0" @click="emit('select', item.id)" @keydown.enter="emit('select', item.id)">
            <td><strong>{{ item.label }}</strong><small>{{ item.id }}</small></td>
            <td>{{ item.keywordCount ?? 0 }}</td>
            <td>{{ percent(item.ratio) }}</td>
            <td>{{ item.documentCount ?? 0 }}</td>
            <td>{{ item.evidenceCount ?? 0 }}</td>
            <td :class="{ warn: item.missingEvidenceCount }">{{ item.missingEvidenceCount ?? 0 }}</td>
            <td><button type="button" @click.stop="emit('inspect', item.id)">查看</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.issue-overview { margin-top: 12px; border: 1px solid #cbd9e8; border-radius: 7px; overflow: hidden; background: #fff; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; background: #f5f8fb; }
h3, p { margin: 0; }
h3 { font-size: 15px; color: #26384d; }
p, header > span { margin-top: 3px; color: #66758a; font-size: 12px; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 8px 10px; border-top: 1px solid #e1e6ec; text-align: left; white-space: nowrap; }
th { color: #66758a; font-size: 12px; }
tbody tr { cursor: pointer; }
tbody tr:hover, tbody tr:focus, tbody tr.active { background: #eef6fd; outline: none; }
td:first-child { width: 100%; white-space: normal; }
td strong, td small { display: block; }
td small { margin-top: 2px; color: #7b8796; font-size: 11px; }
td.warn { color: #ad351f; font-weight: 700; }
td button { padding: 4px 9px; border: 1px solid #9eb8d1; border-radius: 5px; background: #fff; color: #1769aa; cursor: pointer; }
.empty { padding: 24px; color: #66758a; text-align: center; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
</style>
