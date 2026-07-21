const BaseAgent = require('./base-agent');
const logger = require('../logger');

class ValidatorAgent extends BaseAgent {
  constructor(config = {}) {
    super('validator', '验证文档质量', { ...config, temperature: 0.2 });
  }

  getOutputFormat() {
    return 'json';
  }

  validateInput(input) {
    if (!input.document) {
      throw new Error('document is required');
    }
    return true;
  }

  buildPrompt(input, stepConfig) {
    const template = this.loadPromptTemplate('validator.md');
    const criteria = input.validationCriteria || {};

    logger.info(`[validator] Validation criteria:`, {
      required_sections: criteria.required_sections || [],
      sql_verification: criteria.sql_verification || false,
      min_length: criteria.min_length || 0,
      max_length: criteria.max_length || 'unlimited'
    });

    const criteriaInfo = `
## 验证标准

- 必须章节: ${(criteria.required_sections || []).join(', ') || '无特殊要求'}
- SQL 验证: ${criteria.sql_verification ? '是' : '否'}
- 最小长度: ${criteria.min_length || 0} 字
- 最大长度: ${criteria.max_length || '不限'} 字
`;

    const systemPrompt = template || '请验证文档质量并生成验证报告 JSON。';

    return [
      { role: 'system', content: '你是 YashanDB 知识库文档质量审核专家，负责验证文档是否符合质量标准。' },
      { role: 'user', content: `${systemPrompt}\n\n${criteriaInfo}\n## 待验证文档\n\n${input.document}` }
    ];
  }

  parseResponse(response, input) {
    // 3.1 记录原始 LLM 响应
    const rawContent = response.content || '';
    logger.info(`[validator] Raw LLM response: length=${rawContent.length}, has_json_structure=${rawContent.includes('{')}`);
    logger.debug(`[validator] Raw response preview: ${rawContent.substring(0, 500)}`);

    let report;
    let parseSource = 'unknown';

    // 3.2 记录解析路径
    try {
      if (response.parsed && typeof response.parsed === 'object') {
        logger.info('[validator] Parse path: Using pre-parsed JSON from response.parsed');
        report = response.parsed;
        parseSource = 'pre-parsed';
      } else {
        report = JSON.parse(rawContent);
        logger.info('[validator] Parse path: Successfully parsed JSON from response.content');
        parseSource = 'content-parse';
      }
    } catch (err) {
      logger.warn(`[validator] Parse path: JSON parse failed (${err.message}), using basic report`);
      report = this._generateBasicReport(input.document);
      parseSource = 'basic-report';
    }

    // 确保报告包含必要字段
    if (!report || typeof report !== 'object') {
      logger.warn('[validator] Invalid report structure, using basic report');
      report = this._generateBasicReport(input.document);
      parseSource = 'basic-report-fallback';
    }

    // 确保 score 和 passed 存在
    if (report.score === undefined || report.passed === undefined) {
      logger.warn('[validator] Missing score or passed fields, generating basic report');
      report = this._generateBasicReport(input.document);
      parseSource = 'basic-report-missing-fields';
    }

    // 确保最终文档存在
    if (!report.final_document) {
      report.final_document = input.document;
    }

    // 3.3 记录完整报告摘要
    const checksCount = (report.checks || []).length;
    const passedChecks = (report.checks || []).filter(c => c.passed).length;
    const warningsList = (report.warnings || []).join('; ') || 'none';

    logger.info(`[validator] Report summary: score=${report.score}, passed=${report.passed}, parse_source=${parseSource}, checks=${passedChecks}/${checksCount}, warnings=[${warningsList}]`);

    return report;
  }

  _generateBasicReport(document) {
    const checks = [];
    const hasYaml = document.startsWith('---');
    const headings = (document.match(/^#+\s/gm) || []).length;
    const sqlBlocks = (document.match(/```sql/g) || []).length;
    const length = document.length;

    const yamlCheck = {
      name: 'YAML 元数据',
      passed: hasYaml,
      details: hasYaml ? 'YAML 元数据头完整' : '缺少 YAML 元数据头'
    };
    checks.push(yamlCheck);
    logger.info(`[validator] Check: ${yamlCheck.name} - ${yamlCheck.passed ? 'PASS' : 'FAIL'} - ${yamlCheck.details}`);

    const headingCheck = {
      name: '标题结构',
      passed: headings > 0,
      details: `共 ${headings} 个标题`
    };
    checks.push(headingCheck);
    logger.info(`[validator] Check: ${headingCheck.name} - ${headingCheck.passed ? 'PASS' : 'FAIL'} - ${headingCheck.details}`);

    const sqlCheck = {
      name: '代码示例',
      passed: sqlBlocks > 0,
      details: `共 ${sqlBlocks} 个 SQL 代码块`
    };
    checks.push(sqlCheck);
    logger.info(`[validator] Check: ${sqlCheck.name} - ${sqlCheck.passed ? 'PASS' : 'FAIL'} - ${sqlCheck.details}`);

    const lengthCheck = {
      name: '内容长度',
      passed: length > 500,
      details: `文档长度 ${length} 字`
    };
    checks.push(lengthCheck);
    logger.info(`[validator] Check: ${lengthCheck.name} - ${lengthCheck.passed ? 'PASS' : 'FAIL'} - ${lengthCheck.details}`);

    const passedCount = checks.filter(c => c.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);

    return {
      passed: score >= 80,
      score,
      checks,
      warnings: checks.filter(c => !c.passed).map(c => c.details),
      suggestions: [],
      final_document: document
    };
  }
}

module.exports = ValidatorAgent;
