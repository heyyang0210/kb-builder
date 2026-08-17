# TASK-RAG-KG-RG10：ACL 继承矩阵、默认拒绝与审计事件

## 元信息
- 状态: review
- 分配: security-worker + backend-worker
- 计划窗口: 2026-08-19（不超过 4h）
- 依赖: RG-05；TASK-RAG-KG-RG02-acl-audit.md
- 文件归属: `agent-runner/docs/modules/knowledge-graph-governance/development/08-acl-inheritance-contract.md`、本任务卡
- 并行: 可与 RG-08/09/11/12/13 并行；RG-14 依赖本卡
- 需人类确认: 需确认部署身份来源、数据集 ACL 继承粒度和审计存储位置

## 目标与范围
定义 dataset/resource/source/chunk/evidence/graph/index/query/publish/delete 的 ACL 继承矩阵。默认拒绝、默认禁止跨数据集；所有读取、写入和导出均执行授权并写最小审计事件。

## 交付与验收
- [x] 输出主体×资源×动作矩阵，明确 allow/deny/condition 和跨数据集行为。
- [x] 定义匿名、未知、直接 ID、历史版本、共享链接和服务账号规则。
- [x] 定义统一授权失败错误码、审计事件字段、关联 requestId/datasetId/versionId。
- [x] 给出查询过滤伪代码，证明 ACL 过滤先于图遍历、召回和证据返回。
- [x] 测试矩阵覆盖跨库、直接 ID、匿名访问、发布/删除和历史证据越权。

## 未决项
当前服务是否已有可信身份中间件、ACL 是否继承到 resource 级、审计日志保留和脱敏标准需 G2/安全确认；未确认不得声称多租户安全。详见 [08-acl-inheritance-contract.md](../../../agent-runner/docs/modules/knowledge-graph-governance/development/08-acl-inheritance-contract.md)。
