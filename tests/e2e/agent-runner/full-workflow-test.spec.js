const { test, expect } = require('@playwright/test');

test.describe('完整工作流测试 - DDL数据类型映射', () => {
  test('从知识点选择到文档生成的完整流程', async ({ page }) => {
    const issues = [];
    
    // 1. 打开前端页面
    await page.goto('http://localhost:3500/prompt-generator.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tmp/01-page-loaded.png' });
    
    // 2. 检查页面标题
    const title = await page.title();
    console.log('页面标题:', title);
    
    // 3. 检查中文显示是否正常
    const headerText = await page.locator('.header h1').textContent().catch(() => '');
    console.log('标题文本:', headerText);
    if (headerText.includes('知识库文档生成器')) {
      console.log('✓ 中文显示正常');
    } else {
      issues.push('页面中文显示异常');
    }
    
    // 4. 检查左侧导航栏
    const navData = await page.evaluate(() => {
      return {
        uploadedOutlinesCount: typeof uploadedOutlines !== 'undefined' ? uploadedOutlines.length : 0,
        treeData: typeof OUTLINE !== 'undefined' ? OUTLINE.length : 0,
        hasSelectKpFunction: typeof selectKp === 'function'
      };
    });
    console.log('导航数据:', navData);
    
    if (navData.uploadedOutlinesCount === 0) {
      issues.push('没有上传的大纲数据');
    }
    
    // 5. 通过 JavaScript 选择知识点
    const kpSelected = await page.evaluate(() => {
      const firstKp = document.querySelector('.tree-kp');
      if (firstKp) {
        const kpId = firstKp.id.replace('kp-', '');
        if (typeof selectKp === 'function') {
          selectKp(kpId);
          return { success: true, kpId };
        }
      }
      return { success: false };
    });
    console.log('知识点选择:', kpSelected);
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tmp/03-kp-selected.png' });
    
    // 6. 检查知识点信息是否填充
    const kpInfo = await page.evaluate(() => {
      return {
        name: document.getElementById('kpName')?.value || '',
        desc: document.getElementById('kpDesc')?.value || '',
        id: document.getElementById('kpId')?.value || ''
      };
    });
    console.log('知识点信息:', kpInfo);
    
    if (!kpInfo.name || kpInfo.name.length === 0) {
      issues.push('知识点名称未填充到表单');
    }
    
    // 7. 滚动到按钮区域并点击"生成提示词"
    const promptGenerated = await page.evaluate(() => {
      const btnGroup = document.querySelector('.btn-group');
      if (btnGroup) {
        btnGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.includes('生成提示词')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    console.log('提示词生成按钮点击:', promptGenerated);
    
    if (!promptGenerated) {
      issues.push('未找到"生成提示词"按钮');
    }
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tmp/04-prompt-generated.png' });
    
    // 8. 检查提示词是否生成
    const promptInfo = await page.evaluate(() => {
      const markdownPreview = document.getElementById('markdownPreview');
      const previewContent = markdownPreview?.innerHTML || '';
      
      const outputCard = document.getElementById('outputCard');
      const outputCardVisible = !outputCard || outputCard.style.display === '' || outputCard.style.display === 'block';
      
      return {
        previewContent: previewContent,
        previewLength: previewContent.length,
        outputCardVisible: outputCardVisible,
        hasContent: previewContent.length > 100
      };
    });
    console.log('提示词预览长度:', promptInfo.previewLength);
    console.log('输出卡片可见:', promptInfo.outputCardVisible);
    console.log('有内容:', promptInfo.hasContent);
    
    if (!promptInfo.hasContent) {
      issues.push('提示词未生成或内容不足');
    }
    
    // 9. 检查是否有错误提示
    const hasError = await page.evaluate(() => {
      const toasts = document.querySelectorAll('.toast-error, .toast.show');
      for (const toast of toasts) {
        if (toast.textContent.includes('错误') || toast.textContent.includes('失败')) {
          return true;
        }
      }
      return false;
    });
    console.log('有错误提示:', hasError);
    
    if (hasError) {
      issues.push('生成提示词时出现错误');
    }
    
    // 10. 如果提示词生成成功，尝试执行Agent
    if (promptInfo.hasContent) {
      const executeClicked = await page.evaluate(() => {
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) {
          executeBtn.click();
          return true;
        }
        return false;
      });
      console.log('执行Agent按钮点击:', executeClicked);
      
      if (!executeClicked) {
        issues.push('未找到"执行Agent"按钮');
      }
      
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'tmp/05-agent-executing.png' });
      
      // 11. 检查执行状态 - 使用正确的元素
      const executionStatus = await page.evaluate(() => {
        const progressPanel = document.getElementById('progressPanel');
        const progressTitle = document.getElementById('progressTitle');
        const progressSteps = document.getElementById('progressSteps');
        
        return {
          panelVisible: progressPanel?.style.display !== 'none',
          title: progressTitle?.textContent || '',
          stepsHtml: progressSteps?.innerHTML?.substring(0, 200) || ''
        };
      });
      console.log('执行状态面板:', executionStatus);
      
      // 12. 等待执行完成（最多等待90秒）
      let completed = false;
      for (let i = 0; i < 18; i++) {
        await page.waitForTimeout(5000);
        const currentStatus = await page.evaluate(() => {
          const progressTitle = document.getElementById('progressTitle');
          return progressTitle?.textContent || '';
        });
        console.log(`等待执行... ${i+1}/18, 状态:`, currentStatus);
        
        if (currentStatus && (currentStatus.includes('完成') || currentStatus.includes('失败') || currentStatus.includes('取消'))) {
          completed = true;
          break;
        }
      }
      
      await page.screenshot({ path: 'tmp/06-agent-result.png' });
      
      if (!completed) {
        issues.push('Agent执行超时或未完成');
      }
      
      // 13. 检查生成的文档
      const docInfo = await page.evaluate(() => {
        const docOutput = document.getElementById('documentOutput') || document.querySelector('.document-output');
        return {
          content: docOutput?.value || docOutput?.textContent || '',
          length: (docOutput?.value || docOutput?.textContent || '').length
        };
      });
      console.log('文档长度:', docInfo.length);
      
      if (docInfo.length === 0) {
        issues.push('文档未生成');
      }
    } else {
      issues.push('提示词未生成，跳过Agent执行');
    }
    
    // 14. 检查后端日志
    const backendLog = await page.evaluate(async () => {
      try {
        const resp = await fetch('http://localhost:4100/api/health');
        return await resp.json();
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('后端状态:', backendLog);
    
    // 15. 最终截图
    await page.screenshot({ path: 'tmp/07-final-state.png', fullPage: true });
    
    // 16. 输出问题列表
    console.log('\n=== 发现的问题 ===');
    issues.forEach((issue, idx) => {
      console.log(`${idx + 1}. ${issue}`);
    });
    
    if (issues.length === 0) {
      console.log('✓ 未发现明显问题');
    }
    
    // 保存问题列表到文件
    const fs = require('fs');
    fs.writeFileSync('tmp/issues-found.json', JSON.stringify(issues, null, 2));
    console.log('\n问题列表已保存到 tmp/issues-found.json');
  });
});
