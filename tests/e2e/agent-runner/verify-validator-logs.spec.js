const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('验证器日志增强验证', () => {
  test('执行 Agent 后日志包含增强条目', async ({ page }) => {
    const logFile = path.join(__dirname, '../../logs/backend.log');

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

    // 5. 等待执行完成（最多 120 秒）
    let completed = false;
    for (let i = 0; i < 24; i++) {
      await page.waitForTimeout(5000);
      const status = await page.evaluate(() => document.getElementById('progressTitle')?.textContent || '');
      console.log(`等待执行... ${i+1}/24, 状态:`, status);
      if (status.includes('完成') || status.includes('失败')) {
        completed = true;
        break;
      }
    }

    // 6. 读取日志文件
    await page.waitForTimeout(2000);
    const logContent = fs.readFileSync(logFile, 'utf-8');

    // 7. 验证增强日志条目
    const checks = [
      { pattern: /\[validator\] Raw LLM response: length=/, name: '原始响应记录' },
      { pattern: /\[validator\] Parse path:/, name: '解析路径' },
      { pattern: /\[validator\] Check:.*(?:PASS|FAIL)/, name: '检查详情 PASS/FAIL' },
      { pattern: /\[validator\] Report summary: score=/, name: '报告摘要' },
      { pattern: /\[validator\] Validation criteria:/, name: '验证标准' },
    ];

    let passedCount = 0;
    for (const check of checks) {
      const found = check.pattern.test(logContent);
      console.log(`${found ? '✅' : '❌'} ${check.name}: ${found ? '找到' : '未找到'}`);
      if (found) passedCount++;
    }

    console.log(`\n验证通过: ${passedCount}/${checks.length}`);
    expect(passedCount).toBeGreaterThanOrEqual(4);
  });
});
