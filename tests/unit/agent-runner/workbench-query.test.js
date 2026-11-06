const { queryWorkbench } = require('../../../packages/agent-runner-core/routes/workbench-query');

const rows = [
  { id: 'a', queue: 'actionable', kind: 'document', number: 'YDB-1', subtaskNumber: 1, title: '主备切换', status: '待处理', version: '23.4', plannedStartTime: '2026-11-01T00:00:00.000Z', lineage: { handbookName: '运维手册', documentName: '主备切换' } },
  { id: 'b', queue: 'waiting', kind: 'merge', number: 'YDB-1', subtaskNumber: 1, title: '主备切换', status: '等待合并', version: '23.4', plannedStartTime: '2026-11-01T00:00:00.000Z' },
  { id: 'c', queue: 'actionable', kind: 'review', number: 'YDB-2', subtaskNumber: 2, title: '备份参数', status: '待审核', version: '24.1', plannedStartTime: '2026-11-03T00:00:00.000Z' },
];

test('nested AND/OR queries and queue facets use the same matched population', () => {
  const result = queryWorkbench(rows, { queue: 'waiting', filter: { op: 'and', children: [
    { field: 'version', operator: 'eq', value: '23.4' },
    { op: 'or', children: [
      { field: 'taskType', operator: 'eq', value: '文档发布' },
      { field: 'status', operator: 'eq', value: '等待合并' },
    ] },
  ] } });
  expect(result.items.map(item => item.id)).toEqual(['b']);
  expect(result.facets).toMatchObject({ all: 1, actionable: 0, waiting: 1 });
});

test('date ranges, paging and stable deduplication', () => {
  const result = queryWorkbench([...rows, rows[0]], { page: 1, pageSize: 1,
    filter: { field: 'plannedStartTime', operator: 'between', value: ['2026-11-01', '2026-11-03'] } });
  expect(result.total).toBe(2);
  expect(result.items).toHaveLength(1);
  expect(result.facets.all).toBe(3);
});

test('unknown fields, invalid operators and unbounded trees are rejected', () => {
  expect(() => queryWorkbench(rows, { filter: { field: 'ownerId', operator: 'eq', value: 'x' } })).toThrow('不支持的查询字段');
  expect(() => queryWorkbench(rows, { filter: { field: 'version', operator: 'between', value: ['a', 'b'] } })).toThrow('文本查询条件无效');
  let tree = { field: 'number', operator: 'eq', value: 'YDB-1' };
  for (let index = 0; index < 9; index++) tree = { op: 'and', children: [tree] };
  expect(() => queryWorkbench(rows, { filter: tree })).toThrow('查询条件过多或嵌套过深');
});

test('text, enum and date filters return their matching rows', () => {
  const cases = [
    [{ field: 'number', operator: 'contains', value: 'ydb-1' }, ['a']],
    [{ field: 'description', operator: 'eq', value: '主备切换' }, ['a']],
    [{ field: 'taskType', operator: 'eq', value: '文档生产' }, ['a']],
    [{ field: 'handbook', operator: 'contains', value: '运维' }, ['a']],
    [{ field: 'plannedStartTime', operator: 'between', value: ['2026-11-03', '2026-11-03'] }, ['c']],
  ];
  for (const [filter, expected] of cases) {
    expect(queryWorkbench(rows, { filter }).items.map(item => item.id)).toEqual(expected);
  }
  expect(queryWorkbench(rows, { filter: { field: 'subtaskNumber', operator: 'eq', value: '1' } }).items.map(item => item.id)).toEqual(['a']);
  expect(queryWorkbench([{ ...rows[0], source: '工单' }], { filter: { field: 'source', operator: 'eq', value: '工单' } }).total).toBe(1);
  expect(queryWorkbench([{ ...rows[0], plannedEndTime: '2026-11-05T00:00:00.000Z' }],
    { filter: { field: 'plannedEndTime', operator: 'between', value: ['2026-11-05', '2026-11-05'] } }).total).toBe(1);
  expect(queryWorkbench(rows, { filter: { field: 'document', operator: 'contains', value: '不存在' } }).total).toBe(0);
});

test('queue facets, deduplication, search and source completeness reflect the same population', () => {
  const input = [
    { ...rows[0], updatedAt: '2026-11-02' },
    { ...rows[0], title: '更新后的主备切换', updatedAt: '2026-11-04' },
    { ...rows[0], id: 'waiting-copy', queue: 'waiting' },
    { ...rows[1], updatedAt: '2026-11-03' },
    rows[2],
  ];
  const result = queryWorkbench(input, { search: 'YDB', queue: 'waiting', type: 'merge' },
    { unavailable: ['GitLab'], asOf: '2026-11-05T00:00:00Z' });
  expect(result.items.map(item => item.id)).toEqual(['b']);
  expect(result.facets).toMatchObject({ all: 3, actionable: 2, waiting: 1, types: { document: 1, review: 1, merge: 1 } });
  expect(result).toMatchObject({ completeness: 'partial', unavailable: ['GitLab'], asOf: '2026-11-05T00:00:00Z' });
  expect(queryWorkbench(input, { search: '更新后' }).items.map(item => item.id)).toEqual(['a']);
});

test('invalid query inputs expose the public 422 contract', () => {
  const invalidInputs = [
    null, [], { queue: 'other' }, { type: 'other' }, { page: 0 }, { page: 1.5 },
    { pageSize: 0 }, { pageSize: 101 }, { search: 2 }, { search: 'a'.repeat(201) },
    { filter: [] }, { filter: 'bad' }, { filter: { op: 'xor', children: [] } },
    { filter: { op: 'and', children: [] } }, { filter: { field: 1, operator: 'eq', value: 'x' } },
    { filter: { field: 'status', operator: 'contains', value: '待审核' } },
    { filter: { field: 'number', operator: 'eq', value: '' } },
    { filter: { field: 'number', operator: 'eq', value: 'x'.repeat(101) } },
    { filter: { field: 'plannedStartTime', operator: 'eq', value: ['2026-11-01', '2026-11-02'] } },
    { filter: { field: 'plannedStartTime', operator: 'between', value: ['2026-02-30', '2026-11-02'] } },
    { filter: { field: 'plannedStartTime', operator: 'between', value: ['2026-11-03', '2026-11-01'] } },
  ];
  for (const input of invalidInputs) {
    expect(() => queryWorkbench(rows, input)).toThrow(expect.objectContaining({ code: 'WORKBENCH_QUERY_INVALID', status: 422 }));
  }
  const many = { op: 'and', children: Array.from({ length: 21 }, () => ({ field: 'number', operator: 'eq', value: 'YDB-1' })) };
  expect(() => queryWorkbench(rows, { filter: many })).toThrow('查询条件过多或嵌套过深');
});
