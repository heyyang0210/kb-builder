/**
 * Prompt Generator Library
 * Shared between frontend and backend for generating prompts
 */

const TYPE_RULES = [
  { type: "兼容性差异", keywords: ["兼容", "差异", "迁移", "对比oracle", "对比mysql", "oracle写法", "迁移到", "改写", "不支持"] },
  { type: "实战调优", keywords: ["调优", "优化", "性能", "诊断", "等待事件", "awr", "慢sql", "瓶颈", "排查"] },
  { type: "架构对比", keywords: ["架构", "集群", "高可用", "容灾", "部署", "拓扑", "方案选型", "rac"] },
  { type: "运维SOP", keywords: ["sop", "操作", "流程", "步骤", "巡检", "备份", "恢复", "启停", "日常维护", "应急预案"] },
  { type: "SQL/开发参考", keywords: ["sql", "函数", "存储过程", "触发器", "游标", "pl/sql", "语法", "包", "动态sql", "开发"] },
  { type: "理论机制", keywords: ["原理", "机制", "实现", "内部", "结构", "算法", "模型", "设计"] },
];

function detectType(name, desc) {
  const text = (name + " " + desc).toLowerCase();
  for (const rule of TYPE_RULES) {
    if (rule.keywords.some(kw => text.includes(kw.toLowerCase()))) return rule.type;
  }
  return "通用基础";
}

function getSkillFile(type) {
  const map = {
    "通用基础": "../skills/00-通用生成-skill.md",
    "理论机制": "../skills/01-理论机制-skill.md",
    "实战调优": "../skills/02-实战调优-skill.md",
    "架构对比": "../skills/03-架构对比-skill.md",
    "运维SOP": "../skills/04-运维SOP-skill.md",
    "SQL/开发参考": "../skills/05-SQL开发参考-skill.md",
    "兼容性差异": "../skills/06-兼容性差异-skill.md"
  };
  return map[type] || map["通用基础"];
}

function getTemplateFile(type) {
  const map = {
    "通用基础": "../templates/01-通用基础模板.md",
    "理论机制": "../templates/02-理论机制类模板.md",
    "实战调优": "../templates/03-实战调优类模板.md",
    "架构对比": "../templates/04-架构对比类模板.md",
    "运维SOP": "../templates/05-运维SOP类模板.md",
    "SQL/开发参考": "../templates/06-SQL开发参考类模板.md",
    "兼容性差异": "../templates/07-兼容性差异类模板.md"
  };
  return map[type] || map["通用基础"];
}

function getOutputPath(data) {
  // 数据库基础
  if (data.part && data.part.startsWith("第")) {
    const partMap = {
      "第一部分": "01-基础入门",
      "第二部分": "02-核心原理",
      "第三部分": "03-数据库管理",
      "第四部分": "04-SQL编程",
      "第五部分": "05-性能优化",
      "第六部分": "06-高可用与集群",
      "第七部分": "07-内核与高级专题",
      "第八部分": "08-架构设计与实践"
    };
    for (const [key, value] of Object.entries(partMap)) {
      if (data.part.startsWith(key)) {
        return `../output/数据库基础/${value}/`;
      }
    }
  }

  // 业务领域
  if (data.part) {
    const domainMap = {
      "兼容性领域": {
        dir: "兼容性领域",
        chapters: {
          "DDL": "01-DDL兼容性",
          "DML": "02-DML兼容性",
          "查询": "03-查询兼容性",
          "函数": "04-函数与操作符兼容性",
          "过程化": "05-过程化语言兼容性",
          "工具": "06-工具与接口兼容性"
        }
      },
      "性能调优": { dir: "性能调优", chapters: {} },
      "高可用和备份恢复": { dir: "高可用和备份恢复", chapters: {} },
      "共享集群": { dir: "共享集群", chapters: {} }
    };

    for (const [domainKey, domainVal] of Object.entries(domainMap)) {
      if (data.part.includes(domainKey)) {
        let chapterDir = "";
        for (const [chKey, chVal] of Object.entries(domainVal.chapters)) {
          if (data.chapter && data.chapter.includes(chKey)) {
            chapterDir = chVal;
            break;
          }
        }
        return `../output/业务领域/${domainVal.dir}/${chapterDir}/`;
      }
    }
  }

  // 上传的大纲
  if (data.part && (data.part.includes("、") || data.part.match(/^\d/))) {
    return `../output/上传大纲/${data.part.replace(/[^\w\u4e00-\u9fa5]/g, '_')}/`;
  }

  return "../output/通用/";
}

function assemblePrompt(data) {
  const json = {
    name: data.name,
    part: data.part,
    chapter: data.chapter,
    description: data.desc,
    type: data.type,
    target_db: data.targetDb || undefined,
    references: {},
    output_path: getOutputPath(data)
  };

  if (data.refMcp) json.references.mcp_query = data.refMcp;
  if (data.refDesign) json.references.design_doc = data.refDesign;
  if (data.refOracle) json.references.oracle_ref = data.refOracle;
  if (data.refTest) json.references.test_cases = data.refTest;
  if (Object.keys(json.references).length === 0) delete json.references;
  Object.keys(json).forEach(k => json[k] === undefined && delete json[k]);

  const skillFile = getSkillFile(data.type);
  const templateFile = getTemplateFile(data.type);

  const prompt = `# YashanDB 知识文档生成任务

## 前置检查
在开始生成前，请先运行：
\`\`\`bash
bash scripts/pre-check-references.sh
\`\`\`
确认所有必须检查项通过。

## 资料引用策略
按以下优先级引用参考资料：
1. YashanDB 知识库 MCP（实时查询）
2. 特性设计文档（references/design-docs/）
3. Oracle知识库（references/oracle-kb/）
   - **重要**：先阅读 \`references/oracle-kb/README.md\` 获取完整文档索引
   - 根据索引找到与当前知识点相关的 Oracle 文档进行引用
4. 测试用例（references/test-cases/）
5. 源码（references/source/）

## 知识点信息
\`\`\`json
${JSON.stringify(json, null, 2)}
\`\`\`

## 执行要求
1. 使用 Skill：\`${skillFile}\`
2. 使用模板：\`${templateFile}\`
3. 遵守 \`config/全局格式规范.md\`
4. 按 \`config/质量验证标准.md\` 进行自检
5. 输出保存到 \`${getOutputPath(data)}\`
6. 在 \`logs/\` 记录生成日志

## 输出格式要求
- 包含 YAML 元数据头（知识库ID、标题、分类、版本等）
- 按模板结构填写所有必选章节
- 包含可执行的 SQL 示例（建表、操作、验证、清理）
- 包含 Mermaid 图表（架构图、流程图）
- 包含填写检查清单
- 不出现客户名称和特定业务表名`;

  return { prompt, skillFile, templateFile, json };
}

module.exports = {
  detectType,
  getSkillFile,
  getTemplateFile,
  getOutputPath,
  assemblePrompt,
  TYPE_RULES
};
