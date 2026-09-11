Created by 陈瑞, last modified on 十二月 15, 2023

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=130148776#1-overview%E6%A6%82%E8%BF%B0)  

LSC需要支持本地索引，支持DN扩缩容时，索引随数据一起迁移

  [[YDBRD-21506] 【2023.2】分布式LSC表支持本地索引 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21506)  

  [[YDBRD-23941] 【2023.1】分布式LSC表支持本地索引 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-23941?filter=-1)  

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=130148776#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. LSC支持Create index语法
1. LSC支持Alter index语法
1. LSC支持Drop index语法
1. LSC表支持使用USING INDEX语法为唯一键指定本地索引，指定形式包括行内（inline_constraint）和行外（out_of_line_constraint）两种方式指定
1. 允许KEEP INDEX语法


## 3    [. ](https://conf.yasdb.com/pages/viewpage.action?pageId=130148776#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)    需求分析

lsc单机/复制表的unique(local+全局)    
  lsc分布表的unique(local)

  


1、索引类型

|部署|表类型|支持 Local 和 GLOBAL|  
|  
|
|---|---|---|---|---|
|单机|分区表|Global|  
|（转测文档中体现）|
|  
|  
|Local|  
|  
|
|  
|非分区表|Global|  
|（转测文档中体现）|
|分布式|分布表（TAC和LSC）|Local|  
|TAC之前支持GLOBAL，转测后拦截|
|  
|复制表 -分区表|Global|  
|  
|
|  
|  
|Local|  
|  
|
|  
|复制表 -非分区表|Global|  
|  
|
|  
|  
|local（不支持）|  
|  
|


2、LSC表支持使用USING INDEX语法为唯一键/主键 指定本地索引

create table + alter table

行内 + 行外

constraint xxx  【using index】 创建本地索引行为跟单机有区别，分布式分布表默认行为是创建LOCAL索引，单机无限制

  


### 3    [.1 Create index](https://conf.yasdb.com/pages/viewpage.action?pageId=130148776#51-create-index)  

支持Create Index语法，规格约束包括：

- 支持唯一索引、分区索引（本地索引，包含一级分区、二级分区场景），不支持创建RTREE索引、列式索引、非唯一索引、函数索引、反向索引
- 允许VISIBLE/INVISIBLE
- 允许USABLE/UNUSABLE
- 允许并行创建索引
- 允许COMPRESS/NOCOMPRESS
- 单机允许LOGGING/NOLOGGING，分布式不允许NOLOGGING
- 允许readonly、inmemory字句
- 不允许ONLINE
- 分布式下不允许分区表建Global索引


### 3    [.2 Alter index](https://conf.yasdb.com/pages/viewpage.action?pageId=130148776#52-alter-index)  

支持Alter Index语法，规格约束包括：

- 修改VISIBLE、INITRANS、USABLE、PARALLEL、LOGGING属性
- 支持COALESCE操作
- 支持REBUILD操作，但是不允许REBUILD ONLINE
- 支持modify_partition
- 支持modify_subpartition


### 3    [.3 Drop index](https://conf.yasdb.com/pages/viewpage.action?pageId=130148776#53-drop-index)  

能力与行表/TAC表保持一致

### 3    [.4 使用USING INDEX语法](https://conf.yasdb.com/pages/viewpage.action?pageId=130148776#54-%E4%BD%BF%E7%94%A8using-index%E8%AF%AD%E6%B3%95)  

USING INDEX语法在CREATE TABLE和ALTER TABLE中都可以使用，能力与行表/TAC表保持一致

添加/删除唯一性约束的语法与行表/TAC表保持一致。

### 3    [.5 Alter table modify constraint](https://conf.yasdb.com/pages/viewpage.action?pageId=130148776#55-alter-table-modify-constraint)  

- 允许KEEP INDEX语法


### 3    [.6 分布式处理](https://conf.yasdb.com/pages/viewpage.action?pageId=130148776#56-%E5%88%86%E5%B8%83%E5%BC%8F%E5%A4%84%E7%90%86)  

- 未使用USING INDEX语法时，
    - 分布表创建唯一索引/约束应该默认是本地（LOCAL）的，
    - 复制表行为与单机保持一致
- 使用USING INDEX语法时，
    - 分布表不允许USING INDEX创建Global索引
    - 复制表行为与单机保持一致
- 分布式不允许NOLOGGING
- 升级后的扩缩容场景：
    - 存量DN全局索引场景还是报错
    - 后续新建本地索引
- 扩缩容处理：
    - 验证带本地索引的扩缩容场景


  


# 4.   **测试设计方法**

测试设计主要采用等价类和场景测试法进行设计   

  


# **5. 详细测试设计**   

|输入条件|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|
|LSC表类型|分布式：复制表（普通表+分区表）/分布表,单机：普通表+分区表|指定分布键不是  唯一约束键的子集|  
|
|分区|一级分区：hash,range,list,interval，无分区（分布表一级分区只有hash）,二级分区：hash,range,list 三种组合。共九种（分布表一级分区只有hash，共三种）|  
|  
|
|  
|LSC 排序键 和 索引列 组合|  
|  
|
|数据类型|字符型（char、varchar）|raw|覆盖所有index支持的数据类型|
|  
|整数类型(tinyint、smallint、int、bigint)|  
||
|  
|浮点型（float、double、number）|  
||
|  
|  
|文本类型（  ~~clob~~  、  ~~blob~~  ）||
|  
|日期类型  （time、timestamp、date、interval ）|  
||
|  
|枚举（  bool、  ~~bit~~  ）|bit||
|索引列|分区键为索引列的子集（local 索引/单机全局索引）|不存在的列|  
|
|  
|分区键 = 索引列（local 索引/单机全局索引）|不包含分区键|  
|
|  
|分区键为索引交集（单机全局索引/复制表的全局索引）|  
|  
|
|  
|分布键为索引交集的子集（local 索引）|  
|  
|
|  
|分布键 = 索引列（local 索引）|不包含分步键|  
|
|  
|表上所有列|  
|  
|
|  
|1个唯一索引|  
|  
|
|  
|多个唯一索引|  
|  
|
|索引类型|全局唯一索引（单机非分区表+复制表）|非唯一索引|  
|
|  
|local索引（单机非分区表+分区表/分布式复制表+分区表）|分布式全局索引(TCA/LSC)|  
|
|数据检验|先插入数据，后建索引,  >>存在冷数据（删除/更新部分数据）,  >>存在热数据,  >>冷热数据都存在,  >>存在slice compact后的数据|  
|  
|
|  
|先见索引，后插入数据中,  >>存在冷数据（删除/更新部分数据）,  >>存在热数据,  >>冷热数据都存在,  >>存在sclice compact后的数据|  
|  
|
|  
|验证唯一性|插入重复数据|  
|
|  
|插入null值|  
|  
|
|CREATE INDEX 语法|UNIQUE|不带报错|  
|
|  
|  
|COLUMNAR|  
|
|  
|  
|RTREE|  
|
|  
|schema.|  
|简单覆盖权限|
|  
|  
|column_expression 函数索引拦截|  
|
|  
|DESC/ASC,支持一列同时创建DESC和ASC索引|  
|  
|
|index_attr_clause|TABLESPACE DEFAULT/tablespace_name,覆盖表空间|  
|  
|
|  
|INITRANS|  
|  
|
|  
|PCTFREE|  
|  
|
|  
|storage_clause:语法兼容,STORAGE(INITIAL 63K MAXSIZE 10M NEXT 12k MINEXTENTS 1 MAXEXTENTS 10 PCTINCREASE 0 FREELISTS 10)|  
|  
|
|  
|VISIBLE/INVISIBLE,INVISIBLE(优化器不选择)（回表的查询不选择）|  
|  
|
|  
|USABLE/UNUSABLE,UNUSABLE(优化器不选择)|  
|  
|
|  
|PARALLEL/NOPARALLEL|  
|  
|
|  
|NOCOMPRESS/COMPRESS|  
|  
|
|  
|LOGGING,和表保持一致。|NOLOGGING|  
|
|  
|NOREVERSE|REVERSE|  
|
|  
|readonly_clause：READONLY/READWRITE 语法兼容|  
|  
|
|  
|inmemory_clause：NO INMEMORY/INMEMORY|  
|  
|
|  
|local_index_clause|  
|  
|
|local_index_clause|LOCAL STORE IN (tablespace_name)|  
|  
|
|  
|LOCAL index_partition_clause (PARTITION partition_name index_partition_attr_clause，PARTITION partition_name index_partition_attr_clause)|指定的索引分区数和表分区不一致|  
|
|  
|index_partition_attr_clause,1、TABLESPACE tablespace_name/DEFAULT,2、INITRANS,3、PCTFREE,4、USABLE/UNUSABLE,5、空（默认索引分区所在表空间跟随表分区）|  
|  
|
|  
|index_comp_partition_clause 二级分区支持,(SUBPARTITION partition_name ，SUBPARTITION partition_name )|指定的索引分区数和表分区不一致|  
|
|  
|SUBPARTITION partition_name + ,1、TABLESPACE tablespace_name/DEFAULT,2、USABLE/UNUSABLE,3、空（默认索引分区所在表空间跟随表分区）|  
|  
|
|ALTER INDEX|带或者不带schema.|  
|  
|
|  
|INITRANS|  
|  
|
|  
|VISIBLE/INVISIBLE,INVISIBLE(优化器不选择)|  
|  
|
|  
|USABLE/UNUSABLE,索引失效但是仍然验证数据唯一性，且不被优化器选择|  
|  
|
|  
|COALESCE|  
|  
|
|  
|PARALLEL/NOPARALLEL|  
|  
|
|  
|LOGGING,（和表保持一致）|NOLOGGING|  
|
|modify partition|MODIFY PARTITION partition_name：,INITRANS,UNUSABLE,COALESCE|  
|  
|
|modify_subpartition|MODIFY SUBPARTITION subpartition_name：    
  UNUSABLE    
  COALESCE|  
|  
|
|rebuild_clause    
    
|REBUILD PARTITION/SUBPARTITION ：    
  1、TABLESPACE    
  2、INITRANS    
  3、PCTFREE    
  4、NOCOMPRESS/COMPRESS    
  5、LOGGING    
  6、PARALLEL/NOPARALLEL|ONLINE,NOLOGGING不支持|  
|
|  
|REBUILD NOREVERSE|REVERSE|  
|
|DROP INDEX 语法|schema.,带或者不带|当前schema下有索引，指定其他schema.index|简单覆盖权限|
|  
|删除表后删除索引|  
|  
|
|  
|删除表空间同步删除索引|  
|  
|
|  
    
    
    
    
  其他形式的删除索引|alter table xx drop constraint xxx + keep index ,1、创建约束前已存在索引，删除约束时不删除索引,2、创建约束前不存在索引，删除约束时不删除索引|  
|  
|
||alter table xx drop constraint xxx + drop index ,1、创建约束前已存在索引，删除约束时删除索引,2、创建约束前不存在索引，删除约束时删除索引|  
|  
|
||alter table xx drop constraint xxx + 空,1、创建约束前已存在索引，删除约束时不删除索引,2、创建约束前不存在索引，删除约束时删除索引|  
|  
|
||alter table disbale 约束 + 空,1、创建约束前已存在索引，disbale 约束时不删除索引,2、创建约束前不存在索引，disbale 约束时删除索引|  
|  
|
||alter table disbale 约束 + keep index ,1、创建约束前已存在索引，disbale 约束时不删除索引,2、创建约束前不存在索引，disbale 约束时不删除索引|  
|  
|
||alter table disbale 约束 + drop index ,1、创建约束前已存在索引，disbale 约束时删除索引,2、创建约束前不存在索引，disbale 约束时删除索引|  
|  
|
|  
|  
|  
|  
|
|primary key/unique using index |create table ,行内,行外|  
|  
|
|  
|alter table    
  行外    
  行内|  
|  
|
|  
|CONSTRAINT constraint_name PRIMARY/UNIQUE constraint_state：,1、NOT DEFERRABLE 兼容,2、INITIALLY IMMEDIATE 兼容,3、RELY|NORELY 兼容,4、ENABLE/DISABLE,5、VALIDATE/NOVALIDATE,6、index_attr_clause 同上|  
|  
|
|  
|using index + 空 默认创建分区索引|  
|  
|
|  
|using index + 空 ，如果已存在唯一索引，征用该索引|  
|  
|
|  
|using index + schema.index，指定已存在的索引,指定全局索引（单机/复制表）,指定分区索引（单机/分布式）|  
|  
|
|  
|using index （create index xxx）创建约束同时创建索引,指定全局索引（单机/复制表）    
  指定分区索引（单机/分布式）    
  指定非唯一索引（自动升级为唯一索引） |  
|  
|
|  
|创建约束时同时存在其他约束,1、check,2、not null|外键|  
|
|视图|dba_indexs，DBA_IND_SUBPARTITIONS，DBA_IND_PARTITIONS，DBA_IND_STATISTICS，INDPART$ 索引分区信息    
  cdef$ 约束信息    
  ICOL$ 索引列信息|索引INVISIBLE,UNUSABLE,索引分区UNUSABLE时，均不走索引扫描|  
|
|索引扫描|full Scan|索引INVISIBLE,UNUSABLE,索引分区UNUSABLE时，均不走索引扫描|  
|
|  
|fast full Scan|索引INVISIBLE,UNUSABLE,索引分区UNUSABLE时，均不走索引扫描|  
|
|  
|Range Scan|索引INVISIBLE,UNUSABLE,索引分区UNUSABLE时，均不走索引扫描|  
|
|  
|Unique Scan|索引INVISIBLE,UNUSABLE,索引分区UNUSABLE时，均不走索引扫描|  
|
|  
|skip scan |索引INVISIBLE,UNUSABLE,索引分区UNUSABLE时，均不走索引扫描|  
|
|一致性|走索引扫描验证索引的一致性,分布式（复制表/一级二级分区表）/单机（普通表/分区表）|  
|  
|
|CT/KT 用例|ddl 并发,1、create + alter + drop,2、create + alter + drop+ using index|  
|  
|
|  
|dml + ddl + select（索引扫描）    
  1、alter modify partition/subpartition + dml    
  2、create +  alter + drop + dml,3、create + alter + drop+ using index + dml|  
|  
|
|  
|dml 并发 + select(索引扫描)|  
|  
|
|扩缩容|带本地索引,新节点查询数据正常（索引扫描查询正常）,旧节点查询（索引扫描查询正常）|  
|  
|
|  
|旧版本存在全局索引(TAC/LSC)，升级后。,（索引扫描查询正常）|旧版本存在全局索引，升级后。扩缩容前不删除存量索引。报错,报错阶段：元数据搬迁|  
|
|  
|扩容后再缩容，重分布组合|  
|  
|
|  
|单机表空间迁移场景|  
|  
|


  


# 5.   **测试用例**

# 6.   **测试框架设计**

自动化用例添加到yasft/HA框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机/分布式|


## Attachments:

[lsc表支持本地索引.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTk4OTcwYzJhZjRmNTIwN2Y4IiwicmVmX2lkIjoiNjczOTZiZTk1OTNmOTljOWZmMjM2ODM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3ODU3LCJleHAiOjE3ODIzODQyNTd9.9bSdnh2z1iviDjZxDF2474LQX6HEObtJIwIuwg0sBGI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,【补】,会议纪要：,1. 分布表不允许建Global索引，涉及TAC的规格变更 --陈宜顺,2. 创建本地索引行为跟单机有区别，除了用USING INDEX语法创建，默认不指定Global或Local情况下的行为是建LOCAL索引 --chenyishun,3.测试 扩容后再缩容，重分布组合 --张璐恒,4.旧版本存在全局索引，升级后。扩缩容前不删除存量索引 --chenyishun,5.旧节点查询 --张璐恒,Posted by chenrui at 十二月 15, 2023 11:32|
|---|
