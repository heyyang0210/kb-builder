const { readConfig: readGitLabConfig } = require('./gitlab-connector');

const ASSET_STATUS_LABELS = {
  asset_created: '待创建',
  outline_editing: '完善大纲',
  outline_published: '大纲已发布',
  content_building: '内容构建中',
  handbook_published: '已发布',
};

function systemAssetStatus(item) {
  const documents = item.documentSummary || {};
  if (Number(documents.total) > 0 && Number(documents.published) === Number(documents.total)) return 'handbook_published';
  if (Number(documents.inProgress) > 0) return 'content_building';
  const outline = item.outline || {};
  if (outline.status === 'published' || outline.bindingStatus === 'published') return 'outline_published';
  if (outline.outlineId || (outline.bindingStatus && outline.bindingStatus !== 'not_created')) return 'outline_editing';
  return 'asset_created';
}

function assetStatus(item) {
  const manual = item.manualStatus?.value || (item.status && ASSET_STATUS_LABELS[item.status] ? item.status : null);
  return manual || systemAssetStatus(item);
}

function assetCounts(item) {
  const outline = item.outline || {};
  return { chapterCount: Number.isInteger(outline.chapterCount) ? outline.chapterCount : null };
}

function projectAsset(item, admin, repositoryMapping = false) {
  const sysStatus = systemAssetStatus(item);
  const status = assetStatus(item);
  const documentCount = Number.isInteger(item.documentSummary?.total) ? item.documentSummary.total : null;
  const runningTaskCount = Number.isInteger(item.documentSummary?.runningTasks) ? item.documentSummary.runningTasks : null;
  return {
    handbookId: item.handbookId, name: item.name,
    productId: item.productId || item.productType || null,
    ownerA: item.ownerA || null, ownerB: item.ownerB || null,
    status, systemStatus: sysStatus, manualStatus: item.manualStatus?.value || null,
    statusConflict: Boolean(item.manualStatus?.value && item.manualStatus.value !== sysStatus && item.manualStatus.acknowledgedSystemStatus !== sysStatus),
    statusDisplayName: ASSET_STATUS_LABELS[status],
    systemStatusDisplayName: ASSET_STATUS_LABELS[sysStatus],
    assetVersion: Number(item.assetVersion || 1),
    ...assetCounts(item),
    documentCount, runningTaskCount,
    archived: Boolean(item.archivedAt),
    canEdit: admin, canArchive: admin && !item.archivedAt, canRestore: admin && Boolean(item.archivedAt),
    repositoryMapped: Boolean(repositoryMapping),
    repository: repositoryMapping ? { status: 'confirmed', defaultBranch: repositoryMapping.defaultBranch, enabledBranches: repositoryMapping.enabledBranches || [] } : null,
  };
}

function queryKnowledgeAssets(payload, searchParams, admin, gitlabConfigPath) {
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const owner = (searchParams.get('owner') || '').trim().toLowerCase();
  const status = (searchParams.get('status') || '').trim();
  const productId = (searchParams.get('productId') || '').trim();
  const lifecycle = (searchParams.get('lifecycle') || '').trim();
  const includeArchived = searchParams.get('includeArchived') === 'true';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('pageSize') || '20', 10) || 20));
  let mappings = new Map();
  try { mappings = new Map(readGitLabConfig(gitlabConfigPath).mappings.map(item => [item.handbookId, item])); }
  catch (_error) { mappings = new Map(); }
  const all = payload.handbooks.map(item => projectAsset(item, admin, mappings.get(item.handbookId) || false));
  const statistics = Object.fromEntries(Object.keys(ASSET_STATUS_LABELS).map(key => [key, all.filter(item => !item.archived && item.status === key).length]));
  const filtered = all.filter(item => {
    if (lifecycle === 'inactive' && !item.archived) return false;
    if (lifecycle === 'active' && item.archived) return false;
    if (!lifecycle && !includeArchived && item.archived) return false;
    const owners = `${item.ownerA?.displayName || ''} ${item.ownerB?.displayName || ''}`.toLowerCase();
    return (!q || `${item.name} ${item.handbookId}`.toLowerCase().includes(q))
      && (!owner || owners.includes(owner))
      && (!status || item.status === status)
      && (!productId || item.productId === productId);
  });
  const start = (page - 1) * pageSize;
  const products = [...new Set(payload.handbooks.map(item => item.productId || item.productType).filter(Boolean))].map(id => ({ id, name: id }));
  return { items: filtered.slice(start, start + pageSize), page, pageSize, total: filtered.length, statistics, products, generatedAt: payload.generatedAt || null };
}

function isPlatformAdmin(session) {
  const roles = session?.roles || session?.user?.roles || [];
  const actions = session?.allowedActions || session?.user?.allowedActions || [];
  return roles.includes('PLATFORM_ADMIN') || actions.includes('platform:manage');
}

module.exports = { ASSET_STATUS_LABELS, systemAssetStatus, assetStatus, assetCounts, projectAsset, queryKnowledgeAssets, isPlatformAdmin };
