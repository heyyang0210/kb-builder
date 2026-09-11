Created by 李浩勇, last modified on 十二月 20, 2023

# 1. 概述

本文描述BULK COLLECT语法的测试设计

IR：     [YDBRD-231](https://jira.yasdb.com/browse/YDBRD-231?src=confmacro)    -  游标支持BULK COLLECT Clause  完成

  


支持范围：单机，集群，分布式 （只 支持local UDT，不支持存储过程）

# 2. 需求分析

## 2.1 功能点分析

BULK COLLECT语句会批量检索数据结果，当有多条数据结果存在时，BULK COLLECT语句会把结果集绑定到一个 集合变量里，使PL/SQL引擎与SQL引擎的上下文切换只发生一次，从而减少系统开销，提升性能。

主要有三种场景支持使用BULK COLLECT：

语法结构

![](https://conf.yasdb.com/download/attachments/135602707/image2023-11-7_19-0-43.png?version=1&modificationDate=1699959859000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzODAsImV4cCI6MTc4MjMwOTE4MH0.z3B4Tb3eGPWQzcWwDO7kb-Smk3--mRSvPpmpS5fQn4g)

```
... BULK COLLECT INTO collection_name[, collection_name] ...
```

  


select into：

![](https://conf.yasdb.com/download/attachments/135602707/image2023-11-7_19-0-30.png?version=1&modificationDate=1699959859000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzODAsImV4cCI6MTc4MjMwOTE4MH0.z3B4Tb3eGPWQzcWwDO7kb-Smk3--mRSvPpmpS5fQn4g)

```
declare
	type ty_test is table of tb_test%rowtype;
	res_test ty_test;
begin
	select * bulk collect into res_test from tb_test where c1 <= 5;
	for n in res_test.first .. res_test.last loop
		DBMS_OUTPUT.PUT_LINE('ID: ' || res_test(n).c1 || ' name: ' || res_test(n).c2 || 'NUM: ' || res_test(n).c3);
	end loop;
end;
/
```

fetch into：

![](https://conf.yasdb.com/download/attachments/135602707/image2023-11-7_19-1-20.png?version=1&modificationDate=1699959859000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzODAsImV4cCI6MTc4MjMwOTE4MH0.z3B4Tb3eGPWQzcWwDO7kb-Smk3--mRSvPpmpS5fQn4g)

```
declare
	type ty_test is table of tb_test%rowtype;
	res_test ty_test;
	cur_test sys_refcursor;
begin
	open cur_test for select * from tb_test where c1 <= 5;
	fetch cur_test bulk collect into res_test limit 4;
	for n in res_test.first .. res_test.last loop
		DBMS_OUTPUT.PUT_LINE('ID: ' || res_test(n).c1 || ' name: ' || res_test(n).c2 || 'NUM: ' || res_test(n).c3);
	end loop;
end;
/
```

returning into（暂不支持）

## 2.2 应用场景

当查询的结果集有多行需要处理时，使用BULK COLLECT语法可以提升性能。

隐式游标场景，显式游标，游标变量获取多行数据的场景。

## 2.3 规格约束

1  、支持动态与静态  SQL  ；

2  、支持  select into  、  fetch into，不支持  returning into；

3  、如果  bulk collect  未找到任何行，不会抛出  NO_DATA_FOUND  异常；

4  、查询未返回行，集合的  COUNT  方法返回  0  ；

5  、  bulk collect  支持  limit  语法；

       select * from bulk collect into res limit 10;

       fetch cur_1 bulk collect into res limit 10;

6  、支持提取单列与多列；

7  、支持单表或多表连接结果；

8、  暂不支持returning  语句

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试主要采用场景法、正交组合法、等价类进行测试

## 3.2 详细测试设计

### 3.2.1 测试设计

|bulkcollect|select into|查询主体|select|*||
|---|---|---|---|---|---|
|||||column||
|||||as||
|||||表达式（覆盖去重函数distinct）||
||||from|普通表||
|||||分区表（range分区，list分区，hash分区）||
|||||临时表||
|||||多表关联||
|||||视图|  
|
|||||物化视图|CREATE MATERIALIZED VIEW mv_sales AS|
|||||同义词|CREATE PUBLIC SYNONYM sy_area1 FOR|
|||||子查询|  
|
|||||heap/lsc/tsc|  
|
||||where|不含||
|||||静态||
|||||动态变量||
|||||默认值||
|||||rownum||
||||order by|字段名||
|||||字段序号||
||||limit|大小，合法性||
|||BULK COLLECT into（集合）|UDT实例|方式|已赋值|
||||||未赋值|
||||||未定义|
||||||pkg头部  定义的实例|
||||||存储过程入参(in/out/in out)|
||||||函数返回值|
||||||同session不同PACKAGE HEAD中的变量互相调用|
|||||类型|record|
||||||varray|
||||||table|
||||||嵌套类型（varray/table/record）|
||||||UDT嵌套多层|
|||||值类型不匹配|可转化|
||||||不可转化|
||||||值长度不匹配，源数据超过目标集合长度|
||||||结果集个数不匹配|
||||||覆盖不同数据类型重点blob，JSON，narchar|
||||||源数据特殊验证，NULL，空值，0 ，特殊字符等|
||||||多行之中个别行导入失败|
|||||table字段数不匹配|多|
||||||少|
|||||使用方法改变UDT内容||
||||标量类型|常量||
|||||变量int，字符串，时间，JSON，rowid||
|||execute immediate|无变量|execute immediate 'select * from tb1 where a = 1' bulk collect into udt_1;||
||||含绑定参数|execute immediate 'select * from tb1 where a = :1' bulk collect into udt_1 using 1;||
||||  
|绑定参数 column （in out ）|  
|
||||+order by|execute immediate 'select * from tb1 where a = :1 order by 1' bulk collect into udt_1 using 1;||
||||+rownum|execute immediate 'select * from tb1 where a = :1 and rownum <=2 order by 1' bulk collect into udt_1 using 1;||
||||动态语法包含全部语法内容|sql_text := 'select * bulk collect into udt_1 from tb1 where a = 1 and rownum <=2 order by 1';    
   execute immediate sql_text; |报错|
|||for循环执行select into||||
||fetch into|游标|显式游标|无变量||
|||||包含变量||
|||||游标未关闭，过程体结束后应该关闭|  
|
||||游标变量|强类型|结果集和集合类型匹配|
||||||结果集和集合类型不匹配|
|||||弱类型||
|||||预定义弱类型sys_refcursor||
|||||游标重复打开|  
|
|||||游标重复打开不同的SQL|  
|
|||||游标单次可打开的最大数据量application mem|  
|
|||BULK COLLECT into（集合）|同select into-BULK COLLECT into|||
||||limit|大于/小于结果集行数||
|||||变量||
|||||非法值||
|||limit循环fetch数据正确性/多次fetch||||
||returning into|不支持/拦截||||
||语法关键字测试|||||
||属性|%FOUND|fetch前后|||
|||%NOTFOUND||||
|||%ROWCOUNT||||
|||%ISOPEN|fetch后重复关闭与打开|||
|||%COUNT-未返回行数为0||　--确认||
||异常处理|BULKCOLLECT未返回行不抛出NO_DATA_FOUND异常|数据本身为空|||
||||fetch ALL|||
|||TOO_MANY_ROWS|　不抛异常|||
|||VALUE_ERROR||||
|||zero_divide||||
|||InvalidNumber||||
|||长度溢出||||
|||字段数量不匹配||||
|||OTHERS||||
||异常处理方式及错误码|系统预定义|  
|||
|||EXCEPTION变量声明|  
|||
|||RAISE_APPLICATION_ERROR|  
|||
|||EXCEPTION_INIT|  
|||
|||SQLCODE&SQLERRM|  
|  
|  
|
||性能|使用BULK COLLECT和for循环的性能对比|数据量分别为一千和十万条场景|　性能不劣化||
||||测试显式和隐式|||
||兼容交互|包  /存储过程/函数中使用||||


### 并发设计

||并发场景（  表数据量1000  ）|并发|
|---|---|---|
|并发测试|对同一张表的select bulk collect into操作，多层嵌套UDT|10|
||对同一张表的select bulk collect into操作，动态执行，包含where条件|10|
||对同一张表的fetch bulk collect into操作，显示游标，包含where条件|10|
||对同一张表的fetch bulk collect into操作，游标变量，包含where条件，多层嵌套UDT|10|
||通过包调用，对同一张表的fetch bulk collect into操作，显示游标，包含where条件|10|
||通过存储过程调，用对同一张表的fetch bulk collect into操作，游标变量，包含where条件，多层嵌套UDT|10|
||对同一张表的update操作，与其余DML操作不起锁冲突|5|
||对同一张表的insert操作，与其余DML操作不起锁冲突|5|
||对同一张表的delete操作，与其余DML操作不起锁冲突|5|
||对同一张表的除0和非空约束异常bulk|5|
||对同一张分区表进行select bulk collect into操作，多层嵌套UDT|10|
||对同一张分区表进行fetch bulk collect into操作，显示游标，包含where条件|10|
||对同一张分区表进行分区update操作，与其余DML操作不起锁冲突，且不影响bulk操作数据|5|
||对同一张分区表进行分区delete操作，与其余DML操作不起锁冲突，且不影响bulk操作数据|5|
||对同一张分区表进行分区insert操作，与其余DML操作不起锁冲突，且不影响bulk操作数据|5|
||对同一张分区表进行分区truncate操作，与其余DML操作不起锁冲突，且不影响bulk操作数据|5|
||对普通表的查询操作，全表扫描|5|
||对分区表的查询操作，全表扫描|5|


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

工作量：10  *人天*

计划测试完成时间：

## Attachments:

[bulkcollet文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmJhMWFkOWEzMzExZGM4NmUzIiwicmVmX2lkIjoiNjczOTZiZmI1OTNmOTljOWZmMjM2OTA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MzgwLCJleHAiOjE3ODIzODQ3ODB9.B9G8ogvTrRPcDtWCUI86gjS2Oid7Panp_4xWFePpbEA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[bulkcollet文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmJhMWFkOWEzMzExZGM4NmU0IiwicmVmX2lkIjoiNjczOTZiZmI1OTNmOTljOWZmMjM2OTA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MzgwLCJleHAiOjE3ODIzODQ3ODB9.48DvQ2uxKLOubdmXsUD_dP4Kzrz5Fznz3s8i1uB0pR4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[bulkcollet文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmI4OTcwYzJhZjRmNTIwODcwIiwicmVmX2lkIjoiNjczOTZiZmI1OTNmOTljOWZmMjM2OTA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MzgwLCJleHAiOjE3ODIzODQ3ODB9.XjoiamVfXj3a7dTy0VnNu6DRgTb2RswhIHBE9OSrt9o)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[bulkcollet文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmNhMWFkOWEzMzExZGM4NmU1IiwicmVmX2lkIjoiNjczOTZiZmI1OTNmOTljOWZmMjM2OTA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MzgwLCJleHAiOjE3ODIzODQ3ODB9.ugGEPqa3WFyrVhm2b0Whm7FeNoZMFQeYdII78qfdD8c)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,并发：,1.不同的sql语句并发（同一张表 不同的filter条件；不同的表；静态sql,动态sql） 观察sql pool,app memory是否会不足；,2.select bulk collect into/fetch bulk collect into（单表查询，多表查询） +   表上的DML,select bulk collect into/fetch bulk collect into +   表上的DDL,select bulk collect into/fetch bulk collect into +   表上的DML +   表上的DDL,3.多表关联,4.分区表  分区相关的操作 ,Posted by zhangxin at 十二月 21, 2023 10:03|
|---|
