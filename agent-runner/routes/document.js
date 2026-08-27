const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const logger = require('../lib/logger');

// ============================================
// 多路径配置
// ============================================
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'document-paths.json');

function loadDocPathsConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return config.paths || [];
    }
  } catch (err) {
    logger.warn('Failed to load document-paths config, using defaults');
  }
  return [
    { id: 'output', name: '生成文档', path: path.join(__dirname, '..', '..', 'output'), writable: true, description: '知识库生成器产出的文档' }
  ];
}

function resolveRoots() {
  const config = loadDocPathsConfig();
  return config.map(entry => {
    let absPath = entry.path;
    if (!path.isAbsolute(absPath)) {
      absPath = path.resolve(__dirname, '..', absPath);
    }
    return {
      id: entry.id,
      name: entry.name,
      absPath,
      writable: entry.writable !== false,
      description: entry.description || ''
    };
  });
}

// 路径安全校验
function isPathUnder(absPath, rootDir) {
  const normPath = path.resolve(absPath);
  const normRoot = path.resolve(rootDir);
  return normPath === normRoot || normPath.startsWith(normRoot + path.sep);
}

// 解码文档ID → { rootId, relativePath, absPath, root, writable }
function decodeDocId(docId) {
  const decoded = Buffer.from(docId, 'base64').toString('utf-8');
  const roots = resolveRoots();
  let rootId, relativePath;
  const colonIdx = decoded.indexOf(':');
  if (colonIdx > 0) {
    const candidate = decoded.substring(0, colonIdx);
    if (roots.some(r => r.id === candidate)) {
      rootId = candidate;
      relativePath = decoded.substring(colonIdx + 1);
    } else {
      rootId = roots[0]?.id || 'output';
      relativePath = decoded;
    }
  } else {
    rootId = roots[0]?.id || 'output';
    relativePath = decoded;
  }
  const root = roots.find(r => r.id === rootId);
  if (!root) return null;
  const absPath = path.resolve(root.absPath, relativePath);
  if (!isPathUnder(absPath, root.absPath)) return null;
  return { rootId, relativePath, absPath, root, writable: root.writable };
}

function encodeDocId(rootId, relativePath) {
  const encoded = rootId + ':' + relativePath;
  const roots = resolveRoots();
  const root = roots.find(r => r.id === rootId);
  if (!root) return null;
  const absPath = path.resolve(root.absPath, relativePath);
  if (!isPathUnder(absPath, root.absPath)) return null;
  return Buffer.from(encoded).toString('base64');
}

function encodePathSegments(relativePath) {
  return relativePath
    .split(path.sep)
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

function buildRawUrl(rootId, relativePath) {
  return '/api/document/raw/' + encodeURIComponent(rootId) + '/' + encodePathSegments(relativePath);
}

function resolveRawFile(rootId, requestPath) {
  const root = resolveRoots().find(item => item.id === rootId);
  if (!root || typeof requestPath !== 'string' || requestPath.length === 0) return null;

  let relativePath = requestPath;
  try {
    // Express decodes route parameters once. Decode bounded additional layers so
    // encoded traversal variants cannot bypass the lexical boundary check.
    for (let i = 0; i < 2; i += 1) {
      const decoded = decodeURIComponent(relativePath);
      if (decoded === relativePath) break;
      relativePath = decoded;
    }
  } catch (err) {
    return null;
  }
  if (relativePath.includes('\0')) return null;

  const lexicalRoot = path.resolve(root.absPath);
  const lexicalTarget = path.resolve(lexicalRoot, relativePath);
  if (!isPathUnder(lexicalTarget, lexicalRoot)) return null;

  try {
    if (!fs.statSync(lexicalTarget).isFile()) return null;
    const realRoot = fs.realpathSync(lexicalRoot);
    const realTarget = fs.realpathSync(lexicalTarget);
    if (!isPathUnder(realTarget, realRoot)) return null;
    return { root, realTarget };
  } catch (err) {
    return null;
  }
}

// ============================================
// 并发保护 - 文件锁
// ============================================
const fileLocks = new Map();

function acquireLock(key, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      const lockInfo = fileLocks.get(key);
      if (lockInfo && Date.now() - lockInfo.timestamp > 10000) {
        logger.warn(`[Lock] Force releasing stale lock: ${key}`);
        fileLocks.delete(key);
      }
      if (!fileLocks.get(key)) {
        fileLocks.set(key, { timestamp: Date.now() });
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Lock timeout for key: ${key}`));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

function releaseLock(key) {
  fileLocks.delete(key);
}

// ============================================
// 文档评论持久化
// ============================================
const COMMENTS_STORE_PATH = process.env.DOCUMENT_COMMENTS_PATH
  ? path.resolve(process.env.DOCUMENT_COMMENTS_PATH)
  : path.join(__dirname, '..', 'data', 'document-comments.json');
const COMMENTS_LOCK_KEY = 'document-comments';

function readCommentsStore() {
  if (!fs.existsSync(COMMENTS_STORE_PATH)) {
    return { version: 1, comments: [] };
  }
  const store = JSON.parse(fs.readFileSync(COMMENTS_STORE_PATH, 'utf-8'));
  if (!store || store.version !== 1 || !Array.isArray(store.comments)) {
    throw new Error('评论数据格式无效');
  }
  return store;
}

function writeCommentsStore(store) {
  const directory = path.dirname(COMMENTS_STORE_PATH);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = `${COMMENTS_STORE_PATH}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(temporaryPath, COMMENTS_STORE_PATH);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

function resolveExistingDocument(docId) {
  const decoded = decodeDocId(docId);
  if (!decoded) return null;
  try {
    return fs.statSync(decoded.absPath).isFile() ? decoded : null;
  } catch (err) {
    return null;
  }
}

// ============================================
// 元数据管理
// ============================================
function getMetadataFilePath() {
  const roots = resolveRoots();
  const outputRoot = roots.find(r => r.id === 'output') || roots[0];
  return path.join(outputRoot.absPath, 'metadata.json');
}

async function loadMetadata() {
  await acquireLock('metadata');
  try {
    const metaFile = getMetadataFilePath();
    if (fs.existsSync(metaFile)) {
      const data = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
      releaseLock('metadata');
      return data;
    }
    releaseLock('metadata');
  } catch (err) {
    releaseLock('metadata');
    logger.error('Failed to load metadata:', err.message);
  }
  return { documents: [], versions: {} };
}

async function saveMetadata(metadata) {
  await acquireLock('metadata');
  try {
    const metaFile = getMetadataFilePath();
    const dir = path.dirname(metaFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(metaFile, JSON.stringify(metadata, null, 2), 'utf-8');
    releaseLock('metadata');
  } catch (err) {
    releaseLock('metadata');
    throw err;
  }
}

function findMetaByPath(metadata, docPath) {
  return metadata.documents.find(d =>
    d.path === docPath ||
    d.path === 'output:' + docPath ||
    ('output:' + d.path) === docPath
  );
}

function generateDocId() {
  return 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// ============================================
// 文档上传预处理配置
// ============================================
const DOC_UPLOAD_DIR = path.join(__dirname, '..', 'tmp', 'doc-uploads');
const DOC_PROCESSED_DIR = path.join(__dirname, '..', 'tmp', 'doc-processed');

[DOC_UPLOAD_DIR, DOC_PROCESSED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOC_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.md', '.txt', '.json'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('当前仅支持 Markdown、纯文本、JSON 格式'));
    }
  }
});

const DOC_METADATA_PATH = path.join(DOC_PROCESSED_DIR, 'metadata.json');

async function loadDocMetadata() {
  await acquireLock('doc_metadata');
  try {
    if (fs.existsSync(DOC_METADATA_PATH)) {
      const data = JSON.parse(fs.readFileSync(DOC_METADATA_PATH, 'utf-8'));
      releaseLock('doc_metadata');
      return data;
    }
    releaseLock('doc_metadata');
  } catch (err) {
    releaseLock('doc_metadata');
    logger.error('Failed to load doc metadata:', err.message);
  }
  return { documents: [] };
}

async function saveDocMetadata(metadata) {
  await acquireLock('doc_metadata');
  try {
    if (!fs.existsSync(DOC_PROCESSED_DIR)) fs.mkdirSync(DOC_PROCESSED_DIR, { recursive: true });
    fs.writeFileSync(DOC_METADATA_PATH, JSON.stringify(metadata, null, 2));
    releaseLock('doc_metadata');
  } catch (err) {
    releaseLock('doc_metadata');
    throw err;
  }
}

function parseMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const result = { title: '', sections: [] };
  const sectionStack = [{ children: result.sections, level: 0 }];
  let currentSection = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim().replace(/\s*[⭐★]+\s*$/, '');
      if (level === 1 && !result.title) { result.title = title; continue; }
      if (['文档说明', '大纲定位', '目标人群', '前置知识', '难度分级', '学习路径', '章节依赖'].some(s => title.includes(s))) continue;
      currentSection = { level, title, content: '', children: [] };
      while (sectionStack.length > 1 && sectionStack[sectionStack.length - 1].level >= level) sectionStack.pop();
      sectionStack[sectionStack.length - 1].children.push(currentSection);
      sectionStack.push(currentSection);
      continue;
    }
    if (currentSection) currentSection.content += line + '\n';
  }

  function cleanSections(sections) {
    sections.forEach(s => { s.content = s.content.trim(); cleanSections(s.children || []); });
  }
  cleanSections(result.sections);
  return result;
}

function countSections(sections) {
  let count = sections.length;
  sections.forEach(s => { count += countSections(s.children || []); });
  return count;
}

// ============================================
// 路由：文档路径管理
// ============================================

// GET /api/document/paths - 获取所有配置的文档路径
router.get('/paths', (req, res) => {
  try {
    const roots = resolveRoots();
    res.json({
      success: true,
      data: roots.map(r => ({
        id: r.id, name: r.name, absPath: r.absPath,
        writable: r.writable, description: r.description,
        exists: fs.existsSync(r.absPath)
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/document/paths - 添加文档路径
router.post('/paths', (req, res) => {
  try {
    const { name, path: pathValue, writable } = req.body;
    if (!name || !pathValue) {
      return res.status(400).json({ success: false, message: '名称和路径为必填' });
    }
    const resolvedPath = path.isAbsolute(pathValue) ? pathValue : path.resolve(__dirname, '..', pathValue);
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
      return res.status(400).json({ success: false, message: '路径不存在或不是目录: ' + pathValue });
    }
    const config = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) : { paths: [] };
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (!slug) slug = 'path'; const newId = slug + '-' + Date.now().toString(36);
    const entry = {
      id: newId, name,
      path: pathValue,
      writable: writable !== undefined ? !!writable : false,
      description: req.body.description || ''
    };
    config.paths.push(entry);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    logger.info('Document path added', { id: newId, name, path: pathValue });
    res.json({ success: true, data: { ...entry, absPath: resolvedPath, exists: true } });
  } catch (err) {
    res.status(500).json({ success: false, message: '添加失败: ' + err.message });
  }
});

// DELETE /api/document/paths/:id - 删除文档路径
router.delete('/paths/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'output') return res.status(400).json({ success: false, message: '默认生成文档路径不可删除' });
    const config = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) : { paths: [] };
    const idx = config.paths.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: '路径不存在' });
    const removed = config.paths.splice(idx, 1)[0];
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    logger.info('Document path removed', { id, name: removed.name });
    res.json({ success: true, message: '路径已移除' });
  } catch (err) {
    res.status(500).json({ success: false, message: '删除失败: ' + err.message });
  }
});

// ============================================
// 路由：文档树
// ============================================

router.get('/tree', async (req, res) => {
  try {
    const roots = resolveRoots();
    const metadata = await loadMetadata();
    const rootNodes = [];

    for (const root of roots) {
      if (!fs.existsSync(root.absPath)) {
        rootNodes.push({
          name: root.name, path: root.id + ':', type: 'root',
          root_id: root.id, writable: root.writable,
          children: [], exists: false
        });
        continue;
      }
      function scanDir(dir, relPath) {
        const nodes = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const dirs = entries.filter(e => e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name));
        const files = entries.filter(e => e.isFile() && e.name !== 'metadata.json').sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of dirs) {
          const childRel = relPath ? path.join(relPath, entry.name) : entry.name;
          const children = scanDir(path.join(dir, entry.name), childRel);
          nodes.push({ name: entry.name, path: root.id + ':' + childRel, type: 'directory', children });
        }
        for (const entry of files) {
          const fileRel = relPath ? path.join(relPath, entry.name) : entry.name;
          const absPath = path.join(dir, entry.name);
          const stat = fs.statSync(absPath);
          const metaKey = root.id === 'output' ? fileRel : root.id + ':' + fileRel;
          const meta = findMetaByPath(metadata, metaKey) || metadata.documents.find(d => d.path === metaKey);
          nodes.push({
            name: entry.name, path: root.id + ':' + fileRel, type: 'file',
            id: encodeDocId(root.id, fileRel),
            size: stat.size, ext: path.extname(entry.name),
            updated_at: meta?.updated_at || stat.mtime.toISOString(),
            writable: root.writable
          });
        }
        return nodes;
      }

      const children = scanDir(root.absPath, '');
      rootNodes.push({
        name: root.name, path: root.id + ':', type: 'root',
        root_id: root.id, writable: root.writable,
        children, exists: true
      });
    }

    res.json({ success: true, data: rootNodes });
  } catch (err) {
    logger.error('Failed to build document tree:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// 路由：文档列表
// ============================================

router.get('/list', async (req, res) => {
  try {
    const { sort_by = 'created_at', sort_order = 'desc' } = req.query;
    const validSortFields = ['created_at', 'updated_at', 'title'];
    const safeSortBy = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const safeSortOrder = sort_order === 'asc' ? 'asc' : 'desc';

    const roots = resolveRoots();
    const metadata = await loadMetadata();
    const documents = [];

    for (const root of roots) {
      if (!fs.existsSync(root.absPath)) continue;
      function scanDir(dir, relPath) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const entryRel = relPath ? path.join(relPath, entry.name) : entry.name;
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
              scanDir(fullPath, entryRel);
            }
          } else if (entry.isFile() && entry.name !== 'metadata.json') {
            const stat = fs.statSync(fullPath);
            const metaKey = root.id === 'output' ? entryRel : root.id + ':' + entryRel;
            const meta = findMetaByPath(metadata, metaKey) || metadata.documents.find(d => d.path === metaKey);
            const ext = path.extname(entry.name);
            const title = ext === '.md' ? path.basename(entry.name, '.md') : entry.name;
            const pathParts = entryRel.split(path.sep);
            const knowledge_point = pathParts.length >= 2 ? pathParts.slice(0, -1).join(' > ') : '';
            documents.push({
              id: encodeDocId(root.id, entryRel),
              meta_id: meta?.id || null,
              title: meta?.title || title,
              knowledge_point,
              file_path: root.id + ':' + entryRel,
              file_size: stat.size,
              version: meta?.version || 1,
              created_at: meta?.created_at || stat.birthtime.toISOString(),
              updated_at: meta?.updated_at || stat.mtime.toISOString(),
              created_by: meta?.created_by || 'unknown',
              status: meta?.status || 'completed',
              root_id: root.id,
              root_name: root.name,
              writable: root.writable,
              ext
            });
          }
        }
      }
      scanDir(root.absPath, '');
    }

    documents.sort((a, b) => {
      if (safeSortBy === 'title') {
        return safeSortOrder === 'asc'
          ? (a.title || '').localeCompare(b.title || '', 'zh-CN')
          : (b.title || '').localeCompare(a.title || '', 'zh-CN');
      }
      const valA = new Date(a[safeSortBy] || 0).getTime();
      const valB = new Date(b[safeSortBy] || 0).getTime();
      return safeSortOrder === 'asc' ? valA - valB : valB - valA;
    });

    res.json({ success: true, data: documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// 路由：文档统计
// ============================================

router.get('/stats', async (req, res) => {
  try {
    const roots = resolveRoots();
    let totalDocs = 0;
    let totalSize = 0;
    let totalTokens = 0;

    // 统计所有根目录的文件数和大小
    for (const root of roots) {
      if (!fs.existsSync(root.absPath)) continue;
      function countDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
            countDir(fullPath);
          } else if (entry.isFile() && entry.name !== 'metadata.json') {
            totalDocs++;
            totalSize += fs.statSync(fullPath).size;
          }
        }
      }
      countDir(root.absPath);
    }

    // Token统计来自元数据
    const metadata = await loadMetadata();
    totalTokens = metadata.documents.reduce((sum, d) => sum + (d.tokens_used || 0), 0);

    res.json({
      success: true,
      data: {
        total_documents: totalDocs,
        total_size: totalSize,
        total_tokens: totalTokens,
        root_count: roots.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// 路由：全文搜索
// ============================================

router.post('/search', async (req, res) => {
  try {
    const { keyword, scope } = req.body;
    if (!keyword || keyword.trim().length === 0) {
      return res.json({ success: true, data: [] });
    }
    const searchScope = scope || 'all';
    const kw = keyword.trim().toLowerCase();
    const roots = resolveRoots();
    const metadata = await loadMetadata();
    const results = [];

    for (const root of roots) {
      if (!fs.existsSync(root.absPath)) continue;

      function searchInDir(dir, relPath) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const entryRel = relPath ? path.join(relPath, entry.name) : entry.name;

          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
              searchInDir(fullPath, entryRel);
            }
          } else if (entry.isFile() && entry.name !== 'metadata.json') {
            const stat = fs.statSync(fullPath);
            const ext = path.extname(entry.name);
            const title = ext === '.md' ? path.basename(entry.name, '.md') : entry.name;
            const docId = encodeDocId(root.id, entryRel);
            let matches = [];

            if (title.toLowerCase().includes(kw)) {
              matches.push({ line: 0, context: title, highlight: keyword.trim(), type: 'title' });
            }

            // 只搜索文本类文件的内容
            const textExts = ['.md', '.txt', '.json', '.yaml', '.yml', '.csv', '.log', '.html', '.xml', '.js', '.py', '.sh', '.css'];
            if (searchScope === 'all' && textExts.includes(ext.toLowerCase())) {
              try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const lines = content.split('\n');
                let matchCount = 0;
                for (let i = 0; i < lines.length && matchCount < 3; i++) {
                  if (lines[i].toLowerCase().includes(kw)) {
                    matches.push({ line: i + 1, context: lines[i].trim().substring(0, 120), highlight: keyword.trim(), type: 'content' });
                    matchCount++;
                  }
                }
              } catch (e) { /* 跳过无法读取的文件 */ }
            }

            if (matches.length > 0) {
              results.push({
                id: docId, title, path: root.id + ':' + entryRel,
                file_size: stat.size, root_id: root.id, root_name: root.name,
                writable: root.writable, ext,
                updated_at: stat.mtime.toISOString(), matches
              });
            }
          }
        }
      }
      searchInDir(root.absPath, '');
    }

    results.sort((a, b) => b.matches.length - a.matches.length);
    res.json({ success: true, data: results });
  } catch (err) {
    logger.error('Document search failed:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// 路由：生成文档
// ============================================

router.post('/generate', async (req, res) => {
  try {
    const { prompt, title, output_path, filename, metadata: extraMeta } = req.body;
    if (!prompt) return res.status(400).json({ success: false, message: 'prompt 是必填项' });

    const LLMClient = require('../lib/llm-client');
    const configManager = require('../lib/config-manager');
    const modelConfig = await configManager.getModelConfig();
    if (!modelConfig || (!modelConfig.api_key && !modelConfig.api_key_encrypted)) {
      return res.status(400).json({ success: false, message: '请先配置大模型 API Key' });
    }

    const llm = new LLMClient(modelConfig);
    const docTitle = title || '未命名文档';
    const response = await llm.chat(
      [{ role: 'user', content: prompt }],
      { max_tokens: modelConfig.max_tokens || 60000, temperature: 0.7 }
    );

    const content = response.content;
    const docFilename = filename || `${docTitle.replace(/[\/\\:*?"<>|]/g, '_')}.md`;
    const docOutputPath = output_path || '';

    // 生成文档始终写入 output 根
    const roots = resolveRoots();
    const outputRoot = roots.find(r => r.id === 'output') || roots[0];
    const relativePath = docOutputPath ? path.join(docOutputPath, docFilename) : docFilename;
    const fullPath = path.resolve(outputRoot.absPath, relativePath);
    if (!isPathUnder(fullPath, outputRoot.absPath)) {
      return res.status(400).json({ success: false, message: '非法路径' });
    }

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');

    const metadata = await loadMetadata();
    const docId = generateDocId();
    const now = new Date().toISOString();

    const docMeta = {
      id: docId, title: docTitle,
      path: 'output:' + relativePath,
      size: Buffer.byteLength(content, 'utf-8'),
      version: 1, created_at: now, updated_at: now,
      created_by: 'llm', model: modelConfig.model,
      prompt_length: prompt.length,
      tokens_used: response.usage?.total_tokens || 0,
      status: 'completed', tags: extraMeta?.tags || []
    };

    metadata.documents.push(docMeta);
    metadata.versions[docId] = [{ version: 1, content_length: content.length, timestamp: now, change: 'initial generation' }];
    await saveMetadata(metadata);

    logger.info('Document generated', { id: docId, path: relativePath, tokens: docMeta.tokens_used });
    res.json({
      success: true,
      data: { id: docId, title: docTitle, path: 'output:' + relativePath, content, size: docMeta.size, tokens_used: docMeta.tokens_used, created_at: now }
    });
  } catch (err) {
    logger.error('Document generation failed:', err.message);
    res.status(500).json({ success: false, message: '文档生成失败: ' + err.message });
  }
});

// ============================================
// 路由：保存文档
// ============================================

router.post('/save', async (req, res) => {
  try {
    const { id, content, path: docPath, title } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'content 是必填项' });

    // 通过ID解析目标路径
    let decoded = null;
    if (id) {
      decoded = decodeDocId(id);
    }
    if (!decoded && docPath) {
      // 尝试解析 docPath 格式
      decoded = decodeDocId(Buffer.from(docPath).toString('base64'));
    }
    if (!decoded) return res.status(400).json({ success: false, message: '无法确定文档路径' });
    if (!decoded.writable) return res.status(403).json({ success: false, message: '该文档路径为只读，不可编辑' });

    const targetAbsPath = decoded.absPath;
    const dir = path.dirname(targetAbsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetAbsPath, content, 'utf-8');
    const now = new Date().toISOString();

    const metadata = await loadMetadata();
    const metaKey = decoded.rootId + ':' + decoded.relativePath;
    let docMeta = metadata.documents.find(d => d.path === metaKey || d.path === decoded.relativePath);
    if (docMeta) {
      docMeta.version = (docMeta.version || 1) + 1;
      docMeta.updated_at = now;
      docMeta.size = Buffer.byteLength(content, 'utf-8');
      if (title) docMeta.title = title;
      if (!metadata.versions[docMeta.id]) metadata.versions[docMeta.id] = [];
      metadata.versions[docMeta.id].push({ version: docMeta.version, content_length: content.length, timestamp: now, change: 'manual edit' });
    } else {
      const newId = id || generateDocId();
      docMeta = {
        id: newId, title: title || path.basename(targetAbsPath, path.extname(targetAbsPath)),
        path: metaKey, size: Buffer.byteLength(content, 'utf-8'),
        version: 1, created_at: now, updated_at: now, created_by: 'user', status: 'completed'
      };
      metadata.documents.push(docMeta);
    }
    await saveMetadata(metadata);
    logger.info('Document saved', { id: docMeta.id, path: metaKey, version: docMeta.version });

    res.json({
      success: true,
      data: { id: docMeta.id, title: docMeta.title, path: metaKey, version: docMeta.version, size: docMeta.size, updated_at: now }
    });
  } catch (err) {
    logger.error('Document save failed:', err.message);
    res.status(500).json({ success: false, message: '保存失败: ' + err.message });
  }
});

// ============================================
// 路由：文档预处理（上传）
// ============================================

router.post('/preprocess', docUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: '未接收到文件' });
    const parsed = parseMarkdown(req.file.path);
    const docId = generateDocId();
    const storedName = `${docId}.json`;
    const docData = {
      id: docId, original_name: req.file.originalname, stored_file: storedName,
      title: parsed.title || path.basename(req.file.originalname, path.extname(req.file.originalname)),
      sections: parsed.sections, uploaded_at: new Date().toISOString(), status: 'processed'
    };
    fs.writeFileSync(path.join(DOC_PROCESSED_DIR, storedName), JSON.stringify(docData, null, 2), 'utf-8');
    const metadata = await loadDocMetadata();
    metadata.documents.push({ id: docId, title: docData.title, original_name: req.file.originalname, uploaded_at: docData.uploaded_at, status: 'processed', section_count: countSections(parsed.sections) });
    await saveDocMetadata(metadata);
    try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
    res.json({ success: true, data: docData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/preprocess', async (req, res) => {
  try {
    const metadata = await loadDocMetadata();
    res.json({ success: true, data: metadata.documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/preprocess/:id', (req, res) => {
  try {
    const jsonPath = path.join(DOC_PROCESSED_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(jsonPath)) return res.status(404).json({ success: false, message: '文档不存在' });
    const doc = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/preprocess/:id', async (req, res) => {
  try {
    const metadata = await loadDocMetadata();
    const docIndex = metadata.documents.findIndex(d => d.id === req.params.id);
    if (docIndex === -1) return res.status(404).json({ success: false, message: '文档不存在' });
    const doc = metadata.documents[docIndex];
    const storedPath = path.join(DOC_PROCESSED_DIR, doc.stored_file);
    if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
    const jsonPath = path.join(DOC_PROCESSED_DIR, `${doc.id}.json`);
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    metadata.documents.splice(docIndex, 1);
    await saveDocMetadata(metadata);
    res.json({ success: true, message: '文档已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/document/raw/:rootId/* - 在注册根目录内原样预览文件
router.get('/raw/:rootId/*', (req, res) => {
  const resolved = resolveRawFile(req.params.rootId, req.params[0]);
  if (!resolved) {
    return res.status(404).json({ success: false, message: '资源不存在或路径无效' });
  }

  const ext = path.extname(resolved.realTarget).toLowerCase();
  if (ext === '.html' || ext === '.htm') {
    res.type('html');
  } else {
    res.type(ext || 'application/octet-stream');
  }
  res.set('Content-Disposition', 'inline');
  res.set('X-Content-Type-Options', 'nosniff');
  // The configured root may itself contain a dot-prefixed directory (for example
  // the registered `.codex` knowledge-center root). The path has already passed
  // lexical and realpath boundary checks above, so allow that specific file only;
  // do not expose the root as an unrestricted static directory.
  return res.sendFile(resolved.realTarget, { dotfiles: 'allow' });
});

// GET /api/document/:id/comments - 获取文档评论
router.get('/:id/comments', async (req, res) => {
  if (!resolveExistingDocument(req.params.id)) {
    return res.status(404).json({ success: false, message: '文档不存在或路径无效' });
  }

  let lockAcquired = false;
  try {
    await acquireLock(COMMENTS_LOCK_KEY);
    lockAcquired = true;
    const comments = readCommentsStore().comments
      .filter(comment => comment.documentId === req.params.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    return res.json({ success: true, data: comments, count: comments.length });
  } catch (err) {
    logger.error('Document comments load failed:', err.message);
    return res.status(500).json({ success: false, message: '评论读取失败' });
  } finally {
    if (lockAcquired) releaseLock(COMMENTS_LOCK_KEY);
  }
});

// POST /api/document/:id/comments - 新增文档评论
router.post('/:id/comments', async (req, res) => {
  if (!resolveExistingDocument(req.params.id)) {
    return res.status(404).json({ success: false, message: '文档不存在或路径无效' });
  }

  const { content, quote = '' } = req.body || {};
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ success: false, message: '评论内容不能为空' });
  }
  if (typeof quote !== 'string') {
    return res.status(400).json({ success: false, message: '引用文本格式无效' });
  }

  const comment = {
    id: `comment_${crypto.randomUUID()}`,
    documentId: req.params.id,
    content: content.trim(),
    quote: quote.trim(),
    createdAt: new Date().toISOString()
  };

  let lockAcquired = false;
  try {
    await acquireLock(COMMENTS_LOCK_KEY);
    lockAcquired = true;
    const store = readCommentsStore();
    store.comments.push(comment);
    writeCommentsStore(store);
    return res.status(201).json({ success: true, data: comment });
  } catch (err) {
    logger.error('Document comment create failed:', err.message);
    return res.status(500).json({ success: false, message: '评论保存失败' });
  } finally {
    if (lockAcquired) releaseLock(COMMENTS_LOCK_KEY);
  }
});

// DELETE /api/document/:id/comments/:commentId - 删除文档评论
router.delete('/:id/comments/:commentId', async (req, res) => {
  if (!resolveExistingDocument(req.params.id)) {
    return res.status(404).json({ success: false, message: '文档不存在或路径无效' });
  }

  let lockAcquired = false;
  try {
    await acquireLock(COMMENTS_LOCK_KEY);
    lockAcquired = true;
    const store = readCommentsStore();
    const commentIndex = store.comments.findIndex(comment =>
      comment.id === req.params.commentId && comment.documentId === req.params.id
    );
    if (commentIndex === -1) {
      return res.status(404).json({ success: false, message: '评论不存在' });
    }
    store.comments.splice(commentIndex, 1);
    writeCommentsStore(store);
    return res.json({ success: true, message: '评论已删除' });
  } catch (err) {
    logger.error('Document comment delete failed:', err.message);
    return res.status(500).json({ success: false, message: '评论删除失败' });
  } finally {
    if (lockAcquired) releaseLock(COMMENTS_LOCK_KEY);
  }
});

// ============================================
// 参数路径路由 — 放在最后
// ============================================

// GET /api/document/:id - 文档元数据
router.get('/:id', async (req, res) => {
  try {
    const decoded = decodeDocId(req.params.id);
    if (!decoded) return res.status(404).json({ success: false, message: '文档不存在或路径无效' });
    if (!fs.existsSync(decoded.absPath)) return res.status(404).json({ success: false, message: '文档不存在' });

    const stat = fs.statSync(decoded.absPath);
    const ext = path.extname(decoded.absPath);
    const title = ext === '.md' ? path.basename(decoded.absPath, '.md') : path.basename(decoded.absPath);
    const pathParts = decoded.relativePath.split(path.sep);
    const knowledge_point = pathParts.length >= 2 ? pathParts.slice(0, -1).join(' > ') : '';

    const metadata = await loadMetadata();
    const metaKey = decoded.rootId + ':' + decoded.relativePath;
    const meta = findMetaByPath(metadata, metaKey) || metadata.documents.find(d => d.path === metaKey);

    res.json({
      success: true,
      data: {
        id: req.params.id, meta_id: meta?.id, title: meta?.title || title,
        knowledge_point, file_path: metaKey, file_size: stat.size,
        version: meta?.version || 1,
        created_at: meta?.created_at || stat.birthtime.toISOString(),
        updated_at: meta?.updated_at || stat.mtime.toISOString(),
        created_by: meta?.created_by || 'unknown',
        status: meta?.status || 'completed',
        root_id: decoded.rootId, root_name: decoded.root.name,
        writable: decoded.writable, ext,
        raw_url: buildRawUrl(decoded.rootId, decoded.relativePath)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/document/:id/content
router.get('/:id/content', async (req, res) => {
  try {
    const decoded = decodeDocId(req.params.id);
    if (!decoded) return res.status(404).json({ success: false, message: '文档不存在或路径无效' });
    if (!fs.existsSync(decoded.absPath)) return res.status(404).json({ success: false, message: '文档不存在' });

    const content = fs.readFileSync(decoded.absPath, 'utf-8');
    const stat = fs.statSync(decoded.absPath);
    const ext = path.extname(decoded.absPath);
    const title = ext === '.md' ? path.basename(decoded.absPath, '.md') : path.basename(decoded.absPath);
    const pathParts = decoded.relativePath.split(path.sep);
    const knowledge_point = pathParts.length >= 2 ? pathParts.slice(0, -1).join(' > ') : '';

    const metadata = await loadMetadata();
    const metaKey = decoded.rootId + ':' + decoded.relativePath;
    const meta = findMetaByPath(metadata, metaKey) || metadata.documents.find(d => d.path === metaKey);

    res.json({
      success: true,
      data: {
        id: req.params.id, meta_id: meta?.id, title: meta?.title || title,
        knowledge_point, content, file_path: metaKey, file_size: stat.size,
        version: meta?.version || 1,
        created_at: meta?.created_at || stat.birthtime.toISOString(),
        updated_at: meta?.updated_at || stat.mtime.toISOString(),
        root_id: decoded.rootId, root_name: decoded.root.name,
        writable: decoded.writable, ext,
        raw_url: buildRawUrl(decoded.rootId, decoded.relativePath)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/document/:id/download
router.get('/:id/download', (req, res) => {
  try {
    const decoded = decodeDocId(req.params.id);
    if (!decoded) return res.status(404).json({ success: false, message: '文档不存在' });
    if (!fs.existsSync(decoded.absPath)) return res.status(404).json({ success: false, message: '文档不存在' });
    res.download(decoded.absPath, path.basename(decoded.absPath));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/document/:id/versions
router.get('/:id/versions', async (req, res) => {
  try {
    const metadata = await loadMetadata();
    const versions = metadata.versions[req.params.id] || [];
    res.json({ success: true, data: versions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/document/:id
router.delete('/:id', async (req, res) => {
  try {
    const decoded = decodeDocId(req.params.id);
    if (!decoded) return res.status(404).json({ success: false, message: '文档不存在' });
    if (!decoded.writable) return res.status(403).json({ success: false, message: '该文档路径为只读，不可删除' });
    if (!fs.existsSync(decoded.absPath)) return res.status(404).json({ success: false, message: '文档不存在' });

    fs.unlinkSync(decoded.absPath);

    const metadata = await loadMetadata();
    const metaKey = decoded.rootId + ':' + decoded.relativePath;
    metadata.documents = metadata.documents.filter(d =>
      d.path !== metaKey && d.path !== decoded.relativePath
    );
    await saveMetadata(metadata);

    res.json({ success: true, message: '文档已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
