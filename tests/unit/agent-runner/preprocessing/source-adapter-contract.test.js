const fs = require('node:fs/promises');
const path = require('node:path');
const { SourceAdapter, NormalizedDocument } = require('../../../../packages/agent-runner-core/lib/preprocessing/source-adapter');

describe('源文档适配器公共协议', () => {
  test('未实现的适配器接口提供明确错误', async () => {
    const adapter = new SourceAdapter();
    expect(() => adapter.name).toThrow('SourceAdapter.name must be implemented');
    expect(() => adapter.supportedExtensions).toThrow('SourceAdapter.supportedExtensions must be implemented');
    await expect(adapter.parse('unused.md')).rejects.toThrow('SourceAdapter.parse must be implemented');
    await expect(adapter.scan('unused')).rejects.toThrow('SourceAdapter.scan must be implemented');
    await expect(adapter.scan('unused', '*.md')).rejects.toThrow('SourceAdapter.scan must be implemented');
  });
  test('扩展名匹配不区分大小写，不将目录名当作扩展名', () => {
    class MarkdownAdapter extends SourceAdapter { get supportedExtensions() { return ['.md', '.markdown']; } }
    const adapter = new MarkdownAdapter();
    expect(adapter.canHandle('/docs/中文.MD')).toBe(true);
    expect(adapter.canHandle('/docs/other.MarkDown')).toBe(true);
    expect(adapter.canHandle('/docs.md/no-extension')).toBe(false);
    expect(adapter.canHandle('/docs/file.pdf')).toBe(false);
  });
  test('哈希来自真实文件字节且缺文件不伪造结果', async () => {
    const runtime = path.resolve(__dirname, '../../../../runtime/test-results');
    await fs.mkdir(runtime, { recursive: true });
    const root = await fs.mkdtemp(path.join(runtime, 'source-adapter-'));
    try {
      const file = path.join(root, 'source.txt');
      const adapter = new SourceAdapter();
      await fs.writeFile(file, 'abc');
      expect(await adapter.computeHash(file)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      await fs.writeFile(file, '');
      expect(await adapter.computeHash(file)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      await fs.unlink(file);
      await expect(adapter.computeHash(file)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  test('空文档提供可序列化默认元数据和一行空正文', () => {
    const doc = new NormalizedDocument({});
    expect(doc.toJSON()).toMatchObject({ title: '', content: '', hash: '', lineCount: 1,
      metadata: { sourcePath: '', keywords: [], assets: [], sourceMetrics: {}, officeRendering: null, extra: {} } });
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc.toJSON());
  });
  test('完整元数据与多行正文保留，顶层元数据投影独立', () => {
    const metadata = { sourcePath: 'docs/a.md', sourceFormat: 'md', version: '1', docType: 'guide', author: '作者', createdDate: '2026-11-11',
      keywords: ['数据库'], hash: 'document-hash', docId: 'doc-1', sourceName: 'a.md', rawSourceName: '原稿.md',
      assets: [{ path: 'image.png' }], sourceMetrics: { pages: 2 }, officeRendering: { status: 'ready' }, extra: { language: 'zh' } };
    const doc = new NormalizedDocument({ title: '标题', content: '第一行\n第二行\n', metadata });
    const json = doc.toJSON();
    expect(json).toEqual({ title: '标题', content: '第一行\n第二行\n', metadata, hash: 'document-hash', lineCount: 3 });
    json.metadata.author = '投影编辑';
    expect(doc.metadata.author).toBe('作者');
  });
});
