const {
  normalizeQuery,
  extractPromptQueries,
  buildMcpQueries,
  splitQueryList,
  getSynonymGroups
} = require('../../../packages/agent-runner-core/lib/retrieval-query-builder');
const {
  extractDirectReferences, extractKeywordsFromKnowledgePoint, smartSplit,
  unique, sanitizeFilenameBase, extractYamlTitle, resolveOutputFilename, standardizePrompt
} = require('../../../packages/agent-runner-core/lib/direct-generate/prompt-parser');
const PlannerAgent = require('../../../packages/agent-runner-core/lib/agents/planner-agent');

// Mock LLM client to return predictable synonym expansions
jest.mock('../../../packages/agent-runner-core/lib/synonym-expander', () => {
  return jest.fn().mockImplementation(() => ({
    expand: jest.fn().mockImplementation(async (queries) => {
      // Simulate LLM expansion with deterministic results
      const expansionMap = {
        '主备切换': ['主备切换', '高可用切换', 'HA切换', '故障切换', '容灾切换'],
        '高可用': ['高可用', 'HA', '主备', '主从', '故障切换', '容灾'],
        'NUMBER 数值类型': ['NUMBER 数值类型', 'NUMBER 数据类型', '数值类型映射', 'NUMBER精度标度'],
        '备份恢复': ['备份恢复', '备份', '恢复', '归档']
      };
      const expanded = [];
      for (const q of queries) {
        if (expansionMap[q]) {
          expanded.push(...expansionMap[q]);
        } else {
          expanded.push(q);
        }
      }
      return [...new Set(expanded)];
    })
  }));
});

describe('retrieval-query-builder', () => {
  test('normalizeQuery 移除 YashanDB 等产品词', () => {
    expect(normalizeQuery('YashanDB 主备切换')).toBe('主备切换');
    expect(normalizeQuery('崖山数据库 NUMBER 数据类型')).toBe('NUMBER 数据类型');
  });

  test('extractPromptQueries 支持关键词、MCP 查询和 JSON mcp_query', () => {
    const prompt = `
关键词：YashanDB 主备切换、备份恢复
MCP 查询：YashanDB NUMBER 精度
{
  "references": {
    "mcp_query": "YashanDB 慢SQL 调优"
  }
}
`;

    expect(extractPromptQueries(prompt)).toEqual([
      '主备切换',
      '备份恢复',
      'NUMBER 精度',
      '慢SQL 调优'
    ]);
  });

  test('buildMcpQueries 从提示词抽取并扩展同义词', async () => {
    const queries = await buildMcpQueries({
      prompt: '关键词：YashanDB 主备切换',
      maxQueries: 8
    });

    expect(queries).toContain('主备切换');
    expect(queries).toContain('高可用切换');
    expect(queries).toContain('HA切换');
    expect(queries.join(' ')).not.toMatch(/YashanDB/i);
  });

  test('buildMcpQueries 无提示词关键词时使用知识点兜底', async () => {
    const queries = await buildMcpQueries({
      prompt: '请生成知识文档',
      knowledgePoint: {
        name: 'YashanDB NUMBER 数值类型',
        type: 'SQL/开发参考',
        description: '介绍精度和标度'
      }
    });

    expect(queries[0]).toBe('NUMBER 数值类型');
    expect(queries).toContain('NUMBER 数据类型');
    expect(queries.join(' ')).not.toMatch(/YashanDB/i);
  });

  test('extractDirectReferences 复用查询词构建并保留参考文件', async () => {
    const result = await extractDirectReferences(
      '关键词：YashanDB 高可用\n参考 templates/default.md',
      'knowledge/templates/base.md',
      { name: '主备切换' }
    );

    expect(result.referenceFiles).toContain('knowledge/templates/base.md');
    expect(result.referenceFiles).toContain('knowledge/templates/default.md');
    expect(result.mcpQueries).toContain('高可用');
    expect(result.mcpQueries).toContain('HA');
    expect(result.mcpQueries.join(' ')).not.toMatch(/YashanDB/i);
  });
});

describe('smartSplit 括号保护', () => {
  test('不拆分括号内的逗号', () => {
    expect(smartSplit('NUMBER(p,s)')).toEqual(['NUMBER(p,s)']);
    expect(smartSplit('数值类型：NUMBER(p,s)')).toEqual(['数值类型：NUMBER(p,s)']);
  });

  test('正确拆分括号外的分隔符', () => {
    expect(smartSplit('Alpha、Beta(p,q)、Gamma')).toEqual(['Alpha', 'Beta(p,q)', 'Gamma']);
    expect(smartSplit('X(p,s)、INTEGER、DECIMAL')).toEqual(['X(p,s)', 'INTEGER', 'DECIMAL']);
  });

  test('splitQueryList 保护括号内容', () => {
    expect(splitQueryList('数值类型：NUMBER(p,s)、INTEGER、DECIMAL')).toEqual([
      '数值类型：NUMBER(p,s)', 'INTEGER', 'DECIMAL'
    ]);
  });

  test('extractKeywordsFromKnowledgePoint 不破坏括号', () => {
    const kp = {
      name: '数值类型：`NUMBER(p,s)` → `INTEGER` / `DECIMAL`',
      description: '数值类型：`NUMBER(p,s)` → `INTEGER` / `DECIMAL`'
    };
    const keywords = extractKeywordsFromKnowledgePoint(kp);
    expect(keywords).toContain('数值类型：NUMBER(p,s)');
    expect(keywords).not.toContain('NUMBER(p');
    expect(keywords).not.toContain('s)');
  });
});

describe('PlannerAgent MCP 查询词兜底', () => {
  test('LLM 未返回查询词时使用无产品词的同义词扩展', async () => {
    const agent = new PlannerAgent({ provider: 'openai', api_key: 'test' });
    const result = await agent.parseResponse({
      content: JSON.stringify({
        document_structure: { title: '高可用', sections: [{ name: '概述' }] },
        retrieval_plan: { mcp_queries: [], reference_files: [] }
      })
    }, {
      knowledgePoint: { name: 'YashanDB 主备切换', type: '运维SOP' },
      prompt: '关键词：YashanDB 主备切换'
    });

    expect(result.retrieval_plan.mcp_queries).toContain('主备切换');
    expect(result.retrieval_plan.mcp_queries).toContain('高可用切换');
    expect(result.retrieval_plan.mcp_queries.join(' ')).not.toMatch(/YashanDB/i);
  });
});

describe('直写解析器边界', () => {
  test('YAML 标题按优先级决定安全文件名', () => {
    expect(extractYamlTitle()).toBe('');
    expect(extractYamlTitle('普通提示词')).toBe('');
    expect(extractYamlTitle('```yaml\nauthor: tester\n```')).toBe('');
    expect(extractYamlTitle('```yml\n标题：连接说明 # 备注\n```')).toBe('连接说明');
    expect(extractYamlTitle('```yaml\ntitle: "连接说明"\n```')).toBe('连接说明');
    expect(resolveOutputFilename({ prompt: '```yaml\ntitle: "连接说明"\n```', filename: '备用', knowledge_point: { name: '知识点' } })).toBe('连接说明.md');
    expect(resolveOutputFilename({ filename: 'folder/name.markdown' })).toBe('folder_name.md');
    expect(resolveOutputFilename({ knowledge_point: { name: '知识点' } })).toBe('知识点.md');
    expect(resolveOutputFilename()).toBe('document.md');
    expect(sanitizeFilenameBase(' \t ')).toBe('document');
    expect(sanitizeFilenameBase()).toBe('document');
    expect(sanitizeFilenameBase('A\\B:C*D?E"F<G>H|I`J.md')).toBe('A_B_C_D_E_F_G_H_I_J');
  });

  test('去重、知识点序号和描述不引入空关键词', () => {
    expect(unique()).toEqual([]);
    expect(unique([' A ', 'A', '', 42])).toEqual(['A', '42']);
    expect(extractKeywordsFromKnowledgePoint({})).toEqual([]);
    expect(extractKeywordsFromKnowledgePoint({ name: '1.2.3 连接 → 认证', description: '`权限`、连接' })).toEqual(['连接', '认证', '权限']);
  });

  test('引号、转义、括号和自定义分隔符保持短语', () => {
    expect(smartSplit('"Alpha,Beta"、\'Gamma Delta\'、`Theta,Iota`')).toEqual(['"Alpha,Beta"', "'Gamma Delta'", '`Theta,Iota`']);
    expect(smartSplit('"Alpha\' Beta"、Gamma')).toEqual(['"Alpha\' Beta"', 'Gamma']);
    expect(smartSplit('Alpha\\"Beta、Gamma')).toEqual(['Alpha\\"Beta', 'Gamma']);
    expect(smartSplit('Func([x,y],{a,b})、尾部）')).toEqual(['Func([x,y],{a,b})', '尾部）']);
    expect(smartSplit('A、Beta、x')).toEqual(['Beta']);
    expect(smartSplit('')).toEqual([]);
    expect(smartSplit('Alpha||Beta', /\|+/)).toEqual(['Alpha', 'Beta']);
  });

  test('在知识点信息前注入关键词及当前日期；其他位置追加', () => {
    const date = new Date().toISOString().split('T')[0];
    const beforeSection = standardizePrompt('前言\n## 知识点信息\n正文', { name: '连接 认证' });
    expect(beforeSection).toContain(`关键词：连接、认证\n\n## 当前日期\n${date}`);
    expect(beforeSection.indexOf('## 关键词')).toBeLessThan(beforeSection.indexOf('## 知识点信息'));
    const appended = standardizePrompt('生成说明', { name: '连接' });
    expect(appended).toContain(`生成说明\n\n## 关键词\n关键词：连接\n\n## 当前日期\n${date}`);
  });

  test('已有关键词只补日期；已有日期保持原文；无关键词仍补日期', () => {
    const date = new Date().toISOString().split('T')[0];
    for (const keyword of ['关键词：连接', '关键词:连接']) {
      expect(standardizePrompt(keyword, { name: '其他' })).toBe(`${keyword}\n\n## 当前日期\n${date}\n`);
      const complete = `${keyword}\n当前日期：固定日期`;
      expect(standardizePrompt(complete, { name: '其他' })).toBe(complete);
    }
    expect(standardizePrompt('正文', {})).toBe(`正文\n\n## 当前日期\n${date}\n`);
  });

  test('参考路径去重并保留配置、来源和预检脚本', async () => {
    const result = await extractDirectReferences('参考 ../skills/guide.md templates/base.md config/rules.md references/oracle-kb/install.md ../scripts/pre-check-references.sh scripts/pre-check-references.sh', '../skills/guide.md', {});
    expect(result.referenceFiles).toEqual([
      'knowledge/skills/guide.md', 'knowledge/templates/base.md', 'config/rules.md',
      'references/oracle-kb/install.md', 'scripts/pre-check-references.sh'
    ]);
    const empty = await extractDirectReferences('没有引用文件', null, {});
    expect(empty.referenceFiles).toEqual([]);
  });
});
