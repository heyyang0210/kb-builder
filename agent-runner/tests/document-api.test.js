/**
 * 文档管理 API 单元测试
 * 
 * 测试覆盖：
 * - GET /api/document/list
 * - POST /api/document/save
 * - GET /api/document/:id/content
 * - GET /api/document/stats
 * - DELETE /api/document/:id
 */

const http = require('http');

const BACKEND = 'http://localhost:4100';

// 测试工具函数
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BACKEND);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 测试结果收集
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`  ❌ ${message}`);
  }
}

async function runTests() {
  console.log('\n=== 文档管理 API 测试 ===\n');

  // ---- 测试 1: 文档列表 ----
  console.log('📋 测试 1: GET /api/document/list');
  try {
    const res = await request('GET', '/api/document/list');
    assert(res.status === 200, '返回 200 状态码');
    assert(res.data.success === true, 'success 为 true');
    assert(Array.isArray(res.data.data), 'data 是数组');
    
    // 检查文档结构
    if (res.data.data.length > 0) {
      const doc = res.data.data[0];
      assert(doc.id !== undefined, '文档包含 id 字段');
      assert(doc.title !== undefined, '文档包含 title 字段');
      assert(doc.file_path !== undefined, '文档包含 file_path 字段');
      assert(doc.file_size !== undefined, '文档包含 file_size 字段');
    }
  } catch (err) {
    assert(false, '文档列表请求失败: ' + err.message);
  }

  // ---- 测试 2: 保存文档 ----
  console.log('\n💾 测试 2: POST /api/document/save');
  let savedDocId = null;
  let savedDocPath = null;
  try {
    const testContent = '# 单元测试文档\n\n## 概述\n\n这是自动化测试创建的文档。\n\n## 代码示例\n\n```sql\nSELECT * FROM test_table WHERE id = 1;\n```\n\n## 表格示例\n\n| 列名 | 类型 | 说明 |\n|------|------|------|\n| id | INT | 主键 |\n| name | VARCHAR | 名称 |';
    
    const res = await request('POST', '/api/document/save', {
      content: testContent,
      path: 'unit-test-doc.md',
      title: '单元测试文档'
    });
    
    assert(res.status === 200, '返回 200 状态码');
    assert(res.data.success === true, 'success 为 true');
    assert(res.data.data.id !== undefined, '返回文档 id');
    assert(res.data.data.version === 1, '版本号为 1');
    assert(res.data.data.title === '单元测试文档', '标题正确');
    
    savedDocId = res.data.data.id;
    savedDocPath = res.data.data.path;
  } catch (err) {
    assert(false, '保存文档请求失败: ' + err.message);
  }

  // ---- 测试 3: 更新文档（版本递增） ----
  console.log('\n🔄 测试 3: 更新文档（版本递增）');
  try {
    const res = await request('POST', '/api/document/save', {
      id: savedDocId,
      content: '# 单元测试文档 (已更新)\n\n内容已更新。',
      title: '单元测试文档 (已更新)'
    });
    
    assert(res.status === 200, '返回 200 状态码');
    assert(res.data.success === true, 'success 为 true');
    assert(res.data.data.version === 2, '版本号递增为 2');
    assert(res.data.data.title === '单元测试文档 (已更新)', '标题已更新');
  } catch (err) {
    assert(false, '更新文档请求失败: ' + err.message);
  }

  // ---- 测试 4: 获取文档内容 ----
  console.log('\n📖 测试 4: GET /api/document/:id/content');
  try {
    const docIdBase64 = Buffer.from(savedDocPath || 'unit-test-doc.md').toString('base64');
    const res = await request('GET', `/api/document/${docIdBase64}/content`);
    
    assert(res.status === 200, '返回 200 状态码');
    assert(res.data.success === true, 'success 为 true');
    assert(res.data.data.content !== undefined, '包含 content 字段');
    assert(res.data.data.content.includes('单元测试文档'), '内容包含文档标题');
    assert(res.data.data.content.includes('已更新'), '内容是更新后的版本');
  } catch (err) {
    assert(false, '获取文档内容请求失败: ' + err.message);
  }

  // ---- 测试 5: 文档统计 ----
  console.log('\n📊 测试 5: GET /api/document/stats');
  try {
    const res = await request('GET', '/api/document/stats');
    
    assert(res.status === 200, '返回 200 状态码');
    assert(res.data.success === true, 'success 为 true');
    assert(res.data.data.total_documents >= 1, '文档总数 >= 1');
    assert(res.data.data.total_size > 0, '总大小 > 0');
    assert(res.data.data.last_updated !== null, '有最后更新时间');
  } catch (err) {
    assert(false, '文档统计请求失败: ' + err.message);
  }

  // ---- 测试 6: 文档列表包含新文档 ----
  console.log('\n📋 测试 6: 文档列表包含新保存的文档');
  try {
    const res = await request('GET', '/api/document/list');
    const found = res.data.data.find(d => d.file_path === 'unit-test-doc.md');
    assert(found !== undefined, '列表中包含 unit-test-doc.md');
    if (found) {
      assert(found.title === '单元测试文档 (已更新)', '标题是更新后的');
      assert(found.version === 2, '版本号为 2');
    }
  } catch (err) {
    assert(false, '文档列表查询失败: ' + err.message);
  }

  // ---- 测试 7: 下载文档 ----
  console.log('\n📥 测试 7: GET /api/document/:id/download');
  try {
    const docIdBase64 = Buffer.from('unit-test-doc.md').toString('base64');
    const res = await new Promise((resolve, reject) => {
      const url = new URL(`/api/document/${docIdBase64}/download`, BACKEND);
      http.get(url.href, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: data }));
      }).on('error', reject);
    });
    
    assert(res.status === 200, '返回 200 状态码');
    assert(res.data.includes('单元测试文档'), '下载内容包含文档标题');
  } catch (err) {
    assert(false, '下载文档请求失败: ' + err.message);
  }

  // ---- 测试 8: 删除文档 ----
  console.log('\n🗑️  测试 8: DELETE /api/document/:id');
  try {
    const docIdBase64 = Buffer.from('unit-test-doc.md').toString('base64');
    const res = await request('DELETE', `/api/document/${docIdBase64}`);
    
    assert(res.status === 200, '返回 200 状态码');
    assert(res.data.success === true, 'success 为 true');
    assert(res.data.message === '文档已删除', '返回删除成功消息');
    
    // 验证已删除
    const verifyRes = await request('GET', `/api/document/${docIdBase64}/content`);
    assert(verifyRes.status === 404, '删除后返回 404');
  } catch (err) {
    assert(false, '删除文档请求失败: ' + err.message);
  }

  // ---- 测试 9: 保存文档缺少 content 参数 ----
  console.log('\n⚠️  测试 9: 参数验证 - 缺少 content');
  try {
    const res = await request('POST', '/api/document/save', {
      path: 'no-content.md',
      title: '无内容'
    });
    assert(res.status === 400, '返回 400 状态码');
    assert(res.data.success === false, 'success 为 false');
  } catch (err) {
    assert(false, '参数验证请求失败: ' + err.message);
  }

  // ---- 测试 10: 获取不存在的文档 ----
  console.log('\n❌ 测试 10: 获取不存在的文档');
  try {
    const fakeId = Buffer.from('nonexistent.md').toString('base64');
    const res = await request('GET', `/api/document/${fakeId}/content`);
    assert(res.status === 404, '返回 404 状态码');
    assert(res.data.success === false, 'success 为 false');
  } catch (err) {
    assert(false, '获取不存在文档请求失败: ' + err.message);
  }

  // ---- 结果汇总 ----
  console.log('\n=== 测试结果 ===');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  if (failures.length > 0) {
    console.log('\n失败项:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  console.log('');
  
  // 运行新增 API 测试
  await runNewApiTests();
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});

// ============================================
// 新增 API 测试：tree 和 search
// ============================================

async function runNewApiTests() {
  console.log('\n=== 新增 API 测试 (tree + search) ===\n');

  // ---- 测试 11: 目录树 API ----
  console.log('📁 测试 11: GET /api/document/tree');
  try {
    const res = await request('GET', '/api/document/tree');
    assert(res.status === 200, '返回 200 状态码');
    assert(res.data.success === true, 'success 为 true');
    assert(Array.isArray(res.data.data), 'data 是数组');
    
    if (res.data.data.length > 0) {
      const firstNode = res.data.data[0];
      assert(firstNode.name !== undefined, '节点包含 name');
      assert(firstNode.type !== undefined, '节点包含 type');
      assert(['directory', 'file'].includes(firstNode.type), 'type 为 directory 或 file');
      
      if (firstNode.type === 'directory') {
        assert(Array.isArray(firstNode.children), '目录包含 children');
      }
      if (firstNode.type === 'file') {
        assert(firstNode.id !== undefined, '文件包含 id');
        assert(firstNode.size !== undefined, '文件包含 size');
      }
    }
    console.log('  📊 树节点数: ' + res.data.data.length);
  } catch (err) {
    assert(false, '目录树请求失败: ' + err.message);
  }

  // ---- 测试 12: 全文搜索 API (scope=all) ----
  console.log('\n🔍 测试 12: POST /api/document/search (scope=all)');
  try {
    const res = await request('POST', '/api/document/search', { keyword: '数据类型', scope: 'all' });
    assert(res.status === 200, '返回 200 状态码');
    assert(res.data.success === true, 'success 为 true');
    assert(Array.isArray(res.data.data), 'data 是数组');
    
    if (res.data.data.length > 0) {
      const firstResult = res.data.data[0];
      assert(firstResult.id !== undefined, '结果包含 id');
      assert(firstResult.title !== undefined, '结果包含 title');
      assert(Array.isArray(firstResult.matches), '结果包含 matches');
      if (firstResult.matches.length > 0) {
        assert(firstResult.matches[0].context !== undefined, '匹配包含 context');
        assert(firstResult.matches[0].type !== undefined, '匹配包含 type');
      }
    }
    console.log('  📊 搜索结果数: ' + res.data.data.length);
  } catch (err) {
    assert(false, '全文搜索请求失败: ' + err.message);
  }

  // ---- 测试 13: 全文搜索 API (scope=title) ----
  console.log('\n🔍 测试 13: POST /api/document/search (scope=title)');
  try {
    const res = await request('POST', '/api/document/search', { keyword: 'test', scope: 'title' });
    assert(res.status === 200, '返回 200 状态码');
    assert(res.data.success === true, 'success 为 true');
    
    // scope=title 只匹配标题
    for (const doc of res.data.data) {
      for (const match of doc.matches) {
        assert(match.type === 'title', 'scope=title 时匹配类型为 title');
      }
    }
    console.log('  📊 标题搜索结果数: ' + res.data.data.length);
  } catch (err) {
    assert(false, '标题搜索请求失败: ' + err.message);
  }

  // ---- 测试 14: 空关键词搜索 ----
  console.log('\n🔍 测试 14: POST /api/document/search (空关键词)');
  try {
    const res = await request('POST', '/api/document/search', { keyword: '', scope: 'all' });
    assert(res.status === 200, '返回 200 状态码');
    assert(res.data.success === true, 'success 为 true');
    assert(res.data.data.length === 0, '空关键词返回空数组');
  } catch (err) {
    assert(false, '空关键词搜索失败: ' + err.message);
  }

  // ---- 测试 15: 搜索不存在的关键词 ----
  console.log('\n🔍 测试 15: POST /api/document/search (不存在的关键词)');
  try {
    const res = await request('POST', '/api/document/search', { keyword: 'xyznonexistent123', scope: 'all' });
    assert(res.status === 200, '返回 200 状态码');
    assert(res.data.data.length === 0, '不存在的关键词返回空数组');
  } catch (err) {
    assert(false, '不存在关键词搜索失败: ' + err.message);
  }

  // ---- 结果汇总 ----
  console.log('\n=== 新增 API 测试结果 ===');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  if (failures.length > 0) {
    console.log('\n失败项:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  console.log('');
}


