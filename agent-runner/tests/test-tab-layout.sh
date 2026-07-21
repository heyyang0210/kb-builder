#!/bin/bash

echo "=========================================="
echo "全局 Tab 布局功能测试（修复版）"
echo "=========================================="
echo ""

PASS=0
FAIL=0
TOTAL=0

test_case() {
    local test_name="$1"
    local test_cmd="$2"
    local expected="$3"
    
    TOTAL=$((TOTAL + 1))
    echo "测试 $TOTAL: $test_name"
    
    result=$(eval "$test_cmd")
    
    if echo "$result" | grep -q "$expected"; then
        echo "  ✅ 通过"
        PASS=$((PASS + 1))
    else
        echo "  ❌ 失败"
        echo "     期望包含: $expected"
        FAIL=$((FAIL + 1))
    fi
    echo ""
}

# 1. Tab Bar 结构测试
echo "=== 1. Tab Bar 结构测试 ==="
test_case "Tab Bar 存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'class="tab-bar"'

test_case "文档生成 Tab 按钮存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'data-tab="doc-gen"'

test_case "文档管理 Tab 按钮存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'data-tab="doc-mgmt"'

test_case "统计分析 Tab 按钮存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'data-tab="analytics"'

test_case "默认激活文档生成 Tab" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'tab-btn active.*data-tab="doc-gen"'

# 2. Sidebar 结构测试
echo "=== 2. Sidebar 结构测试 ==="
test_case "Sidebar 折叠按钮存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'class="sidebar-toggle"'

test_case "文档生成 Sidebar 容器存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'id="sidebar-doc-gen"'

test_case "文档管理 Sidebar 容器存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'id="sidebar-doc-mgmt"'

test_case "统计分析 Sidebar 容器存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'id="sidebar-analytics"'

# 3. Main 内容区域测试
echo "=== 3. Main 内容区域测试 ==="
test_case "文档生成 Main 容器存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'id="main-doc-gen"'

test_case "文档管理 Main 容器存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'id="main-doc-mgmt"'

test_case "统计分析 Main 容器存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'id="main-analytics"'

# 4. CSS 布局测试
echo "=== 4. CSS 布局测试 ==="
test_case "CSS Grid 布局正确（3行）" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'grid-template-rows: 56px 40px 1fr'

test_case "Tab Bar CSS 存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    '.tab-bar'

test_case "Tab 按钮样式存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    '.tab-btn'

test_case "Tab 激活状态样式存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    '.tab-btn.active'

test_case "Sidebar 折叠样式存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    '.sidebar.collapsed'

test_case "淡入淡出动画存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    '@keyframes fadeIn'

# 5. JavaScript 功能测试
echo "=== 5. JavaScript 功能测试 ==="
test_case "switchTab 函数存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'function switchTab'

test_case "toggleSidebar 函数存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'function toggleSidebar'

test_case "Tab 状态管理对象存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'const tabState'

test_case "快捷键监听存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    "addEventListener('keydown'"

test_case "localStorage 状态保存存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'localStorage.setItem'

# 6. 旧 Modal 删除测试
echo "=== 6. 旧 Modal 删除测试 ==="
test_case "旧 DocumentViewer Modal 已删除" \
    "curl -s http://localhost:3500/prompt-generator.html | grep -c 'documentViewerModal'" \
    '0'

# 7. Header 按钮测试
echo "=== 7. Header 按钮测试 ==="
test_case "Header 中📄文档按钮已移除" \
    "curl -s http://localhost:3500/prompt-generator.html | grep 'header-actions' | grep -c 'openDocumentViewer'" \
    '0'

test_case "配置按钮保留" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'onclick="openConfigModal()"'

test_case "主题切换按钮保留" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    'onclick="toggleTheme()"'

# 8. 统计分析占位符测试
echo "=== 8. 统计分析占位符测试 ==="
test_case "统计分析 Sidebar 占位符存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    '功能开发中'

test_case "统计分析 Main 占位符存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    '统计分析功能开发中'

test_case "功能预告列表存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    '文档生成统计'

# 9. 响应式布局测试
echo "=== 9. 响应式布局测试 ==="
test_case "响应式断点存在" \
    "curl -s http://localhost:3500/prompt-generator.html" \
    '@media (max-width: 1024px)'

# 10. 后端 API 测试
echo "=== 10. 后端 API 测试 ==="
test_case "后端健康检查正常" \
    "curl -s http://localhost:4100/api/health" \
    '"status":"ok"'

test_case "文档列表 API 正常" \
    "curl -s http://localhost:4100/api/document/list" \
    '"success":true'

test_case "文档树 API 正常" \
    "curl -s http://localhost:4100/api/document/tree" \
    '"success":true'

# 输出测试结果
echo "=========================================="
echo "测试结果汇总"
echo "=========================================="
echo "总测试数: $TOTAL"
echo "通过: $PASS"
echo "失败: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✅ 所有测试通过！"
    exit 0
else
    echo "❌ 有 $FAIL 个测试失败"
    exit 1
fi
