const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IncrementalBuildService, MemoryIncrementalBuildRepository } = require('../../../packages/agent-runner-core/lib/incremental-build-service');

test('管理员以本人身份代审核，保留指派、阻断意见和审计', () => {
  const task = {
    id: 'delegated-review', handbookId: 'HB-1', businessVersion: 'v1', state: 'under_review',
    createdBy: { id: 'author' }, createdAt: '2026-11-05T00:00:00Z', updatedAt: '2026-11-05T00:00:00Z',
    candidate: { digest: 'candidate-1', operations: [] },
    handbookSource: { branch: 'main', documents: [{ documentId: 'doc-1', filePath: 'docs/a.md', reviewerIds: ['reviewer'] }] },
    reviews: [{ id: 'review-1', documentId: 'doc-1', candidateDigest: 'candidate-1', status: 'pending', reviewerIds: ['reviewer'], comments: [] }],
  };
  const repository = new MemoryIncrementalBuildRepository({ schemaVersion: 1, tasks: [task], publishedVersions: [], idempotency: {}, audits: [] });
  const service = new IncrementalBuildService(repository);
  const session = (id, allowedActions) => ({ user: { id }, allowedActions });
  const admin = session('admin', ['knowledge:read', 'review:manage', 'platform:manage']);
  const outsider = session('outsider', ['knowledge:read', 'review:manage']);
  assert.equal(service.project(task, admin).capabilities.canReview, true);
  assert.throws(() => service.decideReview(outsider, task.id, 'review-1', 'outsider', { decision: 'approve', candidateDigest: 'candidate-1' }), { code: 'REVIEWER_NOT_ASSIGNED' });
  task.reviews[0].comments.push({ id: 'block', severity: 'blocker', resolved: false });
  assert.throws(() => service.decideReview(admin, task.id, 'review-1', 'blocked', { decision: 'approve', candidateDigest: 'candidate-1' }), { code: 'REVIEW_BLOCKED_BY_COMMENTS' });
  task.reviews[0].comments[0].resolved = true;
  const decision = service.decideReview(admin, task.id, 'review-1', 'approved', { decision: 'approve', candidateDigest: 'candidate-1' });
  assert.equal(decision.decision.decidedBy.id, 'admin');
  assert.deepEqual(repository.read().tasks[0].reviews[0].reviewerIds, ['reviewer']);
  assert.equal(repository.read().audits.at(-1).details.delegatedByAdmin, true);
});

test('普通意见未处理时不能通过审核或登记 MR', () => {
  const task = {
    id: 'pending-opinion', handbookId: 'HB-1', state: 'under_review', createdBy: { id: 'author' },
    candidate: { digest: 'candidate-1', operations: [] },
    handbookSource: { branch: 'main', documents: [{ documentId: 'doc-1', filePath: 'a.md', reviewerIds: ['reviewer'] }] },
    reviews: [{ id: 'r1', documentId: 'doc-1', candidateDigest: 'candidate-1', status: 'pending', reviewerIds: ['reviewer'], comments: [{ id: 'normal-1', severity: 'normal', resolved: false }] }],
  };
  const repository = new MemoryIncrementalBuildRepository({ schemaVersion: 1, tasks: [task], publishedVersions: [], idempotency: {}, audits: [] });
  const service = new IncrementalBuildService(repository);
  const session = { user: { id: 'reviewer' }, allowedActions: ['knowledge:read', 'review:manage', 'publish:manage'] };
  assert.throws(() => service.decideReview(session, task.id, 'r1', 'attempt', { decision: 'approve', candidateDigest: 'candidate-1' }), { code: 'REVIEW_BLOCKED_BY_COMMENTS' });
  task.state = 'approved'; task.reviews[0].status = 'approved';
  assert.throws(() => service.recordMergeRequest(session, task.id, 'mr-attempt', { expectedCandidateDigest: 'candidate-1', mergeRequest: { iid: 1 } }), { code: 'REVIEW_BLOCKED_BY_COMMENTS' });
});

test('另一篇文档存在未处理意见时同一候选不能通过', () => {
  const task = {
    id: 'multi-doc-opinion', handbookId: 'HB-1', state: 'under_review', createdBy: { id: 'author' },
    candidate: { digest: 'candidate-1', operations: [] },
    handbookSource: { branch: 'main', documents: [{ documentId: 'd1', filePath: 'a.md', reviewerIds: ['reviewer'] }, { documentId: 'd2', filePath: 'b.md', reviewerIds: ['reviewer'] }] },
    reviews: [
      { id: 'r1', documentId: 'd1', candidateDigest: 'candidate-1', status: 'pending', reviewerIds: ['reviewer'], comments: [] },
      { id: 'r2', documentId: 'd2', candidateDigest: 'candidate-1', status: 'pending', reviewerIds: ['reviewer'], comments: [{ id: 'other-doc', severity: 'normal', resolved: false }] },
    ],
  };
  const service = new IncrementalBuildService(new MemoryIncrementalBuildRepository({ schemaVersion: 1, tasks: [task], publishedVersions: [], idempotency: {}, audits: [] }));
  const session = { user: { id: 'reviewer' }, allowedActions: ['knowledge:read', 'review:manage'] };
  assert.throws(() => service.decideReview(session, task.id, 'r1', 'attempt', { decision: 'approve', candidateDigest: 'candidate-1' }), { code: 'REVIEW_BLOCKED_BY_COMMENTS' });
});

test('交付回读失败保留可重试证据，成功回读后清除失败', () => {
  const task = { id: 'delivery-failure', handbookId: 'HB-1', state: 'mr_submitted', createdBy: { id: 'author' },
    candidate: { digest: 'candidate-1', operations: [] }, reviews: [], handbookSource: { branch: 'main', documents: [] },
    mergeRequest: { iid: 21 }, deliveryObservation: { iid: 21, state: 'opened' }, externalEvidence: [] };
  const service = new IncrementalBuildService(new MemoryIncrementalBuildRepository({ schemaVersion: 1, tasks: [task], publishedVersions: [], idempotency: {}, audits: [] }));
  const session = { user: { id: 'author' }, allowedActions: ['knowledge:read', 'publish:manage'] };
  service.recordDeliveryFailure(session, task.id, 'failed', { code: 'GITLAB_RESOURCE_READBACK_FAILED' });
  const failed = service.get(session, task.id);
  assert.equal(failed.completion.status, 'pending');
  assert.equal(failed.deliveryFailure.code, 'GITLAB_RESOURCE_READBACK_FAILED');
  service.recordMergeRequestDelivery(session, task.id, 'opened', { delivery: { iid: 21, state: 'opened' } });
  assert.equal(service.get(session, task.id).deliveryFailure, null);
  assert.equal(service.get(session, task.id).completion.status, 'pending');
  service.recordMergeRequestDelivery(session, task.id, 'merged', { delivery: { iid: 21, state: 'merged', readback: { status: 'consistent', resources: 'repository_relative_images_verified' } } });
  assert.equal(service.get(session, task.id).completion.status, 'completed');
});

test('关闭的旧 MR 不能靠状态刷新重新进入交付', () => {
  const task = { id: 'closed-delivery', handbookId: 'HB-1', state: 'mr_submitted', createdBy: { id: 'author' },
    candidate: { digest: 'candidate-1', operations: [] }, reviews: [], handbookSource: { branch: 'main', documents: [] },
    mergeRequest: { iid: 22 }, deliveryObservation: { iid: 22, state: 'closed' }, externalEvidence: [] };
  const service = new IncrementalBuildService(new MemoryIncrementalBuildRepository({ schemaVersion: 1, tasks: [task], publishedVersions: [], idempotency: {}, audits: [] }));
  const session = { user: { id: 'author' }, allowedActions: ['knowledge:read', 'publish:manage'] };
  assert.equal(service.get(session, task.id).capabilities.canRefreshDelivery, false);
  assert.throws(() => service.recordMergeRequestDelivery(session, task.id, 'reopen', { delivery: { iid: 22, state: 'opened' } }), { code: 'MR_CLOSED_RECOVERY_REQUIRED' });
  assert.equal(service.get(session, task.id).deliveryObservation.state, 'closed');
});
