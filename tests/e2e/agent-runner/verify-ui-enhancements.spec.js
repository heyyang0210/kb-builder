const { test } = require('@playwright/test');

test('验证前端UI增强效果', async ({ page }) => {
  await page.goto('http://localhost:3500/prompt-generator.html');
  await page.waitForLoadState('networkidle');
  
  // 选择知识点
  await page.evaluate(() => {
    const firstKp = document.querySelector('.tree-kp');
    if (firstKp) {
      const kpId = firstKp.id.replace('kp-', '');
      if (typeof selectKp === 'function') selectKp(kpId);
    }
  });
  await page.waitForTimeout(1000);
  
  // 生成提示词
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.includes('生成提示词')) { btn.click(); return true; }
    }
    return false;
  });
  await page.waitForTimeout(3000);
  
  // 执行Agent
  await page.evaluate(() => {
    const btn = document.getElementById('executeBtn');
    if (btn) btn.click();
  });
  
  // 等待进度面板出现
  await page.waitForTimeout(10000);
  
  // 截图1：进度面板
  await page.screenshot({ path: 'tmp/verify-progress-panel.png', fullPage: true });
  
  // 检查进度面板元素
  const progressInfo = await page.evaluate(() => {
    const progressPanel = document.getElementById('progressPanel');
    const progressSteps = document.getElementById('progressSteps');
    const progressTitle = document.getElementById('progressTitle');
    
    const steps = progressSteps?.querySelectorAll('.progress-step') || [];
    const stepDetails = progressSteps?.querySelectorAll('.step-details-panel') || [];
    const thinkingToggles = progressSteps?.querySelectorAll('.thinking-toggle') || [];
    const toolToggles = progressSteps?.querySelectorAll('.tool-toggle') || [];
    const retryBadges = progressSteps?.querySelectorAll('.retry-badge') || [];
    const tokenDisplays = progressSteps?.querySelectorAll('.step-detail-tokens') || [];
    
    return {
      panelVisible: progressPanel?.style.display !== 'none',
      title: progressTitle?.textContent || '',
      stepCount: steps.length,
      hasStepDetails: stepDetails.length > 0,
      hasThinkingToggles: thinkingToggles.length > 0,
      hasToolToggles: toolToggles.length > 0,
      hasRetryBadges: retryBadges.length > 0,
      hasTokenDisplays: tokenDisplays.length > 0,
      stepsHtml: progressSteps?.innerHTML?.substring(0, 500) || ''
    };
  });
  console.log('进度面板状态:', progressInfo);
  
  // 等待执行完成或超时
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(10000);
    const status = await page.evaluate(() => document.getElementById('progressTitle')?.textContent || '');
    console.log(`等待... ${i+1}/6, 状态:`, status);
    if (status.includes('完成') || status.includes('失败')) break;
  }
  
  // 截图2：最终状态
  await page.screenshot({ path: 'tmp/verify-final-state.png', fullPage: true });
  
  console.log('\n=== UI增强验证结果 ===');
  console.log('进度面板可见:', progressInfo.panelVisible);
  console.log('步骤数量:', progressInfo.stepCount);
  console.log('有步骤详情面板:', progressInfo.hasStepDetails);
  console.log('有思考过程切换:', progressInfo.hasThinkingToggles);
  console.log('有工具调用切换:', progressInfo.hasToolToggles);
  console.log('有重试徽章:', progressInfo.hasRetryBadges);
  console.log('有token显示:', progressInfo.hasTokenDisplays);
});
