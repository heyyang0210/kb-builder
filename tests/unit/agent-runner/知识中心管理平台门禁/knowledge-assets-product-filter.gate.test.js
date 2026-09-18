const { queryKnowledgeAssets } = require('../../../../packages/agent-runner-core/lib/knowledge-asset-utils');

const handbook = (productId, productName, handbookId) => ({
  handbookId,
  name: `${productName} 手册`,
  productId,
  productName,
  outline: { bindingStatus: 'not_created' },
  documentSummary: {},
});

describe('知识资产产品筛选业务语义门禁', () => {
  const payload = {
    handbooks: [
      handbook(1, 'DB', 'DB-001'),
      handbook(2, 'YMP', 'YMP-001'),
      handbook(3, 'YCM', 'YCM-001'),
      handbook(4, 'YDC', 'YDC-001'),
    ],
  };

  test('筛选项保留内部 ID 作为值，但只展示业务产品名称', () => {
    const result = queryKnowledgeAssets(payload, new URLSearchParams('pageSize=100'), false);

    expect(result.products).toEqual([
      { id: '1', name: 'DB' },
      { id: '2', name: 'YMP' },
      { id: '3', name: 'YCM' },
      { id: '4', name: 'YDC' },
    ]);
    expect(result.products.map(product => product.name)).not.toEqual(expect.arrayContaining(['1', '2', '3', '4']));
  });

  test('数字产品 ID 经 URL 字符串传递后仍能正确筛选', () => {
    const result = queryKnowledgeAssets(payload, new URLSearchParams('productId=3&pageSize=100'), false);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      handbookId: 'YCM-001',
      productId: 3,
      productName: 'YCM',
      productDisplayName: 'YCM',
    });
  });
});
