const { test, expect } = require('@playwright/test');

test.describe('工作流模式验证', () => {
  test('前端显示 3 种工作流模式', async ({ page }) => {
    // 1. 打开页面
    await page.goto('http://localhost:3500/prompt-generator.html');
    await page.waitForLoadState('networkidle');

    // 2. 验证 WorkflowSelector 加载
    await page.waitForTimeout(2000);

    // 3. 检查下拉选项
    const options = await page.evaluate(() => {
      const select = document.getElementById('workflowSelect');
      if (!select) return { error: 'workflowSelect not found' };
      
      const opts = Array.from(select.options).map(opt => ({
        value: opt.value,
        text: opt.textContent
      }));
      
      return {
        count: opts.length,
        options: opts,
        hasFast: opts.some(o => o.value === 'fast'),
        hasStandard: opts.some(o => o.value === 'standard'),
        hasDeep: opts.some(o => o.value === 'deep')
      };
    });

    console.log('工作流选项:', options);

    // 验证 3 种模式都存在
    expect(options.count).toBe(3);
    expect(options.hasFast).toBe(true);
    expect(options.hasStandard).toBe(true);
    expect(options.hasDeep).toBe(true);

    // 4. 验证默认选择标准模式
    const selectedValue = await page.evaluate(() => {
      const select = document.getElementById('workflowSelect');
      return select?.value;
    });
    console.log('默认选择:', selectedValue);
    expect(selectedValue).toBe('standard');

    // 5. 切换到快速模式并验证步骤预览
    await page.evaluate(() => {
      const select = document.getElementById('workflowSelect');
      if (select) {
        select.value = 'fast';
        select.dispatchEvent(new Event('change'));
      }
    });
    await page.waitForTimeout(500);

    const fastSteps = await page.evaluate(() => {
      const stepsDiv = document.getElementById('workflowSteps');
      return stepsDiv?.innerHTML || '';
    });
    console.log('快速模式步骤预览:', fastSteps.substring(0, 200));
    expect(fastSteps).toContain('planner_retriever');

    // 6. 切换到深度模式并验证步骤预览
    await page.evaluate(() => {
      const select = document.getElementById('workflowSelect');
      if (select) {
        select.value = 'deep';
        select.dispatchEvent(new Event('change'));
      }
    });
    await page.waitForTimeout(500);

    const deepSteps = await page.evaluate(() => {
      const stepsDiv = document.getElementById('workflowSteps');
      return stepsDiv?.innerHTML || '';
    });
    console.log('深度模式步骤预览:', deepSteps.substring(0, 200));
    expect(deepSteps).toContain('validator');

    // 截图
    await page.screenshot({ path: 'tmp/verify-workflow-modes.png' });
  });

  test('后端 API 接收工作流配置', async ({ request }) => {
    // 验证执行 API 能接收 workflow_config
    const resp = await request.post('http://localhost:4100/api/agent/execute', {
      data: {
        knowledge_point: { name: '测试知识点', id: 'test-1' },
        prompt: '测试提示词',
        workflow_config: {
          steps: [
            { name: 'planner_retriever', agent: 'planner', config: { mode: 'merged' } },
            { name: 'generator', agent: 'generator', config: {} },
            { name: 'validator', agent: 'validator', config: { maxRetries: 5 } }
          ]
        }
      }
    });

    const result = await resp.json();
    console.log('执行响应:', result);
    
    // 应该返回 task_id（即使执行失败）
    expect(result.success || result.task_id).toBeTruthy();
  });
});
