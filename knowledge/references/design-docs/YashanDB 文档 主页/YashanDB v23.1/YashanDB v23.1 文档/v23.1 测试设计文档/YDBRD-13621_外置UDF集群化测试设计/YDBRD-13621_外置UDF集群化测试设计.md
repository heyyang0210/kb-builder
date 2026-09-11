Created by 张江, last modified on 十月 15, 2024

# 1.概述

本文档用于描述外置UDF集群化测试设计。

SR链接：    [YDBRD-13621](https://jira.yasdb.com/browse/YDBRD-13621?src=confmacro)    -  外置UDF的集群化改造  完成

# 2.需求分析

## 2.1功能点分析

1、单机用例兼容：单机外置UDF  用例能够无缝衔接在集群上执行，无需改造语法，100%兼容，测试结果同单机保持一致；

2、集群使用场景：

2.1 集群实例间数据同步

1)集群下一个实例CREATE/REPLACE 外置UDF后可以在其它实例上使用外置UDF；

2)集群下一个实例DROP 外置UDF后其他实例也无法使用外置UDF；

3)集群下一个实例CREATE/REPLACE LIBRARY后可以在其他实例上使用LIBRARY；

4)集群下一个实例DROP LIBRARY后其他实例也无法使用LIBRARY；

5)集群下一个实例LOADJAVA后可以在其他实例上使用javalib和library；

6)集群下一个实例DROPJAVA后可以在其他实例也无法使用javalib和library；

2.2 集群实例间并发使用外置UDF，保证集群状态正常，不会coredump。

1)并发创建外置UDF；

2并发调用外置UDF；

3)并发删除外置UDF；

4)并发创建、调用、删除外置UDF组合形式。

3、yex_server进程故障对外置UDF影响；

4、外置UDF结合权限、审计使用；

5、外置UDF应用于普通SQL语句、PLSQL过程体对象、同义词、视图、游标等对象中。

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

本次需求支持单机和集群环境。

# 3.详细测试设计

## 3.1测试设计方法

本次测试设计主要使用场景分析法以及相关的组合策略来设计。

## 3.2详细测试设计

1、使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式

|分类|使用场景|
|---|---|
|集群实例间数据同步|1、实例1CREATE/OR REPLACE外置UDF后，实例2可以正常使用该外置UDF,2、实例1DROP外置UDF后，实例2无法使用该外置UDF,3、实例1CREATE/OR REPLACE LIBRARY后，实例2可以正常使用该LIBRARY,4、实例1DROP LIBRARY后，实例2无法使用该LIBRARY,5、实例1LOAD JAVACLASS后，实例2可以加载该JAVA方法,6、实例1DROP JAVACLASS后，实例2无法加载该JAVA方法|
|外置UDF参数测试|参数类型覆盖boolean、byte、char、short、int、long、float、double、string等，分别对应YashanDB的boolean、tinyint、int、smallint、int、bigint、float、double、varchar|
|外置UDF应用于普通SQL语句|普通SQL语句可以带有子句有子查询、order by、where、not exists、not in、all、any、limit、cast、case when、dml语句等|
|外置UDF应用于PLSQL过程体对象|PLSQL过程体对象可以是匿名块、存储过程、自定义函数等|
|外置UDF权限测试|1、user1无create library、create any library权限时，user1创建user1.library报错,2、user1有create library权限，无create any library权限时，user1创建user1.library成功，user1创建user2.library报错,3、user1有create library、create any library权限时，user1创建user1.library、user2.library成功,4、user1有create library、create any library权限，revoke user1权限，创建user1.library、user2.library报错,5、user1有create procedure权限，user1创建user1.外置udf成功，创建user2.外置udf报错,6、user1有create any procedure权限，user1创建user1.外置udf、创建user2.外置udf成功,7、user1有create any procedure权限，revoke user1权限，创建user1.外置udf、创建user2.外置udf报错|
|外置UDF审计测试|1、打开审计开关，分别创建create library、drop library、execute library审计策略，并生成审计日志，用户执行create library、drop library后，查看审计记录存在；,2、执行清理审计记录操作，再次查看审计记录不存在；,3、关闭审计策略后，用户执行create library、drop library后，查看审计记录不存在。|
|外置UDF应用于流程控制和动态执行语句|1、流程控制覆盖case when、for loop、if else、wile loop、goto label、continue,2、动态执行中使用execute immediate using子句|
|外置UDF在游标中使用|1、作为游标参数，用作默认值,2、用作游标定义时使用的selec语句中，如where条件|
|外置UDF应用于同义词和视图|1、创建表的同义词时，可以用作select、update、delete子句中的where条件；insert子句中用作value值；,2、结合存储过程，可以用作入参、变量赋值、对表的同义词执行dml操作等,3、创建视图时，可以用作视图定义语句中的where条件、order by子句，多表关联时的关联条件等。|
|外置UDF异常测试|1、java class名字长度超过127时报错,2、不支持数组类型，如int[]报错,3、参数类型和个数不匹配时报错,4、java函数不存在时，调用外置udf报错,5、java class文件不存在时，调用报错,6、java class不存在时，调用报错|
|外置UDF嵌套调用|外置udf应用于自定义函数和存储过程间嵌套调用，用作参数传递和返回值|
|yex_server故障测试|1、yex_server进程被杀后，已添加的外置UDF能正常使用，新增UDF可以正常使用，正在执行的udf报错，重新调用时可以正常执行,2、数据库正常退出后，yex_server正常退出，重新执行外置udf后进程被拉起,3、数据库重启，已添加的外置UDF能正常使用，新增UDF可以正常执行调用|


xmind版测试设计见：

2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


细化后的测试用例见：

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

## Attachments:

[外置UDF集群化测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OGU4OTcwYzJhZjRmNTFmOTEzIiwicmVmX2lkIjoiNjczOTY5OGU1OTNmOTljOWZmMjM0ZmViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MTg2LCJleHAiOjE3ODIyOTM1ODZ9.op0CB24jHcjUTfaB81E2RxQb3whvc-_WOR2lp8TPFUM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[外置udf的集群化改造.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OGY4OTcwYzJhZjRmNTFmOTE0IiwicmVmX2lkIjoiNjczOTY5OGU1OTNmOTljOWZmMjM0ZmViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MTg2LCJleHAiOjE3ODIyOTM1ODZ9.qfIvCRuqDSYvqca1Q959FxLfsYPbESG23F8OOSjzgyY)

 (application/x-xmind)    
