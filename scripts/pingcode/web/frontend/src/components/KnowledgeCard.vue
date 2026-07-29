<script setup>
import { Tag, FileText, TrendingUp } from 'lucide-vue-next'

const props = defineProps({
  knowledge: { type: Object, required: true },
  compact: { type: Boolean, default: false }
})

function formatConfidence(confidence) {
  if (confidence === null || confidence === undefined) return '-'
  return `${Math.round(confidence * 100)}%`
}
</script>

<template>
  <div :class="['knowledge-card', { compact }]">
    <div class="card-header">
      <FileText :size="16" class="card-icon" />
      <h3 class="card-title">{{ knowledge.title }}</h3>
    </div>
    
    <div class="card-body">
      <p class="card-summary">{{ knowledge.summary }}</p>
      
      <div v-if="!compact && knowledge.keywords && knowledge.keywords.length > 0" class="card-keywords">
        <Tag :size="12" class="keyword-icon" />
        <div class="keyword-list">
          <span v-for="keyword in knowledge.keywords" :key="keyword" class="keyword-tag">
            {{ keyword }}
          </span>
        </div>
      </div>
      
      <div v-if="!compact && knowledge.evidenceText" class="card-evidence">
        <div class="evidence-label">原文证据：</div>
        <div class="evidence-text">{{ knowledge.evidenceText }}</div>
      </div>
    </div>
    
    <div class="card-footer">
      <div class="confidence-badge" :class="{ high: knowledge.confidence >= 0.8, medium: knowledge.confidence >= 0.6 && knowledge.confidence < 0.8, low: knowledge.confidence < 0.6 }">
        <TrendingUp :size="12" />
        <span>置信度: {{ formatConfidence(knowledge.confidence) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.knowledge-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  transition: box-shadow 0.2s;
}

.knowledge-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.knowledge-card.compact {
  padding: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.card-icon {
  color: #1976d2;
  flex-shrink: 0;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 0;
  flex: 1;
}

.card-body {
  margin-bottom: 12px;
}

.card-summary {
  font-size: 14px;
  line-height: 1.6;
  color: #555;
  margin: 0 0 12px 0;
}

.card-keywords {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
}

.keyword-icon {
  color: #666;
  flex-shrink: 0;
  margin-top: 2px;
}

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.keyword-tag {
  display: inline-block;
  padding: 2px 8px;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 4px;
  font-size: 12px;
}

.card-evidence {
  background: #f9f9f9;
  border-left: 3px solid #1976d2;
  padding: 8px 12px;
  border-radius: 4px;
}

.evidence-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  font-weight: 500;
}

.evidence-text {
  font-size: 13px;
  line-height: 1.5;
  color: #555;
  font-style: italic;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
}

.confidence-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.confidence-badge.high {
  background: #e8f5e9;
  color: #2e7d32;
}

.confidence-badge.medium {
  background: #fff3e0;
  color: #f57c00;
}

.confidence-badge.low {
  background: #ffebee;
  color: #c62828;
}
</style>
