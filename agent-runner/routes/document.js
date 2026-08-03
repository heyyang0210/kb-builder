const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');
const LLMClient = require('../lib/llm-client');
const configManager = require('../lib/config-manager');
const logger = require('../lib/logger');

// 元数据文件路径
const METADATA_FILE = path.join(OUTPUT_DIR, 'metadata.json');
// ============================================
// 并发保护机制 - 文件锁（改进版）
// ============================================
const fileLocks = new Map();

function acquireLock(key, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      const lockInfo = fileLocks.get(key);
      // 检查锁是否已过期（防止死锁）
      if (lockInfo && Date.now() - lockInfo.timestamp > 10000) {
        console.warn(`[Lock] Force releasing stale lock: ${key}`);
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


async function loadMetadata() {
  await acquireLock('metadata');
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
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
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
    releaseLock('metadata');
  } catch (err) {
    releaseLock('metadata');
    throw err;
  }
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

// ============================================
// 路由定义 — 固定路径优先于参数路径
// ============================================

// GET /api/document/list
// 支持排序参数: sort_by (created_at|updated_at|title), sort_order (asc|desc)
router.get('/list', async (req, res) => {
  try {
    const { sort_by = 'created_at', sort_order = 'desc' } = req.query;
    const validSortFields = ['created_at', 'updated_at', 'title'];
    const validSortOrders = ['asc', 'desc'];
    const safeSortBy = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const safeSortOrder = validSortOrders.includes(sort_order) ? sort_order : 'desc';

    const documents = [];
    if (!fs.existsSync(OUTPUT_DIR)) return res.json({ success: true, data: [] });

    // 在外部加载 metadata，避免在循环中重复加载
    const metadata = await loadMetadata();

    function scanDir(dir, relativePath = '') {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        if (file === 'metadata.json') return;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          scanDir(filePath, path.join(relativePath, file));
        } else if (file.endsWith('.md')) {
          const docPath = path.join(relativePath, file);
          const title = path.basename(file, '.md');
          const pathParts = docPath.split(path.sep);
          let knowledge_point = '';
          if (pathParts.length >= 2) knowledge_point = pathParts.slice(0, -1).join(' > ');

          // 尝试从 metadata 中获取更多信息
          const meta = metadata.documents.find(d => d.path === docPath);

          documents.push({
            id: Buffer.from(docPath).toString('base64'),
            meta_id: meta?.id || null,
            title: meta?.title || title,
            knowledge_point: knowledge_point,
            file_path: docPath,
            file_size: stat.size,
            version: meta?.version || 1,
            created_at: meta?.created_at || stat.birthtime.toISOString(),
            updated_at: meta?.updated_at || stat.mtime.toISOString(),
            created_by: meta?.created_by || 'unknown',
            status: meta?.status || 'completed'
          });
        }
      });
    }
    scanDir(OUTPUT_DIR);

    // 动态排序
    documents.sort((a, b) => {
      if (safeSortBy === 'title') {
        const valA = (a.title || '').toLowerCase();
        const valB = (b.title || '').toLowerCase();
        return safeSortOrder === 'asc'
          ? valA.localeCompare(valB, 'zh-CN')
          : valB.localeCompare(valA, 'zh-CN');
      } else {
        const valA = new Date(a[safeSortBy] || 0).getTime();
        const valB = new Date(b[safeSortBy] || 0).getTime();
        return safeSortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });

    res.json({ success: true, data: documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/document/generate - 根据提示词直接生成文档
router.post('/generate', async (req, res) => {
  try {
    const { prompt, title, output_path, filename, metadata: extraMeta } = req.body;
    if (!prompt) return res.status(400).json({ success: false, message: 'prompt 是必填项' });

    const modelConfig = await configManager.getModelConfig();
    if (!modelConfig || (!modelConfig.api_key && !modelConfig.api_key_encrypted)) {
      return res.status(400).json({ success: false, message: '请先配置大模型 API Key' });
    }

    const llm = new LLMClient(modelConfig);
    const docTitle = title || '未命名文档';

    const systemPrompt = `你是 YashanDB 数据库知识库文档撰写专家。请根据用户提供的提示词，生成一篇高质量的技术文档。

要求：
1. 使用 Markdown 格式
2. 文档标题使用一级标题
3. 结构清晰，包含概述、详细说明、示例、注意事项等章节
4. 代码示例使用代码块标注语言类型
5. 表格数据使用 Markdown 表格
6. 内容准确、专业、易于理解

文档标题：${docTitle}`;

    logger.info('Document generation started', { title: docTitle, prompt_length: prompt.length });

    const response = await llm.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      { max_tokens: modelConfig.max_tokens || 60000, temperature: 0.7 }
    );

    const content = response.content;
    const docFilename = filename || `${docTitle.replace(/[\/\\:*?"<>|]/g, '_')}.md`;
    const docOutputPath = output_path || '';
    const relativePath = docOutputPath ? path.join(docOutputPath, docFilename) : docFilename;
    const fullPath = path.join(OUTPUT_DIR, relativePath);

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');

    const metadata = await loadMetadata();
    const docId = generateDocId();
    const now = new Date().toISOString();

    const docMeta = {
      id: docId,
      title: docTitle,
      path: relativePath,
      size: Buffer.byteLength(content, 'utf-8'),
      version: 1,
      created_at: now,
      updated_at: now,
      created_by: 'llm',
      model: modelConfig.model,
      prompt_length: prompt.length,
      tokens_used: response.usage?.total_tokens || 0,
      status: 'completed',
      tags: extraMeta?.tags || []
    };

    metadata.documents.push(docMeta);
    metadata.versions[docId] = [{
      version: 1, content_length: content.length, timestamp: now, change: 'initial generation'
    }];
    await saveMetadata(metadata);

    logger.info('Document generated successfully', { id: docId, path: relativePath, tokens: docMeta.tokens_used });

    res.json({
      success: true,
      data: { id: docId, title: docTitle, path: relativePath, content, size: docMeta.size, tokens_used: docMeta.tokens_used, created_at: now }
    });
  } catch (err) {
    logger.error('Document generation failed:', err.message);
    res.status(500).json({ success: false, message: '文档生成失败: ' + err.message });
  }
});

// POST /api/document/save - 保存/更新文档内容
router.post('/save', async (req, res) => {
  try {
    const { id, content, path: docPath, title } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'content 是必填项' });

    let targetPath = docPath;
    let docId = id;
    const metadata = await loadMetadata();

    if (id && !docPath) {
      const doc = metadata.documents.find(d => d.id === id);
      if (doc) targetPath = doc.path;
    }
    if (id && !targetPath) {
      try { targetPath = Buffer.from(id, 'base64').toString('utf-8'); } catch (e) { /* ignore */ }
    }
    if (!targetPath) return res.status(400).json({ success: false, message: '无法确定文档路径' });

    const fullPath = path.join(OUTPUT_DIR, targetPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    const now = new Date().toISOString();

    let docMeta = metadata.documents.find(d => d.id === docId || d.path === targetPath);
    if (docMeta) {
      docMeta.version = (docMeta.version || 1) + 1;
      docMeta.updated_at = now;
      docMeta.size = Buffer.byteLength(content, 'utf-8');
      if (title) docMeta.title = title;
      if (!metadata.versions[docMeta.id]) metadata.versions[docMeta.id] = [];
      metadata.versions[docMeta.id].push({
        version: docMeta.version, content_length: content.length, timestamp: now, change: 'manual edit'
      });
    } else {
      docId = docId || generateDocId();
      docMeta = {
        id: docId, title: title || path.basename(targetPath, '.md'), path: targetPath,
        size: Buffer.byteLength(content, 'utf-8'), version: 1,
        created_at: now, updated_at: now, created_by: 'user', status: 'completed'
      };
      metadata.documents.push(docMeta);
    }
    await saveMetadata(metadata);

    logger.info('Document saved', { id: docMeta.id, path: targetPath, version: docMeta.version });

    res.json({
      success: true,
      data: { id: docMeta.id, title: docMeta.title, path: targetPath, version: docMeta.version, size: docMeta.size, updated_at: now }
    });
  } catch (err) {
    logger.error('Document save failed:', err.message);
    res.status(500).json({ success: false, message: '保存失败: ' + err.message });
  }
});

// GET /api/document/stats - 文档统计信息
router.get('/stats', async (req, res) => {
  try {
    const metadata = await loadMetadata();
    const totalDocs = metadata.documents.length;
    const totalSize = metadata.documents.reduce((sum, d) => sum + (d.size || 0), 0);
    const totalTokens = metadata.documents.reduce((sum, d) => sum + (d.tokens_used || 0), 0);
    res.json({
      success: true,
      data: {
        total_documents: totalDocs, total_size: totalSize, total_tokens: totalTokens,
        last_updated: metadata.documents.length > 0
          ? metadata.documents.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0].updated_at
          : null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// GET /api/document/tree - 目录树结构
router.get('/tree', async (req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json({ success: true, data: [] });
    }
    
    const metadata = await loadMetadata();
    
    function scanDir(dir, relativePath) {
      const nodes = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      // 分离目录和文件，目录排前面
      const dirs = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
      const files = entries.filter(e => e.isFile() && e.name.endsWith('.md') && e.name !== 'metadata.json')
                           .sort((a, b) => a.name.localeCompare(b.name));
      
      for (const entry of dirs) {
        const childPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
        const fullPath = path.join(dir, entry.name);
        const children = scanDir(fullPath, childPath);
        nodes.push({
          name: entry.name,
          path: childPath,
          type: 'directory',
          children: children
        });
      }
      
      for (const entry of files) {
        const filePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
        const absPath = path.join(dir, entry.name);
        const stat = fs.statSync(absPath);
        const meta = metadata.documents.find(d => d.path === filePath);
        
        nodes.push({
          name: entry.name,
          path: filePath,
          type: 'file',
          id: Buffer.from(filePath).toString('base64'),
          size: stat.size,
          version: meta?.version || 1,
          updated_at: meta?.updated_at || stat.mtime.toISOString(),
          created_by: meta?.created_by || 'unknown'
        });
      }
      
      return nodes;
    }
    
    const tree = scanDir(OUTPUT_DIR, '');
    res.json({ success: true, data: tree });
  } catch (err) {
    logger.error('Failed to build document tree:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/document/search - 全文搜索
router.post('/search', async (req, res) => {
  try {
    const { keyword, scope } = req.body;
    if (!keyword || keyword.trim().length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const searchScope = scope || 'all'; // "all" | "title"
    const kw = keyword.trim().toLowerCase();
    const metadata = await loadMetadata();
    const results = [];
    
    function searchInDir(dir, relativePath) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const filePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
        
        if (entry.isDirectory()) {
          searchInDir(fullPath, filePath);
        } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'metadata.json') {
          const stat = fs.statSync(fullPath);
          const meta = metadata.documents.find(d => d.path === filePath);
          const title = path.basename(entry.name, '.md');
          const docId = Buffer.from(filePath).toString('base64');
          
          let matches = [];
          
          // 标题搜索
          if (title.toLowerCase().includes(kw)) {
            matches.push({
              line: 0,
              context: title,
              highlight: keyword.trim(),
              type: 'title'
            });
          }
          
          // 内容搜索
          if (searchScope === 'all') {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');
              let matchCount = 0;
              
              for (let i = 0; i < lines.length && matchCount < 3; i++) {
                const lineLower = lines[i].toLowerCase();
                if (lineLower.includes(kw)) {
                  matches.push({
                    line: i + 1,
                    context: lines[i].trim().substring(0, 120),
                    highlight: keyword.trim(),
                    type: 'content'
                  });
                  matchCount++;
                }
              }
            } catch (e) {
              // 跳过无法读取的文件
            }
          }
          
          if (matches.length > 0) {
            results.push({
              id: docId,
              title: meta?.title || title,
              path: filePath,
              file_size: stat.size,
              version: meta?.version || 1,
              updated_at: meta?.updated_at || stat.mtime.toISOString(),
              matches: matches
            });
          }
        }
      }
    }
    
    searchInDir(OUTPUT_DIR, '');
    
    // 按匹配数量排序
    results.sort((a, b) => b.matches.length - a.matches.length);
    
    res.json({ success: true, data: results });
  } catch (err) {
    logger.error('Document search failed:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/document/preprocess - 上传文档预处理
router.post('/preprocess', docUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: '未接收到文件' });

    const parsed = parseMarkdown(req.file.path);
    const docId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
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

function countSections(sections) {
  let count = sections.length;
  sections.forEach(s => { count += countSections(s.children || []); });
  return count;
}

// GET /api/document/preprocess - 列出预处理文档
router.get('/preprocess', async (req, res) => {
  try {
    const metadata = await loadDocMetadata();
    res.json({ success: true, data: metadata.documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/document/preprocess/:id
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

// DELETE /api/document/preprocess/:id
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

// ============================================
// 参数路径路由 — 放在最后
// ============================================

// GET /api/document/:id - 文档元数据
router.get('/:id', async (req, res) => {
  try {
    const docPath = Buffer.from(req.params.id, 'base64').toString('utf-8');
    const filePath = path.join(OUTPUT_DIR, docPath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: '文档不存在' });
    const stat = fs.statSync(filePath);
    const title = path.basename(filePath, '.md');
    const pathParts = docPath.split(path.sep);
    let knowledge_point = pathParts.length >= 2 ? pathParts.slice(0, -1).join(' > ') : '';
    const metadata = await loadMetadata();
    const meta = metadata.documents.find(d => d.path === docPath);

    res.json({
      success: true,
      data: {
        id: req.params.id, meta_id: meta?.id, title: meta?.title || title,
        knowledge_point, file_path: docPath, file_size: stat.size,
        version: meta?.version || 1, created_at: meta?.created_at || stat.birthtime.toISOString(),
        updated_at: meta?.updated_at || stat.mtime.toISOString(),
        created_by: meta?.created_by || 'unknown', status: meta?.status || 'completed'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/document/:id/content
router.get('/:id/content', async (req, res) => {
  try {
    const docPath = Buffer.from(req.params.id, 'base64').toString('utf-8');
    const filePath = path.join(OUTPUT_DIR, docPath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: '文档不存在' });
    const content = fs.readFileSync(filePath, 'utf-8');
    const stat = fs.statSync(filePath);
    const title = path.basename(filePath, '.md');
    const pathParts = docPath.split(path.sep);
    let knowledge_point = pathParts.length >= 2 ? pathParts.slice(0, -1).join(' > ') : '';
    const metadata = await loadMetadata();
    const meta = metadata.documents.find(d => d.path === docPath);

    res.json({
      success: true,
      data: {
        id: req.params.id, meta_id: meta?.id, title: meta?.title || title,
        knowledge_point, content, file_path: docPath, file_size: stat.size,
        version: meta?.version || 1, created_at: meta?.created_at || stat.birthtime.toISOString(),
        updated_at: meta?.updated_at || stat.mtime.toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/document/:id/download
router.get('/:id/download', (req, res) => {
  try {
    const docPath = Buffer.from(req.params.id, 'base64').toString('utf-8');
    const filePath = path.join(OUTPUT_DIR, docPath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: '文档不存在' });
    res.download(filePath, path.basename(filePath));
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
    const docPath = Buffer.from(req.params.id, 'base64').toString('utf-8');
    const filePath = path.join(OUTPUT_DIR, docPath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: '文档不存在' });
    fs.unlinkSync(filePath);

    // 清理元数据
    const metadata = await loadMetadata();
    metadata.documents = metadata.documents.filter(d => d.path !== docPath);
    await saveMetadata(metadata);

    res.json({ success: true, message: '文档已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
