const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_.-]+$/;

function contractViolation(message, details = {}) {
  const error = new Error(message);
  error.code = 'KNOWLEDGE_CONTRACT_INVALID';
  error.details = details;
  return error;
}

function validateSuccessEnvelope(payload, context = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw contractViolation('知识中心成功响应必须是对象', { endpoint: context.endpoint?.id || null });
  }
  if (payload.success !== true) throw contractViolation('知识中心成功响应缺少 success=true', { endpoint: context.endpoint?.id || null });
  if (typeof payload.requestId !== 'string') throw contractViolation('知识中心成功响应缺少 requestId', { endpoint: context.endpoint?.id || null });
  if (typeof payload.correlationId !== 'string') throw contractViolation('知识中心成功响应缺少 correlationId', { endpoint: context.endpoint?.id || null });
  if (!Object.prototype.hasOwnProperty.call(payload, 'data') && !Object.prototype.hasOwnProperty.call(payload, 'items')) {
    throw contractViolation('知识中心成功响应必须包含 data 或 items', { endpoint: context.endpoint?.id || null });
  }
  return payload;
}

function validateErrorEnvelope(payload, context = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.success !== false) {
    throw contractViolation('知识中心错误响应必须是 success=false 对象', { endpoint: context.endpoint?.id || null });
  }
  const error = payload.error;
  if (!error || typeof error !== 'object') throw contractViolation('知识中心错误响应缺少 error', { endpoint: context.endpoint?.id || null });
  if (typeof error.code !== 'string' || !ERROR_CODE_PATTERN.test(error.code)) throw contractViolation('知识中心错误响应 code 无效', { endpoint: context.endpoint?.id || null });
  if (typeof error.message !== 'string' || !error.message) throw contractViolation('知识中心错误响应 message 无效', { endpoint: context.endpoint?.id || null });
  if (typeof error.retryable !== 'boolean') throw contractViolation('知识中心错误响应 retryable 无效', { endpoint: context.endpoint?.id || null });
  if (typeof error.requestId !== 'string') throw contractViolation('知识中心错误响应缺少 requestId', { endpoint: context.endpoint?.id || null });
  return payload;
}

function validateCleaningResponse(payload, status, context = {}) {
  return status >= 400 ? validateErrorEnvelope(payload, context) : validateSuccessEnvelope(payload, context);
}

function ensureSuccessEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.success !== true) return payload;
  if (Object.prototype.hasOwnProperty.call(payload, 'data') || Object.prototype.hasOwnProperty.call(payload, 'items')) return payload;
  const { success, requestId, correlationId, ...result } = payload;
  return { ...payload, data: result };
}

module.exports = { validateCleaningResponse, validateSuccessEnvelope, validateErrorEnvelope, contractViolation, ensureSuccessEnvelope };
