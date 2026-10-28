# 知识资产

这里存放需要版本管理的知识资源，运行生成的数据位于 `../runtime/`。

| 目录 | 职责 |
| --- | --- |
| outlines | 静态知识大纲；平台用户大纲元数据位于 runtime/agent-runner/outlines |
| templates、prompts、skills | 生成模板、提示词和知识生成 Skill |
| profiles、enterprise-profiles | 生成画像和企业能力注册 |
| references、refs | 参考资料与外部采集参考材料，暂不合并 |
| domain、examples | 领域规范和输入输出示例 |

企业能力 manifest 中的资源路径相对于仓库根目录，以 knowledge/ 开头。子模块自己的 prompts/skills 路径保持模块内相对语义。生成 Skill 经企业能力加载器显式注册，不使用根级旧目录包装。

## 工作台续写能力

`skills/continue-technical-document/SKILL.md` 是工作台可选的技术文档续写指令。新增能力时在 `config/knowledge-center/product.json#/skills` 登记 ID、版本和资源引用，并在 `content-rules.json#/productionAI.skills` 声明中文说明及适用操作；按既有部署流程重新加载能力包。工作台预览并选用后固定指令、版本与内容哈希。仅将文件放入目录不等于已经授权加载；不自动运行 Skill 中的脚本。


质量 Agent 的四个确定性能力资源位于 `skills/extract-document-cases`、`skills/execute-yashandb-cases`、`skills/compare-case-results`、`skills/render-test-report`，由企业能力加载器登记后供服务端受信任函数调用；资源说明不是可执行脚本授权。
