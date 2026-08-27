# TASK-TRAINING-8053-DUPLICATE-RESOURCE-FIX: 下载资源主键幂等与历史清单修复

## 元信息

- 角色: Backend Worker
- 状态: 后端实现及单元回归完成，待真实 API 验收
- 日期: 2026-08-07
- 关联风险: `RISK-TRAIN-8053-003`
- 现场任务: `training_ae4e8832ee134652`
- 目标批次: `batch_dc23fc9141ba4d6f`
- 变更性质: 既有输入不变量修复；不改公共 API、架构、依赖或模型边界
- 人工确认: 已获授权实施；真实批次启动由任务负责人统一编排

## 实施结果

- `pages_for_batch` 按页面 ID 保持首次出现顺序归一化；完全相同页面折叠，冲突页面明确失败。
- 下载页内资源与历史完成记录按稳定资源 ID 归一化；`items.jsonl` 保留历史，`resources.json` 只发布唯一无冲突视图。
- 下载归一化问题分别写入 `resource-issues.jsonl` 和 `resource-view-issues.json`，缺失 ID、完全重复、冲突分别使用独立错误码。
- Preparation 在计算执行哈希前归一化历史输入，完全相同记录额外校验文件 SHA-256 后折叠，冲突组隔离，其他资源继续处理。
- Preparation 提交前断言 `source-resources.resourceId`、`source-documents.resourceId`、`chunks.chunkId` 唯一；Metadata 严格校验保持不变。

## 自动化验证记录

- 新增 8 个定向用例，红灯确认旧实现缺陷后全部转绿。
- `python3 -m unittest tests.test_core`: 44/44 通过。
- `python3 -m unittest tests.test_training_service`: 75/75 通过。
- `python3 -m py_compile ...`: 通过。
- `python3 -m unittest tests.test_material_preparation`: 35 项中 34 项通过；唯一失败为既有 `test_structure_split_preserves_heading_offsets_and_neighbors_after_exclusion` 切块长度问题，与本修复无关。

## 根因结论

1. 下载任务收到重复页面：`pages.jsonl` 8,494 条、8,053 个唯一页面，357 个重复页面 ID、441 条额外记录；选择快照的 8,053 个页面 ID 全部唯一。
2. `PingCodeService.pages_for_batch` 只过滤、不按页面 ID 归一化，使缓存/API 原始列表重复项被同一任务重复处理。
3. 同页重复图片引用也未归一化，产生 203 个额外的重复 `page_asset` ID。
4. `_rewrite_resources_from_state` 原样物化 append-only 完成记录；preparation 逐条处理，metadata 严格唯一性检查最终失败。

## 推荐方案

- 下载入口：页面按 `pageId`、页面资源按稳定 `resourceId` 幂等归一化。
- `resources.json`：从 append-only `items.jsonl` 生成唯一当前视图，历史审计记录不删除。
- Preparation：处理历史清单前防御归一化；完全相同重复折叠并写 warning，同 ID 冲突组整体隔离并写 error。
- Metadata：继续严格校验，不增加静默去重。

这是一组最小的内部不变量修复。只改入口不能修复现有批次，只改 preparation 不能阻止后续清单继续膨胀，因此两层都必须实施。

## 文件归属

实施阶段串行修改：

- `scripts/pingcode/web/backend/app/pingcode_service.py`: 页面列表唯一化。
- `scripts/pingcode/web/backend/app/services.py`: 页面资源和 `resources.json` 当前视图唯一化。
- `scripts/pingcode/web/backend/app/preparation_service.py`: 历史清单防御归一化和质量问题。
- `scripts/pingcode/web/backend/tests/test_core.py`: 下载入口和重试历史测试。
- `scripts/pingcode/web/backend/tests/test_material_preparation.py`: preparation 重复/冲突测试。

`metadata_service.py` 不修改行为，只复用现有严格校验作为回归断言。

## 接口伪代码

```text
normalize(records, key, identity, fingerprint):
  preserve first-seen order
  for each key group:
    if key missing: isolate + SOURCE_RESOURCE_ID_MISSING
    elif all identity and fingerprints equal:
      keep one + DUPLICATE_SOURCE_RESOURCE_COLLAPSED
    else:
      keep none + SOURCE_RESOURCE_ID_CONFLICT
  return records, issues

download:
  pages = normalize(raw selected pages, pageId)
  resources = normalize(page resources, resourceId)
  append audit history to items.jsonl
  atomically publish unique current resources.json

preparation:
  normalized, issues = normalize(files.records(batchId), resourceId)
  executionHash includes normalized input and conflict issue fingerprints
  process normalized records once
  assert all output primary keys unique before commit
```

## 测试

- 重复相同页面只下载一次；冲突页面 ID 明确失败。
- 同页重复图片引用只生成一个资源，多个正文引用仍有效。
- 重试历史可以重复，`resources.json` 主键必须唯一。
- preparation 相同重复折叠且不减少唯一正文；冲突组隔离，其他资源继续。
- `source-resources/source-documents/chunks` 主键唯一，metadata 严格校验通过。
- 目标批次新快照中 363 个输出重复 ID 清零，唯一文档数不低于 10,100。
- 运行 `py_compile`、定向单测、相关回归、`git diff --check`，再由 Test Engineer 真实 API 验收。

## 残余风险

- 当前刷新后的 `YASDOC` 空间索引已唯一，无法还原下载当时重复原始列表究竟来自旧缓存还是远端响应；入口按 ID 归一化可同时覆盖两种来源。
- 同 ID 冲突必须隔离，不能按第一条/最后一条覆盖；冲突资源需要人工决定是否重新下载。
