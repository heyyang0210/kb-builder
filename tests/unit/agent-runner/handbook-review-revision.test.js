const test = require('node:test');
const assert = require('node:assert/strict');
const { MemoryIncrementalBuildRepository, IncrementalBuildService } = require('../../../packages/agent-runner-core/lib/incremental-build-service');

const session = { authenticated: true, user: { id: 'author' }, allowedActions: ['knowledge:read', 'knowledge:write', 'review:manage', 'publish:manage'] };
function fixture() {
  const repository = new MemoryIncrementalBuildRepository({ schemaVersion: 1, tasks: [], publishedVersions: [], idempotency: {}, audits: [] });
  const service = new IncrementalBuildService(repository);
  let sequence = 0;
  const documents = ['a', 'b'].map(id => ({
    documentId: id, outlineVersionId: 'outline-1', filePath: `docs/${id}.md`,
    markdown: `# ${id}`, baselineContent: '# baseline', baselineDigest: 'baseline', action: 'update',
    reviewerIds: ['author'], templateVersionId: 'template-v1',
    resources: [{ path: `docs/${id}.png`, size: 5, contentDigest: 'image-v1' }],
  }));
  const input = { handbookId: 'HB-1', businessVersion: 'V-1', branch: 'main', commitSha: 'base', repositoryIdentity: { connectionId: 'local', host: 'http://fixture', project: 'docs' }, documents };
  const create = body => service.createHandbookReview(session, `create-${sequence++}`, {
    ...body, name: '两篇文档', submissionId: `submission-${sequence}`,
    content: body.documents.map(item => item.markdown).join('\n\n'), baselineContent: '# baseline',
    operations: body.documents.map(item => ({ type: 'update', documentId: item.documentId, nodeId: item.documentId, beforeDigest: item.baselineDigest, after: { content: item.markdown } })),
  });
  const parent = create(input);
  service.decideReview(session, parent.id, parent.reviews[0].id, 'approve-a', { decision: 'approve' });
  service.decideReview(session, parent.id, parent.reviews[1].id, 'reject-b', { decision: 'reject', comment: '补充说明' });
  const next = structuredClone(input);
  next.revisionOfTaskId = parent.id;
  next.documents[1].markdown = '# b 已修订';
  return { service, repository, parent, next, create };
}

for (const [name, mutate] of [
  ['正文', body => { body.documents[0].markdown += '\n补充内容'; }],
  ['图片摘要', body => { body.documents[0].resources[0].contentDigest = 'image-v2'; }],
  ['图片大小', body => { body.documents[0].resources[0].size++; }],
  ['模板', body => { body.documents[0].templateVersionId = 'template-v2'; }],
  ['审核人', body => { body.documents[0].reviewerIds = ['other']; }],
  ['基线正文', body => { body.documents[0].baselineContent = '# baseline-v2'; }],
  ['仓库提交', body => { body.commitSha = 'new-base'; }],
]) {
  test(`已通过篇的${name}变化后必须重新审核，不能继承旧通过`, () => {
    const { service, repository, parent, next, create } = fixture();
    const original = service.get(session, parent.id);
    mutate(next);
    const child = create(next);
    assert.equal(child.reviews[0].status, 'pending');
    assert.equal(child.reviews[0].decision, null);
    assert.equal(child.reviews[0].carriedFrom, undefined);
    assert.equal(child.reviews[1].status, 'pending');
    assert.equal(child.capabilities.canPublish, false);
    assert.deepEqual(service.get(session, parent.id), original);
    assert.equal(repository.read().tasks.length, 2);
  });
}

for (const [name, mutate] of [
  ['范围删篇', body => { body.documents.pop(); }],
  ['仓库文件路径', body => { body.documents[0].filePath = 'docs/moved.md'; }],
  ['大纲版本', body => { body.documents[0].outlineVersionId = 'outline-2'; }],
  ['仓库身份', body => { body.repositoryIdentity.project = 'other'; }],
  ['分支', body => { body.branch = 'other'; }],
  ['业务版本', body => { body.businessVersion = 'V-2'; }],
]) {
  test(`${name}变化不能接续原退回任务，失败不得留下半个任务`, () => {
    const { repository, next, create } = fixture();
    const before = repository.read();
    mutate(next);
    assert.throws(() => create(next), error => error.code === 'REVIEW_REVISION_SCOPE_CHANGED');
    assert.deepEqual(repository.read(), before);
  });
}

test('只保存产生新修订ID、或文档顺序变化，不使未改篇的有效通过失效', () => {
  const { next, create, parent } = fixture();
  next.documents[0].draftRevisionId = 'saved-again';
  next.documents.reverse();
  const child = create(next);
  const carried = child.reviews.find(item => item.documentId === 'a');
  assert.equal(carried.status, 'approved');
  assert.equal(carried.carriedFrom.taskId, parent.id);
  assert.equal(child.reviews.find(item => item.documentId === 'b').status, 'pending');
});
