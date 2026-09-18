#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const sourceFile = path.resolve(process.env.MANUAL_MIGRATION_SOURCE
  || path.join(root, 'runtime', 'knowledge-center', 'knowledge-assets.json'));
const reportFile = path.resolve(process.env.MANUAL_MIGRATION_REPORT
  || path.join(root, 'runtime', 'yashandb-migration', 'manuals-75-report.json'));
const baseUrl = process.env.YASDB_STORAGE_URL || 'http://127.0.0.1:14210';
const apply = process.argv.includes('--apply');
const expectedCount = 75;
const allowedProducts = new Set(['DB', 'YMP', 'YCM', 'YDC']);
const productIds = Object.freeze({ DB: 1, YMP: 2, YCM: 3, YDC: 4 });

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fail(message) {
  throw new Error(message);
}

function loadSource() {
  if (!fs.existsSync(sourceFile)) fail(`手册迁移源不存在：${sourceFile}`);
  const bytes = fs.readFileSync(sourceFile);
  const payload = JSON.parse(bytes.toString('utf8'));
  const rows = Array.isArray(payload.handbooks) ? payload.handbooks : [];
  if (rows.length !== expectedCount) fail(`手册数量必须为 ${expectedCount}，实际为 ${rows.length}`);

  const ids = new Set();
  const manualNames = new Set();
  const productDistribution = {};
  const pendingBindings = [];
  const handbooks = rows.map((row, index) => {
    const handbookId = String(row.handbookId || '').trim();
    const name = String(row.name || '').trim();
    const sourceProduct = String(row.productType || '').trim();
    const productType = sourceProduct === 'YashanDB' ? 'DB' : sourceProduct;
    const productId = productIds[productType];
    if (!handbookId || !name) fail(`第 ${index + 1} 条手册缺少 handbookId 或 name`);
    if (!allowedProducts.has(productType)) fail(`未识别的产品形态：${productType}`);
    if (ids.has(handbookId)) fail(`手册编号重复：${handbookId}`);
    ids.add(handbookId);
    const businessKey = `${productId}\u0000${name}`;
    if (manualNames.has(businessKey)) fail(`产品内手册名称重复：${productId}/${name}`);
    manualNames.add(businessKey);
    productDistribution[productType] = (productDistribution[productType] || 0) + 1;
    for (const [role, owner] of [['PRIMARY', row.ownerA], ['DEPUTY', row.ownerB]]) {
      if (owner && owner.displayName) {
        pendingBindings.push({ handbookId, productId, productType, manualName: name, role, displayName: owner.displayName });
      }
    }
    return {
      handbookId,
      id: handbookId,
      code: handbookId,
      name,
      title: name,
      productId,
      productName: productType,
      productType,
      orgUnitId: null,
      departmentId: null,
      ownerA: null,
      ownerB: null,
      isAtomic: row.isAtomic === true,
      externalVisible: row.externalVisible === true,
      status: 'imported',
      sourceStatus: 'imported',
      archivedAt: null,
      summary: row.summary || '',
    };
  });
  return { bytes, handbooks, productDistribution, pendingBindings };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail(`${options.method || 'GET'} ${url} 失败：HTTP ${response.status} ${JSON.stringify(body)}`);
  return body;
}

function sameImportedManual(actual, expected) {
  return (actual.handbookId || actual.id) === expected.handbookId
    && (actual.code || actual.handbookId) === expected.code
    && (actual.name || actual.title) === expected.name
    && Number(actual.productId) === expected.productId
    && Boolean(actual.isAtomic) === expected.isAtomic
    && Boolean(actual.externalVisible) === expected.externalVisible;
}

async function applyMigration(source) {
  const existing = await requestJson(`${baseUrl}/v1/domain/handbooks`);
  const existingRows = existing.handbooks || existing.data?.handbooks || [];
  if (existingRows.length !== 0 && existingRows.length !== expectedCount) {
    fail(`目标库存在部分手册数据（${existingRows.length} 条），为避免覆盖已阻断迁移`);
  }
  if (existingRows.length === expectedCount) {
    const byId = new Map(existingRows.map(row => [row.handbookId || row.id, row]));
    const differences = source.handbooks.filter(row => !sameImportedManual(byId.get(row.handbookId) || {}, row));
    if (differences.length) fail(`目标库已有 ${expectedCount} 条手册，但有 ${differences.length} 条与迁移源不一致`);
    return { idempotent: true, handbookCount: existingRows.length };
  }

  await requestJson(`${baseUrl}/v1/domain/handbooks/snapshot`, {
    method: 'PUT',
    body: JSON.stringify({
      version: 2,
      principalId: 'system:migration',
      source: { type: 'knowledge-assets-json', sha256: sha256(source.bytes) },
      handbooks: source.handbooks,
      audits: [],
    }),
  });
  const [handbooksBody, outlinesBody] = await Promise.all([
    requestJson(`${baseUrl}/v1/domain/handbooks`),
    requestJson(`${baseUrl}/v1/domain/outlines`),
  ]);
  const handbookCount = (handbooksBody.handbooks || handbooksBody.data?.handbooks || []).length;
  const outlineCount = (outlinesBody.outlines || outlinesBody.data?.outlines || []).length;
  if (handbookCount !== expectedCount || outlineCount !== expectedCount) {
    fail(`迁移后回读数量不一致：手册 ${handbookCount}，大纲主体 ${outlineCount}`);
  }
  return { idempotent: false, handbookCount, outlineCount };
}

async function main() {
  const source = loadSource();
  const report = {
    generatedAt: new Date().toISOString(),
    applied: false,
    sourceFile: path.relative(root, sourceFile),
    sourceSha256: sha256(source.bytes),
    expectedCount,
    validatedCount: source.handbooks.length,
    productDistribution: source.productDistribution,
    pendingOrgBindingCount: source.handbooks.length,
    pendingOwnerBindingCount: source.pendingBindings.length,
    pendingOwnerBindings: source.pendingBindings,
  };
  if (apply) {
    Object.assign(report, await applyMigration(source), { applied: true, target: baseUrl });
  }
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    success: true,
    applied: report.applied,
    validatedCount: report.validatedCount,
    handbookCount: report.handbookCount,
    outlineCount: report.outlineCount,
    reportFile,
  }, null, 2)}\n`);
}

main().catch(error => {
  process.stderr.write(`手册迁移失败：${error.message}\n`);
  process.exitCode = 1;
});
