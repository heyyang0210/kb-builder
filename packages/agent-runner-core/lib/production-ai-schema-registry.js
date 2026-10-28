const fs = require('fs');
const path = require('path');
const { CONFIG_PATHS } = require('./config-registry');

const schemaPath = () => path.join(path.dirname(CONFIG_PATHS.contentRules), 'production-ai-schemas.json');
let cached;

function loadSchemas() {
  if (!cached) cached = JSON.parse(fs.readFileSync(schemaPath(), 'utf8'));
  return cached;
}

function fail(message) {
  const error = new Error(message);
  error.code = 'AI_STAGE_SCHEMA_INVALID';
  throw error;
}

function validate(value, schema, location = '$') {
  if (!schema) return value;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${location} 必须为对象`);
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail(`${location}.${key} 为必填字段`);
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, key)) validate(value[key], child, `${location}.${key}`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties || {}, key)) fail(`${location}.${key} 不允许出现`);
    }
    return value;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) fail(`${location} 必须为数组`);
    if (schema.maxItems != null && value.length > schema.maxItems) fail(`${location} 数量超过限制`);
    value.forEach((item, index) => validate(item, schema.items, `${location}[${index}]`));
    return value;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') fail(`${location} 必须为字符串`);
    if (schema.minLength != null && value.length < schema.minLength) fail(`${location} 长度不足`);
    if (schema.maxLength != null && value.length > schema.maxLength) fail(`${location} 长度超过限制`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) fail(`${location} 格式无效`);
    if (schema.enum && !schema.enum.includes(value)) fail(`${location} 值不受支持`);
    return value;
  }
  if (schema.type === 'integer' && (!Number.isSafeInteger(value))) fail(`${location} 必须为整数`);
  if (schema.minimum != null && value < schema.minimum) fail(`${location} 小于最小值`);
  if (schema.maximum != null && value > schema.maximum) fail(`${location} 超过最大值`);
  return value;
}

function validateStage(stageId, value) {
  const schema = loadSchemas().stages?.[stageId];
  if (!schema) fail(`未配置 ${stageId} 阶段 Schema`);
  return validate(value, schema, stageId);
}

function resetForTests() { cached = undefined; }

module.exports = { loadSchemas, validateStage, resetForTests };
