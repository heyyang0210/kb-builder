# P4 素材安全准备处理测试报告

## 测试结论

- 执行日期：2026-07-24。
- 结果：P4 专项单元测试 `7/7` 通过，真实 API 测试 `1/1` 通过，全量回归 `58/58` 通过。
- 后端地址：`http://127.0.0.1:8001`。
- 局域网网关：`http://192.168.130.180:3500`。

## 覆盖范围

1. DOCX 扩展名优先识别为 Office，不被 OOXML 的 ZIP 文件头误判为普通归档。
2. 可执行文件头即使伪装为 `.txt` 也进入隔离状态。
3. ZIP/TAR 安全成员正常解压并登记父子关系。
4. `../` 和绝对路径被拒绝，不能写出解压根目录。
5. 递归归档达到配置深度后停止并记录 `ARCHIVE_MAX_DEPTH`。
6. 图片登记为 `asset`，不出现在普通文本加工清单。
7. 真实 API 验证本地上传、分片组装、批次生成和 `/api/preprocess/prepare` 全链路。

## 执行命令

```bash
cd scripts/pingcode/web/backend

python3 -m unittest tests/test_material_preparation.py -v

PINGCODE_TEST_API_BASE=http://127.0.0.1:8001 \
PINGCODE_TEST_UPLOAD_TOKEN=dev-upload-token \
python3 -m unittest tests/test_preparation_integration.py -v

PINGCODE_TEST_API_BASE=http://127.0.0.1:8001 \
PINGCODE_TEST_FRONTEND_BASE=http://192.168.130.180:3500 \
PINGCODE_TEST_LAN_GATEWAY_BASE=http://192.168.130.180:3500 \
PINGCODE_TEST_UPLOAD_TOKEN=dev-upload-token \
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

## 产出验证

每次准备处理生成独立运行目录：

```text
<batch-root>/preparation/runs/<run_id>/
├── manifest.json
├── events.jsonl
└── extracted/
```

`manifest.json` 包含输入 manifest 哈希、处理版本、限制参数、资源关系、安全问题和统计；`events.jsonl` 记录运行开始、资源登记、问题发现和运行完成事件；`latest.json` 指向最近一次运行。

## 后续测试

- P5 接入格式转换后补充 DOC/DOCX、PPT/PPTX、XLS/XLSX、PDF 和 HTML 的正文及图片保真测试。
- P8 补充真实密码归档、超大归档和 20GB 级限制压力测试；当前代码路径已实现隔离和限制判断，专项报告不将未执行的压力场景声明为已验证。
