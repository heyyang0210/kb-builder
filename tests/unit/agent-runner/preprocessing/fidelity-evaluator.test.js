const { tokenRecall, evaluateFidelity } = require('../../../../packages/agent-runner-core/lib/preprocessing/fidelity-evaluator');
const { AssetCaptioner } = require('../../../../packages/agent-runner-core/lib/preprocessing/captioning/asset-captioner');

describe('FidelityEvaluator', () => {
  test('应忽略 Markdown 标记并计算源文本召回率', () => {
    expect(tokenRecall('持久化 Redo 日志', '# 持久化\n\n**Redo** 日志')).toBe(1);
  });

  test('媒体未导出时应不通过', () => {
    const result = evaluateFidelity({
      content: '# 文档',
      doc: { content: '# 文档' },
      metadata: {
        title: '文档',
        sourceMetrics: { sourceText: '文档', mediaCount: 1 },
        assets: []
      }
    });
    expect(result.passed).toBe(false);
    expect(result.mediaCoverage).toBe(0);
  });

  test('文本、资产、引用和说明完整时应通过', () => {
    const result = evaluateFidelity({
      content: '# 文档\n\n![图](assets/a.png)\n\n> 图片说明：架构图。',
      metadata: {
        title: '文档',
        sourceMetrics: { sourceText: '文档', mediaCount: 1 },
        assets: [{ relativePath: 'assets/a.png', caption: '架构图。' }]
      }
    });
    expect(result.passed).toBe(true);
  });
});

describe('AssetCaptioner', () => {
  test('应用视觉模型说明替换上下文兜底说明', async () => {
    const provider = { caption: jest.fn().mockResolvedValue('图中展示 Redo 日志写入持久化文件的流程。') };
    const captioner = new AssetCaptioner({ enabled: true, provider });
    const assets = [{ assetId: 'a', caption: '兜底说明。', sourcePart: 'word/media/image1.png' }];

    await captioner.enrich(assets, { title: '持久化' });

    expect(assets[0].captionSource).toBe('vision-model');
    expect(assets[0].caption).toContain('Redo');
  });

  test('整页渲染资产使用页码作为视觉上下文', async () => {
    const provider = { caption: jest.fn().mockResolvedValue('页面图。') };
    const captioner = new AssetCaptioner({ enabled: true, provider });
    const assets = [{ data: Buffer.from('x'), placements: [{ page: 2 }], sourcePart: 'rendered/page-2.png' }];

    await captioner.enrich(assets, { title: '文档' });

    expect(provider.caption).toHaveBeenCalledWith(assets[0], expect.objectContaining({ location: '第 2 页' }));
  });
});
