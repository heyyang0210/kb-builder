Created by 鄢红亮, last modified on 十一月 13, 2023

  [YDBRD-16483](https://jira.yasdb.com/browse/YDBRD-16483?src=confmacro)    -  新增内置函数UNSUPPORT_ERROR  完成

  [YDBRD-16724](https://jira.yasdb.com/browse/YDBRD-16724?src=confmacro)    -  新增内置函数UNSUPPORT_ERROR  完成

# **1. 概述**

SQL语句中出现UNSUPPORT_ERROR函数则会抛出无法执行的错误This statement is temporarily unable to execute due to an internal error  。

该语句因内部错误暂时无法执行。

# **2. 需求分析**

## 2.1语法

![](https://pingcode.yasdb.com/atlas/files/public/67396a058970c2af4f51fb9c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA3MDgsImV4cCI6MTc4MjIyMTUwOH0.ez0x6vGm69Uu1ygqv6lbhDeItq10CGjrn023wnZV0wE)

## 2.2 功能描述

UNSUPPORT_ERROR()

没有参数。

不能有参数。

括号可以省略。

**  
**

**  
**

# **3. 测试设计方法**

**主要采用的等价类划分，边界值**  **，场景法组合及错误推测法进行设计**

**3.1、基本功能测试**

|新增内置函数UNSUPPORT_ERROR测试设计|UNSUPPORT_ERROR()|需求：一旦SQL语句中出现这个函数将固定抛出一个无法执行的错误This statement is temporarily unable to execute due to an internal error|  
|  
|
|:---|:---|:---|:---|:---|
|||规格|不能有参数。|  
|
||||括号可以省略。|  
|
||语法|ALTER INDEX|  
|  
|
|||ALTER TABLE|  
|  
|
|||CREATE ACCESS |  
|  
|
|||CREATE SQLMAP|  
|  
|
|||CREATE TABLE AS|  
|  
|
|||CREATE TABLE|DEFAULT|  
|
|||CREATE VIEW|  
|  
|
|||DELETE|  
|  
|
|||UPDATE|  
|  
|
|||INSERT|insert into values|  
|
||||insert into select|  
|
|||MERGE|  
|  
|
|||EXPLAIN|  
|  
|
|||SELECT|多表连接（子查询、JOIN等）|  
|
||||排序ORDER BY|  
|
||||分组GROUP BY|  
|
||||LIMIT|  
|
||||like|  
|
||||in|  
|
||||exists|  
|
||||having|  
|
||||ANY|  
|
||||all|  
|
||||intersect|  
|
||||MINUS|  
|
|||where条件|  
|  
|
|||plsql|语句映射|ddl|
|||||dml|
||嵌套|普通函数|  
|  
|
|||聚合函数|  
|  
|
||表类型|行表|heap|  
|
|||列表|lsc|  
|
||||tac|  
|
||部署|单机|  
|  
|
|||分布式|  
|  
|
||其他场景|以UNSUPPORT_ERROR函数为对象名创建对象|  
|  
|


  


# **4. 详细测试设计**

# **5. 测试用例**

测试设计细化后的文本用例

详见：    [standalone/testcase/function5/test_sdv_UNSUPPORT_ERROR · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function5/test_sdv_UNSUPPORT_ERROR)  

  


# **6. 测试框架设计**

1. **本次测试采用Guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。**


# **7. 测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机,分布式|


## Attachments: