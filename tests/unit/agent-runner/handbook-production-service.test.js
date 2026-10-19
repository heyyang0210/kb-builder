const fs = require('fs');
const os = require('os');
const path = require('path');
const { FileAggregateStore } = require('../../../packages/agent-runner-core/lib/aggregate-store');
const { createHandbookProductionService } = require('../../../packages/agent-runner-core/lib/handbook-production-service');

const editor = { user: { id: 'author-1', displayName: '作者', roles: ['KNOWLEDGE_EDITOR'] }, allowedActions: ['knowledge:read', 'knowledge:write'] };
const context = { handbookId: 'DB-017', outlineVersionId: 'outline-v1', branch: 'main', documentId: 'doc-1' };

describe('手册生产共享草稿服务', () => {
  let root;
  let service;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'handbook-production-'));
    const store = new FileAggregateStore(path.join(root, 'state.json'), { schemaVersion: 1, drafts: {}, attachments: {}, reviewBatches: [], idempotency: {}, audits: [] });
    service = createHandbookProductionService({ store, attachmentRoot: path.join(root, 'attachments') });
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('首次保存创建不可变 revision，幂等重试返回同一结果', () => {
    const first = service.saveDraft({ ...context, editVersion: 0, markdown: '# 标题\r\n', htmlSnapshot: '<h1 onclick="bad()">标题</h1><script>bad()</script>', attachmentIds: [] }, editor, 'save-1');
    const retry = service.saveDraft({ ...context, editVersion: 0, markdown: '# 其他内容', htmlSnapshot: '<p>其他内容</p>', attachmentIds: [] }, editor, 'save-1');
    expect(retry.draft.currentRevisionId).toBe(first.draft.currentRevisionId);
    expect(first.draft.revision.markdown).toBe('# 标题\n');
    expect(first.draft.revision.htmlSnapshot).toBe('<h1>标题</h1>');
    expect(first.draft.revision.immutable).toBe(true);
  });

  test('并发旧版本保存返回冲突并包含服务器草稿', () => {
    service.saveDraft({ ...context, editVersion: 0, markdown: 'v1', htmlSnapshot: '<p>v1</p>', attachmentIds: [] }, editor, 'save-1');
    expect(() => service.saveDraft({ ...context, editVersion: 0, markdown: '冲突', htmlSnapshot: '<p>冲突</p>', attachmentIds: [] }, editor, 'save-2'))
      .toThrow(expect.objectContaining({ code: 'DRAFT_VERSION_CONFLICT', status: 409 }));
  });

  test('历史恢复创建新 revision，不覆盖原历史', () => {
    const first = service.saveDraft({ ...context, editVersion: 0, markdown: 'v1', htmlSnapshot: '<p>v1</p>', attachmentIds: [] }, editor, 'save-1');
    service.saveDraft({ ...context, editVersion: 1, markdown: 'v2', htmlSnapshot: '<p>v2</p>', attachmentIds: [] }, editor, 'save-2');
    const restored = service.restoreRevision({ ...context, editVersion: 2, revisionId: first.draft.currentRevisionId }, editor, 'restore-1');
    expect(restored.draft.editVersion).toBe(3);
    expect(restored.draft.revision.restoredFromRevisionId).toBe(first.draft.currentRevisionId);
    expect(service.listRevisions(context, editor).items).toHaveLength(3);
  });

  test('附件限制、暂存和保存绑定', () => {
    expect(() => service.stageAttachment({ ...context, fileName: 'bad.exe', mimeType: 'application/octet-stream' }, Buffer.from('x'), editor)).toThrow(expect.objectContaining({ code: 'ATTACHMENT_TYPE_NOT_ALLOWED' }));
    const attachment = service.stageAttachment({ ...context, fileName: '说明.md', mimeType: 'text/markdown' }, Buffer.from('# 附件'), editor);
    const saved = service.saveDraft({ ...context, editVersion: 0, markdown: `[说明](${attachment.stableReference})`, htmlSnapshot: '<p>说明</p>', attachmentIds: [attachment.attachmentId] }, editor, 'save-with-attachment');
    expect(saved.draft.revision.attachmentIds).toEqual([attachment.attachmentId]);
    expect(service.readAttachment(attachment.attachmentId, editor).buffer.toString()).toBe('# 附件');
    expect(() => service.saveDraft({ ...context, documentId: 'doc-other', editVersion: 0, markdown: '跨文档引用', htmlSnapshot: '<p>跨文档引用</p>', attachmentIds: [attachment.attachmentId] }, editor, 'cross-document-attachment'))
      .toThrow(expect.objectContaining({ code: 'ATTACHMENT_CONTEXT_MISMATCH' }));
  });

  test('评审校验审核资格、允许本人并冻结旧批次 revision', () => {
    const saved = service.saveDraft({ ...context, editVersion: 0, markdown: '待评审', htmlSnapshot: '<p>待评审</p>', attachmentIds: [] }, editor, 'save-review');
    expect(() => service.createReviewBatch({ handbookId: context.handbookId, documents: [{ ...context, draftRevisionId: saved.draft.currentRevisionId, reviewerIds: ['unqualified'] }] }, editor, 'review-invalid', [{ id: 'author-1' }]))
      .toThrow(expect.objectContaining({ code: 'REVIEWER_REQUIRED' }));
    const batch = service.createReviewBatch({ handbookId: context.handbookId, documents: [{ ...context, draftRevisionId: saved.draft.currentRevisionId, reviewerIds: ['author-1'] }] }, editor, 'review-ok', [{ id: 'author-1' }]);
    const current = service.getDraft(context, editor).draft;
    expect(batch.documents[0].draftRevisionId).toBe(saved.draft.currentRevisionId);
    expect(current.reviewRevisionIds).toContain(saved.draft.currentRevisionId);
    expect(current.editVersion).toBe(2);
    expect(current.revision.clonedFromRevisionId).toBe(saved.draft.currentRevisionId);
  });
});
