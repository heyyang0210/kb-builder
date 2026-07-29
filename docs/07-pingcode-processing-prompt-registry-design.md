# PingCode 加工 Prompt 文件 Registry 设计

> 版本：v1.0  
> 日期：2026-07-24  
> 状态：第一阶段只读查询设计

## 1. 目标与边界

本阶段只解决 Prompt 的发现、版本查询、内容查看和文件映射校验，不实现以下能力：

- Prompt 草稿保存、编辑器和乐观锁；
- Prompt 变量解析、敏感信息扫描和模型试运行；
- Prompt 发布、回滚和权限控制；
- LLM、Embedding 或 Processing Worker 调用。

Prompt 和 Skill 的权威源先使用仓库文件。未来接入 YashanDB 时，只替换 Registry 的存储适配器，保持 API 返回结构不变。

## 2. 文件约定

当前 Prompt 复用 Skill 版本目录，不额外复制 Prompt 文件：

```text
scripts/pingcode/processing/skills/<skill-id>/
├── skill.yaml
├── SKILL.md
├── prompts/
│   ├── system.md
│   └── user.md
└── schemas/
```

版本也可以放在：

```text
scripts/pingcode/processing/skills/<skill-id>/versions/<semver>/
├── skill.yaml
├── prompts/<name>.md
└── schemas/
```

`skill.yaml` 中的 `prompts` 映射是唯一文件映射来源：

```yaml
id: knowledge-extraction
version: 1.0.0
status: published
prompts:
  system: prompts/system.md
  user: prompts/user.md
```

约束如下：

1. Prompt ID 固定为 `<skill-id>.<prompt-name>`，例如 `knowledge-extraction.system`；不把文件名当作全局 ID。
2. Prompt 的 `skillId` 来自 Manifest 的 `id`，`skillVersion` 来自 Manifest 的 `version`。
3. Prompt 的版本与所属 Skill 版本相同，当前不允许 Prompt 独立于 Skill 发布。
4. `prompt-name` 只允许小写字母、数字、`-` 和 `_`，且必须以小写字母开头。
5. 路径必须是相对路径，禁止绝对路径、目录穿越、符号链接越出当前 Skill 版本目录。
6. 文件必须是有效 UTF-8 且去除 BOM 后仍有非空内容；换行和正文不在 Registry 阶段改写。
7. 只读取 `status: published` 的 Skill，因此草稿和废弃版本不会出现在只读 Prompt API 中。
8. 如果版本目录存在，目录名必须是合法 SemVer 且与 Manifest 的 `version` 一致。

## 3. 数据模型

### 3.1 PromptSummary

```json
{
  "id": "knowledge-extraction.system",
  "skillId": "knowledge-extraction",
  "skillVersion": "1.0.0",
  "name": "system",
  "status": "published",
  "contentHash": "sha256:...",
  "contentLength": 1234,
  "file": "prompts/system.md"
}
```

`contentHash` 用于运行快照、Diff 和缓存校验；`file` 是相对于 Skill 版本目录的逻辑路径，不返回服务器绝对路径。

### 3.2 PromptDetail

Prompt 详情在摘要基础上增加：

- `content`：UTF-8 原始 Prompt 内容；
- `manifest`：所属 Skill Manifest 中与该 Prompt 相关的只读元数据；
- `skillMarkdown` 不在 Prompt 详情重复返回，调用方通过 Skill 详情接口获取。

## 4. Registry 接口

```text
GET /api/processing/prompts
GET /api/processing/prompts?skillId=knowledge-extraction
GET /api/processing/prompts?skillId=knowledge-extraction&version=1.0.0
GET /api/processing/prompts/knowledge-extraction.system
GET /api/processing/prompts/knowledge-extraction.system?version=1.0.0
```

列表接口返回所有已发布 Prompt 版本，支持 `skillId` 和 `version` 过滤；不传过滤条件时按 `id`、SemVer 升序返回。详情不传版本时返回指定 Prompt 的最高已发布版本，传版本时必须精确匹配。

错误语义与 Skill Registry 保持一致：

- `404 PROMPT_NOT_FOUND`：Prompt 或指定版本不存在；
- `500 PROMPT_REGISTRY_INVALID`：文件映射、编码、版本或内容校验失败。

## 5. 校验流程伪代码

```text
list_prompts(skill_id?, version?):
    skills = skill_registry.list_published()
    for skill in skills:
        if filter does not match skill: continue
        validate skill version directory when present
        for name, relative_file in skill.manifest.prompts:
            validate prompt name
            validate relative_file under skill.root
            read UTF-8 and remove optional BOM for validation
            reject empty content
            emit PromptDefinition(skill, name, relative_file, hash, length)
    return filtered and SemVer-sorted definitions

get_prompt(prompt_id, version?):
    candidates = list_prompts()
    keep id == prompt_id and optional exact version
    return highest SemVer candidate or PROMPT_NOT_FOUND
```

Registry 是只读的，每次查询重新扫描文件，保证开发阶段修改文件后无需重启才能观察结果；后续可在 YashanDB 适配器中增加版本索引和缓存。

## 6. 安全与兼容性

- 不提供任意文件读取接口，客户端只能按 Manifest 中登记的 Prompt ID 获取内容。
- API 不返回 `Path.resolve()` 结果、工作区绝对路径或凭据。
- Prompt 内容原样返回，编码错误直接使 Registry 失败，不静默替换乱码字符。
- 旧 Skill Manifest 不含独立 Prompt 元数据时，Prompt 状态继承 Skill 状态，保持四个首批 Skill 兼容。
- 未来如需 Prompt 独立版本，新增存储适配器和明确的 `skillVersion` 兼容关系，不修改当前 ID 语义。

## 7. 实施顺序

1. 增加 Prompt 模型和 `PromptRegistry`；
2. 增加只读列表、详情和版本查询 API；
3. 增加路径穿越、编码、空文件、版本目录和最高版本测试；
4. 通过真实后端 HTTP API 验证四个首批 Skill 的 Prompt 数量、详情、哈希和错误响应。

