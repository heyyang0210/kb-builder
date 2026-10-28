# AI 文档生产 PingCode 引用阶段验证报告

记录时间：2026-10-22T19:15:51+08:00。结论：本阶段读取与隔离交互验证通过；完整 AI文产-01～16 目标未验收。共享服务未重启，生产配置未启用新来源。

## 实现与复用

复用 `PingCodeService` 单线程浏览器会话、`PingCodeAPIClient.get_page`、空间目录和 `ContentParser`，新增只读 `GET /api/pingcode/spaces/{space_key}/pages/{page_id}/reference`。先检查空间归属，再获取并解析正文；保留上游实际提供的版本信息，无版本字段则不推测。

知识中心复用既有来源预览、作者与文档上下文校验、确认快照及任务引用机制，新增 PingCode 设计/测试两种来源。内部服务地址沿用服务器配置，空间范围由 `productionAI.sources.pingcodeSpaces` 管理，默认空。两类来源代表作者声明的用途，不自动证明远端资料类型。正文读取不包括附件和图片验证。

测试清理改为在服务关闭时同时关闭连接，避免浏览器连接使测试挂起；没有放宽业务断言。

## 验证与证据

仓库根目录执行：

```bash
PYTHONPATH=apps/pingcode-api:packages/pingcode-core python3 -m unittest discover -s tests/unit/pingcode/web-backend -p test_pingcode_reference.py -v
node --test --test-timeout=45000 tests/unit/agent-runner/handbook-production-api.test.js
python3 tests/run_tests.py unit --report runtime/test-results/exports/production-ai-pingcode-unit.json
```

- Python：6/6，通过空间归属、参数、真实解析器、可选元信息及404/422/502脱敏。
- BFF HTTP/Chromium：8/8，通过来源可用性、范围限制、定位符、固定服务路径、上游失败、响应错页、大小限制、显式预览勾选和冻结来源进入模型。浏览器模型及上游为隔离替代实现。
- 真实外部 PingCode：在独立 localhost:18019 API 实例使用现有账号只读读取 `YASDOC/67768231ea9f2a28709356bc`，HTTP200，5,100字符；Node 来源适配器随后读取同一页面，摘要一致：`976ee502641c53230ddcd6f8a9637fe5da03d81a7cdcdf8c7f9e8a9994adf653`。未创建下载批次，未修改远端页面。
- 统一 unit：44/45任务通过，Jest728/729通过。唯一失败仍为 `knowledge-center-scroll-runtime.test.js` 对现有 Markdown 粘贴样式直接定义100dvh的检查，本阶段未修改该模块或降低门禁。
- 证据目录：`runtime/test-results/production-ai-pingcode/`，含 `python-console.log`、`http-console.log`、`source-preview.png`、`result.json`、`real-reference-probe.json`、`real-node-adapter-probe.json`、`unit-console.log`；统一报告在 `runtime/test-results/exports/production-ai-pingcode-unit.json`。
- 浏览器截图已检查，来源正文、显式复选框与确认范围可见；弹窗可滚动。该隔离页面不代表完整平台布局及真实模型组合已验收。

## 尚未验收

测试用例库专用接入（现有本地用例目录为空，已询问实际来源）、真实模型生成（先前配置密钥解密阻塞尚待解除）、真实外部网址、内容质量检查、独立运行时测试 Agent与多个 Skill、真实授权 YashanDB用例执行和报告、段落与用例混合来源追溯、完整平台浏览器及审核发布闭环。保持全部16项需求，不将本阶段通过写成完整目标通过。
