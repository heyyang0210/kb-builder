Created by 李思语, last modified on 四月 02, 2024

-   [](#PL支持CTE详细测试设计-)  
-   [1. 概述](#PL支持CTE详细测试设计-1.概述)  
-   [2. 需求分析](#PL支持CTE详细测试设计-2.需求分析)  
    -   [2.1 功能点分析](#PL支持CTE详细测试设计-2.1功能点分析)  
    -   [2.2 应用场景](#PL支持CTE详细测试设计-2.2应用场景)  
    -   [2.3 规格约束](#PL支持CTE详细测试设计-2.3规格约束)  
-   [3. 详细测试设计](#PL支持CTE详细测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#PL支持CTE详细测试设计-3.1测试设计方法)  
    -   [3.2 详细测试设计](#PL支持CTE详细测试设计-3.2详细测试设计)  
        -   [3.2.1 基本功能测试](#PL支持CTE详细测试设计-3.2.1基本功能测试)  
        -   [3.2.2 场景测试](#PL支持CTE详细测试设计-3.2.2场景测试)  
            -   [1.在PLSQL对象中使用cte语法](#PL支持CTE详细测试设计-1.在PLSQL对象中使用cte语法)  
            -   [2.在游标中使用cte语法](#PL支持CTE详细测试设计-2.在游标中使用cte语法)  
            -   [4.其他场景使用cte语法](#PL支持CTE详细测试设计-4.其他场景使用cte语法)  
        -   [3.2.3 并发](#PL支持CTE详细测试设计-3.2.3并发)  
-   [4. 测试用例](#PL支持CTE详细测试设计-4.测试用例)  
-   [5. 测试框架设计](#PL支持CTE详细测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#PL支持CTE详细测试设计-6.测试环境说明)  
-   [7. 工作量评估](#PL支持CTE详细测试设计-7.工作量评估)  


# 1. 概述

*简要说明本功能/需求的背景，本文档的适用范围*

本文描述PL支持CTE语法测试设计

SR：    [YDBRD-29068](https://jira.yasdb.com/browse/YDBRD-29068?src=confmacro)    -  PL语言中静态SQL支持CTE语法  编码完成

部署形态：单机、集群。

# 2. 需求分析

## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，*  *对应提供的功能点、函数、语法图、配置参数、视图、接口等；*
- *开发设计的主要原理*


SELECT 已支持 CTE（Common Table Expressions，公共表表达式），在PL静态SQL特性中，支持直接给定CTE语法形式，进一步完善 PL语言特性。

**语法图**  ：

![](https://pingcode.yasdb.com/atlas/files/public/67396cafa1ad9a3311dc8c43/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI3NTAsImV4cCI6MTc4MjMxMzU1MH0.yKlTI4Y6gOp9ZdLR2npK4sC2DaZ37kOol-bhHh0h0LI)

![](https://pingcode.yasdb.com/atlas/files/public/67396cafa1ad9a3311dc8c44/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI3NTAsImV4cCI6MTc4MjMxMzU1MH0.yKlTI4Y6gOp9ZdLR2npK4sC2DaZ37kOol-bhHh0h0LI)

## 2.2 应用场景

- *需求本身的主要应用场景*
- *需求与其他特性的关联场景*


过程体和匿名块中支持CTE语法，在PLSQL中允许使用子查询的地方都可以应用CTE。

1.动态sql应该是天然支持的，与普通sql无差别。

2.cte语法在之前迭代已测试，本次测试重点是静态sql应用CTE场景。

## 2.3 规格约束

- *需求定义的规格、约束，系统/模块上下文等*
- *内部机制涉及的规格约束*


继承CTE约束：暂不支持递归。

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

本次测试主要采用场景法、正交组合法、等价类进行测试

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


### 3.2.1 基本功能测试

|输入条件|有效等价类|备注1|无效等价类|备注2|
|---|---|---|---|---|
|cte命名|与变量名同名|  
|  
|  
|
|  
|与变量名不同名|  
|  
|  
|
|cte子句个数|1个|  
|  
|  
|
|  
|声明多个cte|WITH cte1 AS (...), cte2 AS (...) ,... SELECT ...,- cte全部用到
- 没用到的cte定义没出错
- 没用到的cte定义出错
- 用到的cte定义出错
- cte都没用到
|- cte命名有重复
- 定义出错：列名不存在，表名不存在
,  
|  
|
|cte子句返回行数|0，1，多行|  
|  
|  
|
|cte是否有列别名|列别名与结果集中的列数相同|  
|列别名与结果集中的列数不相同|  
|
|  
|有列别名并且与变量名同名|统一变量名优先|  
|  
|
|  
|有列别名并且与变量名不同名|  
|  
|  
|
|  
|无列别名cte子句列名与变量名同名|  
|  
|  
|
|  
|无列别名cte子句列名与变量名不同名|  
|  
|  
|
|  
|cte里面各种标识符名（表名，列名），与udf名重名，cte与变量名重名|  
|  
|  
|
|cte嵌套|cte子句嵌套cte|WITH cte1 AS (WITH cte2   AS   (  SELECT   1) SELECT *   FROM   cte2)   SELECT   *    FROM   cte1|cte递归|暂不支持|
|  
|select子句嵌套cte|WITH cte1 AS (SELECT 1)SELECT * FROM (WITH cte2 AS (SELECT 2) SELECT * FROM cte2 JOIN cte1)   |在同一层多个with子句|WITH cte1 AS (...) WITH cte2 AS (...) SELECT ...|
|语法及关键字校验|关键字大小写/语法图路径覆盖|with cte as (subquery)... ,with cte1 as (subquery),cte2 as (subquery)...,cten as (subquery)...,wiht cte1(col1,col2..) as (subquery)... ,with cte1(col1,col2..) as (subquery),cte2(col1,col2..) as (subquery)...,cten(col1,col2..) as (subquery)...,- select子句带括号/不带括号
- subquery带分号/不带分号
- select子句带分号/不带分号
- with关键字做变量名对象名
|- 关键字缺失/重复/错误(as 后面不是select)
- 括号校验(cte子句没有括号/括号重复/括号不完整；列别名没有括号/括号重复/括号不完整/没有列别名但有括号)
- 逗号校验(列别名以逗号结束(a1,a2,))
- cte子句有into关键字
- 游标结果集有into关键字
|  
|
|数据类型校验|into变量类型【标量、udt、record、pkg.record、pkg.udt】|  
|  
|  
|
|在forall中使用cte|insert all|  
|ddl|  
|
|  
|update all|  
|select|  
|
|  
|delete all|  
|  
|  
|
|  
|merge into |  
|  
|  
|


### 3.2.2 场景测试

#### 1.在PLSQL对象中使用cte语法

|匿名块|自定义函数|自定义存储过程|自定义高级包|
|---|---|---|---|
|DECLARE    
  p1 char(20) := 99;    
  begin    
  declare    
  a clob;    
  begin    
  cte select p1,a ...;    
  end;    
  xxxx    
  end;    
  /|  
|  
|  
|


#### 2.在游标中使用cte语法

|游标类型|语法|
|---|---|
|隐式游标|```
with cte select into[标量,record,udt]

```|
|静态游标(显式游标):|```
cursor&nbsp;cursor_name is with cte select_statement;
cursor&nbsp;cursor_name return xx%rowtype is&nbsp;with cte select_statement;
cursor&nbsp;cursor_name(args) is with cte select_statement;
cursor&nbsp;cursor_name(args) return xx%rowtype is with cte select_statement;

```|
|动态游标:|```
declare
...
type cur1 is ref cursor; 
type cur2 is ref cursor return xx%rowtype; 
cur_test1 cur1;
cur_test2 cur2;
...
begin
open cur_test1 for with cte select_statment1;
...
open cur_test2 for with cte select_statment2;
...
end;

```|
|系统游标|```
declare
...
cur_test sys_refcursor;
...
begin
open cur_test for with cte select_statment1;
...
open cur_test for with cte select_statment2;
...
end;

```|
|for循环游标|```
隐式游标
for index in (with cte select_statment) loop 

显示游标
declare
cursor cur is with cte select_statment;
begin
for index in cur; 
...
end;

```|
|Bulk游标|```
declare
type cur is table of xx%rowtype;
var cur 
begin
...
with cte select * bulk collect into var from ...
...
end;

declare
type udt_01 is table of xx%rowtype;
CURSOR cur_01 is with cte as select ...
var_01 udt_01 ;
begin
...
fetch cur_01 bulk collect into var_01;
for i in var_01.first .. var_01.last loop 
...
end loop;
...
end;

```|


3.PLSQL直接应用cte使用场景(摘自原CTE设计)

*引用用例改写为PLSQL执行

|输入条件|使用场景|备注|
|---|---|---|
|INSERT|insert into t1 with cte|  
|
||insert into cte select|暂不支持|
|UPDATE|update cte|暂不支持|
|  
|update set column，column是cte|  
|
|  
|update set column = cte|  
|
|  
|set (column, column) = cte|Oracle不支持|
|  
|update where cte|  
|
|DELETE|delete from cte|暂不支持|
|  
|delete from where cte|  
|
|CREATE TABLE|create table as cte|create table as (with）,create table as with|
|CREATE VIEW|create view as cte|  
|
|  
|create force view as cte|  
|
|CREATE MATERIALIZED VIEW|create materialized view as cte|  
|
|WHERE|select from where cte|  
|
|  
|select from where exists cte|  
|
|  
|select from where column in cte|  
|
|  
|select from where column cmp  cte|>,=,<,<=, >=,any, all|
|HAVING|select from having cte|  
|
|  
|select from having exists cte|  
|
|  
|select from having column in cte|  
|
|  
|select from having column cmp  cte|  
|
|START WITH|select from start with cte|  
|
|  
|select from start with exists cte|  
|
|  
|select from start with column in cte|  
|
|  
|select from start with column cmp  cte|  
|
|SELECT|select cte from |- 子查询投影列为自定义函数，内置函数
|
|FROM|select from cte|  
|
|MERGE|  
|  
|


#### 4.其他场景使用cte语法

|场景|输入条件|语法|
|---|---|---|
|- 动态执行
- 静态执行动态sql
|无绑定参数|```

execute immediate 'with cte as (select...) select :1 from cte' using a;


```,```

v_sql clob := 'with cte as (select ...) select ...';
open cur1 for v_sql;
open cur2 for 'with cte as (select ...) select ...'; 
open cur3 for 'with cte as (select ...) select :1 from cte' using a;


```|
||cte子句绑定参数||
||select子句绑定参数||
||cte子句&select子句都绑定参数||


注：4.简单覆盖(不在sr转测范围)。

  


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


### 3.2.3 并发

|并发场景(CT)|并发数|
|---|---|
|对同一张表隐式游标查询cte|10|
|对同一张表显式游标查询cte|10|
|对同一张表动态游标查询cte|10|
|对同一张表系统游标查询cte|10|
|对同一张表bulk游标查询cte|10|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[image2024-3-20_18-35-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYWY4OTcwYzJhZjRmNTIwZGNlIiwicmVmX2lkIjoiNjczOTZjYWY3MjgyMDZlZmI5MmYxNWE3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyNzUwLCJleHAiOjE3ODIzODkxNTB9.7GdsIH2YMi4CMSig7x7KLOp3amINXGBF3OYPo_V9mI4)

 (image/png)    


[image2024-3-20_18-34-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYWY4OTcwYzJhZjRmNTIwZGNmIiwicmVmX2lkIjoiNjczOTZjYWY3MjgyMDZlZmI5MmYxNWE3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyNzUwLCJleHAiOjE3ODIzODkxNTB9.FiaGOUStYLBOFqzdG82eNZET2sxokzzIi7Q1fmXgv20)

 (image/png)    


[image2024-3-22_15-46-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYWY4OTcwYzJhZjRmNTIwZGQwIiwicmVmX2lkIjoiNjczOTZjYWY3MjgyMDZlZmI5MmYxNWE3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyNzUwLCJleHAiOjE3ODIzODkxNTB9.jXUKR82C37NO1lesLqH0_v2c9ZmhWhPpSrpXrXc9xOE)

 (image/png)    
