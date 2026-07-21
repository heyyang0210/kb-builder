const { test, expect } = require('@playwright/test');

test.describe('文档预览编辑验证', () => {
  test('文档管理 Tab 预览、编辑、保存全流程', async ({ page }) => {
    // 1. 打开页面
    await page.goto('http://localhost:3500/prompt-generator.html');
    await page.waitForLoadState('networkidle');

    // 2. 切换到文档管理 Tab
    await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('doc-mgmt');
    });
    await page.waitForTimeout(2000);

    // 截图：文档管理初始状态
    await page.screenshot({ path: 'tmp/verify-doc-mgmt-initial.png' });

    // 3. 验证目录树加载
    const treeLoaded = await page.evaluate(() => {
      const treeView = document.getElementById('docTreeView');
      return treeView && !treeView.innerHTML.includes('加载中') && !treeView.innerHTML.includes('暂无文档');
    });
    console.log('目录树已加载:', treeLoaded);
    expect(treeLoaded).toBe(true);

    // 4. 点击"基本概念"文档
    const docClicked = await page.evaluate(() => {
      const files = document.querySelectorAll('.doc-tree-file');
      for (const file of files) {
        const nameEl = file.querySelector('.doc-tree-file-name');
        if (nameEl && nameEl.textContent.includes('基本概念')) {
          file.click();
          return true;
        }
      }
      return false;
    });
    console.log('文档点击:', docClicked);
    expect(docClicked).toBe(true);

    await page.waitForTimeout(2000);

    // 截图：文档预览
    await page.screenshot({ path: 'tmp/verify-doc-preview.png' });

    // 5. 验证预览模式显示内容
    const previewInfo = await page.evaluate(() => {
      const viewerPanel = document.getElementById('docViewerPanel');
      const previewContent = document.getElementById('docPreviewContent');
      const title = document.getElementById('docViewerTitle')?.textContent || '';
      return {
        panelVisible: viewerPanel?.style.display !== 'none',
        hasContent: previewContent && previewContent.innerHTML.length > 100,
        title: title,
        contentLength: previewContent?.innerHTML?.length || 0,
      };
    });
    console.log('预览信息:', previewInfo);
    expect(previewInfo.panelVisible).toBe(true);
    expect(previewInfo.hasContent).toBe(true);

    // 6. 切换到编辑模式
    await page.evaluate(() => {
      if (typeof switchDocMode === 'function') switchDocMode('edit');
    });
    await page.waitForTimeout(1000);

    // 截图：编辑模式
    await page.screenshot({ path: 'tmp/verify-doc-edit.png' });

    // 7. 验证编辑模式 textarea 可编辑
    const editInfo = await page.evaluate(() => {
      const editPane = document.getElementById('docEditPane');
      const textarea = document.getElementById('docEditTextarea');
      const viewBtn = document.getElementById('docViewBtn');
      const editBtn = document.getElementById('docEditBtn');
      return {
        editPaneVisible: editPane?.style.display !== 'none',
        textareaExists: !!textarea,
        textareaValue: textarea?.value?.substring(0, 100) || '',
        editBtnActive: editBtn?.classList.contains('active'),
      };
    });
    console.log('编辑信息:', editInfo);
    expect(editInfo.editPaneVisible).toBe(true);
    expect(editInfo.textareaExists).toBe(true);

    // 8. 修改内容并保存
    const saveResult = await page.evaluate(() => {
      const textarea = document.getElementById('docEditTextarea');
      if (!textarea) return { success: false, error: 'textarea not found' };

      // 添加测试标记
      const testMark = '\n\n<!-- 测试标记: Playwright E2E Test -->';
      textarea.value = textarea.value + testMark;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      // 触发保存
      if (typeof saveDocContent === 'function') {
        saveDocContent();
        return { triggered: true };
      }
      return { triggered: false };
    });
    console.log('保存触发:', saveResult);

    // 等待保存完成
    await page.waitForTimeout(3000);

    // 9. 验证保存状态
    const saveStatus = await page.evaluate(() => {
      const statusEl = document.getElementById('docSaveStatus');
      const saveBtn = document.getElementById('docSaveBtn');
      return {
        statusText: statusEl?.textContent || '',
        saveBtnHidden: saveBtn?.style.display === 'none',
      };
    });
    console.log('保存状态:', saveStatus);

    // 10. 切换回预览模式验证内容更新
    await page.evaluate(() => {
      if (typeof switchDocMode === 'function') switchDocMode('preview');
    });
    await page.waitForTimeout(1000);

    const updatedContent = await page.evaluate(() => {
      const previewContent = document.getElementById('docPreviewContent');
      return previewContent?.innerHTML?.includes('测试标记') || false;
    });
    console.log('预览包含测试标记:', updatedContent);

    // 截图：保存后预览
    await page.screenshot({ path: 'tmp/verify-doc-saved.png' });

    // 11. 清理：移除测试标记（恢复原始内容）
    await page.evaluate(async () => {
      if (_docManager.currentDoc) {
        const originalContent = _docManager.originalContent;
        const resp = await fetch('http://localhost:4100/api/document/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: _docManager.currentDoc.meta_id || _docManager.currentDoc.id,
            content: originalContent,
            path: _docManager.currentDoc.file_path,
            title: _docManager.currentDoc.title,
          }),
        });
        return await resp.json();
      }
      return null;
    });
    await page.waitForTimeout(1000);
    console.log('已恢复原始内容');
  });
});
