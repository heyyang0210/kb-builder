import { dataNote, panel, pendingState } from '../../common/components/ui.js';

function renderReviewPublishingLegacy({ projection }) {
  return `<div class="page-intro"><div><p class="eyebrow">候选、评论与发布</p><h2>审核与发布</h2><p class="muted">集中处理审核决定、文本评论、发布记录和外部同步状态。</p></div></div>${panel('审核队列', pendingState('审核数据暂不可用', '待审核候选、评论和发布记录将在数据可用后显示。'), dataNote(projection))}`;
}

export function renderReviewPublishing(args) {
  return renderReviewPublishingLegacy(args).replace('<p class="eyebrow">候选、评论与发布</p>', '').replace('<p class="muted">集中处理审核决定、文本评论、发布记录和外部同步状态。</p>', '');
}
