const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { buildCatalog, buildImpactProjection, buildResponsibilityProjection, normalizeOutline, validateCandidate, nodesFromContent, parseOutlineFile } = require('./outline-management');
const { OutlineRepository } = require('../lib/outline-repository');
const repository = new OutlineRepository(process.env.OUTLINE_REPOSITORY_DIR ? path.resolve(process.env.OUTLINE_REPOSITORY_DIR) : undefined);

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
    if (['.json', '.md', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JSON、Markdown、CSV 格式'));
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

function parseBodyContent(body, filePath) {
  if (body && body.content) {
    try { return typeof body.content === 'string' ? JSON.parse(body.content) : body.content; } catch (_) { /* fallback */ }
  }
  if (filePath) {
    try { return parseOutlineFile(filePath); } catch (_) { /* caller validates */ }
  }
  return null;
}

function fileFingerprint(filePath, content) {
  const input = filePath ? fs.readFileSync(filePath) : Buffer.from(JSON.stringify(content || {}));
  return crypto.createHash('sha256').update(input).digest('hex');
}
function isConfirmed(value) { return value === true || value === 'true' || value === '1'; }
function removeUploadedFile(file) { if (file?.path) { try { fs.unlinkSync(file.path); } catch (_) {} } }
function candidateDetail(candidate) { return { ...normalizeOutline(candidate), content: candidate.content, nodes: nodesFromContent(candidate.content, candidate.id) }; }

function createCandidate({ name, content, productId, businessVersionTags, handbookId, sourceType = 'manual', file }) {
  const now = new Date().toISOString();
  const id = `outline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    handbookId: handbookId || `handbook_${id}`,
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
    ruleVersion: 'governance-v1'
    , editVersion: 1
  };
}

// POST /api/outline/upload - Upload outline file
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
    const metadataPath = path.join(__dirname, '..', 'outlines', 'metadata.json');
    let metadata = { outlines: [] };
    
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    }
    
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
  const content = parseBodyContent(body);
  const result = validateCandidate({ content, productId: body.productId, businessVersionTags: body.businessVersionTags });
  if (!result.passed) return res.status(422).json({ success: false, error: { code: 'OUTLINE_PREFLIGHT_FAILED', message: '大纲预检未通过', details: result.errors } });
  const candidate = createCandidate({ name: body.name, content, productId: body.productId, businessVersionTags: body.businessVersionTags, handbookId: body.handbookId });
  candidate.sourceFingerprint = fileFingerprint(null, content);
  metadata.outlines.push(candidate); const response = { success: true, data: candidateDetail(candidate) }; remember(metadata, key, 201, response); writeMetadata(metadata);
  res.status(201).json(response);
});

// Import a file as a candidate. Supports multipart file or JSON content.
router.post('/import', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'files', maxCount: 20 }]), (req, res) => {
  try {
    const files = [...(req.files?.file || []), ...(req.files?.files || [])];
    let tags = req.body && req.body.businessVersionTags;
    if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch (_) { tags = []; } }
    const metadata = repository.read(); const key = requestKey(req);
    if (replay(metadata, key, res)) return;
    const inputs = files.length ? files.map(file => ({ file, content: parseBodyContent({}, file.path) })) : [{ file: null, content: parseBodyContent(req.body) }];
    const results = [];
    for (const input of inputs) {
      const check = validateCandidate({ content: input.content, productId: req.body?.productId, businessVersionTags: tags, requireGovernance: false });
      const fileName = input.file?.originalname || null;
      if (!check.passed) { removeUploadedFile(input.file); results.push({ fileName, status: 'failed', error: { code: 'OUTLINE_PREFLIGHT_FAILED', message: '大纲预检未通过', details: check.errors } }); continue; }
      const fingerprint = fileFingerprint(input.file?.path, input.content);
      const duplicate = metadata.outlines.find(item => item.sourceFingerprint === fingerprint);
      if (duplicate && !isConfirmed(req.body?.confirmDuplicate)) { removeUploadedFile(input.file); results.push({ fileName, status: 'duplicate_confirmation_required', duplicateOf: { id: duplicate.id, handbookId: duplicate.handbookId, name: duplicate.name }, fingerprint }); continue; }
      const inferredName = input.content?.title || (fileName && fileName.replace(/\.[^.]+$/, '')) || '未命名手册';
      const candidate = createCandidate({ name: (inputs.length === 1 ? req.body?.name : null) || inferredName, content: input.content, productId: req.body?.productId, businessVersionTags: tags, handbookId: inputs.length === 1 ? req.body?.handbookId : null, sourceType: 'import', file: input.file?.filename });
      candidate.sourceFingerprint = fingerprint; metadata.outlines.push(candidate); results.push({ fileName, status: 'imported', data: candidateDetail(candidate) });
    }
    const imported = results.filter(item => item.status === 'imported'); const summary = { total: results.length, imported: imported.length, failed: results.length - imported.length };
    const first = imported[0]?.data; const response = { success: imported.length > 0, data: { ...(inputs.length === 1 && first ? first : {}), items: results, summary } };
    const status = imported.length === results.length ? 201 : imported.length ? 207 : results.some(item => item.status === 'duplicate_confirmation_required') ? 409 : 422;
    remember(metadata, key, status, response); writeMetadata(metadata); res.status(status).json(response);
  } catch (error) { res.status(400).json({ success: false, error: { code: 'OUTLINE_IMPORT_FAILED', message: error.message } }); }
});

router.get('/versions/:id', (req, res) => {
  const outline = readMetadata().outlines.find(item => item.id === req.params.id || item.outlineStructureVersion === req.params.id);
  if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲版本不存在' } });
  res.json({ success: true, data: { ...normalizeOutline(outline), nodes: nodesFromContent(outline.content, outline.id), content: outline.content } });
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
  outline.updated_at = new Date().toISOString(); outline.editVersion = Number(outline.editVersion || 1) + 1; outline.kp_count = countKnowledgePoints(outline.content);
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
  metadata.outlines.forEach(item => { if (item.handbookId === outline.handbookId && item.id !== outline.id && item.state === 'published') item.state = 'superseded'; });
  outline.state = 'published'; outline.updated_at = new Date().toISOString(); outline.published_at = outline.updated_at;
  writeMetadata(metadata); res.json({ success: true, data: normalizeOutline(outline) });
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
    let items = metadata.outlines.map(normalizeOutline);
    if (req.query.productId) items = items.filter(item => item.productId === req.query.productId);
    res.json({ success: true, data: items, generatedAt: new Date().toISOString() });
  } catch (error) { res.status(500).json({ success: false, error: { code: 'OUTLINE_LIST_FAILED', message: error.message } }); }
});

router.get('/governance/:id', (req, res) => {
  try {
    const outline = readMetadata().outlines.find(item => item.id === req.params.id);
    if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲不存在' } });
    res.json({ success: true, data: { ...normalizeOutline(outline), nodes: nodesFromContent(outline.content, outline.id), responsibility: buildResponsibilityProjection(outline), impact: buildImpactProjection(outline) }, generatedAt: new Date().toISOString() });
  } catch (error) { res.status(500).json({ success: false, error: { code: 'OUTLINE_DETAIL_FAILED', message: error.message } }); }
});

router.delete('/governance/:id', (req, res) => {
  let stagedFile = null;
  let originalFile = null;
  try {
    let outline;
    repository.update(metadata => {
      const index = metadata.outlines.findIndex(item => item.id === req.params.id);
      if (index < 0) throw Object.assign(new Error('大纲不存在'), { status: 404, code: 'OUTLINE_NOT_FOUND' });
      outline = metadata.outlines[index];
      if (outline.readOnly) throw Object.assign(new Error('来源大纲为只读，不能删除'), { status: 409, code: 'OUTLINE_SOURCE_READ_ONLY' });
      if (outline.state === 'published' || outline.state === 'superseded') throw Object.assign(new Error('已发布大纲不可删除，请通过版本或归档流程治理'), { status: 409, code: 'OUTLINE_IMMUTABLE' });
      if (outline.file) {
        originalFile = path.resolve(repository.rootDir, path.basename(outline.file));
        if (originalFile.startsWith(`${path.resolve(repository.rootDir)}${path.sep}`) && fs.existsSync(originalFile)) {
          stagedFile = `${originalFile}.deleting-${process.pid}-${Date.now()}`;
          fs.renameSync(originalFile, stagedFile);
        }
      }
      metadata.outlines.splice(index, 1);
      return metadata;
    });
    if (stagedFile && fs.existsSync(stagedFile)) fs.unlinkSync(stagedFile);
    return res.json({ success: true, data: { id: outline.id, deleted: true }, message: '候选大纲已删除' });
  } catch (error) {
    if (stagedFile && originalFile && fs.existsSync(stagedFile) && !fs.existsSync(originalFile)) {
      try { fs.renameSync(stagedFile, originalFile); } catch (_) { /* preserve primary error */ }
    }
    return res.status(error.status || 500).json({ success: false, error: { code: error.code || 'OUTLINE_DELETE_FAILED', message: error.message } });
  }
});

router.get('/governance/:id/responsibility', (req, res) => {
  try {
    const outline = readMetadata().outlines.find(item => item.id === req.params.id);
    if (!outline) return res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND', message: '大纲不存在' } });
    res.json({ success: true, data: buildResponsibilityProjection(outline), generatedAt: new Date().toISOString() });
  } catch (error) { res.status(500).json({ success: false, error: { code: 'RESPONSIBILITY_FAILED', message: error.message } }); }
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
    const metadataPath = path.join(__dirname, '..', 'outlines', 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      return res.json({ success: true, data: [] });
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    // Enrich outlines with parsed content if missing
    metadata.outlines.forEach(outline => {
      if (!outline.content && outline.file) {
        const filePath = path.join(__dirname, '..', 'outlines', outline.file);
        if (fs.existsSync(filePath)) {
          try {
            outline.content = parseMarkdownOutline(filePath);
            outline.kp_count = countKnowledgePoints(outline.content);
          } catch(e) { /* skip unparseable files */ }
        }
      }
    });
    res.json({ success: true, data: metadata.outlines });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/outline/:id - Get outline by ID
router.get('/:id', (req, res) => {
  try {
    const metadataPath = path.join(__dirname, '..', 'outlines', 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ success: false, message: '大纲不存在' });
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
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
router.delete('/:id', (req, res) => {
  try {
    const metadataPath = path.join(__dirname, '..', 'outlines', 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ success: false, message: '大纲不存在' });
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    const outlineIndex = metadata.outlines.findIndex(o => o.id === req.params.id);
    
    if (outlineIndex === -1) {
      return res.status(404).json({ success: false, message: '大纲不存在' });
    }
    
    const outline = metadata.outlines[outlineIndex];
    
    // Delete file
    const filePath = path.join(__dirname, '..', 'outlines', outline.file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Remove from metadata
    metadata.outlines.splice(outlineIndex, 1);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    res.json({ success: true, message: '大纲已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const parseMarkdownOutline = parseOutlineFile;

// Helper function to count knowledge points
function countKnowledgePoints(outline) {
  let count = 0;
  // New format: parts -> chapters -> kps
  if (outline.parts) {
    outline.parts.forEach(part => {
      if (part.chapters) {
        part.chapters.forEach(chapter => {
          if (chapter.kps) {
            count += chapter.kps.length;
          }
        });
      }
    });
  }
  // Old format: chapters -> kps
  if (outline.chapters) {
    outline.chapters.forEach(chapter => {
      if (chapter.kps) {
        count += chapter.kps.length;
      }
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
    const metadataPath = path.join(__dirname, '..', 'outlines', 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ success: false, message: '大纲不存在' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
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

    const kp = chapter.kps.find(k => k.id === selected.kp_id);
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
