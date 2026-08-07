# 项目进度看板

> 自动更新: 2026-08-07

## 📊 总览

- 总任务: 26 | 完成: 22 | 进行中: 0 | 待开始: 4 | 阻塞: 0
- 完成率: 85%

## ✅ 已完成

- [TASK-TSR-P0-01] 恢复 TrainingService 可编译基线 — backend-worker — 验收完成
- [TASK-TSR-P1-01] 完成重构设计与特征测试基线 — doc-writer — 验收完成
- [TASK-TSR-P2-01] 提取 Model Gateway 服务 — backend-worker — 验收完成
- [TASK-TSR-P2-02] 提取产物仓储并完成验证 — backend-worker/test-engineer — 有条件通过
- [TASK-KFS-01] 统一关键词状态源与图谱投影 — backend-worker/test-engineer — 验收完成
- [TASK-KFS-02] 删除业务三态、质量评价与 L2 后端接口 — backend-worker/test-engineer — 验收完成
- [TASK-KFS-03] 收敛质量分析前端为关键词过滤视图 — frontend-worker — 构建与浏览器验收完成
- [TASK-KFS-04] 建立状态一致性与删除契约自动化测试 — test-engineer — 验收完成
- [TASK-KFS-05] 执行隔离数据验收与页面验证 — test-engineer — 真实只读验收完成
- [TASK-KFS-06] 同步关键词过滤与图谱设计文档 — doc-writer — 同步完成
- [TASK-KFS-07] 汇总状态收敛任务进展与风险 — reporter — 汇总完成
- [TASK-RKE-02] keyword_analysis 免模型预检与启动 — backend-worker/frontend-worker/test-engineer/doc-writer — 验收完成
- [TASK-DIR-01] 允许已部分完成的中断下载进入知识加工 — backend-worker/frontend-worker/test-engineer/doc-writer — 完成（真实 API 部分验证）
- [TASK-SAP-01] 大批次扫描与知识加工启动可观察性修复 — 单 Agent — 完成（隔离真实 API 验证）
- [TASK-BUG-JSON-RACE-01] 知识加工产物并发竞争与错误隔离修复 — 多角色 — 核心真实 API 验证完成
- [TASK-BUG-JSON-RACE-P0-01] 冻结快照与协调接口契约 — doc-writer/backend-worker — 完成
- [TASK-BUG-JSON-RACE-P0-02] 实现原子仓储与批次协调器 — backend-worker — 完成
- [TASK-BUG-JSON-RACE-P0-03] 将资料准备改为不可变两阶段快照 — backend-worker — 完成
- [TASK-BUG-JSON-RACE-P0-04] 实现已提交快照读取与损坏隔离 — backend-worker/test-engineer — 完成
- [TASK-BUG-JSON-RACE-P0-05] 元数据构建显式消费准备快照 — backend-worker — 完成
- [TASK-BUG-JSON-RACE-P0-06] 接通训练快照链路与原子准入 — backend-worker — 完成
- [TASK-BUG-JSON-RACE-P1-01] 并发故障注入与真实 API 验收 — test-engineer/doc-writer/reporter — 核心验收完成

## 🔄 进行中

- （无）

## ⏳ 待开始

- [TASK-001] 多角色编排框架搭建 — 框架初始化 — 预计 08-04
- [TASK-002] 端到端编排验证 — 全流程测试 — 预计 08-05 — 依赖 TASK-001
- [TASK-003] 知识库构建 Pipeline 优化 — backend-worker — 待拆解
- [TASK-RKE-01] 将主页知识提取切换为纯规则提取 — backend-worker/test-engineer/doc-writer — 待人类确认架构与产物契约

## 🚫 阻塞

（无）

---

## 📁 项目模块索引

| 模块 | 路径 | 状态 |
|------|------|------|
| Agent Runner | `agent-runner/` | 已搭建，待优化 |
| PingCode 后端 | `scripts/pingcode/web/backend/` | 已搭建，待完善 |
| PingCode 前端 | `scripts/pingcode/web/frontend/` | 已搭建，待完善 |
| 设计文档 | `docs/` | 20+ 篇设计文档 |
| 知识提取 | `scripts/pingcode/web/backend/app/agents/` | 基础实现 |
| 提示词生成器 | `prompt-generator.html` | 已实现 |
| TrainingService 重构 | `scripts/pingcode/web/backend/app/training_service.py` | Phase 0-2 有条件通过 |
| 关键词过滤状态收敛 | `scripts/pingcode/web/backend/app/training_service.py`、`QualityPage.vue` | 已完成，真实批次仅只读验收 |
| 主页规则知识提取 | `scripts/pingcode/web/backend/app/training_service.py`、`PreprocessPage.vue` | 默认 `keyword_analysis` 已完成免模型预检与启动；`formal_knowledge` 规则化仍待人类确认 |
| 部分下载加工准入 | `scripts/pingcode/web/backend/app/training_service.py`、`PreprocessPage.vue` | 已完成；聚焦测试 12 项及前端构建通过，真实 API 仅完成准入验证，尚未创建真实加工任务 |
| 大批次扫描与加工启动 | `services.py`、`training_service.py`、`PreprocessPage.vue` | 已完成；异步扫描、报告恢复、轻量预检和隔离批次加工验证通过 |
| 产物快照并发修复 | `preparation_service.py`、`metadata_service.py`、`artifact_repository.py`、`store.py`、`training_service.py` | 核心实现与真实 API 验证完成；规模性能待复测 |

## 🔗 设计文档清单

| 编号 | 文档 | 对应任务方向 |
|------|------|-------------|
| 00 | 概要设计 | 全局架构 |
| 01 | PingCode资料预处理步骤详细设计 | 预处理 |
| 02 | 前端设计 | 前端开发 |
| 12 | 知识提取步骤详细设计 | 知识提取 |
| 13 | 按需语义补充步骤详细设计 | 语义补充 |
| 18 | 知识提取与构建测试设计 | 测试 |
| 19 | 工程化任务拆分 | 工程管理 |
| 20 | 质量分析页面三层重构设计 | 前端质量页面 |
| 21 | TrainingService 分层重构详细设计 | Phase 0-2 重构 |
