# PingCode 加工 Prompt 管理实现设计

> 版本：v1.0  
> 日期：2026-07-24  
> 状态：Phase 2A 实现设计

## 1. 实现范围

本阶段在只读 Prompt Registry 之上实现文件化 Prompt 管理闭环：

- 创建和更新草稿；
- `revision` 乐观锁；
- 模板变量、敏感信息和 Skill Schema 校验；
- 不调用模型的样例渲染预览；
- 发布为不可变的新 Skill/Prompt 版本；
- 已发布版本之间的 Diff；
- 使用 `actorId` 记录操作者，但暂不启用登录和真实权限校验。

本阶段不实现 Processing Worker、真实 Provider、Embedding、SSE 运行事件和前端 Monaco 编辑器。样例试运行明确标记为 `render_only`，不伪造模型输出。

## 2. 文件存储

已发布内容继续保存于 `tools/knowledge-processing/pingcode-processing/skills/`。草稿保存于配置项 `PINGCODE_PROCESSING_PROMPT_DRAFT_ROOT`，默认位于 Web 数据根目录：

```text
runtime/web/processing/prompt-drafts/<draft-id>/
├── draft.json
└── content.md
```

`draft.json` 保存元数据，不保存正文：

```json
{
  "id": "prompt_draft_xxx",
  "promptId": "knowledge-extraction.user",
  "skillId": "knowledge-extraction",
  "promptName": "user",
  "baseVersion": "1.0.0",
  "revision": 1,
  "status": "draft",
  "actorId": "local-operator",
  "contentFile": "content.md",
  "contentHash": "sha256:...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

发布不修改旧版本，而是在 Skill 目录下创建 `versions/<new-semver>/`，复制基础 Skill 的 Schema、`SKILL.md` 和其他 Prompt，仅替换当前 Prompt 内容并更新 Manifest 版本。发布目录通过临时目录完成后原子改名，避免 Registry 读取半成品。

## 3. 校验规则

### 3.1 模板变量

变量格式为 `{{variable_name}}`，变量名必须是小写蛇形命名。变量集合从对应 Skill 的 `inputSchema.properties` 推导：`documentTitle` 映射为 `document_title`。未在 Schema 中声明的变量、未闭合的大括号和空变量均失败。

### 3.2 敏感信息

发布前扫描 API Key、密码、Cookie、Bearer Token、私钥块和常见 `sk-` 凭据模式。发现疑似凭据时禁止发布；普通“token”概念描述不因没有赋值而误报。

### 3.3 内容和版本

- 内容必须是有效 UTF-8 且非空；
- 草稿必须绑定已发布 Prompt 和基础版本；
- 发布版本必须是合法 SemVer 且高于该 Skill 的最高已发布版本；默认递增 patch 版本；
- 发布前必须重新加载 Registry，不能信任客户端传入的 Skill 或文件路径；
- 发布成功后草稿状态变为 `published`，旧版本内容不可变。

## 4. API 契约

```text
POST /api/processing/prompts/{promptId}/drafts
PUT  /api/processing/prompt-drafts/{draftId}
GET  /api/processing/prompt-drafts/{draftId}
POST /api/processing/prompt-drafts/{draftId}/validate
POST /api/processing/prompt-drafts/{draftId}/test
POST /api/processing/prompt-drafts/{draftId}/publish
GET  /api/processing/prompts/{promptId}/versions/{version}/diff
```

创建请求可省略 `content`，此时复制基础已发布 Prompt；更新请求必须携带 `If-Match: <revision>`，也允许 JSON 字段 `revision` 作为脚本客户端兼容方式。发布和验证请求接收可选 `actorId`，默认 `local-operator`。

错误码：

- `PROMPT_DRAFT_NOT_FOUND`：草稿不存在；
- `PROMPT_DRAFT_CONFLICT`：`If-Match` 与当前 revision 不一致；
- `PROMPT_VALIDATION_FAILED`：草稿校验失败；
- `PROMPT_PUBLISH_CONFLICT`：目标版本已存在或不是递增版本；
- `PROMPT_REGISTRY_INVALID`：已发布文件本身不合法。

## 5. 接口和伪代码

```python
def create_draft(prompt_id, content=None, base_version=None, actor_id="local-operator"):
    base = prompt_registry.get(prompt_id, base_version)
    draft_content = content if content is not None else base.content
    validate_utf8_and_non_empty(draft_content)
    return draft_store.create(base, draft_content, actor_id)

def update_draft(draft_id, content, expected_revision):
    draft = draft_store.get(draft_id)
    if draft.revision != expected_revision:
        raise RevisionConflict()
    validate_utf8_and_non_empty(content)
    return draft_store.update(draft_id, content, draft.revision + 1)

def validate_draft(draft_id):
    draft = draft_store.get(draft_id)
    base = prompt_registry.get(draft.prompt_id, draft.base_version)
    return validator.validate(draft.content, base.input_schema)

def publish_draft(draft_id):
    result = validate_draft(draft_id)
    if not result.passed:
        raise ValidationFailed(result)
    target = next_patch_version(skill_registry.list_versions(draft.skill_id))
    publish_atomic_copy(base_skill, target, draft.prompt_name, draft.content)
    return prompt_registry.get(draft.prompt_id, target)
```

## 6. 样例试运行和 Diff

`test` 接口只解析变量并返回 system/user 的渲染结果、变量清单和校验结果，响应中的 `executionMode` 固定为 `render_only`，`provider` 和 `model` 为 `null`。真实模型试运行待统一 Provider 阶段接入。

Diff 默认比较指定版本与其前一个已发布版本，也支持 `fromVersion` 查询参数；若没有前一个版本，返回空的基线并标记 `hasPrevious=false`。Diff 内容只来自 Registry，不能读取任意路径。

## 7. 验收

1. 四个首批 Skill 均可创建草稿并读取原始 Prompt；
2. 并发更新使用错误 revision 时返回 409，原内容不被覆盖；
3. 未声明变量、疑似凭据、空内容和非法版本不能发布；
4. 发布生成新 Skill/Prompt 版本，旧版本详情和哈希保持不变；
5. 样例试运行不调用模型且明确返回 `render_only`；
6. 真实后端 API 完成创建、更新、校验、测试、发布、详情和 Diff 全流程验证。

