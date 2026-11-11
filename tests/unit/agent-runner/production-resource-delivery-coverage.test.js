const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createProductionResourceDelivery } = require('../../../packages/agent-runner-core/lib/production-resource-delivery');
const { MAX_FILE_BYTES } = require('../../../packages/agent-runner-core/lib/gitlab-connector');

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex');
const context = { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'v1', branch: 'main' };
const attachment = '/knowledge-center/api/production/attachments/photo';
let root;
beforeEach(() => {
  const parent = path.resolve(__dirname, '../../../runtime/test-tmp');
  fs.mkdirSync(parent, { recursive: true });
  root = fs.mkdtempSync(path.join(parent, 'resource-delivery-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function fixture(options = {}) {
  let bytes = png;
  const delivery = createProductionResourceDelivery({
    root,
    policy: () => ({ version: 'fixture-v1', resourceDirectory: 'assets', maxCount: 2, maxBytes: 1000, maxTotalBytes: 2000 }),
    readAttachment: () => ({ metadata: { ...context, kind: 'image', digest: digest(bytes) }, buffer: bytes }),
    readSourceImage: () => ({ data: bytes }),
    ...options,
  });
  const document = { ...context, filePath: 'docs/page.md', markdown: `![示例](${attachment})` };
  return { delivery, document, setBytes: value => { bytes = value; }, prepare: (doc = document, revision = { attachmentIds: ['photo'] }, authorize = () => {}) => delivery.prepare(doc, revision, { principalId: 'author' }, authorize) };
}
function sourceUrl(extra = '') {
  return `/knowledge-center/api/production/handbooks/HB-1/documents/doc-1/ai-sources/images/${digest(png)}?outlineVersionId=v1&branch=main${extra}`;
}
const rejected = (run, code, status) => {
  expect(run).toThrow(expect.objectContaining({ code, ...(status ? { status } : {}) }));
};

test('Markdown 和 HTML 共用同一冻结资源，重复准备仍可读取原始字节', () => {
  const f = fixture(); const authorized = [];
  const code = `\`<img src="${attachment}">\`\n\n\`\`\`html\n<img src="${attachment}">\n\`\`\``;
  const markdown = `正文 <img src='${attachment}' alt='图'>\n\n![示例](${attachment})\n\n${code}`;
  const result = f.prepare({ ...f.document, markdown }, undefined, p => authorized.push(p));
  const target = `docs/assets/${digest(png)}.png`;
  expect(result.markdown).toBe(`正文 <img src="assets/${digest(png)}.png" alt='图'>\n\n![示例](assets/${digest(png)}.png)\n\n${code}`);
  expect(result.managedResources).toEqual([{ path: target, size: png.length, contentDigest: digest(png), delivery: 'create', snapshotVersion: 'fixture-v1' }]);
  expect(authorized.length).toBeGreaterThanOrEqual(2);
  expect(authorized.every(p => p === target)).toBe(true);
  expect(f.delivery.readFrozen(result.managedResources[0])).toEqual(png);
  expect(f.prepare().managedResources).toEqual(result.managedResources);
});

test('来源图片验证上下文后冻结；外部普通链接保持原文', () => {
  const readSourceImage = jest.fn(() => ({ data: png })); const f = fixture({ readSourceImage });
  const result = f.prepare({ ...f.document, markdown: `![来源](${sourceUrl()})\n\n[外部](https://example.org/doc)` }, {});
  expect(result.markdown).toBe(`![来源](assets/${digest(png)}.png)\n\n[外部](https://example.org/doc)`);
  expect(readSourceImage).toHaveBeenCalledWith(expect.objectContaining({ ...context, assetId: digest(png) }), { principalId: 'author' });
  expect(f.delivery.readFrozen(result.managedResources[0])).toEqual(png);
});

test.each([
  ['无策略', null], ['非法目录', { resourceDirectory: '../assets' }], ['零数量', { maxCount: 0 }],
  ['小数', { maxBytes: 1.5 }], ['超过 GitLab 单文件上限', { maxBytes: MAX_FILE_BYTES + 1 }],
])('交付策略拒绝：%s', (_, overrides) => {
  const policy = overrides && { version: 'v1', resourceDirectory: 'assets', maxCount: 2, maxBytes: 1000, maxTotalBytes: 2000, ...overrides };
  rejected(() => fixture({ policy: () => policy }).prepare(), 'GITLAB_RESOURCE_POLICY_INVALID');
});

test.each(['?token=x', '#fragment'])('附件查询或片段拒绝：%s', suffix => {
  const f = fixture(); rejected(() => f.prepare({ ...f.document, markdown: `![](${attachment}${suffix})` }), 'ATTACHMENT_CONTEXT_MISMATCH');
});
test.each(['handbookId', 'documentId', 'outlineVersionId', 'branch'])('附件上下文 %s 不一致时拒绝', key => {
  const f = fixture({ readAttachment: () => ({ metadata: { ...context, [key]: 'other', kind: 'image', digest: digest(png) }, buffer: png }) });
  rejected(() => f.prepare(), 'ATTACHMENT_CONTEXT_MISMATCH');
});
test.each(['document', 'bad-digest'])('附件类型或摘要改变拒绝：%s', kind => {
  const f = fixture({ readAttachment: () => ({ metadata: { ...context, kind, digest: 'forged' }, buffer: png }) });
  rejected(() => f.prepare(), 'GITLAB_RESOURCE_SNAPSHOT_CHANGED');
});
test.each(['&branch=main', '&outlineVersionId=v1', '&extra=x', '#fragment'])('来源查询多值或额外上下文拒绝：%s', suffix => {
  const f = fixture(); rejected(() => f.prepare({ ...f.document, markdown: `![](${sourceUrl(suffix)})` }, {}), 'GITLAB_RESOURCE_CONTEXT_MISMATCH');
});
test.each(['handbooks/other/', 'documents/other/'])('来源文档归属拒绝：%s', segment => {
  const f = fixture(); const url = sourceUrl().replace(segment.startsWith('handbooks') ? 'handbooks/HB-1/' : 'documents/doc-1/', segment);
  rejected(() => f.prepare({ ...f.document, markdown: `![](${url})` }, {}), 'GITLAB_RESOURCE_CONTEXT_MISMATCH');
});
test.each([null, Buffer.from('corrupt')])('来源图片字节与引用摘要不匹配：%s', data => {
  const f = fixture({ readSourceImage: () => ({ data }) });
  rejected(() => f.prepare({ ...f.document, markdown: `![](${sourceUrl()})` }, {}), 'GITLAB_RESOURCE_SNAPSHOT_CHANGED');
});

test('未知站内引用、未引用附件和无效图片格式均拒绝', () => {
  const f = fixture();
  rejected(() => f.prepare({ ...f.document, markdown: '![](/knowledge-center/api/production/unknown)' }, {}), 'GITLAB_RESOURCE_DELIVERY_UNSUPPORTED');
  rejected(() => f.prepare({ ...f.document, markdown: '无图片' }), 'ATTACHMENT_DELIVERY_UNSUPPORTED');
  f.setBytes(Buffer.from('not an image'));
  rejected(() => f.prepare(), 'GITLAB_RESOURCE_TYPE_NOT_ALLOWED');
});

test.each([
  ['单图', { maxBytes: png.length - 1 }, false],
  ['总量', { maxTotalBytes: png.length - 1 }, false],
  ['数量', { maxCount: 1 }, true],
])('图片%s配额拒绝且不写出快照', (_, overrides, two) => {
  const second = Buffer.concat([png, Buffer.from('second')]);
  const f = fixture({
    policy: () => ({ resourceDirectory: 'assets', maxCount: 2, maxBytes: 1000, maxTotalBytes: 2000, ...overrides }),
    readAttachment: id => { const bytes = id === 'second' ? second : png; return { metadata: { ...context, kind: 'image', digest: digest(bytes) }, buffer: bytes }; },
  });
  rejected(() => f.prepare({ ...f.document, markdown: f.document.markdown + (two ? '\n![](/knowledge-center/api/production/attachments/second)' : '') }, { attachmentIds: two ? ['photo', 'second'] : ['photo'] }), 'GITLAB_RESOURCE_TOO_LARGE');
  expect(fs.readdirSync(root)).toEqual([]);
});

test('路径授权拒绝传播且不写出快照', () => {
  const f = fixture(); const denied = new Error('目录禁止');
  expect(() => f.prepare(undefined, undefined, () => { throw denied; })).toThrow(denied);
  expect(fs.readdirSync(root)).toEqual([]);
});

test('已有同名快照损坏时准备失败', () => {
  const f = fixture(); fs.writeFileSync(path.join(root, digest(png)), 'corrupt');
  rejected(() => f.prepare(), 'GITLAB_RESOURCE_SNAPSHOT_CHANGED');
});
test('快照目录不可创建时保留真实文件系统错误', () => {
  const f = fixture({ root: path.join(root, 'file', 'child') });
  fs.writeFileSync(path.join(root, 'file'), 'file');
  expect(() => f.prepare()).toThrow(expect.objectContaining({ code: expect.stringMatching(/ENOTDIR|EEXIST/) }));
});
test.each([
  { delivery: 'update', contentDigest: digest(png) },
  { delivery: 'create', contentDigest: '../bad' },
  { delivery: 'create', contentDigest: digest(png), size: png.length },
])('冻结快照非法或缺失时拒绝', resource => {
  rejected(() => fixture().delivery.readFrozen(resource), 'GITLAB_RESOURCE_SNAPSHOT_CHANGED');
});
test('冻结快照验证长度、摘要和图片格式', () => {
  const f = fixture(); const resource = f.prepare().managedResources[0];
  rejected(() => f.delivery.readFrozen({ ...resource, size: 1 }), 'GITLAB_RESOURCE_SNAPSHOT_CHANGED');
  fs.writeFileSync(path.join(root, resource.contentDigest), Buffer.alloc(png.length));
  rejected(() => f.delivery.readFrozen(resource), 'GITLAB_RESOURCE_SNAPSHOT_CHANGED');
  const text = Buffer.from('plain text'); fs.writeFileSync(path.join(root, digest(text)), text);
  rejected(() => f.delivery.readFrozen({ delivery: 'create', contentDigest: digest(text), size: text.length }), 'GITLAB_RESOURCE_SNAPSHOT_CHANGED');
});

test('默认仓库策略可用于无图片正文且无需附件读取', () => {
  const delivery = createProductionResourceDelivery({ root });
  expect(delivery.prepare({ ...context, filePath: 'docs/page.md', markdown: '# 正文' }, {}, {}, () => {})).toEqual({ markdown: '# 正文', managedResources: [] });
});
test('HTML 代码容器不参与交付，普通相对图片仍授权', () => {
  const f = fixture(); const paths = [];
  const markdown = `<pre><img src="${attachment}"></pre>\n\n<code><img src="${attachment}"></code>\n\n![已有](assets/existing.png)`;
  const result = f.prepare({ ...f.document, markdown }, {}, p => paths.push(p));
  expect(result).toEqual({ markdown, managedResources: [] });
  expect(paths).toContain('docs/assets/existing.png');
});
test('内联代码重复出现的 HTML 不被替换，正文真实图片被改写', () => {
  const f = fixture(); const tag = `<img src="${attachment}">`;
  const markdown = `示例 \`${tag}\` 后 ${tag}`;
  const result = f.prepare({ ...f.document, markdown });
  expect(result.markdown).toBe(`示例 \`${tag}\` 后 <img src="assets/${digest(png)}.png">`);
  expect(result.managedResources).toHaveLength(1);
});


test('HTML 图片缺少 src 时被资源回读校验拒绝', () => {
  const f = fixture();
  rejected(() => f.prepare({ ...f.document, markdown: '<img alt="无来源">' }, {}), 'GITLAB_RESOURCE_DELIVERY_UNSUPPORTED');
});
