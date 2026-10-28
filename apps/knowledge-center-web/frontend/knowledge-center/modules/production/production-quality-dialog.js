import { runHandbookQuality } from '../../common/api/handbook-production-api.js';

export function openProductionQualityDialog({ context, markdown, revisionId, editVersion, trigger }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'asset-dialog handbook-ai-dialog';
  dialog.setAttribute('aria-labelledby', 'production-quality-title');
  dialog.innerHTML = `<header class="asset-dialog-heading"><h2 id="production-quality-title">文档用例质量报告</h2><button type="button" data-quality-close>关闭</button></header>
    <p>校验基于本次已保存版本；用例执行与内容校验分别记录，结果仍需人工审核。</p>
    <label><input type="checkbox" data-quality-content> 同时检查结构、模板、表达与来源（需可用模型）</label>
    <p data-quality-status role="status" aria-live="polite"></p>
    <div data-quality-report></div>
    <div class="handbook-ai-dialog-actions"><button type="button" data-quality-run>执行用例校验</button><button type="button" data-quality-download disabled>下载完整报告</button></div>`;
  const find = name => dialog.querySelector(`[data-quality-${name}]`);
  let report = null;
  let busy = false;
  let closed = false;
  const text = (parent, tag, value) => {
    const element = document.createElement(tag);
    element.textContent = value;
    parent.append(element);
    return element;
  };
  const labels = { passed: '通过', failed: '失败', not_executed: '未执行' };
  function renderReport() {
    const root = find('report'); root.replaceChildren();
    text(root, 'p', `报告编号：${report.reportId}；修订：${report.document.revisionId || '未关联'}；正文摘要：${report.document.contentDigest}`);
    text(root, 'p', `测试环境：${report.database.environment || '未配置'}；数据库版本：${report.database.version || '未知'}`);
    if (report.contentQuality) {
      const content = report.contentQuality;
      const section = document.createElement('section'); root.append(section);
      text(section, 'h2', '内容质量检查');
      const names = { structure: '结构', template: '模板', expression: '表达', sources: '来源依据' };
      for (const check of content.checks) text(section, 'p', `${names[check.check] || check.check}：${labels[check.status] || check.status}；${check.details}`);
      for (const issue of content.issues) {
        text(section, 'p', `${issue.severity === 'blocking' ? '阻断项（需处理）' : '提示项'} · 正文 ${issue.start}～${issue.end}：${issue.message}；处理要求：${issue.requirement}`);
        text(section, 'pre', markdown.slice(issue.start, issue.end) || '此处需补充内容');
      }
      if (content.error) text(section, 'p', `内容检查未完成：${content.error.code}`);
      for (const limitation of content.limitations) text(section, 'p', limitation);
    }
    for (const item of report.cases) {
      const section = document.createElement('section'); root.append(section);
      text(section, 'h3', `${item.caseId}：${labels[item.status] || item.status}`);
      text(section, 'p', `正文位置：${item.documentStart}～${item.documentEnd}；来源：${item.source}`);
      for (const ref of item.references || []) {
        text(section, 'p', `${ref.sourceType === 'test-case-library' ? '测试用例库条目' : '引用来源'}：${ref.title || ref.locator}（${ref.locator}）；资料位置 ${ref.sourceRange.start}～${ref.sourceRange.end}；${ref.kind === 'direct_quote' ? '引用文本匹配' : '资料归纳，待核验'}；版本：${ref.sourceVersion ?? '未提供'}；拉取时间：${ref.fetchedAt || '未提供'}`);
      }
      if (!item.references?.length) text(section, 'p', '无已保存的可核验引用关联，不能认定来自测试用例库。');
      text(section, 'pre', item.sql);
      const details = document.createElement('details'); section.append(details);
      text(details, 'summary', '预期、实际结果与错误证据');
      text(details, 'pre', JSON.stringify({ expected: item.expected, actual: item.actual, comparison: item.comparison, error: item.error }, null, 2));
    }
    for (const limitation of report.limitations || []) text(root, 'p', limitation);
    const details = document.createElement('details'); root.append(details);
    text(details, 'summary', '查看质量能力执行记录');
    text(details, 'pre', JSON.stringify(report.skillInvocations, null, 2));
  }
  find('run').onclick = async () => {
    if (busy) return;
    busy = true; find('run').disabled = true; find('download').disabled = true; find('content').disabled = true;
    dialog.setAttribute('aria-busy', 'true');
    find('status').textContent = find('content').checked ? '正在校验已保存草稿的内容及用例…' : '正在校验已保存草稿中的用例…';
    try {
      const result = await runHandbookQuality(context, { markdown, revisionId, editVersion, checkContent: find('content').checked, rerunOfReportId: report?.reportId });
      if (closed) return;
      report = result; renderReport();
      const coverage = report.coverage;
      find('status').textContent = `质量报告：${report.gate === 'passed' ? '通过' : '未通过'}；通过 ${coverage.passed}，失败 ${coverage.failed}，未执行 ${coverage.notExecuted}。`;
      find('run').textContent = '重新执行并保留复测记录';
    } catch (error) {
      if (!closed) find('status').textContent = `质量检查未完成：${error.message}。草稿保留，可重试。`;
    } finally {
      busy = false;
      if (!closed) { dialog.setAttribute('aria-busy', 'false'); find('run').disabled = false; find('download').disabled = !report; find('content').disabled = false; }
    }
  };
  find('download').onclick = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${report.reportId}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  find('close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { closed = true; dialog.remove(); if (trigger?.isConnected) trigger.focus(); });
  document.body.append(dialog); dialog.showModal(); find('run').focus();
  return dialog;
}
