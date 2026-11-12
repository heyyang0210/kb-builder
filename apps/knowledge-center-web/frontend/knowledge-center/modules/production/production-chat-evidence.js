import { loadHandbookAI, deleteHandbookAIHistory, saveHandbookAIFeedback } from '../../common/api/handbook-production-api.js';
import { uiIcon } from '../../common/ui-system.js';

const ICONS = {
  copy: uiIcon('action.copy'),
  good: uiIcon('feedback.positive'),
  bad: uiIcon('feedback.negative'),
  more: uiIcon('action.more'),
  link: uiIcon('action.references'),
};
const operationNames = { generate: '文档生成', polish: '内容修订', continue: '内容续写', rewrite: '内容修订', update: '内容修订' };
const statusNames = { queued: '等待执行', running: '生成中', completed: '候选已生成', failed: '生成失败', cancelled: '已中断', interrupted: '已中断' };

function evidenceFor(job) {
  const sources = new Map((job.metadata?.sourceSnapshots || job.sourceSnapshots || []).map(source => [String(source.sourceId), source]));
  const entries = [];
  for (const segment of job.metadata?.provenance || []) for (const ref of segment.evidence || []) {
    const source = sources.get(String(ref.sourceId));
    if (!source || !Number.isInteger(ref.start) || !Number.isInteger(ref.end) || ref.start < 0 || ref.end <= ref.start || ref.end > String(source.content || '').length) continue;
    entries.push({ source, ref, generated: String(job.candidateMarkdown || job.fragment || '').slice(segment.start, segment.end) });
  }
  return entries;
}

export function createAIConversationTools({ host, conversation, context, getCurrentJob, openHistory, onDeleted, notify }) {
  const drawer = document.createElement('aside'); drawer.className = 'handbook-ai-evidence-drawer'; drawer.hidden = true;
  drawer.setAttribute('aria-label', '实际引用来源'); drawer.innerHTML = '<header><strong>引用来源 <span data-evidence-count></span></strong><button type="button" aria-label="关闭引用来源" data-evidence-close>×</button></header><p>只展示本次候选实际使用、可定位的资料原文。</p><div data-evidence-list></div>';
  host.append(drawer);
  drawer.querySelector('[data-evidence-close]').onclick = () => { drawer.hidden = true; host.classList.remove('has-evidence-drawer'); };
  const feedback = document.createElement('dialog'); feedback.className = 'handbook-ai-feedback-dialog';
  feedback.innerHTML = '<h3>意见反馈</h3><p>请说明这次结果哪里需要改进。反馈不会改变文档内容。</p><textarea maxlength="1000" rows="5" aria-label="反馈内容" placeholder="例如：哪一处引用不准确？"></textarea><footer><button type="button" data-feedback-cancel>取消</button><button type="button" data-feedback-submit>提交反馈</button></footer>';
  host.append(feedback);
  feedback.querySelector('[data-feedback-cancel]').onclick = () => feedback.close();
  let feedbackJobId = null;
  feedback.querySelector('[data-feedback-submit]').onclick = async () => {
    const comment = feedback.querySelector('textarea').value.trim();
    if (!comment) { notify('请先填写反馈内容'); return; }
    try { await saveHandbookAIFeedback(context, feedbackJobId, { comment }); feedback.close(); notify('意见反馈已提交'); }
    catch (error) { notify(`反馈提交失败：${error.message}`); }
  };
  const confirm = document.createElement('dialog'); confirm.className = 'handbook-ai-feedback-dialog';
  confirm.innerHTML = '<h3>删除这条对话？</h3><p>已保存的文档内容不会改变，删除后无法从对话中再次打开本次候选。</p><footer><button type="button" data-delete-cancel>取消</button><button type="button" data-delete-confirm>删除对话</button></footer>';
  host.append(confirm);
  confirm.querySelector('[data-delete-cancel]').onclick = () => confirm.close();
  let deleteJobId = null;
  confirm.querySelector('[data-delete-confirm]').onclick = async () => {
    try { await deleteHandbookAIHistory(context, deleteJobId); confirm.close(); drawer.hidden = true; host.classList.remove('has-evidence-drawer'); onDeleted(deleteJobId); notify('对话已删除'); }
    catch (error) { notify(`删除失败：${error.message}`); }
  };

  async function detail(jobId) {
    const current = getCurrentJob();
    return current?.jobId === jobId ? current : loadHandbookAI(context, jobId);
  }
  async function showEvidence(jobId) {
    try {
      const job = await detail(jobId);
      const entries = evidenceFor(job);
      drawer.querySelector('[data-evidence-count]').textContent = `(${entries.length})`;
      const list = drawer.querySelector('[data-evidence-list]'); list.replaceChildren();
      if (!entries.length) { const empty = document.createElement('p'); empty.textContent = '本次候选没有可定位的引用原文。已添加的参考文档不等于实际引用。'; list.append(empty); }
      entries.forEach(({ source, ref, generated }, index) => {
        const card = document.createElement('article'); card.className = 'handbook-ai-evidence-card';
        const title = document.createElement('strong'); title.textContent = `[${index + 1}] ${source.title || source.locator || '未命名资料'}`;
        const meta = document.createElement('small'); meta.textContent = `${source.sourceType || '资料'} · ${source.sourceVersion ? `版本 ${source.sourceVersion}` : `拉取于 ${source.fetchedAt || '时间未知'}`}`;
        const quote = document.createElement('blockquote'); quote.textContent = String(source.content).slice(ref.start, ref.end);
        card.append(title, meta, quote);
        if (generated) { const match = document.createElement('p'); match.textContent = `对应候选：${generated}`; card.append(match); }
        list.append(card);
      });
      drawer.hidden = false; host.classList.add('has-evidence-drawer'); drawer.querySelector('[data-evidence-close]').focus();
    } catch (error) { notify(`引用来源读取失败：${error.message}`); }
  }

  function toolbar(jobId, status, rating) {
    const bar = document.createElement('div'); bar.className = 'handbook-ai-message-actions';
    const button = (name, label, action) => {
      const control = document.createElement('button'); control.type = 'button'; control.className = 'handbook-ai-action-icon'; control.innerHTML = ICONS[name]; control.title = label; control.setAttribute('aria-label', label); control.onclick = action; bar.append(control); return control;
    };
    button('copy', '复制本次回复', async () => {
      try { const job = await detail(jobId); await navigator.clipboard.writeText(job.candidateMarkdown || job.fragment || job.executionPreview?.text || ''); notify('已复制本次回复'); }
      catch (error) { notify(`复制失败：${error.message}`); }
    });
    for (const [name, value, label] of [['good', 'positive', '有帮助'], ['bad', 'negative', '没帮助']]) {
      const control = button(name, label, async () => {
        try { await saveHandbookAIFeedback(context, jobId, { rating: value }); bar.querySelectorAll('[data-feedback-rating]').forEach(item => item.setAttribute('aria-pressed', String(item === control))); notify('评价已记录'); }
        catch (error) { notify(`评价失败：${error.message}`); }
      });
      control.dataset.feedbackRating = value; control.setAttribute('aria-pressed', String(rating === value));
    }
    if (status === 'completed') { const refs = document.createElement('button'); refs.type = 'button'; refs.className = 'handbook-ai-evidence-link'; refs.innerHTML = `${ICONS.link}<span>引用来源</span>`; refs.onclick = () => showEvidence(jobId); bar.append(refs); }
    const menu = document.createElement('details'); menu.className = 'handbook-ai-message-more';
    const summary = document.createElement('summary'); summary.innerHTML = ICONS.more; summary.title = '更多操作'; summary.setAttribute('aria-label', '更多操作');
    const options = document.createElement('div');
    const feedbackButton = document.createElement('button'); feedbackButton.type = 'button'; feedbackButton.textContent = '意见反馈'; feedbackButton.onclick = () => { menu.open = false; feedbackJobId = jobId; feedback.querySelector('textarea').value = ''; feedback.showModal(); feedback.querySelector('textarea').focus(); };
    const deleteButton = document.createElement('button'); deleteButton.type = 'button'; deleteButton.textContent = '删除对话'; deleteButton.className = 'danger'; deleteButton.disabled = ['queued', 'running'].includes(status); deleteButton.onclick = () => { menu.open = false; deleteJobId = jobId; confirm.showModal(); };
    options.append(feedbackButton, deleteButton); menu.append(summary, options); bar.append(menu);
    return bar;
  }

  function renderHistory(items, list) {
    list.replaceChildren();
    for (const item of [...items].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))) {
      const turn = document.createElement('article'); turn.className = 'handbook-writing-chat-turn'; turn.dataset.chatJob = item.jobId;
      const prompt = document.createElement('p'); prompt.className = 'handbook-writing-request'; prompt.textContent = item.requirements || operationNames[item.operation] || 'AI 写作';
      const answer = document.createElement('div'); answer.className = 'handbook-writing-chat-answer';
      const heading = document.createElement('strong'); heading.textContent = `${operationNames[item.operation] || 'AI 写作'} · ${statusNames[item.status] || item.status}`;
      const time = document.createElement('small'); time.textContent = item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'handbook-writing-chat-open'; open.textContent = '查看候选与执行过程'; open.onclick = () => openHistory(item.jobId);
      answer.append(heading, time, open, toolbar(item.jobId, item.status, item.feedback)); turn.append(prompt, answer); list.append(turn);
    }
    window.lucide?.createIcons({ nodes: [list] });
  }

  function renderCurrent(job, container) {
    container.replaceChildren(); container.hidden = !job;
    if (!job) return;
    const answer = document.createElement('div'); answer.className = 'handbook-writing-chat-answer';
    const heading = document.createElement('strong'); heading.textContent = `${operationNames[job.operation] || 'AI 写作'} · ${statusNames[job.status] || job.status}`;
    const summary = document.createElement('p'); summary.textContent = job.status === 'completed' ? '本次候选已生成，可查看引用原文并逐处比较采用。' : job.error?.message || '执行过程正在更新。';
    answer.append(heading, summary, toolbar(job.jobId, job.status, job.userFeedback?.rating)); container.append(answer);
    window.lucide?.createIcons({ nodes: [container] });
  }
  return { renderHistory, renderCurrent, showEvidence };
}
