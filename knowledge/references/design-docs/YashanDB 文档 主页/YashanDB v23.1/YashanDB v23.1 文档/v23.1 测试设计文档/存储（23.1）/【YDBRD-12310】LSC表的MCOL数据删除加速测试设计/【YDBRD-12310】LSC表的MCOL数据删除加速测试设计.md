Created by 卢凯舜, last modified on 十一月 14, 2023

# 1. 概述

将过滤条件下推给存储，存储根据过滤条件来执行过滤，直接得到符合条件的数据。

条件下推的意义：将过滤条件下推给存储，存储根据过滤条件来执行过滤，直接得到符合条件的数据。

        以前是没有条件下推到存储的，执行一条语句“delete * from t1 where col1 > 3;”

是由存储提供col1这一列的所有数据给执行（Table Full Scan），然后执行将col1这一列的数据根据过滤条件（> 3）逐条过滤，最终得到符合条件的所有数据。

        能够实现条件下推到存储，则执行上述sql语句，

存储根据过滤条件直接将数据进行过滤，将符合条件的数据返回给执行。

# 2. 需求分析

SR：         [YDBRD-11970](https://jira.yasdb.com/browse/YDBRD-11970?src=confmacro)    -  LSC表行执行条件下推  完成

开发设计：    [YDBRD-12310 : LSC Delete  Conditional Push Design（LSC表的delete条件下推（单机和分布式都要支持）） - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=113968847)  

条件下推的环境：单机+分布式

限制：

1.不支持多表delete    
  2.不支持指定slice删除    
  3.分布式暂不支持delete带子查询    
  4.dml其他操作下推，update下推不在此转测范围

5.只下推常量

# 3. 测试设计方法 

测试设计主要采用等价类、场景法及错误推测法进行设计

部署形态 单机/分布式

数据类型

|  
|  
|  
|
|---|---|---|
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

自动化用例添加到YAT框架

# 7. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


  


  


## Attachments:

[LSC表的MCOL数据删除加速.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTVhMWFkOWEzMzExZGM3OTkzIiwicmVmX2lkIjoiNjczOTY5ZTU3MjgyMDZlZmI5MmVmOGJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5ODI4LCJleHAiOjE3ODIyOTYyMjh9.0JKn1DpelCfJ0cRDXAy6BhgElgCWFaNaKfFleOQAjCs)

 (application/x-xmind)    
