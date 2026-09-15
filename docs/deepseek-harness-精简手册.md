# DeepSeek Harness 精简使用手册（新手版）

> 适用版本：DeepSeek Harness 开发者预览版（`dsh`）。本文按 2026-09-13 检查的官方仓库说明整理；该项目迭代很快，命令或界面可能发生不兼容变化。

## 1. 它是什么

DeepSeek Harness（简称 `dsh`）是 DeepSeek AI 开源的智能体运行框架。它以插件为核心，可以让智能体读取/编辑工作区文件、运行命令并完成多步任务。首次使用建议从 Web UI 开始，不必先学习插件开发。

## 2. 准备环境

- 一台能联网的 Windows、macOS 或 Linux 电脑。
- Node.js **22.19.0 或更高版本**（官方当前要求 `^22.19.0 || >=24.0.0`）。在终端检查：

  ```bash
  node --version
  npm --version
  ```

- 一个 DeepSeek API 账号和 API 密钥：<https://platform.deepseek.com/>。密钥只在 Harness 设置页输入，不要写进代码、截图或提交到 Git。

## 3. 安装并启动（推荐：无需克隆源码）

在终端执行：

```bash
npx @deepseek-ai/dsh web
```

首次运行会从 npm 获取程序，可能需要等待几分钟；默认使用 3080 端口，本机会自动打开带临时访问令牌的页面。请以终端打印的**完整地址**为准，不要把其中的 `token` 发给别人。若不想自动打开浏览器：

```bash
npx @deepseek-ai/dsh web --no-open
```

看到终端打印地址后，用浏览器访问该完整地址即可。保持终端窗口运行，关闭窗口会停止服务；停止后再次执行同一命令即可启动。

### 可选：从源码运行

只有需要修改 Harness 本身时才使用源码方式：

```bash
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

源码方式需要安装 pnpm；`pnpm run build` 必须成功后再运行 `pnpm dsh web`。

## 4. 第一次配置和执行任务

1. 打开 **设置 → 模型**，填入 DeepSeek API 密钥并保存。
2. 点击 **选择工作区**，添加你要处理的项目文件夹并选中它。建议先创建一个测试文件夹，避免误改重要资料。
3. 新建会话，在输入框发送一个明确的小任务，例如：

   > 请列出当前工作区的文件，并用中文说明每个文件的用途。不要修改任何文件。

4. 阅读智能体的计划和工具调用；涉及写文件、执行命令等高风险操作时，先确认再批准。
5. 任务完成后检查变更（如使用 Git，可执行 `git diff`），确认无误再保留或提交。

## 5. 常用操作

| 目的 | 操作 |
| --- | --- |
| 查看命令帮助 | `npx @deepseek-ai/dsh --help` |
| 启动 Web UI | `npx @deepseek-ai/dsh web` |
| 启动但不自动开浏览器 | `npx @deepseek-ai/dsh web --no-open` |
| 停止 | 在运行命令的终端按 `Ctrl+C` |
| 更新到 npm 最新版本 | 再次执行 `npx @deepseek-ai/dsh@latest web` |

## 6. 常见问题排查

- **`node` 版本过低**：升级到 Node.js 22.19.0+，重新打开终端后再试。
- **端口被占用**：先停止占用 3080 端口的程序，或按 `--help` 查看当前版本是否提供端口参数。
- **页面能打开但不能发送消息**：检查“设置 → 模型”中的 API 密钥、网络和账户余额；保存后通常无需重启。
- **找不到文件/无法输入**：必须先添加并选中工作区；工作区是启动 `dsh` 时所在目录的默认文件系统位置。
- **命令执行失败或结果异常**：开发者预览版可能有破坏性更新。记录 Harness 版本、终端错误和复现步骤，到官方仓库提交反馈：<https://github.com/deepseek-ai/deepseek-harness/discussions>。

## 7. 安全提醒

- 不要把 API 密钥发给他人或提交到仓库；怀疑泄露时立即在平台撤销并重建。
- 启动地址里的临时 `token` 也属于敏感信息，不要发到群聊、工单或公开截图中。
- 首次运行只给临时、最小权限的工作区；不要直接指向生产目录、含密钥的目录或整个用户主目录。
- 对“删除文件、安装软件、上传数据、执行 shell 命令”的请求逐项确认；不确定时拒绝操作并人工检查。
- 官方项目处于开发者预览阶段，升级前保存工作成果并阅读官方安全说明：<https://github.com/deepseek-ai/deepseek-harness/blob/master/SAFETY.zh.md>。

## 8. 官方资料

- 项目主页（中文 README）：<https://github.com/deepseek-ai/deepseek-harness/blob/master/README.zh.md>
- Web UI 指南：<https://deepseek-harness.github.io/deepseek-harness/>
- API 密钥管理：<https://platform.deepseek.com/>
