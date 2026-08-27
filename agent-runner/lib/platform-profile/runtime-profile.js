const fs = require('fs');

function runtimeState() {
  return global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__ || null;
}

function getPublicContext() {
  return runtimeState()?.context || global.__KNOWLEDGE_PLATFORM_CONTEXT__ || null;
}

function getTrace() {
  const context = getPublicContext();
  if (!context) return null;
  return Object.freeze({
    profileId: context.profileId,
    enterpriseId: context.enterpriseId,
    configFingerprint: context.configFingerprint
  });
}

function getBrand() {
  const context = getPublicContext();
  return context?.brand || {};
}

function getResource(collection, id) {
  const runtime = runtimeState();
  const item = runtime?.profile?.[collection]?.find(candidate => candidate.id === id);
  if (!item) throw new Error(`企业能力包未登记资源：${collection}/${id}`);
  const reference = item.resourceRef || item.manifestRef;
  const resource = runtime.resources.find(candidate => candidate.reference === reference);
  if (!resource) throw new Error(`企业能力包资源未解析：${collection}/${id}`);
  return Object.freeze({ id, version: item.version, reference, path: resource.path });
}

function getResourceByReference(reference) {
  const runtime = runtimeState();
  const resource = runtime?.resources.find(candidate => candidate.reference === reference);
  if (!resource) throw new Error(`企业能力包未登记资源：${reference}`);
  return Object.freeze({ reference, path: resource.path });
}

function readResource(collection, id) {
  const resource = getResource(collection, id);
  return { ...resource, content: fs.readFileSync(resource.path, 'utf8') };
}

module.exports = { getBrand, getPublicContext, getResource, getResourceByReference, getTrace, readResource };
