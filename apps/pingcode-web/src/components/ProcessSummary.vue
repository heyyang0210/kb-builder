<script setup>
import { computed } from 'vue'
import { processState, stageLabel } from '../material-ui'

const props = defineProps({ summary: { type: Object, required: true }, compact: Boolean })
const state = computed(() => processState(props.summary.state))
</script>

<template>
  <div class="process-summary" :class="{ compact }">
    <div class="process-summary-line"><span :class="['status-tag', state.tone]">{{ state.label }}</span><strong>{{ stageLabel(summary.stage) }}</strong></div>
    <div v-if="summary.percent !== null && summary.percent !== undefined" class="process-progress"><span :style="{ width: `${summary.percent}%` }"></span></div>
    <small v-if="summary.blockingReason" class="danger-text">{{ summary.blockingReason }}</small>
    <small v-else-if="summary.percent !== null && summary.percent !== undefined">{{ summary.percent }}% · {{ summary.completedSteps }}/{{ summary.totalSteps }} 步</small>
  </div>
</template>
