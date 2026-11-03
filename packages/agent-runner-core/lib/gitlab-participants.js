const { request, GitLabConnectorError } = require('./gitlab-connector');
const rules = require('../../../config/knowledge-center/content-rules.json').gitlabParticipants;

// IDs from the personnel directory, platform auth and GitLab are distinct.
async function resolveMRParticipants(connection, task, users, options = {}) {
  const members = [];
  for (let page = 1; ; page++) {
    if (page > rules.maxPages) throw new GitLabConnectorError('GITLAB_MEMBERS_LIMIT', '项目成员过多，无法完整核对人员映射', 422);
    const batch = await request(connection, `/projects/${encodeURIComponent(connection.projectPath || connection.project)}/users?per_page=${rules.pageSize}&page=${page}`, options);
    if (!Array.isArray(batch)) throw new GitLabConnectorError('GITLAB_MEMBERS_INVALID', 'GitLab 未返回有效的项目成员列表', 502);
    members.push(...batch);
    if (batch.length < rules.pageSize) break;
  }
  const aliases = user => [user.id, user.userId, user.principalId].filter(id => id != null).map(String);
  const visible = users.filter(user => user.enabled !== false && (!Array.isArray(user.visibleHandbookIds) || user.visibleHandbookIds.map(String).includes(String(task.handbookId))));
  function map(id) {
    const matches = visible.filter(user => aliases(user).includes(String(id)));
    if (matches.length !== 1) return { platformId: String(id), error: matches.length ? '平台人员身份不唯一' : '平台人员不存在或不可用' };
    const user = matches[0];
    const result = { platformId: String(user.principalId || user.id || user.userId), displayName: user.displayName || user.loginName, loginName: user.loginName };
    if (!user.loginName) return { ...result, error: '缺少统一登录账号' };
    const sameLogin = visible.filter(item => item.loginName === user.loginName);
    if (sameLogin.length !== 1) return { ...result, error: '统一登录账号对应多个人员' };
    const found = members.filter(member => member.username === user.loginName && member.state === 'active');
    if (found.length !== 1) return { ...result, error: '未找到唯一的活跃项目可访问用户' };
    return { ...result, gitlabId: found[0].id, username: found[0].username };
  }
  const reviewers = [];
  const ids = task.reviews?.flatMap(review => review.reviewerIds || []) || [];
  for (const id of [...new Set(ids.map(String))]) {
    const item = map(id);
    if (!reviewers.some(existing => !item.error && existing.gitlabId === item.gitlabId)) reviewers.push(item);
  }
  const assignees = visible.map(user => map(user.principalId || user.id || user.userId)).filter(item => !item.error);
  return { candidateDigest: task.candidate.digest, reviewers, assignees, canSubmit: reviewers.length > 0 && reviewers.every(item => !item.error) && assignees.length > 0 };
}

module.exports = { resolveMRParticipants };
