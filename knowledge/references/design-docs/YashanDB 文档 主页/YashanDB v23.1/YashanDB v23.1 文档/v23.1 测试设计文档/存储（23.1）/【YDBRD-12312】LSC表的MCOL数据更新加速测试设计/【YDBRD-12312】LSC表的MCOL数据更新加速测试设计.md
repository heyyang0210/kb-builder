Created by 卢凯舜, last modified on 十一月 14, 2023

# 1. 概述

对于列表，有一些语句只能通过行引擎执行，为了提高行引擎执行的效率，将执行的条件下推给存储，使用列式的过滤，提高过滤速度，减少内存拷贝以及函数调用此时，以此提升性能。

# 2. 需求分析

sr:    [YDBRD-12312](https://jira.yasdb.com/browse/YDBRD-12312?src=confmacro)    -  【2023.1】LSC表的MCOL数据更新加速  完成

开发设计文档    [【Spearfish】列表行执行条件下推 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119549922)  

限制点

  


1.   只能下推常量 

2.   对比列的规格，应与列条件下推保持一致 

3.   索引扫描不进行条件下推

放开了update/select(包括子查询的select)的条件的下推。

主要测试点：

1. 可以通过select.. for update 语句对比列存的执行计划，观察是否下推。
1. update 语句是否下推，性能是否有提升
1. 子查询内的条件是否下推，对比旧的行计划，和列的select 计划。


# 3. 测试设计方法 

部署形态 单机/分布式

数据类型

|  
|  
|  
|
|:---|:---|:---|
|数值|整型|TINYNIT|
|  
|  
|SMALLINT|
|  
|  
|INTEGER|
|  
|  
|BIGINT|
|  
|浮点型|float/double|
|  
|  
|number(s,d)    
  不同精度|
|  
|  
|decimal/decimal32/decimal64/decimal128|
|时间|  
|date/timestamp/time/interval year to month/interval day to second|
|枚举|  
|boolean|
|lob|  
|clob|
|  
|  
|blob|
|  
|  
|json|
|类型转换|  
|  
|


语法部分

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


测试场景

|序号|测试场景||预期|备注|
|:---:|:---:|---|:---:|:---:|
|  
|mcol order key|通过v$sysstat以及autotrace等方式观察MCOL执行方式|  
|  
|
|  
|  
|条件下推统计信息|  
|  
|
|  
|  
|条件用order key字段|  
|  
|
|  
|索引扫描不条件下推|  
|  
|  
|
|  
|hint 指定行引擎|索引|  
|  
|
|  
|多表更新场景|tac|  
|  
|
|  
|  
|lsc不支持|  
|  
|
|  
|  
|join on 列相互比较不下推|  
|  
|
|  
|绑定参数场景|jdbc绑定参数|  
|  
|
|  
|  
|匿名块绑定参数|  
|  
|
|  
|rownum|  
|  
|  
|
|  
|并发|多个并发update|  
|  
|
|  
|  
|多个并发select|  
|  
|
|  
|  
|select，delete，update并发|  
|  
|
|  
|HA|主机插入数据，备机update/select，查看是否下推|  
|  
|


# 4. 详细测试设计    

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|是|
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


  


# 5. 测试用例

# 6. 测试框架设计

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[LSC表的MCOL数据更新加速.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTVhMWFkOWEzMzExZGM3OTk0IiwicmVmX2lkIjoiNjczOTY5ZTU1OTNmOTljOWZmMjM1M2YyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5ODE3LCJleHAiOjE3ODIyOTYyMTd9.SpR8c41kh0-VFIpK8WvyOsZD1f0ZzqDSjDGHSa64LIU)

 (application/x-xmind)    
