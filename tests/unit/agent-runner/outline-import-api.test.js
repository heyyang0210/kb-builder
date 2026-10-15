const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const XLSX = require('xlsx');
const { rules } = require('../../../packages/agent-runner-core/lib/outline-path-template');

let root, server, base, oldBytes;
const savedEnv = {};
const envNames = ['KNOWLEDGE_STORAGE_MODE', 'OUTLINE_REPOSITORY_DIR', 'KNOWLEDGE_ASSETS_CONFIG', 'TECH_DOMAINS_CONFIG'];
const old = { id: 'old-outline', handbookId: 'DB-004', name: '既有大纲', state: 'published', editVersion: 9,
  content: { parts: [{ part: '历史', chapters: [{ name: '章节', documents: [{ id: 'old-doc', name: '历史文档' }] }] }] } };

function workbook(rows) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([rules.headers, ...rows]), '大纲模板');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

async function upload(endpoint, data, options = {}) {
  const form = new FormData();
  form.append('handbookId', options.handbookId || 'DB-004');
  form.append('file', new Blob([data]), options.filename || '测试.xlsx');
  if (options.confirmDuplicate) form.append('confirmDuplicate', 'true');
  const response = await fetch(`${base}/api/outline/${endpoint}`, { method: 'POST', body: form });
  return { status: response.status, body: await response.json() };
}

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-real-api-'));
  envNames.forEach(key => { savedEnv[key] = process.env[key]; });
  process.env.KNOWLEDGE_STORAGE_MODE = 'file';
  process.env.OUTLINE_REPOSITORY_DIR = path.join(root, 'outlines');
  process.env.KNOWLEDGE_ASSETS_CONFIG = path.join(root, 'assets.json');
  process.env.TECH_DOMAINS_CONFIG = path.join(root, 'domains.json');
  fs.mkdirSync(process.env.OUTLINE_REPOSITORY_DIR);
  fs.writeFileSync(process.env.KNOWLEDGE_ASSETS_CONFIG, JSON.stringify({ handbooks: [{ id: 'DB-004', name: 'SQL参考手册' }] }));
  fs.writeFileSync(process.env.TECH_DOMAINS_CONFIG, JSON.stringify({ techDomains: [{ id: '2', name: '兼容性' }] }));
  oldBytes = JSON.stringify({ outlines: [old] });
  fs.writeFileSync(path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json'), oldBytes);
  const app = express();
  app.use(express.json());
  app.use('/api/outline', require('../../../packages/agent-runner-core/routes/outline'));
  server = await new Promise((resolve, reject) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); instance.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  envNames.forEach(key => { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key]; });
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

test('真实校验API读取501篇SQL示例，不写入大纲、不遗留上传文件', async () => {
  const data = fs.readFileSync(path.resolve(__dirname, '../../..', rules.sampleDownloadPath));
  const result = await upload('validate', data);
  expect(result.status).toBe(200);
  expect(result.body.data).toMatchObject({ passed: true, documentCount: 501 });
  expect(fs.readFileSync(path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json'), 'utf8')).toBe(oldBytes);
  expect(fs.readdirSync(process.env.OUTLINE_REPOSITORY_DIR)).toEqual(['metadata.json']);
});

test('真实API汇总行列错误和修改建议，错误上传不改已有数据', async () => {
  const data = workbook([['00SQL参考手册.md'], ['A', '', 'x.md'], ['bad.txt']]);
  const validation = await upload('validate', data);
  expect(validation.status).toBe(422);
  expect(validation.body.data.errors).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'PATH_GAP', row: 3, column: '路径层级2', suggestion: expect.any(String) }),
    expect.objectContaining({ code: 'DOCUMENT_EXTENSION', row: 4 })
  ]));
  const imported = await upload('import', data);
  expect(imported.status).toBe(422);
  expect(imported.body.data.items[0].error.details[0].row).toBe(3);
  expect(fs.readFileSync(path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json'), 'utf8')).toBe(oldBytes);
});

test('未知领域定位到当前文档行，错误表头及文件格式给出修复建议', async () => {
  const result = await upload('validate', workbook([['00SQL参考手册.md', '', '', '', '介绍', '未配置领域']]));
  expect(result.status).toBe(422);
  expect(result.body.data.errors[0]).toMatchObject({ row: 2, column: '技术领域分工', code: 'INVALID_TECH_DOMAIN_ASSIGNMENT' });
  const invalidBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(invalidBook, XLSX.utils.aoa_to_sheet([['错误表头']]), '大纲');
  const headers = await upload('validate', XLSX.write(invalidBook, { type: 'buffer', bookType: 'xlsx' }));
  expect(headers.body.data.errors[0]).toMatchObject({ row: 1, code: 'HEADERS_INVALID' });
  const extension = await upload('validate', Buffer.from('invalid'), { filename: 'invalid.txt' });
  expect(extension.status).toBe(422);
  expect(extension.body.data.errors[0].suggestion).toBeTruthy();
});

test('真实上传501篇SQL新候选、重读顺序一致、原大纲及关联原样保留', async () => {
  const data = fs.readFileSync(path.resolve(__dirname, '../../..', rules.sampleDownloadPath));
  const imported = await upload('import', data);
  expect(imported.status).toBe(201);
  const candidate = imported.body.data;
  expect(candidate.nodes.filter(node => node.kind === 'document')).toHaveLength(501);
  const read = await fetch(`${base}/api/outline/versions/${candidate.id}`);
  const reread = await read.json();
  expect(reread.data.nodes).toEqual(candidate.nodes);
  expect(reread.data.nodes[0]).toMatchObject({ title: '00SQL参考手册.md', parentId: null, level: 1 });
  expect(reread.data.nodes.filter(n => n.kind === 'document').at(-1).title).toBe('附：样例表.md');
  const persisted = JSON.parse(fs.readFileSync(path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json')));
  expect(persisted.outlines[0]).toEqual(old);
  expect(persisted.outlines).toHaveLength(2);
  const before = fs.readFileSync(path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json'));
  const duplicate = await upload('import', data);
  expect(duplicate.status).toBe(409);
  expect(fs.readFileSync(path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json'))).toEqual(before);
});

test.each([
  ['根文档', '00SQL参考手册.md', '修改后的根说明', false],
  ['嵌套文档', '基础SQL元素/INTEGER.md', '修改后的嵌套说明\n第二行', false],
  ['清空说明', '00SQL参考手册.md', '', false],
  ['目录保存后', '基础SQL元素/INTEGER.md', '目录保存后的说明', true],
])('自然路径候选保存内容说明并持久化：%s', async (_label, documentPath, description, saveDirectoryFirst) => {
  const imported = await upload('import', workbook([
    ['00SQL参考手册.md', '', '', '', '原根说明', '兼容性'],
    ['基础SQL元素', '00基础SQL元素.md', '', '', '原目录说明', '兼容性'],
    ['基础SQL元素', 'INTEGER.md', '', '', '原嵌套说明', '兼容性'],
  ]), { confirmDuplicate: true });
  expect(imported.status).toBe(201);
  const candidate = imported.body.data;
  const endpoint = `${base}/api/outline/governance/${candidate.id}/governance`;
  const assignments = candidate.nodes.filter(node => node.kind === 'document').map(node => ({ nodeId: node.id, techDomainIds: ['2'] }));
  if (saveDirectoryFirst) {
    const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      editVersion: candidate.editVersion, assignments,
      directoryOrder: candidate.nodes.map(node => ({ nodeId: node.id, parentNodeId: node.parentId, order: node.order })),
    }) });
    expect(response.status).toBe(200);
  }
  const target = candidate.nodes.find(node => node.path === documentPath);
  const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    editVersion: candidate.editVersion, assignments, descriptions: [{ nodeId: target.id, description }],
  }) });
  expect(response.status).toBe(200);
  const expectedNodes = candidate.nodes.map(node => node.id === target.id ? { ...node, description } : node);
  const reread = await (await fetch(`${base}/api/outline/governance/${candidate.id}`)).json();
  expect(reread.data.nodes).toEqual(expectedNodes);
  expect(reread.data.governance.assignments).toEqual(assignments);
  const persisted = JSON.parse(fs.readFileSync(path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json')));
  expect(persisted.outlines.find(item => item.id === candidate.id).content.nodes).toEqual(expectedNodes);
  expect(persisted.outlines[0]).toEqual(old);
});

test.each(['directory', 'missing'])('自然路径说明拒绝非法目标且不写入：%s', async kind => {
  const imported = await upload('import', workbook([
    ['00SQL参考手册.md', '', '', '', '原根说明', '兼容性'],
    ['基础SQL元素', '00基础SQL元素.md', '', '', '原目录说明', '兼容性'],
  ]), { confirmDuplicate: true });
  expect(imported.status).toBe(201);
  const candidate = imported.body.data;
  const nodeId = kind === 'directory' ? candidate.content.nodes.find(node => node.kind === 'directory').id : 'missing-node';
  const before = fs.readFileSync(path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json'));
  const response = await fetch(`${base}/api/outline/governance/${candidate.id}/governance`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descriptions: [{ nodeId, description: '不应写入' }], assignments: [] }),
  });
  expect(response.status).toBe(422);
  expect((await response.json()).error.code).toBe('INVALID_DOMAIN_PAYLOAD');
  expect(fs.readFileSync(path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json'))).toEqual(before);
});
