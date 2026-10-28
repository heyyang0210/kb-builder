const crypto = require('crypto');
const fs = require('fs');
const { CONFIG_PATHS } = require('./config-registry');
const ValidatorAgent = require('./agents/validator-agent');

const hash = content => crypto.createHash('sha256').update(content).digest('hex');
const checkNames = ['structure', 'template', 'expression', 'sources'];

function createProductionContentQuality(options = {}) {
  return async function checkContent({ markdown, revision, metadata, requirements }) {
    const rules = options.rules || JSON.parse(fs.readFileSync(CONFIG_PATHS.contentRules, 'utf8')).productionQuality;
    const result = { status: 'not_executed', gate: 'not_passed', checks: [], issues: [], limitations: [],
      documentDigest: hash(markdown), revisionId: revision.revisionId, ruleVersion: rules?.version || null,
      ruleDigest: rules ? hash(JSON.stringify(rules)) : null,
      implementationDigest: hash(fs.readFileSync(require.resolve('./agents/validator-agent'), 'utf8')), model: null };
    let template = metadata?.template || null;
    if (!template?.templateContent && revision.templateVersionId) {
      try {
        const match = /^(.*)@(\d+)$/.exec(revision.templateVersionId);
        if (!match) throw new Error('version required');
        const value = (options.getTemplateVersion || ((id, version) => require('./template-store').createTemplateStore().getVersion(id, version)))(match[1], Number(match[2]));
        if (value.validationStatus !== 'passed' || value.contentHash !== `sha256:${hash(value.content)}`) throw new Error('invalid template');
        template = { templateId: match[1], templateVersion: Number(match[2]), templateContent: value.content, templateHash: value.contentHash };
      } catch (_) { result.limitations.push('已保存的模板版本不可用，本次不能确认模板符合性'); }
    }
    const sources = metadata?.sourceSnapshots || [];
    result.context = { template: template ? { templateId: template.templateId, templateVersion: template.templateVersion, templateHash: template.templateHash } : null,
      sourceDigests: sources.map(source => ({ sourceId: source.sourceId, contentDigest: source.contentDigest || hash(source.content || '') })) };
    try {
      if (!rules?.reviewPrompt || !rules.version) throw Object.assign(new Error('rules unavailable'), { code: 'QUALITY_CONTENT_RULES_UNAVAILABLE' });
      // Use the existing model configuration and Agent execution/metadata path.
      const config = options.modelConfig || await require('./config-manager').getModelConfig();
      if (!config?.model || !config.api_key) throw Object.assign(new Error('model unavailable'), { code: 'QUALITY_CONTENT_MODEL_UNAVAILABLE' });
      const agent = new ValidatorAgent(config);
      if (options.generate) agent.llmClient.chatJSON = options.generate;
      const output = await agent.execute({ document: markdown, qualityReview: { prompt: rules.reviewPrompt,
        context: { template, sources, provenance: metadata?.provenance || [], verification: metadata?.verification || 'unverified', requirements: requirements || '' } } },
      { productionQuality: true, timeoutMs: rules.timeoutMs, maxTokens: rules.maxTokens });
      result.checks = output.checks;
      result.issues = output.issues;
      result.model = { model: output._meta.model || config.model, provider: output._meta.provider || config.provider,
        tokens: output._meta.tokens, profile: output._meta.profile };
      for (const [name, available, reason] of [
        ['template', Boolean(template?.templateContent), '无可用的固定模板，模板符合性未检查'],
        ['sources', sources.length > 0, '无已确认的引用快照，来源事实未核验'],
      ]) {
        if (!available) { Object.assign(result.checks.find(item => item.check === name), { status: 'not_executed', details: reason }); result.limitations.push(reason); }
      }
      result.status = 'completed';
      result.gate = result.checks.every(item => item.status === 'passed') && !result.issues.some(issue => issue.severity === 'blocking') ? 'passed' : 'not_passed';
    } catch (error) {
      const safeProviderCodes = new Set(['AI_PROVIDER_AUTH_FAILED', 'AI_PROVIDER_REGION_UNSUPPORTED', 'AI_PROVIDER_RATE_LIMITED', 'AI_PROVIDER_TIMEOUT', 'AI_PROVIDER_UNAVAILABLE']);
      result.error = { code: safeProviderCodes.has(error.providerCode) ? error.providerCode : String(error.code || 'QUALITY_CONTENT_MODEL_FAILED') };
      result.checks = checkNames.map(check => ({ check, status: 'not_executed', details: '内容检查未完成，请检查模型配置或响应后重试' }));
      result.limitations.push('未完成模型内容检查；没有使用基础规则或静态报告代替成功结果');
    }
    result.limitations.push('AI 内容检查仅提供问题建议，不能保证事实正确，不能代替人工审核');
    return result;
  };
}

module.exports = { createProductionContentQuality };
