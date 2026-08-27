# reconcile-docs Skill 开发设计

> documentType: development-design
> moduleId: platform-foundation
> owner: Architect / Backend Worker / Test Engineer
> status: approved
> version: 1.0.0
> updatedAt: 2026-08-17

## 1. 范围

实现仓库内 `skills/reconcile-docs/`，支持上下文就绪检查、项目快照、增量/全量审计输入采集、文档验证和成功检查点推进。Skill 使用证据驱动三方对账形成修改建议；业务含义不确定时必须交互确认。

不实现定时调度平台、不自动提交、不修改业务代码，也不把提交信息或模型知识当作批准需求。

## 2. Skill 结构

```text
skills/reconcile-docs/
├── SKILL.md
├── agents/openai.yaml
├── scripts/
│   ├── reconcile_docs.py
│   └── reconcile_core/
│       ├── contracts.py
│       ├── git_context.py
│       └── reconciliation.py
├── references/
│   ├── reconciliation-rules.md
│   └── output-contracts.md
└── assets/
    ├── governance-policy.template.json
    ├── change-context.template.json
    ├── impact-report.template.md
    └── verification-report.template.md
```

Skill 不创建 README 或安装说明。

## 3. CLI 契约

```text
python3 skills/reconcile-docs/scripts/reconcile_docs.py readiness
python3 skills/reconcile-docs/scripts/reconcile_docs.py refresh
python3 skills/reconcile-docs/scripts/reconcile_docs.py audit --mode incremental
python3 skills/reconcile-docs/scripts/reconcile_docs.py audit --mode full
python3 skills/reconcile-docs/scripts/reconcile_docs.py answer --run-dir <path> --question-id <id> --decision <accept|reject|defer> --reason <text> --operator <name>
python3 skills/reconcile-docs/scripts/reconcile_docs.py validate --run-dir <path>
python3 skills/reconcile-docs/scripts/reconcile_docs.py checkpoint --run-dir <path> --confirmed
python3 skills/reconcile-docs/scripts/reconcile_docs.py selftest
```

公共参数：`--repo`、`--config`、`--context-root`、`--output`。默认从 Git 根目录解析相对路径，脚本仅使用 Python 标准库。

## 4. 核心契约

### 4.1 运行冻结

启动时读取 `runStartHead=git rev-parse HEAD`。增量模式从检查点的 `lastSuccessfulRef` 开始；没有检查点时返回 `BOOTSTRAP_REQUIRED`，由用户确认以当前 HEAD 建立基线或指定历史 commit。

### 4.2 工作区分类

记录 Git porcelain 状态、路径和状态码。所有启动时未提交变化标记为 `preExisting=true`，不得推断属于某个任务。审计过程中生成的运行报告位于配置的审计目录，不纳入业务变更。

### 4.3 三方对账状态

| 状态 | 条件 | 行为 |
|---|---|---|
| `ALIGNED` | 需求、实现、验证和文档一致 | 不修改 |
| `UPDATE_CANDIDATE` | 意图明确、实现和证据一致、文档落后 | 生成草案，修改前确认 |
| `TARGET_NOT_IMPLEMENTED` | 已批准设计存在但实现缺失 | 只更新进度，不写成当前能力 |
| `UNVERIFIED_IMPLEMENTATION` | 实现存在但缺验证证据 | 记录风险，不标记 verified |
| `NEEDS_CONFIRMATION` | 原因缺失、事实冲突、模块或公共契约变化 | 阻断正式改写并批量提问 |

### 4.4 检查点

用户通过 `answer` 记录问题 ID、决策、原因、操作者和时间；`defer` 保持阻断。只有 `validate` 返回通过、审计报告无阻断项且调用者显式提供 `--confirmed` 时才能执行 `checkpoint`。使用同目录临时文件、`fsync` 和 `os.replace` 原子更新，保存前后引用、规则版本、报告路径和时间。

## 5. 配置契约

项目配置使用 JSON，避免新增 YAML 依赖。主要字段：

```json
{
  "schemaVersion": "doc-governance/v1",
  "contextRoot": ".codex/context/reconcile-docs",
  "auditRoot": ".codex/workflow/audits/documentation",
  "modules": {
    "outline-management": {
      "codeGlobs": [],
      "documentGlobs": [],
      "intentGlobs": [],
      "verificationGlobs": []
    }
  },
  "inventory": {
    "include": [],
    "exclude": []
  },
  "structuralInvalidators": [],
  "requiredDocumentMetadata": ["documentType", "moduleId", "owner"]
}
```

模块、路径、忽略项和规则版本均来自配置，业务代码中不得散落硬编码。

## 6. 伪代码

```text
run_audit(mode):
  repo = locate_git_root()
  policy = load_and_validate_policy()
  runStartHead = git_head(repo)
  checkpoint = load_checkpoint_if_present()
  readiness = evaluate_readiness(checkpoint, runStartHead, policy)
  if readiness requires bootstrap or confirmation:
      emit questions and stop without checkpoint mutation

  snapshot = refresh_snapshot(repo, runStartHead, policy)
  range = checkpoint.lastSuccessfulRef..runStartHead if incremental else full scope
  changes = collect_git_changes(range)
  worktree = collect_preexisting_worktree_changes()
  context = map_changes_to_modules_and_evidence(changes, policy)
  write machine context and human impact report
  return NEEDS_CONFIRMATION when intent or evidence cannot determine business meaning

advance_checkpoint(runDir, confirmed):
  require confirmed
  require verification passed
  require no blocking unresolved items
  atomically replace checkpoint with runStartHead and evidence references
```

## 7. 交互确认

Skill 将同类问题合并后询问，避免逐文件打断。以下事项必须确认：基线缺失或非祖先、行为变化无业务原因、需求/代码/文档冲突、公共 API 或模块边界变化、需要把目标设计改成已实现、需要移动或删除文档、真实验证与验收冲突。

用户回答必须记录问题 ID、选择、补充原因、操作者和时间。未回答的问题保持 `NEEDS_CONFIRMATION`。

## 8. 验证

- `quick_validate.py` 验证 Skill 元数据和目录。
- `py_compile` 验证全部 Python 文件。
- `selftest` 使用临时 Git 仓库覆盖首次、增量、无变化、脏工作区、非祖先基线和检查点失败场景。
- 在真实仓库只运行 `readiness/refresh/audit`，不得推进检查点或修改业务文档。
- 独立 Agent 前向测试覆盖一致、无原因变化、目标未实现和实现未验证四类任务。
- 目标 Markdown 链接和 `git diff --check` 通过，既有无关问题单独报告。
