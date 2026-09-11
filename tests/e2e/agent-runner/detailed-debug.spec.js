const { test } = require('@playwright/test');

test('详细调试提示词生成', async ({ page }) => {
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
  
  // 检查所有表单字段
  const formFields = await page.evaluate(() => {
    return {
      kpName: document.getElementById('kpName')?.value || 'NOT FOUND',
      kpPart: document.getElementById('kpPart')?.value || 'NOT FOUND',
      kpChapter: document.getElementById('kpChapter')?.value || 'NOT FOUND',
      kpDesc: document.getElementById('kpDesc')?.value || 'NOT FOUND',
      kpType: document.getElementById('kpType')?.value || 'NOT FOUND',
      kpTargetDb: document.getElementById('kpTargetDb')?.value || 'NOT FOUND',
      outputCard: document.getElementById('outputCard') ? 'EXISTS' : 'NOT FOUND',
      outputCardDisplay: document.getElementById('outputCard')?.style.display || 'NOT SET'
    };
  });
  console.log('表单字段状态:', formFields);
  
  // 手动调用 generatePrompt
  const genResult = await page.evaluate(() => {
    try {
      const name = document.getElementById('kpName').value.trim();
      console.log('kpName value:', name);
      
      if (!name) {
        return { error: 'kpName is empty' };
      }
      
      const data = {
        name: name,
        part: document.getElementById('kpPart').value,
        chapter: document.getElementById('kpChapter').value,
        desc: document.getElementById('kpDesc').value.trim(),
        type: document.getElementById('kpType').value,
        targetDb: document.getElementById('kpTargetDb').value,
        refMcp: '',
        refDesign: '',
        refOracle: '',
        refTest: ''
      };
      
      console.log('Calling assemblePrompt with data:', data);
      
      if (typeof assemblePrompt !== 'function') {
        return { error: 'assemblePrompt function not found' };
      }
      
      const result = assemblePrompt(data);
      console.log('assemblePrompt result:', result);
      
      const outputCard = document.getElementById('outputCard');
      outputCard.style.display = '';
      
      const markdownPreview = document.getElementById('markdownPreview');
      if (typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true, headerIds: true });
        markdownPreview.innerHTML = marked.parse(result.prompt);
      } else {
        markdownPreview.textContent = result.prompt;
      }
      
      window._currentPromptMarkdown = result.prompt;
      
      return {
        success: true,
        outputCardDisplay: outputCard.style.display,
        previewLength: markdownPreview.innerHTML.length,
        promptLength: result.prompt.length
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  });
  console.log('生成结果:', genResult);
  
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tmp/detailed-debug.png', fullPage: true });
});
