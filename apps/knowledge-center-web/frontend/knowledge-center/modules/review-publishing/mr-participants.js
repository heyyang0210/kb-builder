import { loadMRParticipants } from '../../common/api/incremental-api.js';
import { enhanceSearchableSelects, cleanupSearchableSelects, syncSearchableSelect } from '../../common/searchable-combobox.js';

// Shared by the review reader and production task page.
export function chooseMRParticipants(taskId, trigger) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'review-online-dialog';
    dialog.setAttribute('aria-label', '创建 GitLab MR');
    dialog.innerHTML = '<form><header><h2>创建 GitLab MR</h2></header><p>审核人同步为 GitLab Reviewers；合入负责人同步为 Assignees，由负责人在 GitLab 处理合并。</p><h3>审核人</h3><ul data-mr-reviewers></ul><label>合入负责人<select name="assigneeId" data-searchable-select required disabled><option value="">正在核对项目成员…</option></select></label><p role="alert" tabindex="-1" data-mr-error></p><footer><button class="button secondary" type="button" data-mr-cancel>取消</button><button class="button primary" type="submit" disabled>创建 MR</button></footer></form>';
    document.body.append(dialog);
    let finished = false;
    const finish = value => {
      if (finished) return;
      finished = true;
      dialog.close(); dialog.remove(); cleanupSearchableSelects(); trigger?.focus(); resolve(value);
    };
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    dialog.querySelector('[data-mr-cancel]').addEventListener('click', () => finish(null));
    let digest;
    const form = dialog.querySelector('form');
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (digest && form.reportValidity()) finish({ assigneeId: form.elements.assigneeId.value, expectedCandidateDigest: digest });
    });
    dialog.showModal();
    enhanceSearchableSelects(dialog);
    loadMRParticipants(taskId).then(data => {
      if (finished) return;
      digest = data.candidateDigest;
      for (const item of data.reviewers) {
        const li = document.createElement('li');
        li.textContent = `${item.displayName || item.platformId} → ${item.error || `@${item.username}`}`;
        dialog.querySelector('[data-mr-reviewers]').append(li);
      }
      const select = form.elements.assigneeId;
      select.replaceChildren(new Option('请选择合入负责人', ''));
      for (const item of data.assignees) select.add(new Option(`${item.displayName}（@${item.username}）`, item.platformId));
      select.disabled = !data.canSubmit;
      syncSearchableSelect(select);
      form.querySelector('[type="submit"]').disabled = !data.canSubmit;
      if (!data.canSubmit) {
        const error = dialog.querySelector('[data-mr-error]');
        error.textContent = '人员映射不完整，请核对平台统一登录账号及目标项目成员权限后重试。'; error.focus();
      } else select.focus();
    }).catch(error => {
      if (finished) return;
      const message = dialog.querySelector('[data-mr-error]');
      message.textContent = error.message; message.focus();
    });
  });
}
