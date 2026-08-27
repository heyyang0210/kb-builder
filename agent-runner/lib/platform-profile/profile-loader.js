const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ProfileError = require('./profile-error');
const { validateSchema } = require('./schema-validator');

const DEFAULT_PROFILE_ID = 'yashandb';
const PROFILE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const RESOURCE_REF_PATTERN = /^(?!\/)(?![A-Za-z]:)(?!\\\\)(?!~)(?![A-Za-z][A-Za-z0-9+.-]*:)(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\/\/)(?!.*\\)[^?#\u0000-\u001F]+$/;
const SECRET_REF_PATTERN = /^(?:env:[A-Z][A-Z0-9_]{1,126}|secret:[a-z][a-z0-9]*(?:[./-][a-z0-9]+)*)$/;
const ALLOWED_RESOURCE_PREFIXES = [
  'contracts/enterprise-profile/',
  'domain/',
  'skills/',
  'agent-runner/lib/agents/',
  'scripts/pingcode/processing/skills/',
  'scripts/pingcode/processing/metadata-rules/',
  'profiles/',
  'prompts/',
  'templates/'
];
const ALLOWED_RESOURCE_FILES = new Set(['agent-runner/config/quality-config.json']);
const CONNECTOR_REQUIRED_SECRETS = {
  'local-upload': [],
  pingcode: ['secret:connectors/pingcode'],
  mcp: ['secret:connectors/mcp']
};
const COLLECTIONS = ['modules', 'workspaces', 'connectors', 'agents', 'skills', 'prompts', 'templates', 'qualityRules', 'logicalDirectories', 'capabilities'];
const SENSITIVE_KEY = /^(password|token|apiKey|cookie|casTicket|secret)$/i;

function fail(code, message, issueCode, configPath) {
  throw new ProfileError(code, message, { issueCode, path: configPath });
}

function validateProfile(profile) {
  const required = ['apiVersion', 'kind', 'metadata', 'brand', ...COLLECTIONS, 'domain', 'compatibility', 'runtimeProjection'];
  for (const field of required) {
    if (!(field in profile)) fail('PROFILE_VALIDATION_FAILED', `缺少必填字段：${field}`, 'REQUIRED_FIELD_MISSING', `/${field}`);
  }
  if (profile.apiVersion !== 'enterprise-profile/v1' || profile.kind !== 'EnterpriseProfile') {
    fail('PROFILE_VERSION_UNSUPPORTED', '企业能力包版本不受支持', 'SCHEMA_INVALID', '/apiVersion');
  }
  if (!PROFILE_ID_PATTERN.test(profile.metadata?.id || '') || !PROFILE_ID_PATTERN.test(profile.metadata?.enterpriseId || '')) {
    fail('PROFILE_VALIDATION_FAILED', '能力包或企业标识格式不正确', 'SCHEMA_INVALID', '/metadata');
  }
  for (const collection of COLLECTIONS) {
    if (!Array.isArray(profile[collection])) fail('PROFILE_VALIDATION_FAILED', `字段必须为数组：${collection}`, 'SCHEMA_INVALID', `/${collection}`);
  }

  const walk = (value, pointer = '') => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${pointer}/${key}`;
      if (SENSITIVE_KEY.test(key)) fail('PROFILE_SECRET_EXPOSED', '企业能力包包含禁止的敏感字段', 'SECRET_FIELD', childPath);
      walk(child, childPath);
    }
  };
  walk(profile);

  for (const collection of COLLECTIONS) {
    const seen = new Set();
    profile[collection].forEach((item, index) => {
      if (!PROFILE_ID_PATTERN.test(item.id || '')) fail('PROFILE_VALIDATION_FAILED', '资源标识格式不正确', 'SCHEMA_INVALID', `/${collection}/${index}/id`);
      if (seen.has(item.id)) fail('PROFILE_VALIDATION_FAILED', '资源标识重复', 'REFERENCE_DUPLICATE', `/${collection}/${index}/id`);
      seen.add(item.id);
    });
  }

  const workspaceIds = new Set(profile.workspaces.map(item => item.id));
  profile.modules.forEach((item, index) => {
    if (!workspaceIds.has(item.workspaceRef)) fail('PROFILE_VALIDATION_FAILED', '工作区引用不存在', 'REFERENCE_UNKNOWN', `/modules/${index}/workspaceRef`);
  });
  const capabilityIds = new Set(profile.capabilities.map(item => item.id));
  profile.connectors.forEach((connector, connectorIndex) => {
    if (!Array.isArray(connector.capabilityRefs) || !Array.isArray(connector.secretRefs)) {
      fail('PROFILE_VALIDATION_FAILED', '连接器引用字段必须为数组', 'SCHEMA_INVALID', `/connectors/${connectorIndex}`);
    }
    connector.capabilityRefs.forEach((reference, referenceIndex) => {
      if (!capabilityIds.has(reference)) fail('PROFILE_VALIDATION_FAILED', '能力引用不存在', 'REFERENCE_UNKNOWN', `/connectors/${connectorIndex}/capabilityRefs/${referenceIndex}`);
    });
    connector.secretRefs.forEach((reference, referenceIndex) => {
      if (!SECRET_REF_PATTERN.test(reference)) fail('PROFILE_VALIDATION_FAILED', '密钥引用格式不正确', 'SCHEMA_INVALID', `/connectors/${connectorIndex}/secretRefs/${referenceIndex}`);
    });
    const required = CONNECTOR_REQUIRED_SECRETS[connector.type];
    if (!required || required.some(reference => !connector.secretRefs.includes(reference))) {
      fail('PROFILE_VALIDATION_FAILED', '连接器缺少最低密钥引用', 'CONNECTOR_SECRET_REQUIRED', `/connectors/${connectorIndex}/secretRefs`);
    }
  });
}

function collectResourceRefs(profile) {
  return [
    { reference: profile.domain.manifestRef, path: '/domain/manifestRef' },
    ...profile.agents.map((item, index) => ({ reference: item.manifestRef, path: `/agents/${index}/manifestRef` })),
    ...profile.skills.map((item, index) => ({ reference: item.manifestRef, path: `/skills/${index}/manifestRef` })),
    ...profile.prompts.map((item, index) => ({ reference: item.resourceRef, path: `/prompts/${index}/resourceRef` })),
    ...profile.templates.map((item, index) => ({ reference: item.resourceRef, path: `/templates/${index}/resourceRef` })),
    ...profile.qualityRules.map((item, index) => ({ reference: item.resourceRef, path: `/qualityRules/${index}/resourceRef` }))
  ].filter(item => item.reference);
}

function resolveResources(profile, repositoryRoot) {
  const rootReal = fs.realpathSync(repositoryRoot);
  return collectResourceRefs(profile).sort((left, right) => left.reference.localeCompare(right.reference)).map(({ reference, path: configPath }) => {
    if (!RESOURCE_REF_PATTERN.test(reference) || (!ALLOWED_RESOURCE_FILES.has(reference) && !ALLOWED_RESOURCE_PREFIXES.some(prefix => reference.startsWith(prefix)))) {
      fail('PROFILE_PATH_FORBIDDEN', '资源引用不在允许范围内', reference.startsWith('/') || /^[A-Za-z]:[\\/]/.test(reference) || reference.startsWith('\\\\') ? 'ABSOLUTE_PATH' : 'PATH_OUT_OF_ROOT', configPath);
    }
    const candidate = path.resolve(repositoryRoot, reference);
    let real;
    try {
      real = fs.realpathSync(candidate);
    } catch {
      fail('PROFILE_RESOURCE_NOT_FOUND', '能力包引用的资源不存在', 'RESOURCE_NOT_FOUND', configPath);
    }
    const relative = path.relative(rootReal, real);
    if (relative.startsWith('..') || path.isAbsolute(relative)) fail('PROFILE_PATH_FORBIDDEN', '资源真实路径越过仓库边界', 'SYMLINK_ESCAPE', configPath);
    if (!fs.statSync(real).isFile()) fail('PROFILE_VALIDATION_FAILED', '资源引用必须指向普通文件', 'RESOURCE_NOT_FILE', configPath);
    return { reference, digest: sha256(fs.readFileSync(real)) };
  });
}

function normalize(value) {
  if (typeof value === 'string') return value.normalize('NFC');
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = normalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(normalize(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isSecretResolved(reference, env, secretResolver) {
  if (reference.startsWith('env:')) return Boolean(env[reference.slice(4)]);
  return Boolean(secretResolver && secretResolver(reference.slice(7)));
}

function buildContext(profile, resources, env, secretResolver) {
  const fingerprint = `sha256:${sha256(Buffer.from(canonicalJson({ profile, resources }), 'utf8'))}`;
  const configured = profile.connectors.map(connector => ({
    id: connector.id,
    type: connector.type,
    enabled: connector.enabled,
    configured: connector.secretRefs.every(reference => isSecretResolved(reference, env, secretResolver))
  }));
  return Object.freeze({
    schemaVersion: profile.apiVersion,
    profileId: profile.metadata.id,
    enterpriseId: profile.metadata.enterpriseId,
    displayName: profile.metadata.displayName,
    brand: normalize(profile.brand),
    capabilities: normalize(profile.capabilities),
    workspaces: normalize(profile.workspaces.map(({ id, displayName, basePath }) => ({ id, displayName, basePath }))),
    connectors: normalize(configured),
    configFingerprint: fingerprint
  });
}

function loadProfile(options = {}) {
  const repositoryRoot = path.resolve(options.repositoryRoot || path.join(__dirname, '../../..'));
  const registry = options.registry || { yashandb: 'enterprise-profiles/yashandb/profile.json' };
  const env = options.env || process.env;
  const explicitlySet = Object.prototype.hasOwnProperty.call(env, 'KNOWLEDGE_PLATFORM_PROFILE');
  const profileId = options.profileId !== undefined ? options.profileId : (explicitlySet ? env.KNOWLEDGE_PLATFORM_PROFILE : DEFAULT_PROFILE_ID);
  if (!profileId || !PROFILE_ID_PATTERN.test(profileId)) fail('PROFILE_NOT_FOUND', '企业能力包选择无效', 'PROFILE_ID_INVALID', '/');
  const manifestRef = registry[profileId];
  if (!manifestRef) fail('PROFILE_NOT_FOUND', '未找到登记的企业能力包', 'PROFILE_ID_UNKNOWN', '/');
  const manifestPath = path.resolve(repositoryRoot, manifestRef);
  let raw;
  try {
    raw = fs.readFileSync(manifestPath, 'utf8');
  } catch {
    fail('PROFILE_NOT_FOUND', '企业能力包文件不存在或不可读', 'PROFILE_FILE_UNREADABLE', '/');
  }
  let profile;
  try {
    profile = JSON.parse(raw);
  } catch {
    fail('PROFILE_PARSE_FAILED', '企业能力包不是有效 JSON', 'JSON_PARSE_FAILED', '/');
  }
  const schemaPath = path.join(repositoryRoot, 'contracts/enterprise-profile/v1/enterprise-profile.schema.json');
  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch {
    fail('PROFILE_RESOURCE_NOT_FOUND', '企业能力包 Schema 不存在或不可读', 'SCHEMA_NOT_FOUND', '/');
  }
  const schemaErrors = validateSchema(profile, schema);
  if (schemaErrors.length) {
    const first = schemaErrors[0];
    const code = profile.apiVersion && profile.apiVersion !== 'enterprise-profile/v1' ? 'PROFILE_VERSION_UNSUPPORTED' : 'PROFILE_VALIDATION_FAILED';
    fail(code, '企业能力包结构校验失败', first.issueCode, first.path);
  }
  validateProfile(profile);
  const resources = resolveResources(profile, repositoryRoot);
  return { profile: normalize(profile), context: buildContext(profile, resources, env, options.secretResolver), resources };
}

module.exports = { DEFAULT_PROFILE_ID, ProfileError, canonicalJson, loadProfile, normalize, validateProfile };
