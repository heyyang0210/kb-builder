/**
 * YAML 元数据处理器
 * 
 * 完整的处理流水线：提取 → 验证 → 修复 → 格式化
 */

const logger = require('../logger');

class YamlMetadataProcessor {
  constructor(options = {}) {
    this.requiredFields = options.requiredFields || [
      '知识库ID', '标题', '分类', '适用版本', '最后更新', '资料来源追溯'
    ];
  }

  /**
   * 处理 YAML 元数据（主入口）
   */
  process(content) {
    if (!content || typeof content !== 'string') {
      return { content, fixed: false, error: 'Invalid content' };
    }

    // 检查是否有 YAML 块
    if (!content.startsWith('```yaml')) {
      return { content, fixed: false, error: 'No YAML block found' };
    }

    let result = content;
    let fixed = false;

    // 1. 修复 premature close（中间多余的 ```）
    const prematureFixed = this.fixPrematureClose(result);
    if (prematureFixed !== result) {
      result = prematureFixed;
      fixed = true;
      logger.info('[yaml-processor] Fixed premature close');
    }

    // 2. 修复 missing close（缺少结束标记）
    const missingFixed = this.fixMissingClose(result);
    if (missingFixed !== result) {
      result = missingFixed;
      fixed = true;
      logger.info('[yaml-processor] Fixed missing close');
    }

    // 3. 提取 YAML 内容
    const extracted = this.extractYaml(result);
    if (!extracted) {
      return { content: result, fixed, error: 'Failed to extract YAML' };
    }

    // 4. 验证并修复必填字段
    const validation = this.validate(extracted.yaml);
    if (!validation.valid) {
      const fieldFixed = this.fixMissingFields(result, extracted, validation.issues);
      if (fieldFixed !== result) {
        result = fieldFixed;
        fixed = true;
        logger.info('[yaml-processor] Fixed missing fields');
      }
    }

    // 5. 重新提取最终的 YAML
    const finalExtracted = this.extractYaml(result);
    const metadata = finalExtracted ? this.format(finalExtracted.yaml) : {};

    logger.info('[yaml-processor] Processing completed', {
      fixed,
      fields: Object.keys(metadata).length
    });

    return {
      content: result,
      fixed,
      metadata,
      validation
    };
  }

  /**
   * 修复 premature close（中间多余的 ```）
   */
  fixPrematureClose(content) {
    // 找到 ```yaml 开始
    const startMatch = content.match(/^```yaml\s*\n/);
    if (!startMatch) return content;

    const startIdx = startMatch.index + startMatch[0].length;
    const afterStart = content.substring(startIdx);

    // 找到 --- 分隔线
    const separatorMatch = afterStart.match(/\n---\s*\n/);
    if (!separatorMatch) return content;

    const beforeSeparator = afterStart.substring(0, separatorMatch.index);

    // 查找所有 ``` 标记
    const codeBlockMatches = [...beforeSeparator.matchAll(/\n```\s*\n/g)];

    if (codeBlockMatches.length === 0) {
      // 没有 ``` 标记，不需要修复
      return content;
    }

    // 检查最后一个 ``` 是否在末尾
    const lastMatch = codeBlockMatches[codeBlockMatches.length - 1];
    const isAtEnd = lastMatch.index + lastMatch[0].length === beforeSeparator.length;

    if (codeBlockMatches.length === 1 && isAtEnd) {
      // 正常情况：一个 ``` 在末尾
      return content;
    }

    // 有 premature close，需要移除
    // 策略：保留最后一个 ```（如果在末尾），移除其他的
    let fixedBefore = beforeSeparator;
    
    // 从后往前处理，避免索引偏移
    for (let i = codeBlockMatches.length - 1; i >= 0; i--) {
      const match = codeBlockMatches[i];
      // 如果是最后一个且在末尾，保留它
      if (i === codeBlockMatches.length - 1 && isAtEnd) {
        continue;
      }
      // 移除这个 premature close（保留换行符）
      fixedBefore = fixedBefore.substring(0, match.index) + '\n' + 
                    fixedBefore.substring(match.index + match[0].length);
    }

    return content.substring(0, startIdx) + fixedBefore + 
           content.substring(startIdx + beforeSeparator.length);
  }

  /**
   * 修复 missing close（缺少结束标记）
   */
  fixMissingClose(content) {
    const startMatch = content.match(/^```yaml\s*\n/);
    if (!startMatch) return content;

    const startIdx = startMatch.index + startMatch[0].length;
    const afterStart = content.substring(startIdx);

    // 找到 --- 分隔线
    const separatorMatch = afterStart.match(/\n---\s*\n/);
    if (!separatorMatch) return content;

    const beforeSeparator = afterStart.substring(0, separatorMatch.index);

    // 检查末尾是否有 ```
    if (beforeSeparator.match(/\n```\s*$/)) {
      // 已有结束标记
      return content;
    }

    // 在 --- 前插入 ```
    const insertIdx = startIdx + separatorMatch.index;
    return content.substring(0, insertIdx) + '\n```' + content.substring(insertIdx);
  }

  /**
   * 提取 YAML 内容
   */
  extractYaml(content) {
    const startMatch = content.match(/^```yaml\s*\n/);
    if (!startMatch) return null;

    const startIdx = startMatch.index + startMatch[0].length;
    const afterStart = content.substring(startIdx);

    // 找到 ``` 结束标记
    const endMatch = afterStart.match(/\n```\s*\n/);
    if (!endMatch) return null;

    const yamlContent = afterStart.substring(0, endMatch.index).trim();

    return {
      yaml: yamlContent,
      startIdx,
      endIdx: startIdx + endMatch.index
    };
  }

  /**
   * 验证 YAML 内容
   */
  validate(yamlContent) {
    const issues = [];

    // 检查必填字段
    for (const field of this.requiredFields) {
      if (!yamlContent.includes(field + ':')) {
        issues.push({ type: 'missing_field', field });
      }
    }

    // 检查日期格式
    const dateMatch = yamlContent.match(/最后更新:\s*(.+)/);
    if (dateMatch) {
      const dateStr = dateMatch[1].trim();
      if (!this.isValidDate(dateStr)) {
        issues.push({ type: 'invalid_date', value: dateStr });
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * 修复缺失的字段
   */
  fixMissingFields(content, extracted, issues) {
    let yamlContent = extracted.yaml;

    for (const issue of issues) {
      if (issue.type === 'missing_field') {
        let newValue = '待补充';
        if (issue.field === '最后更新') {
          newValue = new Date().toISOString().split('T')[0];
        } else if (issue.field === '适用版本') {
          newValue = '23.4.100 及后续版本';
        } else if (issue.field === '资料来源追溯') {
          yamlContent += '\n资料来源追溯:';
          yamlContent += '\n  主要来源：待补充';
          yamlContent += '\n  引用文档数量：0';
          yamlContent += '\n  关键引用:';
          yamlContent += '\n    - 暂无';
          continue;
        }
        yamlContent += `\n${issue.field}: ${newValue}`;
      } else if (issue.type === 'invalid_date') {
        yamlContent = yamlContent.replace(
          /最后更新:\s*.+/,
          `最后更新: ${new Date().toISOString().split('T')[0]}`
        );
      }
    }

    // 重建内容
    return content.substring(0, extracted.startIdx) + yamlContent + 
           content.substring(extracted.endIdx);
  }

  /**
   * 格式化 YAML（简单解析）
   */
  format(yamlContent) {
    const result = {};
    const lines = yamlContent.split('\n');

    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        result[match[1].trim()] = match[2].trim();
      }
    }

    return result;
  }

  /**
   * 检查日期是否有效
   */
  isValidDate(dateStr) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      return false;
    }
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
  }
}

module.exports = YamlMetadataProcessor;
