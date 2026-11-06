function parseTemplateMappingModelOutput(content) {
  const parse = value => JSON.parse(String(value).trim().replace(/^```(?:json)?s*|s*```$/g, ''));
  const outer = parse(content);
  const value = typeof outer?.markdown === 'string' ? parse(outer.markdown) : outer;
  if (!value || typeof value.templateId !== 'string' || typeof value.reason !== 'string') throw new Error('模型返回格式无效');
  return { templateId: value.templateId, reason: value.reason };
}
module.exports = { parseTemplateMappingModelOutput };
