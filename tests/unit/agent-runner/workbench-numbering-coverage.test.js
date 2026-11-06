const { reviewRoot, backfillDocumentNumbers, backfillHistoricalNumbers, numberForReview } = require('../../../packages/agent-runner-core/lib/workbench-numbering');

function scope(documents) { return { handbooks: [{ id: 'HB', documents }] }; }

test('document numbers remain stable across active and historical scopes', () => {
  const state = { tasks: [{ number: 'PC-1', nextSubtaskNumber: 1,
    scopeHistory: [scope([{ id: 'old', subtaskNumber: 2 }])],
    decomposition: scope([{ id: 'old' }, { id: 'new' }]) }] };
  backfillDocumentNumbers(state);
  expect(state.tasks[0].decomposition.handbooks[0].documents.map(doc => doc.subtaskNumber)).toEqual([2, 1]);
  expect(state.tasks[0].nextSubtaskNumber).toBe(3);
  const first = structuredClone(state);
  backfillDocumentNumbers(state);
  expect(state).toEqual(first);
});

test('review chains keep ticket numbers and hide inaccessible ticket scopes', () => {
  const state = { tasks: [{ number: 'PC-2', plannedStartTime: '2026-11-01', plannedEndTime: '2026-11-09',
    decomposition: scope([{ id: 'doc-a', reviewTaskId: 'revision', subtaskNumber: 3 }]) }] };
  const reviews = { tasks: [
    { id: 'root', handbookId: 'HB', target: { documentIds: ['doc-a'] } },
    { id: 'revision', revisionOf: 'root', handbookId: 'HB' },
  ] };
  expect(reviewRoot(reviews.tasks[1], new Map(reviews.tasks.map(task => [task.id, task])))).toBe('root');
  backfillHistoricalNumbers(state, reviews);
  expect(numberForReview(state, reviews, 'root', 'doc-a')).toEqual({
    number: 'PC-2', subtaskNumber: 3, numberingStatus: 'linked',
    plannedStartTime: '2026-11-01', plannedEndTime: '2026-11-09',
  });
  expect(numberForReview(state, reviews, 'root', 'doc-a', new Set())).toMatchObject({ number: null, numberingStatus: 'needs_review' });
  expect(numberForReview(state, reviews, 'missing', 'doc-a')).toMatchObject({ number: null, numberingStatus: 'needs_review' });
});

test('historical numbers avoid reserved values and detect ambiguous ticket links', () => {
  const state = { workbenchNumbers: { nextHistoricalNumber: 1, entries: { existing: { number: 'HIST-000001' } } },
    tasks: ['PC-3', 'PC-4'].map(number => ({ number, decomposition: scope([{ id: 'doc', reviewTaskId: 'ambiguous' }]) })) };
  const reviews = { tasks: [
    { id: 'ambiguous', handbookId: 'HB', handbookSource: { documents: [{ documentId: 'doc' }] } },
    { id: 'historical', target: { documentIds: ['older'] } },
  ] };
  backfillHistoricalNumbers(state, reviews);
  expect(state.workbenchNumbers.entries.ambiguous).toMatchObject({ status: 'needs_review', number: null });
  expect(state.workbenchNumbers.entries.historical).toMatchObject({ status: 'historical', number: 'HIST-000002', documents: { older: 1 } });
  expect(numberForReview(state, reviews, 'ambiguous', 'doc')).toMatchObject({ number: null, numberingStatus: 'needs_review' });
  expect(numberForReview(state, reviews, 'historical', 'older')).toMatchObject({ number: 'HIST-000002', subtaskNumber: 1, numberingStatus: 'historical' });
});

test('conflicting subtask ownership is rejected with the public error code', () => {
  const state = { tasks: [{ number: 'PC-5', decomposition: scope([{ id: 'a', subtaskNumber: 1 }, { id: 'b', subtaskNumber: 1 }]) }] };
  expect(() => backfillDocumentNumbers(state)).toThrow(expect.objectContaining({ code: 'SUBTASK_NUMBER_CONFLICT' }));
});

test('cyclic revisions terminate and keep one historical number per root', () => {
  const tasks = [{ id: 'a', revisionOf: 'b', handbookSource: { documents: [{ documentId: 'one' }] } },
    { id: 'b', revisionOf: 'a', handbookSource: { documents: [{ documentId: 'two' }] } }];
  const byId = new Map(tasks.map(task => [task.id, task]));
  expect(reviewRoot(tasks[0], byId)).toBe('a');
  expect(reviewRoot({ id: 'missing-parent', revisionOf: 'absent' }, byId)).toBe('missing-parent');
  const state = { tasks: [] };
  const registry = backfillHistoricalNumbers(state, { tasks });
  expect(Object.keys(registry.entries).sort()).toEqual(['a', 'b']);
  expect(new Set(Object.values(registry.entries).map(entry => entry.number)).size).toBe(2);
});

test('legacy flat scopes preserve prior numbers and reject changing an assigned document number', () => {
  const state = { tasks: [{ number: 'PC-6', scopeHistory: [{ id: 'HB', documents: [{ id: 'old', subtaskNumber: 2 }] }],
    decomposition: scope([{ id: 'old', subtaskNumber: 2 }, { id: 'new' }]) }] };
  backfillDocumentNumbers(state);
  expect(state.tasks[0].decomposition.handbooks[0].documents.map(doc => doc.subtaskNumber)).toEqual([2, 1]);
  const conflicting = { tasks: [{ number: 'PC-7', scopeHistory: [scope([{ id: 'old', subtaskNumber: 2 }])],
    decomposition: scope([{ id: 'old', subtaskNumber: 3 }]) }] };
  expect(() => backfillDocumentNumbers(conflicting)).toThrow(expect.objectContaining({ code: 'SUBTASK_NUMBER_CONFLICT' }));
});

test('missing ticket links, unknown documents and registered links have distinct projections', () => {
  const reviews = { tasks: [{ id: 'root', handbookId: 'HB', target: { documentIds: ['a', 'b'] } }] };
  const historical = { tasks: [] };
  backfillHistoricalNumbers(historical, reviews);
  expect(numberForReview(historical, reviews, 'root', 'missing')).toMatchObject({
    number: historical.workbenchNumbers.entries.root.number, subtaskNumber: null, numberingStatus: 'historical',
  });
  const linked = { tasks: [], workbenchNumbers: { entries: { root: { status: 'linked', number: 'PC-8', documents: { a: 1 } } } } };
  expect(numberForReview(linked, reviews, 'root', 'a')).toMatchObject({ number: null, numberingStatus: 'needs_review' });
  const unregistered = { tasks: [] };
  expect(numberForReview(unregistered, reviews, 'root', 'a')).toMatchObject({ number: null, numberingStatus: 'unregistered' });
});

test('empty and partial legacy records keep safe numbering defaults', () => {
  expect(backfillDocumentNumbers({})).toEqual({});
  const empty = backfillHistoricalNumbers({}, {});
  expect(empty).toEqual({ nextHistoricalNumber: 1, entries: {} });
  expect(numberForReview({}, {}, 'missing', 'document')).toMatchObject({ number: null, numberingStatus: 'needs_review' });
  const state = { workbenchNumbers: { nextHistoricalNumber: 'invalid', entries: {} }, tasks: [{ number: 'PC-9' }] };
  const reviews = { tasks: [{ id: 'orphan' }] };
  backfillHistoricalNumbers(state, reviews);
  expect(state.workbenchNumbers.entries.orphan.number).toBe('HIST-000001');
  expect(backfillDocumentNumbers(state).tasks[0].nextSubtaskNumber).toBe(1);
});

test('ticket matching skips unrelated handbooks and projects missing subtask and dates', () => {
  const state = { tasks: [
    { number: 'PC-10', decomposition: { handbooks: [
      { id: 'OTHER', documents: [{ id: 'ignored', reviewTaskId: 'root' }] },
      { id: 'HB', documents: [{ id: 'doc', createdDocumentId: 'created', reviewTaskId: 'root' }] },
    ] } },
    { number: 'PC-11', decomposition: { handbooks: [{ id: 'HB', documents: [] }] } },
  ] };
  const reviews = { tasks: [{ id: 'root', handbookId: 'HB' }] };
  backfillHistoricalNumbers(state, reviews);
  expect(numberForReview(state, reviews, 'root', 'created')).toEqual({
    number: 'PC-10', subtaskNumber: null, numberingStatus: 'linked', plannedStartTime: null, plannedEndTime: null,
  });
  expect(numberForReview(state, reviews, 'root', 'unknown')).toMatchObject({
    number: 'PC-10', subtaskNumber: null, numberingStatus: 'linked',
  });
  expect(numberForReview(state, reviews, 'root', 'created', new Set(['HB']))).toMatchObject({
    number: null, numberingStatus: 'needs_review',
  });
  expect(numberForReview(state, reviews, 'root', 'created', new Set(['HB', 'OTHER']))).toMatchObject({
    number: 'PC-10', numberingStatus: 'linked',
  });
});

test('duplicate active documents reject ambiguous presentation even with the same identity', () => {
  const state = { tasks: [{ number: 'PC-12', scopeHistory: [null],
    decomposition: scope([{ id: 'same' }, { id: 'same' }]) }] };
  expect(() => backfillDocumentNumbers(state)).toThrow(expect.objectContaining({ code: 'SUBTASK_NUMBER_CONFLICT' }));
});

test('an active handbook without documents leaves the next subtask number ready', () => {
  const state = { tasks: [{ number: 'PC-13', decomposition: { handbooks: [{ id: 'HB' }] } }] };
  backfillDocumentNumbers(state);
  expect(state.tasks[0].nextSubtaskNumber).toBe(1);
});
