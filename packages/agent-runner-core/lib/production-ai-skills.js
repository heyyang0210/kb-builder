const crypto = require('crypto');
const fs = require('fs');
const { loadProfile } = require('./platform-profile/profile-loader');

// Reuse the enterprise profile loader and its resource allowlist, rather than scan arbitrary paths.
function createProductionAISkills({ context, requireCapability, ErrorType, rules, loadSkillProfile }) {
  const fail = (code, message, status = 400) => { throw new ErrorType(code, message, status); };
  function catalog() {
    const configured = rules().skills || [];
    if (!Array.isArray(configured)) fail('AI_SKILL_CONFIG_INVALID', '续写能力配置无效', 503);
    if (!configured.length) return [];
    try {
      const runtime = loadSkillProfile ? loadSkillProfile() : (global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__ || loadProfile());
      const seen = new Set();
      return configured.map(item => {
        if (!item.skillId || seen.has(item.skillId) || !item.displayName || !item.description
          || !Array.isArray(item.operations) || !item.operations.length
          || item.operations.some(operation => !Object.hasOwn(rules().operations, operation))) {
          fail('AI_SKILL_CONFIG_INVALID', '续写能力配置无效', 503);
        }
        seen.add(item.skillId);
        const entry = runtime.profile.skills.find(skill => skill.id === item.skillId);
        const resource = entry && runtime.resources.find(value => value.reference === entry.manifestRef);
        if (!resource) fail('AI_SKILL_UNAVAILABLE', '选用能力未登记或不可用，请联系管理员', 503);
        const content = fs.readFileSync(resource.path, 'utf8');
        if (!content.trim()) fail('AI_SKILL_UNAVAILABLE', '选用能力内容为空，请联系管理员', 503);
        return {
          skillId: entry.id, version: entry.version, reference: entry.manifestRef,
          displayName: item.displayName, description: item.description, operations: item.operations,
          contentDigest: crypto.createHash('sha256').update(content).digest('hex'), content,
        };
      });
    } catch (error) {
      if (error instanceof ErrorType) throw error;
      fail('AI_SKILL_UNAVAILABLE', '续写能力资源不可读，请联系管理员', 503);
    }
  }
  function list(input, session) {
    requireCapability(session, 'canRead'); context(input);
    return { items: catalog() };
  }
  function selected(input) {
    const choices = input.selectedSkills || [];
    if (!Array.isArray(choices) || choices.length > (rules().maxSelectedSkills || 4)
      || new Set(choices.map(item => item?.skillId)).size !== choices.length) {
      fail('AI_SKILL_SELECTION_INVALID', '请选择数量允许且不重复的续写能力');
    }
    if (!choices.length) return [];
    const items = catalog();
    return choices.map(choice => {
      const item = items.find(value => value.skillId === choice?.skillId);
      if (!item) fail('AI_SKILL_NOT_FOUND', '所选续写能力不存在', 404);
      if (!item.operations.includes(input.operation)) fail('AI_SKILL_OPERATION_INVALID', '所选能力不适用于当前操作');
      if (choice.contentDigest !== item.contentDigest) fail('AI_SKILL_VERSION_CONFLICT', '续写能力已变化，请重新预览并确认', 409);
      return structuredClone(item);
    });
  }
  return { list, selected };
}

module.exports = { createProductionAISkills };
