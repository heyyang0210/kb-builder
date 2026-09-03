Created by 罗爽, last modified on 七月 11, 2024

# 1. 概述

本文描述分布式行表ddl的测试设计。

SR链接：    [https://pingcode.yasdb.com/pjm/items/664aeeef288e1978208e143b](https://pingcode.yasdb.com/pjm/items/664aeeef288e1978208e143b)    ?    
  #YDBRD-27370 开发任务： 分布式行表DDL支持

开发设计文档：    [分布式行表详细设计文档](153014456.html)  

行表ddl能力：    [分布式行表ddl能力](https://conf.yasdb.com/pages/viewpage.action?pageId=153000499)  

# 2. 需求分析

1）行表ddl测试范围：    [测试范围确认](https://conf.yasdb.com/pages/viewpage.action?pageId=156122150)  

表对象：create table、alter table、truncate table、drop table

行表关联对象：

- 索引 create/alter/drop index
- 视图 create/drop view
- 行收集统计信息
- comment on
- ac （不支持）
- 物化视图 （不支持）
- create table as （不支持）


2）测试点

- 语法覆盖
- ddl相关业务验证
- DFX （相应负责人单独拉工程跑）


# 3. 详细测试设计

#### 1）复制并改造分布式tac工程（dev分支）的用例

分布式现有列存ddl用例梳理：

|用例路径|测试点|补充说明|
|---|---|---|
|datatype|clob|  
|
|datatype_01|数据类型,- boolean
- char/varchar
- charWithoutLen
- date
- decimal
- double
- float126
- insert data
- interval
- number
- other（char、varchar、float、double、number）
- raw
- test_sdv_col（1024列，4096列）
- 科学计数法
- time
- timestamp
- varchar 32K
- blob
- json
|不支持rowid|
|DDL_01 ~ DDL03|- analyze
- create/drop ac
- create/alter/drop table
- create part table
- create/drop view
- create/alter/drop index
- force view
- subpartition_ddl
|  
|
|storage/compatible_syntax|- create index storage
- create table compress
- create table segment
- create table storage
- create table cache
|  
|
|storage/segment|segment相关语法|  
|
|storage_object/ac|ac partition相关语法|  
|


#### 2）根据开发提供的分布式行表SQL能力，将没有覆盖到的SQL从单机用例库中获取，修改并添加到分布式用例库

#### 3）梳理已有DDL SQL，确认是否有对应的业务验证，没有的补充相应用例并添加到分布式用例库

业务验证类型

|DDL|业务类型|  
|
|---|---|---|
|create table|1. create后增删改查
1. 数据量正确
1. 二级分区表插入数据到指定分区正确
|  
|
|alter table|1. alter后增删改查
1. 数据量正确
|  
|
|truncate table|1. truncate后查询
1. truncate后增删改查
|  
|
|create index|插入数据符合索引约束|  
|
|alter index|插入数据符合索引约束|  
|
|create view|1.查询视图数据正确,2.对表dml操作，视图数据跟随变化|  
|


# 4. 测试用例

# 5. 测试框架设计

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现。

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|分布式|


## Comments:

|  [](null)  ,行表ddl CI测试工程：    [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L2_dst_heap_ddl_yasft_copy_ls/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L2_dst_heap_ddl_yasft_copy_ls/)  ,Posted by luoshuang at 七月 10, 2024 14:45|
|---|
