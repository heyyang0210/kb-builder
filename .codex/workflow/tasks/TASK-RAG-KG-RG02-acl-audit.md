# TASK-RAG-KG-RG02：图谱、证据和数据集 ACL 只读核验

## 角色

Security/Architect（Project Manager 收口）

## 核验范围

检查数据集、图谱、证据、文件预览、发布和删除入口是否继承权限；不修改公共 API，不新增认证系统。

## 核验结果（2026-08-17）

`scripts/pingcode/web/backend/app/main.py` 中以下入口没有发现 `Authorization` 参数、用户/空间权限校验或数据集 ACL 依赖：

- `GET /api/datasets/{datasetId}/graph/summary`
- `GET /api/datasets/{datasetId}/graph/observability`
- `GET /api/datasets/{datasetId}/graph/search`
- `GET /api/datasets/{datasetId}/graph/explore`
- `GET /api/datasets/{datasetId}/graph/evidence`
- `GET /api/files/{resourceId}/metadata`
- `GET /api/files/{resourceId}/preview`
- `GET /api/files/{resourceId}/content`
- `GET /api/files/{resourceId}/download`
- `POST /api/datasets/{datasetId}/publish`
- `DELETE /api/datasets/{datasetId}`

当前 `upload_token()` 固定返回空字符串，授权逻辑只出现在上传服务，不能证明图谱和文件访问已继承同一权限边界。

## 风险判定

`P0 blocked`：在存在共享网络访问或多数据集场景时，已知资源 ID 可能直接读取图谱、证据或原文件；目前不能证明跨数据集隔离和匿名访问安全。

## 处置建议

1. 在 G0 明确当前部署是否仅限可信本机；即使是本机，也应把未认证状态作为显式风险。
2. RG-10/RG-20 设计统一的 ACL 继承矩阵和默认拒绝策略，覆盖图谱、证据、文件、发布、删除和检索。
3. 在 ACL 契约冻结前，不允许将图谱或正式知识库宣称为多租户生产能力。

## 验收状态

`completed_with_p0_risk`：核验已完成，发现阻断性风险；不代表安全整改完成。
