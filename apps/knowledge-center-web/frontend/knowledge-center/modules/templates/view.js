import { dataNote, panel, pendingState } from '../../common/components/ui.js';

function renderTemplatesLegacy({ projection }) {
  return `<div class="page-intro"><div><p class="eyebrow">共享模板版本</p><h2>模板管理</h2><p class="muted">集中维护模板正文、版本和适用范围，文档生产只引用已发布的模板版本。</p></div></div>${panel('模板目录', pendingState('模板数据暂不可用', '模板目录和版本将在数据可用后显示。'), dataNote(projection))}`;
}

export function renderTemplates(args) {
  return renderTemplatesLegacy(args).replace('<p class="eyebrow">共享模板版本</p>', '').replace('<p class="muted">集中维护模板正文、版本和适用范围，文档生产只引用已发布的模板版本。</p>', '');
}
