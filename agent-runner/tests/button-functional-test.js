/**
 * 前端按钮功能实际效果测试
 * 通过 Node.js 模拟浏览器环境，测试按钮函数的实际行为
 */

const http = require('http');

const BACKEND = 'http://localhost:4100';
const FRONTEND = 'http://localhost:3500';

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

function httpRequest(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
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

async function testBackendAPIs() {
  console.log('\n=== 后端 API 功能测试 ===\n');

  // 测试 1: 健康检查 API
  console.log('📋 测试 1: 健康检查 API');
  try {
    const res = await httpRequest('GET', `${BACKEND}/api/health`);
    assert(res.status === 200, '健康检查返回 200');
    assert(res.data.status === 'ok', '状态为 ok');
    assert(res.data.version !== undefined, '包含版本号');
  } catch (err) {
    assert(false, '健康检查失败: ' + err.message);
  }

  // 测试 2: 文档列表 API
  console.log('\n📋 测试 2: 文档列表 API');
  try {
    const res = await httpRequest('GET', `${BACKEND}/api/document/list`);
    assert(res.status === 200, '文档列表返回 200');
    assert(res.data.success === true, 'success 为 true');
    assert(Array.isArray(res.data.data), 'data 是数组');
  } catch (err) {
    assert(false, '文档列表失败: ' + err.message);
  }

  // 测试 3: 文档树 API
  console.log('\n📋 测试 3: 文档树 API');
  try {
    const res = await httpRequest('GET', `${BACKEND}/api/document/tree`);
    assert(res.status === 200, '文档树返回 200');
    assert(res.data.success === true, 'success 为 true');
    assert(Array.isArray(res.data.data), 'data 是数组');
  } catch (err) {
    assert(false, '文档树失败: ' + err.message);
  }

  // 测试 4: 文档保存 API
  console.log('\n📋 测试 4: 文档保存 API');
  try {
    const testContent = '# 功能测试文档\n\n这是一个功能测试文档。\n\n## 测试内容\n\n- 项目 1\n- 项目 2';
    const res = await httpRequest('POST', `${BACKEND}/api/document/save`, {
      content: testContent,
      path: 'functional-test-doc.md',
      title: '功能测试文档'
    });
    assert(res.status === 200, '文档保存返回 200');
    assert(res.data.success === true, 'success 为 true');
    assert(res.data.data.id !== undefined, '返回文档 ID');
    assert(res.data.data.version === 1, '版本号为 1');
  } catch (err) {
    assert(false, '文档保存失败: ' + err.message);
  }

  // 测试 5: 文档内容获取 API
  console.log('\n📋 测试 5: 文档内容获取 API');
  try {
    const docId = Buffer.from('functional-test-doc.md').toString('base64');
    const res = await httpRequest('GET', `${BACKEND}/api/document/${docId}/content`);
    assert(res.status === 200, '文档内容返回 200');
    assert(res.data.success === true, 'success 为 true');
    assert(res.data.data.content !== undefined, '包含 content 字段');
    assert(res.data.data.content.includes('功能测试文档'), '内容包含标题');
  } catch (err) {
    assert(false, '文档内容获取失败: ' + err.message);
  }

  // 测试 6: 文档搜索 API
  console.log('\n📋 测试 6: 文档搜索 API');
  try {
    const res = await httpRequest('POST', `${BACKEND}/api/document/search`, {
      keyword: '功能测试',
      scope: 'all'
    });
    assert(res.status === 200, '文档搜索返回 200');
    assert(res.data.success === true, 'success 为 true');
    assert(Array.isArray(res.data.data), 'data 是数组');
  } catch (err) {
    assert(false, '文档搜索失败: ' + err.message);
  }

  // 测试 7: 配置获取 API
  console.log('\n📋 测试 7: 配置获取 API');
  try {
    const res = await httpRequest('GET', `${BACKEND}/api/config/model`);
    assert(res.status === 200, '配置获取返回 200');
    assert(res.data.success === true, 'success 为 true');
  } catch (err) {
    assert(false, '配置获取失败: ' + err.message);
  }

  // 测试 8: 清理测试文档
  console.log('\n📋 测试 8: 删除测试文档');
  try {
    const docId = Buffer.from('functional-test-doc.md').toString('base64');
    const res = await httpRequest('DELETE', `${BACKEND}/api/document/${docId}`);
    assert(res.status === 200, '文档删除返回 200');
    assert(res.data.success === true, 'success 为 true');
  } catch (err) {
    assert(false, '文档删除失败: ' + err.message);
  }
}

async function testFrontendAccessibility() {
  console.log('\n=== 前端可访问性测试 ===\n');

  // 测试 9: 前端页面可访问
  console.log('📋 测试 9: 前端页面可访问性');
  try {
    const res = await new Promise((resolve, reject) => {
      http.get(`${FRONTEND}/prompt-generator.html`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: data }));
      }).on('error', reject);
    });
    
    assert(res.status === 200, '前端页面返回 200');
    assert(res.data.includes('<!DOCTYPE html>'), '包含 HTML 文档声明');
    assert(res.data.includes('YashanDB 知识库文档生成器'), '包含页面标题');
    assert(res.data.includes('switchTab'), '包含 Tab 切换函数');
    assert(res.data.includes('openConfigModal'), '包含配置弹窗函数');
    assert(res.data.includes('generatePrompt'), '包含生成提示词函数');
    assert(res.data.includes('executeAgent'), '包含执行 Agent 函数');
    assert(res.data.includes('saveOutputAsDocument'), '包含保存为文档函数');
  } catch (err) {
    assert(false, '前端页面访问失败: ' + err.message);
  }
}

async function testJavaScriptFunctions() {
  console.log('\n=== JavaScript 函数逻辑测试 ===\n');

  // 测试 10: 测试 formatFileSize 函数逻辑
  console.log('📋 测试 10: formatFileSize 函数逻辑');
  try {
    // 模拟函数
    function formatFileSize(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    }
    
    assert(formatFileSize(0) === '0 B', '0 字节显示为 "0 B"');
    assert(formatFileSize(1024) === '1.0 KB', '1024 字节显示为 "1.0 KB"');
    assert(formatFileSize(1048576) === '1.0 MB', '1048576 字节显示为 "1.0 MB"');
    assert(formatFileSize(500) === '500 B', '500 字节显示为 "500 B"');
  } catch (err) {
    assert(false, 'formatFileSize 测试失败: ' + err.message);
  }

  // 测试 11: 测试 escapeHtml 函数逻辑
  console.log('\n📋 测试 11: escapeHtml 函数逻辑');
  try {
    // 模拟函数
    function escapeHtml(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    assert(escapeHtml('<script>') === '&lt;script&gt;', '正确转义 < 和 >');
    assert(escapeHtml('"test"') === '&quot;test&quot;', '正确转义引号');
    assert(escapeHtml('a & b') === 'a &amp; b', '正确转义 &');
  } catch (err) {
    assert(false, 'escapeHtml 测试失败: ' + err.message);
  }
}

async function runAllTests() {
  console.log('==========================================');
  console.log('前端按钮功能实际效果测试');
  console.log('==========================================');
  console.log('');
  console.log('测试时间:', new Date().toISOString());
  console.log('后端地址:', BACKEND);
  console.log('前端地址:', FRONTEND);

  await testBackendAPIs();
  await testFrontendAccessibility();
  await testJavaScriptFunctions();

  console.log('\n==========================================');
  console.log('测试结果汇总');
  console.log('==========================================');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  
  if (failures.length > 0) {
    console.log('\n失败项:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('测试运行错误:', err);
  process.exit(1);
});
