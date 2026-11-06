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
