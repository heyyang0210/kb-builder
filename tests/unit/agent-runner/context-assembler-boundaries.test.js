const assembler = require('../../../packages/agent-runner-core/lib/retrieval/context-assembler');

describe('上下文来源与维度兼容契约', () => {
  test('空输入没有虚构上下文', () => {
    expect(assembler.assemble()).toBe('');
    expect(assembler.assemble({}, {})).toBe('');
    expect(assembler.convertRetrievalResults({})).toEqual({});
  });

  test('结果保留相关度和来源，缺失字段明确为空', () => {
    expect(assembler.formatResult({ title: '标题', best_score: 0.876, source: 'mcp', excerpt: '正文', ku_name: '库' }, 2))
      .toBe('2. **标题**（相关度: 88%） [YashanDB 知识库]\n   正文\n   ku_name: 库');
    expect(assembler.formatResult({ best_score: 0, source: 'custom' }, 1))
      .toBe('1. **未知** [custom]\n   \n   ku_name: ');
    expect(assembler.formatResult({}, 1)).toBe('1. **未知**\n   \n   ku_name: ');
  });

  test('必需和可选维度保持指定顺序并忽略空维度', () => {
    const grouped = { syntax: [{ title: '语法' }], custom: [{ title: '扩展' }], example: [{ title: '例子' }], empty: [] };
    const context = assembler.assemble(grouped, null, null, { required: ['custom', 'missing', 'syntax'], optional: ['empty', 'example', 'absent'] });
    expect(context.indexOf('### custom')).toBeLessThan(context.indexOf('### 语法定义'));
    expect(context.indexOf('### 语法定义')).toBeLessThan(context.indexOf('### 使用示例'));
    expect(context).not.toContain('### missing');
    expect(context).not.toContain('### empty');
    expect(assembler.assemble(grouped)).toContain('### custom');
    expect(assembler.assemble(grouped, null, null, {})).toContain('### 使用示例');
  });

  test('来源标题和摘要按兼容优先级回退，内容截断200字', () => {
    const context = assembler.formatSourceSection('custom', [
      { title: '标题', name: '名称', file: 'a.js', excerpt: '摘录', summary: '摘要', path: '/a' },
      { name: '名称', summary: '摘要' },
      { file: 'b.js', content: '字'.repeat(201) },
      {}, { content: '' }
    ]);
    expect(context).toContain('### custom（5 条）');
    expect(context).toContain('1. **标题**\n   摘录\n   路径: /a');
    expect(context).toContain('2. **名称**\n   摘要');
    expect(context).toContain('3. **b.js**\n   ' + '字'.repeat(200) + '\n   路径: b.js');
    expect(context).not.toContain('字'.repeat(201));
    expect(context).toContain('4. **未知**');
  });

  test.each([['designDocs', 'design_doc'], ['oracleKb', 'oracle_kb'], ['testCases', 'test_case'], ['sourceCode', 'source_code']])(
    '%s 转换保留字段优先级和来源', (inputKey, source) => {
      const files = [
        { name: '名称', title: '标题', file: 'a.js', path: '/a', summary: '摘要', content: '正文' },
        { title: '标题', file: 'b.js', content: '字'.repeat(201) },
        { file: 'c.js' }, {}, { content: '' }
      ];
      const result = assembler.convertRetrievalResults({ [inputKey]: { files } });
      expect(result[source]).toEqual([
        { title: '名称', path: '/a', excerpt: '摘要', source },
        { title: '标题', path: 'b.js', excerpt: '字'.repeat(200), source },
        { title: 'c.js', path: 'c.js', excerpt: '', source },
        { title: undefined, path: undefined, excerpt: '', source },
        { title: undefined, path: undefined, excerpt: '', source }
      ]);
      expect(assembler.convertRetrievalResults({ [inputKey]: {} })).toEqual({});
      expect(assembler.convertRetrievalResults({ [inputKey]: { files: [] } })).toEqual({});
      const context = assembler.assemble(null, result);
      expect(context).toContain('## ' + assembler.SOURCE_LABELS[source]);
      expect(context).toContain('路径: /a');
    }
  );

  test('多来源固定顺序且不输出空来源', () => {
    const context = assembler.assemble(null, { source_code: [{ title: '源码' }], test_case: [{ title: '测试' }], oracle_kb: [{ title: 'Oracle' }], design_doc: [{ title: '设计' }], unknown: null, empty: [] });
    const headings = ['设计文档', 'Oracle 知识库', '测试用例', '源码参考'];
    headings.forEach((heading, i) => {
      expect(context).toContain('## ' + heading);
      if (i) expect(context.indexOf('## ' + headings[i - 1])).toBeLessThan(context.indexOf('## ' + heading));
    });
    expect(assembler.assemble(null, { design_doc: [] })).toBe('');
  });
});
