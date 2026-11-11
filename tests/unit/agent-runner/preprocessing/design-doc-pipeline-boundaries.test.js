const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const { DesignDocPipeline } = require('../../../../packages/agent-runner-core/lib/preprocessing/pipelines/design-doc-pipeline');
const { OpenAICompatibleImageCaptionProvider } = require('../../../../packages/agent-runner-core/lib/preprocessing/captioning/openai-compatible-image-caption-provider');
const { LibreOfficeRenderer } = require('../../../../packages/agent-runner-core/lib/preprocessing/renderers/libreoffice-renderer');

const { NormalizedDocument } = require('../../../../packages/agent-runner-core/lib/preprocessing/source-adapter');

const ROOT = path.resolve(__dirname, '../../../../runtime/test-tmp');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSFEAAAAASUVORK5CYII=', 'base64');

function createDocx(filePath, text, media = false) {
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
  zip.addFile('_rels/.rels', Buffer.from('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'));
  zip.addFile('word/document.xml', Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${text.map(line => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`));
  if (media) zip.addFile('word/media/image1.png', PNG);
  zip.writeZip(filePath);
}

async function json(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

describe('DesignDocPipeline 公开边界与产物回读', () => {
  let dir;
  let output;
  beforeEach(async () => {
    await fs.mkdir(ROOT, { recursive: true });
    dir = await fs.mkdtemp(path.join(ROOT, 'pipeline-boundaries-'));
    output = path.join(dir, 'output');
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('公开服务工厂按开关、provider 与显式实例选择', () => {
    const pipeline = new DesignDocPipeline();
    expect(pipeline.name).toBe('design-docs');
    expect(pipeline.adapter.adapters.find(adapter => adapter.name === 'archive').chain).toBe(pipeline.adapter);
    expect(pipeline.createCaptionProvider({})).toBeNull();
    expect(pipeline.createCaptionProvider({ enabled: true, provider: 'other' })).toBeNull();
    expect(pipeline.createCaptionProvider({ enabled: true, provider: 'openai-compatible', client: {} })).toBeInstanceOf(OpenAICompatibleImageCaptionProvider);
    const provider = { caption: async () => '说明。' };
    expect(pipeline.createCaptionProvider({ providerInstance: provider })).toBe(provider);
    expect(pipeline.createOfficeRenderer({})).toBeNull();
    expect(pipeline.createOfficeRenderer({ enabled: true, provider: 'other' })).toBeNull();
    expect(pipeline.createOfficeRenderer({ enabled: true, provider: 'libreoffice' })).toBeInstanceOf(LibreOfficeRenderer);
    const renderer = { isAvailable: async () => false };
    expect(pipeline.createOfficeRenderer({ rendererInstance: renderer })).toBe(renderer);
  });

  test('真实解析失败后继续，低质量文件仍记 hash 并清除旧产物', async () => {
    const broken = path.join(dir, 'broken.docx');
    const short = path.join(dir, 'short.md');
    const good = path.join(dir, 'good.md');
    await fs.writeFile(broken, 'not an OOXML archive');
    await fs.writeFile(short, '# 空标题');
    await fs.writeFile(good, '# 数据库恢复\n\n' + '恢复前检查备份校验值，恢复后检查数据一致性。'.repeat(8));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const pipeline = new DesignDocPipeline();
    const cleaned = await pipeline.clean([{ filePath: broken, hash: 'broken' }, { filePath: short, hash: 'short' }, { filePath: good, hash: 'good' }], {});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(broken), expect.any(String));
    expect(cleaned.map(item => item.filePath)).toEqual([good]);
    expect(pipeline.getFileHashes()[short]).toEqual(expect.objectContaining({ hash: 'short', quality_status: 'discard' }));
    await fs.mkdir(path.join(output, 'cleaned'), { recursive: true });
    await fs.writeFile(path.join(output, 'cleaned', 'short.md'), '旧内容');
    await pipeline.writeOutput(cleaned, null, null, output);
    await expect(fs.access(path.join(output, 'cleaned', 'short.md'))).rejects.toMatchObject({ code: 'ENOENT' });
    const filtered = await json(path.join(output, 'cleaned', '_quality-filter.json'));
    expect(filtered).toMatchObject({ kept: 1, discarded: 1 });
    expect((await json(path.join(output, 'cleaned', '_office-rendering.json'))).results).toEqual(expect.arrayContaining([expect.objectContaining({ sourceFormat: 'markdown', status: 'not-applicable' })]));
    await pipeline.writeOutput(cleaned, null, null, output); // 已不存在的旧产出不报错
  });

  test.each([true, false])('文本召回失败：failOnCritical=%s 的隔离或保留产物可回读', async failOnCritical => {
    const filePath = path.join(dir, 'source.docx');
    createDocx(filePath, ['Created by Alice on 2024-01-18', '保留正文'], true);
    const pipeline = new DesignDocPipeline({ qualityFilter: { enabled: false } });
    const cleaned = await pipeline.clean([{ filePath, hash: 'source' }], { quality: { failOnCritical } });
    expect(cleaned).toHaveLength(failOnCritical ? 0 : 1);
    if (!failOnCritical) expect(cleaned[0].fidelity).toMatchObject({ passed: false });
    await pipeline.writeOutput(cleaned, null, null, output);
    const stats = await json(path.join(output, 'cleaned', '_index.json'));
    expect(stats.changes_summary.quarantined).toBe(failOnCritical ? 1 : 0);
    if (failOnCritical) {
      const [docId] = await fs.readdir(path.join(output, 'quarantine'));
      const packageDir = path.join(output, 'quarantine', docId);
      expect(await fs.readFile(path.join(packageDir, 'source.md'), 'utf8')).toContain('Created by Alice');
      expect(await fs.readFile(path.join(packageDir, 'document.md'), 'utf8')).not.toContain('Created by Alice');
      expect(await json(path.join(packageDir, 'quarantine.json'))).toMatchObject({ docId, sourcePath: filePath, fidelity: { passed: false } });
      const [assetName] = await fs.readdir(path.join(packageDir, 'assets'));
      expect(await fs.readFile(path.join(packageDir, 'assets', assetName))).toEqual(PNG);
    }
  });

  test('默认严重失败策略隔离无媒体文档，并在下次输出移除旧隔离包', async () => {
    const filePath = path.join(dir, 'text.docx');
    createDocx(filePath, ['Created by Alice on 2024-01-18', '正文']);
    const pipeline = new DesignDocPipeline({ qualityFilter: { enabled: false } });
    expect(await pipeline.clean([{ filePath, hash: 'text' }], {})).toEqual([]);
    await pipeline.writeOutput([], null, null, output);
    expect(await fs.readdir(path.join(output, 'quarantine'))).toHaveLength(1);
    await pipeline.clean([], {});
    await pipeline.writeOutput([], null, null, output);
    await expect(fs.access(path.join(output, 'quarantine'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('图片说明回写正文，导出资产和 manifest，清理编码旧文件', async () => {
    const rawName = encodeURIComponent('设计图') + '.docx';
    const filePath = path.join(dir, rawName);
    createDocx(filePath, ['数据库恢复设计'], true);
    const caption = jest.fn(async () => '新的图片说明。');
    const pipeline = new DesignDocPipeline({
      qualityFilter: { enabled: false },
      captioning: { enabled: true, providerInstance: { caption } },
      officeRendering: { rendererInstance: {
        isAvailable: async () => true,
        render: async () => [{ data: PNG, mimeType: 'image/png', fileName: 'page-1.png', pageNumber: 1 }]
      } }
    });
    const cleaned = await pipeline.clean([{ filePath, hash: 'media' }], {});
    expect(cleaned).toHaveLength(1);
    expect(caption).toHaveBeenCalled();
    expect(cleaned[0].content).toContain('> 图片说明：新的图片说明。');
    await fs.mkdir(path.join(output, 'cleaned'), { recursive: true });
    for (const name of ['设计图.docx', rawName, rawName + '.md']) await fs.writeFile(path.join(output, 'cleaned', name), '旧内容');
    await pipeline.writeOutput(cleaned, null, null, output);
    const docId = cleaned[0].metadata.docId;
    const manifest = await json(path.join(output, 'cleaned', docId, 'manifest.json'));
    expect(manifest).toMatchObject({ docId, sourceName: '设计图.docx', officeRendering: { status: 'disabled', pageCount: 0 } });
    expect((await json(path.join(output, 'cleaned', '_office-rendering.json'))).results[0]).toMatchObject({ status: 'success', pageCount: 1 });
    expect(manifest.sourceMetrics).not.toHaveProperty('sourceText');
    expect(manifest.assets.length).toBeGreaterThan(0);
    for (const asset of manifest.assets) {
      expect(asset).not.toHaveProperty('data');
      expect(await fs.readFile(path.join(output, 'cleaned', docId, 'assets', asset.fileName))).toEqual(PNG);
    }
    expect(await fs.readFile(path.join(output, 'cleaned', '设计图.docx.md'), 'utf8')).toContain(`](${docId}/assets/`);
    for (const name of ['设计图.docx', rawName, rawName + '.md']) await expect(fs.access(path.join(output, 'cleaned', name))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('公开输出支持缺省 metadata 和 doc，保留兼容 Markdown，diff 准确记录删除行', async () => {
    const pipeline = new DesignDocPipeline();
    await pipeline.writeOutput([{ filePath: 'plain.md', content: '# 正文\n内容' }], null, null, output);
    expect(await fs.readFile(path.join(output, 'cleaned', 'plain.md'), 'utf8')).toBe('# 正文\n内容');
    const entries = await fs.readdir(path.join(output, 'cleaned'));
    const packageName = entries.find(name => name.startsWith('doc-'));
    expect(await fs.readFile(path.join(output, 'cleaned', packageName, 'source.md'), 'utf8')).toBe('# 正文\n内容');
    expect(await json(path.join(output, 'cleaned', packageName, 'manifest.json'))).toMatchObject({ rawSourceName: 'plain.md', sourceMetrics: {}, assets: [], officeRendering: { status: 'disabled' } });
    expect(pipeline.buildCleaningDiff('重复\n保留\n删除\n', '---\ntitle: 标题\n---\n保留\n')).toMatchObject({ removedLineCount: 2, removedLines: ['重复', '删除'] });
    expect(pipeline.aggregateCleanStats([{ changes: ['meta_removed', 'unknown'], metadata: { assets: [{}, {}] } }, {}])).toMatchObject({ total: 2, media_assets: 2, meta_removed: 1 });
  });

  test.each(['filtered', 'legacy'])('旧%s路径是目录时传播写入错误', async mode => {
    const pipeline = new DesignDocPipeline();
    let cleaned = [];
    let stale;
    if (mode === 'filtered') {
      const filePath = path.join(dir, 'short.md');
      await fs.writeFile(filePath, '# 标题');
      cleaned = await pipeline.clean([{ filePath, hash: 'short' }], {});
      stale = 'short.md';
    } else {
      cleaned = [{ filePath: 'legacy.docx', content: '正文' }];
      stale = 'legacy.docx';
    }
    await fs.mkdir(path.join(output, 'cleaned', stale), { recursive: true });
    await expect(pipeline.writeOutput(cleaned, null, null, output)).rejects.toMatchObject({ code: 'EISDIR' });
  });

  test('分块关闭与 metadata 回退，错误文档不阻塞后续真实分块', async () => {
    const pipeline = new DesignDocPipeline({ chunking: { minTokens: 1, maxTokens: 50 } });
    expect(await pipeline.chunk([], { chunking: { enabled: false } })).toBeNull();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const chunks = await pipeline.chunk([
      { filePath: 'bad.md' },
      { filePath: 'good.md', content: '# 恢复\n\n恢复数据库需要备份。', doc: { metadata: { title: '恢复', originalFile: 'features/恢复/good.md', hash: 'good' } } },
      { filePath: 'other.md', content: '# 其他\n\n其他操作需要记录。', metadata: { title: '其他', hash: 'other' } }
    ], {});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('bad.md'), expect.any(String));
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some(chunk => JSON.stringify(chunk).includes('恢复数据库需要备份'))).toBe(true);
    await pipeline.writeOutput([], chunks, null, output);
    expect(await json(path.join(output, 'cleaned', '_classification.json'))).toMatchObject({ classified: 1, unclassified: 1 });
  });

  test('公开适配器扩展未提供 hash 时采用扫描 hash，补齐文档身份', async () => {
    const filePath = path.join(dir, 'extension.custom');
    await fs.writeFile(filePath, '# 扩展文档\n\n这是公开适配器读取的真实文件。');
    const pipeline = new DesignDocPipeline({ qualityFilter: { enabled: false } });
    pipeline.adapter.addAdapter({
      canHandle: name => name.endsWith('.custom'),
      parse: async sourcePath => new NormalizedDocument({
        title: '扩展文档', content: await fs.readFile(sourcePath, 'utf8'),
        metadata: { sourcePath, sourceFormat: 'custom' }
      })
    });
    const [item] = await pipeline.clean([{ filePath, hash: 'abcdef0123456789' }], {});
    expect(item.metadata).toMatchObject({ hash: 'abcdef0123456789', docId: 'doc-abcdef012345', sourceName: 'extension.custom' });
    await pipeline.writeOutput([item], null, null, output);
    expect(await json(path.join(output, 'cleaned', item.metadata.docId, 'manifest.json'))).toMatchObject({ sourceHash: 'abcdef0123456789' });
  });

  test('删除源文件时清理 cleaned，容忍缺失路径与 chunks 目录', async () => {
    const pipeline = new DesignDocPipeline();
    await fs.mkdir(path.join(output, 'cleaned'), { recursive: true });
    await fs.mkdir(path.join(output, 'chunks', 'v1'), { recursive: true });
    await fs.writeFile(path.join(output, 'cleaned', 'old.md'), '旧产物');
    await pipeline.cleanupDeleted([{ filePath: 'old.md' }, { filePath: 'missing.md' }], output);
    await expect(fs.access(path.join(output, 'cleaned', 'old.md'))).rejects.toMatchObject({ code: 'ENOENT' });
    await fs.rm(path.join(output, 'chunks'), { recursive: true });
    await expect(pipeline.cleanupDeleted([{ filePath: 'missing.md' }], output)).resolves.toBeUndefined();
  });
});
