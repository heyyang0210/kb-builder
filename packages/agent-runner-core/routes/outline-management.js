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

function normalizeDocumentList(value) {
  return (Array.isArray(value) ? value : []).map((document, index) => normalizeLeafDocument(document, index));
}

function normalizeTechDomainValues(value) {
  const values = Array.isArray(value)
    ? value
    : value ? String(value).split(/[、,，;；\n\r]+/) : [];
  return [...new Set(values.map(item => String(item || '').trim()).filter(Boolean))];
}

function sourceDocuments(source) {
  if (!source || typeof source !== 'object') return [];
  if (Array.isArray(source.documents)) return source.documents;
  if (Array.isArray(source.kps)) return source.kps;
  if (Array.isArray(source.knowledgePoints)) return source.knowledgePoints;
  return [];
}

function sourceDirectories(source) {
  if (!source || typeof source !== 'object') return [];
  if (Array.isArray(source.children)) return source.children;
  if (Array.isArray(source.subchapters)) return source.subchapters;
  if (Array.isArray(source.directories)) return source.directories;
  return [];
}

function normalizeDirectory(source, fallbackName = '未命名章节') {
  const documents = normalizeDocumentList(sourceDocuments(source));
  return {
    name: String(source?.name || source?.title || fallbackName),
    description: String(source?.description || source?.desc || ''),
    techDomainIds: normalizeTechDomainValues(source?.techDomainIds || source?.techDomainId || source?.techDomains || source?.techDomain),
    documents,
    kps: documents.map(document => ({ ...document })),
    knowledgePoints: documents.map(document => ({ ...document })),
    children: sourceDirectories(source).map(child => normalizeDirectory(child))
  };
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
      description: String(part.description || part.desc || ''),
      techDomainIds: normalizeTechDomainValues(part.techDomainIds || part.techDomainId || part.techDomains || part.techDomain),
      documents: normalizeDocumentList(sourceDocuments(part)),
      chapters: (Array.isArray(part.chapters) ? part.chapters : []).map(chapter => normalizeDirectory(chapter)),
      children: sourceDirectories(part).map(child => normalizeDirectory(child))
    }))
  };
}

function leafItemsFromChapter(chapter) {
  return sourceDocuments(chapter);
}

function outlineNodes(source, outlineId = 'candidate') {
  if (source && Array.isArray(source.nodes) && source.nodes.length) {
    return source.nodes;
  }
  return nodesFromContent(source?.content || source, outlineId);
}

function normalizeLeafDocument(document, index) {
  return {
    id: String(document?.id || document?.code || `doc-${index + 1}`),
    name: String(document?.name || document?.title || '未命名文档'),
    desc: String(document?.desc || document?.description || document?.body || document?.name || document?.title || ''),
    outlineLevel: Number(document?.outlineLevel || 0) || undefined,
    documentId: String(document?.documentId || document?.id || document?.code || `doc-${index + 1}`),
    isDirectoryPage: Boolean(document?.isDirectoryPage),
    stableId: document?.stableId ? String(document.stableId) : undefined,
    techDomainIds: normalizeTechDomainValues(
      document?.techDomainIds || document?.techDomainId || document?.techDomains || document?.techDomain
    )
  };
}

function isDocumentNode(node) {
  return node?.kind === 'document';
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

function parseXlsxOutlineFile(filePath, fallbackTitle = path.basename(filePath, path.extname(filePath))) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const hiddenSheets = new Set((workbook.Workbook?.Sheets || [])
    .filter(sheet => Number(sheet?.Hidden || 0) > 0)
    .map(sheet => sheet.name));
  const sheetNames = workbook.SheetNames.filter(name => {
    if (hiddenSheets.has(name)) return false;
    const sheet = workbook.Sheets[name];
    return sheet && String(sheet['!ref'] || '').trim();
  });
  if (sheetNames.length !== 1) {
    throw new Error(`XLSX 大纲模板必须包含一个非空 Sheet，当前为 ${sheetNames.length} 个`);
  }

  const sheet = workbook.Sheets[sheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const legacyHeaders = ['一级目录', '二级目录', '三级目录', '页面', '内容说明'];
  const legacyHeadersWithTechDomain = [...legacyHeaders, '技术领域分工'];
  const columnarHeaders = ['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工'];
  const legacyColumnarHeaders = ['一级目录', '二级目录', '三级目录', '四级目录', '页面', '内容说明', '技术领域分工'];
  const hierarchicalHeaders = ['层级', '节点名称', '节点类型', '内容说明', '技术领域分工'];
  const headers = (rows.shift() || []).map(cell => String(cell || '').trim().replace(/^\uFEFF/, ''));
  if (headers.length === columnarHeaders.length && columnarHeaders.every((header, index) => headers[index] === header)) {
    return parseColumnarXlsxOutlineRows(rows, fallbackTitle);
  }
  if (headers.length === legacyColumnarHeaders.length && legacyColumnarHeaders.every((header, index) => headers[index] === header)) {
    return parseColumnarXlsxOutlineRows(rows, fallbackTitle, { directoryDepth: 4, pageLevel: 5 });
  }
  if (headers.length === hierarchicalHeaders.length && hierarchicalHeaders.every((header, index) => headers[index] === header)) {
    return parseHierarchicalXlsxOutlineRows(rows, fallbackTitle);
  }
  const hasTechDomainColumn = headers.length === legacyHeadersWithTechDomain.length
    && legacyHeadersWithTechDomain.every((header, index) => headers[index] === header);
  const isLegacyTemplate = headers.length === legacyHeaders.length
    && legacyHeaders.every((header, index) => headers[index] === header);
  if (!hasTechDomainColumn && !isLegacyTemplate) {
    throw new Error(`XLSX 大纲模板表头必须为：${columnarHeaders.join('、')}`);
  }

  const parts = [];
  const partMap = new Map();
  let currentPart = null;
  let currentChapter = null;
  let currentSubchapter = null;
  let documentCount = 0;

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = legacyHeadersWithTechDomain.map((_, columnIndex) => String(rawRow[columnIndex] || '').trim());
    if (!row.some(Boolean)) return;
    const [partName, chapterName, subchapterName, pageName, description, techDomainText] = row;
    if (partName) {
      currentPart = partMap.get(partName);
      if (!currentPart) {
        currentPart = { part: partName, level: '⭐', chapters: [], documents: [], _chapters: new Map() };
        partMap.set(partName, currentPart);
        parts.push(currentPart);
      }
      currentChapter = null;
      currentSubchapter = null;
    } else if (!currentPart) {
      throw new Error(`第 ${rowNumber} 行缺少一级目录`);
    }

    if (chapterName) {
      currentChapter = currentPart._chapters.get(chapterName);
      if (!currentChapter) {
        currentChapter = { name: chapterName, documents: [], children: [], _children: new Map() };
        currentPart._chapters.set(chapterName, currentChapter);
        currentPart.chapters.push(currentChapter);
      }
      currentSubchapter = null;
    } else {
      currentChapter = null;
      currentSubchapter = null;
    }

    if (subchapterName) {
      if (!chapterName && !currentChapter) throw new Error(`第 ${rowNumber} 行三级目录没有所属二级目录`);
      currentChapter = currentPart._chapters.get(chapterName);
      currentSubchapter = currentChapter._children.get(subchapterName);
      if (!currentSubchapter) {
        currentSubchapter = { name: subchapterName, documents: [], children: [], _children: new Map() };
        currentChapter._children.set(subchapterName, currentSubchapter);
        currentChapter.children.push(currentSubchapter);
      }
    }
    if (!pageName) throw new Error(`第 ${rowNumber} 行页面不能为空`);

    const document = {
      id: `xlsx-row-${rowNumber}`,
      documentId: `xlsx-row-${rowNumber}`,
      name: pageName,
      desc: description || pageName,
      techDomainIds: normalizeTechDomainValues(techDomainText)
    };
    documentCount += 1;
    if (currentSubchapter) currentSubchapter.documents.push(document);
    else if (currentChapter) currentChapter.documents.push(document);
    else currentPart.documents.push(document);
  });

  if (!documentCount) throw new Error('XLSX 大纲模板没有可导入的页面');
  return normalizeContent({
    title: fallbackTitle,
    parts: parts.map(part => {
      const { _chapters, ...value } = part;
      return {
        ...value,
        chapters: value.chapters.map(chapter => {
          const { _children, ...chapterValue } = chapter;
          return {
            ...chapterValue,
            children: chapter.children.map(child => {
              const { _children: ignored, ...childValue } = child;
              return childValue;
            })
          };
        })
      };
    })
  }, fallbackTitle);
}

function parseColumnarXlsxOutlineRows(rows, fallbackTitle, options = {}) {
  const directoryDepth = Number(options.directoryDepth || 3);
  const pageLevel = Number(options.pageLevel || directoryDepth + 1);
  const parts = [];
  const partMap = new Map();
  let previousDirectories = Array.from({ length: directoryDepth }, () => '');
  let documentCount = 0;

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = Array.from({ length: directoryDepth + 3 }, (_, columnIndex) => String(rawRow[columnIndex] || '').trim());
    if (!row.some(Boolean)) return;
    const directoryCells = row.slice(0, directoryDepth);
    const [pageName, description, techDomainText] = row.slice(directoryDepth);
    const firstSpecifiedDirectory = directoryCells.findIndex(Boolean);
    const directoryNames = firstSpecifiedDirectory === -1
      ? previousDirectories.slice()
      : [
        ...previousDirectories.slice(0, firstSpecifiedDirectory),
        ...directoryCells.slice(firstSpecifiedDirectory)
      ];
    const firstEmptyDirectory = directoryNames.findIndex(value => !value);
    if (firstEmptyDirectory >= 0 && directoryNames.slice(firstEmptyDirectory).some(Boolean)) {
      throw new Error(`第 ${rowNumber} 行目录必须逐级填写，不能跳过上级目录`);
    }
    const [partName] = directoryNames;
    if (!partName) throw new Error(`第 ${rowNumber} 行缺少一级目录`);
    if (!pageName) throw new Error(`第 ${rowNumber} 行页面不能为空`);
    previousDirectories = directoryNames;

    let part = partMap.get(partName);
    if (!part) {
      part = { part: partName, level: '⭐', chapters: [], documents: [], _children: new Map() };
      partMap.set(partName, part);
      parts.push(part);
    }

    let parent = part;
    for (const [directoryIndex, directoryName] of directoryNames.slice(1).entries()) {
      if (!directoryName) break;
      if (!parent._children) parent._children = new Map();
      let directory = parent._children.get(directoryName);
      if (!directory) {
        directory = {
          name: directoryName,
          documents: [],
          children: [],
          _children: new Map()
        };
        parent._children.set(directoryName, directory);
        if (parent === part) parent.chapters.push(directory);
        else parent.children.push(directory);
      }
      parent = directory;
    }

    const normalizedDirectoryNames = directoryNames.filter(Boolean);
    const isDirectoryPage = Boolean(normalizedDirectoryNames.length && pageName === normalizedDirectoryNames.at(-1));
    const directorySourceId = isDirectoryPage
      ? `directory-page-${normalizedDirectoryNames.join('/')}`
      : `xlsx-row-${rowNumber}`;
    const document = {
      id: directorySourceId,
      documentId: directorySourceId,
      name: pageName,
      desc: description || pageName,
      description: description || pageName,
      outlineLevel: pageLevel,
      isDirectoryPage,
      techDomainIds: normalizeTechDomainValues(techDomainText)
    };
    parent.documents.push(document);
    documentCount += 1;
  });

  if (!documentCount) throw new Error('XLSX 大纲模板没有可导入的页面');
  const stripInternalMaps = directory => {
    const { _children, ...value } = directory;
    return {
      ...value,
      children: (value.children || []).map(stripInternalMaps)
    };
  };
  return normalizeContent({
    title: fallbackTitle,
    parts: parts.map(part => {
      const { _children, ...value } = part;
      return {
        ...value,
        chapters: value.chapters.map(stripInternalMaps)
      };
    })
  }, fallbackTitle);
}

function parseHierarchicalXlsxOutlineRows(rows, fallbackTitle) {
  const parts = [];
  const stack = [];
  let documentCount = 0;
  let hasRow = false;

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = [0, 1, 2, 3, 4].map(columnIndex => String(rawRow[columnIndex] || '').trim());
    if (!row.some(Boolean)) return;
    const firstNode = !hasRow;
    const [levelText, name, nodeType, description, techDomainText] = row;
    const level = Number(levelText);
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      throw new Error(`第 ${rowNumber} 行层级必须是 1 至 5`);
    }
    if (!name) throw new Error(`第 ${rowNumber} 行节点名称不能为空`);
    if (!['目录', '页面', '目录兼页面'].includes(nodeType)) {
      throw new Error(`第 ${rowNumber} 行节点类型必须是“目录”“页面”或“目录兼页面”`);
    }
    if (level === 5 && nodeType !== '页面') {
      throw new Error(`第 ${rowNumber} 行五级节点只能填写“页面”`);
    }
    if (level < 5 && nodeType === '页面') {
      throw new Error(`第 ${rowNumber} 行一至四级节点不能填写“页面”`);
    }
    const previousLevel = stack.length ? stack[stack.length - 1].level : 0;
    if (firstNode && level !== 1) {
      throw new Error(`第 ${rowNumber} 行必须从一级目录开始`);
    }
    if (stack.length && level > previousLevel + 1) {
      throw new Error(`第 ${rowNumber} 行层级不能跳级，请先补充上级目录`);
    }
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack[stack.length - 1] || null;
    if (level > 1 && !parent) throw new Error(`第 ${rowNumber} 行缺少上级目录`);

    if (level === 5) {
      const document = {
        id: `xlsx-row-${rowNumber}-page`,
        documentId: `xlsx-row-${rowNumber}-page`,
        name,
        desc: description || name,
        description: description || name,
        outlineLevel: 5,
        techDomainIds: normalizeTechDomainValues(techDomainText)
      };
      parent.node.documents.push(document);
      documentCount += 1;
      stack.push({ level, node: document });
      hasRow = true;
      return;
    }

    const directory = {
      name,
      description,
      techDomainIds: normalizeTechDomainValues(techDomainText),
      documents: [],
      children: []
    };
    if (level === 1) {
      // Keep the first directory in the legacy `chapters` slot while the
      // stack uses a directory-shaped container so nested rows can attach to it.
      const part = {
        part: name,
        level: '⭐',
        description,
        techDomainIds: directory.techDomainIds,
        documents: directory.documents,
        chapters: directory.children
      };
      parts.push(part);
      stack.push({ level, node: directory });
    } else {
      parent.node.children.push(directory);
      stack.push({ level, node: directory });
    }
    if (nodeType === '目录兼页面') {
      const document = {
        id: `xlsx-row-${rowNumber}-page`,
        documentId: `xlsx-row-${rowNumber}-page`,
        name,
        desc: description || name,
        description: description || name,
        outlineLevel: 5,
        techDomainIds: normalizeTechDomainValues(techDomainText)
      };
      directory.documents.push(document);
      documentCount += 1;
    }
    hasRow = true;
  });

  if (!hasRow) throw new Error('XLSX 大纲模板没有可导入的节点');
  if (!documentCount) throw new Error('XLSX 大纲模板至少需要一个页面或目录兼页面');
  return normalizeContent({ title: fallbackTitle, parts }, fallbackTitle);
}

function parseOutlineText(raw, extension = '.md', options = {}) {
  const ext = String(extension || '.md').toLowerCase();
  const fallbackTitle = options.fallbackTitle || '上传的大纲';
  if (ext === '.json' || ext === 'json') return normalizeContent(JSON.parse(String(raw || '').replace(/^\uFEFF/, '')), fallbackTitle);
  if (ext === '.csv' || ext === 'csv') return parseCsvOutlineText(raw, fallbackTitle);
  return parseMarkdownOutlineText(raw, fallbackTitle);
}

function parseOutlineFile(filePath, options = {}) {
  const extension = path.extname(filePath).toLowerCase();
  const fallbackTitle = options.fallbackTitle || path.basename(filePath, extension);
  if (extension === '.xlsx' || extension === '.xls') {
    return parseXlsxOutlineFile(filePath, fallbackTitle);
  }
  return parseOutlineText(fs.readFileSync(filePath, 'utf8'), extension, { fallbackTitle });
}

function nodesFromContent(content, outlineId = 'candidate') {
  const nodes = [];
  let order = 0;
  const appendDocuments = (documents, parentId, parentPath, level) => {
    for (const [documentIndex, document] of (documents || []).entries()) {
      const leaf = normalizeLeafDocument(document, documentIndex);
      const documentPath = `${parentPath}/${documentIndex + 1}:${leaf.id || leaf.name}`;
      nodes.push({
        id: leaf.stableId || stableId('knowledge', `${outlineId}:${documentPath}`),
        sourceId: leaf.documentId || leaf.id || null,
        parentId,
        kind: 'document',
        legacyKind: 'knowledge_point',
        title: leaf.name || '',
        description: leaf.desc || '',
        techDomainIds: normalizeTechDomainValues(leaf.techDomainIds),
        level: leaf.outlineLevel || level,
        outlinePath: documentPath,
        order: ++order
      });
    }
  };
  const appendDirectories = (directories, parentId, parentPath, level, legacyKind) => {
    for (const [directoryIndex, directory] of (directories || []).entries()) {
      const directoryPath = `${parentPath}/${directoryIndex + 1}:${directory.name || ''}`;
      const directoryId = directory.id || stableId('section', `${outlineId}:${directoryPath}`);
      nodes.push({
        id: directoryId,
        parentId,
        kind: 'directory',
        legacyKind,
        title: directory.name || '',
        description: directory.description || directory.desc || '',
        techDomainIds: normalizeTechDomainValues(directory.techDomainIds),
        level,
        outlinePath: directoryPath,
        order: ++order
      });
      appendDocuments(leafItemsFromChapter(directory), directoryId, directoryPath, level + 1);
      appendDirectories(sourceDirectories(directory), directoryId, directoryPath, level + 1, 'section');
    }
  };
  for (const [partIndex, part] of (content?.parts || []).entries()) {
    const partPath = `${partIndex + 1}:${part.part || ''}`;
    const partId = part.id || stableId('section', `${outlineId}:${partPath}`);
    nodes.push({
      id: partId,
      parentId: null,
      kind: 'directory',
      legacyKind: 'part',
      title: part.part || '',
      description: part.description || part.desc || '',
      techDomainIds: normalizeTechDomainValues(part.techDomainIds),
      level: 1,
      outlinePath: partPath,
      order: ++order
    });
    appendDocuments(sourceDocuments(part), partId, partPath, 2);
    appendDirectories(part.chapters, partId, partPath, 2, 'chapter');
    appendDirectories(sourceDirectories(part), partId, partPath, 2, 'section');
  }
  return nodes;
}

function normalizeOutline(outline) {
  const productId = outline.productId || null;
  const tags = Array.isArray(outline.businessVersionTags) ? outline.businessVersionTags : [];
  const nodes = outlineNodes(outline, outline.id);
  return {
    id: outline.id,
    deletedAt: outline.deletedAt || null,
    deletedBy: outline.deletedBy || null,
    handbookId: outline.handbookId || outline.id,
    manualId: outline.manualId || outline.manual_id || null,
    name: outline.name,
    productId,
    businessVersionTags: tags,
    outlineStructureVersion: outline.outlineStructureVersion || 'legacy-unversioned',
    state: OUTLINE_STATES.has(outline.state) ? outline.state : 'published',
    knowledgePointCount: nodes.filter(isDocumentNode).length,
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
  if (outline?.governance) return buildOutlineGovernance(outline);
  const nodes = outlineNodes(outline, outline.id);
  const mappings = Array.isArray(outline.responsibilityMappings) ? outline.responsibilityMappings : [];
  return {
    outlineId: outline.id,
    outlineVersionId: outline.outlineStructureVersion || 'legacy-unversioned',
    responsibilityMappingVersionId: outline.responsibilityMappingVersionId || null,
    status: mappings.length ? 'available' : 'not_created',
    items: mappings,
    summary: {
      totalKnowledgePoints: nodes.filter(isDocumentNode).length,
      mappedKnowledgePoints: new Set(mappings.map(item => item.documentId || item.knowledgePointId).filter(Boolean)).size
    }
  };
}

function readTechDomainConfig() {
  const configPath = process.env.TECH_DOMAINS_CONFIG
    ? path.resolve(process.env.TECH_DOMAINS_CONFIG)
    : path.join(__dirname, '..', 'services', 'yashandb-storage', 'sql', 'tech-domains.seed.json');
  if (!fs.existsSync(configPath)) return [];
  try {
    const payload = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return Array.isArray(payload?.techDomains) ? payload.techDomains : [];
  } catch (_) {
    return [];
  }
}

function normalizeAssignments(value) {
  return (Array.isArray(value) ? value : []).map(item => {
    const ownerships = (Array.isArray(item?.ownerships) ? item.ownerships : []).map(ownership => ({
      techDomainId: String(ownership?.techDomainId || ''),
      assigneeId: ownership?.assigneeId ? String(ownership.assigneeId) : null,
      assigneeName: ownership?.assigneeName ? String(ownership.assigneeName) : null
    })).filter(ownership => ownership.techDomainId);
    const result = {
      nodeId: String(item?.nodeId || item?.outlineNodeId || ''),
      techDomainIds: [...new Set((Array.isArray(item?.techDomainIds) ? item.techDomainIds : item?.techDomainId ? [item.techDomainId] : []).map(String).filter(Boolean))]
    };
    if (ownerships.length) result.ownerships = ownerships;
    return result;
  }).filter(item => item.nodeId);
}

function effectiveAssignmentsForNodes(nodes, assignments) {
  const explicit = new Map(assignments.map(item => [item.nodeId, item]));
  const byId = new Map(nodes.map(node => [String(node.id), node]));
  return nodes.filter(isDocumentNode).map(node => {
    const domainIds = [];
    let current = String(node.id);
    while (current) {
      for (const domainId of explicit.get(current)?.techDomainIds || []) {
        if (!domainIds.includes(domainId)) domainIds.push(domainId);
      }
      current = byId.get(current)?.parentId ? String(byId.get(current).parentId) : '';
    }
    const ownerships = domainIds.map(domainId => {
      let owner = null;
      let cursor = String(node.id);
      while (cursor && !owner) {
        owner = (explicit.get(cursor)?.ownerships || []).find(item => String(item.techDomainId) === String(domainId)) || null;
        cursor = byId.get(cursor)?.parentId ? String(byId.get(cursor).parentId) : '';
      }
      return owner ? { ...owner, techDomainId: String(domainId) } : { techDomainId: String(domainId) };
    });
    return {
      nodeId: node.id,
      documentId: node.sourceId || node.id,
      title: node.title,
      techDomainIds: domainIds,
      ownerships
    };
  });
}

function documentOwnership(effectiveDocumentAssignments, tasks, techDomains) {
  const domains = domainById(techDomains);
  const taskItems = new Map();
  for (const task of Array.isArray(tasks) ? tasks : []) {
    for (const item of Array.isArray(task?.items) ? task.items : []) {
      taskItems.set(`${item.documentId}|${item.techDomainId || task.techDomainId}`, { ...item, taskId: task.id });
    }
  }
  return effectiveDocumentAssignments.map(document => ({
    ...document,
    ownerships: document.techDomainIds.map(domainId => {
      const domain = domains.get(String(domainId)) || {};
      const item = taskItems.get(`${document.documentId}|${domainId}`);
      const declared = (document.ownerships || []).find(ownership => String(ownership.techDomainId) === String(domainId));
      return {
        taskId: item?.taskId || null,
        techDomainId: String(domainId),
        techDomainName: domain.name || domain.code || domainId,
        assigneeId: item?.assigneeId || declared?.assigneeId || null,
        assigneeName: item?.assigneeName || declared?.assigneeName || null,
        status: item?.status || (declared?.assigneeId ? 'assigned' : 'not_published')
      };
    })
  }));
}

function buildOutlineGovernance(outline, techDomains = readTechDomainConfig()) {
  const nodes = outlineNodes(outline, outline.id);
  const assignments = normalizeAssignments(outline.governance?.assignments || outline.responsibilityMappings);
  const tasks = Array.isArray(outline.governance?.tasks) ? outline.governance.tasks : [];
  const effectiveDocumentAssignments = documentOwnership(
    effectiveAssignmentsForNodes(nodes, assignments),
    tasks,
    techDomains
  );
  const assignedDocuments = effectiveDocumentAssignments.filter(item => item.techDomainIds.length).length;
  return {
    outlineId: outline.id,
    outlineVersionId: outline.outlineStructureVersion || outline.id,
    governanceVersion: Number(outline.governanceVersion || 1),
    state: outline.state || 'draft',
    status: assignments.length ? 'available' : 'not_created',
    assignments,
    effectiveDocumentAssignments,
    techDomains,
    summary: {
      totalDocuments: effectiveDocumentAssignments.length,
      assignedDocuments,
      unassignedDocuments: effectiveDocumentAssignments.length - assignedDocuments
    },
    tasks
  };
}

function updateContentDescription(content, outlineId, nodeId, description) {
  const nodes = nodesFromContent(content, outlineId);
  const target = nodes.find(node => String(node.id) === String(nodeId));
  if (!target || !isDocumentNode(target)) return false;
  const sourceId = String(target.sourceId || '');
  const visitDocuments = documents => {
    for (const document of Array.isArray(documents) ? documents : []) {
      const documentId = String(document?.documentId || document?.id || document?.code || '');
      if (documentId === sourceId) {
        document.desc = description;
        document.description = description;
        return true;
      }
    }
    return false;
  };
  const visitDirectories = directories => (Array.isArray(directories) ? directories : []).some(directory => (
    visitDocuments(directory.documents || directory.kps || directory.knowledgePoints) ||
    visitDirectories(directory.children || directory.subchapters || directory.directories)
  ));
  for (const part of Array.isArray(content?.parts) ? content.parts : []) {
    if (visitDocuments(part.documents) || visitDirectories(part.chapters) || visitDirectories(part.children)) return true;
  }
  return false;
}

function domainById(techDomains) {
  return new Map((Array.isArray(techDomains) ? techDomains : []).map(domain => [String(domain.id), domain]));
}

function domainAliasMap(techDomains = readTechDomainConfig()) {
  const aliases = new Map();
  for (const domain of Array.isArray(techDomains) ? techDomains : []) {
    for (const value of [domain.id, domain.code, domain.name]) {
      const key = String(value || '').trim().toLowerCase();
      if (key) aliases.set(key, String(domain.id));
    }
  }
  return aliases;
}

function normalizeImportedTechDomains(content, techDomains = readTechDomainConfig()) {
  const aliases = domainAliasMap(techDomains);
  const unknown = new Set();
  const visit = documents => {
    for (const document of Array.isArray(documents) ? documents : []) {
      const values = normalizeTechDomainValues(document.techDomainIds);
      document.techDomainIds = values.map(value => {
        const resolved = aliases.get(value.toLowerCase());
        if (!resolved) unknown.add(value);
        return resolved || value;
      });
    }
  };
  const visitDirectoriesForDomains = directories => {
    for (const directory of Array.isArray(directories) ? directories : []) {
      const values = normalizeTechDomainValues(directory.techDomainIds);
      directory.techDomainIds = values.map(value => {
        const resolved = aliases.get(value.toLowerCase());
        if (!resolved) unknown.add(value);
        return resolved || value;
      });
      visitDirectoriesForDomains(directory.children || directory.subchapters || directory.directories);
    }
  };
  const visitDirectories = directories => {
    for (const directory of Array.isArray(directories) ? directories : []) {
      visit(directory.documents || directory.kps || directory.knowledgePoints);
      visitDirectories(directory.children || directory.subchapters || directory.directories);
    }
  };
  for (const part of Array.isArray(content?.parts) ? content.parts : []) {
    const partValues = normalizeTechDomainValues(part.techDomainIds);
    part.techDomainIds = partValues.map(value => {
      const resolved = aliases.get(value.toLowerCase());
      if (!resolved) unknown.add(value);
      return resolved || value;
    });
    visit(part.documents);
    visitDirectoriesForDomains(part.chapters);
    visitDirectories(part.chapters);
    visitDirectoriesForDomains(part.children);
    visitDirectories(part.children);
  }
  if (unknown.size) {
    throw Object.assign(new Error(`技术领域分工包含未配置的领域：${[...unknown].join('、')}`), {
      status: 422,
      code: 'INVALID_TECH_DOMAIN_ASSIGNMENT',
      details: { invalidTechDomains: [...unknown] }
    });
  }
  return content;
}

function assignmentsFromContent(content, outlineId) {
  return outlineNodes({ content }, outlineId)
    .filter(isDocumentNode)
    .map(node => ({ nodeId: String(node.id), techDomainIds: normalizeTechDomainValues(node.techDomainIds) }))
    .filter(item => item.techDomainIds.length);
}

function buildFileTasks(outline, techDomains, publishedAt, existingTasks = []) {
  const governance = buildOutlineGovernance(outline, techDomains);
  const domains = domainById(techDomains);
  const existingItems = new Map();
  for (const task of Array.isArray(existingTasks) ? existingTasks : []) {
    for (const item of Array.isArray(task?.items) ? task.items : []) {
      existingItems.set(`${item.documentId}|${item.techDomainId || task.techDomainId}`, item);
    }
  }
  const taskMap = new Map();
  for (const item of governance.effectiveDocumentAssignments) {
    for (const domainId of item.techDomainIds) {
      if (!taskMap.has(domainId)) {
        const domain = domains.get(domainId) || {};
        taskMap.set(domainId, {
          id: `build-task_${stableId('domain', `${outline.id}|${domainId}`).slice(-16)}`,
          manualId: outline.handbookId,
          outlineVersionId: outline.id,
          techDomainId: domainId,
          domainName: domain.name || domainId,
          domainLeaderId: domain.leader?.id || null,
          domainLeaderName: domain.leader?.name || null,
          state: 'open',
          publishedAt,
          items: []
        });
      }
      const task = taskMap.get(domainId);
      const existing = task.items.find(entry => entry.documentId === item.documentId);
      if (!existing) {
        const previous = existingItems.get(`${item.documentId}|${domainId}`);
        const domain = domains.get(domainId) || {};
        const declared = (item.ownerships || []).find(ownership => String(ownership.techDomainId) === String(domainId));
        const assigneeId = previous?.assigneeId || declared?.assigneeId || domain.leader?.id || null;
        const assigneeName = previous?.assigneeName || declared?.assigneeName || domain.leader?.name || null;
        const status = previous?.status && previous?.assigneeId
          ? previous.status
          : (assigneeId ? 'assigned' : (previous?.status || 'unassigned'));
        task.items.push({
          id: `build-item_${stableId('document', `${task.id}|${item.documentId}`).slice(-16)}`,
          documentId: item.documentId,
          documentTitle: item.title,
          outlineNodeId: item.nodeId,
          techDomainId: domainId,
          assigneeId,
          assigneeName,
          status,
          assignedBy: previous?.assignedBy || null,
          assignedAt: previous?.assignedAt || (assigneeId ? publishedAt : null)
        });
      }
    }
  }
  return [...taskMap.values()];
}

function saveFileGovernance(outline, payload, techDomains = readTechDomainConfig()) {
  if (outline.state === 'superseded') {
    throw Object.assign(new Error('已失效大纲不可修改'), { status: 409, code: 'OUTLINE_IMMUTABLE' });
  }
  if (payload.editVersion !== undefined && Number(payload.editVersion) !== Number(outline.editVersion || 1)) {
    throw Object.assign(new Error('候选版本已被其他操作更新'), { status: 409, code: 'OUTLINE_EDIT_CONFLICT' });
  }
  if (payload.governanceVersion !== undefined && Number(payload.governanceVersion) !== Number(outline.governanceVersion || 1)) {
    throw Object.assign(new Error('责任分工已被其他操作更新'), { status: 409, code: 'OUTLINE_GOVERNANCE_CONFLICT' });
  }
  const nodes = outlineNodes(outline, outline.id);
  const nodeIds = new Set(nodes.map(node => String(node.id)));
  if (Array.isArray(payload.directoryOrder)) {
    const requested = payload.directoryOrder.filter(item => item && item.nodeId).map(item => ({
      nodeId: String(item.nodeId),
      parentNodeId: item.parentNodeId ? String(item.parentNodeId) : null,
      order: Number(item.order)
    }));
    const requestedIds = new Set(requested.map(item => item.nodeId));
    if (requested.some(item => !nodeIds.has(item.nodeId) || (item.parentNodeId && !nodeIds.has(item.parentNodeId)) || !Number.isInteger(item.order) || item.order < 1)) {
      throw Object.assign(new Error('目录变更包含无效节点或顺序'), { status: 422, code: 'INVALID_DIRECTORY_PAYLOAD' });
    }
    if (requested.some(item => item.parentNodeId === item.nodeId)) {
      throw Object.assign(new Error('目录不能成为自身的父级'), { status: 422, code: 'INVALID_DIRECTORY_HIERARCHY' });
    }
    for (const item of requested) {
      let parent = item.parentNodeId;
      const seen = new Set([item.nodeId]);
      while (parent) {
        if (seen.has(parent)) throw Object.assign(new Error('目录层级不能形成循环'), { status: 422, code: 'INVALID_DIRECTORY_HIERARCHY' });
        seen.add(parent);
        parent = requested.find(candidate => candidate.nodeId === parent)?.parentNodeId || null;
      }
    }
    if (requestedIds.size !== nodeIds.size) throw Object.assign(new Error('目录变更必须包含完整目录结构'), { status: 422, code: 'INVALID_DIRECTORY_PAYLOAD' });
    const updates = new Map(requested.map(item => [item.nodeId, item]));
    nodes.forEach(node => { const update = updates.get(String(node.id)); if (update) { node.parentId = update.parentNodeId; node.order = update.order; } });
    outline.nodes = nodes;
  }
  const assignments = normalizeAssignments(payload.assignments);
  for (const assignment of assignments) {
    if (!nodeIds.has(assignment.nodeId)) {
      throw Object.assign(new Error('责任分工包含不存在的目录节点'), { status: 422, code: 'INVALID_DOMAIN_PAYLOAD' });
    }
    if (assignment.techDomainIds.some(id => !techDomains.some(domain => String(domain.id) === id))) {
      throw Object.assign(new Error('责任分工包含不存在的技术领域'), { status: 422, code: 'INVALID_DOMAIN_PAYLOAD' });
    }
  }
  if (outline.state === 'published') {
    if (!Object.hasOwn(payload, 'assignments')) {
      throw Object.assign(new Error('已发布大纲调整分工时必须提交完整的页面分工'), { status: 422, code: 'PUBLISHED_ASSIGNMENT_REQUIRED' });
    }
    const currentDescriptions = new Map(nodes.filter(isDocumentNode).map(node => [String(node.id), String(node.description || '')]));
    for (const item of Array.isArray(payload.descriptions) ? payload.descriptions : []) {
      const nodeId = String(item?.nodeId || '');
      if (!currentDescriptions.has(nodeId) || String(item?.description || '') !== currentDescriptions.get(nodeId)) {
        throw Object.assign(new Error('已发布大纲只能调整技术领域，不能修改内容说明'), { status: 409, code: 'PUBLISHED_CONTENT_LOCKED' });
      }
    }
    const effective = effectiveAssignmentsForNodes(nodes, assignments);
    const missing = effective.filter(item => item.techDomainIds.length === 0);
    if (missing.length) {
      throw Object.assign(new Error('已发布大纲不能取消页面的全部技术领域分工'), {
        status: 422,
        code: 'PUBLISHED_ASSIGNMENT_REQUIRED',
        details: { missingDocuments: missing }
      });
    }
    const previousTasks = outline.governance?.tasks || [];
    outline.governance = {
      ...(outline.governance || {}),
      assignments,
      tasks: []
    };
    outline.governance.tasks = buildFileTasks(outline, techDomains, new Date().toISOString(), previousTasks);
    outline.governanceVersion = Number(outline.governanceVersion || 1) + 1;
    outline.updated_at = new Date().toISOString();
    return outline;
  }
  for (const item of Array.isArray(payload.descriptions) ? payload.descriptions : []) {
    if (!updateContentDescription(outline.content, outline.id, item.nodeId, String(item.description || ''))) {
      throw Object.assign(new Error('内容说明对应的 document 不存在'), { status: 422, code: 'INVALID_DOMAIN_PAYLOAD' });
    }
  }
  outline.governance = {
    ...(outline.governance || {}),
    assignments,
    tasks: Array.isArray(outline.governance?.tasks) ? outline.governance.tasks : []
  };
  outline.governanceVersion = Number(outline.governanceVersion || 1) + 1;
  outline.updated_at = new Date().toISOString();
  return outline;
}

function publishFileGovernance(outline, payload, techDomains = readTechDomainConfig()) {
  if (outline.state === 'published') return outline;
  const governance = buildOutlineGovernance(outline, techDomains);
  const missingDocuments = governance.effectiveDocumentAssignments.filter(item => !item.techDomainIds.length);
  if (missingDocuments.length) {
    throw Object.assign(new Error('发布前必须完成所有 document 的技术领域分工'), {
      status: 422,
      code: 'OUTLINE_RESPONSIBILITY_REQUIRED',
      details: { missingDocuments }
    });
  }
  if (payload.editVersion !== undefined && Number(payload.editVersion) !== Number(outline.editVersion || 1)) {
    throw Object.assign(new Error('候选版本已被其他操作更新'), { status: 409, code: 'OUTLINE_EDIT_CONFLICT' });
  }
  const publishedAt = new Date().toISOString();
  outline.state = 'published';
  outline.published_at = publishedAt;
  outline.updated_at = publishedAt;
  outline.governance = {
    ...(outline.governance || {}),
    assignments: governance.assignments,
    tasks: buildFileTasks(outline, techDomains, publishedAt)
  };
  return outline;
}

function buildImpactProjection(outline) {
  if (outline?.governance) {
    const governance = buildOutlineGovernance(outline);
    const issues = governance.effectiveDocumentAssignments
      .filter(item => item.techDomainIds.length === 0)
      .map(item => ({ type: 'missing_tech_domain', nodeId: item.nodeId, title: item.title }));
    return {
      outlineId: outline.id,
      basedOnOutlineVersion: outline.outlineStructureVersion || 'legacy-unversioned',
      status: issues.length ? 'attention_required' : 'clear',
      issues,
      affectedDocuments: [],
      affectedTasks: governance.tasks || [],
      generatedAt: new Date().toISOString()
    };
  }
  const responsibility = buildResponsibilityProjection(outline);
  const mappings = responsibility.items;
  const nodes = outlineNodes(outline, outline.id).filter(isDocumentNode);
  const mapped = new Map(mappings.map(item => [item.documentId || item.knowledgePointId, item]));
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
  const nodes = outlineNodes({ content });
  if (!nodes.length) errors.push({ code: 'OUTLINE_EMPTY', field: 'content', message: '未解析出有效目录节点' });
  const documentNodes = nodes.filter(isDocumentNode);
  if (documentNodes.length === 0) errors.push({ code: 'OUTLINE_DOCUMENT_REQUIRED', field: 'content', message: '大纲至少需要一个 document 叶子节点' });
  const emptyTitle = nodes.find(node => !String(node.title || '').trim());
  if (emptyTitle) errors.push({ code: 'NODE_TITLE_REQUIRED', nodeId: emptyTitle.id, field: 'title', message: '目录节点标题不能为空' });
  return { passed: errors.length === 0, errors, nodes };
}

module.exports = {
  assignmentsFromContent,
  buildCatalog,
  buildImpactProjection,
  buildFileTasks,
  buildOutlineGovernance,
  buildResponsibilityProjection,
  publishFileGovernance,
  readTechDomainConfig,
  saveFileGovernance,
  nodesFromContent,
  outlineNodes,
  normalizeContent,
  normalizeImportedTechDomains,
  normalizeOutline,
  parseCsvOutlineText,
  parseMarkdownOutlineText,
  parseOutlineFile,
  parseXlsxOutlineFile,
  parseOutlineText,
  validateCandidate
};
