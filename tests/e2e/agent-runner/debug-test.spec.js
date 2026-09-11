const { test } = require('@playwright/test');

test('调试提示词生成', async ({ page }) => {
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
  
  // 检查表单字段
  const formData = await page.evaluate(() => {
    return {
      kpName: document.getElementById('kpName')?.value || '',
      kpPart: document.getElementById('kpPart')?.value || '',
      kpChapter: document.getElementById('kpChapter')?.value || '',
      kpDesc: document.getElementById('kpDesc')?.value || '',
      kpType: document.getElementById('kpType')?.value || ''
    };
  });
  console.log('表单数据:', formData);
  
  // 尝试手动调用 generatePrompt
  const result = await page.evaluate(() => {
    try {
      if (typeof generatePrompt === 'function') {
        generatePrompt();
        return { success: true };
      }
      return { success: false, error: 'generatePrompt function not found' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  console.log('generatePrompt 结果:', result);
  
  await page.waitForTimeout(2000);
  
  // 检查输出区域
  const outputInfo = await page.evaluate(() => {
    const outputCard = document.getElementById('outputCard');
    const markdownPreview = document.getElementById('markdownPreview');
    const outputBox = document.getElementById('outputBox');
    const outputTextarea = document.getElementById('outputTextarea');
    
    return {
      outputCardDisplay: outputCard?.style.display || 'not found',
      outputCardExists: !!outputCard,
      markdownPreviewContent: markdownPreview?.innerHTML?.substring(0, 100) || '',
      markdownPreviewDisplay: markdownPreview?.style.display || 'not found',
      outputBoxDisplay: outputBox?.style.display || 'not found',
      outputTextareaDisplay: outputTextarea?.style.display || 'not found'
    };
  });
  console.log('输出区域信息:', outputInfo);
  
  // 检查 window._currentPromptMarkdown
  const promptMarkdown = await page.evaluate(() => {
    return window._currentPromptMarkdown || 'not set';
  });
  console.log('当前提示词 Markdown:', promptMarkdown ? promptMarkdown.substring(0, 100) : 'not set');
  
  await page.screenshot({ path: 'tmp/debug-result.png', fullPage: true });
  
  console.log('\n控制台错误总数:', consoleErrors.length);
});
