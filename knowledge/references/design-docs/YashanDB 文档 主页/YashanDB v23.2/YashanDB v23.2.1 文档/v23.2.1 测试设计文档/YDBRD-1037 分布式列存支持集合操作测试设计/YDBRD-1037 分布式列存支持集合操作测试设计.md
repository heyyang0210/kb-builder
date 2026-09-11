Created by 周彬鑫, last modified on 十一月 21, 2023

# 1.   **概述**

1. 原单机列存已支持支持集合操作：  union, union all, intersect, intersect all, minus, minus all。 
1. 现分布式场景下列存也要支持对应集合操作。


# 2.   **需求分析**

### 2.1 语法图

![](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/img/subquery.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1NjgsImV4cCI6MTc4MjMwNjM2OH0.H_nHmm996RWgbfwT4lVcpa4aJtrZMTcNhYr9OTTd8XI)

### **2.2 功能描述**

#### **Union，Union All**

union做两个集合的并集，即对左右两个运算的结果做并操作，并去除并操作之后的重复的结果。

union all对于操作结果不做去重。

#### **Intersect，Intersect All**

Intersect做两个集合的交集，即对左右两个运算的结果做取相同记录的操作，并去除重复结果。

interscet all对于操作结果不做去重。

#### **Minus，Minus All**

minus做两个集合的差集，即对左右两个运算的结果做差运算，返回出现在第一个查询结果中，但不在第二个查询结果中的记录，并去除重复结果，运算符前后的操作对象顺序不同会导致结果不同。

minus all对于操作结果不做去重。

#### **except，except all**

做差集，等价于minus/minus all

  


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|输入条件|有效等价类|编号|无效等价类|编号|
|---|---|---|---|---|
|集合两边数据类型|数据类型一致(数值、字符、日期、lob、raw、null、rowid)|  
|数值-字符|  
|
|  
|数据类型不一致：,数值int float double smallint tinyint bigint  ,转换规则：,tinyint<smallint<int<bigint<number<float<double|  
|数值-时间|  
|
|  
|数据类型不一致：,字符char varchar ,转换规则：,char(m)-char(n) >> varchar(max(m,n)),char(m)-varchar(n)>> varchar(max(m,n)),varchar-varchar >> varchar(取两者较长长度)|  
|字符-时间|  
|
|  
|数据类型不一致：,日期date time timestamp ,转换规则：,TIME<DATE<TIMESTAMP|  
|不同类型时间间隔|  
|
|  
|数据类型一致：,时间间隔、blob、clob、raw、null|  
|raw-其他数据类型|  
|
|  
|数据类型不一致：,null-其他数据类型|  
|blob、clob、json|  
|
|  
|交换左右集合|  
|  
|  
|
|集合的列数|单投影列|  
|左右集合的投影列数不同|  
|
|  
|多投影列|  
|  
|  
|
|  
|交换投影列顺序|  
|  
|  
|
|混用多种集合|从左至右按顺序执行|  
|  
|  
|
|  
|加（） 按指定顺序执行|  
|  
|  
|
|投影列|null /null表达式|  
|  
|  
|
|  
|运算表达式|  
|  
|  
|
|  
|函数|  
|  
|  
|
|filter|比较、||、运算|  
|  
|  
|
|  
|函数|  
|  
|  
|
|  
|group by、having、join on、order by、connect by、limit、offset|  
|  
|  
|
|DDL|create table as select|  
|  
|  
|
|  
|create view as select|  
|  
|  
|
|DML|insert into table select|  
|  
|  
|
|  
|delete from where|  
|  
|  
|
|  
|update set where|  
|  
|  
|
|PLSQL|绑定参数|  
|  
|  
|
|并行|/* parallel（）*/|  
|  
|  
|
|投影列case when|  
|  
|  
|  
|
|CTE|  
|  
|  
|  
|
|子查询|  
|  
|  
|  
|


## 3.2 详细测试设计

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

[分布式列存支持集合操作.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTNhMWFkOWEzMzExZGM4M2ZiIiwicmVmX2lkIjoiNjczOTZiOTM3MjgyMDZlZmI5MmYwN2JmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTY3LCJleHAiOjE3ODIzODE5Njd9.DTqB0miQGL0beXMw2_gEZmuee7GzlUd3HLL9mwDEy7I)

原单机列存用例    [standalone/testcase/function5/test_sdv_setOp · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function5/test_sdv_setOp)  

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|是|
|长稳|是|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[setop文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTNhMWFkOWEzMzExZGM4M2ZjIiwicmVmX2lkIjoiNjczOTZiOTM3MjgyMDZlZmI5MmYwN2JmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTY3LCJleHAiOjE3ODIzODE5Njd9.yN0W98bVvrYASXW24X05z5GbmE8CxSL2-bQPBJ5bl-s)

# 5. 测试框架设计

1. 使用yasft框架实现自动化


# 6. 测试环境说明

|服务器|  
|
|---|---|
|操作系统|Linux|
|部署|分布式|


# 7. 工作量评估

工作量：10  *人天*

计划测试完成时间：2023-11-14

## Attachments:

[分布式列存支持集合操作.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTNhMWFkOWEzMzExZGM4M2ZkIiwicmVmX2lkIjoiNjczOTZiOTM3MjgyMDZlZmI5MmYwN2JmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTY3LCJleHAiOjE3ODIzODE5Njd9.qKdIlrdCbm-tBeq3gUDEKg5QrJSqvfkxQj_AJBVOh-8)

 (application/x-xmind)    


[分布式列存支持集合操作.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTQ4OTcwYzJhZjRmNTIwNTg3IiwicmVmX2lkIjoiNjczOTZiOTM3MjgyMDZlZmI5MmYwN2JmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTY3LCJleHAiOjE3ODIzODE5Njd9.PjeDwtuijpj2A5xhpNACoVulhO1BAjgZ8OZUxCd7hAk)

 (application/x-xmind)    


[分布式列存支持集合操作.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTNhMWFkOWEzMzExZGM4M2ZiIiwicmVmX2lkIjoiNjczOTZiOTM3MjgyMDZlZmI5MmYwN2JmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTY3LCJleHAiOjE3ODIzODE5Njd9.DTqB0miQGL0beXMw2_gEZmuee7GzlUd3HLL9mwDEy7I)

 (application/x-xmind)    


[setop文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTRhMWFkOWEzMzExZGM4M2ZlIiwicmVmX2lkIjoiNjczOTZiOTM3MjgyMDZlZmI5MmYwN2JmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTY3LCJleHAiOjE3ODIzODE5Njd9.61aP_5wV_M8KD1vjJZiNSriQSRy-GUx6dQEFdHkh0io)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[setop文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTNhMWFkOWEzMzExZGM4M2ZjIiwicmVmX2lkIjoiNjczOTZiOTM3MjgyMDZlZmI5MmYwN2JmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTY3LCJleHAiOjE3ODIzODE5Njd9.yN0W98bVvrYASXW24X05z5GbmE8CxSL2-bQPBJ5bl-s)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
