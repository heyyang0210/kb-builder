Created by 易文亮 on 六月 02, 2023

# **1. 概述**

本文描述LSC表冷数据支持删除测试设计的测试设计

# **2. 需求分析**

SR：        [YDBRD-11784](https://jira.yasdb.com/browse/YDBRD-11784?src=confmacro)    -  【2023.1】LSC表的SCOL数据支持更新  完成

开发设计：    [https://conf.yasdb.com/pages/viewpage.action?pageId=112723682](https://conf.yasdb.com/pages/viewpage.action?pageId=112723682)  

update支持条件下推

update后AC失效，需重新生成，事务验证，动静态数据增删查改，update后触发合并等

核心逻辑：将冷数据中的行删除，并将更新后的行插入到热数据中，系统表  SCOL_DELETE_BITMAP$

限制：

 1、不支持多表  update   

2  、未打开row movement不允许更新，默认打开

3  、不支持指定slice更新

4  、LSC表不支持跨分区更新

   5  、lsc表不支持更新lob

6  、分布式暂不支持dupdate带子查询

# **3. 测试**  **设计方法**   

测试设计主要采用等价类、场景法及错误推测法进行设计

测试考察delete语句的基本语法，测试观察点：

1、update基本语法支持范围

2、update的是否正确删除表中符合条件的行

3、不正确的update语法报错信息是否正确

4、除限制外，update要无感删除，不分静态动态数据

# 4.   **详细测试设计**

4.1 基本语法

|update语句部分|有效等价类|编号|无效等价类|编号|备注|
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
||~~interval分区~~|  
|  
|  
|建表不支持|
|t_alias|表别名|  
|  
|  
|  
|
|table_expression_clause|table|  
|无效表名|  
|  
|
|update_set_clause|列数：单列|  
|对列加括号 set (c1)=|  
|  
|
|  
|列数：多列|  
|对列加括号set (c1,c2)=|  
|  
|
|  
|  
|  
|列表达式c1+c2=|  
|  
|
|  
|赋值：常量|  
|  
|  
|  
|
|  
|赋值：default/null|  
|  
|  
|  
|
|  
|赋值：表达式   set c1=c1+1|  
|  
|  
|  
|
|  
|赋值：子查询  set c1=(subquery)|  
|返回多个值|  
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
    
  update行数    
    
    
    
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

1、lob列做filter进行update

2、多表update

3、update带子查询

4、update 1条/多条数据，数据在1个slice/多个slice

5、update触发数据合并，delete触发AC失效并重新生成

6、update结合事务验证，delete后commit/rollback

  


# 5.   **测试用例**

[LSC支持静态数据update(ydbrd11784).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTM4OTcwYzJhZjRmNTFmYjE4IiwicmVmX2lkIjoiNjczOTY5ZTI1OTNmOTljOWZmMjM1M2Q4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NzA0LCJleHAiOjE3ODIyOTYxMDR9.I39n9SfI4QVKJUApYhpdnDShUyqWM0__ABBiMFMnIhQ)

# 6.   **测试框架设计**

自动化用例添加到YAT框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机+分布式+HA|


## Attachments:

[LSC支持scol数据删改能力(ydbrd11785).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTM4OTcwYzJhZjRmNTFmYjE5IiwicmVmX2lkIjoiNjczOTY5ZTI1OTNmOTljOWZmMjM1M2Q4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NzA0LCJleHAiOjE3ODIyOTYxMDR9.rXp2oPGTS1khPiJofmS03awNN1fBATxj5tL0T52QQ0Q)

 (application/x-xmind)    


[LSC支持静态数据update(ydbrd11784).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTM4OTcwYzJhZjRmNTFmYjE4IiwicmVmX2lkIjoiNjczOTY5ZTI1OTNmOTljOWZmMjM1M2Q4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NzA0LCJleHAiOjE3ODIyOTYxMDR9.I39n9SfI4QVKJUApYhpdnDShUyqWM0__ABBiMFMnIhQ)

 (application/x-xmind)    
