const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const { BrandIconError, createBrandIconStore } = require('../../../packages/agent-runner-core/lib/brand-icon-store');
const runtimeRoot = path.resolve(__dirname, '../../../runtime/test-results');

describe('品牌图标存储边界', () => {
  let root;
  let branding;
  let platform;
  beforeEach(() => {
    fs.mkdirSync(runtimeRoot, { recursive: true });
    root = fs.mkdtempSync(path.join(runtimeRoot, 'brand-icon-coverage-'));
    branding = path.join(root, 'config', 'knowledge-center', 'branding');
    fs.mkdirSync(branding, { recursive: true });
    platform = path.join(root, 'platform.json');
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  const writePlatform = icon => fs.writeFileSync(platform, JSON.stringify({ brand: { productName: '产品', icon } }));
  const store = () => createBrandIconStore({ repositoryRoot: root, platformPath: platform, brandingRoot: branding });

  test.each([
    ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
    ['.webp', 'image/webp'], ['.svg', 'image/svg+xml'],
  ])('读取支持的 %s 图标并计算指纹', (extension, mimeType) => {
    const name = `icon${extension}`;
    fs.writeFileSync(path.join(branding, name), extension === '.svg' ? '<svg/>' : Buffer.from('image'));
    writePlatform({ resourceRef: `config/knowledge-center/branding/${name}`, alt: '自定义替代文本' });
    const result = store().current();
    expect(result).toMatchObject({ mimeType, alt: '自定义替代文本', reference: `config/knowledge-center/branding/${name}` });
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.updatedAt).toEqual(expect.any(String));
  });

  test('支持省略选项并回退默认路径配置', () => {
    expect(createBrandIconStore()).toHaveProperty('current');
    expect(createBrandIconStore(undefined)).toHaveProperty('current');
    expect(createBrandIconStore({ repositoryRoot: undefined, platformPath: undefined, brandingRoot: undefined })).toHaveProperty('current');
  });

  test('缺省品牌配置和替代文本使用安全默认值', () => {
    fs.writeFileSync(path.join(branding, 'default-icon.png'), 'x');
    fs.writeFileSync(platform, JSON.stringify({ brand: { productName: '知识产品' } }));
    expect(store().current()).toMatchObject({ mimeType: 'image/png', alt: '知识产品' });
    fs.writeFileSync(platform, JSON.stringify({}));
    expect(store().current()).toMatchObject({ alt: '知识中心' });
  });

  test.each([
    '/tmp/icon.png', 'config/knowledge-center/branding/../x.png', 'config\\knowledge-center\\branding\\x.png',
    'config/knowledge-center/branding/./x.png', 42,
  ])('拒绝不安全资源引用 %p', reference => {
    writePlatform({ resourceRef: reference });
    expect(() => store().current()).toThrow(BrandIconError);
    try { store().current(); } catch (error) { expect(error.code).toBe('BRAND_ICON_PATH_FORBIDDEN'); }
  });

  test('报告缺失、越出目录和不支持格式', () => {
    writePlatform({ resourceRef: 'config/knowledge-center/branding/missing.png' });
    expect(() => store().current()).toThrow(expect.objectContaining({ code: 'BRAND_ICON_NOT_FOUND', status: 404 }));
    fs.writeFileSync(path.join(branding, 'icon.gif'), 'gif');
    writePlatform({ resourceRef: 'config/knowledge-center/branding/icon.gif' });
    expect(() => store().current()).toThrow(expect.objectContaining({ code: 'BRAND_ICON_FORMAT_UNSUPPORTED', status: 415 }));
    const outside = path.join(root, 'outside.png'); fs.writeFileSync(outside, 'x');
    fs.symlinkSync(outside, path.join(branding, 'link.png'));
    writePlatform({ resourceRef: 'config/knowledge-center/branding/link.png' });
    expect(() => store().current()).toThrow(expect.objectContaining({ code: 'BRAND_ICON_PATH_FORBIDDEN' }));
  });

  test('实际平台 HTTP 返回图标字节、摘要头与资源错误', async () => {
    const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
    const bytes = Buffer.from('fixture-icon');
    fs.writeFileSync(path.join(branding, 'icon.png'), bytes);
    for (const name of ['template.xlsx', 'sample.xlsx']) fs.writeFileSync(path.join(root, name), 'fixture');
    writePlatform({ resourceRef: 'config/knowledge-center/branding/icon.png' });
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.join(root, 'template.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'sample.xlsx'),
        PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: root, GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json'),
        GITLAB_DOCUMENT_TYPES_PATH: path.join(root, 'rules.json') },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }) }, manualStatusStore: { read: () => ({ statuses: {} }) }, brandIconStore: store() },
      moduleRegistry: { get: () => null },
      sendFile(_file, res) { res.writeHead(404); res.end(); },
      proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    const server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/knowledge-center/api/platform/brand/icon`;
    try {
      const response = await fetch(url);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(response.headers.get('etag')).toMatch(/^"[a-f0-9]{64}"$/);
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
      expect((await fetch(url, { method: 'POST' })).status).toBe(405);
      fs.unlinkSync(path.join(branding, 'icon.png'));
      const unavailable = await fetch(url);
      expect(unavailable.status).toBe(503);
      expect(await unavailable.json()).toMatchObject({ success: false, error: { code: 'BRAND_ICON_NOT_FOUND', message: '品牌图标暂不可用' } });
    } finally {
      server.closeAllConnections();
      server.close();
    }
  }, 15000);
});
