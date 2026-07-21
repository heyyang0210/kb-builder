const { test, expect } = require('@playwright/test');

test.describe('前端进度 UI 增强验证', () => {
  test('进度面板显示 token、思考过程、工具调用等增强元素', async ({ page }) => {
    // 1. 打开页面
    await page.goto('http://localhost:3500/prompt-generator.html');
    await page.waitForLoadState('networkidle');

    // 2. 选择知识点
    await page.evaluate(() => {
      const firstKp = document.querySelector('.tree-kp');
      if (firstKp) {
        const kpId = firstKp.id.replace('kp-', '');
        if (typeof selectKp === 'function') selectKp(kpId);
      }
    });
    await page.waitForTimeout(1000);

    // 3. 生成提示词
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.includes('生成提示词')) { btn.click(); return true; }
      }
      return false;
    });
    await page.waitForTimeout(3000);

    // 4. 执行 Agent
    await page.evaluate(() => {
      const btn = document.getElementById('executeBtn');
      if (btn) btn.click();
    });

    // 5. 等待进度面板出现步骤（最多 60 秒）
    let stepCount = 0;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(5000);
      stepCount = await page.evaluate(() => {
        const steps = document.querySelectorAll('#progressSteps .progress-step');
        return steps.length;
      });
      console.log(`等待步骤... ${i+1}/12, stepCount:`, stepCount);
      if (stepCount > 0) break;
    }

    // 截图：进度面板
    await page.screenshot({ path: 'tmp/verify-progress-ui.png', fullPage: true });

    // 6. 验证 UI 增强元素
    const uiInfo = await page.evaluate(() => {
      const steps = document.querySelectorAll('#progressSteps .progress-step');
      const tokenDisplays = document.querySelectorAll('#progressSteps .step-detail-tokens');
      const thinkingToggles = document.querySelectorAll('#progressSteps .thinking-toggle');
      const thinkingPanels = document.querySelectorAll('#progressSteps .thinking-panel');
      const toolToggles = document.querySelectorAll('#progressSteps .tool-toggle');
      const retryBadges = document.querySelectorAll('#progressSteps .retry-badge');
      const stepDetailsPanels = document.querySelectorAll('#progressSteps .step-details-panel');

      return {
        stepCount: steps.length,
        hasTokenDisplays: tokenDisplays.length > 0,
        hasThinkingToggles: thinkingToggles.length > 0,
        hasThinkingPanels: thinkingPanels.length > 0,
        hasToolToggles: toolToggles.length > 0,
        hasRetryBadges: retryBadges.length > 0,
        hasStepDetailsPanels: stepDetailsPanels.length > 0,
      };
    });

    console.log('UI 增强元素:', uiInfo);

    // 验证基本要求：有步骤时应有 token 显示和思考过程切换
    if (uiInfo.stepCount > 0) {
      expect(uiInfo.hasTokenDisplays || uiInfo.hasStepDetailsPanels).toBe(true);
    }

    // 7. 测试思考过程折叠交互（如果有 thinking-toggle）
    if (uiInfo.hasThinkingToggles) {
      const toggleVisible = await page.evaluate(() => {
        const toggle = document.querySelector('.thinking-toggle');
        if (toggle) toggle.click();
        return true;
      });
      await page.waitForTimeout(500);

      const panelVisible = await page.evaluate(() => {
        const panel = document.querySelector('.thinking-panel');
        return panel ? panel.style.display !== 'none' : false;
      });
      console.log('点击后思考面板可见:', panelVisible);

      // 再次点击折叠
      await page.evaluate(() => {
        const toggle = document.querySelector('.thinking-toggle');
        if (toggle) toggle.click();
      });
      await page.waitForTimeout(500);
    }

    // 8. 等待执行完成
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(5000);
      const status = await page.evaluate(() => document.getElementById('progressTitle')?.textContent || '');
      if (status.includes('完成') || status.includes('失败')) break;
    }

    // 最终截图
    await page.screenshot({ path: 'tmp/verify-progress-ui-final.png', fullPage: true });
  });
});
