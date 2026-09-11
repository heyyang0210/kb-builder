const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const OUTLINE_STATES = new Set([
  'draft', 'parsing', 'preflight_failed', 'pending_confirmation',
  'confirmed', 'published', 'superseded', 'archived'
]);

function stableId(namespace, value) {
  return `${namespace}_${crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16)}`;
}

function normalizeContent(content, fallbackTitle = '上传的大纲') {
  const source = content && typeof content === 'object' ? content : {};
  const sourceParts = Array.isArray(source.parts)
    ? source.parts
    : Array.isArray(source.chapters) ? [{ part: '默认部分', chapters: source.chapters }] : [];
  return {
    title: String(source.title || source.name || fallbackTitle),
    parts: sourceParts.map(part => ({
      part: String(part.part || part.name || part.title || '未命名部分'),
      level: String(part.level || '⭐'),
      chapters: (Array.isArray(part.chapters) ? part.chapters : []).map(chapter => ({
        name: String(chapter.name || chapter.title || '未命名章节'),
        kps: (Array.isArray(chapter.kps) ? chapter.kps : Array.isArray(chapter.knowledgePoints) ? chapter.knowledgePoints : []).map((kp, index) => ({
          id: String(kp.id || kp.code || `kp-${index + 1}`),
          name: String(kp.name || kp.title || '未命名知识点'),
          desc: String(kp.desc || kp.description || kp.name || kp.title || '')
        }))
      }))
    }))
  };
}

function parseMarkdownOutlineText(raw, fallbackTitle = '上传的大纲') {
  const lines = String(raw || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const outline = { title: fallbackTitle, parts: [] };
  let currentPart = null;
  let currentChapter = null;
  let currentKnowledgePoint = null;
  let inCodeBlock = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock || !trimmed || trimmed === '---') continue;
    const numberedPart = trimmed.match(/^#\s+(\d+)\.\s*(.+)$/);
    const namedPart = trimmed.match(/^##\s+(第[^：:]+部分)[：:]\s*(.+?)(?:\s*[⭐★]+)?$/);
    if (numberedPart || namedPart) {
      const label = numberedPart ? `${numberedPart[1]}. ${numberedPart[2]}` : `${namedPart[1]}：${namedPart[2].replace(/\s*[⭐★]+\s*$/, '').trim()}`;
      currentPart = { part: label, level: (trimmed.match(/[⭐★]+/) || ['⭐'])[0], chapters: [] };
      outline.parts.push(currentPart);
      currentChapter = null;
      currentKnowledgePoint = null;
      continue;
    }
    const headingChapter = trimmed.match(/^#{2,3}\s+(\d+\.\d+)\s+(.+)$/);
    if (headingChapter && currentPart) {
      currentChapter = { name: `${headingChapter[1]} ${headingChapter[2]}`, kps: [] };
      currentPart.chapters.push(currentChapter);
      currentKnowledgePoint = null;
      continue;
    }
    const headingKnowledgePoint = trimmed.match(/^#{3,4}\s+(\d+(?:\.\d+){2,})\s+(.+)$/);
    if (headingKnowledgePoint && currentChapter) {
      currentKnowledgePoint = { id: headingKnowledgePoint[1], name: headingKnowledgePoint[2].trim(), desc: '' };
      currentChapter.kps.push(currentKnowledgePoint);
      continue;
    }
    if (trimmed.startsWith('# ')) { outline.title = trimmed.slice(2).trim() || fallbackTitle; continue; }
    if (trimmed.startsWith('## 文档说明') || trimmed.startsWith('### 大纲定位') ||
        trimmed.startsWith('### 目标人群') || trimmed.startsWith('### 前置知识') ||
        trimmed.startsWith('### 难度分级') || trimmed.startsWith('### 学习路径') ||
        trimmed.startsWith('### 章节依赖')) continue;
    if (trimmed.startsWith('|') || trimmed.startsWith('┌') || trimmed.startsWith('└') ||
        trimmed.startsWith('├') || trimmed.startsWith('│') || trimmed.startsWith('🎯') ||
        trimmed.startsWith('- **必须') || trimmed.startsWith('- **推荐')) continue;

    const partMatch = trimmed.match(/^##\s+([一二三四五六七八九十百]+)、(.+?)(?:\s*[⭐★]+)?$/);
    if (partMatch) {
      currentPart = { part: `${partMatch[1]}、${partMatch[2].replace(/\s*[⭐★]+\s*$/, '').trim()}`, level: (trimmed.match(/[⭐★]+/) || ['⭐'])[0], chapters: [] };
      outline.parts.push(currentPart);
      currentChapter = null;
      currentKnowledgePoint = null;
      continue;
    }
    const chapterMatch = trimmed.match(/^-\s+\*\*(\d+(?:\.\d+)+)\s+(.+?)\*\*$/);
    if (chapterMatch && currentPart) {
      currentChapter = { name: `${chapterMatch[1]} ${chapterMatch[2]}`, kps: [] };
      currentPart.chapters.push(currentChapter);
      currentKnowledgePoint = null;
      continue;
    }
    const kpMatch = trimmed.match(/^-\s+(\d+(?:\.\d+){2,})\s+([⭐★]*)\s*(.+)$/);
    if (kpMatch && currentChapter) {
      const text = kpMatch[3].trim();
      const colonIndex = Math.max(text.indexOf('：'), text.indexOf(':'));
      const name = colonIndex > 0 ? text.slice(0, colonIndex).trim() : text;
      const description = colonIndex > 0 ? text.slice(colonIndex + 1).trim() : name;
      currentKnowledgePoint = { id: kpMatch[1], name, desc: description || name };
      currentChapter.kps.push(currentKnowledgePoint);
      continue;
    }
    if (currentKnowledgePoint && /^[-*]\s+/.test(trimmed)) {
      const detail = trimmed.replace(/^[-*]\s+/, '').replace(/\*\*/g, '').trim();
      if (detail) currentKnowledgePoint.desc = currentKnowledgePoint.desc ? `${currentKnowledgePoint.desc}；${detail}` : detail;
    }
  }
  return normalizeContent(outline, fallbackTitle);
}

function parseCsvOutlineText(raw, fallbackTitle = '上传的大纲') {
  const rows = String(raw || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).map(line => line.split(',').map(cell => cell.trim()));
  const headers = rows.shift() || [];
  const column = (...names) => names.map(name => headers.indexOf(name)).find(index => index >= 0);
  const partIndex = column('part', '部分');
  const chapterIndex = column('chapter', '章节');
  const idIndex = column('id', 'kp_id', '知识点编号');
  const nameIndex = column('name', 'title', '知识点');
  const descIndex = column('desc', 'description', '描述');
  const parts = new Map();
  rows.forEach((row, rowIndex) => {
    const partName = row[partIndex] || '默认部分';
    const chapterName = row[chapterIndex] || '未分章';
    if (!parts.has(partName)) parts.set(partName, new Map());
    const chapters = parts.get(partName);
    if (!chapters.has(chapterName)) chapters.set(chapterName, []);
    chapters.get(chapterName).push({ id: row[idIndex] || `kp-${rowIndex + 1}`, name: row[nameIndex] || '未命名知识点', desc: row[descIndex] || row[nameIndex] || '' });
  });
  return normalizeContent({ title: fallbackTitle, parts: [...parts].map(([part, chapters]) => ({ part, chapters: [...chapters].map(([name, kps]) => ({ name, kps })) })) }, fallbackTitle);
}

function parseOutlineText(raw, extension = '.md', options = {}) {
  const ext = String(extension || '.md').toLowerCase();
  const fallbackTitle = options.fallbackTitle || '上传的大纲';
  if (ext === '.json' || ext === 'json') return normalizeContent(JSON.parse(String(raw || '').replace(/^\uFEFF/, '')), fallbackTitle);
  if (ext === '.csv' || ext === 'csv') return parseCsvOutlineText(raw, fallbackTitle);
  return parseMarkdownOutlineText(raw, fallbackTitle);
}

function parseOutlineFile(filePath) {
  return parseOutlineText(fs.readFileSync(filePath, 'utf8'), path.extname(filePath), { fallbackTitle: path.basename(filePath, path.extname(filePath)) });
}

function nodesFromContent(content, outlineId = 'candidate') {
  const nodes = [];
  for (const [partIndex, part] of (content?.parts || []).entries()) {
    const partPath = `${partIndex + 1}:${part.part || ''}`;
    const partId = part.id || stableId('section', `${outlineId}:${partPath}`);
    nodes.push({ id: partId, parentId: null, kind: 'part', title: part.part || '', order: partIndex + 1 });
    for (const [chapterIndex, chapter] of (part.chapters || []).entries()) {
      const chapterPath = `${partPath}/${chapterIndex + 1}:${chapter.name || ''}`;
      const chapterId = chapter.id || stableId('section', `${outlineId}:${chapterPath}`);
      nodes.push({ id: chapterId, parentId: partId, kind: 'chapter', title: chapter.name || '', order: chapterIndex + 1 });
      for (const [kpIndex, kp] of (chapter.kps || []).entries()) {
        nodes.push({
          id: kp.stableId || stableId('knowledge', `${outlineId}:${chapterPath}/${kp.id || kpIndex + 1}`),
          sourceId: kp.id || null,
          parentId: chapterId,
          kind: 'knowledge_point',
          title: kp.name || '',
          description: kp.desc || '',
          order: kpIndex + 1
        });
      }
    }
  }
  return nodes;
}

function normalizeOutline(outline) {
  const productId = outline.productId || null;
  const tags = Array.isArray(outline.businessVersionTags) ? outline.businessVersionTags : [];
  const nodes = nodesFromContent(outline.content, outline.id);
  return {
    id: outline.id,
    handbookId: outline.handbookId || outline.id,
    manualId: outline.manualId || outline.manual_id || null,
    name: outline.name,
    productId,
    businessVersionTags: tags,
    outlineStructureVersion: outline.outlineStructureVersion || 'legacy-unversioned',
    state: OUTLINE_STATES.has(outline.state) ? outline.state : 'published',
    knowledgePointCount: nodes.filter(node => node.kind === 'knowledge_point').length,
    nodeCount: nodes.length,
    createdAt: outline.created_at || null,
    updatedAt: outline.updated_at || null,
    parserVersion: outline.parserVersion || 'legacy-v1',
    ruleVersion: outline.ruleVersion || 'legacy-v1',
    editVersion: Number(outline.editVersion || 1),
    readOnly: Boolean(outline.readOnly),
    sourceType: outline.sourceType || 'unknown',
    baseVersionId: outline.baseVersionId || null
  };
}

function buildCatalog(outlines, profileContext = {}) {
  const products = new Map();
  for (const outline of outlines) {
    const item = normalizeOutline(outline);
    if (!item.productId) continue;
    if (!products.has(item.productId)) products.set(item.productId, { id: item.productId, name: item.productId, versionTags: new Set() });
    item.businessVersionTags.forEach(tag => products.get(item.productId).versionTags.add(tag));
  }
  const configuredName = profileContext?.brand?.productName;
  if (configuredName && !products.has('profile-product')) {
    products.set('profile-product', { id: 'profile-product', name: configuredName, versionTags: new Set() });
  }
  return [...products.values()].map(product => ({ ...product, versionTags: [...product.versionTags].sort() }));
}

function buildResponsibilityProjection(outline) {
  const nodes = nodesFromContent(outline.content, outline.id);
  const mappings = Array.isArray(outline.responsibilityMappings) ? outline.responsibilityMappings : [];
  return {
    outlineId: outline.id,
    outlineVersionId: outline.outlineStructureVersion || 'legacy-unversioned',
    responsibilityMappingVersionId: outline.responsibilityMappingVersionId || null,
    status: mappings.length ? 'available' : 'not_created',
    items: mappings,
    summary: {
      totalKnowledgePoints: nodes.filter(node => node.kind === 'knowledge_point').length,
      mappedKnowledgePoints: new Set(mappings.map(item => item.knowledgePointId).filter(Boolean)).size
    }
  };
}

function buildImpactProjection(outline) {
  const responsibility = buildResponsibilityProjection(outline);
  const mappings = responsibility.items;
  const nodes = nodesFromContent(outline.content, outline.id).filter(node => node.kind === 'knowledge_point');
  const mapped = new Map(mappings.map(item => [item.knowledgePointId, item]));
  const issues = [];
  for (const node of nodes) {
    const mapping = mapped.get(node.id) || mapped.get(node.sourceId);
    if (!mapping?.ownerId) issues.push({ type: 'missing_owner', nodeId: node.id, title: node.title });
    if (!mapping?.documentId) issues.push({ type: 'missing_document', nodeId: node.id, title: node.title });
  }
  return {
    outlineId: outline.id,
    basedOnOutlineVersion: outline.outlineStructureVersion || 'legacy-unversioned',
    status: issues.length ? 'attention_required' : 'clear',
    issues,
    affectedDocuments: [],
    affectedTasks: [],
    generatedAt: new Date().toISOString()
  };
}

function validateCandidate({ content, productId, businessVersionTags, requireGovernance = true }) {
  const errors = [];
  if (requireGovernance) {
    if (!productId) errors.push({ code: 'PRODUCT_REQUIRED', field: 'productId', message: '必须选择适用产品' });
    if (!Array.isArray(businessVersionTags) || businessVersionTags.length === 0) {
      errors.push({ code: 'BUSINESS_VERSION_REQUIRED', field: 'businessVersionTags', message: '必须至少选择一个业务版本标签' });
    }
  }
  const nodes = nodesFromContent(content);
  if (!nodes.length) errors.push({ code: 'OUTLINE_EMPTY', field: 'content', message: '未解析出有效目录节点' });
  const emptyTitle = nodes.find(node => !node.title.trim());
  if (emptyTitle) errors.push({ code: 'NODE_TITLE_REQUIRED', nodeId: emptyTitle.id, field: 'title', message: '目录节点标题不能为空' });
  return { passed: errors.length === 0, errors, nodes };
}

module.exports = {
  buildCatalog,
  buildImpactProjection,
  buildResponsibilityProjection,
  nodesFromContent,
  normalizeContent,
  normalizeOutline,
  parseCsvOutlineText,
  parseMarkdownOutlineText,
  parseOutlineFile,
  parseOutlineText,
  validateCandidate
};
