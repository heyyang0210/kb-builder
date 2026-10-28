'use strict';

const STAGES = ['planner', 'evidence', 'writer', 'reviewer'];
const DEFAULT_TIMEOUT_MS = 120000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function createProductionAIHttpStageAdapters(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetch || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return {};
  const adapters = {};

  for (const stageId of STAGES) {
    const endpoint = String(env[`KNOWLEDGE_PRODUCTION_${stageId.toUpperCase()}_URL`] || '').trim();
    if (!endpoint) continue;
    let parsed;
    try { parsed = new URL(endpoint); } catch (_) { throw configError(stageId); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) throw configError(stageId);
    const token = String(env[`KNOWLEDGE_PRODUCTION_${stageId.toUpperCase()}_TOKEN`] || '').trim();
    const configuredTimeout = Number(env[`KNOWLEDGE_PRODUCTION_${stageId.toUpperCase()}_TIMEOUT_MS`] || DEFAULT_TIMEOUT_MS);
    if (!Number.isSafeInteger(configuredTimeout) || configuredTimeout < 100 || configuredTimeout > 300000) throw configError(stageId);

    adapters[stageId] = {
      async run(envelope, input = {}) {
        const controller = new AbortController();
        const { signal, onProgress, ...requestInput } = input;
        const abort = () => controller.abort();
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(() => controller.abort(), configuredTimeout);
        timer.unref?.();
        try {
          const response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ envelope, input: requestInput }),
            signal: controller.signal,
          });
          const body = await readBoundedBody(response);
          if (!response.ok) throw stageError('AI_STAGE_REMOTE_FAILED');
          let result;
          try { result = JSON.parse(body); } catch (_) { throw stageError('AI_STAGE_RESPONSE_INVALID'); }
          return result?.artifact ?? result;
        } catch (error) {
          if (typeof error?.code === 'string' && error.code.startsWith('AI_STAGE_')) throw error;
          if (error?.name === 'AbortError') throw stageError('AI_STAGE_TIMEOUT');
          throw stageError('AI_STAGE_UNAVAILABLE');
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
        }
      },
    };
  }
  return adapters;
}

async function readBoundedBody(response) {
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) throw stageError('AI_STAGE_RESPONSE_TOO_LARGE');
  if (!response.body?.getReader) {
    const body = await response.text();
    if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) throw stageError('AI_STAGE_RESPONSE_TOO_LARGE');
    return body;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw stageError('AI_STAGE_RESPONSE_TOO_LARGE');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size).toString('utf8');
}

function configError(stageId) {
  const error = new Error(`Invalid production ${stageId} Adapter configuration`);
  error.code = 'AI_STAGE_CONFIG_INVALID';
  return error;
}

function stageError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

module.exports = { createProductionAIHttpStageAdapters, MAX_RESPONSE_BYTES, DEFAULT_TIMEOUT_MS };
