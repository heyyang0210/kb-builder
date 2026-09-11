const path = require('path');

async function writeDirectExecutionLog(tm, task, data) {
  const writer = tm.getTool('file_writer');
  const safeTaskId = task.task_id.replace(/[^\w-]/g, '_');
  const logPath = path.join('../logs', `${safeTaskId}.md`);
  const logContent = `# Agent 执行日志

- 任务ID: ${task.task_id}
- 状态: ${data.status}
- 知识点: ${data.knowledgePoint || 'N/A'}
- 输出文件: ${data.outputFile || 'N/A'}
- 模板: ${data.template || 'N/A'}
- MCP 查询数: ${data.mcpQueryCount || 0}
- 参考文件数: ${data.referenceFileCount || 0}
- 生成时间: ${new Date().toISOString()}

## 参考文件

${(data.referenceFiles || []).map(file => `- ${file}`).join('\n') || '- 无'}
`;
  return writer.write(logPath, logContent, { overwrite: true });
}

module.exports = {
  writeDirectExecutionLog
};
