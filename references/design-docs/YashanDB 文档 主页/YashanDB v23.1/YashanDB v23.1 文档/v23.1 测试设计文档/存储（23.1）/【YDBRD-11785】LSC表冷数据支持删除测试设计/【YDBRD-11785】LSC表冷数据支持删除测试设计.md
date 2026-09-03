Created by 易文亮, last modified by  陈瑞 on 十一月 14, 2023

# **1. 概述**

本文描述LSC表冷数据支持删除测试设计的测试设计

# **2. 需求分析**

SR：        [YDBRD-11785](https://jira.yasdb.com/browse/YDBRD-11785?src=confmacro)    -  【2023.1】LSC表的SCOL数据支持删除  完成

开发设计：    [【Spearfish】LSC 表冷数据支持删除方案设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=100092079)  

delete支持条件下推

delete后AC失效，需重新生成，事务验证，动静态数据增删查改，delete后触发合并等

新增系统表  SCOL_DELETE_BITMAP$

限制：

 1、不支持多表  update   

2  、分布式暂不支持列存表  update  /  delete  带子查询，限制了本SR在分布式下的表现 

3  、不支持指定slice删除 

4  、行锁放大到   chunk   级别，锁冲突增大。

   5  、  select     for     update     skip     locked   语句发现锁冲突，不跳过整个slice，直接报错 

6  、未打开  row     movement   发现  delete  冲突则跳过，打开  row     movement   发现  delete  冲突则语句重启，由于分布式当前不支持  row     movement   ，发生  delete   冲突，直接跳过

# **3. 测试**  **设计方法**   

测试设计主要采用等价类、场景法及错误推测法进行设计

测试考察delete语句的基本语法，测试观察点：

1、delete基本语法支持范围

2、delete的是否正确删除表中符合条件的行

3、不正确的delete语法报错信息是否正确

4、除限制外，delete要无感删除，不分静态动态数据

  


### 组合场景

1、lob列做filter进行delete

2、多表delete

3、delete带子查询

4、delete 1条/多条数据，数据在1个slice/多个slice

5、delete触发数据合并，delete触发AC失效并重新生成

6、delete结合事务验证，delete后commit/rollback

# 4.   **详细测试设计**

4.1 基本语法

|delete语句部分|有效等价类|编号|无效等价类|编号|备注|
|:---|:---|:---|:---|:---|:---|
|对象|普通表|  
|视图|  
|  
|
||hash分区表|  
|AC|  
|  
|
||range分区表|  
|  
|  
|  
|
||list分区表|  
|  
|  
|  
|
||interval分区|  
|  
|  
|  
|
|error_logging_clause（不支持）|  
|  
|  
|  
|  
|
|returning_clause（不支持）|  
|  
|  
|  
|  
|
|t_alias|表别名|  
|  
|  
|  
|
|table_expression_clause|table|  
|无效表名|  
|  
|
|where_clause    
    
    
    
    
    
    
    
    
    
    
|逻辑表达式|  
|  
|  
|  
|
||subquery|  
|  
|  
|  
|
||partition|  
|无效partition|  
|  
|
||view|  
|无效view|  
|  
|
||table_collection_expression|  
|只支持table(table_function)|  
|  
|
||between and|  
|  
|  
|  
|
||in/not in|  
|  
|  
|  
|
||is null/is not null|  
|  
|  
|  
|
||like/not like|  
|  
|  
|  
|
||limit|  
|  
|  
|  
|
||exists/not exists|  
|  
|  
|  
|
||比较操作|  
|  
|  
|  
|
|  
    
  delete行数    
    
    
    
|一行|  
|  
|  
|  
|
||多行|  
|  
|  
|  
|
||全部行（是否带where条件）|  
|  
|  
|  
|
|数据分布|删除1个slice部分数据|  
|  
|  
|  
|
||多个slice删除部分数据|  
|  
|  
|  
|
||删除整个slice|  
|  
|  
|  
|
||删除多个slice|  
|  
|  
|  
|


覆盖所有数据类型

4.2 组合场景

1、lob列做filter进行delete

2、多表delete

3、delete带子查询

4、delete 1条/多条数据，数据在1个slice/多个slice

5、delete触发数据合并，delete触发AC失效并重新生成

6、delete结合事务验证，delete后commit/rollback

  


# 5.   **测试用例**

# 6.   **测试框架设计**

自动化用例添加到YAT框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机+分布式+HA|


## Attachments:

[LSC支持scol数据删改能力(ydbrd11785).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTM4OTcwYzJhZjRmNTFmYjFhIiwicmVmX2lkIjoiNjczOTY5ZTM1OTNmOTljOWZmMjM1M2RjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NzQ4LCJleHAiOjE3ODIyOTYxNDh9.QLatsNZtcZMxPxy9_DWr1N2oGLHXV2ovbtj2XqnZr0s)

 (application/x-xmind)    


[LSC支持scol数据删改能力(ydbrd11785).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTNhMWFkOWEzMzExZGM3OThlIiwicmVmX2lkIjoiNjczOTY5ZTM1OTNmOTljOWZmMjM1M2RjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NzQ4LCJleHAiOjE3ODIyOTYxNDh9.FuJNp05vReUv3u3wFzvsf1ZdMaRuP-MJNNrTY6RiRR0)

 (application/x-xmind)    
