const { test } = require('node:test');
const assert = require('node:assert/strict');
const { backfillDocumentNumbers, backfillHistoricalNumbers, numberForReview } = require('../../../packages/agent-runner-core/lib/workbench-numbering');

test('同工单两篇连续编号，重审链沿用编号，重复回填不变化', () => {
  const state = { tasks: [{ number: 'PC-9', plannedStartTime: '2026-11-01T00:00:00.000Z', decomposition: { handbooks: [{ id: 'HB', documents: [{ id: 'A', reviewTaskId: 'R2' }, { id: 'B', reviewTaskId: 'R3' }] }] }, scopeHistory: [] }] };
  const reviews = { tasks: [
    { id: 'R1', handbookSource: { documents: [{ documentId: 'A' }] } },
    { id: 'R2', revisionOf: 'R1', handbookSource: { documents: [{ documentId: 'A' }] } },
    { id: 'R3', handbookSource: { documents: [{ documentId: 'B' }] } },
    { id: 'R4', handbookSource: { documents: [{ documentId: 'C' }] } },
  ] };
  backfillDocumentNumbers(state);
  backfillHistoricalNumbers(state, reviews);
  const first = structuredClone(state);
  backfillDocumentNumbers(state);
  backfillHistoricalNumbers(state, reviews);
  assert.deepEqual(state, first);
  assert.deepEqual(state.tasks[0].decomposition.handbooks[0].documents.map(doc => doc.subtaskNumber), [1, 2]);
  assert.deepEqual(numberForReview(state, reviews, 'R1', 'A'), { number: 'PC-9', subtaskNumber: 1, numberingStatus: 'linked', plannedStartTime: '2026-11-01T00:00:00.000Z', plannedEndTime: null });
  assert.equal(numberForReview(state, reviews, 'R1', 'A', new Set()).number, null, '无权查看工单手册时不得泄露工单编号');
  assert.match(numberForReview(state, reviews, 'R4', 'C').number, /^HIST-\d{6}$/);
});

test('同一审核链关联多个工单时标记待核对，冲突编号拒绝回填', () => {
  const state = { tasks: ['PC-1', 'PC-2'].map(number => ({ number, decomposition: { handbooks: [{ id: 'HB', documents: [{ id: 'A', reviewTaskId: 'R' }] }] } })) };
  const reviews = { tasks: [{ id: 'R', handbookSource: { documents: [{ documentId: 'A' }] } }] };
  backfillDocumentNumbers(state);
  backfillHistoricalNumbers(state, reviews);
  assert.equal(numberForReview(state, reviews, 'R', 'A').numberingStatus, 'needs_review');
  const conflict = { tasks: [{ number: 'PC-3', decomposition: { handbooks: [{ id: 'A', documents: [{ id: '1', subtaskNumber: 1 }, { id: '2', subtaskNumber: 1 }] }] } }] };
  assert.throws(() => backfillDocumentNumbers(conflict), /子任务编号冲突/);
});

test('旧手册范围快照保留已用序号，新文档不得复用', () => {
  const state = { tasks: [{ number: 'PC-4', scopeHistory: [{ id: 'HB', documents: [{ id: 'old', subtaskNumber: 1 }] }], decomposition: { handbooks: [{ id: 'HB', documents: [{ id: 'new' }] }] } }] };
  backfillDocumentNumbers(state);
  assert.equal(state.tasks[0].decomposition.handbooks[0].documents[0].subtaskNumber, 2);
  assert.equal(state.tasks[0].nextSubtaskNumber, 3);
});
