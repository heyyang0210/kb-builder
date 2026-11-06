const { writeDirectExecutionLog } = require('../../../packages/agent-runner-core/lib/direct-generate/execution-log');

describe('直写执行日志', () => {
  test('写入完整执行事实并清理日志文件名', async () => {
    const write = jest.fn().mockResolvedValue({ path: 'saved' });
    const tm = { getTool: jest.fn().mockReturnValue({ write }) };
    const task = { task_id: 'task/中文:42' };
    const result = await writeDirectExecutionLog(tm, task, {
      status: 'completed',
      knowledgePoint: '索引维护',
      outputFile: 'docs/index.md',
      template: '运维模板',
      mcpQueryCount: 2,
      referenceFileCount: 2,
      referenceFiles: ['a.md', 'b.md'],
    });

    expect(result).toEqual({ path: 'saved' });
    expect(tm.getTool).toHaveBeenCalledWith('file_writer');
    expect(write).toHaveBeenCalledWith(
      '../logs/task____42.md',
      expect.stringContaining('- 任务ID: task/中文:42'),
      { overwrite: true },
    );
    const content = write.mock.calls[0][1];
    expect(content).toContain('- 知识点: 索引维护');
    expect(content).toContain('- MCP 查询数: 2');
    expect(content).toContain('- 参考文件数: 2');
    expect(content).toContain('- a.md\n- b.md');
    expect(content).toMatch(/- 生成时间: \d{4}-\d{2}-\d{2}T/);
  });

  test('缺省字段使用可读回退并写出空参考列表', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    await writeDirectExecutionLog({ getTool: () => ({ write }) }, { task_id: 'task-1' }, { status: 'failed' });

    expect(write).toHaveBeenCalledWith('../logs/task-1.md', expect.any(String), { overwrite: true });
    const content = write.mock.calls[0][1];
    expect(content).toContain('- 知识点: N/A');
    expect(content).toContain('- 输出文件: N/A');
    expect(content).toContain('- 模板: N/A');
    expect(content).toContain('- MCP 查询数: 0');
    expect(content).toContain('- 参考文件数: 0');
    expect(content).toContain('## 参考文件\n\n- 无');
  });
});
