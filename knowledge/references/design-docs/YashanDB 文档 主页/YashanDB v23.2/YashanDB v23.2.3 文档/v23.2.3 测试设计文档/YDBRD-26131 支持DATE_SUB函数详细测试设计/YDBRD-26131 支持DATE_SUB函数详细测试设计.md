Created by 周彬鑫, last modified by  严丽英 on 五月 10, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/6618d2e1fd997db58ad80334](https://pingcode.yasdb.com/pjm/items/6618d2e1fd997db58ad80334)    ?    
  #YDBRD-26131 支持DATE_SUB函数

*DATE_SUB(date，interval)*

*DATE_SUB为对日期进行减法运算。*

# 2. 需求分析

## 2.1 功能点分析

- *范围：单机*
- *DATE_SUB为对日期进行减法运算。*


## 2.2 应用场景

- *DATE_SUB为对日期进行减法运算。*


## 2.3 规格约束

- *不支持MICROSECOND、SECOND_MICROSECOND、MINUTE_MICROSECOND、HOUR_MICROSECOND、DAY_MICROSECOND，WEEK，QUARTER（MYSQL支持*
- 参数二支持'-1-1' ,‘+1-1' 的interval写法，mysql 不支持
- 参数二不支持 interval 字段名 unit 写法（时间间隔字面量限制），与mysql不一致，mysql支持


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

  


## 3.2 详细测试设计

*1.使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*

***函数关键字***

|测试点|等价类|备注|
|---|---|---|
|函数关键字|函数名称大小写|  
|
|  
|拼写错误|  
|
|  
|名称缺失|  
|
|  
|带单、双引号|  
|
|  
|与对象同名（表、对象、视图）|  
|
|  
|v$function视图有对应记录|  
|


**语法图覆盖**

|测试点|等价类|备注|
|---|---|---|
|覆盖所有interval关键字|SECOND, MINUTE, HOUR, DAY,,MONTH, YEAR,  MINUTE TO SECOND,,HOUR TO SECOND, HOUR TO MINUTE, DAY TO SECOND, DAY TO MINUTE, DAY TO HOUR, YEAR TO MONTH|  
|


**函数嵌套**

|测试点|等价类|备注|
|---|---|---|
|函数嵌套|自嵌套（127层限制|  
|
|  
|聚集函数|  
|
|  
|窗口函数|  
|
|  
|日期函数|  
|
|  
|字符函数|substr/substring返回类型为字符串的|
|  
|转换函数|字符、日期相关的,(to_date/to_timestamp 的format重点覆盖|
|  
|其他函数|nvl|


**参数**

|测试点|等价类|备注|
|---|---|---|
|参数个数|1个、3个|报错|
|参数类型|字面量 date/timestamp/bit|  
|
|  
|1、数值型：tinyint，smallint，int，bigint、float，double、number、bit；[注意]科学计数法，NaN，Inf，-Inf    
  2、字符型：char，varchar，nchar，nvarchar，注意：中文、特殊字符、转义字符    
  3、布尔型：boolean    
  4、日期型：date，time，timestamp，interval year to month，interval day to second    
  5、大对象：blob，clob，nclob    
  6、其他：raw，json，xmltype，rowid，urowid    
  7、自定义类型：UDT|  
|
|伪列|rowid、rownum、user|  
|
|参数为表达式|+- * / % &^| |||  
|
|  
|date参数包含interval运算、函数结果带interval运算|  
|
|  
|布尔表达式|  
|
|参数为null/''|null 表达式|  
|
|参数为子查询|带()|  
|
|参数取值范围|expr是否取值范围有限制|跟yminsterval/dsinterval的取值一致|
|参数为绑定参数执行|plsql|  
|
|  
|jdbc|  
|
|日期为特殊日期|闰年、闰月|  
|
|时间翻转|跨分钟 1:30 s - 31s|  
|
|  
|跨小时   12:10:10   - 11min|  
|
|  
|跨天   2021-10-10 12:10:10 - 13h|  
|
|  
|跨月   2021-10-10 12:10:10 - 11day|  
|
|  
|跨年   2021-10-10 12:10:10 - 11month|  
|
|修改date_format|设置不同date_format，需覆盖参数与fmt不匹配场景|组合不同格式符(组合所有的|


**其他场景**

|测试点|等价类|备注|
|---|---|---|
|DML|delete：函数作为where条件|  
|
|  
|update：函数作为set值，where条件|  
|
|  
|insert：函数作为value值进行insert操作|  
|
|DDL|alter：列默认值、where条件|  
|
|  
|create：create table/view as ，列默认值|  
|
|DQL|布尔表达式：== 、 != 、 >= 、 > 、 < 和 <=|  
|
|  
|操作符：in/not in、exists/not exists 、between and、like/not like、limit等|  
|
|  
|DQL算子：distinct、case when、group by 、group by...having、join on、connect...by、集合操作、order by|  
|
|  
|子查询|  
|
|  
|CTE|  
|
|视图|创建物化视图语句中使用函数|  
|
|  
|创建普通视图语句中使用函数|  
|
|空格|select age (now) from dual|  
|
|列别名|select age(now) age from dual    
  select age(now) as age from dual|  
|
|异常语法|to_timestamp()()    
  to_timestamp().a|  
|


**测试范围**

|部署形态|存储|
|---|---|
|单机|行存|
|集群|行存|


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
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


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[支持DATE_SUB函数冒烟用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDJhMWFkOWEzMzExZGM4ZTNlIiwicmVmX2lkIjoiNjczOTZkMDI1OTNmOTljOWZmMjM3NjVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MjI3LCJleHAiOjE3ODIzOTE2Mjd9.DtJ9WdZr6aL0puE5BgowpE8t2UE_bYBNc533bZlBgW8)

可复用date_add 的用例

  [date_add函数测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=91763146)  

用例：

  [standalone/testcase/function3/date_add · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function3/date_add)  

  [standalone/testcase/function6/datetime_func · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function6/datetime_func)  

详见附件

[date_sub文本用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDJhMWFkOWEzMzExZGM4ZTNmIiwicmVmX2lkIjoiNjczOTZkMDI1OTNmOTljOWZmMjM3NjVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MjI3LCJleHAiOjE3ODIzOTE2Mjd9.fRG91Hex6bMecy2p4g8Vkcr2ci2rJ0OB8VhlTPBlNLE)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[支持DATE_SUB函数冒烟用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDJhMWFkOWEzMzExZGM4ZTNlIiwicmVmX2lkIjoiNjczOTZkMDI1OTNmOTljOWZmMjM3NjVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MjI3LCJleHAiOjE3ODIzOTE2Mjd9.DtJ9WdZr6aL0puE5BgowpE8t2UE_bYBNc533bZlBgW8)

 (application/vnd.ms-excel)    


[date_sub文本用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDJhMWFkOWEzMzExZGM4ZTNmIiwicmVmX2lkIjoiNjczOTZkMDI1OTNmOTljOWZmMjM3NjVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MjI3LCJleHAiOjE3ODIzOTE2Mjd9.fRG91Hex6bMecy2p4g8Vkcr2ci2rJ0OB8VhlTPBlNLE)

 (application/vnd.ms-excel)    


## Comments:

|  [](null)  ,会议名称：支持date_sub函数测试设计评审,评审,评审时间：2024/04/22 11:00-12:00,参与人：胡晓畔、刘晓旋、赵忠源、严丽英、周彬鑫,1.重点覆盖修改date_format的场景，函数返回结果是否正确,2.函数嵌套重点在to_timestamp/to_date函数    
  3.第二个参数 为'1-1'，interval 字段名 unit 结果与MySQL不一致，yasdb为字面量处理,4.补充带interval运算的场景,评审结论：通过,Posted by zhoubinxin at 四月 22, 2024 12:12|
|---|
