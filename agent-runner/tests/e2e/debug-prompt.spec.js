const { test } = require('@playwright/test');

test('调试提示词生成问题', async ({ page }) => {
  // 收集控制台错误
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('控制台错误:', msg.text());
    }
  });
  
  await page.goto('http://localhost:3500/prompt-generator.html');
  await page.waitForLoadState('networkidle');
  
  // 选择知识点
  await page.evaluate(() => {
    const firstKp = document.querySelector('.tree-kp');
    if (firstKp) {
      const kpId = firstKp.id.replace('kp-', '');
      if (typeof selectKp === 'function') {
        selectKp(kpId);
      }
    }
  });
  
  await page.waitForTimeout(1000);
  
  // 手动调用 generatePrompt 并捕获异常
  const result = await page.evaluate(() => {
    try {
      console.log('Calling generatePrompt...');
      if (typeof generatePrompt === 'function') {
        generatePrompt();
        console.log('generatePrompt completed');
        
        // 检查 outputCard 状态
        const outputCard = document.getElementById('outputCard');
        console.log('outputCard display:', outputCard?.style.display);
        
        const markdownPreview = document.getElementById('markdownPreview');
        console.log('markdownPreview content length:', markdownPreview?.innerHTML?.length);
        
        return { 
          success: true, 
          outputCardDisplay: outputCard?.style.display,
          previewLength: markdownPreview?.innerHTML?.length || 0
        };
      }
      return { success: false, error: 'generatePrompt function not found' };
    } catch (e) {
      console.error('generatePrompt error:', e);
      return { success: false, error: e.message, stack: e.stack };
    }
  });
  console.log('generatePrompt 结果:', result);
  
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tmp/debug-prompt.png', fullPage: true });
  
  console.log('\n控制台错误总数:', consoleErrors.length);
});
