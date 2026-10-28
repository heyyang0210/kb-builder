# 写作 Agent 行业调研与候选清单

> 采集日期：2026-10-23（北京时间）；状态：调研建议。用途：为知识中心文档生产补强及后续逆向工程选择目标。

推荐首先分析 **GPT Researcher 的研究—审稿闭环、STORM 的多视角研究与证据大纲、WRITER 的术语规范、Jenni/Notion 的引用与编辑体验**。DeerFlow 用于研究任务恢复与产物交付。当前平台已有写作主流程，应围绕这些局部能力做迁移。

## 1. 检索与“最高评分”的口径

实际顺序：GitHub Search API 初筛 → 9 个明确候选的元数据/README → 全网搜索、官网、独立评测及评分页 → 专项研究写作榜单 → REA 公开页面观察和关键源码核对。全文不把 Star 当作写作质量。

GitHub 初始查询为 `writing agent in:name,description,readme stars:>500`、`research report agent in:description stars:>1000`、`long writing in:name,description stars:>100`，按 stars 排序，各取20条。宽泛查询被通用框架/清单污染，剔除不直接承担研究写作的结果，再补查下表明确项目。这是有边界的候选调研，不能声称穷尽 GitHub 或全网。

三类指标分别解读：

| 指标 | 能回答什么 | 限制 |
|---|---|---|
| GitHub stars、归档/维护、许可证 | 开源关注度、可研究性 | 不能证明中文技术写作质量 |
| DeepResearch Bench RACE | 特定数据集、裁判和提交配置下的研究报告质量 | 不能等同生产可靠性、用户满意度或 SQL 正确性；不同榜单/裁判不混排 |
| 用户评分/独立编辑评测 | 使用体验和品类推荐 | 产品评分可能覆盖整个产品；本轮 G2/Capterra 等403，数值与评论量未核实 |

## 2. GitHub 候选列表（按本次 Star 降序）

采集时间约 18:10 北京时间。`pushed_at` 只是仓库推送时间，不能当作正式版本发布。下表功能来自官方 README；优先级是本平台适配判断。

| 项目 | Stars | 最近推送（UTC日期） | 许可证/状态 | 借鉴重点与限制 | 适配 |
|---|---:|---|---|---|---|
| [bytedance/deer-flow](https://github.com/bytedance/deer-flow) | 84,315 | 2026-10-23 | MIT；未归档 | 长任务、Skills、状态及产物；当前2.0是通用 SuperAgent，不能沿用1.x研究流程结论 | 高，第二批 |
| [stanford-oval/storm](https://github.com/stanford-oval/storm) | 31,683 | 2025-09-30 | MIT；未归档 | 多视角提问→研究→大纲→带引用文章；技术事实与时效性需另验 | 高，首批 |
| [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | 30,255 | 2026-10-10 | Apache-2.0；未归档 | 本地/网络资料、分章节研究、审稿修订；自动接受策略不直接迁移 | 高，首批 |
| [google-gemini/gemini-fullstack-langgraph-quickstart](https://github.com/google-gemini/gemini-fullstack-langgraph-quickstart) | 18,347 | 2026-06-14 | Apache-2.0；未归档 | 查询扩展、反思、引用展示；属于参考工程，非完整写作产品 | 中 |
| [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research) | 12,675 | 2026-08-10 | MIT；已归档 | 澄清→研究简报→监督研究→报告；已归档，作为历史设计样本 | 中 |
| [zenstory-ai/oh-story-claudecode](https://github.com/zenstory-ai/oh-story-claudecode) | 7,918 | 2026-10-23 | MIT；未归档 | 中文小说规划、连续性及Skill组织；不迁入虚构事实规则 | 低，仅交互 |
| [HKUDS/AI-Researcher](https://github.com/HKUDS/AI-Researcher) | 5,836 | 2025-10-16 | 未知；未归档 | 科学研究与报告流程；范围过大，API未返回许可证，需核验 | 低 |
| [THUDM/LongWriter](https://github.com/THUDM/LongWriter) | 1,879 | 2025-06-24 | Apache-2.0；未归档 | AgentWrite先计划后分段写作；研究代码/模型项目，不是成熟工作台 | 中，章节规划 |
| [EthanYoQ/AI-Novel-Writer](https://github.com/EthanYoQ/AI-Novel-Writer) | 1,739 | 2026-10-22 | GPL-3.0；未归档 | 本地写作、审稿与Skill；GPL-3.0，技术文档场景适配有限 | 低，仅交互 |

版本锚点见本报告第6节；原始 API 与 README 保留在证据目录。STORM 推送停留2025年，适合借鉴方法，不据此承诺上游持续维护。

## 3. 有明确分数的研究写作 Agent 清单

来源：[DeepResearch Bench 公开榜单](https://huggingface.co/spaces/muset-ai/DeepResearch-Bench-Leaderboard)，本次直接读取其 `data_gpt55/leaderboard.csv`。以下为 **该文件当时收录条目按 overall_score 降序的前8名**，不是全球写作产品总榜。分数保留 CSV 原值；所有这些条目的 citation_accuracy、effective_citations 均为 `-`，不能推断引用可靠性排名。模型版本、提交环境及开源身份还需逐项核验。

| 本次排序 | 榜单原始名称 | overall_score | 可操作性判断 |
|---:|---|---:|---|
| 1 | cellcog-max | 56.72 | 先核验作者、公开入口、提交版本及制品；尚未建立明确GitHub对应关系 |
| 2 | ATH-Voicepica-DeepResearch | 55.99 | 先核验作者、公开入口、提交版本及制品；尚未建立明确GitHub对应关系 |
| 3 | SPIA-DeepResearch-V2 | 55.85 | 先核验作者、公开入口、提交版本及制品；尚未建立明确GitHub对应关系 |
| 4 | deep-cove-research-pro | 55.71 | 先核验作者、公开入口、提交版本及制品；尚未建立明确GitHub对应关系 |
| 5 | beane-harness | 55.37 | 先核验作者、公开入口、提交版本及制品；尚未建立明确GitHub对应关系 |
| 6 | deep-cove-research | 55.29 | 先核验作者、公开入口、提交版本及制品；尚未建立明确GitHub对应关系 |
| 7 | SPIA DeepResearch | 55.12 | 先核验作者、公开入口、提交版本及制品；尚未建立明确GitHub对应关系 |
| 8 | WhaleCloud-DocChain_0612 | 54.78 | 先核验作者、公开入口、提交版本及制品；尚未建立明确GitHub对应关系 |

同一 CSV 另收录 `gemini-2.5-pro-deepresearch` 49.98、`openai-deepresearch` 47.84、`perplexity-Research` 43.05。它们是榜单的指定提交，不代表今天对应产品的最新能力。DRB II 是另一个任务集，本次另存 `data_drb2-leaderboard.csv`，不与上述 RACE 分数混排。

[基准方法说明](https://github.com/Ayanami0730/deep_research_bench)：100个任务（50中/50英），RACE评估覆盖、洞察、指令遵循、可读性；FACT另评引用。当前README记录2026年裁判切换与文章清洗模型变更，所以不把 Open Deep Research README 旧配置0.4943、0.4309等数字与新榜比较。以上均为公开评测方数据，本轮未自行重跑模型评测。

这些高分条目提供后续候选发现线索；在目标身份/可获取制品明确前，不优先于可核验源码且高度适配的 STORM、GPT Researcher 做能力迁移。

## 4. 扩展到全网的产品清单

严格区分 Agent 平台、研究助手与写作助手。下表全部没有本轮可核验的用户数值评分，不提供猜测分数。

| 产品 | 品类 | 最适合借鉴 | 外部评价证据 | 适配 |
|---|---|---|---|---|
| [WRITER](https://writer.com/) | 企业Agent/写作治理 | 术语、风格指南、组织知识约束、已批准内容复用 | Zapier分类推荐：AI compliance | 高 |
| [Notion AI / Notion Agent](https://www.notion.com/product/ai) | 知识协作/文档Agent | 当前文档上下文、来源勾选、用户权限及引用 | 官网及帮助；G2 403 | 高 |
| [Jenni](https://jenni.ai/) | 研究写作助手 | 事实到PDF页/段的定位、边写边引用 | 官网声明；无核实用户分 | 高 |
| [Gemini Notebook（原 NotebookLM 入口）](https://notebooklm.google/) | 来源驱动研究/报告助手 | 来源集合→问答/报告、导出边界 | 官网及帮助；无核实用户分 | 高 |
| [Jasper](https://www.jasper.ai/) | 营销写作Agent/流水线 | 简报、规则、草稿、检查的内容流水线 | Zapier分类推荐：businesses | 中 |
| [Grammarly](https://www.grammarly.com/ai-writing-assistant) | 写作编辑助手 | 局部修改、逐条建议、语气与风格反馈 | 官网及语言帮助；G2/Capterra 403 | 中 |
| [Sudowrite](https://sudowrite.com/) | 小说写作助手 | 大纲到章节、续写及局部重写交互 | Zapier分类推荐：fiction | 低 |

[Zapier独立编辑评测](https://zapier.com/blog/best-ai-writing-generator/)（页面日期2026-09-15）可读，可能含联盟佣金。它说明测试中生成质量差异有限，主要按体验、功能和价格选型，不能转述成统一质量排行榜。Jasper官网 `/reviews` 实际跳到客户故事，也不能当第三方评分。

Google官方入口本次从 notebooklm.google 跳到 notebook.google，标题为 Gemini Notebook；[帮助页](https://support.google.com/notebooklm/answer/16206563?hl=en)说明来源选择、报告生成以及导出后不双向同步、权限不继承。Grammarly[语言帮助](https://support.grammarly.com/hc/en-us/articles/115000090971-What-languages-does-Grammarly-support)列出中文写作建议，但段落级改写语言清单未证明中文支持。全部是本次网页材料，未验证登录后的这些操作。

搜索限制：Google返回跳转壳、DDG人机挑战、Brave429；Bing多数查询结果不相关，剔除这些结果，仅保留相关页面线索。G2、Capterra、GetApp、SoftwareAdvice、Trustpilot遭403。全网范围已扩展到官网、帮助、独立编辑评测、用户评价站和专业基准，但“全行业评分最高”的绝对结论仍不成立。

## 5. REA 实际结果与平台差距

使用仓库 `app-capability-transfer`、`reverse-engineer-anything` Skill，CLI `rea@6.7.0`，没有变更全局配置。对完整开源代码用常规文件分析，不把源码阅读包装成 REA 反编译。

实际调用 `capture-browser-scenario`，隔离无登录浏览器打开 GPT Researcher 公开文档并等4秒，记录 URL/可访问性文本。正确地址为 https://docs.gptr.dev/docs/gpt-researcher/multi_agents/langgraph ，Evidence ID：`ev_2df36502093ef367c8bc2e84bacf29c0be395bd6e9de086f89075ebd6e6c1164`。页面说明规划、按章节研究、review/revise、最终报告流程。这证明公开文档如此描述，**不证明生成任务已执行或质量提升**。首次地址多带 `/gptr` 得到 Page Not Found，保留 `ev_d298e830d0a8235506b00ec9f527b368657872f53dd80bbd748971b149449ffa` 及纠正记录。

源码交叉证据：

- STORM `knowledge_curation.py` / `outline_generation.py`：研究会话与大纲模块；对应写前问题清单和证据大纲。
- GPT Researcher `multi_agents/agents/editor.py` / `reviewer.py`：按section研究、guidelines评审与修订；`_route_draft_review` 捕获次数上限异常后返回 `accept`。这是所选提交的静态代码行为，尚未运行触发。本平台建议次数耗尽时保留不通过/待人工，不能复制自动接受政策。
- Open Deep Research `deep_researcher.py`：澄清、研究简报、supervisor和研究迭代限制；适合研究过程参考，归档项目不作为新增依赖首选。
- LongWriter `agentwrite/plan.py` / `write.py`：先计划、后写作；示例密钥/模型和提示内容的源码组织不能原样迁入平台，应改用现有配置与知识资源。

本平台现场源码：`production-ai-service.js` 已接收outline、requirements、确认来源/Skill快照，有候选、取消/中断、采用冲突保护；`production-ai-provenance.js` 已区分直接引用/摘要/推理，摘要即使来源偏移合法也仍标 `unverified`。前端当前入口是 `production-writing-page.js`，已有来源预览、片段对照、采用保存、YashanDB用例检查。**当前有来源标注不等于已具备事实蕴含核验。** 本轮不重跑平台API，不把源码观察当端到端验收。

既有AI文产-01～16以及腾讯ima调研IMA-01～11继续承接基础能力。新增研究建议、边界、优先级和验收详见下一份需求文档。

## 6. 可复查来源与交付状态

原始证据位于 `runtime/rea/writing-agent-research-20261023/`：`github-search.json`、`github-candidates.json`、`source-index.json`、`web/sources.json`、`web/candidate-findings.json`、两份榜单CSV、REA请求/Evidence。网页原文留runtime，本报告为项目调研投影。

| 项目 | 本次默认分支提交SHA |
|---|---|
| stanford-oval/storm | `fb951af7744dab086e34962e9bc6fe878e145f83` |
| assafelovic/gpt-researcher | `3582a6841fe7dc801e2a34e34ee408641aea9bce` |
| langchain-ai/open_deep_research | `1b7d2e80db9faa586165c60e09096dbbfd483a64` |
| bytedance/deer-flow | `1c9e962b323c4873ba0e63dbc5ee008540b2837f` |
| THUDM/LongWriter | `447539b356a8b09760b51eca876e19b6fc1f2dd7` |
| HKUDS/AI-Researcher | `f9a6f8480860c193afff600eeffe3defcee8a978` |
| google-gemini/gemini-fullstack-langgraph-quickstart | `e34e569de465340e42f36cd3cab4fac0c3ce7036` |
| zenstory-ai/oh-story-claudecode | `c3fbbbeaadb18478d32e6d85b2619d7cfbff8d2d` |
| EthanYoQ/AI-Novel-Writer | `305ee7559be7d8c9c1cbfcf1ed4b030513f32cfe` |

关键源码均按表中SHA抓取，README是当时API快照，二者可能存在采集间隙，后续工程应固定SHA重取README及LICENSE。许可证只记录GitHub元数据，不代替具体代码与依赖许可证核验。

| 原始问题 | 本轮状态 | 尚缺证据 |
|---|---|---|
| GitHub高关注写作项目 | 已回答（有边界） | 未穷尽所有仓库 |
| 全网高分/高口碑候选 | 部分回答 | 专项榜单可核验；用户评价数值被403阻挡 |
| 哪些适合知识中心 | 已形成待评审建议 | 中文技术资料基准、真实交互对照 |
| 后续逆向工程怎么做 | 已形成执行范围 | 商业产品登录态、版本及付费能力需后续核验 |

本轮交付调研与需求准备，不声称已完成全部候选逆向、业务实现或效率收益测量。
