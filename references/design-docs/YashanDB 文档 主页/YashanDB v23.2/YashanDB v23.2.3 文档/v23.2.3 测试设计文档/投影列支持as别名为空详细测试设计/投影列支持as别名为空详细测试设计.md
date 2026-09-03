Created by 李凯峰, last modified on 四月 22, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

*SR:*    [https://pingcode.yasdb.com/pjm/items/6618e007fd997db58ad81cf9](https://pingcode.yasdb.com/pjm/items/6618e007fd997db58ad81cf9)    *?*    
  *#YDBRD-26156 投影列支持表达式as设置别名为空*

*开发设计文档：*    [投影列支持表达式as设置别名为空设计文档 - 赵忠源 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150603078)  

  


# 2. 需求分析

## 2.1 功能点分析

- 支持as别名为空


## 2.2 应用场景

- ddl中使用，如create table as、create view等
- dml中使用  如投影列、子查询可出现的位置、update、delete等


## 2.3 规格约束

- as+无参的函数时，将无参函数视作column，as为其本名，不与as拼接


# 3. 详细测试设计

## 3.1 测试设计方法

  


1.场景法

2.边界值

3.等价类

4.错误推测法

## 3.2 详细测试设计

[支持as别名为空.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjU4OTcwYzJhZjRmNTIxMDllIiwicmVmX2lkIjoiNjczOTZkMjQ1OTNmOTljOWZmMjM3ODViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTk3LCJleHAiOjE3ODIzOTI1OTd9.UClI-koayTnLpSRaV63rMlPW8ot41Ab9q4QjXdEkuz4)

1.数据类型、表类型覆盖

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|存储类型|HEAP/TAC/LSC|  
|  
|
|表类型|非分区表、分区表、复制表、分布表|  
|  
|
|数据类型|覆盖已支持的类型|  
|  
|


2.入参验证

|投影列后接的参数|1. select c1 as from t1;
1. select c1 as,c2 from t1;
|1.select c1 as '' from t1;,2.select c1 as "" from t1;,3.select c1 as + from t1;,4.select c1 as - from t1;,5.select c1 as * from t1;,6.select c1 as / from t1;,7.select c1 as null from t1; ,8.select c1 as . from t1; ,9.select c1 as ? from t1;,10.select c1 as {} from t1,11.select c1 as [] from t1,12.select c1 as || from t1;,13 select c1 as \ from t1;,14 select c1 as | from t1;|  
|
|---|---|---|---|


3.与其他特性交互使用

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|投影列四则运算+as|1、+、-、*、/,2、常量表达式+as,3、列之间的运算+as  ,4、列与常量之间的计算+as,5、列与函数之间的运算+as,6、常量与函数之间的运算+as,7、函数+as ：,无参函数：视为column as为其原名,有参函数：函数名称拼接  as|  
|  
|
|投影列的类型|1.覆盖已支持的数据类型+as,2.常量+as：,（1）字符串字面量,（2）数值字面量,（3）日期字面量,（4）时间戳字面量,（5）年到月字面量,（6）天到秒字面量,（7）二进制字面量,3.伪列+as（覆盖四则运算）,（1）rownum,（2）rowscn,（3）rowid,（4）sequence,（5）user,4.函数,（1）必须有参数的函数：对齐oracle函数名称+as,（2）可以无参数的函数：不带括号的情况下，视作column；带括号的情况下？|  
|  
|
|ddl|1.create table as,例：,- create table t5 as select 1 as from dual;
    - oracle报错
- create table c16 as select sum(c1) as from t2;
    - oracle报错
- create table t5 as select c1 as from t1;
- create table t6 as select c1 as from (select c1 as from t1) t1;
- create table t2 as select t3.sysdateas from (select sysdate as from t1) t3;
- create table t3 as select SYSDATEAS from t2 ref2 where sysdate < (select ref2.SYSDATEAS as from t1);
    - 含外部引用
,2.create view ,- create view v1 as select c1 as from t2;
- create view v2 as select c1 from t2;
- create view v3 as select c1 from (select c1 as from t2)
- create view v4 as select "c1as" from (select c1 as from t2)
- create view v5 as select sum(c1) as from t2;
    - oracle报错，只能为列
- create view v6 as select 1 as from t2;
    - oracle报错，只能为列
- create view v7 as select SYSDATEAS from t2 ref2 where sysdate <> (select ref2.SYSDATEAS as from t1);
    - 外部引用
,3.create outline 同以上场景,4.create materialized view 同以上场景,  
|  
|  
|
|dml|1.update,例：  update t1 set c1=(select c1 as from t1) where c1 = (select c1 as from t1);,2.delete,例：  delete from t1 where c1 = (select c1 as from t1);,3.insert,例：  insert into t1 (c1) select c1 as from t1 ;    
  insert into t1 (c1) select c1 as from t1 where c1 =(select c1 as from t1)     
,4.select,（1）cte,（2）join ：join key为子查询,（3）union,（4）case when,（5） having子句,（6）offset fetch ,例：select 1 from dual fetch first (select 1 as from dual) rows only;,5.运算符,（1）not between and/ between and：,例：select 1 from dual where 1 between (select 1 as from dual) and 1;,（2）not in/in,（3）like/not like,（4）is [not] null ,例：select 1 from dual where (select 1 as from dual) is not null;,6.关联子查询 ：覆盖any/all/some,7.多层嵌套子查询中使用,8.merge,9.外部引用，例：,- select a from t2 ref2 where 1 = (select ref2.b as from t1);
,10.子查询出现的位置,- 投影、from后、fillter
,  
|  
|  
|
|PL/SQL对象中使用，配合绑定参数|1.存储过程,2.匿名块,3.UDF,4.UDP,5.UDT,6.Trigger|  
|  
|
|子查询中与as拼接的投影列|1.函数+as,2.常量+as,3.  column+as,4.子查询+as|  
|如：select t1.SYSDATEAS from (select sysdate as from dual) t1;|
|部署模式|分布式,集群,单机|  
|  
|
|CT/KT测试|  
|  
|  
|


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


# 4. 测试用例

1.冒烟用例：

# 5. 测试框架设计

# 6. 测试环境说明

  


# 7. 工作量评估

工作量：4  *人天*

计划测试完成时间：2024/4/19

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjU4OTcwYzJhZjRmNTIxMDlmIiwicmVmX2lkIjoiNjczOTZkMjQ1OTNmOTljOWZmMjM3ODViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTk3LCJleHAiOjE3ODIzOTI1OTd9.Jh8XBF8PEv7X_atBb2OGIFhtdTXDDH0rleRMxNnzIvo)

## Attachments:

[崖山支持8K的错误码信息长度返回.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjVhMWFkOWEzMzExZGM4ZjEyIiwicmVmX2lkIjoiNjczOTZkMjQ1OTNmOTljOWZmMjM3ODViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTk3LCJleHAiOjE3ODIzOTI1OTd9.RuHJkT35OPxJuTNnPY18vjGy58wVbvrRFCef0vTuDus)

 (application/x-xmind)    


[崖山支持设置错误码长度.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjU4OTcwYzJhZjRmNTIxMGExIiwicmVmX2lkIjoiNjczOTZkMjQ1OTNmOTljOWZmMjM3ODViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTk3LCJleHAiOjE3ODIzOTI1OTd9.CFTaNjbsbKl2bzp_HJMCFxT6WI9NZd-rYc8l9zqNKIM)

 (application/x-xmind)    


[动态加载openssl， 安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjU4OTcwYzJhZjRmNTIxMGEzIiwicmVmX2lkIjoiNjczOTZkMjQ1OTNmOTljOWZmMjM3ODViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTk3LCJleHAiOjE3ODIzOTI1OTd9.uBGEWs-bhZr7h7R644AkSMit63jSavVgDor9WAU82Fw)

 (application/x-xmind)    


[动态加载openssl，安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjVhMWFkOWEzMzExZGM4ZjE0IiwicmVmX2lkIjoiNjczOTZkMjQ1OTNmOTljOWZmMjM3ODViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTk3LCJleHAiOjE3ODIzOTI1OTd9.T1_1ZGQG7fYsUxxvhvwGGtwkj-NcGkFb47wE_iwlv4k)

 (application/x-xmind)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjU4OTcwYzJhZjRmNTIxMDlmIiwicmVmX2lkIjoiNjczOTZkMjQ1OTNmOTljOWZmMjM3ODViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTk3LCJleHAiOjE3ODIzOTI1OTd9.Jh8XBF8PEv7X_atBb2OGIFhtdTXDDH0rleRMxNnzIvo)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjU4OTcwYzJhZjRmNTIxMGE0IiwicmVmX2lkIjoiNjczOTZkMjQ1OTNmOTljOWZmMjM3ODViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTk3LCJleHAiOjE3ODIzOTI1OTd9.MKPuyKC0ZOBvMiVI2u7NmwD1M4A4zJyxOqLE2QVDeQ0)

 (application/msword)    


[支持as别名为空.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjU4OTcwYzJhZjRmNTIxMDllIiwicmVmX2lkIjoiNjczOTZkMjQ1OTNmOTljOWZmMjM3ODViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTk3LCJleHAiOjE3ODIzOTI1OTd9.UClI-koayTnLpSRaV63rMlPW8ot41Ab9q4QjXdEkuz4)

 (application/x-xmind)    
