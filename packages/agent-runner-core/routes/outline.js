const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createDomainStore } = require('../lib/domain-store');
const { assignmentsFromContent, buildCatalog, buildImpactProjection, buildOutlineGovernance, buildResponsibilityProjection, normalizeImportedTechDomains, normalizeOutline, publishFileGovernance, readTechDomainConfig, saveFileGovernance, validateCandidate, nodesFromContent, parseOutlineFile } = require('./outline-management');
const { OutlineRepository } = require('../lib/outline-repository');
const repository = new OutlineRepository(process.env.OUTLINE_REPOSITORY_DIR ? path.resolve(process.env.OUTLINE_REPOSITORY_DIR) : undefined);
const handbookDomainStore = createDomainStore();

function isDatabaseMode() {
  return String(process.env.KNOWLEDGE_STORAGE_MODE || '').toLowerCase() === 'database';
}

function readActiveTechDomains() {
  if (!isDatabaseMode()) return readTechDomainConfig();
  const payload = handbookDomainStore.readTechDomains();
  return Array.isArray(payload?.techDomains) ? payload.techDomains
    : Array.isArray(payload?.items) ? payload.items
    : Array.isArray(payload) ? payload
    : [];
}

function hasPersistedOutlineVersion(item = {}) {
  return Boolean(item.currentOutlineVersionId || item.outlineStructureVersion || item.outlineVersion || item.versionCode);
}

function outlineError(res, error, fallbackCode, fallbackMessage) {
  return res.status(error.status || 500).json({
    success: false,
    error: {
      code: error.code || fallbackCode,
      message: error.message || fallbackMessage,
      details: error.details
    }
  });
}

// Storage uses uppercase enum values while the public outline contract uses
// lowercase values. Keep the boundary canonical so list and detail projections
// cannot disagree about whether a version is a deletable candidate.
function publicOutlineState(value, fallback = 'published') {
  const normalized = String(value || '').trim().toLowerCase();
  return ['draft', 'parsing', 'preflight_failed', 'pending_confirmation', 'confirmed', 'published', 'superseded', 'archived'].includes(normalized)
    ? normalized
    : fallback;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = repository.rootDir;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `outline_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('当前大纲导入只支持 XLSX 模板'));
    }
  }
});

function readMetadata() {
  const metadata = repository.read();
  // Legacy source files live in the repository-level outlines directory. They
  // are projected read-only until an operator creates a governed candidate.
  if (metadata.outlines.length === 0 && process.env.KNOWLEDGE_STORAGE_MODE !== 'database') {
    const sourceDir = path.join(__dirname, '..', '..', 'outlines');
    if (fs.existsSync(sourceDir)) {
      const files = fs.readdirSync(sourceDir).filter(name => /\.(md|json|csv)$/i.test(name) && name !== 'README.md' && !name.includes('设计思路'));
      metadata.outlines = files.map((name, index) => {
        const filePath = path.join(sourceDir, name);
        let content = null;
        try { content = /\.md$/i.test(name) ? parseMarkdownOutline(filePath) : null; } catch (_) { content = null; }
        const id = `legacy_${crypto.createHash('sha256').update(name).digest('hex').slice(0, 16)}`;
        return {
          id,
          handbookId: id,
          name: (content && content.title) || name.replace(/\.[^.]+$/, ''),
          type: 'legacy-source',
          file: name,
          sourcePath: sourceDir,
          content: content || { parts: [] },
          productId: null,
          businessVersionTags: [],
          outlineStructureVersion: `legacy-${index + 1}`,
          sourceType: 'legacy_file',
          state: 'draft',
          created_at: null,
          updated_at: null,
          parserVersion: 'legacy-v1',
          ruleVersion: 'legacy-v1',
          readOnly: true
        };
      });
    }
  }
  return metadata;
}
function writeMetadata(metadata) {
  return repository.write(metadata);
}

function requestKey(req) { return req.get('Idempotency-Key') || req.body?.idempotencyKey || null; }
function replay(metadata, key, res) {
  const hit = key && metadata.idempotency && metadata.idempotency[key];
  if (hit) { res.status(hit.status).json(hit.body); return true; }
  return false;
}
function remember(metadata, key, status, body) {
  if (!key) return;
  metadata.idempotency = metadata.idempotency || {};
  metadata.idempotency[key] = { status, body, createdAt: new Date().toISOString() };
}

function parseBodyContent(body, filePath, fallbackTitle) {
  if (body && body.content) {
    try { return typeof body.content === 'string' ? JSON.parse(body.content) : body.content; } catch (_) { /* fallback */ }
  }
  if (filePath) {
    try { return parseOutlineFile(filePath, { fallbackTitle }); } catch (_) { /* caller validates */ }
  }
  return null;
}

function fileFingerprint(filePath, content) {
  const input = filePath ? fs.readFileSync(filePath) : Buffer.from(JSON.stringify(content || {}));
  return crypto.createHash('sha256').update(input).digest('hex');
}
function isConfirmed(value) { return value === true || value === 'true' || value === '1'; }
function removeUploadedFile(file) { if (file?.path) { try { fs.unlinkSync(file.path); } catch (_) {} } }
function handbookConfigPath() {
  return process.env.KNOWLEDGE_ASSETS_CONFIG
    ? path.resolve(process.env.KNOWLEDGE_ASSETS_CONFIG)
    : path.join(__dirname, '..', 'config', 'knowledge-assets.json');
}
function knownHandbookIds() {
  if (String(process.env.KNOWLEDGE_STORAGE_MODE || '').toLowerCase() === 'database') {
    const payload = handbookDomainStore.readHandbooks();
    const handbooks = Array.isArray(payload?.handbooks) ? payload.handbooks : [];
    return new Set(handbooks.map(item => String(item.handbookId || item.id)).filter(Boolean));
  }
  const filePath = handbookConfigPath();
  if (!fs.existsSync(filePath)) return new Set();
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const handbooks = Array.isArray(payload?.handbooks) ? payload.handbooks : [];
  return new Set(handbooks.map(item => String(item.handbookId || item.id)).filter(Boolean));
}
function knownHandbooks() {
  if (String(process.env.KNOWLEDGE_STORAGE_MODE || '').toLowerCase() === 'database') {
    const payload = handbookDomainStore.readHandbooks();
    return Array.isArray(payload?.handbooks) ? payload.handbooks : [];
  }
  const filePath = handbookConfigPath();
  if (!fs.existsSync(filePath)) return [];
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(payload?.handbooks) ? payload.handbooks : [];
}
function requireExistingHandbook(handbookId) {
  const normalized = String(handbookId || '').trim();
  if (!normalized) throw Object.assign(new Error('导入必须指定所属手册'), { status: 422, code: 'OUTLINE_HANDBOOK_REQUIRED' });
  if (!knownHandbookIds().has(normalized)) throw Object.assign(new Error('所属手册不存在，请先在知识资产中创建手册'), { status: 404, code: 'OUTLINE_HANDBOOK_NOT_FOUND' });
  return normalized;
}
function handbookName(handbookId) {
  const handbook = knownHandbooks().find(item => String(item.handbookId || item.id || item.code) === String(handbookId));
  return String(handbook?.name || handbook?.title || handbookId || '未命名手册').trim();
}
function outlineNodes(outline) {
  if (outline && Array.isArray(outline.nodes) && outline.nodes.length) {
    return outline.nodes;
  }
  return nodesFromContent(outline?.content, outline?.id);
}
function candidateDetail(candidate) { return { ...normalizeOutline(candidate), content: candidate.content, nodes: outlineNodes(candidate) }; }

function createCandidate({ name, content, productId, businessVersionTags, handbookId, sourceType = 'manual', file }) {
  const now = new Date().toISOString();
  const id = `outline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const assignments = assignmentsFromContent(content, id);
  return {
    id,
    handbookId,
    name: name || '未命名手册',
    type: 'db',
    file: file || null,
    content: content || { parts: [] },
    kp_count: content ? countKnowledgePoints(content) : 0,
    productId: productId || null,
    businessVersionTags: Array.isArray(businessVersionTags) ? businessVersionTags : [],
    outlineStructureVersion: `outline-v1-${id}`,
    sourceType,
    state: 'draft',
    created_at: now,
    updated_at: now,
    parserVersion: 'governance-v1',
    ruleVersion: 'governance-v1',
    editVersion: 1,
    governance: assignments.length ? { assignments, tasks: [] } : undefined
  };
}

// POST /api/outline/upload - Upload outline file
router.use((req, res, next) => {
  const mutating = ['POST', 'PUT', 'PATCH'].includes(req.method) || /^\/candidates\/[^/]+\/preflight$/.test(req.path);
  if (!mutating || /^\/governance\/[^/]+\/(restore|purge)$/.test(req.path)) return next();
  const match = req.path.match(/^\/(?:governance|versions|candidates)\/([^/]+)/);
  const id = match ? decodeURIComponent(match[1]) : req.body?.outline_id;
  if (!id) return next();
  try {
    if (readMetadata().outlines.find(item => item.id === id)?.deletedAt) return res.status(409).json({ success: false, error: { code: 'OUTLINE_DELETED', message: '大纲已移入回收站，请恢复后再操作' } });
    return next();
  } catch (error) { return outlineError(res, error, 'OUTLINE_UNAVAILABLE', '大纲不可用'); }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  return res.status(410).json({ success: false, error: { code: 'OUTLINE_UPLOAD_DEPRECATED', message: '旧上传接口已下线，请使用 POST /api/outline/import' } });
  /* istanbul ignore next - legacy implementation retained for source compatibility */
  /*
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未选择文件' });
    }

    const file = req.file;
    const name = req.body.name || file.originalname;
    // Parse content: prefer frontend-parsed, fallback to server-side parsing
    let content = null;
    if (req.body.content) {
      try { content = JSON.parse(req.body.content); } catch(e) { content = null; }
    }
    if (!content) {
      try { content = parseMarkdownOutline(file.path); } catch(e) { content = null; }
    }

    // Generate outline ID
    const id = `outline_${Date.now()}`;

    // Create outline metadata
    const outlineData = {
      id,
      name,
      type: req.body.type || 'db',
      file: file.filename,
      content: content,
      kp_count: content ? countKnowledgePoints(content) : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    // Optional governance metadata. These fields are intentionally persisted
    // separately from the structural revision: a product may publish many
    // business versions without changing its outline structure.
    outlineData.productId = req.body.productId || null;
    try { outlineData.businessVersionTags = req.body.businessVersionTags ? JSON.parse(req.body.businessVersionTags) : []; } catch (_) { outlineData.businessVersionTags = []; }
    outlineData.outlineStructureVersion = req.body.outlineStructureVersion || `outline-v1-${id}`;
    outlineData.state = 'draft';

    // Save metadata
    const metadata = readMetadata();
    metadata.outlines.push(outlineData);
    writeMetadata(metadata);

    res.json({
      success: true,
      data: {
        id,
        name,
        kp_count: outlineData.kp_count,
        message: '大纲已导入候选版本，完成预检和评审后才能发布'
      }
    });
  } catch (err) {
    console.error('Outline upload error:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
  */
});

// Create a candidate outline without publishing it.
router.post('/handbooks', (req, res) => {
  const body = req.body || {};
  const metadata = repository.read();
  const key = requestKey(req);
  if (replay(metadata, key, res)) return;
  let handbookId;
  try { handbookId = requireExistingHandbook(body.handbookId); }
  catch (error) { return res.status(error.status || 422).json({ success: false, error: { code: error.code || 'OUTLINE_HANDBOOK_REQUIRED', message: error.message } }); }
  const content = parseBodyContent(body);
  const result = validateCandidate({ content, productId: body.productId, businessVersionTags: body.businessVersionTags });
  if (!result.passed) return res.status(422).json({ success: false, error: { code: 'OUTLINE_PREFLIGHT_FAILED', message: '大纲预检未通过', details: result.errors } });
  const candidate = createCandidate({ name: body.name, content, productId: body.productId, businessVersionTags: body.businessVersionTags, handbookId });
  candidate.sourceFingerprint = fileFingerprint(null, content);
  metadata.outlines.push(candidate); const response = { success: true, data: candidateDetail(candidate) }; remember(metadata, key, 201, response); writeMetadata(metadata);
  res.status(201).json(response);
});

// Import a file as a candidate. Supports multipart file or JSON content.
router.post('/import', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'files', maxCount: 20 }]), (req, res) => {
  try {
    const files = [...(req.files?.file || []), ...(req.files?.files || [])];
    let handbookId;
    try { handbookId = requireExistingHandbook(req.body?.handbookId); }
    catch (error) {
      files.forEach(removeUploadedFile);
      return res.status(error.status || 422).json({ success: false, error: { code: error.code || 'OUTLINE_HANDBOOK_REQUIRED', message: error.message } });
    }
    let tags = req.body && req.body.businessVersionTags;
    if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch (_) { tags = []; } }
    const metadata = repository.read(); const key = requestKey(req);
    if (replay(metadata, key, res)) return;
    const name = handbookName(handbookId);
    const inputs = files.length
      ? files.map(file => ({
          file,
          content: parseBodyContent({}, file.path, name)
        }))
      : [{ file: null, content: parseBodyContent(req.body) }];
    const results = [];
    for (const input of inputs) {
      const fileName = input.file?.originalname || null;
      try {
        input.content = normalizeImportedTechDomains(input.content, readActiveTechDomains());
      } catch (error) {
        removeUploadedFile(input.file);
        results.push({ fileName, status: 'failed', error: { code: error.code || 'INVALID_TECH_DOMAIN_ASSIGNMENT', message: error.message, details: error.details } });
        continue;
      }
      const check = validateCandidate({ content: input.content, productId: req.body?.productId, businessVersionTags: tags, requireGovernance: false });
      if (!check.passed) { removeUploadedFile(input.file); results.push({ fileName, status: 'failed', error: { code: 'OUTLINE_PREFLIGHT_FAILED', message: '大纲预检未通过', details: check.errors } }); continue; }
      const fingerprint = fileFingerprint(input.file?.path, input.content);
      const duplicate = metadata.outlines.find(item => item.sourceFingerprint === fingerprint);
      if (duplicate && !isConfirmed(req.body?.confirmDuplicate)) { removeUploadedFile(input.file); results.push({ fileName, status: 'duplicate_confirmation_required', duplicateOf: { id: duplicate.id, handbookId: duplicate.handbookId, name: duplicate.name }, fingerprint }); continue; }
      const candidate = createCandidate({ name, content: input.content, productId: req.body?.productId, businessVersionTags: tags, handbookId, sourceType: 'import', file: input.file?.filename });
      candidate.sourceFileName = fileName;
      candidate.sourceFingerprint = fingerprint; metadata.outlines.push(candidate); results.push({ fileName, status: 'imported', data: candidateDetail(candidate) });
    }
    const imported = results.filter(item => item.status === 'imported'); const summary = { total: results.length, imported: imported.length, failed: results.length - imported.length };
    const first = imported[0]?.data; const response = { success: imported.length > 0, data: { ...(inputs.length === 1 && first ? first : {}), items: results, summary } };
    const status = imported.length === results.length ? 201 : imported.length ? 207 : results.some(item => item.status === 'duplicate_confirmation_required') ? 409 : 422;
    remember(metadata, key, status, response); writeMetadata(metadata); res.status(status).json(response);
  } catch (error) { res.status(error.status || 400).json({ success: false, error: { code: error.code || 'OUTLINE_IMPORT_FAILED', message: error.message } }); }
});

router.get('/versions/:id', (req, res) => {
  const outline = readMetadata().outlines.find(item => item.id === req.params.id || item.outlineStructureVersion === req.params.id);
  if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲版本不存在' } });
  res.json({ success: true, data: { ...normalizeOutline(outline), nodes: outlineNodes(outline), content: outline.content } });
});

router.patch('/candidates/:id/nodes', (req, res) => {
  const metadata = repository.read();
  const outline = metadata.outlines.find(item => item.id === req.params.id);
  if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '候选大纲不存在' } });
  if (outline.readOnly) return res.status(409).json({ success: false, error: { code: 'OUTLINE_SOURCE_READ_ONLY', message: '来源文件为只读，请先创建候选版本' } });
  if (outline.state === 'published' || outline.state === 'superseded') return res.status(409).json({ success: false, error: { code: 'OUTLINE_IMMUTABLE', message: '已发布版本不可修改' } });
  if (req.body?.editVersion !== undefined && Number(req.body.editVersion) !== Number(outline.editVersion || 1)) {
    return res.status(409).json({ success: false, error: { code: 'OUTLINE_EDIT_CONFLICT', message: '候选版本已被其他操作更新', details: { expected: outline.editVersion || 1, received: req.body.editVersion } } });
  }
  if (req.body && req.body.content) outline.content = typeof req.body.content === 'string' ? JSON.parse(req.body.content) : req.body.content;
  outline.updated_at = new Date().toISOString(); outline.editVersion = Number(outline.editVersion || 1) + 1; outline.kp_count = countKnowledgePoints(outline);
  writeMetadata(metadata); res.json({ success: true, data: normalizeOutline(outline) });
});

router.get('/candidates/:id/preflight', (req, res) => {
  const metadata = repository.read();
  const outline = metadata.outlines.find(item => item.id === req.params.id);
  if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '候选大纲不存在' } });
  const result = validateCandidate(outline);
  outline.state = result.passed ? 'pending_confirmation' : 'preflight_failed'; outline.updated_at = new Date().toISOString();
  metadata.outlines = metadata.outlines.map(item => item.id === outline.id ? outline : item); writeMetadata(metadata);
  res.status(result.passed ? 200 : 422).json({ success: result.passed, data: { ...result, parserVersion: outline.parserVersion, ruleVersion: outline.ruleVersion }, error: result.passed ? undefined : { code: 'OUTLINE_PREFLIGHT_FAILED', message: '大纲预检未通过', details: result.errors } });
});

router.post('/versions/:id/publish', (req, res) => {
  const metadata = readMetadata();
  const outline = metadata.outlines.find(item => item.id === req.params.id);
  if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲版本不存在' } });
  if (outline.readOnly) return res.status(409).json({ success: false, error: { code: 'OUTLINE_SOURCE_READ_ONLY', message: '来源文件为只读，请先导入为候选版本' } });
  if (req.body?.baseVersionId && req.body.baseVersionId !== (outline.baseVersionId || null)) return res.status(409).json({ success: false, error: { code: 'OUTLINE_BASELINE_CONFLICT', message: '发布基线已变化' } });
  if (req.body?.editVersion !== undefined && Number(req.body.editVersion) !== Number(outline.editVersion || 1)) return res.status(409).json({ success: false, error: { code: 'OUTLINE_EDIT_CONFLICT', message: '候选版本已被其他操作更新' } });
  const result = validateCandidate(outline);
  if (!result.passed) return res.status(422).json({ success: false, error: { code: 'OUTLINE_PREFLIGHT_FAILED', message: '发布前预检未通过', details: result.errors } });
  metadata.outlines.forEach(item => { if (item.handbookId === outline.handbookId && item.id !== outline.id && !item.deletedAt && item.state === 'published') item.state = 'superseded'; });
  outline.state = 'published'; outline.updated_at = new Date().toISOString(); outline.published_at = outline.updated_at;
  writeMetadata(metadata); res.json({ success: true, data: normalizeOutline(outline) });
});

function findOutlineForGovernance(id) {
  return readMetadata().outlines.find(item => item.id === id && !item.deletedAt);
}

router.get('/governance/:id/governance', (req, res) => {
  try {
    if (String(process.env.KNOWLEDGE_STORAGE_MODE || '').toLowerCase() === 'database') {
      const data = handbookDomainStore.readOutlineGovernance(req.params.id);
      return res.json({ success: true, data, generatedAt: new Date().toISOString() });
    }
    const outline = findOutlineForGovernance(req.params.id);
    if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲不存在' } });
    return res.json({ success: true, data: buildOutlineGovernance(outline), generatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(error.status || 503).json({ success: false, error: { code: error.code || 'OUTLINE_GOVERNANCE_FAILED', message: error.message || '大纲治理数据不可用', details: error.details } });
  }
});

router.put('/governance/:id/governance', (req, res) => {
  try {
    if (String(process.env.KNOWLEDGE_STORAGE_MODE || '').toLowerCase() === 'database') {
      const data = handbookDomainStore.writeOutlineGovernance(req.params.id, req.body || {});
      return res.json({ success: true, data, message: '目录说明和责任分工已保存', generatedAt: new Date().toISOString() });
    }
    const metadata = readMetadata();
    const outline = metadata.outlines.find(item => item.id === req.params.id);
    if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲不存在' } });
    saveFileGovernance(outline, req.body || {});
    writeMetadata(metadata);
    return res.json({ success: true, data: buildOutlineGovernance(outline), message: '目录说明和责任分工已保存', generatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(error.status || 422).json({ success: false, error: { code: error.code || 'OUTLINE_GOVERNANCE_SAVE_FAILED', message: error.message || '大纲治理数据保存失败', details: error.details } });
  }
});

router.post('/governance/:id/publish', (req, res) => {
  try {
    if (String(process.env.KNOWLEDGE_STORAGE_MODE || '').toLowerCase() === 'database') {
      const data = handbookDomainStore.publishOutline(req.params.id, req.body || {});
      return res.json({ success: true, data, message: '大纲已发布，领域建设任务已生成', generatedAt: new Date().toISOString() });
    }
    const metadata = readMetadata();
    const outline = metadata.outlines.find(item => item.id === req.params.id);
    if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲不存在' } });
    publishFileGovernance(outline, req.body || {});
    metadata.outlines.forEach(item => {
      if (item.handbookId === outline.handbookId && item.id !== outline.id && !item.deletedAt && item.state === 'published') item.state = 'superseded';
    });
    writeMetadata(metadata);
    return res.json({ success: true, data: buildOutlineGovernance(outline), message: '大纲已发布，领域建设任务已生成', generatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(error.status || 422).json({ success: false, error: { code: error.code || 'OUTLINE_PUBLISH_FAILED', message: error.message || '大纲发布失败', details: error.details } });
  }
});

router.get('/tech-domains', (req, res) => {
  try {
    if (String(process.env.KNOWLEDGE_STORAGE_MODE || '').toLowerCase() === 'database') {
      return res.json({ success: true, data: handbookDomainStore.readTechDomains(), generatedAt: new Date().toISOString() });
    }
    return res.json({ success: true, data: { techDomains: readTechDomainConfig() }, generatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(error.status || 503).json({ success: false, error: { code: error.code || 'TECH_DOMAIN_FAILED', message: error.message || '技术领域信息不可用' } });
  }
});

router.get('/build-tasks', (req, res) => {
  try {
    if (String(process.env.KNOWLEDGE_STORAGE_MODE || '').toLowerCase() === 'database') {
      return res.json({ success: true, data: handbookDomainStore.readBuildTasks(req.query || {}), generatedAt: new Date().toISOString() });
    }
    const tasks = readMetadata().outlines.flatMap(outline => outline.governance?.tasks || []);
    return res.json({ success: true, data: { tasks, generatedAt: new Date().toISOString() }, generatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(error.status || 503).json({ success: false, error: { code: error.code || 'BUILD_TASK_FAILED', message: error.message || '领域建设任务不可用' } });
  }
});

router.get('/build-tasks/:id', (req, res) => {
  try {
    if (String(process.env.KNOWLEDGE_STORAGE_MODE || '').toLowerCase() === 'database') {
      return res.json({ success: true, data: handbookDomainStore.readBuildTask(req.params.id), generatedAt: new Date().toISOString() });
    }
    const task = readMetadata().outlines.flatMap(outline => outline.governance?.tasks || []).find(item => item.id === req.params.id);
    if (!task) return res.status(404).json({ success: false, error: { code: 'BUILD_TASK_NOT_FOUND', message: '领域建设任务不存在' } });
    return res.json({ success: true, data: task, generatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(error.status || 503).json({ success: false, error: { code: error.code || 'BUILD_TASK_FAILED', message: error.message || '领域建设任务不可用' } });
  }
});

router.patch('/build-tasks/:taskId/items/:itemId', (req, res) => {
  try {
    if (String(process.env.KNOWLEDGE_STORAGE_MODE || '').toLowerCase() === 'database') {
      return res.json({ success: true, data: handbookDomainStore.updateBuildTaskItem(req.params.taskId, req.params.itemId, req.body || {}), message: '页面建设责任人已更新', generatedAt: new Date().toISOString() });
    }
    const metadata = readMetadata();
    const task = metadata.outlines.flatMap(outline => outline.governance?.tasks || []).find(item => item.id === req.params.taskId);
    const item = task?.items?.find(entry => entry.id === req.params.itemId);
    if (!item) return res.status(404).json({ success: false, error: { code: 'BUILD_TASK_ITEM_NOT_FOUND', message: '任务页面不存在' } });
    const assignee = req.body?.assignee || {};
    item.assigneeId = req.body?.assigneeId || assignee.id || null;
    item.assigneeName = req.body?.assigneeName || assignee.name || null;
    item.status = req.body?.status || (item.assigneeId ? 'assigned' : 'unassigned');
    writeMetadata(metadata);
    return res.json({ success: true, data: task, message: '页面建设责任人已更新', generatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(error.status || 422).json({ success: false, error: { code: error.code || 'BUILD_TASK_ITEM_FAILED', message: error.message || '页面责任人更新失败', details: error.details } });
  }
});

// Governance read models. These endpoints only project persisted outline facts;
// they never create a second source of business state.
router.get('/catalog/products', (req, res) => {
  try {
    const metadata = repository.read();
    const context = global.__KNOWLEDGE_PLATFORM_CONTEXT__ || {};
    res.json({ success: true, data: buildCatalog(metadata.outlines, context), generatedAt: new Date().toISOString() });
  } catch (error) { res.status(500).json({ success: false, error: { code: 'OUTLINE_CATALOG_FAILED', message: error.message } }); }
});

router.get('/governance/list', (req, res) => {
  try {
    const metadata = readMetadata();
    const outlines = isDatabaseMode() ? metadata.outlines.filter(hasPersistedOutlineVersion) : metadata.outlines;
    let items = outlines.filter(item => !item.deletedAt).map(normalizeOutline);
    if (req.query.productId) items = items.filter(item => item.productId === req.query.productId);
    res.json({ success: true, data: items, generatedAt: new Date().toISOString() });
  } catch (error) { outlineError(res, error, 'OUTLINE_LIST_FAILED', '大纲列表不可用'); }
});

router.get('/catalog', async (req, res) => {
  try {
    let catalog;
    if (isDatabaseMode()) {
      catalog = await handbookDomainStore.readOutlineCatalogAsync();
    } else {
      const metadata = readMetadata();
      const items = metadata.outlines.filter(item => !item.deletedAt && hasPersistedOutlineVersion(item)).map(outline => ({
        ...normalizeOutline(outline),
        productName: String(outline.productName || outline.productDisplayName || outline.productId || '').trim() || '未指定产品',
        productDisplayName: String(outline.productName || outline.productDisplayName || outline.productId || '').trim() || '未指定产品',
      }));
      const generatedAt = new Date().toISOString();
      catalog = { items, total: items.length, snapshotVersion: generatedAt, generatedAt };
    }
    const generatedAt = catalog.generatedAt || new Date().toISOString();
    const items = Array.isArray(catalog.items) ? catalog.items : [];
    res.json({ success: true, data: { items, total: Number(catalog.total ?? items.length), snapshotVersion: catalog.snapshotVersion || generatedAt, generatedAt } });
  } catch (error) { outlineError(res, error, 'OUTLINE_CATALOG_FAILED', '大纲目录不可用'); }
});

router.get('/governance/:id', (req, res, next) => {
  if (req.params.id === 'recycle') return next();
  try {
    const outline = readMetadata().outlines.find(item => item.id === req.params.id);
    if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲不存在' } });
    const governance = isDatabaseMode()
      ? handbookDomainStore.readOutlineGovernance(req.params.id)
      : buildOutlineGovernance(outline);
    const normalized = normalizeOutline(outline);
    const detail = {
      ...normalized,
      handbookId: governance.manualId || normalized.handbookId,
      state: publicOutlineState(governance.state || normalized.state, normalized.state),
      editVersion: governance.editVersion ?? normalized.editVersion,
      nodes: isDatabaseMode()
        ? (Array.isArray(governance.nodes) ? governance.nodes : outlineNodes(outline))
        : outlineNodes(outline),
      governance,
      responsibility: governance,
      impact: buildImpactProjection({ ...outline, governance })
    };
    res.json({ success: true, data: detail, generatedAt: new Date().toISOString() });
  } catch (error) { outlineError(res, error, 'OUTLINE_DETAIL_FAILED', '大纲详情不可用'); }
});

router.get('/governance/recycle', (req, res) => {
  try { res.json({ success: true, data: readMetadata().outlines.filter(item => item.deletedAt).map(item => ({ ...normalizeOutline(item), deletedAt: item.deletedAt, deletedBy: item.deletedBy })) }); }
  catch (error) { outlineError(res, error, 'OUTLINE_RECYCLE_FAILED', '回收站读取失败'); }
});

function mutateOutlineLifecycle(req, res, action) {
  try {
    const id = req.params.id;
    const outline = readMetadata().outlines.find(item => item.id === id);
    if (!outline) throw Object.assign(new Error('大纲不存在'), { status: 404, code: 'OUTLINE_NOT_FOUND' });
    if (outline.readOnly) throw Object.assign(new Error('来源大纲为只读，不能删除'), { status: 409, code: 'OUTLINE_SOURCE_READ_ONLY' });
    const required = action.startsWith('purge') ? 'outline:purge' : 'outline:delete';
    if (!String(req.get('x-outline-actions') || '').split(',').includes(required)) throw Object.assign(new Error(action.startsWith('purge') ? '只有超级管理员可以彻底删除大纲' : '无大纲删除权限'), { status: 403, code: 'OUTLINE_PERMISSION_DENIED' });
    const payload = { ...(req.body || {}), actor: req.get('x-actor-id') };
    let data;
    if (isDatabaseMode()) data = action === 'delete' ? handbookDomainStore.deleteOutline(id, payload) : handbookDomainStore.outlineLifecycle(id, action, payload);
    else {
      // File installations have no transactional cross-module dependency index.
      // Fail closed for irreversible cleanup; soft delete/restore remain available.
      if (action.startsWith('purge')) throw Object.assign(new Error('文件模式缺少完整引用索引，不能安全彻底删除；请使用数据库模式'), { status: 409, code: 'OUTLINE_PURGE_UNAVAILABLE' });
      repository.update(metadata => {
        const item = metadata.outlines.find(value => value.id === id);
        if (action === 'delete' && !item.deletedAt) { item.deletedAt = new Date().toISOString(); item.deletedBy = payload.actor; }
        if (action === 'restore') {
          if (item.deletedAt && String(item.state).toLowerCase() === 'published' && metadata.outlines.some(other => other.id !== id && !other.deletedAt && other.handbookId === item.handbookId && String(other.state).toLowerCase() === 'published')) throw Object.assign(new Error('已有新的当前版本，不能恢复旧的当前版本'), { status: 409, code: 'OUTLINE_RESTORE_CONFLICT' });
          item.deletedAt = null; item.deletedBy = null;
        }
        (metadata.lifecycleAudits ||= []).push({ id, action, actor: payload.actor, at: new Date().toISOString() });
        return metadata;
      });
      data = { id, deleted: action === 'delete', restored: action === 'restore' };
    }
    return res.json({ success: true, data, message: action === 'delete' ? '大纲已移入回收站' : action === 'restore' ? '大纲已恢复' : action === 'purge' ? '大纲已彻底删除' : undefined });
  } catch (error) { return outlineError(res, error, 'OUTLINE_LIFECYCLE_FAILED', '大纲操作失败'); }
}
router.delete('/governance/:id', (req, res) => mutateOutlineLifecycle(req, res, 'delete'));
router.post('/governance/:id/restore', (req, res) => mutateOutlineLifecycle(req, res, 'restore'));
router.get('/governance/:id/purge-preflight', (req, res) => mutateOutlineLifecycle(req, res, 'purge-preflight'));
router.post('/governance/:id/purge', (req, res) => mutateOutlineLifecycle(req, res, 'purge'));

router.get('/governance/:id/responsibility', (req, res) => {
  try {
    const outline = readMetadata().outlines.find(item => item.id === req.params.id);
    if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲不存在' } });
    const governance = isDatabaseMode()
      ? handbookDomainStore.readOutlineGovernance(req.params.id)
      : buildOutlineGovernance(outline);
    res.json({ success: true, data: governance, generatedAt: new Date().toISOString() });
  } catch (error) { outlineError(res, error, 'RESPONSIBILITY_FAILED', '责任分工不可用'); }
});

router.get('/governance/:id/impact', (req, res) => {
  try {
    const outline = readMetadata().outlines.find(item => item.id === req.params.id);
    if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲不存在' } });
    res.json({ success: true, data: buildImpactProjection(outline), generatedAt: new Date().toISOString() });
  } catch (error) { res.status(500).json({ success: false, error: { code: 'IMPACT_FAILED', message: error.message } }); }
});

router.post('/preflight', (req, res) => {
  const result = validateCandidate(req.body || {});
  res.status(result.passed ? 200 : 422).json({ success: result.passed, data: { passed: result.passed, errors: result.errors, nodes: result.nodes, parserVersion: 'governance-v1', ruleVersion: 'governance-v1' }, error: result.passed ? undefined : { code: 'OUTLINE_PREFLIGHT_FAILED', message: '大纲预检未通过', details: result.errors } });
});

// GET /api/outline/list - List all outlines
router.get('/list', (req, res) => {
  try {
    const metadata = readMetadata();
    metadata.outlines.forEach(outline => {
      if (!outline.content && outline.file) {
        const filePath = path.join(__dirname, '..', 'outlines', outline.file);
        if (fs.existsSync(filePath)) {
          try {
            outline.content = parseMarkdownOutline(filePath);
            outline.kp_count = countKnowledgePoints(outline);
          } catch(e) { /* skip unparseable files */ }
        }
      }
    });
    res.json({ success: true, data: metadata.outlines.filter(item => !item.deletedAt) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/outline/:id - Get outline by ID
router.get('/:id', (req, res) => {
  try {
    const metadata = readMetadata();
    const outline = metadata.outlines.find(o => o.id === req.params.id);
    
    if (!outline) {
      return res.status(404).json({ success: false, message: '大纲不存在' });
    }
    
    res.json({ success: true, data: outline });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/outline/:id - Delete outline
router.delete('/:id', (req, res) => mutateOutlineLifecycle(req, res, 'delete'));

const parseMarkdownOutline = parseOutlineFile;

// Helper function to count knowledge points
function countKnowledgePoints(outline) {
  const nodes = outlineNodes(outline);
  if (nodes.length) {
    return nodes.filter(node => node.kind === 'document').length;
  }
  let count = 0;
  if (outline.parts) {
    outline.parts.forEach(part => {
      if (part.chapters) {
        part.chapters.forEach(chapter => {
          if (chapter.documents) count += chapter.documents.length;
          else if (chapter.kps) count += chapter.kps.length;
          else if (chapter.knowledgePoints) count += chapter.knowledgePoints.length;
        });
      }
    });
  }
  if (outline.chapters) {
    outline.chapters.forEach(chapter => {
      if (chapter.documents) count += chapter.documents.length;
      else if (chapter.kps) count += chapter.kps.length;
      else if (chapter.knowledgePoints) count += chapter.knowledgePoints.length;
    });
  }
  return count;
}


const promptGenerator = require('../lib/prompt-generator');

// POST /api/outline/generate-prompts - Generate prompts from outline knowledge points
router.post('/generate-prompts', (req, res) => {
  try {
    const { outline_id, knowledge_points, options = {} } = req.body;

    if (!outline_id || !knowledge_points || knowledge_points.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: outline_id, knowledge_points'
      });
    }

    // Load outline
    const metadata = readMetadata();
    const outline = metadata.outlines.find(o => o.id === outline_id);

    if (!outline) {
      return res.status(404).json({ success: false, message: '大纲不存在' });
    }

    // Parse content if missing
    if (!outline.content) {
      const filePath = path.join(__dirname, '..', 'outlines', outline.file);
      if (fs.existsSync(filePath)) {
        try {
          outline.content = parseMarkdownOutline(filePath);
        } catch (e) {
          return res.status(400).json({ success: false, message: '大纲内容无法解析' });
        }
      } else {
        return res.status(400).json({ success: false, message: '大纲文件不存在' });
      }
    }

    // Extract knowledge point details
    const kpDetails = extractKnowledgePoints(outline.content, knowledge_points);

    if (kpDetails.length === 0) {
      return res.status(400).json({ success: false, message: '未找到匹配的知识点' });
    }

    // Generate prompts
    const prompts = [];
    for (const kp of kpDetails) {
      const promptData = {
        name: kp.name,
        part: kp.part,
        chapter: kp.chapter,
        desc: kp.desc,
        type: promptGenerator.detectType(kp.name, kp.desc),
        targetDb: options.target_db || global.__KNOWLEDGE_PLATFORM_CONTEXT__?.brand?.enterpriseName || 'YashanDB',
        refMcp: '',
        refDesign: '',
        refOracle: '',
        refTest: ''
      };

      const result = promptGenerator.assemblePrompt(promptData);
      prompts.push({
        kp_id: kp.id,
        kp_name: kp.name,
        prompt: result.prompt,
        skill_file: result.skillFile,
        template_file: result.templateFile,
        json: result.json
      });
    }

    // Merge output if requested
    let mergedPrompt = null;
    if (options.merge_output) {
      mergedPrompt = prompts.map(p =>
        `---\n\n# ${p.kp_id} ${p.kp_name}\n\n${p.prompt}\n`
      ).join('\n');
    }

    // Save prompts to files if requested
    let saved_files = [];
    if (options.save_to_file) {
      const outputDir = path.join(__dirname, '..', 'prompts', 'from-outline', outline_id);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      prompts.forEach(p => {
        const filename = `${p.kp_id.replace(/\./g, '-')}-${p.kp_name.replace(/[/\\:*?"<>|]/g, '_')}.md`;
        const filePath = path.join(outputDir, filename);
        fs.writeFileSync(filePath, p.prompt, 'utf-8');
        saved_files.push({ kp_id: p.kp_id, file: filename });
      });
    }

    res.json({
      success: true,
      data: {
        outline_id,
        outline_name: outline.name,
        prompts,
        merged_prompt: mergedPrompt,
        saved_files,
        total: prompts.length
      }
    });

  } catch (err) {
    console.error('Generate prompts error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Extract knowledge point details from outline content
function extractKnowledgePoints(outlineContent, selectedKps) {
  const result = [];
  const parts = outlineContent.parts || [];

  for (const selected of selectedKps) {
    const part = parts.find(p => p.part === selected.part);
    if (!part) continue;

    const chapter = part.chapters.find(c => c.name === selected.chapter);
    if (!chapter) continue;

    const leaves = [...(chapter.documents || []), ...(chapter.kps || []), ...(chapter.knowledgePoints || [])];
    const kp = leaves.find(k => k.id === selected.kp_id || k.documentId === selected.kp_id);
    if (!kp) continue;

    result.push({
      id: kp.id,
      name: kp.name,
      desc: kp.desc,
      part: part.part,
      chapter: chapter.name
    });
  }

  return result;
}

module.exports = router;
