const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const { ArchiveAdapter } = require('../../../../packages/agent-runner-core/lib/preprocessing/cleaners/archive-adapter');
const { AdapterChain } = require('../../../../packages/agent-runner-core/lib/preprocessing/cleaners/adapter-chain');
const { MarkdownAdapter } = require('../../../../packages/agent-runner-core/lib/preprocessing/cleaners/markdown-adapter');

const TEST_DIR = path.join(__dirname, '..', '..', 'tmp', 'test-archive-adapter-' + Date.now());

describe('ArchiveAdapter', () => {
  let adapter;
  let chain;

  beforeAll(async () => {
    chain = new AdapterChain([new MarkdownAdapter()]);
    adapter = new ArchiveAdapter({ chain });
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('basic properties', () => {
    test('name 应为 archive', () => {
      expect(adapter.name).toBe('archive');
    });

    test('supportedExtensions 应包含压缩包格式', () => {
      expect(adapter.supportedExtensions).toContain('.zip');
      expect(adapter.supportedExtensions).toContain('.tar');
      expect(adapter.supportedExtensions).toContain('.tar.gz');
      expect(adapter.supportedExtensions).toContain('.tgz');
    });

    test('canHandle 应正确识别压缩包文件', () => {
      expect(adapter.canHandle('test.zip')).toBe(true);
      expect(adapter.canHandle('test.tar')).toBe(true);
      expect(adapter.canHandle('test.tar.gz')).toBe(true);
      expect(adapter.canHandle('test.tgz')).toBe(true);
      expect(adapter.canHandle('test.ZIP')).toBe(true);
      expect(adapter.canHandle('test.TAR.GZ')).toBe(true);
      expect(adapter.canHandle('test.pdf')).toBe(false);
      expect(adapter.canHandle('test.md')).toBe(false);
    });
  });

  describe('scan', () => {
    test('应递归扫描目录中的压缩包文件', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'a.zip'), 'fake');
      await fs.writeFile(path.join(TEST_DIR, 'b.tar.gz'), 'fake');
      await fs.mkdir(path.join(TEST_DIR, 'sub'));
      await fs.writeFile(path.join(TEST_DIR, 'sub', 'c.zip'), 'fake');
      await fs.writeFile(path.join(TEST_DIR, 'd.txt'), 'not archive');

      const files = await adapter.scan(TEST_DIR);
      expect(files.length).toBe(3);
    });
  });

  describe('detectArchiveType', () => {
    test('应正确检测压缩包类型', () => {
      expect(adapter.detectArchiveType('test.zip')).toBe('zip');
      expect(adapter.detectArchiveType('test.tar.gz')).toBe('tar.gz');
      expect(adapter.detectArchiveType('test.tgz')).toBe('tar.gz');
      expect(adapter.detectArchiveType('test.tar')).toBe('tar');
    });
  });

  describe('parse ZIP', () => {
    test('应能解析包含 Markdown 文件的 ZIP', async () => {
      const zip = new AdmZip();
      zip.addFile('doc1.md', Buffer.from('# 文档1\n\n内容1'));
      zip.addFile('doc2.md', Buffer.from('# 文档2\n\n内容2'));
      zip.addFile('sub/doc3.md', Buffer.from('# 文档3\n\n内容3'));

      const filePath = path.join(TEST_DIR, 'test-docs.zip');
      zip.writeZip(filePath);

      const doc = await adapter.parse(filePath);
      expect(doc.title).toBe('test-docs');
      expect(doc.metadata.sourceFormat).toBe('zip');
      expect(doc.metadata.extra.archiveType).toBe('zip');
      expect(doc.metadata.extra.extractedFileCount).toBe(3);
      expect(doc.content).toContain('# 文档1');
      expect(doc.content).toContain('# 文档2');
      expect(doc.content).toContain('# 文档3');
      expect(doc.hash).toBeTruthy();
    });

    test('应处理空 ZIP', async () => {
      const zip = new AdmZip();
      const filePath = path.join(TEST_DIR, 'empty.zip');
      zip.writeZip(filePath);

      const doc = await adapter.parse(filePath);
      expect(doc.title).toBe('empty');
      expect(doc.metadata.extra.extractedFileCount).toBe(0);
    });

    test('应跳过非 Markdown 文件', async () => {
      const zip = new AdmZip();
      zip.addFile('doc.md', Buffer.from('# 文档'));
      zip.addFile('image.png', Buffer.from('fake png'));
      zip.addFile('data.bin', Buffer.from('fake binary'));

      const filePath = path.join(TEST_DIR, 'mixed.zip');
      zip.writeZip(filePath);

      const doc = await adapter.parse(filePath);
      expect(doc.metadata.extra.extractedFileCount).toBe(1);
      expect(doc.content).toContain('# 文档');
    });
  });

  describe('parse tar', () => {
    test('应能解析包含 Markdown 文件的 tar', async () => {
      const tar = require('tar-stream');
      const fsSync = require('fs');
      
      const filePath = path.join(TEST_DIR, 'test-docs.tar');
      
      await new Promise((resolve, reject) => {
        const pack = tar.pack();
        const output = fsSync.createWriteStream(filePath);
        
        output.on('finish', resolve);
        output.on('error', reject);
        
        pack.entry({ name: 'doc1.md' }, '# TAR文档1\n\n内容1');
        pack.entry({ name: 'doc2.md' }, '# TAR文档2\n\n内容2');
        pack.finalize();
        pack.pipe(output);
      });

      const doc = await adapter.parse(filePath);
      expect(doc.title).toBe('test-docs');
      expect(doc.metadata.sourceFormat).toBe('tar');
      expect(doc.content).toContain('# TAR文档1');
      expect(doc.content).toContain('# TAR文档2');
    });
  });

  describe('parse tar.gz', () => {
    test('应能解析包含 Markdown 文件的 tar.gz', async () => {
      const tar = require('tar-stream');
      const zlib = require('zlib');
      const fsSync = require('fs');
      
      const filePath = path.join(TEST_DIR, 'test-docs.tar.gz');
      
      await new Promise((resolve, reject) => {
        const pack = tar.pack();
        const gzip = zlib.createGzip();
        const output = fsSync.createWriteStream(filePath);
        
        output.on('finish', resolve);
        output.on('error', reject);
        
        pack.entry({ name: 'doc1.md' }, '# GZ文档1\n\n内容1');
        pack.finalize();
        pack.pipe(gzip).pipe(output);
      });

      const doc = await adapter.parse(filePath);
      expect(doc.title).toBe('test-docs');
      expect(doc.metadata.sourceFormat).toBe('tar.gz');
      expect(doc.content).toContain('# GZ文档1');
    });
  });

  describe('buildAggregateContent', () => {
    test('应构建聚合内容', () => {
      const { NormalizedDocument } = require('../../../../packages/agent-runner-core/lib/preprocessing/source-adapter');
      const docs = [
        new NormalizedDocument({
          title: '文档1',
          content: '内容1',
          metadata: { sourceFormat: 'markdown', sourcePath: '/path/doc1.md' }
        })
      ];
      const result = adapter.buildAggregateContent('测试包', docs, ['/path/doc1.md']);
      expect(result).toContain('# 测试包');
      expect(result).toContain('## 文档1');
      expect(result).toContain('内容1');
      expect(result).toContain('1 个文件');
    });
  });
});
