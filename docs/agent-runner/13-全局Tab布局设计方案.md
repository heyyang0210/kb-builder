# 13-全局 Tab 布局设计方案

## 1. 设计目标

将当前的"文档管理 Modal 弹窗"改造为"全局 Tab 布局"，实现：
- 更清晰的页面结构和职责分离
- 更好的空间利用和用户体验
- 更易扩展的功能架构

## 2. 业界参考

### 2.1 类似产品分析

| 产品 | Tab 位置 | Sidebar 策略 | 特点 |
|------|---------|-------------|------|
| **VS Code** | 左侧图标栏 | 每个图标对应不同视图 | 图标化，节省空间 |
| **Notion** | 左侧边栏顶部 | 统一侧边栏，内容区切换 | 简洁，但侧边栏固定 |
| **Figma** | 顶部 Tab | 左侧面板随 Tab 变化 | 专业工具风格 |
| **语雀** | 顶部导航 | 左侧目录树 | 文档工具风格 |
| **Confluence** | 顶部导航 | 左侧页面树 | 企业 Wiki 风格 |

### 2.2 最佳实践总结

1. **Tab 位置选择**
   - 顶部 Tab：适合 3-5 个主要功能模块
   - 左侧图标栏：适合 5+ 个功能模块
   - 我们的场景：2-3 个 Tab，**顶部 Tab 更合适**

2. **Sidebar 策略**
   - 固定 Sidebar：所有 Tab 共享（Notion 风格）
   - 动态 Sidebar：每个 Tab 独立 Sidebar（VS Code/Figma 风格）
   - 我们的场景：知识点导航 vs 文档导航，**动态 Sidebar 更合适**

3. **状态保持**
   - Tab 切换时应保持各视图的状态（滚动位置、选中项等）
   - 避免重复加载数据

## 3. 布局设计

### 3.1 整体结构

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (56px)                                                  │
│  [YashanDB 知识库文档生成器]              [🔗连接] [⚙️配置] [🌓] │
├─────────────────────────────────────────────────────────────────┤
│  Tab Bar (40px)                                                 │
│  [📝 文档生成] [📄 文档管理] [📊 统计分析]                       │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│  Sidebar     │         Main Content Area                       │
│  (300px)     │         (1fr)                                   │
│              │                                                  │
│  根据当前    │  根据当前 Tab 显示不同内容                        │
│  Tab 动态    │                                                  │
│  切换内容    │                                                  │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

### 3.2 CSS Grid 布局

```css
.app {
  display: grid;
  grid-template-columns: 300px 1fr;
  grid-template-rows: 56px 40px 1fr;  /* Header + TabBar + Content */
  height: 100vh;
}

.header {
  grid-column: 1 / -1;
  grid-row: 1;
}

.tab-bar {
  grid-column: 1 / -1;
  grid-row: 2;
}

.sidebar {
  grid-column: 1;
  grid-row: 3;
}

.main {
  grid-column: 2;
  grid-row: 3;
}
```

## 4. Tab 定义

### 4.1 文档生成 Tab（默认）

**功能定位：** 创建新文档的核心工作区

**Sidebar 内容：**
- 知识点导航树（当前已有功能）
- 上传大纲入口
- 搜索知识点

**Main 内容：**
- ① 知识点信息配置
- ② 执行方案选择
- ③ 参考资料配置
- 操作按钮：生成提示词 / 执行 Agent
- 输出结果区域

### 4.2 文档管理 Tab

**功能定位：** 查看、编辑、管理已生成的文档

**Sidebar 内容：**
- 文档列表/树视图切换
- 搜索文档
- 文档统计信息

**Main 内容：**
- 文档预览/编辑区域
- 双模式切换（预览/编辑）
- 文档操作（保存、下载、删除）

### 4.3 统计分析 Tab（预留）

**功能定位：** 系统使用统计和数据分析

**Sidebar 内容：**
- 统计维度选择
- 时间范围筛选

**Main 内容：**
- 文档生成统计
- Token 消耗统计
- 使用趋势图表

## 5. 交互设计

### 5.1 Tab 切换

```
用户点击 Tab
    ↓
1. 隐藏当前 Tab 的 Sidebar 和 Main 内容
2. 显示目标 Tab 的 Sidebar 和 Main 内容
3. 更新 Tab 按钮的 active 状态
4. 如果是首次切换到该 Tab，加载初始数据
5. 恢复该 Tab 的状态（滚动位置、选中项等）
```

### 5.2 状态管理

```javascript
const tabState = {
  'doc-gen': {
    sidebarScroll: 0,
    mainScroll: 0,
    selectedKP: null,
    promptContent: ''
  },
  'doc-mgmt': {
    sidebarScroll: 0,
    mainScroll: 0,
    selectedDoc: null,
    viewMode: 'tree',  // 'tree' | 'list'
    searchKeyword: ''
  }
};
```

### 5.3 快捷键支持

- `Ctrl+1` / `Cmd+1`：切换到文档生成 Tab
- `Ctrl+2` / `Cmd+2`：切换到文档管理 Tab
- `Ctrl+3` / `Cmd+3`：切换到统计分析 Tab

## 6. 实现方案

### 6.1 HTML 结构

```html
<div class="app">
  <!-- Header -->
  <div class="header">
    <h1>YashanDB 知识库文档生成器</h1>
    <div class="header-actions">
      <div class="connection-indicator">...</div>
      <button class="btn-config" onclick="openConfigModal()">⚙️ 配置</button>
      <button onclick="toggleTheme()">🌓 主题</button>
    </div>
  </div>

  <!-- Tab Bar -->
  <div class="tab-bar">
    <button class="tab-btn active" data-tab="doc-gen" onclick="switchTab('doc-gen')">
      📝 文档生成
    </button>
    <button class="tab-btn" data-tab="doc-mgmt" onclick="switchTab('doc-mgmt')">
      📄 文档管理
    </button>
    <button class="tab-btn" data-tab="analytics" onclick="switchTab('analytics')">
      📊 统计分析
    </button>
  </div>

  <!-- Sidebar -->
  <div class="sidebar">
    <!-- 文档生成 Tab 的 Sidebar -->
    <div class="sidebar-content" id="sidebar-doc-gen">
      <div class="sidebar-search">...</div>
      <div id="treeContainer">...</div>
    </div>

    <!-- 文档管理 Tab 的 Sidebar -->
    <div class="sidebar-content" id="sidebar-doc-mgmt" style="display:none">
      <div class="doc-mgmt-search">...</div>
      <div class="doc-view-toggle">...</div>
      <div class="doc-tree-view" id="docTreeView">...</div>
      <div class="doc-list-view" id="docListView" style="display:none">...</div>
    </div>

    <!-- 统计分析 Tab 的 Sidebar -->
    <div class="sidebar-content" id="sidebar-analytics" style="display:none">
      <!-- 预留 -->
    </div>
  </div>

  <!-- Main Content -->
  <div class="main">
    <!-- 文档生成 Tab 的 Main -->
    <div class="main-content" id="main-doc-gen">
      <!-- 当前的知识点配置、执行方案、参考资料、输出结果等 -->
    </div>

    <!-- 文档管理 Tab 的 Main -->
    <div class="main-content" id="main-doc-mgmt" style="display:none">
      <!-- 文档预览/编辑区域 -->
    </div>

    <!-- 统计分析 Tab 的 Main -->
    <div class="main-content" id="main-analytics" style="display:none">
      <!-- 预留 -->
    </div>
  </div>
</div>
```

### 6.2 CSS 样式

```css
/* Tab Bar */
.tab-bar {
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  gap: 4px;
}

.tab-btn {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px 6px 0 0;
  transition: all 0.2s;
  position: relative;
}

.tab-btn:hover {
  background: var(--bg);
  color: var(--text);
}

.tab-btn.active {
  background: var(--primary-light);
  color: var(--primary);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--primary);
}

/* Sidebar Content */
.sidebar-content {
  height: 100%;
  overflow-y: auto;
}

/* Main Content */
.main-content {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
}
```

### 6.3 JavaScript 逻辑

```javascript
let currentTab = 'doc-gen';

function switchTab(tabName) {
  // 保存当前 Tab 状态
  saveTabState(currentTab);
  
  // 隐藏所有 Sidebar 和 Main 内容
  document.querySelectorAll('.sidebar-content').forEach(el => {
    el.style.display = 'none';
  });
  document.querySelectorAll('.main-content').forEach(el => {
    el.style.display = 'none';
  });
  
  // 显示目标 Tab 的内容
  document.getElementById(`sidebar-${tabName}`).style.display = 'block';
  document.getElementById(`main-${tabName}`).style.display = 'block';
  
  // 更新 Tab 按钮状态
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // 恢复目标 Tab 状态
  restoreTabState(tabName);
  
  // 如果是首次切换到该 Tab，加载数据
  if (tabName === 'doc-mgmt' && !docMgmtLoaded) {
    loadDocList();
    loadDocTree();
    loadDocStats();
    docMgmtLoaded = true;
  }
  
  currentTab = tabName;
}

function saveTabState(tabName) {
  const state = tabState[tabName];
  if (tabName === 'doc-gen') {
    state.sidebarScroll = document.getElementById('sidebar-doc-gen').scrollTop;
    state.mainScroll = document.getElementById('main-doc-gen').scrollTop;
    state.promptContent = window._currentPromptMarkdown || '';
  } else if (tabName === 'doc-mgmt') {
    state.sidebarScroll = document.getElementById('sidebar-doc-mgmt').scrollTop;
    state.mainScroll = document.getElementById('main-doc-mgmt').scrollTop;
  }
}

function restoreTabState(tabName) {
  const state = tabState[tabName];
  if (tabName === 'doc-gen') {
    document.getElementById('sidebar-doc-gen').scrollTop = state.sidebarScroll;
    document.getElementById('main-doc-gen').scrollTop = state.mainScroll;
  } else if (tabName === 'doc-mgmt') {
    document.getElementById('sidebar-doc-mgmt').scrollTop = state.sidebarScroll;
    document.getElementById('main-doc-mgmt').scrollTop = state.mainScroll;
  }
}

// 快捷键支持
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '1') {
      e.preventDefault();
      switchTab('doc-gen');
    } else if (e.key === '2') {
      e.preventDefault();
      switchTab('doc-mgmt');
    } else if (e.key === '3') {
      e.preventDefault();
      switchTab('analytics');
    }
  }
});
```

## 7. 迁移计划

### 7.1 阶段一：基础框架搭建（2小时）

1. 修改 HTML 结构，添加 Tab Bar
2. 调整 CSS Grid 布局
3. 实现 Tab 切换逻辑
4. 迁移文档管理 Modal 内容到 Tab

### 7.2 阶段二：内容迁移（2小时）

1. 将文档生成相关内容包装到 `#main-doc-gen`
2. 将文档管理相关内容移到 `#main-doc-mgmt`
3. 拆分 Sidebar 为两个独立容器
4. 调整样式适配新布局

### 7.3 阶段三：状态管理（1小时）

1. 实现 Tab 状态保存和恢复
2. 添加快捷键支持
3. 优化切换动画

### 7.4 阶段四：测试和优化（1小时）

1. 功能测试
2. 响应式适配
3. 性能优化

## 8. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 现有功能破坏 | 高 | 分支开发，充分测试 |
| 样式冲突 | 中 | 使用 BEM 命名规范 |
| 状态丢失 | 中 | 实现完整状态管理 |
| 性能下降 | 低 | 懒加载 Tab 内容 |

## 9. 后续扩展

- **统计分析 Tab**：文档生成统计、Token 消耗、使用趋势
- **系统设置 Tab**：全局配置、用户偏好
- **协作功能**：多人协作编辑、评论系统

## 10. 确认的设计决策

### 10.1 Header 按钮处理：完全移除

**决策：** 完全移除 Header 中的"📄 文档"按钮

**理由：**
- 所有导航通过 Tab Bar 完成，职责更清晰
- 避免功能重复（Tab 和按钮都能切换）
- Header 更简洁，只保留全局功能（配置、主题）

**实施：**
```html
<!-- 移除前 -->
<div class="header-actions">
  <button class="btn-config" onclick="openDocumentViewer()">📄 文档</button>
  <button class="btn-config" onclick="openConfigModal()">⚙️ 配置</button>
  <button onclick="toggleTheme()">🌓 主题</button>
</div>

<!-- 移除后 -->
<div class="header-actions">
  <button class="btn-config" onclick="openConfigModal()">⚙️ 配置</button>
  <button onclick="toggleTheme()">🌓 主题</button>
</div>
```

### 10.2 统计分析 Tab：实现基础框架

**决策：** 创建 Tab 按钮和空容器，显示"功能开发中"提示

**理由：**
- 布局完整，易于后续扩展
- 用户可以看到完整的功能规划
- 额外工作量小（30分钟）

**实施：**
```html
<!-- Tab Bar -->
<button class="tab-btn" data-tab="analytics" onclick="switchTab('analytics')">
  📊 统计分析
</button>

<!-- Sidebar -->
<div class="sidebar-content" id="sidebar-analytics" style="display:none">
  <div class="analytics-placeholder">
    <div class="placeholder-icon">📊</div>
    <h3>统计分析</h3>
    <p>功能开发中...</p>
    <ul>
      <li>文档生成统计</li>
      <li>Token 消耗分析</li>
      <li>使用趋势图表</li>
    </ul>
  </div>
</div>

<!-- Main -->
<div class="main-content" id="main-analytics" style="display:none">
  <div class="analytics-placeholder-main">
    <div class="placeholder-icon">🚧</div>
    <h2>统计分析功能开发中</h2>
    <p>即将推出以下功能：</p>
    <div class="feature-list">
      <div class="feature-item">
        <span class="feature-icon">📈</span>
        <div>
          <h4>文档生成统计</h4>
          <p>查看文档生成数量、频率、成功率等统计数据</p>
        </div>
      </div>
      <div class="feature-item">
        <span class="feature-icon">🔤</span>
        <div>
          <h4>Token 消耗分析</h4>
          <p>追踪 API 调用和 Token 使用情况</p>
        </div>
      </div>
      <div class="feature-item">
        <span class="feature-icon">📊</span>
        <div>
          <h4>使用趋势图表</h4>
          <p>可视化展示使用趋势和模式</p>
        </div>
      </div>
    </div>
  </div>
</div>
```

### 10.3 Tab 切换动画：淡入淡出

**决策：** 使用淡入淡出效果

**理由：**
- 平滑自然，不突兀
- 实现简单，性能好
- 符合现代 Web 应用风格

**实施：**
```css
.main-content {
  animation: fadeIn 0.2s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 切换时重新触发动画 */
.main-content.switching {
  animation: none;
}
```

```javascript
function switchTab(tabName) {
  // 添加 switching 类以重置动画
  const mainContent = document.getElementById(`main-${tabName}`);
  mainContent.classList.add('switching');
  
  // 显示内容
  mainContent.style.display = 'block';
  
  // 移除 switching 类以触发动画
  requestAnimationFrame(() => {
    mainContent.classList.remove('switching');
  });
  
  // ... 其他逻辑
}
```

### 10.4 响应式布局：Sidebar 可折叠

**决策：** Sidebar 可折叠，添加折叠按钮

**理由：**
- 保持功能完整性
- 小屏幕下也能正常使用
- 用户体验更好

**实施：**

**HTML：**
```html
<div class="sidebar" id="sidebar">
  <button class="sidebar-toggle" onclick="toggleSidebar()" title="折叠侧边栏">
    <span class="toggle-icon">◀</span>
  </button>
  <div class="sidebar-content" id="sidebar-doc-gen">
    <!-- 内容 -->
  </div>
</div>
```

**CSS：**
```css
.sidebar {
  position: relative;
  transition: width 0.3s ease;
}

.sidebar.collapsed {
  width: 0;
  overflow: hidden;
}

.sidebar-toggle {
  position: absolute;
  top: 10px;
  right: -12px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--card-bg);
  border: 1px solid var(--border);
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.sidebar-toggle:hover {
  background: var(--primary);
  color: white;
}

.sidebar.collapsed .toggle-icon {
  transform: rotate(180deg);
}

/* 响应式断点 */
@media (max-width: 1024px) {
  .sidebar {
    width: 0;
    overflow: hidden;
  }
  
  .sidebar.expanded {
    width: 300px;
  }
  
  .app {
    grid-template-columns: 1fr;
  }
}
```

**JavaScript：**
```javascript
let sidebarCollapsed = false;

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebarCollapsed = !sidebarCollapsed;
  
  if (sidebarCollapsed) {
    sidebar.classList.add('collapsed');
  } else {
    sidebar.classList.remove('collapsed');
  }
  
  // 保存状态到 localStorage
  localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
}

// 页面加载时恢复状态
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('sidebarCollapsed');
  if (saved === 'true') {
    toggleSidebar();
  }
});
```

## 11. 实施检查清单

### 阶段一：基础框架搭建（2小时）
- [ ] 修改 HTML 结构，添加 Tab Bar
- [ ] 调整 CSS Grid 布局（添加 40px Tab Bar 行）
- [ ] 实现 Tab 切换逻辑（switchTab 函数）
- [ ] 移除 Header 中的"📄 文档"按钮
- [ ] 创建统计分析 Tab 基础框架

### 阶段二：内容迁移（2小时）
- [ ] 将文档生成内容包装到 `#main-doc-gen`
- [ ] 将文档管理 Modal 内容迁移到 `#main-doc-mgmt`
- [ ] 拆分 Sidebar 为两个独立容器
- [ ] 调整样式适配新布局
- [ ] 移除 Modal 相关代码

### 阶段三：状态管理（1小时）
- [ ] 实现 Tab 状态保存和恢复
- [ ] 添加快捷键支持（Ctrl+1/2/3）
- [ ] 优化切换动画（淡入淡出）

### 阶段四：响应式和测试（1小时）
- [ ] 实现 Sidebar 折叠功能
- [ ] 响应式适配（< 1024px）
- [ ] 功能测试
- [ ] 性能优化

**总计：约 6 小时**

## 12. 验收标准

1. **功能完整性**
   - [ ] 文档生成功能正常
   - [ ] 文档管理功能正常
   - [ ] Tab 切换流畅
   - [ ] 状态保持正确

2. **用户体验**
   - [ ] 动画平滑自然
   - [ ] 响应式布局正常
   - [ ] 快捷键可用
   - [ ] Sidebar 折叠正常

3. **代码质量**
   - [ ] 无 console 错误
   - [ ] 代码结构清晰
   - [ ] 注释完整
   - [ ] 性能无明显下降

4. **测试覆盖**
   - [ ] 所有现有测试通过
   - [ ] 新增 Tab 切换测试
   - [ ] 新增响应式测试
