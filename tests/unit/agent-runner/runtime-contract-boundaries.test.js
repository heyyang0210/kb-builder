const contract = require('../../../packages/agent-runner-core/lib/knowledge-center-runtime-contract');

const success = () => ({ success: true, requestId: 'r', correlationId: 'c', data: null });
const failure = () => ({ success: false, error: { code: 'INPUT_INVALID', message: '参数错误', retryable: false, requestId: 'r' } });

describe('资料加工响应校验边界', () => {
  test.each([null, false, 42, 'text', []])('拒绝非对象响应：%j', payload => {
    expect(() => contract.validateSuccessEnvelope(payload)).toThrow('必须是对象');
    expect(() => contract.validateErrorEnvelope(payload)).toThrow('success=false');
    expect(contract.ensureSuccessEnvelope(payload)).toBe(payload);
  });

  test.each([
    [{ success: false }, 'success=true'],
    [{ requestId: 1 }, 'requestId'],
    [{ correlationId: null }, 'correlationId'],
  ])('成功字段拒绝错误类型：%j', (patch, message) => {
    const payload = { ...success(), ...patch };
    expect(() => contract.validateSuccessEnvelope(payload)).toThrow(message);
    try { contract.validateSuccessEnvelope(payload, { endpoint: { id: 'upload' } }); }
    catch (error) {
      expect(error.code).toBe('KNOWLEDGE_CONTRACT_INVALID');
      expect(error.details).toEqual({ endpoint: 'upload' });
    }
  });

  test('成功外壳要求自有data或items，保留null与空列表', () => {
    const payload = success();
    expect(contract.validateSuccessEnvelope(payload)).toBe(payload);
    const items = { success: true, requestId: 'r', correlationId: 'c', items: [] };
    expect(contract.validateCleaningResponse(items, 399)).toBe(items);
    const inherited = Object.assign(Object.create({ data: {} }), { success: true, requestId: 'r', correlationId: 'c' });
    expect(() => contract.validateSuccessEnvelope(inherited)).toThrow('data 或 items');
    expect(() => contract.validateSuccessEnvelope(inherited, { endpoint: {} })).toThrow('data 或 items');
  });

  test.each([
    ['success', true, 'success=false'],
    ['error', null, '缺少 error'],
    ['error', 'text', '缺少 error'],
    ['code', 123, 'code 无效'],
    ['code', 'lowercase', 'code 无效'],
    ['message', 123, 'message 无效'],
    ['message', '', 'message 无效'],
    ['retryable', 'false', 'retryable 无效'],
    ['requestId', null, 'requestId'],
  ])('错误外壳字段拒绝非法输入：%s=%j', (key, value, message) => {
    const payload = failure();
    if (key === 'success' || key === 'error') payload[key] = value;
    else payload.error[key] = value;
    expect(() => contract.validateErrorEnvelope(payload)).toThrow(message);
    try { contract.validateErrorEnvelope(payload, { endpoint: { id: 'batch' } }); }
    catch (error) { expect(error.details).toEqual({ endpoint: 'batch' }); }
  });

  test('合法错误代码和retryable在400边界原样返回', () => {
    const payload = failure();
    payload.error.code = 'A_B.C-D0';
    payload.error.retryable = true;
    expect(contract.validateCleaningResponse(payload, 400)).toBe(payload);
    expect(contract.validateErrorEnvelope(failure())).toMatchObject({ success: false });
  });

  test('兼容补齐仅添加data，不改输入和已有items/data', () => {
    for (const payload of [success(), { ...success(), items: [] }, { success: false }, {}]) {
      expect(contract.ensureSuccessEnvelope(payload)).toBe(payload);
    }
    const items = { success: true, items: [] };
    expect(contract.ensureSuccessEnvelope(items)).toBe(items);
    const input = Object.freeze({ success: true, requestId: 'r', correlationId: 'c', count: 0, note: null });
    expect(contract.ensureSuccessEnvelope(input)).toEqual({ ...input, data: { count: 0, note: null } });
    expect(input).not.toHaveProperty('data');
    expect(contract.contractViolation('错误')).toMatchObject({ code: 'KNOWLEDGE_CONTRACT_INVALID', details: {} });
  });
});
