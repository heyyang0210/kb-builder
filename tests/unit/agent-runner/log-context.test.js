const { describe, expect, test } = require('@jest/globals');
const { getContext, requestContext, runWithContext } = require('../../../packages/agent-runner-core/lib/log-context');

describe('统一日志请求上下文', () => {
  test('优先透传 requestId/correlationId，缺失时生成', () => {
    expect(requestContext({ headers: { 'x-request-id': 'r1', 'x-correlation-id': 'c1' } })).toEqual({ requestId: 'r1', correlationId: 'c1' });
    const generated = requestContext({ headers: {} });
    expect(generated.requestId).toMatch(/^req-/);
    expect(generated.correlationId).toBe(generated.requestId);
  });

  test.each([
    ['header array', ['first', 'second']],
    ['overlong id', 'x'.repeat(129)],
    ['whitespace', 'id with spaces'],
    ['header injection characters', 'id\r\nX-Injected: yes'],
  ])('rejects invalid request id: %s', (_name, requestId) => {
    const context = requestContext({ headers: { 'x-request-id': requestId, 'x-correlation-id': 'corr-ok' } });
    expect(context.requestId).toMatch(/^req-/);
    expect(context.requestId).not.toBe(requestId);
    expect(context.correlationId).toBe('corr-ok');
  });

  test.each([
    ['header array', ['first', 'second']],
    ['overlong id', 'x'.repeat(129)],
    ['unsafe characters', 'corr id'],
  ])('falls back from invalid correlation id: %s', (_name, correlationId) => {
    const context = requestContext({ headers: { 'x-request-id': 'req-ok', 'x-correlation-id': correlationId } });
    expect(context).toEqual({ requestId: 'req-ok', correlationId: 'req-ok' });
  });

  test('异步回调可以读取绑定上下文', done => {
    runWithContext({ requestId: 'r2', correlationId: 'c2' }, () => {
      setImmediate(() => {
        expect(getContext()).toEqual({ requestId: 'r2', correlationId: 'c2' });
        done();
      });
    });
  });
});
