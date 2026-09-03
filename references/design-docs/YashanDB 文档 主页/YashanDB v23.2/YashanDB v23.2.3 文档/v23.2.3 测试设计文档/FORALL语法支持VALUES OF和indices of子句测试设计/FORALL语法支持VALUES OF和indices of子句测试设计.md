Created by 李浩勇, last modified on 五月 10, 2024

# 1. 概述

本文描述FORALL语法支持VALUES OF和indicess of子句的测试设计

IR：    [YDBRD-25442](https://jira.yasdb.com/browse/YDBRD-25442?src=confmacro)    -  FORALL语法支持VALUES OF和indicess of子句  设计中

SR：    [YDBRD-13732](https://jira.yasdb.com/browse/YDBRD-13732?src=confmacro)    -  支持FOR ALL语句实现VALUES OF子句  待启动

  [YDBRD-13731](https://jira.yasdb.com/browse/YDBRD-13731?src=confmacro)    -  支持FOR ALL语句实现indicess of子句  待启动

支持范围：单机，集群，分布式 

# 2. 需求分析

## 2.1 功能点分析

FORALL语法支持VALUES OF和indices of子句，支持稀疏数组的FORALL循环处理

FORALL支持测试values OF和indices of测试点枚举

|语法|索引类型|数组是否连续|元素类型|DML语句|DML执行|是否有异常并处理|between|
|---|---|---|---|---|---|---|---|
|indices of 关联数组|int|不连续|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID,OBJECT、VARRAY、TABLE、包含构造方法的type、package.record、package.varray，package.table|INSERT/UPDATE/DELETE/MERGE INTO|静态SQL，动态执行|有、无|有、无|
|indices of 嵌套表/varray|-|-|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID,OBJECT、VARRAY、TABLE、包含构造方法的type、package.record、package.varray，package.table|INSERT/UPDATE/DELETE/MERGE INTO|静态SQL，动态执行|有、无|有、无|
|values of|int|不连续|int|INSERT/UPDATE/DELETE/MERGE INTO|静态SQL，动态执行|有、无|-|
|values of 嵌套表/varray|-|元素不连续|int|INSERT/UPDATE/DELETE/MERGE INTO|静态SQL，动态执行|有、无|-|
|FORALL values嵌套支持|支持：A(i).F A.F(i) A.F.F(i) A.F(i).F A.F.F(i).F A(i).F.F  A.F(i).F.F 不支持：A(i)(i)，索引单独存在，索引运算，非集合(i)|||||||
|动态执行传参位置|集合、between上下边界，values值|||||||
|数组传入方式|变量，形参，函数返回值，package.collec|||||||


  


between and

|between and|下边界|上边界|
|---|---|---|
|  
|大于first|小于last|
|  
|等于first|等于last|
|  
|小于first|大于last|
|  
|小于上边界 -|小于first|
|  
|大于last|大于下边界值-|
|  
|上边界小于下边界小于first||
|  
|上边界小于下边界大于first，小于last||
|边界值类型|常量，object.c1，record.c1，varray(1)，table(1)，函数返回值，形参||


语法结构

```
FORALL index IN VALUES OF collections
	dml;
```

```
FORALL index IN INDICESS OF collections [BETWEEN lower_bound AND upper_bound]
	dml;
```

  


语法使用

```
--数组索引为常量
drop table tb1;
create table tb1(c1 int);

declare
	type type_001 is table of int index by pls_integer;
	collect1 type_001;
begin
	collect1(1) := 1;
	collect1(10) := 10;
	collect1(100) := 100;
	collect1(1000) := 1000;
	forall i in indices of collect1 between -1 and 500
		insert into tb1 values(collect1(i));
end;
/
```

  


```
--数组索引为常量
drop table tb1;
create table tb1(c1 int);

declare
	type type_001 is table of pls_integer index by pls_integer;
	type type_002 is table of int index by pls_integer;
	collect1 type_001;
	collect2 type_002;
begin
	collect1(2) := 1;
	collect1(20) := 10;
	collect1(50) := 100;
	collect1(80) := 1000;
	collect2(1) := 1;
	collect2(10) := 10;
	collect2(100) := 100;
	collect2(1000) := 1000;
	forall i in values of collect1
		insert into tb1 values(collect2(i));
end;
/
```

## 2.2 应用场景

应用与稀疏数组场景，如FORALL VALUES OF 及 FORALL INDICES OF 场景，以及其他需要用到稀疏数组的场景，如员工 工号 - 职位场景。

## 2.3 规格约束

2.3.1 支持及使用范围

|index by 子句|元素类型|索引类型|
|---|---|---|
|VALUES OF|int|int|
|INDICESS OF|任意支持类型|int|


2.3.2 当DML语句中有类似长度超限的错误时

场景：4行数据

1

0

1

0

|类型|连续数组||非连续数组||
|---|---|---|---|---|
||有SAVE EXCEPTIONS|无SAVE EXCEPTIONS|有SAVE EXCEPTIONS|无SAVE EXCEPTIONS|
|VALUES OF,INDICES OF,INDICES OF TABLE|1、数据导入正常 2条,2、EXCEPTIONS捕获异常,     BULK_EXCEPTIONS.COUNT 为 2,3、BULK_ROWCOUNT 4 条数据,4、ROWCOUNT统计为 2|1、数据导入第 1条,2、EXCEPTIONS捕获异常,     BULK_EXCEPTIONS.COUNT 为 1,3、BULK_ROWCOUNT 1 条数据,4、ROWCOUNT统计为 1|1、数据导入正常 2条,2、EXCEPTIONS捕获异常,     BULK_EXCEPTIONS.COUNT 为 2,3、BULK_ROWCOUNT 4 条数据,4、ROWCOUNT统计为 2|1、数据导入第 1条,2、EXCEPTIONS捕获异常,     BULK_EXCEPTIONS.COUNT 为 1,3、BULK_ROWCOUNT 1 条数据,4、ROWCO  UNT统计为 1|
|FORALL,FORALL / 关联数组-连续|1、数据导入正常 2条,2、EXCEPTIONS捕获异常,     BULK_EXCEPTIONS.COUNT 为 2,3、BULK_ROWCOUNT 4 条数据,4、ROWCOUNT统计为 2|1、数据导入第 1条,2、EXCEPTIONS捕获异常,     BULK_EXCEPTIONS.COUNT 为 1,3、BULK_ROWCOUNT 4 条数据,4、ROWCOUNT统计为 1|-|-|


  


2.3.2   BULK_ROWCOUNT 

BULK_ROWCOUNT 索引为   ** [ FORALL**  ** **  ***I***  ** **  **IN VALUES/INDICES ]**   的  ** I**   值（索引值）。

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试主要采用场景法、正交组合法、等价类进行测试

## 3.2 详细测试设计

### 3.2.1 测试设计

3.2.1.1 FORALL支持测试values OF和indicess of语法测试

|测试点|测试项|  
|
|---|---|---|
|关键字缺失|FORALL i in indices table_name|  
|
|  
|FORALL i in of table_name|  
|
|  
|FORALL i in table_name|  
|
|  
|FORALL i in indices of table_name between 1 10|  
|
|  
|FORALL i in indices of table_name 1 and 10|  
|
|  
|FORALL i in indices of table_name between 1 |  
|
|  
|FORALL i in indices of table_name between 1 and|  
|
|  
|FORALL i in indices of table_name between and 10|  
|
|  
|FORALL i in indicesof table_name between and 10|  
|
|  
|FORALL i in values table_name|  
|
|  
|FORALL i in of table_name|  
|
|  
|FORALL i in valuesof table_name|  
|
|关键字错误|FORALL i in indices of table_name between 1 and 10|  
|
|  
|FORALL i in indices f table_name between 1 and 10|  
|
|  
|FORALL i in indices of table_name betwn 1 and 10|  
|
|  
|FORALL i in indices of table_name between 1 an10|  
|
|  
|FORALL i in indices of table_name between '@@' an10 'bb'|  
|


  


  


3.2.1.2 FORALL支持测试values OF和indicess of测试设计

  


**使用的数组在经过不同的处理与反复使用后再次进行使用或者处理（delete，继承后的类型精度，package**  **）**

  


  


  


|语法|索引类型|数组是否连续|元素类型|DML语句|DML执行方式|BULK_ROWCOUNT，ROWCOUNT|数组传入方式|异常并处理|
|---|---|---|---|---|---|---|---|---|
|indices of 关联数组|INT|不连续|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|insert|静态SQL执行|√|local type||
||INT|不连续|OBJECT、VARRAY、TABLE|update|静态SQL执行|√|package type||
||INT|不连续|包含构造方法的type|delete|静态SQL执行|√|形参 ||
||INT|不连续|嵌套类型|mergeinto|静态SQL执行|√|函数返回值||
||INT|不连续|INT、VARCHAR、CLOB、BLOB、NCLOB、XMLTYPE、RAW、JSON、ROWID、UROWID|insert|动态执行-静态SQL|√|local type||
||INT|不连续|OBJECT、VARRAY、TABLE、包含构造方法的type|update|动态执行-静态SQL|√|package type||
||INT|不连续|包含构造方法的type|delete|动态执行-匿名块|√|形参 ||
||INT|不连续|嵌套类型|mergeinto|动态执行-匿名块|√|函数返回值||
||INT|不连续|INT、VARCHAR|insert|静态SQL执行|√|local type|包含zero_divide、InvalidNumber异常，无save exception，BULK_EXCEPTIONS|
||INT|不连续|INT、VARCHAR|insert|动态执行|√|package type|包含zero_divide、InvalidNumber异常，有save exception，BULK_EXCEPTIONS|
||INT|不连续|INT|非DML语句|静态SQL执行，动态执行|-|local type||
||between and测试|边界值测试,常量，覆盖2.1分析场景,静态执行|||||||
|||边界值测试,常量，覆盖2.1分析场景,动态执行|||||||
|||object.c1，record.c1，varray(1)，table(1)，函数返回值，形参，静态执行|||||||
|||object.c1，record.c1，varray(1)，table(1)，函数返回值，形参，动态执行|||||||
||继承的关联数组类型|不连续|OBJECT、VARRAY、TABLE、包含构造方法的type|insert|静态SQL执行|√|-||
|||不连续|INT、CLOB、JSON|update|动态执行|√|-||
|indices of 嵌套表|-|-|INT|insert|静态SQL执行，动态执行|√|local type||
|indices of varray|-|-|INT|update|静态SQL执行，动态执行|√|local type||
|values of 关联数组|INT|不连续|INT|insert|静态SQL执行，动态执行|√|local type||
||INT|不连续|INT|update|静态SQL执行，动态执行|√|package type||
||INT|不连续|INT|delete|静态SQL执行，动态执行|√|形参 ||
||INT|不连续|INT|mergeinto|静态SQL执行，动态执行|√|函数返回值||
||INT|不连续|INT|insert|静态SQL执行，动态执行|√|local type|包含zero_divide、InvalidNumber异常，无save exception，BULK_EXCEPTIONS|
||INT|不连续|INT|update|静态SQL执行，动态执行|√|package type|包含zero_divide、InvalidNumber异常，有save exception，BULK_EXCEPTIONS|
||INT|不连续|INT|非DML语句|静态SQL执行，动态执行|-|local type||
||继承的关联数组类型|不连续|INT|insert|静态SQL执行，动态执行|√|-||
|values of 嵌套表|-|元素不连续|INT|insert|静态SQL执行|√|local type||
|indices of varray|-|元素不连续|INT|update|动态执行|√|local type||
|元素嵌套类型验证indices|A(i).F A.F(i) A.F.F(i) A.F(i).F A.F.F(i).F A(i).F.F A(i)(i) A.F(i).F.F，静态SQL||||||||
||A(i).F A.F(i) A.F.F(i) A.F(i).F A.F.F(i).F A(i).F.F A(i)(i) A.F(i).F.F，动态SQL||||||||
|元素嵌套类型验证values|A(i).F A.F(i) A.F.F(i) A.F(i).F A.F.F(i).F A(i).F.F A(i)(i) A.F(i).F.F，静态SQL||||||||
||A(i).F A.F(i) A.F.F(i) A.F(i).F A.F.F(i).F A(i).F.F A(i)(i) A.F(i).F.F，动态SQL||||||||
|indices of / values of index值 i 异常测试|i 单独存在，A(i+1)，A(A(i))，（i, A(i)），(A(i+1), A(i))，（A(A(i))，A(i)），（A(i), fun(i)）静态SQL||||||||
|indices of / values of index值 i 异常测试|i 单独存在，A(i+1)，A(A(i))，（i, A(i)），(A(i+1), A(i))，（A(A(i))，A(i)），（A(i), fun(i)）动态SQL||||||||
|collection异常测试|collections的位置传入非数组，常量，null，不合法的数组||||||||
|包中函数和存储过程|||||||||


  


3.2.1.3 并发用例测试设计（  **用法用例重新梳理，package**  ）

|序号|场景|  
|  
|
|---|---|---|---|
|1|indices of tablex between -100 and 100 , A(i).F A.F(i)，静态SQL|insert|  
|
|2|indices of tablex between -100 and 100, A(i).F A.F(i)，动态SQL|update|  
|
|3|values of tablex, A(i).F A.F(i)，静态SQL|delete|  
|
|4|values of tablex, A(i).F A.F(i)，动态SQL|mergeinto|  
|
|5|1、indices of tablex between -100 and 100 , A(i).F A.F(i)，静态SQL,2、values of tablex, A(i).F A.F(i)，静态SQL|insert|  
|
|6|1、indices of tablex between -100 and 100, A(i).F A.F(i)，静态SQL,2、values of tablex, A(i).F A.F(i)，静态SQL,3、indices of tablex between -100 and 100, A(i).F A.F(i)，动态SQL,4、values of tablex, A(i).F A.F(i)，动态SQL|update|  
|
|7|indices of tablex between -100 and 100 , A(i).F ，静态SQL，异常处理|delete|  
|
|8|values of tablex,  A(i).F，静态SQL，异常处理|mergeinto|  
|
|9|values of tablex,  A(i).F，静态SQL，异常处理|insert|  
|
|10|values of tablex,  A(i).F，动态SQL，异常处理|update|  
|
|11|1、indices of tablex between -100 and 100  ,A(i).F，静态SQL，异常处理,2、values of tablex,  A(i).F，静态SQL，异常处理|delete|  
|
|12|1、indices of tablex between -100 and 100  ,A(i).F，静态SQL，异常处理,2、values of tablex,  A(i).F，静态SQL，异常处理,3、indices of tablex between -100 and 100  ,A(i).F，动态SQL，异常处理,4、values of tablex,  A(i).F，动态SQL，异常处理|mergeinto|调用同一个集合，修改同一张表|
|13|1、indices of tablex between -100 and 100, A(i).F A.F(i)，静态SQL,2、values of tablex, A(i).F A.F(i)，静态SQL,3、indices of tablex between -100 and 100, A(i).F A.F(i)，动态SQL,4、values of tablex, A(i).F A.F(i)，动态SQL,5、indices of tablex between -100 and 100  ,A(i).F，静态SQL，异常处理,6、values of tablex,  A(i).F，静态SQL，异常处理,7、indices of tablex between -100 and 100  ,A(i).F，动态SQL，异常处理,8、values of tablex,  A(i).F，动态SQL，异常处理|insert/update/delete/megeinto|调用同一个集合，修改同一张表|


  


### 3.2.2 涉及的测试DFX

|系统级DFX分类|是否涉及|
|:---|:---|
|CT 并发测试|是|
|DFR|/|
|HA|/|
|KT kill测试|是|
|一致性|是|
|三方测试工具    
  (sqltest，sqlancer)|/|
|压力|/|
|可维护性|/|
|安全|/|
|性能|是|
|长稳|是|


# 4.   **测试用例**

  


# 5.   **测试框架设计**

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现

# 6.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# **7. 工作量评估**

工作量：12  *人天*

计划测试完成时间：

## Attachments:

[FORALL文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWFhMWFkOWEzMzExZGM4ZDg1IiwicmVmX2lkIjoiNjczOTZjZWE3MjgyMDZlZmI5MmYxODZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NjQ2LCJleHAiOjE3ODIzOTEwNDZ9.ZuxlAHl2QIoQVnHU_H9Uk09aS1TGqx0f-KMFQd-37Zc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,文琪：,VALUES OF和indicess of检视意见：    
  1、3.2.1.2中，元素类型和dml语句可以交叉覆盖，dml的覆盖补充insert的不同方式（insert values，insert（某几列），insert into returning等方式），找开发确认下，varray和嵌套表是否有差别，针对差异点交叉覆盖两种类型    
  2、values OF和indicess of用于连续数组时的拦截用例    
  3、异常测试，字句中传入collections的位置传入非数组，常量，null，不合法的数组等异常情况的拦截    
  4、覆盖下数组传入的不同形式，变量，形参，数组函数，构造函数，函数返回值，复合类型等    
  5、异常情况，数组只有声明未初始化赋值，数组元素超出limit范围    
  6、BETWEEN lower_bound AND upper_bound字句的上下限值测试，覆盖不同的传值方式    
  7、在非forall字句中使用    
  8、在forall中或forall子句中制造异常，检查异常捕获及相关属性打印无异常    
  9、并发测试考虑下结合实际使用的场景，比如修改同一个表，调用同一个变量做入参，互相调用这些场景和VALUES OF和indicess of字句的功能结合，检查对象存在/对象被删除时并发无异常等。,Posted by lihaoyong at 四月 09, 2024 16:02|
|---|
|  [](null)  ,2、values OF和indicess of用于连续数组时的拦截用例 --这个oracle是支持的，我对一下我们什么策略    
  5、异常情况，数组只有声明未初始化赋值，数组元素超出limit范围 --这个数组在声明时就会自动初始化，这一条加入index by的测试点里,Posted by lihaoyong at 四月 09, 2024 16:06|
|  [](null)  ,动态执行绑定参数的位置覆盖,Posted by lihaoyong at 四月 24, 2024 11:33|
