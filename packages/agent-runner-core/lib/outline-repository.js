const fs = require('fs');
const path = require('path');
const { createAggregateStore } = require('./aggregate-store');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');
const { createDomainStore } = require('./domain-store');

function list(value) {
  return Array.isArray(value) ? value : [];
}

function hasLeafDocuments(directory = {}) {
  if (list(directory.documents).length || list(directory.kps).length || list(directory.knowledgePoints).length) return true;
  return list(directory.children).some(hasLeafDocuments);
}

function hasWritableSnapshotContent(outline = {}) {
  if (outline.content?.schemaVersion && Array.isArray(outline.content.nodes)) return outline.content.nodes.some(node => node.kind === 'document');
  return list(outline.content?.parts).some(part => list(part.documents).length || list(part.chapters).some(hasLeafDocuments) || list(part.children).some(hasLeafDocuments));
}

function writableSnapshot(metadata = {}) {
  return { ...metadata, outlines: list(metadata.outlines).filter(item => !item.deletedAt && hasWritableSnapshotContent(item)) };
}

/** File-backed repository used by outline routes until the database adapter is ready. */
class OutlineRepository {
  constructor(rootDir = path.join(AGENT_RUNNER_RUNTIME_ROOT, 'outlines')) {
    this.rootDir = rootDir;
    this.metadataPath = path.join(rootDir, 'metadata.json');
    this.lockPath = `${this.metadataPath}.lock`;
    this.store = createAggregateStore({ namespace: 'outlines', key: 'metadata', filePath: this.metadataPath, emptyValue: { outlines: [] } });
    this.domainStore = createDomainStore();
  }

  read() {
    if (process.env.KNOWLEDGE_STORAGE_MODE === 'database') return this.domainStore.readOutlines();
    if (!fs.existsSync(this.metadataPath)) return { outlines: [] };
    try {
      const parsed = JSON.parse(fs.readFileSync(this.metadataPath, 'utf8'));
      return { ...parsed, outlines: Array.isArray(parsed.outlines) ? parsed.outlines : [] };
    } catch (error) {
      const backup = `${this.metadataPath}.bak`;
      if (fs.existsSync(backup)) {
        const parsed = JSON.parse(fs.readFileSync(backup, 'utf8'));
        return { ...parsed, outlines: Array.isArray(parsed.outlines) ? parsed.outlines : [] };
      }
      throw new Error(`大纲元数据损坏且无可用备份: ${error.message}`);
    }
  }

  write(metadata) {
    if (process.env.KNOWLEDGE_STORAGE_MODE === 'database') return this.domainStore.writeOutlinesSnapshot(writableSnapshot(metadata));
    fs.mkdirSync(this.rootDir, { recursive: true });
    let lockFd;
    try {
      lockFd = fs.openSync(this.lockPath, 'wx');
      this.writeUnlocked(metadata);
    } finally {
      if (lockFd !== undefined) {
        fs.closeSync(lockFd);
        try { fs.unlinkSync(this.lockPath); } catch (_) { /* lock already cleared */ }
      }
    }
  }

  append(outlines, metadata) {
    if (!outlines.length) return;
    if (process.env.KNOWLEDGE_STORAGE_MODE === 'database') {
      return this.domainStore.writeOutlinesSnapshot({ outlines, insertOnly: true });
    }
    // 文件模式通过锁内追加保护已有条目；不将请求开始时的陈旧快照写回。
    return this.update(current => {
      const ids = new Set(current.outlines.map(outline => outline.id));
      if (outlines.some(outline => ids.has(outline.id))) throw new Error('候选ID已存在，拒绝覆盖');
      current.outlines.push(...outlines);
      if (metadata?.idempotency) current.idempotency = { ...current.idempotency, ...metadata.idempotency };
      return current;
    });
  }

  writeUnlocked(metadata) {
    const payload = JSON.stringify(metadata, null, 2);
    const temp = `${this.metadataPath}.${process.pid}.${Date.now()}.tmp`;
    if (fs.existsSync(this.metadataPath)) fs.copyFileSync(this.metadataPath, `${this.metadataPath}.bak`);
    fs.writeFileSync(temp, payload, 'utf8');
    fs.renameSync(temp, this.metadataPath);
  }

  update(mutator) {
    if (process.env.KNOWLEDGE_STORAGE_MODE === 'database') {
      const current = this.read();
      const next = mutator(structuredClone(current)) || current;
      this.write(next);
      return next;
    }
    fs.mkdirSync(this.rootDir, { recursive: true });
    let lockFd;
    try {
      lockFd = fs.openSync(this.lockPath, 'wx');
      const metadata = this.read();
      const result = mutator(metadata) || metadata;
      this.writeUnlocked(result);
      return result;
    } finally {
      if (lockFd !== undefined) {
        fs.closeSync(lockFd);
        try { fs.unlinkSync(this.lockPath); } catch (_) { /* lock already cleared */ }
      }
    }
  }
}

module.exports = { OutlineRepository, hasWritableSnapshotContent, writableSnapshot };
