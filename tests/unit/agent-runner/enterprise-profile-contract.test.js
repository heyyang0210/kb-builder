const fs = require('fs');
const path = require('path');
const { validateSchema } = require('../../../packages/agent-runner-core/lib/platform-profile/schema-validator');

const contractRoot = path.resolve(__dirname, '../../../packages/platform-contracts/enterprise-profile/v1');
const schema = JSON.parse(fs.readFileSync(path.join(contractRoot, 'enterprise-profile.schema.json'), 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setJsonPointer(target, pointer, value) {
  const parts = pointer.split('/').slice(1).map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  const key = parts.pop();
  const parent = parts.reduce((current, part) => current[part], target);
  parent[key] = value;
}

function loadFixture(relativePath) {
  const fixturePath = path.join(contractRoot, 'fixtures', relativePath);
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  if (!fixture.extends) return fixture;

  const basePath = path.resolve(path.dirname(fixturePath), fixture.extends);
  const profile = clone(JSON.parse(fs.readFileSync(basePath, 'utf8')));
  setJsonPointer(profile, fixture.mutation.path, fixture.mutation.value);
  return profile;
}

function fixtureExpectation(relativePath) {
  const fixturePath = path.join(contractRoot, 'fixtures', relativePath);
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  return { code: fixture.expectedCode, issueCode: fixture.expectedIssueCode };
}

function isAbsoluteOrUnc(reference) {
  return reference.startsWith('/') || /^[A-Za-z]:[\\/]/.test(reference) || reference.startsWith('\\\\');
}

function resourceReferences(profile) {
  return [
    profile.domain?.manifestRef,
    ...(profile.agents || []).map(item => item.manifestRef),
    ...(profile.skills || []).map(item => item.manifestRef),
    ...(profile.prompts || []).map(item => item.resourceRef),
    ...(profile.templates || []).map(item => item.resourceRef),
    ...(profile.qualityRules || []).map(item => item.resourceRef)
  ].filter(Boolean);
}

function validateSemantics(profile) {
  const sensitiveKeys = /^(password|token|apiKey|cookie|casTicket|secret)$/i;
  const walk = (value, pointer = '') => {
    if (!value || typeof value !== 'object') return null;
    for (const [key, child] of Object.entries(value)) {
      const childPointer = `${pointer}/${key}`;
      if (sensitiveKeys.test(key)) {
        return { code: 'PROFILE_SECRET_EXPOSED', issueCode: 'SECRET_FIELD', path: childPointer };
      }
      const found = walk(child, childPointer);
      if (found) return found;
    }
    return null;
  };
  const secret = walk(profile);
  if (secret) return secret;

  for (const reference of resourceReferences(profile)) {
    if (isAbsoluteOrUnc(reference)) {
      return { code: 'PROFILE_PATH_FORBIDDEN', issueCode: 'ABSOLUTE_PATH', path: '/resourceRef' };
    }
    if (reference.split(/[\\/]/).includes('..')) {
      return { code: 'PROFILE_PATH_FORBIDDEN', issueCode: 'PATH_OUT_OF_ROOT', path: '/resourceRef' };
    }
  }

  const collections = ['modules', 'workspaces', 'connectors', 'agents', 'skills', 'prompts', 'templates', 'qualityRules', 'logicalDirectories', 'capabilities'];
  for (const collection of collections) {
    const seen = new Set();
    for (let index = 0; index < (profile[collection] || []).length; index += 1) {
      const id = profile[collection][index].id;
      if (seen.has(id)) {
        return { code: 'PROFILE_VALIDATION_FAILED', issueCode: 'REFERENCE_DUPLICATE', path: `/${collection}/${index}/id` };
      }
      seen.add(id);
    }
  }

  const workspaceIds = new Set((profile.workspaces || []).map(item => item.id));
  for (let index = 0; index < (profile.modules || []).length; index += 1) {
    if (!workspaceIds.has(profile.modules[index].workspaceRef)) {
      return { code: 'PROFILE_VALIDATION_FAILED', issueCode: 'REFERENCE_UNKNOWN', path: `/modules/${index}/workspaceRef` };
    }
  }
  const capabilityIds = new Set((profile.capabilities || []).map(item => item.id));
  for (let connectorIndex = 0; connectorIndex < (profile.connectors || []).length; connectorIndex += 1) {
    const connector = profile.connectors[connectorIndex];
    for (let refIndex = 0; refIndex < (connector.capabilityRefs || []).length; refIndex += 1) {
      if (!capabilityIds.has(connector.capabilityRefs[refIndex])) {
        return { code: 'PROFILE_VALIDATION_FAILED', issueCode: 'REFERENCE_UNKNOWN', path: `/connectors/${connectorIndex}/capabilityRefs/${refIndex}` };
      }
    }
  }
  return null;
}

function validateProfile(profile) {
  const semanticError = validateSemantics(profile);
  if (semanticError) return semanticError;
  const errors = validateSchema(profile, schema);
  if (errors.length) {
    const first = errors[0];
    return {
      code: profile.apiVersion && profile.apiVersion !== 'enterprise-profile/v1'
        ? 'PROFILE_VERSION_UNSUPPORTED'
        : 'PROFILE_VALIDATION_FAILED',
      issueCode: first.issueCode === 'REQUIRED_FIELD_MISSING' ? 'SCHEMA_INVALID' : first.issueCode,
      path: first.path || '/'
    };
  }
  return null;
}

describe('enterprise-profile/v1 Node 契约', () => {
  test('最小 YashanDB 能力包通过 Schema 与语义校验', () => {
    expect(validateProfile(loadFixture('valid/minimal-yashandb.json'))).toBeNull();
  });

  test.each([
    'invalid/missing-required.json',
    'invalid/absolute-path.json',
    'invalid/path-traversal.json',
    'invalid/plaintext-secret.json',
    'invalid/duplicate-id.json',
    'invalid/unknown-reference.json',
    'invalid/unsupported-version.json',
    'invalid/unknown-field.json',
    'invalid/windows-path.json',
    'invalid/unc-path.json',
    'invalid/illegal-secret-reference.json',
    'invalid/malformed-connector.json'
  ])('%s 返回稳定错误码和配置路径', fixture => {
    const expected = fixtureExpectation(fixture);
    const error = validateProfile(loadFixture(fixture));
    expect(error.code).toBe(expected.code);
    expect(error.issueCode).toBe(expected.issueCode);
    expect(error.path).toMatch(/^\//);
  });
});

module.exports = { loadFixture, validateProfile };
