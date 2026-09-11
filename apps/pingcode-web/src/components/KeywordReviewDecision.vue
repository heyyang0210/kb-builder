<script setup>
import { computed } from 'vue'

const props = defineProps({
  item: { type: Object, required: true },
  categories: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
})

const emit = defineEmits(['change'])

const modelAction = computed(() => props.item.modelAction || props.item.suggestedAction)
const modelCategory = computed(() => props.item.modelIssueCategoryLabel || props.item.modelIssueCategory || '无')
const currentAction = computed(() => props.item.userAction || modelAction.value)
const isOther = computed(() => currentAction.value === 'exclude' && props.item.issueCategory === 'other')

function setAction(action) {
  if (props.disabled || action === currentAction.value) return
  emit('change', {
    action,
    issueCategory: action === 'keep' ? null : '',
    issueCategoryLabel: action === 'keep' ? '无' : '',
    note: props.item.reviewNote || '',
  })
}

function setCategory(event) {
  const issueCategory = event.target.value
  const option = props.categories.find(item => item.id === issueCategory)
  emit('change', {
    action: 'exclude',
    issueCategory,
    issueCategoryLabel: option?.label || '',
    note: props.item.reviewNote || '',
  })
}

function setNote(event) {
  emit('change', {
    action: currentAction.value,
    issueCategory: currentAction.value === 'exclude' ? props.item.issueCategory : null,
    issueCategoryLabel: currentAction.value === 'exclude' ? props.item.issueCategoryLabel : '无',
    note: event.target.value.slice(0, 500),
  })
}
</script>

<template>
  <article :class="['review-decision', { invalid, disabled }]">
    <div class="keyword-block">
      <strong>{{ item.keywordName }}</strong>
      <small>{{ item.keywordId }}</small>
    </div>

    <div class="model-block">
      <span>模型建议</span>
      <strong>{{ modelAction === 'exclude' ? '排除' : '保留' }}<template v-if="modelAction === 'exclude'"> · {{ modelCategory }}</template></strong>
      <p>{{ item.modelReason || item.reason || '-' }}</p>
    </div>

    <fieldset class="action-control" :disabled="disabled">
      <legend>最终决策</legend>
      <div class="segments">
        <button type="button" :class="{ active: currentAction === 'keep' }" :aria-pressed="currentAction === 'keep'" @click="setAction('keep')">保留</button>
        <button type="button" :class="{ active: currentAction === 'exclude' }" :aria-pressed="currentAction === 'exclude'" @click="setAction('exclude')">排除</button>
      </div>
    </fieldset>

    <label class="category-control">
      <span>问题类别 <em v-if="currentAction === 'exclude'">必填</em></span>
      <select :value="currentAction === 'exclude' ? item.issueCategory || '' : ''" :disabled="disabled || currentAction !== 'exclude'" @change="setCategory">
        <option value="">请选择问题类别</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.label }}</option>
      </select>
      <small v-if="currentAction === 'exclude' && !item.issueCategory" class="validation">排除项必须选择问题类别</small>
      <small v-else-if="isOther" class="validation">其他/未分类需要填写人工备注</small>
    </label>

    <label class="note-control">
      <span>人工备注 <em v-if="isOther">必填</em></span>
      <textarea :value="item.reviewNote || ''" rows="2" maxlength="500" :disabled="disabled" placeholder="说明人工调整依据" @input="setNote"></textarea>
      <small>{{ (item.reviewNote || '').length }}/500 <template v-if="saving"> · 保存中...</template></small>
    </label>
  </article>
</template>

<style scoped>
.review-decision { display: grid; grid-template-columns: minmax(140px, 220px) minmax(210px, 1.4fr) minmax(130px, 170px) minmax(170px, 220px) minmax(220px, 1fr); align-items: start; gap: 12px; padding: 12px; border: 1px solid #dce3ec; border-radius: 7px; background: #fff; }
.review-decision.invalid { border-color: #d46552; background: #fffaf9; }
.review-decision.disabled { background: #f7f8fa; }
.keyword-block, .model-block, .category-control, .note-control { min-width: 0; display: grid; gap: 5px; }
.keyword-block small, .model-block span, .category-control > span, .note-control > span, .note-control small { color: #66758a; font-size: 12px; }
.keyword-block strong { overflow-wrap: anywhere; color: #26384d; }
.model-block p { margin: 0; color: #5f6d7d; font-size: 12px; line-height: 1.45; }
.action-control { min-width: 0; margin: 0; padding: 0; border: 0; }
.action-control legend { margin-bottom: 5px; color: #66758a; font-size: 12px; }
.segments { display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; border: 1px solid #b9c5d3; border-radius: 6px; }
.segments button { min-height: 36px; border: 0; border-right: 1px solid #b9c5d3; background: #fff; color: #40536a; cursor: pointer; }
.segments button:last-child { border-right: 0; }
.segments button.active { background: #1769aa; color: #fff; font-weight: 700; }
.segments button:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid rgba(23, 105, 170, .28); outline-offset: 1px; }
select, textarea { width: 100%; box-sizing: border-box; padding: 7px 8px; border: 1px solid #b9c5d3; border-radius: 5px; background: #fff; color: #26384d; font: inherit; }
textarea { resize: vertical; line-height: 1.4; }
em { color: #ad351f; font-size: 11px; font-style: normal; }
.validation { color: #ad351f; font-size: 11px; }
@media (max-width: 1100px) {
  .review-decision { grid-template-columns: 1fr 1fr; }
  .model-block, .note-control { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  .review-decision { grid-template-columns: 1fr; }
  .model-block, .note-control { grid-column: auto; }
}
</style>
