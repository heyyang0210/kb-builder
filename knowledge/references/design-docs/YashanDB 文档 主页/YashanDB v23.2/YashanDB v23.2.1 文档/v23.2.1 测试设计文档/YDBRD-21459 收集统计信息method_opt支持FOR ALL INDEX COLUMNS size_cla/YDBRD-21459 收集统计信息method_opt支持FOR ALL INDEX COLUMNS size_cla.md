Created by 李攀, last modified on 十二月 18, 2023

#   [1. 概述](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#1%E6%A6%82%E8%BF%B0)  

本文描述收集统计信息method_opt支持FOR ALL INDEX COLUMNS size_clause项功能的测试设计

SR链接：    [[YDBRD-21459] 收集统计信息method_opt支持FOR ALL INDEX COLUMNS size_clause项功能 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21459)  

开发设计文档：    [收集统计信息method_opt支持FOR ALL INDEX COLUMNS size_clause项功能 - 郑翌恺 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=138558789)  

  


#   [2. 需求分析](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#2%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**2.1 功能点分析**

 1.   收集统计信息method_opt选项增加FOR ALL INDEX COLUMNS size_clause项功能，功能为在收集表的统计信息时只收集索引列的统计信息，非索引列的统计信息不收集

  2. 涉及到的函数：支持  GATHER_TABLE_STATS，GATHER_SCHEMA_STATS，GATHER_DATABASE_STATS在设置  METHOD_OPT 选项值的时候新增   FOR ALL     **INDEXED**     COLUMNS [size_clause]选项：

  3. 支持：SET_TABLE_PREFS、SET_SCHEMA_PREFS、SET_DATABASE_PREFS、SET_GLOBAL_PREFS设置FOR ALL     **[INDEXED] **  COLUMNS [size_clause]。

  4. 接口：  加粗为新增选项

|选项名|含义|default|
|:---|:---|:---|
|METHOD_OPT|统计信息收集选项    
  1. FOR ALL     **[INDEXED]**     COLUMNS [size_clause]：收集所有列/索引列的统计信息    
  2. FOR COLUMNS [column_clause] [size_clause]：收集指定列的统计信息    
  column_clause：(col1,col2,col3)    
  size_clause：SIZE {integer | AUTO}用于指定直方图信息    
  1. integer：直方图的bucket数量，范围为[1, 2048]    
  2. AUTO：由数据库决定是否生成直方图    
  SET_SCHEMA_PREFS、SET_DATABASE_PREFS、SET_GLOBAL_PREFS只能设置FOR ALL     **[INDEXED] **  COLUMNS [size_clause]。|FOR ALL COLUMNS SIZE AUTO|


  


**2.2 应用场景**

场 景：    
  支持只收集带索引列的字段信息和索引信息，减少过多收集无用统计信息，及减少收集统计对资源的消耗    
    
  需求描述：    
  收集统计信息method_opt支持FOR ALL INDEX COLUMNS size_clause项功能，即支持只收集带索引列的字段信息和索引信息    
    
  需求范围：    
  单机和集群

**2.3 规格约束**

1.GATHER_TABLE_STATS    
  2.GATHER_SCHEMA_STATS    
  3.GATHER_DATABASE_STATS

4.SET_SCHEMA_PREFS、SET_DATABASE_PREFS、SET_GLOBAL_PREFS,SET_TABLE_PREFS设置FOR ALL     **[INDEXED] **  COLUMNS [size_clause]

# **3.详细测试设计**

## 3.1 测试设计方法

 对  FOR ALL     **[INDEXED] **  COLUMNS [size_clause]。接口入参测试采用等价类划分的方法进行用例设计

 对取值采用等价类和边界值：如interge类型的边界值取值和直方图数量的边界值：如1024

 对应用场景采用 场景组合法进行用例设计：覆盖统计信息组合，设置流程，收集，权限，执行计划等各种场景

## 3.2 详细测试设计

 3.2.1 详细功能用例测试点

  


|测试项|输入条件1（存储过程）|有效等价类|无效等价类|备注|  
|
|:---|:---|:---|:---|:---|:---|
|method_opt 入参测试|GATHER_TABLE_STATS|大小写：FOR ALL INDEX COLUMNS SIZE AUTO,FOR ALL index COLUMNS SIZE 10,for all index columns size 1024|拼写错误,FOR ALL INDEXs COLUMNS SIZE AUTO,  
|  
|  
|
|  
|  
| [size_clause],FOR ALL INDEX COLUMNS SIZE AUTO|  
|  
|  
|
|  
|  
|1-2048的int|>2048 : 2049|报错拦截|  
|
|  
|  
|  
|非int类型数字：,1.2  -1.1|报错拦截|  
|
|  
|  
|  
|<1 数字  ：0，-1，-2048|报错拦截|  
|
|  
|  
|  
|非number类型常量，,其他类型变量：time，date，timestamp，interval，blob,boolean|报错拦截|  
|
|  
|GATHER_SCHEMA_STATS|和上面一样|  
|  
|  
|
|  
|GATHER_DATABASE_STATS|和上面一样|  
|  
|  
|
|  
|SET_SCHEMA_PREFS|和上面一样|  
|  
|  
|
|  
|SET_DATABASE_PREFS|和上面一样|  
|  
|  
|
|  
|SET_GLOBAL_PREFS|和上面一样|  
|  
|  
|
|  
|SET_TABLE_PREFS|和上面一样|  
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
|表类型|  
|heap,,tac,,lsc|  
|  
|  
|
|索引类型覆盖|  
|单列索引|  
|  
|  
|
|  
|  
|复合索引（c1,c2,c3）|  
|  
|  
|
|直方图类型覆盖|  
|none,等高,混合,频率,top-n|  
|  
|  
|
|部署形态|  
|单机,集群|  
|  
|  
|
|列式索引|  
|  
|  
|  
|  
|
|空间索引？|  
|  
|  
|不支持|  
|


3.2.2 关键场景覆盖

|测试项|测试步骤|预期|备注|
|:---|:---|:---|:---|
|单列索引|1.创建一张基础表create table t1(c1 int ,c2, int ,c3 int ),2.创建单列普通索引,3.  GATHER_TABLE_STAT ，  method_opt参数设置为FOR ALL INDEX COLUMNS SIZE AUTO,4.  查看  dba_tab_statistics、dba_ind_statistics、,dba_tab_col_statistics、,dba_part_col_statistcs,dba_HISTOGRAMS视图,5.explain 语句查看计划重索引使用的统计信息是否准确,  
|4.表的统计信息正常收集，索引的统计信息正常收集，列的统计信息中只有索引列的统计信息，和索引列直方图的统计信息，其他信息没有,  
|  
|
|复合索引|1 create table t1(c1 int ,c2, int ,c3 int,c4 int )；,2 create index id1 on t1(c1,c2,c3),3.  GATHER_TABLE_STAT ，  method_opt参数设置为FOR ALL INDEX COLUMNS SIZE AUTO,4.  查看  dba_tab_statistics、dba_ind_statistics、,dba_tab_col_statistics、,dba_part_col_statistcs,dba_HISTOGRAMS视图,5.explain 语句查看计划重索引使用的统计信息是否准确|4.表的统计信息正常收集，索引的统计信息正常收集，列的统计信息中被索引的列的统计信息，和直方图统计信息正常收集，没有在组合索引列里的列统计信息不会被收集 |  
|
|函数索引|  
,create index id1 on t1(c1+1),create index id1 on t1(a+b,c1),  
|索引的统计信息被收集，c1列的统计信息不被收集？,组合索引里面的普通列会不会收集？|f|
|分区表分区索引|create table t1(c1 int ,c2, int ,c3 int,c4 int) parttion(....)；,2 create index id1 on t1(c1) local ..|表和分区的统计信息正常收集,索引和分区的统计信息正常收集,没有索引的列的统计信息不会收集|  
|
|指定分区收集统计信息|create table t1(c1 int ,c2, int ,c3 int,c4 int) parttion(....)；,2 create index id1 on t1(c1) local ..|只有指定的分区统计信息被收集,指定分区的索引统计信息被收集，不指定的分区不会被收集,索引列外其他列以及直方图不会被收集|  
|
|唯一索引,主键约束索引|  
|  
|  
|
|反向索引 |  
|  
|  
|
|索引属性：  usable unusable|  
|  
|  
|
|多个索引，单表多个索引，覆盖每个数据类型|  
|  
|  
|
|tac,lsc索引|  
|  
|  
|
|gahter schema方式|创建tac,lsc ,heap 分区表，各种索引对象，各插入1000条数据,gather_schema_stats 选择只收集索引列的列统计信息|只有指定的分区统计信息被收集,指定分区的索引统计信息被收集，不指定的分区不会被收集,索引列外其他列以及直方图不会被收集|  
|
|gahter database方式|创建多个用户，每个用户都创建  tac,lsc ,heap 分区表，各种索引对象，各插入1000条数据,gather_database_stats 选择只收集索引列的列统计信息|只有指定的分区统计信息被收集,指定分区的索引统计信息被收集，不指定的分区不会被收集,索引列外其他列以及直方图不会被收集|  
|
|SET_TABLE_PREFS设置为只收集索引列后验证|1.创建一张基础表create table t1(c1 int ,c2, int ,c3 int ),2.创建单列普通索引,3.SET  _TABLE_PREFA ，  method_opt参数设置为FOR ALL INDEX COLUMNS SIZE AUTO,4.gather_table_stats 收集t1表统计信息，method_opt参数不填写，或者写null,4.  查看  dba_tab_statistics、dba_ind_statistics、,dba_tab_col_statistics、,dba_part_col_statistcs,dba_HISTOGRAMS视图,5.explain 语句查看计划中索引使用的统计信息是否准确|4.表的统计信息正常收集，索引的统计信息正常收集，列的统计信息中只有索引列的统计信息，和索引列直方图的统计信息，其他信息没有,  
|  
|
|SET_SCHEMA_PREFS生效验证（已有表和后建的表）|设置SCHEMA prefs中  method_opt参数为FOR ALL INDEX COLUMNS SIZE AUTO,收集表的统计信息，忽略  method_opt参数,收集schema的统计信息，忽略method_opt参数,收集database的统计信息，忽略method_opt参数|表的统计信息正常收集，索引的统计信息正常收集，列的统计信息中只有索引列的统计信息，和索引列直方图的统计信息，其他信息没有|  
|
|SET__DATABASE_PREFS（已有表和后建的表|设置DATABASE prefs中  method_opt参数为FOR ALL INDEX COLUMNS SIZE AUTO,收集表的统计信息，忽略  method_opt参数,收集schema的统计信息，忽略method_opt参数,收集database的统计信息，忽略method_opt参数|表的统计信息正常收集，索引的统计信息正常收集，列的统计信息中只有索引列的统计信息，和索引列直方图的统计信息，其他信息没有|  
|
|SET_GLOBAL_PREFS生效验证  （已有表和后建的表，后建立的表也会被影响）|只设置GLOBAL prefs中  method_opt参数为FOR ALL INDEX COLUMNS SIZE AUTO,收集表的统计信息，忽略  method_opt参数,收集schema的统计信息，忽略method_opt参数,收集database的统计信息，忽略method_opt参数|表的统计信息正常收集，索引的统计信息正常收集，列的统计信息中只有索引列的统计信息，和索引列直方图的统计信息，其他信息没有|  
|
|  
|  
|  
|  
|


3.2.2 dfx功能涉及情况说明

  


|测试项|是否涉及|测试点|
|---|---|---|
|CT|是|DDL并发，和收集用例CT并发|
|长稳|-|  
|
|一致性|-|  
|
|安全|是|  
|
|HA|是，选项是否同步到备机|  
|
|压力|-|  
|
|性能|是|  
|
|资料|是|  
|


  


# 4. 测试用例

[收集表时支持只收集索引列统计信息选项.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWRhMWFkOWEzMzExZGM4NDNmIiwicmVmX2lkIjoiNjczOTZiOWQ3MjgyMDZlZmI5MmYwODMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODU4LCJleHAiOjE3ODIzODIyNTh9.U3flwN5FHGHF_ZAajjimfO5nlswwHN6v5_xD8nhjrrM)

  


# 5. 测试框架设计

- 采用guider测试框架进行用例自动化


# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机，集群|


# 7. 工作量评估

工作量：5  *人天*

计划测试完成时间：2023/12/25

  


  


会议纪要：

与会人员：郑凯翌、李攀、马文英、李燕琼、曾昭翰、张锐

会议时间 ：2023/12/18，线上腾讯会议

函数索引不支持，规格需要对齐

列式索引  空间索引不支持

增加DDL 并行，收集database统计信息的时候表删掉，看下是否会卡住

增加HA测试点，选项是否同步到备机

## Attachments:

[收集表时支持只收集索引列统计信息选项.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWRhMWFkOWEzMzExZGM4NDNmIiwicmVmX2lkIjoiNjczOTZiOWQ3MjgyMDZlZmI5MmYwODMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODU4LCJleHAiOjE3ODIzODIyNTh9.U3flwN5FHGHF_ZAajjimfO5nlswwHN6v5_xD8nhjrrM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
