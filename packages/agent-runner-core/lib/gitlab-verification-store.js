const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { REPOSITORY_ROOT } = require('./repo-paths');
const { GitLabConnectorError } = require('./gitlab-connector');

// 运行时探测事实独立于平台业务配置；指纹防止配置变更后沿用旧结果。
function fingerprint(connection) {
  return crypto.createHash('sha256').update(JSON.stringify([
    connection.host || connection.baseUrl, connection.project || connection.projectPath,
    connection.authMode, connection.credentialRef, connection.mode,
    connection.defaultBranch, connection.pathPrefix, connection.purpose,
  ])).digest('hex');
}

function createGitLabVerificationStore(filePath = process.env.KNOWLEDGE_CENTER_GITLAB_VERIFICATION_STORE || path.join(REPOSITORY_ROOT, 'runtime/knowledge-center/gitlab-verifications.json')) {
  function read() {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return {};
      throw new GitLabConnectorError('GITLAB_VERIFICATION_STORE_UNAVAILABLE', '无法读取 GitLab 最近验证结果', 503);
    }
  }
  return {
    project(connection) {
      const saved = read()[connection.id];
      return { ...connection, lastVerification: saved?.fingerprint === fingerprint(connection) ? saved.verification : null };
    },
    record(connection, verification) {
      const records = read();
      records[connection.id] = { fingerprint: fingerprint(connection), verification };
      const temp = `${filePath}.${crypto.randomUUID()}.tmp`;
      try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(temp, `${JSON.stringify(records)}\n`, { mode: 0o600 });
        fs.renameSync(temp, filePath);
      } catch (error) {
        throw new GitLabConnectorError('GITLAB_VERIFICATION_STORE_UNAVAILABLE', '无法保存 GitLab 验证结果', 503);
      } finally {
        if (fs.existsSync(temp)) fs.unlinkSync(temp);
      }
    },
  };
}

module.exports = { createGitLabVerificationStore };
