const crypto = require('crypto');
const rules = require('../../../config/knowledge-center/content-rules.json').outlineTemplate;

class OutlineTemplateError extends Error {
  constructor(errors) {
    super(errors[0]?.message || '大纲模板不合规');
    this.code = 'OUTLINE_TEMPLATE_INVALID';
    this.status = 422;
    this.details = errors;
  }
}

function pathId(scope, value) {
  return `node_${crypto.createHash('sha256').update(`${scope}:${value}`).digest('hex').slice(0, 24)}`;
}

function splitDomains(value) {
  return [...new Set(String(value || '').split(/[、,，;；\n\r]+/).map(v => v.trim()).filter(Boolean))];
}

function parseNaturalPathRows(rows, title, merges = []) {
  const nodes = [];
  const byPath = new Map();
  const errors = [];
  const closedDirectories = new Set();
  const firstDocumentByContainer = new Map();
  let previousDirectories = [];
  const addError = (code, row, column, path, message, suggestion) => errors.push({ code, row, column, path, message, suggestion });
  for (const merge of merges) {
    addError('MERGED_CELLS', merge.s.r + 1, rules.headers[merge.s.c] || '表格', '', '模板不支持合并单元格', '取消合并，并在每行完整填写路径。');
  }
  rows.forEach((raw, index) => {
    const row = index + 2;
    const cells = Array.from({ length: rules.headers.length }, (_, i) => String(raw[i] ?? '').trim());
    if (!cells.some(Boolean)) return;
    const levels = cells.slice(0, rules.maxDepth);
    const end = levels.findLastIndex(Boolean);
    const segments = levels.slice(0, end + 1);
    const fullPath = segments.join('/');
    const initialErrors = errors.length;
    if (raw.slice(rules.headers.length).some(v => String(v ?? '').trim())) {
      addError('EXTRA_COLUMNS', row, '表格', fullPath, '存在六列以外的内容', '仅保留模板六列；路径最多四层。');
    }
    if (end < 0) {
      addError('PATH_REQUIRED', row, rules.headers[0], '', '本行缺少文档路径', '至少在路径层级1填写文件名，或填写完整目录和文件路径。');
      return;
    }
    segments.forEach((name, i) => {
      if (!name) addError('PATH_GAP', row, rules.headers[i], fullPath, '路径中间不能留空', '将右侧路径左移填满空位，尾部列才可留空。');
      else if (name === '.' || name === '..' || /[\/\\\x00-\x1f]/.test(name)) {
        addError('INVALID_PATH_NAME', row, rules.headers[i], fullPath, '路径单元格必须是单个合法名称', '不要填写 /、\\、控制字符或 .、..；每个目录单独占一列。');
      } else if (name.length > 255) {
        addError('NAME_TOO_LONG', row, rules.headers[i], fullPath, '名称超过255个字符', '缩短该目录或文件名称。');
      }
      if (i < end && name.endsWith(rules.extension)) {
        addError('DOCUMENT_AS_PARENT', row, rules.headers[i], fullPath, 'Markdown 文件不能作为上级目录', '去掉上级目录的 .md，或将该文件作为独立文档行。');
      }
    });
    const filename = segments.at(-1);
    if (!filename.endsWith(rules.extension) || filename.length <= rules.extension.length) {
      addError('DOCUMENT_EXTENSION', row, rules.headers[end], fullPath, `最后一层必须是 ${rules.extension} 文件`, `填写完整文件名，例如“版本差异说明${rules.extension}”。`);
    }
    if (rules.excludedNames.includes(filename)) {
      addError('RESERVED_DOCUMENT', row, rules.headers[end], fullPath, `${filename} 是目录元数据，不是正文文档`, '从大纲中移除此元数据行；目录介绍使用00目录名.md。');
    }
    if (errors.length !== initialErrors) return;
    const containers = ['', ...segments.slice(0, -1).map((_, i) => segments.slice(0, i + 1).join('/'))];
    for (const container of containers) {
      if (!firstDocumentByContainer.has(container)) firstDocumentByContainer.set(container, { path: fullPath, row });
    }
    const directoryPaths = segments.slice(0, -1).map((_, i) => segments.slice(0, i + 1).join('/'));
    for (const old of previousDirectories) if (!directoryPaths.includes(old)) closedDirectories.add(old);
    for (const current of directoryPaths) if (closedDirectories.has(current)) {
      addError('NON_CONTIGUOUS_DIRECTORY', row, rules.headers[0], fullPath, `目录“${current}”的文档行不连续`, '将同一目录子树的文档放在连续行，确保导航树与Excel从上至下顺序一致。');
    }
    previousDirectories = directoryPaths;
    let parentId = null;
    for (let i = 0; i <= end; i++) {
      const nodePath = segments.slice(0, i + 1).join('/');
      const kind = i === end ? 'document' : 'directory';
      let node = byPath.get(nodePath);
      if (node && (node.kind !== kind || kind === 'document')) {
        addError('DUPLICATE_PATH', row, rules.headers[i], nodePath, `路径重复或文件目录冲突（首次在第${node.sourceRow}行）`, '同一父目录下名称必须唯一；删除重复行或修改名称。');
        return;
      }
      if (!node) {
        node = { id: pathId(title, nodePath), parentId, kind, title: segments[i], path: nodePath,
          level: i + 1, order: nodes.length + 1, sourceRow: row,
          description: kind === 'document' ? cells[rules.maxDepth] : '',
          techDomainIds: kind === 'document' ? splitDomains(cells[rules.maxDepth + 1]) : [] };
        byPath.set(nodePath, node);
        nodes.push(node);
      }
      parentId = node.id;
    }
  });
  if (!nodes.some(n => n.kind === 'document')) addError('OUTLINE_DOCUMENT_REQUIRED', 2, rules.headers[0], '', '模板没有可导入的文档', '填写至少一篇手册根介绍文档。');
  const containers = [{ title, path: '', sourceRow: 2, level: 0 }, ...nodes.filter(n => n.kind === 'directory')];
  for (const container of containers) {
    const intro = `${container.path ? `${container.path}/` : ''}${rules.introPrefix}${container.title}${rules.extension}`;
    if (!byPath.has(intro) || byPath.get(intro).kind !== 'document') {
      addError('INTRO_REQUIRED', container.sourceRow, rules.headers[container.level], intro,
        `缺少${container.path ? '目录' : '手册根'}介绍文件“${intro}”`, `新增一行完整路径“${intro}”，填写内容说明和技术领域分工。`);
    }
    const firstDocument = firstDocumentByContainer.get(container.path);
    if (firstDocument && firstDocument.path !== intro) {
      addError('INTRO_ORDER', firstDocument.row, rules.headers[container.level], intro,
        `介绍文件“${intro}”必须先于该${container.path ? '目录' : '手册'}下的其他文档`, `将“${intro}”移到该${container.path ? '目录' : '手册'}第一篇文档的位置，再排列其余页面。`);
    }
  }
  for (const node of nodes.filter(n => n.kind === 'document' && n.title.startsWith(rules.introPrefix))) {
    const parent = node.parentId ? nodes.find(n => n.id === node.parentId) : { title };
    const expected = `${rules.introPrefix}${parent.title}${rules.extension}`;
    if (node.title !== expected) addError('INTRO_NAME', node.sourceRow, rules.headers[node.level - 1], node.path,
      `介绍文件名应为“${expected}”`, `改为“${expected}”；普通页面不要使用保留前缀“${rules.introPrefix}”。`);
  }
  if (errors.length) throw new OutlineTemplateError(errors);
  return { title, schemaVersion: rules.version, nodes };
}

module.exports = { rules, OutlineTemplateError, parseNaturalPathRows, pathId };
