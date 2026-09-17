#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createDomainStore } = require('../../packages/agent-runner-core/lib/domain-store');

const root = path.join(__dirname, '..', '..');
const sourceArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'));
const sourceFile = path.resolve(
  sourceArgument || path.join(root, '知识服务全景图-1788254648250.md'),
);
const outputFile = path.resolve(
  process.env.MANUAL_SEED_OUTPUT
    || path.join(__dirname, '..', 'data', 'knowledge-service-panorama-handbooks.json'),
);
const apply = process.argv.includes('--apply');
const productTypes = new Set(['DB', 'YMP', 'YCM', 'YDC']);

function clean(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function optionalName(value) {
  const normalized = clean(value);
  return normalized && normalized !== '-' ? normalized : null;
}

function splitRow(line) {
  const value = line.trim();
  const content = value.startsWith('|') ? value.slice(1) : value;
  const withoutTrailingPipe = content.endsWith('|') ? content.slice(0, -1) : content;
  return withoutTrailingPipe.split('|').map(clean);
}

function parsePanorama(text) {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex(line => line.includes('|编号|手册名|'));
  if (headerIndex < 0) {
    throw new Error('未找到手册表头：|编号|手册名|');
  }

  const rowPattern = /^\|([A-Z]+-\d{3})\|/;
  const rows = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(rowPattern);
    if (match) {
      const cells = splitRow(line);
      if (cells.length < 7) {
        throw new Error(`手册行字段不足：第 ${index + 1} 行`);
      }
      rows.push({
        sourceRow: index + 1,
        code: cells[0],
        name: cells[1],
        isAtomic: cells[2] === '是',
        externalVisible: cells[3] === '是',
        ownerAName: optionalName(cells[4]),
        ownerBName: optionalName(cells[5]),
        summary: cells.slice(6).join('|'),
      });
      continue;
    }

    if (/^\s*\|\s*$/.test(line) || /^\s*$/.test(line)) {
      continue;
    }

    if (/^\s*-\s+/.test(line) && rows.length > 0) {
      const note = clean(line.replace(/^\s*-\s+/, ''));
      rows[rows.length - 1].summary = [rows[rows.length - 1].summary, note]
        .filter(Boolean)
        .map((value, itemIndex) => itemIndex === 0 ? value : `- ${value}`)
        .join('\n');
      continue;
    }

    if (/^##\s+1\.[2-4]\s+/.test(line)) {
      break;
    }
  }

  if (rows.length === 0) {
    throw new Error('手册表没有可导入的数据行');
  }

  const codes = new Set();
  for (const row of rows) {
    if (codes.has(row.code)) {
      throw new Error(`手册编号重复：${row.code}`);
    }
    codes.add(row.code);
    const productType = row.code.split('-', 1)[0];
    if (!productTypes.has(productType)) {
      throw new Error(`未识别的产品形态：${row.code}`);
    }
  }
  return rows;
}

function handbookPayload(rows, source) {
  return {
    version: 1,
    source: {
      type: 'markdown-table',
      file: path.relative(root, source),
      importedAt: new Date().toISOString(),
    },
    handbooks: rows.map(row => {
      const productType = row.code.split('-', 1)[0];
      return {
        handbookId: row.code,
        id: row.code,
        code: row.code,
        name: row.name,
        title: row.name,
        productId: productType,
        productType,
        ownerA: row.ownerAName ? { displayName: row.ownerAName } : null,
        ownerB: row.ownerBName ? { displayName: row.ownerBName } : null,
        departmentId: null,
        currentOutlineVersionId: null,
        status: 'asset_created',
        archivedAt: null,
        summary: row.summary || '',
        isAtomic: row.isAtomic,
        externalVisible: row.externalVisible,
        sourceRow: row.sourceRow,
        sourceFile: path.relative(root, source),
      };
    }),
    audits: [],
  };
}

function writeSeed(payload) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function importPayload(payload) {
  const baseUrl = process.env.YASDB_STORAGE_URL || 'http://127.0.0.1:14210';
  const store = createDomainStore({ baseUrl });
  const stored = store.writeHandbooksSnapshot(payload);
  return {
    baseUrl,
    storedCount: stored.handbooks?.length || 0,
    storedHandbooks: stored.handbooks || [],
  };
}

function main() {
  const text = fs.readFileSync(sourceFile, 'utf8');
  const rows = parsePanorama(text);
  const payload = handbookPayload(rows, sourceFile);
  writeSeed(payload);

  const result = {
    success: true,
    sourceFile,
    outputFile,
    parsedCount: payload.handbooks.length,
    applied: false,
  };

  if (apply) {
    Object.assign(result, importPayload(payload), { applied: true });
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`手册导入失败：${error.message}\n`);
  process.exitCode = 1;
}
