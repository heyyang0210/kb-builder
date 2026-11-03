const { describe, expect, test } = require('@jest/globals');
const { redact } = require('../../../packages/agent-runner-core/lib/logger');

describe('Node 结构化日志脱敏', () => {
  test('脱敏对象值时保留 Winston 元数据 Symbol', () => {
    const levelSymbol = Symbol.for('level');
    const messageSymbol = Symbol.for('message');
    const source = { token: 'secret', nested: { content: 'private' }, [levelSymbol]: 'info', [messageSymbol]: 'event' };
    const safe = redact(source);

    expect(safe.token).toBe('[REDACTED]');
    // content/body 仅在 verbose 模式下脱敏，默认模式保留以便调试
    expect(safe.nested.content).toBe('private');
    expect(safe[levelSymbol]).toBe('info');
    expect(safe[messageSymbol]).toBe('event');
  });

  test('verbose 模式下脱敏 content 和 body 字段', () => {
    const source = { token: 'secret', content: 'private body text', body: 'request payload' };
    const safe = redact(source, true);

    expect(safe.token).toBe('[REDACTED]');
    expect(safe.content).toBe('[REDACTED]');
    expect(safe.body).toBe('[REDACTED]');
  });

  test('脱敏日志字符串中的带引号和多空格敏感值', () => {
    const safe = redact('password="two word secret" token=\'quoted token value\' authorization="Bearer abc.def.ghi"');
    expect(safe).not.toContain('two word secret');
    expect(safe).not.toContain('secret');
    expect(safe).not.toContain('quoted token value');
    expect(safe).not.toContain('value');
    expect(safe).not.toContain('abc.def.ghi');
  });
});
