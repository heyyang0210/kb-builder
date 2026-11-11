const fs = require('fs').promises;
const path = require('path');
jest.mock('pdf-parse', () => jest.fn());
const pdfParse = require('pdf-parse');
const { PdfAdapter } = require('../../../../packages/agent-runner-core/lib/preprocessing/cleaners/pdf-adapter');

describe('PDF适配器协议边界', () => {
  const adapter = new PdfAdapter();

  test.each([undefined, {}, {
    Title: '元数据标题', Author: '作者', CreationDate: 'D:20241231',
    Producer: '生产工具', Creator: '创建工具',
  }])('解析依赖返回元数据%j时规范化缺省与完整字段', async info => {
    const base = path.resolve(__dirname, '../../../../runtime/test-results/fixtures');
    await fs.mkdir(base, { recursive: true });
    const root = await fs.mkdtemp(path.join(base, 'pdf-metadata-'));
    const file = path.join(root, 'document.pdf');
    try {
      await fs.writeFile(file, 'abc');
      pdfParse.mockResolvedValueOnce({ info, text: '正文标题\n\npre-\nprocessing', numpages: 2 });
      const doc = await adapter.parse(file);
      expect(pdfParse).toHaveBeenLastCalledWith(Buffer.from('abc'));
      expect(doc.title).toBe(info?.Title || '正文标题');
      expect(doc.content).toBe('正文标题\n\npreprocessing');
      expect(doc.metadata).toMatchObject({
        author: info?.Author || '', createdDate: info?.CreationDate ? '2024-12-31' : '',
        sourcePath: file, sourceFormat: 'pdf',
        extra: { pageCount: 2, lineCount: 3, pdfInfo: {
          producer: info?.Producer || '', creator: info?.Creator || '',
        } },
      });
      expect(doc.hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  test('标题使用元数据、首个有效文本行或文件名', () => {
    expect(adapter.extractTitle({ info: { Title: '  元数据标题  ' }, text: '正文' }, '/docs/a.pdf')).toBe('元数据标题');
    expect(adapter.extractTitle({ info: { Title: '  ' }, text: '\n \n  首行标题 \n正文' }, '/docs/a.pdf')).toBe('首行标题');
    expect(adapter.extractTitle({ text: 'a'.repeat(99) }, '/docs/a.pdf')).toBe('a'.repeat(99));
    expect(adapter.extractTitle({ text: 'a'.repeat(100) }, '/docs/a.pdf')).toBe('a');
    expect(adapter.extractTitle({ info: {}, text: '\n  \n' }, '/docs/备用标题.pdf')).toBe('备用标题');
  });

  test.each([
    ['D:2024', '2024-01-01'], ['D:202412', '2024-12-01'],
    ['2024-12-31', '2024-12-31'],
  ])('日期%s补齐缺省部分或保留非PDF格式', (input, expected) => {
    expect(adapter.parsePdfDate(input)).toBe(expected);
  });

  test.each(['特性设计', '测试设计', '需求分析', '概要设计', '开发概要', '架构设计'])('%s目录识别文档类型', type => {
    expect(adapter.extractDocType(`/docs/${type}/a.pdf`)).toBe(type);
  });

  test('关键词过滤短词和纯版本号并去重，路径特性优先于正文', () => {
    expect(adapter.extractKeywords('标题 标题 a 12.3 主题', '/YDBRD-123/a.pdf', { text: 'YDBRD-999' }))
      .toEqual(['标题', '主题', 'YDBRD-123']);
    expect(adapter.extractKeywords('标题', '/a.pdf', { text: 'YDBRD-999' })).toEqual(['标题', 'YDBRD-999']);
    expect(adapter.extractKeywords('标题', '/a.pdf', { text: '' })).toEqual(['标题']);
    const terms = Array.from({ length: 20 }, (_, index) => `关键词${index}`);
    expect(adapter.extractKeywords(terms.join(' '), '/a.pdf', { text: '' })).toEqual(terms.slice(0, 15));
  });

  test('扫描忽略缺失目录和符号链接，非目录错误传播', async () => {
    const base = path.resolve(__dirname, '../../../../runtime/test-results/fixtures');
    await fs.mkdir(base, { recursive: true });
    const root = await fs.mkdtemp(path.join(base, 'pdf-scan-'));
    try {
      await expect(adapter.scan(path.join(root, 'missing'))).resolves.toEqual([]);
      await fs.writeFile(path.join(root, 'actual.PDF'), 'scan-only');
      await fs.symlink(path.join(root, 'actual.PDF'), path.join(root, 'alias.pdf'));
      await expect(adapter.scan(root)).resolves.toEqual([path.join(root, 'actual.PDF')]);
      await expect(adapter.scan(path.join(root, 'actual.PDF'))).rejects.toMatchObject({ code: 'ENOTDIR' });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
