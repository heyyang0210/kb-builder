const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { LibreOfficeRenderer } = require('../../../../packages/agent-runner-core/lib/preprocessing/renderers/libreoffice-renderer');
const { renderOfficeAssets } = require('../../../../packages/agent-runner-core/lib/preprocessing/renderers/render-office-assets');

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

  test('渲染失败时保留错误并返回零资产', async () => {
    const renderer = { isAvailable: async () => true, render: async () => { throw new Error('页面转换失败'); } };
    const result = await renderOfficeAssets(renderer, '/tmp/a.pptx', '测试');
    expect(result).toEqual({ assets: [], status: { enabled: true, status: 'failed', pageCount: 0, error: '页面转换失败' } });
  });
});

describe('LibreOfficeRenderer process boundaries', () => {
  test('依赖检查失败时拒绝转换', async () => {
    const commandRunner = jest.fn().mockRejectedValue(new Error('missing command'));
    const renderer = new LibreOfficeRenderer({ commandRunner });
    await expect(renderer.isAvailable()).resolves.toBe(false);
    await expect(renderer.render('/tmp/source.pptx')).rejects.toThrow('Office 渲染依赖不可用');
    expect(commandRunner.mock.calls.every(([, args]) => args[0] === '--version')).toBe(true);
  });

  test.each(['missing-pdf', 'missing-png', 'convert-error', 'image-error'])(
    '%s 失败保留外部目录并清理临时文件', async failure => {
      const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'office-boundary-'));
      let workingDir;
      const commandRunner = jest.fn(async (command, args, options) => {
        expect(options.timeout).toBe(4321);
        if (args.includes('--convert-to')) {
          const convertedDir = args[args.indexOf('--outdir') + 1];
          workingDir = path.dirname(convertedDir);
          expect(command).toBe('custom-office');
          expect(args[args.length - 1]).toBe('/tmp/source.pptx');
          if (failure === 'convert-error') throw new Error('conversion failed');
          if (failure !== 'missing-pdf') await fs.writeFile(path.join(convertedDir, 'source.PDF'), 'pdf');
        }
        if (args[0] === '-png') {
          expect(command).toBe('custom-image');
          expect(args.slice(0, 3)).toEqual(['-png', '-r', '96']);
          if (failure === 'image-error') throw new Error('image failed');
        }
      });
      try {
        await fs.writeFile(path.join(outputDir, 'keep.txt'), 'keep');
        const renderer = new LibreOfficeRenderer({ command: 'custom-office', pdfToImageCommand: 'custom-image', dpi: 96, timeoutMs: 4321, commandRunner });
        const expected = { 'missing-pdf': 'LibreOffice 未生成 PDF 文件', 'missing-png': 'PDF 转图未生成 PNG 页面', 'convert-error': 'conversion failed', 'image-error': 'image failed' };
        await expect(renderer.render('/tmp/source.pptx', outputDir)).rejects.toThrow(expected[failure]);
        expect(workingDir).toBeTruthy();
        await expect(fs.stat(workingDir)).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(fs.readFile(path.join(outputDir, 'keep.txt'), 'utf8')).resolves.toBe('keep');
      } finally {
        await fs.rm(outputDir, { recursive: true, force: true });
      }
    }
  );

  test('无页码文件名返回零且目录URL编码特殊字符', () => {
    const renderer = new LibreOfficeRenderer();
    expect(renderer.pageNumber('unrelated.png')).toBe(0);
    expect(renderer.fileUrl('/tmp/中文 profile')).toBe('file:///tmp/%E4%B8%AD%E6%96%87%20profile');
  });
});

describe('LibreOfficeRenderer real integration', () => {
  const hasCommand = command => require('child_process').spawnSync('sh', ['-c', `command -v ${command}`]).status === 0;
  const realTest = hasCommand('libreoffice') && hasCommand('pdftoppm') ? test : test.skip;

  realTest('真实 PPTX 至少渲染一张 PNG', async () => {
    const sample = path.resolve(__dirname, '../../../../knowledge/refs/pingcode/_test_output/pipeline/files/存储引擎-Coral.pptx');
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
