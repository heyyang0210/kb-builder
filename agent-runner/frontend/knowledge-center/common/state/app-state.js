export const views = {
  dashboard: ['工作台', '工作台'],
  assets: ['知识资产', '知识资产'],
  cleaning: ['资料清洗', '资料清洗'],
  outlines: ['大纲管理', '大纲管理'],
  templates: ['模板管理', '模板管理'],
  production: ['文档生产', '文档生产'],
  review: ['审核与发布', '审核与发布'],
  platform: ['平台管理', '平台管理'],
  repository: ['知识资产', '仓库内容'],
  stages: ['手册详情', '生产进展'],
};

export const appState = {
  activeView: 'dashboard', contextProjection: null, projection: null, outlineProjection: null, assetCatalog: null, incrementalProjection: null, gitlabProjection: null,
  outlineListState: { search: '', statusFilter: '', scrollPosition: 0 },
  selectedPermissionUserId: null,
  permissionSaveStatus: null,
  mappingState: { connectionId: null, treeItems: [], expandedPaths: new Set(), branches: [], enabledBranches: [], zhPaths: [], enPaths: [], activeLang: 'zh' },
};
