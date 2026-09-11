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
