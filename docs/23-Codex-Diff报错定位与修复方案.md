# Codex Diff 报错定位与修复方案

## 1. 定位结论

当前工作区不是 Git 无法生成差异。实测 `git diff` 可以正常完成，输出约 373 KB；`git diff --stat` 也能成功执行。

已确认有两个独立问题：

1. **差异校验失败**：`git diff --check` 报告 `code/apps/knowledge-center-web/frontend/prompt-generator.html.backup` 多处新增行存在 trailing whitespace。该命令返回非零状态，若 Codex Diff 将 `diff --check` 非零直接视为差异生成失败，就会显示报错。
2. **差异负载过大且噪声较多**：工作区有 25 个已修改文件，约 3146 行新增、2212 行删除；其中 `prompt-generator.html.backup` 单文件约 1009 行新增、239 行删除，`training_service.py` 约 1773 行删除、372 行新增。另有 `dump.rdb`、生成 HTML、备份文件、运行报告等未跟踪产物。若 Codex Diff 尝试渲染整个工作区而不是限定已审查文件，容易发生超时、截断或前端渲染失败。

因此，“Codex Diff 报错”不能归因于单一业务代码语法错误；首要故障点是差异检查未通过，次要风险是工作区范围过大和生成物混入。

### 编辑器界面的对应关系

截图中的“Codex Diff”是 OpenAI Codex VS Code 扩展的 Webview 面板，“糟糕，出错了”是请求失败后的通用兜底页，不是 Git 的原始错误文本。当前无法仅凭截图区分扩展进程、远程 VS Code Server 或 Diff 数据接口哪一层失败，但仓库侧已确认 Git 可生成差异。因此应先按“缩小差异范围”验证：重新加载窗口后，仅打开一个小型已跟踪文件的差异；若恢复正常，根因就是全量工作区差异负载/解析问题，而不是文件语法。

## 2. 复核证据

```text
git diff --stat       -> 成功，25 个已修改文件
git diff --check      -> 失败，错误集中在 prompt-generator.html.backup
git diff --exit-code  -> exit=1（表示存在差异，不表示 diff 生成失败）
```

注意：`git diff --exit-code` 返回 1 是 Git 的正常语义，不能把它当作异常；只有返回 2 才表示命令执行错误。Codex 集成层如果把任意非零都当异常，也会产生误报。

## 3. 修复方案

### P0：先修复差异校验

对 `code/apps/knowledge-center-web/frontend/prompt-generator.html.backup` 做最小化处理，只清理新增行的行尾空白，不改 HTML 内容、缩进和换行结构。执行后复核：

```bash
git diff --check
git diff -- code/apps/knowledge-center-web/frontend/prompt-generator.html.backup
```

如果该 backup 文件只是临时备份且不属于本次交付，应由文件所有者确认后加入忽略规则或移出提交范围，不能直接删除或回退用户改动。

### P0：修正 Codex Diff 的退出码判断

差异展示层应区分：

```text
exit=0：无差异
exit=1：存在差异，正常展示
exit>=2：Git 命令或参数错误，展示错误
```

`git diff --check` 则应单独作为质量门禁；失败时展示具体文件和行号，而不是显示笼统的“Codex Diff 失败”。

### P1：限制 Diff 输入范围

- 默认只展示已跟踪文件的变更：`git diff -- <reviewed-files>`。
- 未跟踪文件单独列为“新增文件”，不把运行产物和二进制一起塞入主 diff。
- 对 `.rdb`、大型备份 HTML、生成报告采用二进制/大文件摘要，不尝试全文渲染。
- 为单文件和总 payload 设置大小上限，超限时分页或按文件加载。

### P1：清理工作区噪声

确认归属后，将 `dump.rdb`、临时 HTML、备份文件、运行报告等移入已有 `.gitignore` 规则或独立输出目录。该步骤必须先列出目标清单，不能使用宽泛的递归删除。

### P2：补充回归测试

1. 空 diff 时接口返回 200 和空列表。
2. 有差异时 exit=1 仍正常返回 diff 内容。
3. `git diff --check` 失败时返回结构化诊断：文件、行号、问题类型。
4. 包含中文文件名、二进制文件、超大单文件和未跟踪文件时，Diff API 不超时、不崩溃。
5. 断开 pager、无 TTY 环境下仍可稳定执行。

## 4. 推荐实施顺序

```text
确认文件归属
  -> 清理/隔离新增行尾空白
  -> 修正 exit=1 语义
  -> 限定 diff 文件范围并分页
  -> 增加大文件/二进制摘要
  -> 执行 diff check 与 Diff API 回归测试
```

本次未直接清理 `prompt-generator.html.backup` 或删除未跟踪文件，因为这些改动可能属于用户已有工作；应先按上述清单确认归属后再实施。

## 5. 用户侧临时恢复步骤

1. 在 VS Code 执行“Developer: Reload Window”。
2. 关闭当前 Codex Diff 标签页后，从一个小型已跟踪 Markdown 文件重新打开差异。
3. 若仍失败，查看“输出”面板中的 `Codex`/`OpenAI` 通道和“开发人员工具 Console”，记录真实 HTTP 状态或异常堆栈。
4. 暂时将大文件和备份文件排除在本次审查范围，再重试 Diff；不要删除或回退未确认归属的文件。
