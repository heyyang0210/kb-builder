# Oracle 知识库文档生成计划

> **生成日期**：2026-07-01  
> **总计**：133 篇文档（8个部分、38个章节、133个知识点）  
> **批次规划**：每批 3-5 篇，共约 34 批次  
> **命名规范**：`P[部分编号]-[章节编号]-[知识点编号]-[知识点名称].md`

---

## 一、总体统计

| 部分 | 章节数 | 知识点数 | 批次数（预估） |
|------|--------|---------|--------------|
| 第一部分：数据库基础入门 | 4 | 17 | 4-5批 |
| 第二部分：数据库核心原理 | 4 | 22 | 5-6批 |
| 第三部分：数据库管理 | 5 | 19 | 4-5批 |
| 第四部分：SQL编程与开发 | 5 | 17 | 4-5批 |
| 第五部分：性能优化 | 5 | 18 | 4-5批 |
| 第六部分：高可用与集群 | 5 | 15 | 3-4批 |
| 第七部分：数据库内核与高级专题 | 5 | 13 | 3-4批 |
| 第八部分：数据库架构设计与实践 | 5 | 12 | 3批 |
| **总计** | **38** | **133** | **~34批** |

---

## 二、文件命名规范

### 2.1 命名格式

```
P[部分编号]-[章节编号]-[知识点编号]-[知识点名称].md
```

**示例**：
- `P1-01-01-基本概念.md`（第一部分 1.1章节 第1个知识点）
- `P2-03-02-并发问题.md`（第二部分 2.3章节 第2个知识点）
- `P6-02-01-RAC架构原理.md`（第六部分 6.2章节 第1个知识点）

### 2.2 与现有文档的关系

- **现有文档**：`01-Oracle集群基础概念与架构.md` ~ `07-集群内核机制深度解析.md`（7个集群相关文档）
- **新文档**：使用 `P[部分]-[章节]-[知识点]` 编号，避免冲突
- **并存策略**：保留现有文档，新文档独立存放

---

## 三、完整文章列表与提示词

### 第一部分：数据库基础入门 ★（17篇）

#### 1.1 数据库与数据库管理系统（3篇）

**批次 1/34**

**1. P1-01-01-基本概念.md**

```yaml
title: "Oracle数据库基本概念"
domain: "基础入门"
feature_type: "基础概念"
target_audience: "DBA/开发者/运维"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["11gR2", "12cR1", "12cR2", "19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle数据库基本概念"的知识文档。

知识点内容：
- 数据与信息：数据的定义、信息与数据的关系
- 数据库（Database）：有组织的数据集合
- 数据库管理系统（DBMS）：提供数据定义、操纵、控制功能的软件系统
- 数据库系统（DBS）：数据库、DBMS、应用程序及DBA的统称

要求：
1. 重点说明Oracle作为DBMS的特点和优势
2. 对比Oracle与其他数据库（MySQL、PostgreSQL）的差异
3. 包含Oracle版本演进（11g到21c的变化）
4. 提供Oracle特有的术语和概念
5. 包含实际场景示例

输出文件：oracle-kb/P1-01-01-基本概念.md
```

---

**2. P1-01-02-数据库发展简史.md**

```yaml
title: "Oracle数据库发展简史"
domain: "基础入门"
feature_type: "发展历程"
target_audience: "DBA/架构师"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["所有版本"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle数据库发展简史"的知识文档。

知识点内容：
- 早期数据管理：文件系统方式
- 层次与网状模型：IMS、DBTG，数据导航式访问
- 关系模型革命：Codd的十二准则，关系数据库兴起
- 对象关系扩展：对大对象、复杂数据类型的支持
- 当前主流关系型产品概览：Oracle、MySQL、PostgreSQL、SQL Server等

要求：
1. 重点描述Oracle自身的发展历程（从1979年V2到21c）
2. 每个重要版本的里程碑特性
3. Oracle在数据库发展史上的地位和贡献
4. 对比同期其他数据库产品的发展
5. 包含Oracle版本时间线图（Mermaid）

输出文件：oracle-kb/P1-01-02-数据库发展简史.md
```

---

**3. P1-01-03-数据库分类.md**

```yaml
title: "Oracle数据库分类与定位"
domain: "基础入门"
feature_type: "产品分类"
target_audience: "DBA/架构师"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle数据库分类与定位"的知识文档。

知识点内容：
- 按数据模型：关系型、键值、文档、图、列簇
- 按处理类型：OLTP（在线事务处理）、OLAP（在线分析处理）
- 按架构：单机、主从复制、集群、分布式

要求：
1. 说明Oracle在不同分类中的定位
2. Oracle Database vs Oracle NoSQL vs Oracle Berkeley DB
3. Oracle在OLTP和OLAP场景的应用（Exadata、TimesTen）
4. Oracle集群架构分类（RAC、Data Guard、GoldenGate）
5. 对比MySQL、PostgreSQL在分类上的差异

输出文件：oracle-kb/P1-01-03-数据库分类.md
```

---

#### 1.2 关系模型基础（4篇）

**批次 2/34**

**4. P1-02-01-关系数据结构.md**

```yaml
title: "Oracle关系数据结构"
domain: "基础入门"
feature_type: "数据模型"
target_audience: "DBA/开发者"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle关系数据结构"的知识文档。

知识点内容：
- 关系（Relation）：表的形式定义
- 元组（Tuple）：行
- 属性（Attribute）：列，具有数据类型和取值范围（域）
- 域（Domain）：属性所有可能取值的集合
- 键（Key）：超键、候选键、主键、外键、代理键与自然键

要求：
1. 重点说明Oracle中的表、行、列概念
2. Oracle特有的数据类型（NUMBER、VARCHAR2、DATE、ROWID等）
3. Oracle中的键实现：PRIMARY KEY、FOREIGN KEY、UNIQUE约束
4. Oracle的ROWID和伪列概念
5. 提供Oracle SQL示例：建表、定义约束

输出文件：oracle-kb/P1-02-01-关系数据结构.md
```

---

**5. P1-02-02-关系完整性约束.md**

```yaml
title: "Oracle关系完整性约束"
domain: "基础入门"
feature_type: "约束机制"
target_audience: "DBA/开发者"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle关系完整性约束"的知识文档。

知识点内容：
- 实体完整性：主键不能为空
- 参照完整性：外键必须匹配目标表主键或为空
- 用户定义完整性：业务规则约束（CHECK、规则等）

要求：
1. Oracle中各种约束的语法和用法
2. 约束的状态管理（ENABLE/DISABLE、VALIDATE/NOVALIDATE）
3. 延迟约束（DEFERRABLE）的使用场景
4. Oracle特有的约束特性（如虚拟列约束）
5. 约束的性能影响和最佳实践
6. 提供完整的SQL示例

输出文件：oracle-kb/P1-02-02-关系完整性约束.md
```

---

**6. P1-02-03-关系代数.md**

```yaml
title: "Oracle关系代数运算"
domain: "基础入门"
feature_type: "理论基础"
target_audience: "DBA/开发者"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle关系代数运算"的知识文档。

知识点内容：
- 传统集合运算：并（∪）、交（∩）、差（−）、笛卡尔积（×）
- 专门关系运算：选择（σ）、投影（Π）、连接（⨝）、除（÷）
- 连接类型：θ连接、等值连接、自然连接、外连接（左、右、全外连接）

要求：
1. 关系代数运算在Oracle SQL中的对应实现
2. Oracle特有的连接语法（+外连接、ANSI SQL连接）
3. Oracle优化器如何将关系代数转换为执行计划
4. 实际SQL示例：展示每种运算的实现
5. 性能考虑和优化建议

输出文件：oracle-kb/P1-02-03-关系代数.md
```

---

**批次 3/34**

**7. P1-02-04-关系演算.md**

```yaml
title: "Oracle关系演算"
domain: "基础入门"
feature_type: "理论基础"
target_audience: "DBA/开发者"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle关系演算"的知识文档。

知识点内容：
- 元组关系演算：{ t | P(t) } 形式
- 域关系演算：QBE的数学基础

要求：
1. 关系演算与SQL的关系
2. Oracle SQL如何体现关系演算思想
3. 子查询与存在量词的对应
4. 实际示例：将关系演算表达式转换为Oracle SQL
5. 了解即可，不需要深入实现细节

输出文件：oracle-kb/P1-02-04-关系演算.md
```

---

#### 1.3 数据库设计理论（4篇）

**8. P1-03-01-概念模型与ER模型.md**

```yaml
title: "Oracle概念模型与ER模型设计"
domain: "基础入门"
feature_type: "数据库设计"
target_audience: "DBA/架构师"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle概念模型与ER模型设计"的知识文档。

知识点内容：
- ER图基本元素：实体、属性、联系（1:1、1:N、M:N）
- 强弱实体：强实体与弱实体的依赖关系
- 联系属性与基数约束

要求：
1. ER模型在Oracle数据库设计中的应用
2. Oracle数据建模工具（Oracle SQL Developer Data Modeler）
3. 从ER图到Oracle表的转换规则
4. Oracle特有的建模考虑（如分区表、索引组织表）
5. 实际案例：设计一个简单的业务系统ER图并转换为Oracle表结构

输出文件：oracle-kb/P1-03-01-概念模型与ER模型.md
```

---

**批次 4/34**

**9. P1-03-02-逻辑设计与关系模式转换.md**

```yaml
title: "Oracle逻辑设计与关系模式转换"
domain: "基础入门"
feature_type: "数据库设计"
target_audience: "DBA/架构师"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle逻辑设计与关系模式转换"的知识文档。

知识点内容：
- ER图向关系模式转换规则：实体转为表，M:N联系转为关联表等
- 数据字典设计

要求：
1. Oracle中ER到表的完整转换流程
2. Oracle特有的转换考虑（如嵌套表、对象关系）
3. Oracle数据字典的使用（USER_TABLES、ALL_TABLES、DBA_TABLES）
4. 数据字典视图的分类和查询方法
5. 实际示例：从ER图到Oracle DDL的完整转换

输出文件：oracle-kb/P1-03-02-逻辑设计与关系模式转换.md
```

---

**10. P1-03-03-规范化理论.md**

```yaml
title: "Oracle规范化理论与范式设计"
domain: "基础入门"
feature_type: "数据库设计"
target_audience: "DBA/架构师"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle规范化理论与范式设计"的知识文档。

知识点内容：
- 函数依赖：完全函数依赖、部分函数依赖、传递函数依赖
- 范式与规范化过程：1NF、2NF、3NF、BCNF、4NF、5NF
- 范式选择与反规范化设计：性能与冗余的权衡

要求：
1. 各范式在Oracle设计中的实际应用
2. Oracle对反规范化的支持（物化视图、冗余字段）
3. Oracle设计中的范式权衡（性能vs一致性）
4. 实际案例：从非规范化到3NF的优化过程
5. Oracle最佳实践：何时应该反规范化

输出文件：oracle-kb/P1-03-03-规范化理论.md
```

---

**11. P1-03-04-模式分解.md**

```yaml
title: "Oracle模式分解技术"
domain: "基础入门"
feature_type: "数据库设计"
target_audience: "DBA/架构师"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle模式分解技术"的知识文档。

知识点内容：
- 无损连接分解：通过自然连接恢复原关系
- 保持函数依赖分解：所有依赖在子关系模式中可直接验证
- 算法：转换为3NF和BCNF的分解算法

要求：
1. 模式分解在Oracle数据库重构中的应用
2. Oracle中实现分解的方法（表拆分、视图统一）
3. 分解后的查询优化（JOIN性能）
4. Oracle工具支持（SQL Developer的重组功能）
5. 实际案例：大表分解的完整过程

输出文件：oracle-kb/P1-03-04-模式分解.md
```

---

#### 1.4 SQL基础（6篇）

**批次 5/34**

**12. P1-04-01-SQL概述与分类.md**

```yaml
title: "Oracle SQL概述与分类"
domain: "基础入门"
feature_type: "SQL基础"
target_audience: "DBA/开发者"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle SQL概述与分类"的知识文档。

知识点内容：
- DDL：定义、修改、删除数据库对象
- DML：数据增删改查
- DCL：权限控制
- TCL：事务控制

要求：
1. Oracle SQL的完整分类和每类包含的语句
2. Oracle SQL与标准SQL的差异
3. Oracle特有的SQL扩展（如CONNECT BY、MODEL子句）
4. 各类SQL的执行机制（解析、优化、执行）
5. 实际示例：每类SQL的典型用法

输出文件：oracle-kb/P1-04-01-SQL概述与分类.md
```

---

**13. P1-04-02-数据定义语言DDL.md**

```yaml
title: "Oracle DDL数据定义语言"
domain: "基础入门"
feature_type: "SQL基础"
target_audience: "DBA/开发者"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle DDL数据定义语言"的知识文档。

知识点内容：
- 数据类型：数值（INT、DECIMAL）、字符（CHAR、VARCHAR）、日期时间（DATE、TIMESTAMP）、二进制（BLOB）、大文本（CLOB）、JSON、空间类型等
- 表操作：CREATE TABLE、ALTER TABLE、DROP TABLE
- 索引：CREATE INDEX、DROP INDEX
- 视图：CREATE VIEW、DROP VIEW

要求：
1. Oracle特有的数据类型（NUMBER、VARCHAR2、RAW、ROWID等）
2. Oracle DDL的隐式提交特性
3. OracleDDL操作的性能影响和最佳实践
4. Oracle 12c+的新特性（如IDENTITY列、默认值优化）
5. 完整的DDL示例：建表、修改、删除、索引、视图

输出文件：oracle-kb/P1-04-02-数据定义语言DDL.md
```

---

**批次 6/34**

**14. P1-04-03-数据操纵语言DML.md**

```yaml
title: "Oracle DML数据操纵语言"
domain: "基础入门"
feature_type: "SQL基础"
target_audience: "DBA/开发者"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle DML数据操纵语言"的知识文档。

知识点内容：
- INSERT：单行插入、多行插入、子查询插入
- UPDATE：条件更新、关联更新
- DELETE：条件删除、截断（TRUNCATE）的区别
- MERGE（UPSERT）：合并插入/更新操作

要求：
1. Oracle DML的完整语法和用法
2. Oracle特有的DML特性（如INSERT ALL、UPDATE的RETURNING子句）
3. MERGE语句的高级用法
4. DML的性能优化（批量操作、直接路径插入）
5. DML与事务的关系（隐式事务、锁机制）
6. 完整的DML示例

输出文件：oracle-kb/P1-04-03-数据操纵语言DML.md
```

---

**15. P1-04-04-数据查询语言DQL.md**

```yaml
title: "Oracle DQL数据查询语言"
domain: "基础入门"
feature_type: "SQL基础"
target_audience: "DBA/开发者"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle DQL数据查询语言"的知识文档。

知识点内容：
- 基本查询：SELECT、FROM、WHERE条件
- 排序与去重：ORDER BY、DISTINCT
- 分页：LIMIT / FETCH FIRST / ROWNUM

要求：
1. Oracle SELECT的完整语法
2. Oracle特有的查询特性（如ROWNUM、ROWID、伪列）
3. Oracle分页查询的演进（ROWNUM → FETCH FIRST）
4. Oracle的NULL处理和比较规则
5. 查询性能基础（全表扫描vs索引扫描）
6. 完整的DQL示例

输出文件：oracle-kb/P1-04-04-数据查询语言DQL.md
```

---

**16. P1-04-05-聚合与分组.md**

```yaml
title: "Oracle聚合与分组查询"
domain: "基础入门"
feature_type: "SQL基础"
target_audience: "DBA/开发者"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle聚合与分组查询"的知识文档。

知识点内容：
- 聚合函数：COUNT、SUM、AVG、MAX、MIN
- 分组查询：GROUP BY、HAVING
- 分组增强：ROLLUP、CUBE、GROUPING SETS

要求：
1. Oracle聚合函数的完整列表和用法
2. Oracle特有的分组扩展（ROLLUP、CUBE、GROUPING SETS）
3. GROUPING函数和GROUP_ID函数
4. 聚合查询的性能优化
5. 实际案例：报表统计中的聚合应用
6. 完整的SQL示例

输出文件：oracle-kb/P1-04-05-聚合与分组.md
```

---

**批次 7/34**

**17. P1-04-06-子查询与连接.md**

```yaml
title: "Oracle子查询与连接操作"
domain: "基础入门"
feature_type: "SQL基础"
target_audience: "DBA/开发者"
difficulty: "入门"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle子查询与连接操作"的知识文档。

知识点内容：
- 子查询：标量子查询、行子查询、表子查询、相关子查询
- 连接操作：内连接、外连接、交叉连接、自连接
- 连接优化：嵌套循环、哈希连接、排序合并连接

要求：
1. Oracle子查询的完整分类和语法
2. Oracle连接语法（传统语法和ANSI SQL语法）
3. Oracle特有的连接特性（如NATURAL JOIN、USING子句）
4. 子查询与连接的性能对比
5. Oracle优化器如何选择连接方式
6. 实际案例和SQL示例

输出文件：oracle-kb/P1-04-06-子查询与连接.md
```

---


### 第二部分：数据库核心原理 ★★（22篇）

#### 2.1 存储引擎与物理存储（5篇）

**批次 8/34**

**18. P2-01-01-数据库文件结构.md**

```yaml
title: "Oracle数据库文件结构"
domain: "核心原理"
feature_type: "存储架构"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle数据库文件结构"的知识文档。

知识点内容：
- 数据文件（Data Files）
- 控制文件（Control Files）
- 重做日志文件（Redo Log Files）
- 归档日志文件（Archive Log Files）
- 参数文件（PFILE/SPFILE）
- 密码文件（Password File）

要求：
1. Oracle各类文件的作用和关系
2. 文件位置的默认路径和查询方法
3. Oracle Managed Files (OMF) 的使用
4. 文件管理和维护操作
5. 文件损坏的应急处理
6. 包含文件关系图（Mermaid）
7. 完整的SQL和命令示例

输出文件：oracle-kb/P2-01-01-数据库文件结构.md
```

---

**19. P2-01-02-数据块与页结构.md**

```yaml
title: "Oracle数据块结构详解"
domain: "核心原理"
feature_type: "存储架构"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle数据块结构详解"的知识文档。

知识点内容：
- 数据块（Block）结构：块头、数据区、空闲空间
- 块大小（DB_BLOCK_SIZE）的配置和影响
- 块内部结构：行目录、行数据
- 行迁移（Row Migration）和行链接（Row Chaining）

要求：
1. Oracle数据块的详细结构图解
2. 块头（Block Header）的各组成部分
3. PCTFREE和PCTUSED参数的作用
4. 行迁移和行链接的产生原因和解决方法
5. 块大小的选择和性能影响
6. 使用DBV工具检查块完整性
7. 包含块结构图（Mermaid）

输出文件：oracle-kb/P2-01-02-数据块与页结构.md
```

---

**批次 9/34**

**20. P2-01-03-行格式与存储.md**

```yaml
title: "Oracle行格式与存储机制"
domain: "核心原理"
feature_type: "存储架构"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle行格式与存储机制"的知识文档。

知识点内容：
- 行头（Row Header）结构
- 行数据（Row Data）存储
- 行长度限制
- ROWID的结构和用途
- 压缩行存储（Row Compression）

要求：
1. Oracle行的物理存储格式详解
2. ROWID的组成结构（数据对象号、文件号、块号、行号）
3. 行长度超过块大小的处理（行链接）
4. Oracle行压缩技术（Basic Compression、OLTP Compression）
5. 行存储对性能的影响
6. 使用DUMP分析行内容
7. 实际案例和示例

输出文件：oracle-kb/P2-01-03-行格式与存储.md
```

---

**21. P2-01-04-表空间管理.md**

```yaml
title: "Oracle表空间管理"
domain: "核心原理"
feature_type: "存储管理"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle表空间管理"的知识文档。

知识点内容：
- 表空间类型：SYSTEM、SYSAUX、UNDO、TEMP、用户表空间
- 表空间创建和管理
- 大文件表空间（Bigfile Tablespace）
- 表空间组（Tablespace Group）

要求：
1. Oracle各类表空间的作用和管理
2. 本地管理表空间（LMT）vs 字典管理表空间（DMT）
3. 自动段空间管理（ASSM）
4. 表空间的扩展和收缩操作
5. 表空间配额管理
6. 完整的表空间管理SQL示例

输出文件：oracle-kb/P2-01-04-表空间管理.md
```

---

**批次 10/34**

**22. P2-01-05-缓冲区管理.md**

```yaml
title: "Oracle缓冲区管理"
domain: "核心原理"
feature_type: "内存管理"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle缓冲区管理"的知识文档。

知识点内容：
- 数据库缓冲区缓存（Buffer Cache）
- 缓冲区状态：空闲、脏、正在使用
- LRU算法和触摸计数
- 多缓冲区池（Multiple Buffer Pools）

要求：
1. Oracle Buffer Cache的详细结构
2. 缓冲区的状态转换流程
3. LRU算法在Oracle中的实现
4. KEEP池、RECYCLE池、DEFAULT池的使用场景
5. 缓冲区命中率计算和优化
6. 相关的动态性能视图（V$BUFFER_POOL、V$BUFFER_POOL_STATISTICS）
7. 性能调优案例

输出文件：oracle-kb/P2-01-05-缓冲区管理.md
```

---

#### 2.2 索引原理与实现（4篇）

**23. P2-02-01-B+树索引.md**

```yaml
title: "Oracle B+树索引原理与实现"
domain: "核心原理"
feature_type: "索引技术"
target_audience: "DBA/开发者"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle B+树索引原理与实现"的知识文档。

知识点内容：
- B+树索引的结构：根节点、分支节点、叶节点
- 索引键的存储格式
- 索引扫描方式：唯一扫描、范围扫描、全扫描、快速全扫描
- 索引的选择性

要求：
1. Oracle B+树索引的详细结构图解
2. 索引行的物理存储格式
3. 各种索引扫描的适用场景
4. 索引选择性的计算方法
5. 索引对DML性能的影响
6. 索引重建和整理的时机
7. 包含索引结构图（Mermaid）
8. 完整的SQL示例

输出文件：oracle-kb/P2-02-01-B+树索引.md
```

---

**批次 11/34**

**24. P2-02-02-其他索引类型.md**

```yaml
title: "Oracle其他索引类型详解"
domain: "核心原理"
feature_type: "索引技术"
target_audience: "DBA/开发者"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle其他索引类型详解"的知识文档。

知识点内容：
- 位图索引（Bitmap Index）
- 函数索引（Function-Based Index）
- 反向键索引（Reverse Key Index）
- 索引组织表（Index-Organized Table, IOT）
- 域索引（Domain Index）

要求：
1. 每种索引类型的结构特点和适用场景
2. 位图索引在OLAP中的优势
3. 函数索引的创建和使用限制
4. IOT与普通堆表的对比
5. 各索引类型的性能特点
6. 完整的创建和使用示例

输出文件：oracle-kb/P2-02-02-其他索引类型.md
```

---

**25. P2-02-03-索引设计原则.md**

```yaml
title: "Oracle索引设计原则"
domain: "核心原理"
feature_type: "索引技术"
target_audience: "DBA/架构师"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle索引设计原则"的知识文档。

知识点内容：
- 索引选择策略：何时创建索引
- 复合索引设计：列顺序选择
- 索引与查询模式的匹配
- 索引数量的权衡

要求：
1. Oracle索引设计的最佳实践
2. 复合索引的最左前缀原则
3. 索引覆盖查询（Index Only Scan）
4. 索引对DML性能的影响分析
5. 索引设计的常见反模式
6. 实际案例：查询优化中的索引设计

输出文件：oracle-kb/P2-02-03-索引设计原则.md
```

---

**批次 12/34**

**26. P2-02-04-索引维护.md**

```yaml
title: "Oracle索引维护与管理"
domain: "核心原理"
feature_type: "索引技术"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle索引维护与管理"的知识文档。

知识点内容：
- 索引碎片分析
- 索引重建（REBUILD）vs 整理（COALESCE）
- 索引监控
- 不可见索引（Invisible Index）
- 索引的在线操作

要求：
1. Oracle索引碎片的产生原因和检测方法
2. ALTER INDEX的各种操作
3. 索引重建的时机判断标准
4. ONLINE重建的原理和限制
5. 索引监控的使用（ALTER INDEX MONITORING USAGE）
6. 索引维护的自动化脚本
7. 完整的维护SQL示例

输出文件：oracle-kb/P2-02-04-索引维护.md
```

---

#### 2.3 事务处理与并发控制（7篇）

**27. P2-03-01-事务概念与ACID.md**

```yaml
title: "Oracle事务概念与ACID特性"
domain: "核心原理"
feature_type: "事务管理"
target_audience: "DBA/开发者"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle事务概念与ACID特性"的知识文档。

知识点内容：
- 事务的定义和边界
- 原子性（Atomicity）
- 一致性（Consistency）
- 隔离性（Isolation）
- 持久性（Durability）

要求：
1. Oracle如何实现ACID四大特性
2. Oracle事务的启动和结束方式
3. 隐式事务和显式事务
4. Oracle的提交（COMMIT）和回滚（ROLLBACK）机制
5. 事务日志（Redo）保证持久性
6. 实际案例：ACID特性的验证

输出文件：oracle-kb/P2-03-01-事务概念与ACID.md
```

---

**批次 13/34**

**28. P2-03-02-并发问题.md**

```yaml
title: "Oracle并发控制问题详解"
domain: "核心原理"
feature_type: "事务管理"
target_audience: "DBA/开发者"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle并发控制问题详解"的知识文档。

知识点内容：
- 丢失更新（Lost Update）
- 脏读（Dirty Read）
- 不可重复读（Non-Repeatable Read）
- 幻读（Phantom Read）

要求：
1. 每种并发问题的详细场景说明
2. Oracle如何避免这些问题
3. Oracle默认隔离级别的特点
4. 与其他数据库（如MySQL）的对比
5. 实际案例：并发问题的复现和解决
6. 时序图展示并发问题（Mermaid）

输出文件：oracle-kb/P2-03-02-并发问题.md
```

---

**29. P2-03-03-隔离级别.md**

```yaml
title: "Oracle事务隔离级别"
domain: "核心原理"
feature_type: "事务管理"
target_audience: "DBA/开发者"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle事务隔离级别"的知识文档。

知识点内容：
- READ COMMITTED（Oracle默认）
- SERIALIZABLE
- READ ONLY
- 与SQL标准的对比

要求：
1. Oracle支持的隔离级别详解
2. 为什么Oracle不支持REPEATABLE READ
3. 各隔离级别的实现机制
4. 隔离级别的选择建议
5. SERIALIZABLE的性能影响
6. 实际案例：不同隔离级别的行为对比

输出文件：oracle-kb/P2-03-03-隔离级别.md
```

---

**批次 14/34**

**30. P2-03-04-锁机制基础.md**

```yaml
title: "Oracle锁机制基础"
domain: "核心原理"
feature_type: "事务管理"
target_audience: "DBA/开发者"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle锁机制基础"的知识文档。

知识点内容：
- 锁的类型：TM锁（表锁）、TX锁（事务锁）
- 锁模式：共享锁、排他锁
- 锁的获取和释放
- DML锁和DDL锁

要求：
1. Oracle锁机制的详细分类
2. TM锁的6种模式（0-6）
3. Oracle的行级锁实现（ITL槽）
4. 锁等待和锁超时
5. 锁相关的动态视图（V$LOCK、V$LOCKED_OBJECT）
6. 实际案例：锁问题的诊断和解决

输出文件：oracle-kb/P2-03-04-锁机制基础.md
```

---

**31. P2-03-05-MVCC.md**

```yaml
title: "Oracle MVCC多版本并发控制"
domain: "核心原理"
feature_type: "事务管理"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle MVCC多版本并发控制"的知识文档。

知识点内容：
- MVCC的基本原理
- Oracle的UNDO机制
- 读一致性（Read Consistency）
- SCN（System Change Number）

要求：
1. Oracle MVCC的实现机制
2. UNDO段的结构和管理
3. 读一致性的实现原理
4. SCN的作用和增长机制
5. ORA-01555快照过旧错误的原因和解决
6. MVCC与锁的对比
7. 性能调优建议

输出文件：oracle-kb/P2-03-05-MVCC.md
```

---

**批次 15/34**

**32. P2-03-06-死锁检测与处理.md**

```yaml
title: "Oracle死锁检测与处理"
domain: "核心原理"
feature_type: "事务管理"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle死锁检测与处理"的知识文档。

知识点内容：
- 死锁的形成条件
- Oracle的死锁检测机制
- 死锁的解决方法
- 死锁的预防策略

要求：
1. Oracle死锁检测的实现（每3秒检测一次）
2. ORA-00060错误的处理流程
3. 死锁跟踪文件的分析
4. 应用层死锁 vs 数据库层死锁
5. 死锁预防的最佳实践
6. 实际案例：死锁的诊断和解决
7. 监控死锁的脚本

输出文件：oracle-kb/P2-03-06-死锁检测与处理.md
```

---

**33. P2-03-07-分布式事务.md**

```yaml
title: "Oracle分布式事务管理"
domain: "核心原理"
feature_type: "事务管理"
target_audience: "DBA/架构师"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle分布式事务管理"的知识文档。

知识点内容：
- 两阶段提交（2PC）
- 分布式事务的生命周期
- 悬挂事务（In-Doubt Transaction）
- XA协议

要求：
1. Oracle分布式事务的实现机制
2. DBA_2PC_PENDING视图的使用
3. 悬挂事务的处理方法
4. XA事务的开发接口
5. 分布式事务的性能影响
6. 实际案例：分布式事务故障处理

输出文件：oracle-kb/P2-03-07-分布式事务.md
```

---

#### 2.4 日志与恢复（6篇）

**批次 16/34**

**34. P2-04-01-WAL原则.md**

```yaml
title: "Oracle WAL原则与Redo机制"
domain: "核心原理"
feature_type: "日志恢复"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle WAL原则与Redo机制"的知识文档。

知识点内容：
- Write-Ahead Logging原则
- Oracle Redo Log的结构
- Redo生成和写入流程
- LGWR进程的工作机制

要求：
1. Oracle如何实现WAL原则
2. Redo Record、Redo Block的结构
3. LGWR的触发条件
4. Redo Log Group的循环使用
5. Redo的大小和性能影响
6. 相关的动态视图和参数
7. 性能调优建议

输出文件：oracle-kb/P2-04-01-WAL原则.md
```

---

**35. P2-04-02-Checkpoint机制.md**

```yaml
title: "Oracle Checkpoint机制详解"
domain: "核心原理"
feature_type: "日志恢复"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle Checkpoint机制详解"的知识文档。

知识点内容：
- Checkpoint的触发条件
- CKPT进程的作用
- DBWR与Checkpoint的关系
- Checkpoint对恢复时间的影响

要求：
1. Oracle Checkpoint的完整流程
2. 增量检查点（Incremental Checkpoint）
3. 部分检查点（Partial Checkpoint）
4. Checkpoint相关的参数配置
5. Checkpoint频率的调优
6. 监控Checkpoint的视图和命令
7. 实际案例分析

输出文件：oracle-kb/P2-04-02-Checkpoint机制.md
```

---

**批次 17/34**

**36. P2-04-03-崩溃恢复流程.md**

```yaml
title: "Oracle崩溃恢复流程"
domain: "核心原理"
feature_type: "日志恢复"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle崩溃恢复流程"的知识文档。

知识点内容：
- 实例恢复（Instance Recovery）
- 前滚（Rolling Forward）
- 回滚（Rolling Back）
- 恢复时间的估算

要求：
1. Oracle崩溃恢复的完整流程
2. MTTR（Mean Time To Recovery）的计算
3. FAST_START_MTTR_TARGET参数
4. 恢复过程的监控
5. 并行恢复的使用
6. 实际案例：崩溃恢复的分析

输出文件：oracle-kb/P2-04-03-崩溃恢复流程.md
```

---

**37. P2-04-04-介质恢复.md**

```yaml
title: "Oracle介质恢复技术"
domain: "核心原理"
feature_type: "日志恢复"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle介质恢复技术"的知识文档。

知识点内容：
- 完全恢复 vs 不完全恢复
- 数据文件恢复
- 表空间恢复
- 块级恢复（Block Recovery）

要求：
1. Oracle介质恢复的各种场景
2. RMAN恢复命令详解
3. 块级恢复的优势和使用方法
4. 恢复过程中的注意事项
5. 恢复后的验证步骤
6. 完整的恢复操作示例

输出文件：oracle-kb/P2-04-04-介质恢复.md
```

---

**批次 18/34**

**38. P2-04-05-闪回技术.md**

```yaml
title: "Oracle闪回技术详解"
domain: "核心原理"
feature_type: "日志恢复"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle闪回技术详解"的知识文档。

知识点内容：
- 闪回查询（Flashback Query）
- 闪回版本查询（Flashback Version Query）
- 闪回事务查询（Flashback Transaction Query）
- 闪回表（Flashback Table）
- 闪回删除（Flashback Drop）
- 闪回数据库（Flashback Database）

要求：
1. Oracle各种闪回技术的原理和用法
2. 闪回数据的存储（UNDO、Flashback Log）
3. 各闪回技术的限制和前提条件
4. 闪回技术的性能影响
5. 实际案例：误操作恢复
6. 完整的SQL和命令示例

输出文件：oracle-kb/P2-04-05-闪回技术.md
```

---

**39. P2-04-06-Point-in-Time恢复.md**

```yaml
title: "Oracle时间点恢复（PITR）"
domain: "核心原理"
feature_type: "日志恢复"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle时间点恢复（PITR）"的知识文档。

知识点内容：
- 不完全恢复的概念
- 基于时间的恢复
- 基于SCN的恢复
- 基于取消的恢复

要求：
1. Oracle PITR的实现方法
2. RMAN的UNTIL TIME/SCN/CANCEL语法
3. PITR的前提条件和限制
4. 恢复后的处理（RESETLOGS）
5. 表空间时间点恢复（TSPITR）
6. 实际案例：逻辑错误的数据恢复

输出文件：oracle-kb/P2-04-06-Point-in-Time恢复.md
```

---


### 第三部分：数据库管理 ★★（19篇）

#### 3.1 安装与配置（3篇）

**批次 19/34**

**40. P3-01-01-安装规划.md**

```yaml
title: "Oracle安装规划指南"
domain: "数据库管理"
feature_type: "安装部署"
target_audience: "DBA/运维"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle安装规划指南"的知识文档。

知识点内容：
- 硬件需求评估（CPU、内存、磁盘）
- 操作系统要求
- 软件依赖和内核参数
- 目录规划（ORACLE_BASE、ORACLE_HOME）

要求：
1. Oracle 19c/21c的完整安装规划清单
2. Linux平台的具体配置要求
3. 内核参数和系统限制配置
4. 用户和组的创建
5. OUI（Oracle Universal Installer）的使用
6. OPatch补丁管理
7. 完整的安装前检查脚本

输出文件：oracle-kb/P3-01-01-安装规划.md
```

---

**41. P3-01-02-实例创建与配置.md**

```yaml
title: "Oracle实例创建与配置"
domain: "数据库管理"
feature_type: "安装部署"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle实例创建与配置"的知识文档。

知识点内容：
- DBCA创建数据库
- 字符集选择
- 初始化参数配置
- 模板化部署

要求：
1. DBCA的图形化和静默创建方式
2. 字符集AL32UTF8的选择建议
3. 关键初始化参数的配置建议
4. 数据库模板的创建和使用
5. CDB/PDB的创建（12c+多租户）
6. 完整的创建和配置示例

输出文件：oracle-kb/P3-01-02-实例创建与配置.md
```

---

**批次 20/34**

**42. P3-01-03-网络配置.md**

```yaml
title: "Oracle网络配置详解"
domain: "数据库管理"
feature_type: "安装部署"
target_audience: "DBA/运维"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle网络配置详解"的知识文档。

知识点内容：
- 监听器配置（Listener）
- tnsnames.ora配置
- 命名方法（本地、目录、LDAP）
- 连接描述符

要求：
1. listener.ora的完整配置说明
2. tnsnames.ora的连接描述符详解
3. 静态注册和动态注册
4. Oracle Net的跟踪和诊断
5. 连接管理器（CMAN）的使用
6. 常见网络连接问题的排查
7. 完整的配置示例

输出文件：oracle-kb/P3-01-03-网络配置.md
```

---

#### 3.2 用户与权限管理（4篇）

**43. P3-02-01-用户管理.md**

```yaml
title: "Oracle用户管理"
domain: "数据库管理"
feature_type: "安全管理"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle用户管理"的知识文档。

知识点内容：
- 用户创建和管理
- 密码策略
- 用户配额
- 用户锁定和解锁

要求：
1. Oracle用户的完整管理操作
2. Profile的使用（密码策略、资源限制）
3. 用户配额管理
4. 常见用户管理场景
5. 安全最佳实践
6. 完整的SQL示例

输出文件：oracle-kb/P3-02-01-用户管理.md
```

---

**批次 21/34**

**44. P3-02-02-权限管理.md**

```yaml
title: "Oracle权限管理体系"
domain: "数据库管理"
feature_type: "安全管理"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle权限管理体系"的知识文档。

知识点内容：
- 系统权限
- 对象权限
- 权限授予和回收
- 权限继承

要求：
1. Oracle系统权限的完整列表和分类
2. 对象权限的管理
3. ANY权限的风险和控制
4. 权限审计和检查
5. 最小权限原则的实施
6. 完整的权限管理SQL示例

输出文件：oracle-kb/P3-02-02-权限管理.md
```

---

**45. P3-02-03-角色管理.md**

```yaml
title: "Oracle角色管理"
domain: "数据库管理"
feature_type: "安全管理"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle角色管理"的知识文档。

知识点内容：
- 预定义角色（DBA、CONNECT、RESOURCE）
- 自定义角色
- 角色的启用和禁用
- 角色继承

要求：
1. Oracle预定义角色的详细说明
2. 自定义角色的创建和管理
3. 角色的层次结构
4. 安全应用角色（Secure Application Role）
5. 角色管理的最佳实践
6. 完整的角色管理SQL示例

输出文件：oracle-kb/P3-02-03-角色管理.md
```

---

**批次 22/34**

**46. P3-02-04-审计.md**

```yaml
title: "Oracle审计技术详解"
domain: "数据库管理"
feature_type: "安全管理"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle审计技术详解"的知识文档。

知识点内容：
- 传统审计（Traditional Auditing）
- 统一审计（Unified Auditing，12c+）
- 细粒度审计（FGA）
- 审计日志管理

要求：
1. Oracle审计的各种方式和配置
2. 统一审计策略的创建
3. FGA的实现和限制
4. 审计日志的查看和管理
5. 审计性能影响和优化
6. 合规审计场景
7. 完整的审计配置示例

输出文件：oracle-kb/P3-02-04-审计.md
```

---

#### 3.3 存储空间管理（4篇）

**47. P3-03-01-表空间管理.md**

```yaml
title: "Oracle表空间日常管理"
domain: "数据库管理"
feature_type: "存储管理"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle表空间日常管理"的知识文档。

知识点内容：
- 表空间创建和扩展
- 表空间监控
- 表空间收缩
- 只读表空间

要求：
1. 表空间的日常管理操作
2. 自动扩展和手动扩展的配置
3. 表空间使用率监控
4. 表空间的在线移动（12c+）
5. 空间回收操作
6. 完整的表空间管理SQL

输出文件：oracle-kb/P3-03-01-表空间管理.md
```

---

**批次 23/34**

**48. P3-03-02-数据文件管理.md**

```yaml
title: "Oracle数据文件管理"
domain: "数据库管理"
feature_type: "存储管理"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle数据文件管理"的知识文档。

知识点内容：
- 数据文件添加和删除
- 数据文件移动
- 数据文件离线和在线
- 临时文件管理

要求：
1. 数据文件的日常管理操作
2. 数据文件的在线移动（12c+）
3. 临时表空间和临时文件管理
4. 数据文件I/O分布优化
5. ASM中的数据文件管理
6. 完整的数据文件管理SQL

输出文件：oracle-kb/P3-03-02-数据文件管理.md
```

---

**49. P3-03-03-段与区管理.md**

```yaml
title: "Oracle段与区管理"
domain: "数据库管理"
feature_type: "存储管理"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle段与区管理"的知识文档。

知识点内容：
- 段（Segment）类型：数据段、索引段、回滚段、临时段
- 区（Extent）管理
- 块（Block）管理
- 高水位线（HWM）

要求：
1. Oracle存储层次结构详解
2. 自动段空间管理（ASSM）
3. 区分配方式（自动vs手动）
4. 高水位线的概念和管理
5. 段收缩（SHRINK）操作
6. 空间回收的方法
7. 完整的存储管理SQL

输出文件：oracle-kb/P3-03-03-段与区管理.md
```

---

**批次 24/34**

**50. P3-03-04-空间监控与回收.md**

```yaml
title: "Oracle空间监控与回收"
domain: "数据库管理"
feature_type: "存储管理"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle空间监控与回收"的知识文档。

知识点内容：
- 空间使用监控
- 碎片分析
- 空间回收方法
- 自动空间管理

要求：
1. Oracle空间监控的视图和工具
2. 表空间使用率报表
3. 碎片检测和整理
4. Segment Advisor的使用
5. 自动空间管理特性
6. 空间回收的最佳实践
7. 完整的监控和回收脚本

输出文件：oracle-kb/P3-03-04-空间监控与回收.md
```

---

#### 3.4 备份与恢复（4篇）

**51. P3-04-01-备份策略.md**

```yaml
title: "Oracle备份策略设计"
domain: "数据库管理"
feature_type: "备份恢复"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle备份策略设计"的知识文档。

知识点内容：
- 备份类型：全备、增量、差异
- 备份策略设计
- RPO和RTO规划
- 备份验证

要求：
1. Oracle备份策略的完整设计方法
2. 增量备份的级别和策略
3. RMAN备份的压缩和加密
4. 备份验证和恢复测试
5. 备份保留策略
6. 完整的备份策略方案

输出文件：oracle-kb/P3-04-01-备份策略.md
```

---

**批次 25/34**

**52. P3-04-02-RMAN物理备份.md**

```yaml
title: "Oracle RMAN物理备份详解"
domain: "数据库管理"
feature_type: "备份恢复"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle RMAN物理备份详解"的知识文档。

知识点内容：
- RMAN架构和组件
- 备份命令详解
- 备份集和镜像拷贝
- 增量备份

要求：
1. RMAN的完整命令参考
2. 备份集的格式和管理
3. 增量备份的实现原理
4. 块变化跟踪（Block Change Tracking）
5. 备份到磁盘和磁带
6. 完整的RMAN备份脚本

输出文件：oracle-kb/P3-04-02-RMAN物理备份.md
```

---

**53. P3-04-03-逻辑备份.md**

```yaml
title: "Oracle逻辑备份技术"
domain: "数据库管理"
feature_type: "备份恢复"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle逻辑备份技术"的知识文档。

知识点内容：
- Data Pump（expdp/impdp）
- 原始exp/imp（遗留）
- 逻辑备份的使用场景
- 跨平台迁移

要求：
1. Data Pump的完整使用指南
2. 各种导出模式（全库、模式、表、表空间）
3. 并行导出和导入
4. 网络导出导入
5. 跨平台迁移的方法
6. 完整的Data Pump命令示例

输出文件：oracle-kb/P3-04-03-逻辑备份.md
```

---

**批次 26/34**

**54. P3-04-04-恢复操作.md**

```yaml
title: "Oracle恢复操作指南"
domain: "数据库管理"
feature_type: "备份恢复"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle恢复操作指南"的知识文档。

知识点内容：
- 完全恢复操作
- 不完全恢复操作
- 数据文件恢复
- 表恢复

要求：
1. RMAN恢复的完整操作流程
2. 各种恢复场景的处理方法
3. 恢复到新主机的步骤
4. 表级恢复（12c+）
5. 恢复验证和测试
6. 完整的恢复操作脚本

输出文件：oracle-kb/P3-04-04-恢复操作.md
```

---

#### 3.5 日常运维（4篇）

**55. P3-05-01-启停与状态检查.md**

```yaml
title: "Oracle实例启停与状态检查"
domain: "数据库管理"
feature_type: "日常运维"
target_audience: "DBA/运维"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle实例启停与状态检查"的知识文档。

知识点内容：
- 实例启动过程（NOMOUNT→MOUNT→OPEN）
- 实例关闭方式（NORMAL/TRANSACTIONAL/IMMEDIATE/ABORT）
- 状态检查和监控
- 服务管理

要求：
1. Oracle启停的完整命令和流程
2. 各启动阶段的含义和操作
3. 各关闭方式的区别和使用场景
4. 实例状态检查的方法
5. 监听器和数据库服务管理
6. 完整的启停和检查脚本

输出文件：oracle-kb/P3-05-01-启停与状态检查.md
```

---

**批次 27/34**

**56. P3-05-02-补丁与升级.md**

```yaml
title: "Oracle补丁与升级管理"
domain: "数据库管理"
feature_type: "日常运维"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle补丁与升级管理"的知识文档。

知识点内容：
- 补丁类型：PSU、BP、RU、 RUR
- OPatch工具使用
- 数据库升级方法
- 升级前检查

要求：
1. Oracle补丁的分类和发布周期
2. OPatch的完整使用指南
3. 数据库升级的方法（DBUA、手动、AutoUpgrade）
4. 升级前的准备工作
5. 升级后的验证步骤
6. 回退方案
7. 完整的补丁和升级操作示例

输出文件：oracle-kb/P3-05-02-补丁与升级.md
```

---

**57. P3-05-03-性能监控.md**

```yaml
title: "Oracle日常性能监控"
domain: "数据库管理"
feature_type: "日常运维"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle日常性能监控"的知识文档。

知识点内容：
- 关键性能指标
- 监控视图和工具
- 告警配置
- 性能基线

要求：
1. Oracle日常监控的关键指标
2. 常用的动态性能视图
3. AWR和ASH的使用
4. 性能基线的建立
5. 告警阈值的配置
6. 日常监控脚本和报表
7. 完整的监控方案

输出文件：oracle-kb/P3-05-03-性能监控.md
```

---

**批次 28/34**

**58. P3-05-04-日志管理.md**

```yaml
title: "Oracle日志管理"
domain: "数据库管理"
feature_type: "日常运维"
target_audience: "DBA"
difficulty: "进阶"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle日志管理"的知识文档。

知识点内容：
- Alert日志管理
- 跟踪文件管理
- 审计日志管理
- 日志轮转和清理

要求：
1. Oracle各类日志的位置和管理
2. Alert日志的分析方法
3. 跟踪文件的生成和分析
4. 日志文件的轮转策略
5. 日志空间管理
6. 日志分析工具
7. 完整的日志管理脚本

输出文件：oracle-kb/P3-05-04-日志管理.md
```

---


### 第四部分：SQL编程与开发 ★★★（17篇）

#### 4.1 高级SQL（4篇）

**批次 29/34**

**59. P4-01-01-窗口函数.md**

```yaml
title: "Oracle窗口函数详解"
domain: "SQL编程与开发"
feature_type: "高级SQL"
target_audience: "开发者/DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle窗口函数详解"的知识文档。

知识点内容：
- 窗口函数分类：聚合窗口、排名窗口、偏移窗口
- OVER子句语法
- PARTITION BY和ORDER BY
- 窗口范围（ROWS/RANGE）

要求：
1. Oracle窗口函数的完整分类和语法
2. ROW_NUMBER、RANK、DENSE_RANK的区别
3. LAG、LEAD、FIRST_VALUE、LAST_VALUE的使用
4. 窗口范围的定义和影响
5. 性能优化建议
6. 实际案例：报表统计、排名、累计计算
7. 完整的SQL示例

输出文件：oracle-kb/P4-01-01-窗口函数.md
```

---

**60. P4-01-02-CTE与递归查询.md**

```yaml
title: "Oracle CTE与递归查询"
domain: "SQL编程与开发"
feature_type: "高级SQL"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle CTE与递归查询"的知识文档。

知识点内容：
- WITH子句（CTE）
- 递归CTE
- CTE的物化和内联
- CONNECT BY vs 递归CTE

要求：
1. Oracle CTE的完整语法和用法
2. 递归CTE的实现（BOM展开、层次查询）
3. CTE与CONNECT BY的对比
4. CTE的性能特点
5. SEARCH和CYCLE子句（12c+）
6. 实际案例：层次数据查询、序列生成
7. 完整的SQL示例

输出文件：oracle-kb/P4-01-02-CTE与递归查询.md
```

---

**批次 30/34**

**61. P4-01-03-集合操作高级用法.md**

```yaml
title: "Oracle集合操作高级用法"
domain: "SQL编程与开发"
feature_type: "高级SQL"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle集合操作高级用法"的知识文档。

知识点内容：
- UNION/UNION ALL
- INTERSECT
- MINUS
- 集合操作的优化

要求：
1. Oracle集合操作的完整语法
2. 集合操作的性能特点
3. 集合操作与EXISTS/IN的转换
4. 集合操作的排序影响
5. 实际案例：数据对比、差异分析
6. 完整的SQL示例

输出文件：oracle-kb/P4-01-03-集合操作高级用法.md
```

---

**62. P4-01-04-正则表达式与字符串.md**

```yaml
title: "Oracle正则表达式与字符串处理"
domain: "SQL编程与开发"
feature_type: "高级SQL"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle正则表达式与字符串处理"的知识文档。

知识点内容：
- REGEXP_LIKE、REGEXP_SUBSTR
- REGEXP_REPLACE、REGEXP_INSTR
- REGEXP_COUNT（11g+）
- 字符串函数大全

要求：
1. Oracle正则表达式函数的完整用法
2. 正则表达式的语法和限制
3. 常用字符串函数（SUBSTR、INSTR、REPLACE等）
4. 正则表达式的性能考虑
5. 实际案例：数据清洗、格式验证
6. 完整的SQL示例

输出文件：oracle-kb/P4-01-04-正则表达式与字符串.md
```

---

#### 4.2 存储过程与函数（4篇）

**63. P4-02-01-存储过程.md**

```yaml
title: "Oracle存储过程开发"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle存储过程开发"的知识文档。

知识点内容：
- 存储过程的创建和调用
- 参数模式：IN、OUT、IN OUT
- 存储过程的管理
- 调试技巧

要求：
1. Oracle存储过程的完整语法
2. 参数的使用和最佳实践
3. 存储过程的权限管理
4. 编译和调试方法
5. 存储过程的性能优化
6. 实际案例：批量数据处理
7. 完整的PL/SQL示例

输出文件：oracle-kb/P4-02-01-存储过程.md
```

---

**批次 31/34**

**64. P4-02-02-函数.md**

```yaml
title: "Oracle函数开发指南"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle函数开发指南"的知识文档。

知识点内容：
- 自定义函数的创建
- 函数在SQL中的使用
- 确定性函数（DETERMINISTIC）
- 管道函数（Pipelined Function）

要求：
1. Oracle函数的完整语法和用法
2. 函数与存储过程的区别
3. 函数在SQL语句中的调用
4. 管道函数的实现和优势
5. 函数的性能考虑
6. 实际案例：自定义数据处理函数
7. 完整的PL/SQL示例

输出文件：oracle-kb/P4-02-02-函数.md
```

---

**65. P4-02-03-包.md**

```yaml
title: "Oracle包（Package）开发"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle包（Package）开发"的知识文档。

知识点内容：
- 包规范和包体
- 包的封装和模块化
- 包级变量和状态
- 包的依赖管理

要求：
1. Oracle包的完整语法和结构
2. 包规范和包体的分离设计
3. 包级变量的持久性特点
4. 包的编译顺序和依赖
5. 包的版本管理
6. 实际案例：业务模块的包设计
7. 完整的PL/SQL示例

输出文件：oracle-kb/P4-02-03-包.md
```

---

**批次 32/34**

**66. P4-02-04-异常处理.md**

```yaml
title: "Oracle PL/SQL异常处理"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle PL/SQL异常处理"的知识文档。

知识点内容：
- 预定义异常
- 自定义异常
- 异常传播规则
- 异常日志记录

要求：
1. Oracle异常处理的完整机制
2. 常用预定义异常列表
3. RAISE_APPLICATION_ERROR的使用
4. 异常在嵌套块中的传播
5. 异常处理的性能影响
6. 最佳实践：统一异常处理框架
7. 完整的PL/SQL示例

输出文件：oracle-kb/P4-02-04-异常处理.md
```

---

#### 4.3 触发器（3篇）

**67. P4-03-01-DML触发器.md**

```yaml
title: "Oracle DML触发器"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle DML触发器"的知识文档。

知识点内容：
- 行级触发器和语句级触发器
- BEFORE和AFTER触发器
- INSERT/UPDATE/DELETE触发器
- INSTEAD OF触发器

要求：
1. Oracle DML触发器的完整语法
2. 各种触发器类型的使用场景
3. :NEW和:OLD伪记录的使用
4. 触发器的限制和注意事项
5. 触发器的替代方案（虚拟列、默认值）
6. 实际案例：审计日志、数据校验
7. 完整的PL/SQL示例

输出文件：oracle-kb/P4-03-01-DML触发器.md
```

---

**68. P4-03-02-系统触发器.md**

```yaml
title: "Oracle系统触发器"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者/DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle系统触发器"的知识文档。

知识点内容：
- 数据库级触发器
- 模式级触发器
- 系统事件触发器
- 触发器顺序

要求：
1. Oracle系统触发器的类型和语法
2. STARTUP/SHUTDOWN触发器
3. LOGON/LOGOFF触发器
4. DDL事件触发器
5. 触发器的执行顺序
6. 实际案例：登录审计、DDL监控
7. 完整的PL/SQL示例

输出文件：oracle-kb/P4-03-02-系统触发器.md
```

---

**批次 33/34**

**69. P4-03-03-触发器设计原则.md**

```yaml
title: "Oracle触发器设计原则"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者/架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle触发器设计原则"的知识文档。

知识点内容：
- 触发器的适用场景
- 触发器的反模式
- 触发器与业务逻辑的关系
- 触发器的替代方案

要求：
1. Oracle触发器的最佳实践
2. 何时应该使用触发器
3. 触发器的常见反模式
4. 触发器与约束、虚拟列的对比
5. 触发器的性能影响
6. 实际案例分析
7. 设计建议总结

输出文件：oracle-kb/P4-03-03-触发器设计原则.md
```

---

#### 4.4 动态SQL（3篇）

**70. P4-04-01-动态SQL概念.md**

```yaml
title: "Oracle动态SQL概念与方法"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle动态SQL概念与方法"的知识文档。

知识点内容：
- 动态SQL的概念和用途
- 动态SQL的方法：DBMS_SQL、EXECUTE IMMEDIATE
- 动态SQL的安全性
- 动态SQL的性能

要求：
1. Oracle动态SQL的完整概念说明
2. 两种动态SQL方法的对比
3. 动态SQL的安全风险（SQL注入）
4. 动态SQL的性能特点
5. 动态SQL的适用场景
6. 实际案例和代码示例

输出文件：oracle-kb/P4-04-01-动态SQL概念.md
```

---

**71. P4-04-02-EXECUTE_IMMEDIATE.md**

```yaml
title: "Oracle EXECUTE IMMEDIATE详解"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle EXECUTE IMMEDIATE详解"的知识文档。

知识点内容：
- EXECUTE IMMEDIATE语法
- 绑定变量使用
- INTO和BULK COLLECT
- 动态DDL和DML

要求：
1. EXECUTE IMMEDIATE的完整语法
2. 绑定变量的使用方法和优势
3. 动态查询结果的处理
4. 动态DDL的执行
5. 动态SQL的错误处理
6. 实际案例和完整的PL/SQL代码

输出文件：oracle-kb/P4-04-02-EXECUTE_IMMEDIATE.md
```

---

**批次 34/34（最后一批）**

**72. P4-04-03-DBMS_SQL包.md**

```yaml
title: "Oracle DBMS_SQL包使用指南"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle DBMS_SQL包使用指南"的知识文档。

知识点内容：
- DBMS_SQL包的API
- 游标操作：OPEN、PARSE、BIND、EXECUTE
- 列描述和获取值
- DBMS_SQL vs EXECUTE IMMEDIATE

要求：
1. DBMS_SQL包的完整API说明
2. 动态SQL的完整执行流程
3. 列描述（DESCRIBE_COLUMNS）的使用
4. DBMS_SQL与EXECUTE IMMEDIATE的选择
5. 实际案例：通用查询框架
6. 完整的PL/SQL代码

输出文件：oracle-kb/P4-04-03-DBMS_SQL包.md
```

---

#### 4.5 游标与集合操作（3篇）

**73. P4-05-01-显式游标.md**

```yaml
title: "Oracle显式游标"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle显式游标"的知识文档。

知识点内容：
- 显式游标的声明和使用
- 游标属性：%FOUND、%NOTFOUND、%ROWCOUNT、%ISOPEN
- 游标参数
- 游标FOR UPDATE

要求：
1. Oracle显式游标的完整语法
2. 游标的OPEN-FETCH-CLOSE流程
3. 游标参数的使用
4. FOR UPDATE和WHERE CURRENT OF
5. 游标的性能考虑
6. 实际案例和PL/SQL代码

输出文件：oracle-kb/P4-05-01-显式游标.md
```

---

**74. P4-05-02-隐式游标与游标FOR循环.md**

```yaml
title: "Oracle隐式游标与游标FOR循环"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle隐式游标与游标FOR循环"的知识文档。

知识点内容：
- 隐式游标（SQL%属性）
- 游标FOR循环
- 内联游标
- BULK COLLECT优化

要求：
1. Oracle隐式游标的属性和使用
2. 游标FOR循环的语法和优势
3. BULK COLLECT的性能优化
4. FORALL批量操作
5. 实际案例和PL/SQL代码

输出文件：oracle-kb/P4-05-02-隐式游标与游标FOR循环.md
```

---

**75. P4-05-03-REF_CURSOR与集合操作.md**

```yaml
title: "Oracle REF CURSOR与集合操作"
domain: "SQL编程与开发"
feature_type: "PL/SQL编程"
target_audience: "开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle REF CURSOR与集合操作"的知识文档。

知识点内容：
- SYS_REFCURSOR类型
- 强类型和弱类型REF CURSOR
- 游标变量传递
- PL/SQL集合类型

要求：
1. Oracle REF CURSOR的完整用法
2. 存储过程返回结果集
3. 游标变量的传递和关闭
4. PL/SQL集合类型（TABLE、VARRAY）
5. 实际案例：通用查询接口
6. 完整的PL/SQL代码

输出文件：oracle-kb/P4-05-03-REF_CURSOR与集合操作.md
```

---


### 第五部分：性能优化 ★★★（18篇）

#### 5.1 性能监控与诊断（3篇）

**76. P5-01-01-AWR与ASH.md**

```yaml
title: "Oracle AWR与ASH性能诊断"
domain: "性能优化"
feature_type: "性能监控"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle AWR与ASH性能诊断"的知识文档。

知识点内容：
- AWR（Automatic Workload Repository）
- AWR报告解读
- ASH（Active Session History）
- ASH报告分析

要求：
1. AWR的架构和数据采集机制
2. AWR报告的关键章节解读
3. ASH的采样机制和数据结构
4. ASH报告的分析方法
5. AWR/ASH的常用视图
6. 实际案例：性能问题诊断
7. 完整的报告和查询示例

输出文件：oracle-kb/P5-01-01-AWR与ASH.md
```

---

**77. P5-01-02-等待事件分析.md**

```yaml
title: "Oracle等待事件分析"
domain: "性能优化"
feature_type: "性能监控"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle等待事件分析"的知识文档。

知识点内容：
- 等待事件分类
- 常见等待事件详解
- 等待事件分析方法
- 等待事件与性能问题

要求：
1. Oracle等待事件的完整分类
2. 常见等待事件的原因和解决方法（db file sequential read、db file scattered read、log file sync、latch free等）
3. 等待事件的分析流程
4. 相关的动态视图
5. 实际案例：等待事件诊断
6. 等待事件速查表

输出文件：oracle-kb/P5-01-02-等待事件分析.md
```

---

**批次 35/34（补充批次）**

**78. P5-01-03-SQL_Trace与TKPROF.md**

```yaml
title: "Oracle SQL Trace与TKPROF"
domain: "性能优化"
feature_type: "性能监控"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle SQL Trace与TKPROF"的知识文档。

知识点内容：
- SQL Trace的启用方式
- TKPROF工具使用
- Trace文件分析
- 10046事件

要求：
1. SQL Trace的完整使用方法
2. 10046事件的各级别说明
3. TKPROF的输出格式解读
4. Trace文件的定位和分析
5. 实际案例：SQL性能分析
6. 完整的命令和示例

输出文件：oracle-kb/P5-01-03-SQL_Trace与TKPROF.md
```

---

#### 5.2 优化器与统计信息（3篇）

**79. P5-02-01-CBO原理.md**

```yaml
title: "Oracle CBO优化器原理"
domain: "性能优化"
feature_type: "优化器"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle CBO优化器原理"的知识文档。

知识点内容：
- CBO（Cost-Based Optimizer）原理
- 成本计算公式
- 优化器模式
- 自适应优化（12c+）

要求：
1. Oracle CBO的工作原理
2. 成本计算的要素（CPU成本、I/O成本）
3. 优化器模式的选择（ALL_ROWS、FIRST_ROWS）
4. 自适应查询优化（12c+）
5. SQL Plan Management
6. 优化器参数的影响
7. 实际案例分析

输出文件：oracle-kb/P5-02-01-CBO原理.md
```

---

**80. P5-02-02-统计信息管理.md**

```yaml
title: "Oracle统计信息管理"
domain: "性能优化"
feature_type: "优化器"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle统计信息管理"的知识文档。

知识点内容：
- 统计信息类型：表、列、索引
- 统计信息收集方法
- 自动统计信息管理
- 统计信息的锁定和恢复

要求：
1. Oracle统计信息的完整管理
2. DBMS_STATS包的常用过程
3. 自动统计信息收集的配置
4. 统计信息的锁定和恢复
5. 扩展统计信息（列组、表达式）
6. 统计信息对执行计划的影响
7. 完整的统计信息管理脚本

输出文件：oracle-kb/P5-02-02-统计信息管理.md
```

---

**批次 36/34**

**81. P5-02-03-执行计划分析.md**

```yaml
title: "Oracle执行计划分析"
domain: "性能优化"
feature_type: "优化器"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle执行计划分析"的知识文档。

知识点内容：
- 执行计划的获取方法
- 执行计划的解读
- 常见访问路径
- 连接方法

要求：
1. Oracle执行计划的各种获取方式
2. 执行计划中各操作的含义
3. 常见访问路径（TABLE ACCESS、INDEX SCAN等）
4. 连接方法（NESTED LOOP、HASH JOIN、SORT MERGE）
5. 执行计划的成本分析
6. 实际案例：执行计划优化
7. 完整的分析示例

输出文件：oracle-kb/P5-02-03-执行计划分析.md
```

---

#### 5.3 SQL调优（4篇）

**82. P5-03-01-SQL改写技巧.md**

```yaml
title: "Oracle SQL改写技巧"
domain: "性能优化"
feature_type: "SQL调优"
target_audience: "DBA/开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle SQL改写技巧"的知识文档。

知识点内容：
- SQL改写的基本原则
- 常见改写模式
- EXISTS vs IN
- 外连接消除

要求：
1. Oracle SQL改写的常用技巧
2. 子查询改写为连接
3. NOT EXISTS vs NOT IN
4. UNION vs OR
5. 分析函数的改写应用
6. 实际案例：SQL优化前后对比
7. 完整的SQL示例

输出文件：oracle-kb/P5-03-01-SQL改写技巧.md
```

---

**83. P5-03-02-Hint使用.md**

```yaml
title: "Oracle Hint使用指南"
domain: "性能优化"
feature_type: "SQL调优"
target_audience: "DBA/开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle Hint使用指南"的知识文档。

知识点内容：
- Hint的语法和位置
- 常用Hint分类
- Hint的组合使用
- Hint的限制和注意事项

要求：
1. Oracle Hint的完整分类
2. 常用Hint详解（INDEX、USE_NL、USE_HASH、PARALLEL等）
3. Hint的作用域和继承
4. Hint的失效原因
5. Hint的管理和维护
6. 实际案例：Hint优化
7. 完整的SQL示例

输出文件：oracle-kb/P5-03-02-Hint使用.md
```

---

**批次 37/34**

**84. P5-03-03-SQL_Profile与Baseline.md**

```yaml
title: "Oracle SQL Profile与SQL Plan Baseline"
domain: "性能优化"
feature_type: "SQL调优"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle SQL Profile与SQL Plan Baseline"的知识文档。

知识点内容：
- SQL Profile的概念和创建
- SQL Plan Baseline的管理
- SQL Plan Management
- 执行计划稳定性

要求：
1. SQL Profile的原理和使用
2. SQL Plan Baseline的创建和管理
3. SPM的执行计划演进
4. 执行计划稳定性的保障
5. 相关的DBMS_XPLAN和DBMS_SPM
6. 实际案例：执行计划控制
7. 完整的SQL示例

输出文件：oracle-kb/P5-03-03-SQL_Profile与Baseline.md
```

---

**85. P5-03-04-绑定变量与硬解析.md**

```yaml
title: "Oracle绑定变量与硬解析"
domain: "性能优化"
feature_type: "SQL调优"
target_audience: "DBA/开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle绑定变量与硬解析"的知识文档。

知识点内容：
- 硬解析与软解析
- 绑定变量的使用
- 游标共享（Cursor Sharing）
- 解析风暴问题

要求：
1. Oracle SQL解析的完整流程
2. 硬解析的性能影响
3. 绑定变量的使用方法和优势
4. CURSOR_SHARING参数的作用
5. 解析风暴的诊断和解决
6. 实际案例：解析性能优化
7. 完整的SQL示例

输出文件：oracle-kb/P5-03-04-绑定变量与硬解析.md
```

---

#### 5.4 实例级优化（4篇）

**86. P5-04-01-SGA优化.md**

```yaml
title: "Oracle SGA内存优化"
domain: "性能优化"
feature_type: "实例优化"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle SGA内存优化"的知识文档。

知识点内容：
- SGA组件和结构
- 自动内存管理（AMM）
- 自动共享内存管理（ASMM）
- SGA调优方法

要求：
1. Oracle SGA的完整组件说明
2. AMM和ASMM的配置和区别
3. Buffer Cache、Shared Pool的调优
4. SGA_TARGET和MEMORY_TARGET
5. SGA动态调整
6. 实际案例：SGA优化
7. 完整的参数配置示例

输出文件：oracle-kb/P5-04-01-SGA优化.md
```

---

**批次 38/34**

**87. P5-04-02-PGA优化.md**

```yaml
title: "Oracle PGA内存优化"
domain: "性能优化"
feature_type: "实例优化"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle PGA内存优化"的知识文档。

知识点内容：
- PGA的结构和组件
- 自动PGA管理
- 排序和哈希操作的内存分配
- PGA调优

要求：
1. Oracle PGA的完整结构
2. PGA_AGGREGATE_TARGET的配置
3. 排序区和哈希区的大小
4. 多通道（Multipass）执行的影响
5. PGA监控视图
6. 实际案例：PGA优化
7. 完整的参数配置示例

输出文件：oracle-kb/P5-04-02-PGA优化.md
```

---

**88. P5-04-03-IO优化.md**

```yaml
title: "Oracle I/O优化策略"
domain: "性能优化"
feature_type: "实例优化"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle I/O优化策略"的知识文档。

知识点内容：
- I/O类型：随机I/O、顺序I/O
- I/O分布策略
- 异步I/O和直接I/O
- I/O校准工具

要求：
1. Oracle I/O的特点和优化方法
2. 数据文件的I/O分布
3. 异步I/O的配置
4. DBMS_IOD_CALIBRATE的使用
5. I/O相关的等待事件
6. 实际案例：I/O性能优化
7. 完整的配置和诊断示例

输出文件：oracle-kb/P5-04-03-IO优化.md
```

---

**批次 39/34**

**89. P5-04-04-参数调优.md**

```yaml
title: "Oracle初始化参数调优"
domain: "性能优化"
feature_type: "实例优化"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle初始化参数调优"的知识文档。

知识点内容：
- 参数分类：隐含参数、显式参数
- 参数修改方法
- 参数调优策略
- 参数文件管理

要求：
1. Oracle重要初始化参数的说明
2. 参数修改的方法（ALTER SYSTEM/SESSION）
3. 参数调优的系统性方法
4. 隐含参数的查看和使用
5. SPFILE和PFILE的管理
6. 实际案例：参数调优
7. 完整的参数配置建议

输出文件：oracle-kb/P5-04-04-参数调优.md
```

---

#### 5.5 对象设计优化（4篇）

**90. P5-05-01-分区表设计.md**

```yaml
title: "Oracle分区表设计"
domain: "性能优化"
feature_type: "对象优化"
target_audience: "DBA/架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle分区表设计"的知识文档。

知识点内容：
- 分区类型：范围、列表、哈希、组合
- 分区键选择
- 分区裁剪（Partition Pruning）
- 分区维护操作

要求：
1. Oracle分区的完整类型和语法
2. 分区键的选择原则
3. 分区裁剪的实现条件
4. 分区的在线操作（12c+）
5. 全局索引vs本地索引
6. 实际案例：分区表设计
7. 完整的DDL示例

输出文件：oracle-kb/P5-05-01-分区表设计.md
```

---

**批次 40/34**

**91. P5-05-02-索引优化策略.md**

```yaml
title: "Oracle索引优化策略"
domain: "性能优化"
feature_type: "对象优化"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle索引优化策略"的知识文档。

知识点内容：
- 索引选择策略
- 索引性能分析
- 无用索引识别
- 索引优化方法

要求：
1. Oracle索引优化的系统方法
2. 索引使用情况的监控
3. 无用索引的识别和删除
4. 索引对DML性能的影响
5. 索引压缩技术
6. 实际案例：索引优化
7. 完整的分析和优化示例

输出文件：oracle-kb/P5-05-02-索引优化策略.md
```

---

**92. P5-05-03-物化视图.md**

```yaml
title: "Oracle物化视图技术"
domain: "性能优化"
feature_type: "对象优化"
target_audience: "DBA/开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle物化视图技术"的知识文档。

知识点内容：
- 物化视图的创建
- 刷新模式：完全、快速、强制
- 查询重写（Query Rewrite）
- 物化视图日志

要求：
1. Oracle物化视图的完整语法
2. 各种刷新模式的特点和选择
3. 查询重写的条件和限制
4. 物化视图的维护
5. 物化视图在数据仓库中的应用
6. 实际案例：报表性能优化
7. 完整的SQL示例

输出文件：oracle-kb/P5-05-03-物化视图.md
```

---

**批次 41/34**

**93. P5-05-04-表设计优化.md**

```yaml
title: "Oracle表设计优化"
domain: "性能优化"
feature_type: "对象优化"
target_audience: "DBA/架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle表设计优化"的知识文档。

知识点内容：
- 堆表vs索引组织表
- 行链接和行迁移
- 表压缩技术
- 虚拟列和不可见列

要求：
1. Oracle表类型的选择和优化
2. 行存储的优化方法
3. 表压缩的各种方式和效果
4. 虚拟列的应用场景
5. 表设计的性能考虑
6. 实际案例：表设计优化
7. 完整的DDL示例

输出文件：oracle-kb/P5-05-04-表设计优化.md
```

---


### 第六部分：高可用与集群 ★★★（15篇）

#### 6.1 复制技术（4篇）

**94. P6-01-01-物理复制DataGuard.md**

```yaml
title: "Oracle Data Guard物理复制"
domain: "高可用与集群"
feature_type: "复制技术"
target_audience: "DBA/架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle Data Guard物理复制"的知识文档。

知识点内容：
- Data Guard架构
- 物理备库和逻辑备库
- 保护模式：最大保护、最大性能、最大可用
- Active Data Guard

要求：
1. Oracle Data Guard的完整架构说明
2. 各种保护模式的特点和配置
3. 日志传输和应用机制
4. Active Data Guard的只读查询
5. 主备切换（Switchover）和故障切换（Failover）
6. 实际案例：Data Guard部署和切换
7. 完整的配置命令

输出文件：oracle-kb/P6-01-01-物理复制DataGuard.md
```

---

**95. P6-01-02-逻辑复制GoldenGate.md**

```yaml
title: "Oracle GoldenGate逻辑复制"
domain: "高可用与集群"
feature_type: "复制技术"
target_audience: "DBA/架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle GoldenGate逻辑复制"的知识文档。

知识点内容：
- GoldenGate架构
- Extract和Replicat进程
- 数据过滤和转换
- 双向复制

要求：
1. Oracle GoldenGate的完整架构说明
2. 各种进程的作用和配置
3. 数据过滤和转换的实现
4. GoldenGate的监控和管理
5. 实际案例：异构数据库复制
6. 完整的配置示例

输出文件：oracle-kb/P6-01-02-逻辑复制GoldenGate.md
```

---

**批次 42/34**

**96. P6-01-03-双向复制与冲突解决.md**

```yaml
title: "Oracle双向复制与冲突解决"
domain: "高可用与集群"
feature_type: "复制技术"
target_audience: "DBA/架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle双向复制与冲突解决"的知识文档。

知识点内容：
- 双向复制架构
- 冲突类型和检测
- 冲突解决方法
- 延迟配置

要求：
1. Oracle双向复制的实现方式
2. 各种冲突类型的识别
3. 冲突解决的策略和配置
4. GoldenGate双向复制的配置
5. 实际案例：冲突处理
6. 完整的配置示例

输出文件：oracle-kb/P6-01-03-双向复制与冲突解决.md
```

---

**97. P6-01-04-复制监控与故障处理.md**

```yaml
title: "Oracle复制监控与故障处理"
domain: "高可用与集群"
feature_type: "复制技术"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle复制监控与故障处理"的知识文档。

知识点内容：
- Data Guard监控
- GoldenGate监控
- 常见故障和处理
- 复制延迟诊断

要求：
1. Oracle复制的监控方法
2. Data Guard的监控视图和命令
3. GoldenGate的监控工具（GGSCI）
4. 常见故障的诊断和处理
5. 复制延迟的原因和解决
6. 实际案例：故障处理
7. 完整的监控脚本

输出文件：oracle-kb/P6-01-04-复制监控与故障处理.md
```

---

#### 6.2 共享存储集群（3篇）

**98. P6-02-01-RAC架构原理.md**

```yaml
title: "Oracle RAC架构原理"
domain: "高可用与集群"
feature_type: "集群技术"
target_audience: "DBA/架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle RAC架构原理"的知识文档。

知识点内容：
- RAC架构概述
- Cache Fusion技术
- 全局资源管理（GRD）
- 集群通信

要求：
1. Oracle RAC的完整架构说明
2. Cache Fusion的工作原理
3. 全局缓存服务（GCS）和全局队列服务（GES）
4. 集群 interconnect 网络
5. RAC的优缺点分析
6. 实际案例：RAC性能分析
7. 包含架构图（Mermaid）

输出文件：oracle-kb/P6-02-01-RAC架构原理.md
```

---

**批次 43/34**

**99. P6-02-02-RAC部署与配置.md**

```yaml
title: "Oracle RAC部署与配置"
domain: "高可用与集群"
feature_type: "集群技术"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle RAC部署与配置"的知识文档。

知识点内容：
- RAC安装规划
- Grid Infrastructure配置
- RAC数据库创建
- 服务管理

要求：
1. Oracle RAC的完整部署流程
2. Grid Infrastructure的安装和配置
3. RAC数据库的创建步骤
4. 服务（Service）的配置和管理
5. SCAN Listener配置
6. 实际案例：RAC部署
7. 完整的配置命令

输出文件：oracle-kb/P6-02-02-RAC部署与配置.md
```

---

**100. P6-02-03-RAC性能与故障处理.md**

```yaml
title: "Oracle RAC性能优化与故障处理"
domain: "高可用与集群"
feature_type: "集群技术"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle RAC性能优化与故障处理"的知识文档。

知识点内容：
- RAC性能监控
- Cache Fusion等待事件
- 节点驱逐和恢复
- 脑裂问题

要求：
1. Oracle RAC的性能监控方法
2. 常见的RAC等待事件和优化
3. 节点驱逐的原因和处理
4. 脑裂问题的诊断和解决
5. RAC One Node的使用
6. 实际案例：RAC故障处理
7. 完整的诊断脚本

输出文件：oracle-kb/P6-02-03-RAC性能与故障处理.md
```

---

#### 6.3 无共享集群与多主复制（2篇）

**101. P6-03-01-多主复制架构.md**

```yaml
title: "Oracle多主复制架构"
domain: "高可用与集群"
feature_type: "集群技术"
target_audience: "DBA/架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle多主复制架构"的知识文档。

知识点内容：
- 多主复制概念
- Advanced Replication
- 冲突解决机制
- 应用场景

要求：
1. Oracle多主复制的架构说明
2. Advanced Replication的配置
3. 冲突检测和解决方法
4. 多主复制的适用场景
5. 实际案例：多主复制部署
6. 完整的配置示例

输出文件：oracle-kb/P6-03-01-多主复制架构.md
```

---

**批次 44/34**

**102. P6-03-02-分片与分布式数据库.md**

```yaml
title: "Oracle分片与分布式数据库"
domain: "高可用与集群"
feature_type: "集群技术"
target_audience: "DBA/架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle分片与分布式数据库"的知识文档。

知识点内容：
- Oracle Sharding架构
- 分片键和分片方法
- 分片路由
- 分布式查询

要求：
1. Oracle Sharding的完整架构
2. 各种分片方法的特点
3. 分片路由的实现
4. 分布式事务的处理
5. Sharding的适用场景
6. 实际案例：分片部署
7. 完整的配置示例

输出文件：oracle-kb/P6-03-02-分片与分布式数据库.md
```

---

#### 6.4 高可用方案与中间件（3篇）

**103. P6-04-01-故障切换方案.md**

```yaml
title: "Oracle故障切换方案设计"
domain: "高可用与集群"
feature_type: "高可用"
target_audience: "DBA/架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle故障切换方案设计"的知识文档。

知识点内容：
- 故障切换类型：自动、手动
- TAF（Transparent Application Failover）
- FAN（Fast Application Notification）
- Application Continuity

要求：
1. Oracle故障切换的各种方式
2. TAF的配置和使用
3. FAN事件的处理
4. Application Continuity的实现
5. 故障切换时间的优化
6. 实际案例：故障切换测试
7. 完整的配置示例

输出文件：oracle-kb/P6-04-01-故障切换方案.md
```

---

**104. P6-04-02-连接池与负载均衡.md**

```yaml
title: "Oracle连接池与负载均衡"
domain: "高可用与集群"
feature_type: "高可用"
target_audience: "DBA/架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle连接池与负载均衡"的知识文档。

知识点内容：
- 连接池架构
- 负载均衡策略
- 连接路由
- 连接池监控

要求：
1. Oracle连接池的实现方式
2. UCP（Universal Connection Pool）的使用
3. 负载均衡的策略和配置
4. 连接路由的实现
5. 连接池的性能调优
6. 实际案例：连接池优化
7. 完整的配置示例

输出文件：oracle-kb/P6-04-02-连接池与负载均衡.md
```

---

**批次 45/34**

**105. P6-04-03-应用层高可用设计.md**

```yaml
title: "Oracle应用层高可用设计"
domain: "高可用与集群"
feature_type: "高可用"
target_audience: "架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle应用层高可用设计"的知识文档。

知识点内容：
- 应用层高可用架构
- 重试机制设计
- 会话状态管理
- 优雅降级

要求：
1. Oracle应用层高可用的设计原则
2. 连接重试和语句重试的实现
3. 会话状态的保持和恢复
4. 优雅降级的策略
5. 高可用测试方法
6. 实际案例：高可用架构设计
7. 完整的架构图（Mermaid）

输出文件：oracle-kb/P6-04-03-应用层高可用设计.md
```

---

#### 6.5 容灾与数据保护（3篇）

**106. P6-05-01-容灾架构设计.md**

```yaml
title: "Oracle容灾架构设计"
domain: "高可用与集群"
feature_type: "容灾"
target_audience: "DBA/架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle容灾架构设计"的知识文档。

知识点内容：
- 容灾等级：数据级、应用级、业务级
- RPO和RTO规划
- 容灾架构选型
- 跨区域容灾

要求：
1. Oracle容灾架构的完整设计方法
2. 各种容灾方案的特点对比
3. RPO和RTO的规划方法
4. 跨区域容灾的网络考虑
5. 容灾演练计划
6. 实际案例：容灾架构设计
7. 完整的架构图（Mermaid）

输出文件：oracle-kb/P6-05-01-容灾架构设计.md
```

---

**107. P6-05-02-数据保护策略.md**

```yaml
title: "Oracle数据保护策略"
domain: "高可用与集群"
feature_type: "容灾"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle数据保护策略"的知识文档。

知识点内容：
- 数据备份策略
- 数据加密
- 数据脱敏
- 数据归档

要求：
1. Oracle数据保护的完整策略
2. TDE（Transparent Data Encryption）的配置
3. Data Masking的实现
4. 数据归档和生命周期管理
5. 数据保护合规要求
6. 实际案例：数据保护方案
7. 完整的配置示例

输出文件：oracle-kb/P6-05-02-数据保护策略.md
```

---

**批次 46/34**

**108. P6-05-03-容灾演练与切换.md**

```yaml
title: "Oracle容灾演练与切换"
domain: "高可用与集群"
feature_type: "容灾"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle容灾演练与切换"的知识文档。

知识点内容：
- 容灾演练计划
- 切换流程和步骤
- 回切操作
- 演练验证

要求：
1. Oracle容灾演练的完整流程
2. 主备切换的详细步骤
3. 回切操作的注意事项
4. 演练结果的验证方法
5. 演练文档模板
6. 实际案例：容灾演练
7. 完整的演练检查清单

输出文件：oracle-kb/P6-05-03-容灾演练与切换.md
```

---


### 第七部分：数据库内核与高级专题 ★★★（13篇）

#### 7.1 查询处理与优化器内核（2篇）

**109. P7-01-01-查询解析与执行计划生成.md**

```yaml
title: "Oracle查询解析与执行计划生成"
domain: "数据库内核"
feature_type: "查询处理"
target_audience: "DBA/内核开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle查询解析与执行计划生成"的知识文档。

知识点内容：
- SQL解析过程：语法分析、语义分析、优化
- 硬解析和软解析
- 执行计划的生成过程
- 自适应查询优化

要求：
1. Oracle SQL解析的完整流程
2. 共享池中的游标管理
3. 执行计划的生成算法
4. 自适应查询优化的实现
5. 相关的内部机制
6. 实际案例：解析性能分析
7. 包含流程图（Mermaid）

输出文件：oracle-kb/P7-01-01-查询解析与执行计划生成.md
```

---

**110. P7-01-02-连接算法与算子实现.md**

```yaml
title: "Oracle连接算法与算子实现"
domain: "数据库内核"
feature_type: "查询处理"
target_audience: "DBA/内核开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle连接算法与算子实现"的知识文档。

知识点内容：
- 嵌套循环连接（NL Join）
- 哈希连接（Hash Join）
- 排序合并连接（Sort-Merge Join）
- 其他连接方式

要求：
1. Oracle各种连接算法的详细实现
2. 各连接算法的适用场景和性能特点
3. 优化器如何选择连接算法
4. 连接算法的内存和I/O消耗
5. 实际案例：连接性能分析
6. 包含算法流程图（Mermaid）

输出文件：oracle-kb/P7-01-02-连接算法与算子实现.md
```

---

**批次 47/34**

#### 7.2 内存与存储管理（3篇）

**111. P7-02-01-缓冲区管理器深入.md**

```yaml
title: "Oracle缓冲区管理器深入"
domain: "数据库内核"
feature_type: "内存管理"
target_audience: "DBA/内核开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle缓冲区管理器深入"的知识文档。

知识点内容：
- 缓冲区管理器的内部结构
- 块获取和释放机制
- 脏块写入策略
- 缓冲区保护机制

要求：
1. Oracle Buffer Cache的内部管理机制
2. 块的获取流程（Latch保护）
3. 脏块的写入策略（DBWR进程）
4. 缓冲区的并发控制
5. 性能瓶颈分析
6. 实际案例：缓冲区性能调优

输出文件：oracle-kb/P7-02-01-缓冲区管理器深入.md
```

---

**112. P7-02-02-磁盘空间管理.md**

```yaml
title: "Oracle磁盘空间管理"
domain: "数据库内核"
feature_type: "存储管理"
target_audience: "DBA/内核开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle磁盘空间管理"的知识文档。

知识点内容：
- 空间分配机制
- 位图块管理
- 段空间管理
- ASM存储管理

要求：
1. Oracle磁盘空间管理的内部机制
2. 位图块（Bitmap Block）的管理
3. ASSM的实现原理
4. ASM的空间分配算法
5. 空间碎片问题
6. 实际案例：空间管理分析

输出文件：oracle-kb/P7-02-02-磁盘空间管理.md
```

---

**批次 48/34**

**113. P7-02-03-内存分配与回收.md**

```yaml
title: "Oracle内存分配与回收"
domain: "数据库内核"
feature_type: "内存管理"
target_audience: "DBA/内核开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle内存分配与回收"的知识文档。

知识点内容：
- PGA内存分配
- 共享池内存管理
- 内存回收机制
- 内存压力处理

要求：
1. Oracle内存分配的内部机制
2. 共享池的LRU管理
3. PGA的内存分配和回收
4. 内存压力的检测方法
5. OOM问题的处理
6. 实际案例：内存管理分析

输出文件：oracle-kb/P7-02-03-内存分配与回收.md
```

---

#### 7.3 并发控制深入（3篇）

**114. P7-03-01-锁管理器实现.md**

```yaml
title: "Oracle锁管理器实现"
domain: "数据库内核"
feature_type: "并发控制"
target_audience: "DBA/内核开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle锁管理器实现"的知识文档。

知识点内容：
- 锁管理器的架构
- 锁的获取和释放
- 锁队列管理
- 锁升级机制

要求：
1. Oracle锁管理器的内部架构
2. 锁请求的处理流程
3. 锁等待队列的管理
4. 锁升级的触发条件
5. 死锁检测的实现
6. 实际案例：锁性能分析

输出文件：oracle-kb/P7-03-01-锁管理器实现.md
```

---

**批次 49/34**

**115. P7-03-02-锁实现机制.md**

```yaml
title: "Oracle锁实现机制深入"
domain: "数据库内核"
feature_type: "并发控制"
target_audience: "DBA/内核开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle锁实现机制深入"的知识文档。

知识点内容：
- 锁队列的内部结构
- 行锁的实现（ITL槽）
- 表锁的实现
- 锁的内存结构

要求：
1. Oracle锁的内部实现细节
2. ITL槽的结构和作用
3. 行锁的物理存储
4. 锁的内存数据结构
5. 锁的性能影响分析
6. 实际案例：锁机制分析

输出文件：oracle-kb/P7-03-02-锁实现机制.md
```

---

**116. P7-03-03-可串行化隔离实现.md**

```yaml
title: "Oracle可串行化隔离实现"
domain: "数据库内核"
feature_type: "并发控制"
target_audience: "DBA/内核开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle可串行化隔离实现"的知识文档。

知识点内容：
- 可串行化隔离级别
- 依赖冲突检测
- ORA-08177错误
- SSI实现机制

要求：
1. Oracle可串行化隔离的实现原理
2. 依赖冲突的检测方法
3. ORA-08177错误的产生原因
4. 可串行化隔离的性能影响
5. 与其他数据库的对比
6. 实际案例：可串行化应用

输出文件：oracle-kb/P7-03-03-可串行化隔离实现.md
```

---

#### 7.4 日志与复制内核（3篇）

**117. P7-04-01-日志生成与组提交.md**

```yaml
title: "Oracle日志生成与组提交"
domain: "数据库内核"
feature_type: "日志恢复"
target_audience: "DBA/内核开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle日志生成与组提交"的知识文档。

知识点内容：
- Redo日志的生成过程
- 组提交优化
- LGWR的并发控制
- LSN（Log Sequence Number）

要求：
1. Oracle Redo日志的生成流程
2. 组提交的实现原理
3. LGWR的并发控制机制
4. LSN的管理和分配
5. 日志写入的性能优化
6. 实际案例：日志性能分析

输出文件：oracle-kb/P7-04-01-日志生成与组提交.md
```

---

**批次 50/34**

**118. P7-04-02-复制日志格式.md**

```yaml
title: "Oracle复制日志格式"
domain: "数据库内核"
feature_type: "日志恢复"
target_audience: "DBA/内核开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle复制日志格式"的知识文档。

知识点内容：
- 物理日志（Redo）格式
- 逻辑日志格式
- 日志解析工具
- 日志挖掘（LogMiner）

要求：
1. Oracle Redo日志的内部格式
2. 逻辑日志的格式和用途
3. LogMiner的使用方法
4. 日志解析的工具和技术
5. 日志格式的版本差异
6. 实际案例：日志分析

输出文件：oracle-kb/P7-04-02-复制日志格式.md
```

---

**119. P7-04-03-崩溃恢复的内核优化.md**

```yaml
title: "Oracle崩溃恢复内核优化"
domain: "数据库内核"
feature_type: "日志恢复"
target_audience: "DBA/内核开发者"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle崩溃恢复内核优化"的知识文档。

知识点内容：
- 并行恢复机制
- 恢复期间的优化
- 快速恢复技术
- 恢复性能调优

要求：
1. Oracle崩溃恢复的内部优化
2. 并行恢复的实现
3. 快速恢复的技术手段
4. 恢复性能的影响因素
5. 恢复时间的优化方法
6. 实际案例：恢复性能分析

输出文件：oracle-kb/P7-04-03-崩溃恢复的内核优化.md
```

---

#### 7.5 数据库安全深度（2篇）

**120. P7-05-01-加密实现.md**

```yaml
title: "Oracle加密技术实现"
domain: "数据库内核"
feature_type: "安全技术"
target_audience: "DBA/安全工程师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle加密技术实现"的知识文档。

知识点内容：
- TDE（Transparent Data Encryption）
- 传输加密（TLS/SSL）
- 密钥管理
- 加密性能影响

要求：
1. Oracle加密技术的完整实现
2. TDE的配置和使用
3. 密钥管理最佳实践
4. 传输加密的部署
5. 加密的性能影响分析
6. 实际案例：加密部署
7. 完整的配置示例

输出文件：oracle-kb/P7-05-01-加密实现.md
```

---

**批次 51/34**

**121. P7-05-02-高级审计与入侵检测.md**

```yaml
title: "Oracle高级审计与入侵检测"
domain: "数据库内核"
feature_type: "安全技术"
target_audience: "DBA/安全工程师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle高级审计与入侵检测"的知识文档。

知识点内容：
- 统一审计框架
- 条件审计
- 安全评估工具
- 入侵检测

要求：
1. Oracle高级审计的完整实现
2. 统一审计的配置
3. 条件审计的实现
4. 安全评估工具的使用
5. 入侵检测的方法
6. 实际案例：安全审计部署
7. 完整的配置示例

输出文件：oracle-kb/P7-05-02-高级审计与入侵检测.md
```

---

### 第八部分：数据库架构设计与实践 ★★★（12篇）

#### 8.1 需求分析与数据建模（2篇）

**122. P8-01-01-业务需求到数据模型.md**

```yaml
title: "Oracle业务需求到数据模型"
domain: "架构设计"
feature_type: "数据建模"
target_audience: "架构师/DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle业务需求到数据模型"的知识文档。

知识点内容：
- 用例与数据实体识别
- 概念建模（ER图）
- 逻辑建模（关系模式）
- 物理建模

要求：
1. Oracle数据库建模的完整流程
2. 从业务需求到ER图的方法
3. 逻辑建模的规范化
4. 物理建模的Oracle特性
5. Oracle建模工具的使用
6. 实际案例：完整建模过程
7. 包含ER图（Mermaid）

输出文件：oracle-kb/P8-01-01-业务需求到数据模型.md
```

---

**123. P8-01-02-反规范化设计模式.md**

```yaml
title: "Oracle反规范化设计模式"
domain: "架构设计"
feature_type: "数据建模"
target_audience: "架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle反规范化设计模式"的知识文档。

知识点内容：
- 反规范化的目的
- 冗余字段设计
- 汇总表设计
- 数据一致性保障

要求：
1. Oracle反规范化的设计原则
2. 冗余字段的实现方法
3. 汇总表的设计
4. 数据一致性的保障措施
5. 反规范化的性能收益
6. 实际案例：反规范化设计
7. 完整的DDL示例

输出文件：oracle-kb/P8-01-02-反规范化设计模式.md
```

---

**批次 52/34**

#### 8.2 容量规划与硬件配置（2篇）

**124. P8-02-01-容量估算.md**

```yaml
title: "Oracle容量估算方法"
domain: "架构设计"
feature_type: "容量规划"
target_audience: "架构师/DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle容量估算方法"的知识文档。

知识点内容：
- 数据量增长预测
- 性能指标估算
- 资源需求计算
- 扩展性规划

要求：
1. Oracle容量估算的完整方法
2. 数据量增长的预测模型
3. TPS/QPS的资源需求计算
4. CPU、内存、I/O的估算
5. 扩展性规划策略
6. 实际案例：容量规划
7. 完整的估算模板

输出文件：oracle-kb/P8-02-01-容量估算.md
```

---

**125. P8-02-02-存储选型.md**

```yaml
title: "Oracle存储选型指南"
domain: "架构设计"
feature_type: "容量规划"
target_audience: "架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle存储选型指南"的知识文档。

知识点内容：
- 本地存储vs SAN/NAS
- SSD vs HDD
- IOPS与延迟要求
- 存储多路径

要求：
1. Oracle存储选型的完整指南
2. 各种存储类型的特点对比
3. IOPS和延迟的需求分析
4. ASM的存储管理
5. Exadata的存储特性
6. 实际案例：存储选型
7. 完整的选型决策表

输出文件：oracle-kb/P8-02-02-存储选型.md
```

---

**批次 53/34**

#### 8.3 数据库选型对比（2篇）

**126. P8-03-01-主流关系型数据库.md**

```yaml
title: "Oracle与主流关系型数据库对比"
domain: "架构设计"
feature_type: "选型对比"
target_audience: "架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle与主流关系型数据库对比"的知识文档。

知识点内容：
- Oracle vs MySQL
- Oracle vs PostgreSQL
- Oracle vs SQL Server
- 各数据库特点

要求：
1. Oracle与各主流数据库的全面对比
2. 功能特性对比
3. 性能特点对比
4. 成本对比
5. 生态和工具对比
6. 实际案例：选型决策
7. 完整的对比表格

输出文件：oracle-kb/P8-03-01-主流关系型数据库.md
```

---

**127. P8-03-02-选型因素.md**

```yaml
title: "Oracle数据库选型因素分析"
domain: "架构设计"
feature_type: "选型对比"
target_audience: "架构师"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle数据库选型因素分析"的知识文档。

知识点内容：
- 功能需求分析
- 性能要求评估
- 维护成本分析
- 人员技能要求

要求：
1. Oracle数据库选型的完整评估方法
2. 功能需求的匹配分析
3. 性能要求的评估方法
4. 维护成本的计算
5. 人员技能的考虑
6. 实际案例：选型分析
7. 完整的选型评估模板

输出文件：oracle-kb/P8-03-02-选型因素.md
```

---

**批次 54/34**

#### 8.4 运维体系与自动化（3篇）

**128. P8-04-01-监控体系建设.md**

```yaml
title: "Oracle监控体系建设"
domain: "架构设计"
feature_type: "运维自动化"
target_audience: "DBA/运维"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle监控体系建设"的知识文档。

知识点内容：
- 监控指标设计
- Prometheus + Exporters
- Grafana可视化
- 告警规则配置

要求：
1. Oracle监控体系的完整设计
2. 关键监控指标的定义
3. Prometheus Oracle Exporter的配置
4. Grafana仪表板的设计
5. 告警规则的配置
6. 实际案例：监控体系部署
7. 完整的配置示例

输出文件：oracle-kb/P8-04-01-监控体系建设.md
```

---

**129. P8-04-02-日常运维自动化.md**

```yaml
title: "Oracle日常运维自动化"
domain: "架构设计"
feature_type: "运维自动化"
target_audience: "DBA/运维"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle日常运维自动化"的知识文档。

知识点内容：
- 脚本自动化（Shell/Python）
- 配置管理工具
- 自动化备份清理
- DBaaS实现

要求：
1. Oracle运维自动化的完整方案
2. 常用运维脚本的编写
3. Ansible/SaltStack的配置管理
4. 自动化备份和清理
5. DBaaS的实现方法
6. 实际案例：运维自动化
7. 完整的脚本和配置

输出文件：oracle-kb/P8-04-02-日常运维自动化.md
```

---

**批次 55/34**

**130. P8-04-03-巡检与健康报告.md**

```yaml
title: "Oracle巡检与健康报告"
domain: "架构设计"
feature_type: "运维自动化"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle巡检与健康报告"的知识文档。

知识点内容：
- 巡检项目清单
- 自动化巡检脚本
- 健康报告生成
- 趋势分析

要求：
1. Oracle巡检的完整清单
2. 自动化巡检脚本的编写
3. 健康报告的自动生成
4. 性能趋势分析
5. 巡检报告模板
6. 实际案例：巡检自动化
7. 完整的巡检脚本

输出文件：oracle-kb/P8-04-03-巡检与健康报告.md
```

---

#### 8.5 故障诊断与案例分析（3篇）

**131. P8-05-01-典型性能故障.md**

```yaml
title: "Oracle典型性能故障诊断"
domain: "架构设计"
feature_type: "故障诊断"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle典型性能故障诊断"的知识文档。

知识点内容：
- 热块争用
- 解析风暴
- 排序/临时表空间满
- 性能故障诊断方法

要求：
1. Oracle常见性能故障的诊断方法
2. 热块争用的原因和解决
3. 解析风暴的处理
4. 临时表空间问题的解决
5. 性能故障的系统化诊断流程
6. 实际案例：性能故障处理
7. 完整的诊断脚本

输出文件：oracle-kb/P8-05-01-典型性能故障.md
```

---

**批次 56/34**

**132. P8-05-02-集群故障.md**

```yaml
title: "Oracle集群故障诊断与处理"
domain: "架构设计"
feature_type: "故障诊断"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle集群故障诊断与处理"的知识文档。

知识点内容：
- 节点驱逐
- 脑裂问题
- 复制中断
- 集群故障诊断

要求：
1. Oracle集群常见故障的诊断方法
2. 节点驱逐的原因和处理
3. 脑裂问题的诊断和解决
4. 复制中断的恢复
5. 集群故障的应急响应
6. 实际案例：集群故障处理
7. 完整的诊断脚本

输出文件：oracle-kb/P8-05-02-集群故障.md
```

---

**133. P8-05-03-数据损坏与紧急救援.md**

```yaml
title: "Oracle数据损坏与紧急救援"
domain: "架构设计"
feature_type: "故障诊断"
target_audience: "DBA"
difficulty: "专家"
db_product: "Oracle Database"
oracle_versions: ["19c", "21c"]
```

**提示词**：
```
你是Oracle数据库专家。请按照Oracle通用文档模板，生成关于"Oracle数据损坏与紧急救援"的知识文档。

知识点内容：
- 块损坏检测
- 数据修复方法
- 紧急救援流程
- 数据恢复工具

要求：
1. Oracle数据损坏的检测方法
2. DBV工具的使用
3. 块损坏的修复方法
4. 紧急救援的完整流程
5. 数据恢复工具的使用
6. 实际案例：数据损坏恢复
7. 完整的救援脚本

输出文件：oracle-kb/P8-05-03-数据损坏与紧急救援.md
```

---


---

## 四、批次执行指南

### 4.1 执行方式

每批次生成 3-5 篇文档，用户逐批执行。每次执行时：

1. 用户指定批次号（如"执行批次1"）
2. AI 按照该批次的提示词逐个生成文档
3. 生成完成后输出该批次的完成报告
4. 用户确认后进入下一批次

### 4.2 批次列表

| 批次 | 部分 | 文档编号 | 文档数量 | 知识点 |
|------|------|---------|---------|--------|
| 1 | 第一部分 | 1-3 | 3 | 基本概念、发展简史、数据库分类 |
| 2 | 第一部分 | 4-6 | 3 | 关系数据结构、完整性约束、关系代数 |
| 3 | 第一部分 | 7-9 | 3 | 关系演算、ER模型、逻辑设计 |
| 4 | 第一部分 | 10-12 | 3 | 规范化理论、模式分解、SQL概述 |
| 5 | 第一部分 | 13-15 | 3 | DDL、DML、DQL |
| 6 | 第一部分 | 16-17 | 2 | 聚合分组、子查询连接 |
| 7 | 第二部分 | 18-20 | 3 | 文件结构、数据块、行格式 |
| 8 | 第二部分 | 21-22 | 2 | 表空间、缓冲区 |
| 9 | 第二部分 | 23-25 | 3 | B+树索引、其他索引、索引设计 |
| 10 | 第二部分 | 26-28 | 3 | 索引维护、事务ACID、并发问题 |
| 11 | 第二部分 | 29-31 | 3 | 隔离级别、锁机制、MVCC |
| 12 | 第二部分 | 32-34 | 3 | 死锁、分布式事务、WAL |
| 13 | 第二部分 | 35-37 | 3 | Checkpoint、崩溃恢复、介质恢复 |
| 14 | 第二部分 | 38-39 | 2 | 闪回技术、PITR |
| 15 | 第三部分 | 40-42 | 3 | 安装规划、实例创建、网络配置 |
| 16 | 第三部分 | 43-45 | 3 | 用户管理、权限管理、角色管理 |
| 17 | 第三部分 | 46-48 | 3 | 审计、表空间管理、数据文件 |
| 18 | 第三部分 | 49-51 | 3 | 段区管理、空间监控、备份策略 |
| 19 | 第三部分 | 52-54 | 3 | RMAN、逻辑备份、恢复操作 |
| 20 | 第三部分 | 55-57 | 3 | 启停检查、补丁升级、性能监控 |
| 21 | 第三部分 | 58 | 1 | 日志管理 |
| 22 | 第四部分 | 59-61 | 3 | 窗口函数、CTE、集合操作 |
| 23 | 第四部分 | 62-64 | 3 | 正则表达式、存储过程、函数 |
| 24 | 第四部分 | 65-67 | 3 | 包、异常处理、DML触发器 |
| 25 | 第四部分 | 68-70 | 3 | 系统触发器、触发器设计、动态SQL |
| 26 | 第四部分 | 71-73 | 3 | EXECUTE IMMEDIATE、DBMS_SQL、显式游标 |
| 27 | 第四部分 | 74-75 | 2 | 隐式游标、REF CURSOR |
| 28 | 第五部分 | 76-78 | 3 | AWR/ASH、等待事件、SQL Trace |
| 29 | 第五部分 | 79-81 | 3 | CBO、统计信息、执行计划 |
| 30 | 第五部分 | 82-84 | 3 | SQL改写、Hint、SQL Profile |
| 31 | 第五部分 | 85-87 | 3 | 绑定变量、SGA、PGA |
| 32 | 第五部分 | 88-90 | 3 | I/O优化、参数调优、分区表 |
| 33 | 第五部分 | 91-93 | 3 | 索引优化、物化视图、表设计 |
| 34 | 第六部分 | 94-96 | 3 | Data Guard、GoldenGate、双向复制 |
| 35 | 第六部分 | 97-99 | 3 | 复制监控、RAC架构、RAC部署 |
| 36 | 第六部分 | 100-102 | 3 | RAC性能、多主复制、分片 |
| 37 | 第六部分 | 103-105 | 3 | 故障切换、连接池、应用层高可用 |
| 38 | 第六部分 | 106-108 | 3 | 容灾架构、数据保护、容灾演练 |
| 39 | 第七部分 | 109-111 | 3 | 查询解析、连接算法、缓冲区 |
| 40 | 第七部分 | 112-114 | 3 | 磁盘空间、内存分配、锁管理器 |
| 41 | 第七部分 | 115-117 | 3 | 锁实现、可串行化、日志生成 |
| 42 | 第七部分 | 118-120 | 3 | 复制日志、崩溃恢复、加密 |
| 43 | 第七部分 | 121 | 1 | 高级审计 |
| 44 | 第八部分 | 122-124 | 3 | 数据建模、反规范化、容量估算 |
| 45 | 第八部分 | 125-127 | 3 | 存储选型、数据库对比、选型因素 |
| 46 | 第八部分 | 128-130 | 3 | 监控体系、运维自动化、巡检报告 |
| 47 | 第八部分 | 131-133 | 3 | 性能故障、集群故障、数据损坏 |

### 4.3 执行命令示例

用户可以在对话中使用以下命令：

```
执行批次1          # 生成第1-3篇文档
执行批次2-5        # 生成第2到5批次
执行第一部分       # 生成第一部分全部（批次1-6）
执行全部           # 不推荐，建议分批执行
```

### 4.4 单篇生成命令

也可以指定单篇文档生成：

```
生成 P1-01-01-基本概念
生成 第109篇
```

---

## 五、质量保障

### 5.1 生成后检查

每篇文档生成后，检查以下内容：

- [ ] 文档元信息（YAML头）完整
- [ ] 所有必选章节已填写
- [ ] Mermaid图表语法正确
- [ ] SQL代码块格式正确
- [ ] 内容与Oracle版本一致
- [ ] 无客户信息泄露

### 5.2 批次完成后汇总

每批次完成后，输出汇总信息：

```
批次X完成报告：
- 生成文档数：X篇
- 文档列表：
  1. P1-01-01-基本概念.md ✓
  2. P1-01-02-数据库发展简史.md ✓
  3. P1-01-03-数据库分类.md ✓
- 总进度：X/133（XX%）
- 下一批次：批次X+1
```

---

## 六、注意事项

1. **上下文限制**：每批次不超过5篇，避免超出上下文窗口
2. **质量优先**：宁可分多批次，不要为赶进度降低质量
3. **人工确认**：每批次完成后建议人工检查再生成下一批
4. **增量保存**：每篇文档生成后立即保存，避免丢失
5. **版本管理**：建议使用git管理生成的文档

---

## 七、文档统计

| 指标 | 数值 |
|------|------|
| 总文档数 | 133篇 |
| 总批次数 | 47批 |
| 平均每批 | 2.8篇 |
| 预估总字数 | ~40万字 |
| 预估完成时间 | 视执行速度而定 |

---

**文档生成计划创建完成**

创建时间：2026-07-01  
计划版本：v1.0  
下次更新：根据实际执行情况调整

