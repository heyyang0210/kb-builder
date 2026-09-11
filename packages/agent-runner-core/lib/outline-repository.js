const fs = require('fs');
const path = require('path');
const { createAggregateStore } = require('./aggregate-store');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');

/** File-backed repository used by outline routes until the database adapter is ready. */
class OutlineRepository {
  constructor(rootDir = path.join(AGENT_RUNNER_RUNTIME_ROOT, 'outlines')) {
    this.rootDir = rootDir;
    this.metadataPath = path.join(rootDir, 'metadata.json');
    this.lockPath = `${this.metadataPath}.lock`;
    this.store = createAggregateStore({ namespace: 'outlines', key: 'metadata', filePath: this.metadataPath, emptyValue: { outlines: [] } });
  }

  read() {
    if (process.env.KNOWLEDGE_STORAGE_MODE === 'database') return this.store.read();
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
    if (process.env.KNOWLEDGE_STORAGE_MODE === 'database') return this.store.write(metadata);
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

  writeUnlocked(metadata) {
    const payload = JSON.stringify(metadata, null, 2);
    const temp = `${this.metadataPath}.${process.pid}.${Date.now()}.tmp`;
    if (fs.existsSync(this.metadataPath)) fs.copyFileSync(this.metadataPath, `${this.metadataPath}.bak`);
    fs.writeFileSync(temp, payload, 'utf8');
    fs.renameSync(temp, this.metadataPath);
  }

  update(mutator) {
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

module.exports = { OutlineRepository };
