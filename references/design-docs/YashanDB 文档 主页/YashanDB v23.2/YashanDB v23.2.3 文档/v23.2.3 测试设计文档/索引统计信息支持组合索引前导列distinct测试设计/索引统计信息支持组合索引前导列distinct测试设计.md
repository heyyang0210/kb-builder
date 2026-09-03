Created by 李攀, last modified on 六月 18, 2024

  


#   [1. 概述](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#1%E6%A6%82%E8%BF%B0)  

本文描述统计信息支持行级别采样测设设计

SR链接：  JIRA：    [[YDBRD-21458] 统计信息支持组合索引前导列的distinct - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21458)  

pincode:

开发设计文档：    [https://pingcode.yasdb.com/pjm/items/66263d10fd997db58adf0a42](https://pingcode.yasdb.com/pjm/items/66263d10fd997db58adf0a42)    ?    
  #YDBRD-26586 统计信息支持收集组合索引前导列的distinct(指定最大前导列数)

  


#   [2. 需求分析](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#2%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**2.1 功能点概述**

  


收集组合索引前导列的distinct是为了cbo的  INDEX SKIP SCAN（索引跳跃扫描）

INDEX SKIP SCAN是一种查询优化技术，  跳过组合索引的第一列，直接访问索引的第二列或更后面的列。这样即使在一次查询中没有使用组合索引的前导字段，该索引也可以通过INDEX SKIP SCAN被有效利用

这样可以提高查询效率，避免全表扫描，特别是当索引的第一列的distinct很低，而第二列或更后面的列distinct很高时。  INDEX SKIP SCAN的效率会随着前导列distinct值的递增而减少

只适用于B-tree索引（包括唯一索引和非唯一索引）

该需求将收集最多4列的组合索引前导列distinct统计信息

  


**2.2 应用场景**

场 景：    
  用于btree skip scan的计划选择，目前只提供了第一列的distinct    
    
  需求描述：    
  统计信息支持收集组合索引前导列的distinct(指定最大前导列数)    
    
  需求范围：    
  单机,  集群    


**2.3 需求分析**

1.系统表ind$新增3个字段存储4列前导列的distinc    


如果不增加字段，优化器无法获取前导列distinct

|  `CREATE TABLE IND$`      
    `(`      
    `    `      `DISTINCT_KEYS   BINARY_BIGINT, `      `//整体distinct`      
    `    `      `DISTINCT_FKEYS  BINARY_BIGINT, `      `//之前预留字段`      
    `    `      `DISTINCT_2KEYS  `      `//新增列`      
    `    `      `DISTINCT_3KEYS  `      `//新增列`      
    `    `      `DISTINCT_4KEYS  `      `//新增列`      
    `) SYSTEM 2 ORGANIZATION HEAP`      
    `/`  |
|:---|


2.视图 dba_ind_statistics

        all_ind_statistics   ,     user_ind_statistics

  


以上3个视图新增3个字段存储4列前导列的distinct

3.动态视图V$INDEX_STATISTICS_CACHE也增加这3个字段

4.  set_index_stats新增3个参数，用户可以手动设置前导列distinct，不能大于组合索引列数

# **3.详细测试设计**

## 3.1 测试设计方法

 对功能测试测设主要使用等价类划分的测设设计方法

  


## 3.2 详细测试设计

 3.2.1 详细功能用例测试点

  


|测试项|输入条件1（存储过程）|有效等价类|无效等价类|备注|  
|
|:---|:---|:---|:---|:---|:---|
|组合索引测试点|组合索引列数|2列（c1,c2）,|单列索引|预期：DISTINCT_KEYS BINARY_BIGINT ,DISTINCT_FKEYS BINARY_BIGINT,DISTINCT_2KEYS BINARY_BIGINT的值=DISTINCT_KEYS BINARY_BIGINT（整体distinct）,前导列3  4的值为0,  
|  
|
|  
|  
|3列（c1,c2,c3)|  
|整体distinct,1fkeys,2fkeys,3fkeys=整体,4fkeys=0|  
|
|  
|  
|4列|  
|4fkeys=整体distinct|  
|
|  
|  
|>=5列|  
|整体distinct,1fkeys,2fkeys,3fkeys,4fkeys|  
|
|  
|组合索类型（覆盖2-5列）|唯一索引,复合主键索引,复合唯一键索引,ac， lsc  分布式tac，lsc也是b-tree|非btree索引：列式索引，,  
|  
|  
|
|  
|  
|非唯一索引（普通索引）|  
|  
|  
|
|  
|  
|分区表组合索引非local,分区表local组合索引|  
|  
|  
|
|  
|  
|组合函数索引，覆盖desc，asc,  
|  
|  
|  
|
|  
|  
|反向索引 reverse|  
|  
|  
|
|  
|组合索引列的数据类型组合|创建5列组合索引，不同数据类组合，收集统计信息|  
|  
|  
|
|  
|收集统计信息的方式|通过收集指定索引的统计信息|  
|  
|  
|
|  
|  
|通过收集表的统计信息收集一并收集索引的,通过收集表的统计信息只收集索引列|  
|  
|  
|
|  
|  
|通过收集schema的统计信息|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|
|  
|  
|通过收集database的统计信息|  
|  
|  
|
|设置索引统计信息|入参测试  dist2keys ,dist3keys,dist4keys三个参数的值设置|数字类型常量 ：>=0正整数,字符串常量 ：>=0正整数,bigint边界值  9223372036854775807,数字变量：int，tinyint，smallint，bigint，number,字符串变量：,varchar，char，varchar2,clob|  
|int类型常量<0整数,false/true常量,大于bigint最大值：  9223372036854775808,数字变量：float,double,其他类型变量：time，date，timestamp，interval，blob,boolean,null,空串|  
|
|  
|设置索引统计信息规格验证|前导列distinct列数大于组合索引实际列数，大于实际列数的部分设置为0|实际2列，设置第三列不为0，报错|  
|  
|
|  
|  
|  
|设置为null|  
|  
|
|  
|  
|  
|实际3列，设置第4列不为0，报错|  
|  
|
|  
|  
|  
|实际<=n列，设置第n列！=整体列 distinct,n=2,3,4,报错?|  
|  
|
|  
|  
|组合索引列数大于4时，前1列distinct <=前2列distinct <= 前3列distinct <=前4列distinct<=组合索引整体distinct,  
|不满足规格：组合索引列数大于4时，前1列distinct <=前2列distinct <= 前3列distinct <=前4列distinct<=组合索引整体distinct,如key1=100 key2=50(key1>key2),key=100 key2=100 key3=99(key2>key3),key1=100,key2=200，key3=300,key4=200(key3>key4)|目前不对其他规则做检验，如  NUM_ROWS  的关系|  
|
|  
|设置索引的类型|对gather 的组合索引类型进行设置时再覆盖一遍|  
|  
|  
|
|统计信息视图验证|dba_ind_statistics|收集和设置后查询新增列的统计信息,desc查看|  
|  
|  
|
|  
|all_ind_statistics|  
|  
|  
|  
|
|  
|use_ind_statistics|  
|  
|  
|  
|
|  
|动态视图V$INDEX_STATISTICS_CACHE|desc查看,收集过程中和收集索引统计信息后查询动态视图|  
|  
|  
|
|性能|在数据量较大时比较和只收集1列distinct值时候的性能差距|  
|  
|  
|  
|
|  
|执行计划|index on (c1, c2, c3). 过滤filter为c2 = 5,  
,skip scan的cost与skip列的distinct值数目成正比，所以在skip列distinct值较多时，也可能不会选择skip scan|  
|目前还不支持前4列生成index skip scan扫描,目前  多列复合索引，只支持前置列不存在时选择skip scan。|  
|
|  
|  
|收集前导列统计信息后执行select和explain |  
|  
|  
|
|  
|设置为hash算法估算distinct值|  
|  
|待行采样SR合并后|  
|


  


3.2.2 dfx功能涉及情况说明

  


|测试项|是否涉及|测试点|
|:---|:---|:---|
|CT/KT|是|  
|
|长稳|-|  
|
|一致性|-|  
|
|安全|是|  
|
|HA|是|  
|
|压力|-|  
|
|性能|是|  
|
|资料|是|  
|


  


  


  


# 4. 测试用例

[索引统计信息支持组合索引前导列distinct.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjhhMWFkOWEzMzExZGM4ZjI0IiwicmVmX2lkIjoiNjczOTZkMjg3MjgyMDZlZmI5MmYxYmNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MjgzLCJleHAiOjE3ODIzOTI2ODN9.S1PLUWc88jXXJnwPx5ZILnayDJPwkfAaliwWRw_ORN8)

  


# 5. 测试框架设计

- 采用guider测试框架进行用例自动化


# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机，集群|


# 7. 工作量评估

工作量：1.5  *人/周*

计划测试完成时间：2024/5/17

  


  


会议纪要：

升级测试，测试升级后之前的统计信息是否正常

  


与会人员：李攀、马文英、李燕琼、郑翌凯，陈伟旭

会议时间 ：2024/5/6

## Attachments:

[索引统计信息支持组合索引前导列distinct.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjhhMWFkOWEzMzExZGM4ZjI0IiwicmVmX2lkIjoiNjczOTZkMjg3MjgyMDZlZmI5MmYxYmNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MjgzLCJleHAiOjE3ODIzOTI2ODN9.S1PLUWc88jXXJnwPx5ZILnayDJPwkfAaliwWRw_ORN8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
