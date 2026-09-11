const { test, expect } = require('@playwright/test');

test.describe('文档管理路径验证', () => {
  test('API 返回父目录 output 下的文件', async ({ request }) => {
    // 1. 验证 document list API
    const listResp = await request.get('http://localhost:4100/api/document/list');
    const listData = await listResp.json();
    expect(listData.success).toBe(true);
    expect(listData.data.length).toBeGreaterThan(0);

    // 验证文件路径属于父目录 output
    const filePaths = listData.data.map(d => d.file_path);
    console.log('文件路径列表:', filePaths.slice(0, 5));
    expect(filePaths.some(p => p.includes('数据库基础'))).toBe(true);

    // 2. 验证 document tree API
    const treeResp = await request.get('http://localhost:4100/api/document/tree');
    const treeData = await treeResp.json();
    expect(treeData.success).toBe(true);
    expect(treeData.data.length).toBeGreaterThan(0);

    // 验证目录树包含顶层领域目录
    const topDirs = treeData.data.map(n => n.name);
    console.log('顶层目录:', topDirs);
    expect(topDirs.some(n => n.includes('数据库基础'))).toBe(true);
    expect(topDirs.some(n => n.includes('兼容性领域'))).toBe(true);

    // 3. 验证 document content API
    const doc = listData.data.find(d => d.file_path.includes('基本概念'));
    if (doc) {
      const contentResp = await request.get('http://localhost:4100/api/document/' + encodeURIComponent(doc.id) + '/content');
      const contentData = await contentResp.json();
      expect(contentData.success).toBe(true);
      expect(contentData.data.content.length).toBeGreaterThan(0);
      expect(contentData.data.title).toBe('基本概念');
      console.log('文档内容长度:', contentData.data.content.length);
    }
  });
});
