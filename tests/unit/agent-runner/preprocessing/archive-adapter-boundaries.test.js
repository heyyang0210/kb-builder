const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const zlib = require('node:zlib');
const tar = require('tar-stream');
const AdmZip = require('adm-zip');
const { ArchiveAdapter } = require('../../../../packages/agent-runner-core/lib/preprocessing/cleaners/archive-adapter');
const { AdapterChain } = require('../../../../packages/agent-runner-core/lib/preprocessing/cleaners/adapter-chain');
const { MarkdownAdapter } = require('../../../../packages/agent-runner-core/lib/preprocessing/cleaners/markdown-adapter');

describe('压缩包适配器真实文件边界', () => {
  let root, temp, adapter;
  beforeEach(() => {
    const parent = path.resolve(__dirname, '../../../../runtime/test-tmp');
    fs.mkdirSync(parent, { recursive: true });
    root = fs.mkdtempSync(path.join(parent, 'archive-boundaries-')); temp = path.join(root, 'unpacked');
    adapter = new ArchiveAdapter({ tempDir: temp, chain: new AdapterChain([new MarkdownAdapter()]) });
  });
  afterEach(() => { jest.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });
  function zip(name, entries) {
    const value = new AdmZip();
    for (const [entry, content] of Object.entries(entries)) value.addFile(entry, Buffer.from(content));
    const file = path.join(root, name); value.writeZip(file); return file;
  }
  async function archive(name, entries) {
    const pack = tar.pack(); const chunks = [];
    const done = new Promise((resolve, reject) => { pack.on('data', chunk => chunks.push(chunk)); pack.on('end', resolve); pack.on('error', reject); });
    for (const [header, content] of entries) pack.entry(header, content);
    pack.finalize(); await done;
    const data = Buffer.concat(chunks); const file = path.join(root, name);
    fs.writeFileSync(file, name.endsWith('.tar') ? data : zlib.gzipSync(data)); return file;
  }

  test.each(['tar', 'tgz'])('真实 %s 忽略越界及链接，保留目录和正文并清理临时目录', async extension => {
    const file = await archive(`safe.${extension}`, [
      [{ name: '../../outside.md' }, '不应写入'],
      [{ name: 'docs', type: 'directory' }, ''],
      [{ name: 'docs/link', type: 'symlink', linkname: '/etc/passwd' }, ''],
      [{ name: 'docs/readme.md' }, '# 真实正文']
    ]);
    const result = await adapter.parse(file);
    expect(result.content).toContain('真实正文');
    expect(result.metadata.extra).toMatchObject({ extractedFileCount: 1, parsedDocumentCount: 1, extractedFiles: ['docs/readme.md'] });
    expect(fs.existsSync(path.join(root, 'outside.md'))).toBe(false);
    expect(fs.readdirSync(temp)).toEqual([]);
  });

  test.each(['tar', 'tgz'])('真实 %s 条目目录创建失败及时拒绝并清理', async extension => {
    const file = await archive(`mkdir-failure.${extension}`, [
      [{ name: 'conflict' }, '普通文件'],
      [{ name: 'conflict/child', type: 'directory' }, '']
    ]);
    await expect(adapter.parse(file)).rejects.toMatchObject({ code: 'ENOTDIR' });
    expect(fs.readdirSync(temp)).toEqual([]);
  });

  test.each(['tar', 'tgz'])('真实 %s 文件输出流失败及时拒绝并清理', async extension => {
    const file = await archive(`write-failure.${extension}`, [
      [{ name: 'conflict', type: 'directory' }, ''],
      [{ name: 'conflict' }, '无法覆盖目录']
    ]);
    await expect(adapter.parse(file)).rejects.toMatchObject({ code: 'EISDIR' });
    expect(fs.readdirSync(temp)).toEqual([]);
  });

  test('公开适配链解析失败产生错误文档并继续处理其他条目', async () => {
    const failing = { canHandle: name => name.endsWith('.bad'), parse: async () => { throw new Error('隔离解析失败'); } };
    adapter.chain = new AdapterChain([failing, new MarkdownAdapter()]);
    const result = await adapter.parse(zip('mixed.zip', { 'bad.bad': '坏数据', 'good.md': '# 正常正文', 'ignored.bin': '忽略' }));
    expect(result.content).toContain('[解析失败: 隔离解析失败]');
    expect(result.content).toContain('正常正文');
    expect(result.metadata.extra).toMatchObject({ extractedFileCount: 2, parsedDocumentCount: 2 });
    expect(fs.readdirSync(temp)).toEqual([]);
  });

  test('没有链时收集非压缩文件且不假定解析成功', async () => {
    const bare = new ArchiveAdapter({ tempDir: temp });
    expect(bare.selectAdapterFor('readme.md')).toBeNull();
    const result = await bare.parse(zip('bare.zip', { 'readme.md': '正文', 'data.bin': '数据' }));
    expect(result.metadata.extra).toMatchObject({ extractedFileCount: 2, parsedDocumentCount: 0 });
    expect(result.content).toContain('成功解析 0 个文档');
  });

  test('嵌套正常与损坏压缩包分别处理并清理嵌套输出', async () => {
    const inner = zip('inner.zip', { 'nested.md': '# 嵌套正文' });
    const result = await adapter.parse(zip('outer.zip', { 'inner.zip': fs.readFileSync(inner), 'broken.zip': 'not zip', 'top.md': '顶层正文' }));
    expect(result.content).toContain('嵌套正文'); expect(result.content).toContain('顶层正文');
    expect(result.metadata.extra).toMatchObject({ extractedFileCount: 2, parsedDocumentCount: 2 });
    expect(fs.readdirSync(temp)).toEqual([]);
  });

  test('深度上限阻止目录递归且最深层压缩文件按适配链过滤', async () => {
    const directory = path.join(root, 'tree');
    fs.mkdirSync(path.join(directory, 'one', 'two', 'three'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'one', 'two', 'three', 'hidden.md'), '不可见');
    fs.writeFileSync(path.join(directory, 'one', 'seen.md'), '可见');
    fs.writeFileSync(path.join(directory, 'one', 'deep.zip'), '不解压');
    adapter.maxDepth = 1;
    expect(await adapter.scanExtracted(directory)).toEqual([path.join(directory, 'one', 'seen.md')]);
    fs.symlinkSync(path.join(directory, 'one', 'seen.md'), path.join(directory, 'link.md'));
    expect(await adapter.scan(directory)).toEqual([path.join(directory, 'one', 'deep.zip')]);
  });

  test('缺失与无权限目录跳过，其他文件系统错误向调用者传播', async () => {
    expect(await adapter.scan(path.join(root, 'missing'))).toEqual([]);
    expect(await adapter.scanExtracted(path.join(root, 'missing'))).toEqual([]);
    const readdir = jest.spyOn(fsp, 'readdir');
    for (const method of ['scan', 'scanExtracted']) {
      readdir.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }));
      expect(await adapter[method](root)).toEqual([]);
      readdir.mockRejectedValueOnce(Object.assign(new Error('I/O failure'), { code: 'EIO' }));
      await expect(adapter[method](root)).rejects.toMatchObject({ code: 'EIO' });
    }
  });

  test('未知格式拒绝，坏ZIP清理输出，文档类型与关键词按路径提取', async () => {
    const file = path.join(root, 'unknown.bin'); fs.writeFileSync(file, 'not archive');
    await expect(adapter.extract(file, temp)).rejects.toThrow('Unsupported archive format');
    expect(adapter.detectArchiveType(file)).toBe('unknown');
    const bad = path.join(root, 'bad.zip'); fs.writeFileSync(bad, 'broken zip');
    await expect(adapter.parse(bad)).rejects.toThrow();
    expect(fs.readdirSync(temp)).toEqual([]);
    for (const type of ['特性设计', '测试设计', '需求分析', '概要设计', '开发概要', '架构设计']) expect(adapter.extractDocType(`/docs/${type}/package.zip`)).toBe(type);
    expect(adapter.extractKeywords('feature 123 1.2 alpha alpha', '/YDBRD-1234/package.zip')).toEqual(['feature', 'alpha', 'YDBRD-1234']);
  });
});
