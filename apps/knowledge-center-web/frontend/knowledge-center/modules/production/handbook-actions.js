export function canSaveHandbookDraft(documentId, ui) {
  const server = ui.serverDrafts?.[documentId];
  return ui.draftLoadState?.[documentId] === 'ready'
    && server?.capabilities?.canEdit !== false
    && ui.draftSaveState?.[documentId]?.status !== 'saving'
    && Boolean(ui.dirtyDocuments?.includes(documentId) || !server?.exists);
}

export function handbookReviewAction(documentId, ui) {
  const server = ui.serverDrafts?.[documentId];
  const dirty = ui.dirtyDocuments?.includes(documentId);
  const loadState = ui.draftLoadState?.[documentId];
  const saving = ui.draftSaveState?.[documentId]?.status === 'saving';
  let reason = '';
  if (loadState === 'forbidden' || server?.capabilities?.canSubmitReview === false || server?.capabilities?.canEdit === false) reason = '当前账号无编辑或送审权限';
  else if (loadState === 'failed') reason = '共享草稿读取失败，请刷新后重试';
  else if (loadState !== 'ready') reason = '正在读取共享草稿';
  else if (saving) reason = '正在保存，请稍候';
  else if (!server?.exists && !dirty) reason = '当前正文尚未保存为共享草稿，请点击“保存”';
  return { disabled: Boolean(reason), label: dirty ? '保存并提交审核' : '提交审核', reason, hint: reason || (dirty ? '保存成功后确认审核人和仓库路径' : '提交当前已保存文档') };
}
