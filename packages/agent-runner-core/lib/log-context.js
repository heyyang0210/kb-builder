const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function validId(value) {
  return typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value);
}

function getContext() {
  return storage.getStore() || {};
}

function runWithContext(context, callback) {
  return storage.run({ ...context }, callback);
}

function requestContext(req) {
  const incomingRequestId = req.headers['x-request-id'];
  const incomingCorrelationId = req.headers['x-correlation-id'];
  const requestId = validId(incomingRequestId) ? incomingRequestId : createId('req');
  const correlationId = validId(incomingCorrelationId) ? incomingCorrelationId : requestId;
  return { requestId, correlationId };
}

function attachResponseIds(res, context) {
  res.setHeader('x-request-id', context.requestId);
  res.setHeader('x-correlation-id', context.correlationId);
}

module.exports = { attachResponseIds, createId, getContext, requestContext, runWithContext, validId };
