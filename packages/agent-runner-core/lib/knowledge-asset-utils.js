const { readConfig: readGitLabConfig } = require('./gitlab-connector');

const ASSET_STATUS_LABELS = {
  asset_created: '待创建',
  outline_editing: '完善大纲',
  outline_published: '大纲已发布',
  content_building: '内容构建中',
  handbook_published: '已发布',
};

// Canonical lifecycle membership for the review workbench.
const REVIEW_ASSET_STATUSES = new Set(['content_building', 'handbook_published']);

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
    productName: item.productName || item.productType || null,
    productDisplayName: item.productName || item.productType || null,
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
  const handbookId = (searchParams.get('handbookId') || '').trim();
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('pageSize') || '20', 10) || 20));
  let mappings = new Map();
  try {
    const config = gitlabConfigPath && typeof gitlabConfigPath === 'object'
      ? gitlabConfigPath
      : readGitLabConfig(gitlabConfigPath);
    mappings = new Map((config.mappings || []).map(item => [item.handbookId, item]));
  }
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
      && (!productId || String(item.productId) === productId);
  });
  const targetIndex = handbookId ? filtered.findIndex(item => String(item.handbookId) === handbookId) : -1;
  const resolvedPage = targetIndex >= 0 ? Math.floor(targetIndex / pageSize) + 1 : page;
  const start = (resolvedPage - 1) * pageSize;
  const productsById = new Map();
  for (const item of payload.handbooks) {
    const id = item.productId || item.productType;
    if (id === undefined || id === null || id === '') continue;
    const key = String(id);
    if (!productsById.has(key)) productsById.set(key, { id: key, name: item.productName || item.productType || key });
  }
  const products = [...productsById.values()];
  return { items: filtered.slice(start, start + pageSize), page: resolvedPage, pageSize, total: filtered.length, statistics, products, generatedAt: payload.generatedAt || null };
}

function isPlatformAdmin(session) {
  const roles = session?.roles || session?.user?.roles || [];
  const actions = session?.allowedActions || session?.user?.allowedActions || [];
  return roles.includes('PLATFORM_ADMIN') || actions.includes('platform:manage');
}

module.exports = { REVIEW_ASSET_STATUSES, ASSET_STATUS_LABELS, systemAssetStatus, assetStatus, assetCounts, projectAsset, queryKnowledgeAssets, isPlatformAdmin };
