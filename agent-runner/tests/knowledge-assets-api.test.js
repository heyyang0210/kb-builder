const {
  ASSET_STATUS_LABELS,
  systemAssetStatus,
  assetStatus,
  projectAsset,
  queryKnowledgeAssets,
  isPlatformAdmin,
} = require('../frontend-server');

const handbook = (overrides = {}) => ({
  handbookId: 'DB-001',
  name: '数据库基础手册',
  productType: 'YashanDB',
  ownerA: { displayName: '张三' },
  ownerB: { displayName: '李四' },
  outline: { outlineId: null, bindingStatus: 'not_created' },
  documentSummary: { total: null, published: null, inProgress: null },
  ...overrides,
});

describe('知识资产 API 投影', () => {
  test('只有平台管理员拥有资产维护能力', () => {
    expect(isPlatformAdmin({ roles: ['PLATFORM_ADMIN'] })).toBe(true);
    expect(isPlatformAdmin({ allowedActions: ['platform:manage'] })).toBe(true);
    expect(isPlatformAdmin({ roles: ['AUTHOR'], visibleModules: ['assets'] })).toBe(false);
    expect(projectAsset(handbook(), false)).toMatchObject({ canEdit: false, canArchive: false });
    expect(projectAsset(handbook(), true)).toMatchObject({ canEdit: true, canArchive: true });
    expect(projectAsset(handbook(), false, true)).toMatchObject({ repositoryMapped: true, repository: { status: 'confirmed' } });
  });

  test('五类业务状态只由服务端事实投影', () => {
    expect(Object.values(ASSET_STATUS_LABELS)).toEqual(['待创建', '完善大纲', '大纲已发布', '内容构建中', '已发布']);
    expect(assetStatus(handbook())).toBe('asset_created');
    expect(assetStatus(handbook({ outline: { outlineId: 'ol-1', bindingStatus: 'draft' } }))).toBe('outline_editing');
    expect(assetStatus(handbook({ outline: { outlineId: 'ol-1', bindingStatus: 'published' } }))).toBe('outline_published');
    expect(assetStatus(handbook({ documentSummary: { total: 2, published: 1, inProgress: 1 } }))).toBe('content_building');
    expect(assetStatus(handbook({ documentSummary: { total: 2, published: 2, inProgress: 0 } }))).toBe('handbook_published');
    const manual = handbook({ manualStatus: { value: 'outline_editing', reason: '人工调整' }, documentSummary: { total: 2, published: 1, inProgress: 1 } });
    expect(systemAssetStatus(manual)).toBe('content_building');
    expect(projectAsset(manual, true)).toMatchObject({ status: 'outline_editing', systemStatus: 'content_building', manualStatus: 'outline_editing', statusConflict: true, assetVersion: 1 });
  });

  test('支持服务端搜索、筛选、分页和生命周期范围', () => {
    const payload = {
      generatedAt: '2026-09-02T01:00:00.000Z',
      handbooks: [
        handbook(),
        handbook({ handbookId: 'YCM-001', name: '运维手册', productType: 'YCM', ownerA: { displayName: '王五' } }),
        handbook({ handbookId: 'DB-002', name: '已归档手册', archivedAt: '2026-09-01T00:00:00.000Z' }),
      ],
    };
    const result = queryKnowledgeAssets(payload, new URLSearchParams('q=手册&owner=张三&productId=YashanDB&page=1&pageSize=1'), false);
    expect(result).toMatchObject({ page: 1, pageSize: 1, total: 1, generatedAt: payload.generatedAt });
    expect(result.items[0]).toMatchObject({ handbookId: 'DB-001', chapterCount: null, documentCount: null, runningTaskCount: null });
    expect(result.items[0]).not.toHaveProperty('pageCount');
    expect(result.statistics.asset_created).toBe(2);
    expect(queryKnowledgeAssets(payload, new URLSearchParams('includeArchived=true&pageSize=100'), true).total).toBe(3);
    expect(queryKnowledgeAssets(payload, new URLSearchParams('lifecycle=inactive&pageSize=100'), true).items.map(item => item.handbookId)).toEqual(['DB-002']);
    expect(queryKnowledgeAssets(payload, new URLSearchParams('lifecycle=active&pageSize=100'), true).total).toBe(2);
  });
});
