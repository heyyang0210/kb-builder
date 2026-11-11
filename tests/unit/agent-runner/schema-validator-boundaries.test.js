const { validateSchema } = require('../../../packages/agent-runner-core/lib/platform-profile/schema-validator');

const invalid = (path, keyword, issueCode = 'SCHEMA_INVALID') => ({ issueCode, path, keyword });

describe('平台配置 Schema 校验边界', () => {
  test('布尔与数值字段拒绝类型混淆和非有限数值，修正后恢复', () => {
    const schema = { type: 'object', properties: { enabled: { type: 'boolean' }, limit: { type: 'number' } } };
    for (const limit of [Infinity, -Infinity, NaN, '12', null]) {
      expect(validateSchema({ enabled: 'true', limit }, schema)).toEqual([
        invalid('/enabled', 'type'), invalid('/limit', 'type'),
      ]);
    }
    expect(validateSchema({ enabled: false, limit: 0 }, schema)).toEqual([]);
    expect(validateSchema({ enabled: true, limit: -1.5 }, schema)).toEqual([]);
  });

  test('字符串长度按 Unicode 字符计算，长度及模式错误保留字段位置', () => {
    const schema = { type: 'string', minLength: 2, maxLength: 3, pattern: '^😀' };
    expect(validateSchema('😀', schema)).toEqual([invalid('/', 'minLength')]);
    expect(validateSchema('😀abc', schema)).toEqual([invalid('/', 'maxLength')]);
    expect(validateSchema('abc', schema)).toEqual([invalid('/', 'pattern')]);
    expect(validateSchema('😀中', schema)).toEqual([]);
  });

  test('唯一数组检查定位重复对象并继续验证数组项', () => {
    const schema = { type: 'array', uniqueItems: true, items: { type: 'object', required: ['id'], additionalProperties: false, properties: { id: { type: 'string' } } } };
    expect(validateSchema([{ id: 'a' }, { id: 'a' }, {}], schema)).toEqual([
      invalid('/1', 'uniqueItems'), invalid('/2/id', 'required', 'REQUIRED_FIELD_MISSING'),
    ]);
    expect(validateSchema([{ id: 'a' }, { id: 'b' }], schema)).toEqual([]);
    expect(validateSchema({}, schema)).toEqual([invalid('/', 'type')]);
  });

  test('附加属性按 Schema 校验，错误路径转义斜杠与波浪号', () => {
    const schema = { type: 'object', propertyNames: { minLength: 1 }, additionalProperties: { type: 'string', minLength: 1 } };
    expect(validateSchema({ 'a/b~c': 4, '': '' }, schema)).toEqual([
      invalid('/', 'minLength'), invalid('/a~1b~0c', 'type'), invalid('/', 'minLength'),
    ]);
    expect(validateSchema({ 'a/b~c': 'value' }, schema)).toEqual([]);
    expect(validateSchema({ extra: true }, { type: 'object' })).toEqual([]);
  });

  test('本地引用正确解码路径，外部引用明确拒绝', () => {
    const schema = { $ref: '#/definitions/a~1b~0c', definitions: { 'a/b~c': { const: 'ok' } } };
    expect(validateSchema('ok', schema)).toEqual([]);
    expect(validateSchema('bad', schema)).toEqual([invalid('/', 'const')]);
    expect(() => validateSchema({}, { $ref: 'https://example.invalid/schema' })).toThrow('Unsupported schema reference');
  });

  test('oneOf必须唯一匹配，枚举保留结构化值比较', () => {
    expect(validateSchema('yes', { oneOf: [{ type: 'string' }, { enum: ['yes'] }] })).toEqual([invalid('/', 'oneOf')]);
    expect(validateSchema(false, { oneOf: [{ type: 'string' }, { type: 'number' }] })).toEqual([invalid('/', 'oneOf')]);
    expect(validateSchema(1, { oneOf: [{ type: 'string' }, { type: 'number' }] })).toEqual([]);
    expect(validateSchema({ id: 1 }, { enum: [{ id: 1 }] })).toEqual([]);
    expect(validateSchema({ id: 2 }, { enum: [{ id: 1 }] })).toEqual([invalid('/', 'enum')]);
    expect(validateSchema(null, {})).toEqual([]);
  });
});
