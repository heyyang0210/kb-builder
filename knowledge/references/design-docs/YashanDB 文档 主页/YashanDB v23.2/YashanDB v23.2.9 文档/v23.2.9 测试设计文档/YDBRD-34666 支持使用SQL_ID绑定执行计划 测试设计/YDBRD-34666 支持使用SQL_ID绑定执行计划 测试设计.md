# 1. 概述

**需求：**  [https://pingcode.yasdb.com/pjm/items/6718e6fae489dd0868fd8135?](https://pingcode.yasdb.com/pjm/items/6718e6fae489dd0868fd8135?)  

#YDBRD-34666 支持使用SQL_ID绑定执行计划

测试任务  [YDBRD-34668 - 测试任务：支持使用SQL_ID绑定执行计划](https://pingcode.yasdb.com/pjm/items/6718e6fb6544792659b384cd)  



**方案设计**  :   [https://pingcode.yasdb.com/wiki/spaces/HAOXINGANG/pages/673d7fca593f99c9ff26f31b](https://pingcode.yasdb.com/wiki/spaces/HAOXINGANG/pages/673d7fca593f99c9ff26f31b)  

**场 景：**   1、支持使用sql_id 固化/匹配 特定的HINT

**需求描述：**   支持使用sql_id绑定执行计划，使用sql_id匹配指定的hint，达到该SQL执行时使用目标的hint对应的执行计划

**需求范围：**   1、单机 2、分布式 3、集群

**需求规格：**

CREATE OUTLINE outline_name ON sql_id USING HINT hint;

  [https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000000643840](https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000000643840)  

# 2. 需求分析

## 2.1 功能点分析

### 2.1.1 新增语法

新增功能语法：CREATE OUTLINE outline_name ON sql_id USING HINT hint;

- 语法: 
- ![image.png](https://pingcode.yasdb.com/atlas/files/public/67445dada1ad9a3311de36f0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQyNzEsImV4cCI6MTc4MjMzNTA3MX0.0dkBg8G6bck5lCY4GEnM2ZRGHgt5h03SK8RgWnAr6Hs)
- 约束:
    - on sql_id对 sql_id是否有对statement类似的约束？


on statement 指定OUTLINE对应的SQL语句。SQL语句必须为如下类型中的一种且需遵循相应的语法要求：

- SELECT语句
- DELETE语句
- UPDATE语句
- INSERT...SELECT语句


### 2.1.2 现有 ALTER 语法仅支持RENAME,ENABLE,DISABLE

支持RENAME，支持ENABLE | DISABLE。

约束：

- 不支持REBUILD。
- 不支持CHANGE CATEGORY。


### 2.1.3 相关视图(dba_outlines, user_outlines, all_outlines) 新增 SQL_ID 列

- dba_outlines, user_outlines, all_outlines
- dba_outline_hints, user_outline_hints, all_outline_hints


## 2.2 应用场景

- 对于已上线的业务，如果出现优化器选择的计划不够优时，则需要在线进行计划绑定，即无需业务进行SQL更改，而是通过DDL操作将一组HINT加入到SQL中，从而使得优化器根据指定的一组HINT，对该SQL生成的新更优计划。我们将该组HINT称为OUTLINE，通过对某条SQL创建OUTLINE可达到计划绑定的目的。


## 2.3 规格约束

- ON stmt语法创建的outline优先级更高。即先匹配stmt的OUTLINE，匹配不上才会按SQL_ID查找OUTLINE。
- 如果sql_id对应的语句中有hint，会用指定的hint覆盖原语句的hint。
- hint长度上限为DB_BLOCK_SIZE。（默认8k，yasdb内存机制的限制）


# 3. 详细测试设计

## 3.1 测试设计方法

### 3.1.1 新增语法(CREATE OUTLINE outline_name ON sql_id USING HINT hint;) – 边界值；等价类;

|输入条件|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|
|语法测试|1. 不带 outline名字
    1. create outline on sql_id using hint <hint>; 
    1. create public outline on sql_id using hint <hint>;
    1. create or replace outline on sql_id using hint <hint>; 
    1. create or replace public outline on sql_id using hint <hint>; 
1. 带outline名字
    1. create outline <outline_name> on sql_id using hint <hint>;
    1. create public <outline_name> on sql_id using hint <hint>;
    1. create or replace outline <outline_name> on sql_id using hint <hint>;
    1. create or replace public outline <outline_name> on sql_id using hint <hint>;
|1. 不带hint
    1. create outline on sql_id using hint;
    1. create or replace outline on sql_id;
    1. create public outline <outline_name> on sql_id using hint;
    1. create or replace public outline <outline_name> on sql_id;
1. 不带 sql_id
    1. create outline on using hint <hint>;
    1. create or replace outline <outline_name> using hint <hint>;
    1. create public outline <outline_name> on using <hint>;
1. 不带on
    1. create outline sql_id using hint <hint>;
    1. create or replace public outline <outline_name> sql_id using hint <hint>;
1. 不带using
    1. create outline <outline_name> on sql_id hint <hint>;
    1. create or replcace public outline on sql_id hint <hint>;
||
||1. 原sql_text相关语法不受影响(上车工程)
1. CREATE OUTLINE <outline_name> for category default ON sql_id USING HINT hint;
|1. 与sql_text相关语法合用
    1. CREATE OUTLINE <outline_name> for category <category_name> ON sql_id USING HINT hint;
    1. CREATE OUTLINE outline_name FROM <outline_name> ON sql_id USING HINT hint;
    1. CREATE OUTLINE outline_name ON sql_text USING HINT hint;
||
|输入参数|1. sql_id满足sql_id的要求
    1. create outline on <sql_id> using hint <hint>;
1. sql_id对应的sql_text满足如下要求?
    1. SELECT语句
    1. DELETE语句
    1. UPDATE语句
    1. INSERT...SELECT语句
    1. 创建成功，查询的时候outline不生效。
|1. sql_id为空(长度为0)、长度为12B、长度为14B
    1. create outline <outline_name> on '' using hint <hint>;
    1. create outline <outline_name> on 0123456789ab using hint <hint>;
    1.  create outline <outline_name> on 0123456789abcd using hint <hint>;
1. sql_id包含中文、其他字符
    1. create outline <outline_name> on '崖山DBSQL' using hint <hint>;
    1. create outline <outline_name> on '$%' using hint <hint>;
    1. create outline on 0123456789abc using hint <hint>;
    1. create outline on abcdefghijklm using hint <hint>;
1. sql_id对应的sql_text不符合outline要求
    1. 摘抄自outline_not_support
        1. dual之间join
        1. 普通视图之间join
        1. CTE
        1. 集合操作
        1. update多表
        1. create table select
        1. 直接insert
        1. 创建成功，查询不生效
||
||1. hint 满足hint的语法(/*+ xxxxx */)
    1. /*+ <支持的hint> */
    1. /*+ <支持的hint> <支持的hint2> */
    1. /*+ <支持的hint> */ /*+ <支持的hint2> */ -- OB会忽略第二个hint
1. hint 满足长度(8K)
    1. /*+*/ -- 失败
    1. /*+ 8k字符 */
1. hint满足字符要求
    1. /*+ index(中文、a~z、A~Z、0~9) */
|1. hint 不满足hint语法
    1. create outline on <sql_id> using hint <支持的hint>;
    1. create outline on <sql_id> using hint /*+ <不支持的hint> */;
1. hint为空(长度为0)、长度大于8K
    1. create or replace outline <outline_name> on <sql_id> using hint '';
    1. create or replace outline <outline_name> on <sql_id> using hint /*+ 8k+1字符 */;
1. hint不满足字符要求
    1. create or replace outline <outline_name> on <sql_id> using hint /*+ 中文 */
||
|输入参数：outline同名|1. 同名outline已存在，使用replace
    1. create or replace outline <outline_name> on sql_id using hint <hint>;
    1. create or replace outline <outline_name> on sql_id using hint <hint>;
|1. 同名outline已存在，不使用replace
    1. create or replace outline <outline_name> on sql_id using hint <hint>;
    1. create outline <outline_name> on sql_id using hint <hint>;
||
||输入参数：sql_id同名|1. 相同sql_id已存在outline，使用replace
    1. create or replace outline <outline_name> on sql_id using hint <hint>;
    1. create or replace outline <outline_name> on sql_id using hint <hint_new>;
    1. create or replace outline <outline_name_new> on sql_id using hint <hint_new>;
|1. 相同sql_id已存在outline，使用/不使用replace => ERROR 5264 (HY000): Outline '' already exists
    1. create or replace outline <outline_name> on sql_id using hint <hint>;
    1. create outline <outline_name_new_2> on sql_id using hint <hint>;
|
||输入参数：sql_id 对应的 sql_text已经存在outline|1. sql_id对应的sql_text已存在outline
    1. create or replace outline <outline_name> on <sql_text>;
    1. create or replace outline <outline_name_2> on <sql_id> using hint <hint>;
||


### **3.1.2 **  现有语法(ALTER OUTLINE outline_name) – 边界值；等价类;

|输入条件|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|
|语法测试|1. rename
    1. create outline <outline_name> on <sql_id> using hint <hint>;
    1. alter public outline <outline_name> rename to <outline_new_name>;
    1. alter public outline <outline_new_name> rename to <outline_new_name>;
    1. create outline on <sql_id> using hint <hint>;
    1. alter outline <sys_default_outline_name> rename to <outline_new_name>;
|1. rename 不带 to,不带新的outline name
    1. create outline <outline_name> on <sql_id> using hint <hint>;
    1. alter outline <outline_name> rename <outline_new_name>;
    1. alter outline <outline_name rename to;
||
||1. enable/disable
    1. create outline <outline_name> on <sql_id> using hint <hint>;
    1. alter outline <outline_name> disable;
    1. alter public outline <outline_name> disable;
    1. alter public outline <outline_name> enable;
    1. alter outline <outline_name> enable;
|1. enable/disable 不带outline name
    1. create outline <outline_name> on <sql_id> using hint <hint>;
    1. alter outline disable;
    1. alter outline enable;
||
|||1. other options (rebuild、change)
    1. create outline <outline_name> on <sql_id> using hint <hint>;
    1. alter outline <outline_name> rebuild;
    1. alter outline <outline_name> change category to <category>;
||




### **3.1.3 相关视图(**  dba_outlines, user_outlines, all_outlines, sys.ol$, sys.ol$hints, sys.ol$nodes, dba_outline_hints, user_outline_hints, all_outline_hints  **)**

|输入条件|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|
|dba_outlines|1. 不同用户创建基于sql_id的outline，dba用户查询，可以查询到所有outlines
||单机、集群(多节点)主备；分布式CN、DN、MN|
||1. desc dba_outlines成功(已有用例)
|||
|user_outlines|1. 不同用户创建基于sql_id的outline，dba用户查询，可以查询到dba用户创建的outlines
|||
||1. desc user_outlines成功(已有用例)
|||
|all_outlines|1. 不同用户创建基于sql_id的outline，dba用户查询，可以查询到所有用户创建的outlines。普通用户查询，可以查询到被授权的outlines。
|||
||1. desc all_outlines成功(已有用例)
|||
|dba_outline_hints|1. 不同用户创建基于sql_id的outline，dba用户查询，可以查询到所有用户创建的outline_hints.
|||
||1. 创建hint=8K，查询dba_outline_hints
|||
||1. desc dba_outline_hints成功(已有用例)
|||
|user_outline_hints|1. 不同用户创建基于sql_id的outline，dba用户查询，可以查询到当前用户创建的outline_hints.
|||
||1. desc user_outline_hints成功(已有用例)
|||
|all_outline_hints|1. 不同用户创建基于sql_id的outline，dba用户查询，可以查询到所有用户创建的outline_hints。普通用户查询，可以查询到被授权的outlines。
|||
||1. desc all_outline_hints成功(已有用例)
|||




### 3.1.4 CREATE OUTLINE ON SQL_ID - 场景法

#### 覆盖所有hints

- 检查：查看执行计划，选取的计划正确？


**改变并行度**

使用PARALLEL提示项，可以实现并行查询。

||模式|说明|备注|用例|
|---|---|---|---|---|
|1|parallel|指定查询并行度|若查询中有多张表同时通过hint指定多个并行度值时，所有表的并行度将全采用此次最大的指定值。,通过hint所指定的并行度最大为255，超过255时会退化为255。,无法跨SELECT指定并行度，此种场景请使用数据库参数DEGREE_OF_PARALLEL来指定。,对并行查询的指定只作为一个参考项，如果优化器评估后认为并行查询不是最优计划，则不会选择生成并行计划。|create outline ydbrd_34666_outline_parallel on <sql_id> using /*+ PARALLEL(table, 4) */;|


**改变Join连接顺序的Hint**

LEADING语法能够改变Join两边表的顺序

||模式|说明|备注|用例|
|---|---|---|---|---|
|1|LEADING|在多表关联的查询中，提示优化器按照指定顺序访问表。|hint_intersperse中只支持以表名或别名指定顺序，大小写不敏感。,LEADING提示的表访问顺序为建议顺序，非强制，当遇到无法调整的JOIN类型（OUTER）时，则不会改变顺序。,当hint_intersperse中指定表数量超过参与JOIN的实际表数量时，优化器不接受此项提示。,当hint_intersperse中出现无效的表时，优化器不接受在该表之后指定的顺序，但仍接受该表之前所指定的顺序。,hint_intersperse中指定多张表时，表示指定的是表连接顺序的前缀，例如LEADING(b a)，((b a) c)符合指定的顺序，(c (b a))则不符合。|create outline ydbrd_34666_outline_leading on <sql_id> using /*+ LEADING(table1 table2) */;|


**改变Join类型的Hint**

USE_和NO_USE_语法能够指定两张表的连接类型：

||模式|说明|备注|用例|
|---|:---|:---|:---|---|
|1|USE_NL|优先选择Nesed Loop Join|任何Join类型一定能转成Nested Loop Join||
|2|NO_USE_NL|优先选择非Nesed Loop Join类型|无法生成其他Join类型时，不生效||
|3|USE_HASH|优先使用Hash Join|无法使用Hash Join时，不生效||
|4|NO_USE_HASH|不使用 Hash Join|根据代价评估使用Nested Loop Join或Merge Join||
|5|USE_MERGE|优先使用Merge Join|无法生成Merge Join时，不生效||
|6|NO_USE_MERGE|不使用Merge Join|根据评估使用Nested Loop Join或Hash Join||


**改变访问路径的Hint**

Hint指令也可以改变访问路径，例如强制根据索引扫描或强制采用全表扫描。

||模式|说明|备注|用例|
|---|:---|:---|:---|---|
|1|INDEX|优先使用Hint指定的索引|一定会生效，选Fast Full Scan和Index Scan之间Cost最小的一个|索引、反向索引、函数索引？|
|2|NO_INDEX|不使用Hint指定的索引|一定会生效，选择Table Full Scan||
|3|INDEX_FFS|优先使用Fast Full Scan|一定会生效，只选Fast Full Scan||
|4|NO_INDEX_FFS|不使用Fast Full Scan|一定会生效，可选Index Range Scan等||
|5|FULL|使用全表扫描|一定会生效，选择Table Full Scan||


**SELECTIVITY?**

**LSC表批量插入 & LSC表去重**

||模式|说明|备注|用例|
|---|---|---|---|---|
|1|BULKLOAD|LSC表批量插入||create outline ydbrd_34666_outline_bulkload on <sql_id> using /*+ BULKLOAD */;|
|2|DEDUPLICATE|LSC表批量插入时去重|该提示项仅适用于LSC表，在同时使用有效的BULKLOAD提示项时，DEDUPLICATE提示项才生效。|create outline ydbrd_34666_outline_deduplicate on <sql_id> using /*+ DEDUPLICATE*/;  -- 查询的时候不生效,create outline ydbrd_34666_outline_deduplicate on <sql_id> using /*+ BULKLOAD DEDUPLICATE*/; -- 正常应用|


**分布式 TAC表 和 LSC表 同时执行的stage数量**

||模式|说明|备注|用例|
|---|---|---|---|---|
|1|max_workers_per_exec|指定可以同时执行的stage的数量|仅适用于分布式数据库的tac表和lsc表的查询和子查询语句|create outline ydbrd_34666_outline_max_workers_per_exec on <sql_id> using /*+ max_workers_per_exec(8) */;|


#### 其他场景

|ID|场景|用例|预期|
|---|---|---|---|
|1|基于sql_id创建的outline存在，查询的表|视图|索引发生变化 (outline 引用了不存在的对象)|1. 未创建索引 xxx, 创建基于sql_id的outline using hint /*+ index (xxx xxx) */
1. 执行查询
1. 创建索引 xxx
1. 执行查询
1. 修改索引不可见
1. 执行查询
|不报错|
|2|基于sql_id和sql_text创建的outline同时存在|1. 创建基于sql_id的outline
1. 创建基于sql_text的outline
1. 执行查询
|应用基于sql_text的outline|
|3|同一 SQLID 存在多个 Outline||不允许|
|4|大小写、额外空格、注释|1. 查询语句使用全大写、全小写、大小写混合、额外空格、注释产生不同的sql_id创建outline
1. 使用全大写、全小写、大小写混合、额外空格查询
1. 查看应用的outline
|对应不同的outline。|
|5|hint|1. 使用含有hint的查询的sql_id创建outline
1. 执行该查询
1. 查看应用的outline
|原hint会被替换掉|
|6.|绑定变量|1. 创建一个带绑定变量的查询。
1. 为该查询的sql_id创建一个 Outline。
1. 执行该查询
1. 查看应用的outline
|带绑定参数的查询生成的sql_id。|
|7|视图|1. 创建一个视图的查询语句 (create view view_name select * from table）
1. 对该查询语句的sql_id创建outline (对select * from table 的sql_id 创建outline)
1. 查询该视图
1. 查看应用的outline
|视图的底层查询正确应用hint|
|8|并发|1. 多个会话同时为一个sql_id绑定不同hint的outline
|一个成功，其他失败|
|9|PL/SQL （拼接sql）|1. 为在匿名块、存储过程、function中调用的查询创建outline
1. 执行并查看应用的outline
||
|10|导入、导出|1. 创建outline后导出元数据
1. 删除后导入元数据
|能看到创建的outline|
|11|分布式扩容、缩容|1. 扩容后的节点，outline视图查询正确
||
|12|升级|1. 上车工程中升级正常
||
|13|性能|1. 创建不生效的outline并打开后执行现有性能工程，单独看下outline改写对性能的影响，做个摸底。
||




