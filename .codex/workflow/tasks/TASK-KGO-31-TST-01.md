# TASK-KGO-31-TST-01: 验收版本治理与质量运营

## 元信息
- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-31-BE-01、TASK-KGO-31-BE-02、TASK-KGO-31-BE-03、TASK-KGO-31-FE-01
- 父任务: TASK-KGO-REQ-31
- 需人类确认: 否
- 可并行: 否

## 需求描述
使用隔离正式知识数据集真实调用发布和全部版本 API，验证创建边界、幂等、不可变、损坏隔离、warning 语义、差异、趋势、旧客户端兼容和中文运营页面。

## SMART 验收标准
- [x] 4 小时内完成组合回归、真实发布/API、性能、构建和页面验收。
- [x] 证明非正式发布、运行、复核和 apply 不生成版本，final_knowledge 发布只生成一个版本。
- [x] 覆盖并发重试、原子失败、文件损坏、哈希不一致和其他版本隔离。
- [x] warning 不阻断发布，旧发布响应消费者和旧图谱接口继续通过。
- [x] diff 汇总/明细一致，趋势规则分段正确，版本探索无悬空边。
- [x] 列表/趋势 P95 < 500ms，千级 diff P95 < 1s；目标文件 `git diff --check` 通过。
- [x] 写入仅使用隔离正式知识数据集，目标业务批次只读。

## 放行证据
- 测试报告包含真实 HTTP API 命令、通过数量、失败重现步骤和性能原始样本。
- 范围保护记录确认 batch_dc23fc9141ba4d6f 未执行发布、apply 或版本写入。
- 失败项按 BE/FE 归属回交，不在测试任务中直接改生产代码；全部通过后才可关闭父任务。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/tests/test_graph_version_routes.py`
- 可独占新增前端测试文件；生产缺陷回交对应 Worker。
- 不直接修改生产代码。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-31.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/03-version-governance-quality-operations-design.md`

## 完成记录

- 真实 FastAPI HTTP 组合回归 `25/25` 通过，覆盖发布边界、8 路并发幂等、损坏隔离、diff、trends、checks 和旧接口回归。
- 1000 知识节点、1000 文档块、1000 关系基线：列表 P95 `3.69ms`，趋势 P95 `3.65ms`，diff P95 `193.72ms`。
- 前端 `npm run build` 通过；Playwright 验证空版本和隔离两版数据，发布 warning、规则分段、差异明细、局部图入口和 URL 恢复可用。
- 1440px 桌面与 390px 移动端无控制台错误、无 4xx、无横向溢出。
- `batch_dc23fc9141ba4d6f` 未执行发布、apply 或版本写入；工作区无关尾随空格问题单独保留。
