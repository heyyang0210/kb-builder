const { previewMarkdown } = require('../../../packages/agent-runner-core/lib/production-ai-preview');

describe('AI流式正文预览边界', () => {
  test.each(['', ' ', '`', '``', '```', '```j', '```js', '```jso', '```json\n'])('尚未收到正文的围栏或空白不展示：%p', raw => {
    expect(previewMarkdown(raw)).toBe('');
  });

  test('普通Markdown原样展示，JSON围栏仅展示顶层正文', () => {
    expect(previewMarkdown('  # 标题\n正文')).toBe('  # 标题\n正文');
    expect(previewMarkdown('```json\n{"markdown":"# 标题\\n正文","provenance":[{"secret":"来源详情"}]}\n```')).toBe('# 标题\n正文');
  });

  test('忽略嵌套同名字段、数组及值字符串，只读取顶层正文', () => {
    const raw = JSON.stringify({ provenance: [{ markdown: '隐藏', quote: '带"引号' }], other: 'markdown', markdown: '真实正文' });
    expect(previewMarkdown(raw)).toBe('真实正文');
    expect(previewMarkdown('{"provenance":[{"markdown":"隐藏"}]}')).toBe('');
    expect(previewMarkdown('{"other":"未结束')).toBe('');
    expect(previewMarkdown('{"markdown":123,"other":"内容"}')).toBe('');
  });

  test('Unicode转义必须完整，代理对未完整时保留之前正文', () => {
    expect(previewMarkdown('{"markdown":"A\\u4e2d\\u6587"}')).toBe('A中文');
    expect(previewMarkdown('{"markdown":"A\\u4e')).toBe('A');
    expect(previewMarkdown('{"markdown":"A\\uXXXX')).toBe('A');
    expect(previewMarkdown('{"markdown":"A\\ud83d')).toBe('A');
    expect(previewMarkdown('{"markdown":"A\\ud83d\\ude00"}')).toBe('A😀');
  });

  test('截断斜杠保留完整正文，合法转义解码，非法转义不显示损坏文本', () => {
    expect(previewMarkdown('{"markdown":"正文' + '\\')).toBe('正文');
    expect(previewMarkdown('{"markdown":"A\\tB\\n\\\"引用\\\"\\\\末尾"}')).toBe('A\tB\n"引用"\\末尾');
    expect(previewMarkdown('{"markdown":"A\\q"}')).toBe('');
  });
});
