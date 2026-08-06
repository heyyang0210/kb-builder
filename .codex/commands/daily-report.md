# 生成每日报告

## 触发方式
对 Codex 说：`生成今日报告` 或 `daily report`

## 执行步骤

1. 读取 `.codex/workflow/tasks/` 下所有任务卡片
2. 筛选出今日有状态变更的任务
3. 读取 `.codex/workflow/PROGRESS.md` 获取当前进度
4. 读取 `.codex/workflow/RISKS.md` 获取风险信息
5. 生成 `.codex/workflow/daily/YYYY-MM-DD.md`

## 输出格式

```markdown
# 每日开发报告 — YYYY-MM-DD

## 今日完成
- [TASK-XXX] 任务名称 (worker-role)
  - 修改: file1, file2
  - 状态: ✅ 已验证

## 今日进行中
- [TASK-XXX] 任务名称 (worker-role)
  - 进度: XX% — 简要说明

## 风险与阻塞
- 风险描述或「无」

## 明日计划
- 计划项列表

## 需要人类关注
- 关注项或「无」
```
