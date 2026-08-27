# TASK-KPG-03：实现企业能力包加载器与运行上下文

## 元信息

- 任务编号：TASK-KPG-03
- 标题：实现企业能力包加载器与运行上下文
- 状态：已完成
- 分配：Node Backend Worker / Python Backend Worker / Test Engineer
- 依赖：TASK-KPG-02
- 需人类确认：否
- 可并行：否，先冻结共享行为，再分别实现两端加载器
- 文件归属：Node/Python 配置加载模块、单元测试和运行上下文内部 DTO
- 参考文档：`enterprise-profile/v1` Schema 与契约测试

## 目标

使用 `KNOWLEDGE_PLATFORM_PROFILE` 加载同一企业能力包，在两套后端生成一致的规范化配置、脱敏运行上下文和配置指纹。

## 工作内容

1. 实现选择、读取、Schema 校验、引用解析和规范化。
2. 使用确定性序列化计算配置指纹，明确跨语言字符和排序规则。
3. 配置无效时 fail-fast，不静默退回代码硬编码。
4. 运行上下文只暴露展示和能力信息，不暴露敏感字段与绝对路径。

## 验收标准

- [x] Node 与 Python 对同一能力包输出相同语义和配置指纹。
- [x] 未设置环境变量时按兼容规则选择 YashanDB；显式非法值启动失败。
- [x] 非法引用和敏感字段测试覆盖，错误与上下文不泄露配置秘密和绝对路径。
- [x] 既有服务在加载默认能力包后可启动，尚未迁移的业务行为保持不变。

## 执行日志

2026-08-27 完成：

- Node 新增 `lib/platform-profile/`，Python 新增 `app/platform_profile/`，实现受控 ID 选择、JSON/Schema/语义校验、真实路径和符号链接校验、规范化、资源摘要、配置指纹与脱敏上下文。
- 两端在创建业务目录和单例前加载默认能力包；显式空值、未知 ID 和非法 ID 均 fail-fast，不回退默认包。
- Node 使用仅覆盖本契约关键字的仓库自有校验器，与 Python `jsonschema` 共享 fixture 对账，不新增外部依赖。
- Node 19 项聚焦测试、Python 6 项测试通过；默认包两端指纹均为 `sha256:d676cbe5dd461814571825b1e9a6cf6c7679f13d8b4f9113359dc01b387fedac`。
- 真实启动：Node 隔离端口 4199 `/api/health` 返回 200；Python 隔离数据根和端口 8091 `/api/health` 返回 200；显式空 profile 两端进程均非零退出。
- TASK-KPG-04 必须按真实资源种类扩充精确允许根，并冻结连接器类型与最低密钥策略；本任务不臆造供应商配置。
