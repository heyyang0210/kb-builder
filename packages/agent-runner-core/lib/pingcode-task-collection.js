const crypto = require('node:crypto');

function collectionError(code, message) {
  return Object.assign(new Error(message), { code, status: 422 });
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function pageIdentity(page) {
  return fingerprint([page.sourceType, page.sourceId, page.sourceVersion, page.count, page.pageCount,
    page.criteria || null]);
}

async function collectPingcodeTaskSource({ source, readPage, readPages, signal, onProgress = () => {},
  onPage = async () => {}, retainItems = true }) {
  if (!source || !['requirement', 'ticket'].includes(source.type)
    || typeof readPage !== 'function' && typeof readPages !== 'function') {
    throw collectionError('SOURCE_INVALID', '来源类型或读取器无效');
  }
  const items = new Map();
  const seenRows = new Set();
  const digest = crypto.createHash('sha256');
  let first = null;
  let readCount = 0;
  const batchPages = source.type === 'requirement' && readPages ? await readPages(source, signal) : null;
  if (batchPages !== null && (!Array.isArray(batchPages) || !batchPages.length || batchPages.length > 100))
    throw collectionError('SOURCE_PAGE_INVALID', '来源批量分页响应无效');
  for (let index = 0; first === null || index < first.pageCount; index += 1) {
    if (signal?.aborted) throw collectionError('COLLECTION_CANCELLED', '采集已取消');
    const page = batchPages ? batchPages[index] : await readPage(source, index, signal);
    if (!page || page.pageIndex !== index || !Array.isArray(page.items)
      || !Number.isSafeInteger(page.count) || page.count < 0
      || !Number.isSafeInteger(page.pageCount) || page.pageCount < 0
      || (page.pageCount === 0 && (page.count !== 0 || page.items.length !== 0))
      || !page.sourceId || page.sourceVersion == null
      || page.sourceType !== source.type) {
      throw collectionError('SOURCE_PAGE_INVALID', '来源分页响应不完整');
    }
    if (!first) first = { pageCount: page.pageCount, count: page.count,
      sourceId: page.sourceId, sourceVersion: page.sourceVersion,
      identity: pageIdentity(page), criteria: page.criteria || null };
    if (pageIdentity(page) !== first.identity) {
      throw collectionError('SOURCE_CHANGED', '采集期间来源版本、筛选条件或总数发生变化');
    }
    for (const row of page.items) {
      const rowId = source.type === 'requirement' ? row.irId : row.id;
      if (!rowId || seenRows.has(rowId)) throw collectionError('SOURCE_DUPLICATE', '来源分页中出现重复或缺失的稳定 ID');
      seenRows.add(rowId);
      if (source.type === 'requirement') {
        if (!/^YASHAN-\d+$/.test(row.ir || '') || !Array.isArray(row.workItems)) {
          throw collectionError('SOURCE_RELATION_INVALID', '需求编号或结构化关联不完整');
        }
        for (const work of row.workItems) {
          mergeItem(items, work, row.ir, retainItems);
        }
      } else {
        mergeItem(items, row, null, retainItems);
      }
    }
    if (signal?.aborted) throw collectionError('COLLECTION_CANCELLED', '采集已取消');
    await onPage(page, { criteriaSha256: fingerprint(page.criteria || null) });
    digest.update(JSON.stringify(page));
    readCount += page.items.length;
    onProgress({ pagesRead: index + 1, pageCount: first.pageCount, rowsRead: readCount,
      rowCount: first.count, srCount: items.size });
  }
  if (batchPages && batchPages.length !== Math.max(first.pageCount, 1))
    throw collectionError('SOURCE_PAGE_COUNT_MISMATCH', '批量分页数量与来源页数不一致');
  if (readCount !== first.count) throw collectionError('SOURCE_PAGE_COUNT_MISMATCH', '分页行数与来源总数不一致');
  return { sourceId: first.sourceId, sourceVersion: first.sourceVersion, criteria: first.criteria,
    rowCount: first.count, pageCount: first.pageCount, digest: digest.digest('hex'), srCount: items.size,
    items: retainItems ? [...items.values()].map(({ contentHash, ...item }) => ({ ...item, ir: [...item.ir].sort() })) : [] };
}

function mergeItem(items, work, ir, retainItems) {
  if (!/^YDBRD-\d+$/.test(work?.number || '') || !work.id || !work.shortId) {
    throw collectionError('SOURCE_ITEM_INVALID', '关联 SR 编号或稳定身份无效');
  }
  const existing = items.get(work.number);
  const contentHash = fingerprint([work.title || '', work.description || '']);
  if (existing && existing.id !== work.id) {
    throw collectionError('SOURCE_IDENTITY_CONFLICT', `${work.number} 对应多个上游稳定 ID`);
  }
  if (existing && existing.contentHash !== contentHash) {
    throw collectionError('SOURCE_CONTENT_CONFLICT', `${work.number} 在来源中有不同正文`);
  }
  if (existing) {
    if (ir && retainItems) existing.ir.add(ir);
    return;
  }
  items.set(work.number, { number: work.number, id: work.id, shortId: work.shortId,
    ...(retainItems ? { title: work.title || '', description: work.description || '',
      ownerId: work.ownerId || null, createdAt: work.createdAt || null,
      updatedAt: work.updatedAt || null, ir: new Set(ir ? [ir] : []) } : {}), contentHash });
}

module.exports = { collectPingcodeTaskSource, collectionError };
