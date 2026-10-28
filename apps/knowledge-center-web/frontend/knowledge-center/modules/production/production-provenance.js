import { escapeHtml } from '../../common/utils/dom.js';

const kinds = { direct_quote: '直接引用', source_summary: '依据资料归纳', model_inference: '模型推理', human_edit: '人工修改' };
const states = { text_matched: '文本对应，事实仍待核验', unverified: '待核验', needs_revalidation: '需要重新核验' };

export function renderProductionProvenance(metadata, markdown, title = '内容依据与生成记录') {
  if (!metadata) return '';
  const sources = metadata.sourceSnapshots || [];
  const entries = (metadata.provenance || []).map(item => {
    const refs = (item.evidence || []).map(ref => {
      const source = sources.find(source => source.sourceId === ref.sourceId);
      if (!source) return '<p>引用快照缺失，需要重新核验。</p>';
      return `<details><summary>${escapeHtml(source.title || source.locator)} · 原文位置 ${ref.start}–${ref.end}</summary><p>${escapeHtml(source.locator)} · ${escapeHtml(source.sourceVersion == null ? `拉取于 ${source.fetchedAt}` : `版本 ${source.sourceVersion} · 拉取于 ${source.fetchedAt}`)}</p><pre>${escapeHtml(source.content.slice(ref.start, ref.end))}</pre></details>`;
    }).join('');
    return `<li><strong>${escapeHtml(kinds[item.kind] || '未知类型')}</strong> · ${escapeHtml(states[item.verification] || '待核验')} · 正文位置 ${item.start}–${item.end}<pre>${escapeHtml(markdown.slice(item.start, item.end))}</pre>${refs || '<p>无可核验来源关联。</p>'}${item.issue ? '<p>来源声明未通过核验，已按推理记录。</p>' : ''}</li>`;
  }).join('');
  return `<details class="handbook-provenance" data-ai-provenance><summary>${escapeHtml(title)}</summary><p>任务 ${escapeHtml(metadata.taskId || '')} · ${escapeHtml(metadata.model || '模型未记录')} · ${escapeHtml(metadata.generatedAt || '')}</p><p>${metadata.verification === 'needs_revalidation' ? '正文已变化，旧质量与测试结论需重新核验。' : '来源关联与文本匹配不代表事实审核或测试通过。'}</p><ol>${entries}</ol><p>保留历史记录 ${(metadata.provenanceHistory || []).length} 份。</p></details>`;
}
