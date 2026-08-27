# TASK-RAG-KG-M2-LIN-2C-FRZ-TST-01：dataset 请求时冻结适配红灯测试

## 元信息

- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-18
- 预计完成: API-DES-01 完成后 2h
- 父任务: TASK-RAG-KG-M2-LIN-2C-API-01
- 依赖: TASK-RAG-KG-M2-LIN-2C-API-DES-01
- 需人类确认: 否（只使用隔离 fixture）
- 可并行: 可与 KRN-TST-02 并行；仅新增独立测试文件
- 文件归属: `scripts/pingcode/web/backend/tests/test_keyword_rebuild_input_snapshot.py`

## SMART 目标

在 2 小时内以隔离 data root 固化 dataset 身份、路径、关联、内容和稳定摘要边界，测试失败必须指向尚未实现的冻结适配器。

## 验收标准

- [x] 覆盖缺文件、跨 batch、非 keyword/candidate、manifest/store/task 矛盾。
- [x] 覆盖路径穿越、symlink、摘要漂移、chunk 跨 resource 和 offset/content 不一致。
- [x] 同一事实生成稳定 `inputDigest`，任一字节变化改变摘要或被拒绝。
- [x] 旧 dataset 文件 bytes/SHA-256/mtime 全部不变。
- [x] 任何 `latest` 读取使测试失败；`py_compile` 和目标文件空白检查通过。

## 验收记录

- 新增 14 个测试方法、22 个失败断言；全部失败均明确指向 `KeywordRebuildInputFreezer` 尚未实现，非 fixture/环境错误。
- 使用真实 `TemporaryDirectory + LocalArtifactRepository + JsonStore`，不修改业务代码、既有测试或源 dataset。
