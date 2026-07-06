# prompt-generator.html 设计思路文档

## 一、文件定位

`prompt-generator.html` 是 YashanDB 知识库文档生成器的**单文件前端应用**，包含全部 HTML、CSS、JavaScript 和数据。用户通过浏览器打开即可使用，无需后端服务。

核心功能：从知识点目录树中选择知识点 → 填写表单 → 自动生成结构化的 AI 提示词（Markdown 格式），用于驱动 AI 生成知识库文档。

## 二、页面布局

```
┌──────────────────────────────────────────────────────────────┐
│  Header                                                      │
│  YashanDB 知识库文档生成器          [📦 批量模式] [🌓 主题]   │
├─────────────────┬────────────────────────────────────────────┤
│                 │                                            │
│  Sidebar        │  ① 知识点信息（必填）                       │
│  ┌───────────┐  │    名称 / 类型 / 所属部分 / 所属章节         │
│  │ 搜索框     │  │    描述 / 目标数据库 / 难度级别             │
│  ├───────────┤  │                                            │
│  │ 📚 数据库  │  │  ② 参考资料配置（可选）                    │
│  │  ├ 第一部分│  │    MCP关键词 / Oracle文档 / 设计文档 / 测试 │
│  │  ├ 第二部分│  │                                            │
│  │  └ ...    │  │  [🔨 生成提示词] [🔄 重置]                 │
│  │           │  │                                            │
│  │ 🔧 业务领域│  │  ③ 生成结果                                │
│  │  ├ 第1部分 │  │    类型 / Skill / 模板 信息栏               │
│  │  ├ 第2部分 │  │    ┌─────────────────────┐                │
│  │  └ ...    │  │    │ 提示词内容           │ [✏️ 编辑]      │
│  └───────────┘  │    └─────────────────────┘                │
│                 │    [📋 一键复制] [📥 下载 .md]              │
└─────────────────┴────────────────────────────────────────────┘
```

CSS Grid 布局：`grid-template-columns: 300px 1fr; grid-template-rows: 56px 1fr`。768px 以下侧边栏隐藏。

## 三、数据模型

### 3.1 数据库领域 OUTLINE — 三级结构

```
OUTLINE[]                                          L242
│
├─ part（部分）        "第一部分：数据库基础入门"     自带序号
│   level: "★"
│   └─ chapters[]（章）  "1.1 数据库与管理系统"      自带序号
│       └─ kps[]（知识点）
│           id: "1.1.1"
│           name: "基本概念"
│           desc: "..."
│
└─ ...（共八部分）
```

八部分对应：基础入门(★)、核心原理(★★)、SQL编程(★★)、数据库管理(★★)、性能优化(★★★)、高可用与集群(★★★)、内核与高级专题(★★★)、架构设计与实践(★★★)。

### 3.2 业务领域 BIZ_OUTLINE — 四级结构

```
BIZ_OUTLINE[]                                      L262
│
├─ domain（子域）       "兼容性领域"                 渲染时加"第1部分："
│   icon: "🔄"
│   └─ chapters[]（章）  "DDL 兼容性"               渲染时加"1 "
│       └─ sections[]（节）
│           id: "C1.1"   显示时用"1.1"替代
│           name: "数据类型映射"
│           └─ kps[]（知识点）
│               id: "C1.1.1"   显示时用"1.1.1"替代
│               name: "字符串类型..."
│               desc: "..."
│
└─ ...（共五个子域）
```

五个子域：

| si | 渲染名称 | 章数 | 说明 |
|----|----------|------|------|
| 0 | 第1部分：兼容性领域 | 6 | DDL/DML/查询/函数/过程化/工具 |
| 1 | 第2部分：性能调优领域 | 13 | 调优基础→进阶实践 |
| 2 | 第3部分：共享集群领域 | 10 | 架构基础→进阶实践 |
| 3 | 第4部分：高可用和备份恢复领域 | 9 | 度量指标→专家能力 |
| 4 | 第5部分：培训领域 | 0 | placeholder: "待建设" |

### 3.3 编号规则对比

```
数据库领域（数据自带编号）：
  部分: "第一部分：数据库基础入门"
  章:   "1.1 数据库与管理系统"
  知识点: "1.1.1 基本概念"

业务领域（渲染时动态生成编号）：
  子域: "第{si+1}部分：{domain}"
  章:   "{ci+1} {name}"
  节:   "{ci+1}.{sci+1} {name}"
  知识点: "{ci+1}.{sci+1}.{ki+1} {name}"
```

## 四、核心函数

### 4.1 函数总览

```
┌─────────────────────────────────────────────────────────────┐
│                      初始化                                  │
│  initTree()          渲染导航树 + 填充下拉框选项              │
│  detectType()        根据关键词自动判断知识类型                │
├─────────────────────────────────────────────────────────────┤
│                      导航交互                                 │
│  toggleDomain()      展开/折叠域（数据库/业务领域）            │
│  togglePart()        展开/折叠数据库部分                      │
│  toggleSubdomain()   展开/折叠业务子域                        │
│  toggleChapter()     展开/折叠章                             │
│  toggleSection()     展开/折叠节（仅业务领域）                 │
│  selectKp()          点击知识点 → 填充表单                    │
│  filterTree()        搜索过滤知识点                           │
├─────────────────────────────────────────────────────────────┤
│                      提示词生成                               │
│  generatePrompt()    单条生成                                 │
│  assemblePrompt()    组装提示词 Markdown                      │
│  getOutputPath()     计算 output_path                        │
│  getSkillFile()      根据类型返回 Skill 文件路径               │
│  getTemplateFile()   根据类型返回模板文件路径                   │
├─────────────────────────────────────────────────────────────┤
│                      批量操作                                 │
│  toggleBatchMode()   进入/退出批量模式                        │
│  toggleBatchKp()     勾选/取消知识点                          │
│  batchSelectAll()    全选当前可见知识点                        │
│  batchClearAll()     清除所有选择                             │
│  batchGenerate()     批量生成提示词                           │
│  updateBatchList()   更新已选列表显示                         │
├─────────────────────────────────────────────────────────────┤
│                      辅助功能                                 │
│  copyPrompt()        复制到剪贴板                             │
│  downloadPrompt()    下载为 .md 文件                          │
│  toggleEdit()        编辑/预览切换                            │
│  resetForm()         重置表单                                 │
│  toggleTheme()       亮色/暗色主题切换                        │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 initTree() — 导航树渲染

```
initTree()
│
├─ 渲染数据库领域
│   ├─ 遍历 OUTLINE → 生成 part → chapter → kp 的嵌套 HTML
│   ├─ 知识点显示: kp.id + kp.name（如 "1.1.1 基本概念"）
│   └─ 同时填充 #kpPart 下拉框: <option value="第一部分：...">
│
├─ 渲染分隔线
│
├─ 渲染业务领域
│   ├─ 遍历 BIZ_OUTLINE → 生成 subdomain → chapter → section → kp
│   ├─ 子域显示: "第{si+1}部分：{domain}"
│   ├─ 章显示: "{ci+1} {name}"
│   ├─ 节显示: "{ci+1}.{sci+1} {name}"
│   ├─ 知识点显示: "{ci+1}.{sci+1}.{ki+1} {name}"
│   └─ 培训领域无 chapters，仅显示 placeholder
│
└─ 填充 #kpPart 下拉框（业务领域选项）
    └─ <option value="业务领域 - 第{si+1}部分：{domain}">
```

### 4.3 selectKp() — 知识点选中

```
selectKp(kpId)
│
├─ 解析 kpId
│   ├─ 数据库: "db-pi-ci-ki"     → 4 段
│   └─ 业务领域: "biz-si-ci-sci-ki" → 5 段
│
├─ 填充表单
│   ├─ kpName    ← kp.name
│   ├─ kpDesc    ← kp.desc
│   ├─ kpPart    ← 数据库: part.part
│   │              业务: "业务领域 - 第{pi+1}部分：{domain}"
│   ├─ kpLevel   ← 数据库: part.level
│   │              业务: "★★"
│   └─ kpTargetDb ← 兼容性领域自动设为 "Oracle"
│
├─ 填充 kpChapter 下拉框
│   ├─ 数据库: option value = ch.name（如 "1.1 数据库与..."）
│   └─ 业务: option value = "{ci+1} {ch.name}"（如 "2 DML 兼容性"）
│
└─ 自动判断知识类型 → kpType
```

### 4.4 getOutputPath() — 输出路径生成

```
getOutputPath(data)
│
├─ data.part 以"第"开头 → 数据库领域
│   └─ 匹配 partMap 前缀
│       "第一部分" → "output/数据库基础/01-基础入门/"
│       "第二部分" → "output/数据库基础/02-核心原理/"
│       ...
│       "第八部分" → "output/数据库基础/08-架构设计与实践/"
│
├─ data.part 包含子域名称 → 业务领域
│   └─ 匹配 domainMap
│       ├─ "兼容性领域" → dir: "兼容性领域"
│       │   └─ data.chapter 包含关键词 → 匹配章目录
│       │       "DDL" → "output/兼容性领域/01-DDL兼容性/"
│       │       "DML" → "output/兼容性领域/02-DML兼容性/"
│       │       ...
│       ├─ "性能调优领域" → dir: "性能调优领域"
│       ├─ "共享集群领域" → dir: "共享集群领域"
│       └─ "高可用和备份恢复领域" → dir: "高可用和备份恢复领域"
│
└─ 兜底: "output/"
```

匹配机制：`data.part.includes(domain)` + `data.chapter.includes(key)`，使用关键词子串匹配。

### 4.5 assemblePrompt() — 提示词组装

```
assemblePrompt(data)
│
├─ 构建 JSON 元数据
│   {
│     name, part, chapter, description, type,
│     target_db (可选),
│     references: { mcp_query, design_doc, oracle_ref, test_cases },
│     output_path: getOutputPath(data)
│   }
│
├─ 确定 Skill 文件: getSkillFile(type)
│   "通用基础"     → "skills/00-通用生成-skill.md"
│   "理论机制"     → "skills/01-理论机制-skill.md"
│   "实战调优"     → "skills/02-实战调优-skill.md"
│   "架构对比"     → "skills/03-架构对比-skill.md"
│   "运维SOP"     → "skills/04-运维SOP-skill.md"
│   "SQL/开发参考" → "skills/05-SQL开发参考-skill.md"
│   "兼容性差异"   → "skills/06-兼容性差异-skill.md"
│
├─ 确定模板文件: getTemplateFile(type)
│   "通用基础"     → "templates/01-通用基础模板.md"
│   "理论机制"     → "templates/02-理论机制类模板.md"
│   ...
│
└─ 输出 Markdown 提示词
    包含: 前置检查 → 资料引用策略 → 知识点JSON → 执行要求 → 输出格式要求
```

### 4.6 detectType() — 知识类型自动判断

```
detectType(name, desc)
│
├─ 按优先级匹配关键词：
│   1. 兼容性差异: 兼容/差异/迁移/对比Oracle/...
│   2. 实战调优:   调优/优化/性能/诊断/...
│   3. 架构对比:   架构/集群/高可用/容灾/...
│   4. 运维SOP:    SOP/操作/流程/步骤/巡检/...
│   5. SQL/开发参考: SQL/函数/存储过程/触发器/...
│   6. 理论机制:   原理/机制/实现/内部/结构/...
│
└─ 兜底: "通用基础"
```

## 五、数据流

### 5.1 单条生成流程

```
用户点击导航树知识点
        │
        ▼
selectKp(kpId)
        │
        ├─ 填充表单字段
        ├─ 填充 kpPart 下拉框（带序号）
        └─ 填充 kpChapter 下拉框（业务领域带序号）
        │
        ▼
用户点击"生成提示词"
        │
        ▼
generatePrompt()
        │
        ├─ 读取表单值 → data 对象
        │   data.part = kpPart.value
        │   data.chapter = kpChapter.value
        │
        ▼
assemblePrompt(data)
        │
        ├─ getOutputPath(data)
        │   ├─ data.part.includes("兼容性领域") → true
        │   └─ data.chapter.includes("DML") → true
        │   └─ 返回 "output/兼容性领域/02-DML兼容性/"
        │
        ├─ getSkillFile(data.type)
        └─ getTemplateFile(data.type)
        │
        ▼
输出提示词到 #outputBox
```

### 5.2 批量生成流程

```
用户点击"📦 批量模式"
        │
        ▼
toggleBatchMode()
        │
        ├─ 显示所有 checkbox
        └─ 显示批量面板
        │
        ▼
用户勾选多个知识点 → toggleBatchKp() → selectedKps Set
        │
        ▼
用户点击"🔨 批量生成"
        │
        ▼
batchGenerate()
        │
        ├─ 遍历 selectedKps
        │   ├─ 解析 kpId → 定位知识点
        │   ├─ 构建 partName（业务领域带序号）
        │   ├─ 构建 chapterLabel（业务领域带序号）
        │   └─ assemblePrompt(data) → 追加到 combined
        │
        └─ 输出合并后的提示词到 #outputBox
```

## 六、类型与路径映射

### 6.1 知识类型 → Skill + 模板

| 知识类型 | Skill 文件 | 模板文件 |
|----------|-----------|----------|
| 通用基础 | skills/00-通用生成-skill.md | templates/01-通用基础模板.md |
| 理论机制 | skills/01-理论机制-skill.md | templates/02-理论机制类模板.md |
| 实战调优 | skills/02-实战调优-skill.md | templates/03-实战调优类模板.md |
| 架构对比 | skills/03-架构对比-skill.md | templates/04-架构对比类模板.md |
| 运维SOP | skills/04-运维SOP-skill.md | templates/05-运维SOP类模板.md |
| SQL/开发参考 | skills/05-SQL开发参考-skill.md | templates/06-SQL开发参考类模板.md |
| 兼容性差异 | skills/06-兼容性差异-skill.md | templates/07-兼容性差异类模板.md |

### 6.2 output_path 完整映射

**数据库领域：**

| 部分 | 目录 |
|------|------|
| 第一部分：数据库基础入门 | output/数据库基础/01-基础入门/ |
| 第二部分：数据库核心原理 | output/数据库基础/02-核心原理/ |
| 第三部分：数据库管理 | output/数据库基础/03-数据库管理/ |
| 第四部分：SQL编程 | output/数据库基础/04-SQL编程/ |
| 第五部分：性能优化 | output/数据库基础/05-性能优化/ |
| 第六部分：高可用与集群 | output/数据库基础/06-高可用与集群/ |
| 第七部分：内核与高级专题 | output/数据库基础/07-内核与高级专题/ |
| 第八部分：架构设计与实践 | output/数据库基础/08-架构设计与实践/ |

**业务领域 — 兼容性领域：**

| 章关键词 | 目录 |
|----------|------|
| DDL | output/兼容性领域/01-DDL兼容性/ |
| DML | output/兼容性领域/02-DML兼容性/ |
| 查询 | output/兼容性领域/03-查询兼容性/ |
| 函数 | output/兼容性领域/04-函数与操作符兼容性/ |
| 过程化 | output/兼容性领域/05-过程化语言兼容性/ |
| 工具 | output/兼容性领域/06-工具与接口兼容性/ |

**业务领域 — 性能调优领域：**

| 章关键词 | 目录 |
|----------|------|
| 性能调优基础 | output/性能调优领域/01-性能调优基础/ |
| 负载特征分析 | output/性能调优领域/02-负载特征分析/ |
| 查询优化器 | output/性能调优领域/03-查询优化器与执行计划/ |
| 索引 | output/性能调优领域/04-索引与访问路径优化/ |
| 统计信息 | output/性能调优领域/05-统计信息与成本估算/ |
| 内存 | output/性能调优领域/06-内存存储与IO调优/ |
| 并发控制 | output/性能调优领域/07-并发控制与锁管理/ |
| SQL | output/性能调优领域/08-SQL语句级性能调优/ |
| 性能监控 | output/性能调优领域/09-性能监控诊断与日志分析/ |
| 基准测试 | output/性能调优领域/10-迁移过程中的性能基准测试/ |
| 系统级参数 | output/性能调优领域/11-系统级参数与硬件调优/ |
| 高阶特性 | output/性能调优领域/12-高阶特性与负载管理/ |
| 进阶实践 | output/性能调优领域/13-进阶实践/ |

**业务领域 — 共享集群领域：**

| 章关键词 | 目录 |
|----------|------|
| 架构基础 | output/共享集群领域/01-共享集群架构基础/ |
| 缓存一致性 | output/共享集群领域/02-全局缓存一致性与数据共享/ |
| 锁管理 | output/共享集群领域/03-全局资源协调与锁管理/ |
| 节点管理 | output/共享集群领域/04-节点管理与高可用/ |
| 负载均衡 | output/共享集群领域/05-负载均衡与集群管理/ |
| 集群性能调优 | output/共享集群领域/06-集群性能调优/ |
| 故障诊断 | output/共享集群领域/07-集群故障诊断方法论/ |
| 迁移实践 | output/共享集群领域/08-迁移实践/ |
| 监控 | output/共享集群领域/09-监控与告警体系/ |
| 进阶实践 | output/共享集群领域/10-进阶实践/ |

**业务领域 — 高可用和备份恢复领域：**

| 章关键词 | 目录 |
|----------|------|
| 度量指标 | output/高可用和备份恢复领域/01-核心度量指标与故障模型/ |
| 备份体系 | output/高可用和备份恢复领域/02-备份体系设计与策略/ |
| 恢复体系 | output/高可用和备份恢复领域/03-恢复体系设计与操作/ |
| 高可用架构 | output/高可用和备份恢复领域/04-高可用架构基础/ |
| 协同 | output/高可用和备份恢复领域/05-高可用与备份恢复的协同/ |
| 性能优化 | output/高可用和备份恢复领域/06-备份恢复的性能优化/ |
| 监控 | output/高可用和备份恢复领域/07-备份恢复的监控与告警/ |
| 异地容灾 | output/高可用和备份恢复领域/08-异地容灾与多云架构/ |
| 进阶实践 | output/高可用和备份恢复领域/09-进阶实践与专家能力/ |

## 七、DOM 元素 ID 索引

| ID | 用途 |
|----|------|
| `treeContainer` | 导航树容器 |
| `searchInput` | 搜索框 |
| `kpName` | 知识点名称输入 |
| `kpType` | 知识类型下拉 |
| `kpPart` | 所属部分下拉 |
| `kpChapter` | 所属章节下拉 |
| `kpDesc` | 知识点描述文本域 |
| `kpTargetDb` | 目标对比数据库下拉 |
| `kpLevel` | 难度级别下拉 |
| `refMcp` | MCP 查询关键词 |
| `refOracle` | Oracle 知识库文档 |
| `refDesign` | 特性设计文档路径 |
| `refTest` | 测试用例路径 |
| `outputCard` | 生成结果卡片 |
| `outputMeta` | 结果元信息栏 |
| `outputBox` | 提示词显示区 |
| `outputTextarea` | 编辑模式文本域 |
| `editToggle` | 编辑/预览切换按钮 |
| `editHint` | 编辑模式提示 |
| `copyToast` | 复制成功提示 |
| `batchPanel` | 批量模式面板 |
| `batchToggle` | 批量模式按钮 |
| `batchList` | 已选知识点列表 |

## 八、CSS 变量与主题

```
亮色主题（默认）：
  --bg: #f5f7fa    --text: #1a1a2e    --primary: #2563eb
  --sidebar-bg: #fff  --card-bg: #fff  --border: #e2e8f0

暗色主题（data-theme="dark"）：
  --bg: #0f172a    --text: #e2e8f0    --primary: #3b82f6
  --sidebar-bg: #1e293b  --card-bg: #1e293b  --border: #334155
```

通过 `toggleTheme()` 切换 `html[data-theme]`，所有颜色通过 CSS 变量联动。
