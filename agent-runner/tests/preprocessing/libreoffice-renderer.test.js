const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { LibreOfficeRenderer } = require('../../lib/preprocessing/renderers/libreoffice-renderer');
const { renderOfficeAssets } = require('../../lib/preprocessing/renderers/render-office-assets');

describe('LibreOfficeRenderer', () => {
  test('执行 PDF 转换并按页码返回 PNG', async () => {
    const calls = [];
    const commandRunner = jest.fn(async (command, args) => {
      calls.push({ command, args });
      if (args.includes('--convert-to')) {
        const outputDir = args[args.indexOf('--outdir') + 1];
        await fs.writeFile(path.join(outputDir, 'sample.pdf'), 'pdf');
      }
      if (command === 'pdftoppm' && args[0] === '-png') {
        const prefix = args[args.length - 1];
        await fs.writeFile(`${prefix}-10.png`, 'page-10');
        await fs.writeFile(`${prefix}-2.png`, 'page-2');
      }
    });
    const renderer = new LibreOfficeRenderer({ commandRunner });

    const pages = await renderer.render('/tmp/sample.pptx');

    expect(pages.map(page => page.pageNumber)).toEqual([2, 10]);
    expect(pages[0].data.toString()).toBe('page-2');
    expect(calls.some(call => call.args.includes('--headless'))).toBe(true);
    expect(calls.some(call => call.command === 'pdftoppm')).toBe(true);
  });

  test('渲染页转换为可审计 page-render 资产', async () => {
    const renderer = {
      isAvailable: jest.fn().mockResolvedValue(true),
      render: jest.fn().mockResolvedValue([
        { pageNumber: 1, fileName: 'page-1.png', mimeType: 'image/png', data: Buffer.from('page') }
      ])
    };

    const result = await renderOfficeAssets(renderer, '/tmp/a.docx', '测试文档');

    expect(result.status).toEqual({ enabled: true, status: 'success', pageCount: 1 });
    expect(result.assets[0].assetKind).toBe('page-render');
    expect(result.assets[0].renderedPage).toBe(1);
  });

  test('依赖不可用时保留明确状态', async () => {
    const result = await renderOfficeAssets({ isAvailable: async () => false }, '/tmp/a.pptx', '测试');
    expect(result.assets).toEqual([]);
    expect(result.status.status).toBe('unavailable');
  });
});

describe('LibreOfficeRenderer real integration', () => {
  const hasCommand = command => require('child_process').spawnSync('sh', ['-c', `command -v ${command}`]).status === 0;
  const realTest = hasCommand('libreoffice') && hasCommand('pdftoppm') ? test : test.skip;

  realTest('真实 PPTX 至少渲染一张 PNG', async () => {
    const sample = path.resolve(__dirname, '../../../refs/pingcode/_test_output/pipeline/files/存储引擎-Coral.pptx');
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'office-real-test-'));
    try {
      const pages = await new LibreOfficeRenderer().render(sample, outputDir);
      expect(pages.length).toBeGreaterThan(0);
      expect(pages[0].data.subarray(1, 4).toString()).toBe('PNG');
    } finally {
      await fs.rm(outputDir, { recursive: true, force: true });
    }
  }, 180000);
});
