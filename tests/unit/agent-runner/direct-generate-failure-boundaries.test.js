const path = require('path');

jest.mock('../../../packages/agent-runner-core/lib/process-store', () => jest.fn().mockImplementation(() => ({
  saveMeta: jest.fn().mockRejectedValue(new Error('元数据存储不可用')),
})));

const ProcessStore = require('../../../packages/agent-runner-core/lib/process-store');
const { createDirectTask } = require('../../../packages/agent-runner-core/lib/direct-generate/task-store');
const { executeDirectGenerate } = require('../../../packages/agent-runner-core/lib/direct-generate/direct-task-runner');

describe('直写生成失败边界', () => {
  test('元数据写入失败时任务进入 failed 且返回失败状态', async () => {
    const task = createDirectTask({ prompt: '生成测试文档', knowledge_point: { name: '边界测试' } });
    const result = await executeDirectGenerate({
      body: {
        mode: 'direct_generate',
        prompt: '生成测试文档',
        knowledge_point: { name: '边界测试' },
        output_path: path.join('/tmp', 'direct-generate-boundary'),
      },
    }, task);

    expect(ProcessStore).toHaveBeenCalledWith(task.task_id, 'production');
    expect(result).toMatchObject({ task_id: task.task_id, status: 'failed', error: '元数据存储不可用' });
    expect(result.steps.find(step => step.name === 'prepare')).toMatchObject({ status: 'failed', error: '元数据存储不可用' });
  });
});
