# 测试用例目录

本目录存放 YashanDB 与对比数据库（如 Oracle）的双库测试用例，用于文档生成时提供可执行的 SQL 示例。

## 用途

- 提供可直接使用的 SQL 示例代码
- 包含预期输出和执行说明
- 支持双库对比验证（Oracle vs YashanDB）

## 文件命名规范

```
[知识点名称]_test.sql
```

示例：`sequence_test.sql`、`index_btree_test.sql`

## 当前状态

当前包含 `ai-quality-smoke-select.sql` 只读冒烟用例；其他领域用例按验证完成后再补充，不能把未执行用例标为通过。

## AI 文档生产来源

`ai-quality-smoke-select.sql` 是只读冒烟用例，用于验证知识中心来源预览、确认冻结及 YashanDB 质量 Agent 的真实执行链路。新增用例应保持可在授权隔离库执行，并在文档中以 SQL 代码块引用。

## 在文档中声明预期结果

在 SQL 代码块之后紧邻一个标记为 `json quality-expected` 的代码块：

````markdown
```sql
SELECT 1 AS C1 FROM DUAL;
```
```json quality-expected
{"columns":["C1"],"rows":[{"C1":1}]}
```
````

`rows` 必填，`columns` 可选，不接受其他字段。比对保留行顺序与值类型，行对象的字段书写顺序不影响结果。错误声明不执行 SQL；没有声明时只验证执行成功，报告明确尚未核对结果正确性。数据库结果截断时不得通过。预期声明是文档内容，会随修订一起保存和参与摘要计算。
