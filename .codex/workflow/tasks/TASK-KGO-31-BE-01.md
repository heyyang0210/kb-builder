# TASK-KGO-31-BE-01: 建立不可变图谱版本仓储

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-REQ-30 completed
- 父任务: TASK-KGO-REQ-31
- 需人类确认: 否
- 可并行: 否（先冻结版本事实模型）

## 需求描述
实现 GraphVersionRepository，以 staging、哈希校验和原子提交保存 manifest、nodes、edges、summary 和 checks，提供按稳定版本 ID 的读取和列表基础能力。

## SMART 验收标准
- [x] 4 小时内完成仓储、manifest 模型、原子性和损坏隔离测试。
- [x] 版本包含 dataset/batch/task/filter lineage、schema/rules 版本、计数和全部文件哈希。
- [x] 提交前校验计数、哈希和关系端点；提交后目录不可原地修改。
- [x] 相同发布幂等键只返回同一版本，不重复创建目录。
- [x] 单个版本损坏返回结构化错误，不影响其他版本列表和读取。
- [x] 不复制完整文档正文，不引入新依赖。

## 放行证据
- 依赖证据：REQ-30 组合回归及真实 API 验收记录，确认运行级 revision 与正式版本边界。
- 输出证据：仓储定向测试覆盖 staging/commit、重复幂等、哈希篡改和单版本损坏隔离；提交目录清单和 manifest 样例。
- 性能证据：版本列表基础读取 P95 记录；如未达到目标，记录规模、复现命令和后续措施。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/app/repositories/graph_version_repository.py`
- 独占新增版本模型辅助文件；不修改 `main.py`、发布服务、前端和运行历史。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-31.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/03-version-governance-quality-operations-design.md`

## 完成记录

- 变更：`app/repositories/graph_version_repository.py`、`app/repositories/__init__.py`、`app/repositories/README.md`。
- 幂等：8 路并发创建只产生 1 个正式版本目录，其他调用读取同一 manifest。
- 完整性：读取校验全部产物哈希、计数、稳定 ID、关系端点和来源指纹；篡改单版本返回 `GRAPH_VERSION_CORRUPTED`，其他版本正常读取。
- 安全边界：完整正文、Prompt、上下文全文不进入版本，证据摘录限制为 500 字符。
- 性能：版本列表 HTTP P95 `4.03ms`。
