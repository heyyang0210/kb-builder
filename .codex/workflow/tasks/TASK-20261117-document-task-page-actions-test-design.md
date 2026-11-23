# TASK-20261117 任务管理页面低频操作移除测试设计

## 目标

验证任务详情不再提供同步变化、导出来源资料和独立新增手册入口；查看来源详情、既有范围处理和任务列表 CSV 导出仍按原契约工作。

## 范围与环境

- 页面：知识中心任务管理，浏览器宽度 1366px、390px。
- 后端：本地隔离 Express HTTP fixture，真实路由和前端请求链；PingCode 内容与下载响应由 Playwright route fixture 提供。
- 不访问/修改共享业务数据；不修改服务端 API、数据库或 PingCode 同步流程。
- 测试工程师约束：用例独立可单跑；记录执行命令、环境、接口调用和可重建截图。

## 用例

| ID | 场景 | 验收条件 |
| --- | --- | --- |
| UI-01 | 桌面任务详情 | 来源区只显示来源详情；同步变化、来源导出、新增手册不存在；已有流程总览、责任人和返回布局无重叠；来源详情按钮滚动后完整处于视口内。 |
| UI-02 | 390px 任务详情 | 与 UI-01 相同；页面无水平溢出，来源详情可见可操作且按钮完整处于视口内。 |
| API-01 | 来源详情 | 点击后读取 `/source` 并显示快照标题和正文。 |
| API-02 | 移除入口无副作用 | `/sync-changes`、`/source-export` 请求数为 0。 |
| REG-01 | 任务列表 CSV | 返回任务列表后 CSV 下载仍成功。 |
| REG-02 | 现有范围确认 | 原分派和手册范围功能测试继续通过；详情工作区不创建新手册弹窗。 |

## 命令与证据

```sh
node --test tests/e2e/agent-runner/knowledge-center-my-work.node.test.cjs
node --test tests/unit/agent-runner/document-tasks-frontend.test.cjs
```

截图写入 `runtime/test-results/document-task-page-actions-20261117/`；浏览器页面加载平台 tokens、base、styles 和任务管理模块样式。另分别保留详情初始视口与滚动到来源操作后的截图，避免把未滚动到底部的视图误判为内容裁切。执行报告记录 Node/Playwright 版本、用例结果和截图相对路径。若浏览器或 fixture 启动失败，归类为环境失败；实现行为不符归类为产品失败；断言不能区分行为时归类为用例问题。
