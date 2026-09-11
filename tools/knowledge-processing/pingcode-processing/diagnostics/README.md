# 知识提取超时诊断

本目录保存知识提取单处理单元的内部诊断工具和外置用例配置。

诊断工具只调用现有 `agent-runner` 模型网关，不调用模型配置保存接口，不修改正式流水线产物，也不保存密钥、认证头、完整 Prompt 或完整处理单元正文。

示例：

```bash
python tools/knowledge-processing/pingcode-processing/diagnostics/knowledge_extraction_timeout.py \
  --task-id training_eab455f5e69e40ec \
  --chunk-id 83dc61836bc209e77056f0ff:0 \
  --case-file tools/knowledge-processing/pingcode-processing/diagnostics/knowledge-extraction-timeout-cases.json
```

默认报告写入任务目录的 `quality/knowledge-extraction-diagnostics/`。诊断请求全部设置 `max_retries=0`，每次调用生成独立 `diagnosticId` 和 `modelCallId`。

使用 `--case-id` 只执行指定用例，使用 `--repeat` 覆盖用例重复次数；修复回归时可以增加 `--no-comparison`，避免再次调用不可用的临时对照模型。

`--timeout-ms` 只用于观察模型是否在正式 45 秒边界后返回，不能据此修改正式 Skill 超时配置。
