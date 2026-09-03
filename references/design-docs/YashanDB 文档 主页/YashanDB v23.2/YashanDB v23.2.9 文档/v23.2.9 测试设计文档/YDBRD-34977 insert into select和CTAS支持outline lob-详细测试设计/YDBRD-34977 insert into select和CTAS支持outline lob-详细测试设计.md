Created by 胡晓畔, last modified on 十一月 14, 2024

  [https://pingcode.yasdb.com/ship/ideas/66c836ea89f961f3300fca85](https://pingcode.yasdb.com/ship/ideas/66c836ea89f961f3300fca85)    ?    
  #YASHAN-3154 insert into select和CTAS支持outline lob

  [https://pingcode.yasdb.com/pjm/items/6729bd99e489dd086803df2d](https://pingcode.yasdb.com/pjm/items/6729bd99e489dd086803df2d)    ?    
  #YDBRD-34977 insert into select和CTAS支持outline lob

# 1. 概述

本需求支持

1、insert into select支持outline lob    
  2、create table as 支持outline lob

# 2. 需求分析

## 2.1 功能点分析

支持insert into  [outline LOB列]   select  [outline LOB列]

支持create table  as select  [outline LOB列]

## 2.2 应用场景

客户场景SQL:

insert into ys_dev_p0175.ODS_ODS_DM_DEV_T_600 (ID,NAME) select ID,NAME from ys_dev_p0176.ODS_DM_DEV_T_60

create table ys_dev_p0175.ODS_ODS_DM_DEV_T_600 (ID,NAME) as select ID,NAME from ys_dev_p0176.ODS_DM_DEV_T_60

## 2.3 规格约束 

1.Outline lob包括Outline clob 和 Outline blob，不包括Json类型。

2.该特性不涉及函数规格的修改，即之前不支持Outline lob的函数，现在依然不支持。

3.master分支分布式支持heap表，heap表天然支持。

4.br23.2分支分布式不支持heap表，不需要关注heap表测试场景。

  


  


# 3. 详细测试设计

## 3.1 测试设计方法

## 3.2 详细测试设计

  


|测试场景|测试点|  
|预期|备注|  
|
|---|---|---|---|---|---|
|LOB类型|outline blob,outline clob,  
,  
,  
| 均需要覆盖所有测试点 |  
|当前SR不考虑32000以上的json |  
|
|outline LOB方式|1.disable storage in row,2.构造超过32000长度 |中文 英文  数字 特殊文字 符号等,非空 ,空|  
|blob确认构造方式|  
|
|insert into 和 select 的  **表**|source表和target表，表类型覆盖|LSC,TAC,duplicated,sharded,分区表,非分区表,二级分区,宽表>256,边界 4096（较慢，找存储谢锐确认瓶颈结论）,bulkload |  
|  
|  
|
|insert into 和 select 的  **类型**|数据类型|all type – LOB,LOB –  all type |  
|insert into clob select varchar/char 正常执行,insert into varchar/char  select  clob 报错 ,--暂不考虑类型转换|  
|
|insert all into ... ... select|  
|  
|  
|分布式暂不支持|  
|
| insert into / create table  as   ** **  **select子句**|select from view|  
|  
|  
|  
|
|  
|select from多表join|join 类型|  
|  
|  
|
|  
|select from多表集合|setop类型覆盖：intersect  intersect all,minus  minus  all,union   union all,混合组合|  
|  
|  
|
|  
|select from 集合+ join|  
|  
|  
|  
|
|  
|select 全部列，部分列，单列|LOB + 其他类型,都为LOB|  
|  
|  
|
|  
|select 返回单行，多行|  
|  
|  
|  
|
|  
|select 语句带where ，group by， order by, limit  |组合 outline LOB|  
|  
|  
|
|  
|select语句嵌套子查询|exists ， not exists,in， not in,any,  all ,between and,多表查询,多重嵌套,关联子查询,非关联子查询|  
|  
|  
|
|  
|select语句嵌套 函数|聚合，窗口，数学，字符,case when|  
|  
|  
|
|  
|select语句为复杂查询|  
|  
|  
|  
|
|create table as指定的table的的语法|创建带有约束的表|约束类型：,PRIMARY KEY,FOREIGN KEY --分布式不支持,UNIQUE,CHECK  --列表不支持,NOT NULL,  
|  
|  
|  
|
|  
|创建分区表|分布式只能创建二级分区|  
|  
|  
|
|  
|创建外部表|外部表不支持lob类型|  
|  
|  
|
|  
|临时表|分布式不支持|  
|  
|  
|
|  
|压缩表|  
|  
|  
|  
|
|  
|指定表的存储属性|例如：,CREATE TABLE my_table ( id NUMBER, data VARCHAR2(100) ) STORAGE ( INITIAL 1M NEXT 500K MINEXTENTS 1 MAXEXTENTS 50 );|  
|  
|  
|
|  
|create table if not exists|  
|  
|  
|  
|
|  
|建表指定表的编码|- PLAIN编码：即不编码，按原始方式存储数据。
- RLE编码：游程长度编码。
- DICTIONARY(PLAIN)：字典编码后的数据进行PLAIN编码。
- DICTIONARY(RLE)：字典编码后的数据进行RLE编码。
- BYTE-PACKED：根据数据字节长度编码。
|  
|  
|  
|
|  
|加密表|lob不支持|  
|  
|  
|
|  
|表类型|heap  --拦截,lsc,tac|  
|  
|  
|
|  
|创建时指定表空间|  
|  
|  
|  
|
|  
|指定表的属性|- PCTFREE：表示数据块为数据库对象进行UPDATE保留的空间百分比，当可用空间低于该百分比时无法进行INSERT，只能进行UPDATE。
- PCTUSED：表示数据块为数据库对象保留的最小已用空间百分比，当数据所占空间低于该百分比时可进行INSERT。
- INITRANS：表示每个数据块中初始并发事务项的数量。
- MAXTRANS：表示每个数据块中并发事务项数量的最大值。
- CREATE TABLE employee_info (    
  name CHAR(10) NOT NULL,    
  age INT,    
  id INT NOT NULL    
  )TABLESPACE users PCTFREE 50 PCTUSED 20 INITRANS 3 MAXTRANS 254 SEGMENT CREATION DEFERRED;
|  
|  
|  
|
|  
|nologging建表|分布式不支持|  
|  
|  
|
|  
|表注释|COMMENT ON TABLE ADS_RP.A_REG_RXREG_DPM_DLTPM IS|  
|  
|  
|
|  
|create view as |  
|  
|  
|  
|
|性能|select 32列，64列   LOB （行内，行外混合）,单列 outline LOB 多行|  
|  
|  
|  
|
|并发|testkill|  
|  
|  
|  
|


  


  


  


  


|系统级DFX分类|是否涉及|
|---|---|
|CT|√|
|KT|√|
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
|性能|√|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


  


# 5. 测试框架设计

Guider + yasft 

# 6. 测试环境说明

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  


## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMThhMWFkOWEzMzExZGM5NTE3IiwicmVmX2lkIjoiNjczOTZlMTg1OTNmOTljOWZmMjM4MWZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0MDExLCJleHAiOjE3ODI0MTA0MTF9.JuRKLXvkpN71jALQbMjxiSqU71nJGuLvJY-LumBrty8)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMThhMWFkOWEzMzExZGM5NTE4IiwicmVmX2lkIjoiNjczOTZlMTg1OTNmOTljOWZmMjM4MWZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0MDExLCJleHAiOjE3ODI0MTA0MTF9.NKMPvsPiTDGL_NofvmcmXSrMvUKw3fEgYkyYUldL0Y4)

 (application/msword)    
