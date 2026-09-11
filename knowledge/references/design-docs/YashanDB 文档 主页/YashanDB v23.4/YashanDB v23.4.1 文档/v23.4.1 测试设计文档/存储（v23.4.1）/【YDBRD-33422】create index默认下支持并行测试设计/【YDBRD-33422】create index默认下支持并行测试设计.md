Created by 陈瑞, last modified on 十一月 08, 2024

  [详细测试设计文档模板 - CoD Test Dept - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=130152227)  

  


# 1. 概述

*创建/重建索引不指定parallel时。默认CPU核数并行*

*交付形态：单机&分布式&集群*

# 2. 需求分析

## 2.1 功能点分析

- heap表、tac表创建btree不指定并行默认按照cpu核数一半并行
- 只包含btree索引。包括分区索引和全局索引。
- 分区索引是单个分区内并行创建
- 隐藏参数_INDEX_NOPARALLEL 默认值false，默认开启并行


## 2.2 应用场景

- *create index*
- *alter index xxx rebuild*
- *alter table add primary/unique *  *[*  *using_index_clause*  *]*
- *alter table enable 约束(disable 时drop index) [*  *using_index_clause*  *]*
- *覆盖一二级分区表的分区索引*
- *覆盖reverse/unique/unusable*


## 2.3 规格约束

- *本次不包含*  *函数索引、列式索引，rtree的并行创建*
- *lsc表目前不支持并行数>1*


# 3. 详细测试设计

## 3.1 测试设计方法

### 1、性能

对本测试为验证是否走默认

测试方法：手工测试

在用例中set timing on，创建索引时指定 parallel = 1 、parallel = cpu 数、不指定 三种方式创建索引/约束。通过比对时间确定是否不指定默认走并行。

数据量需要偏大。计划10w条数据量。

cpu核数8

- *create index*
- *alter index xxx rebuild [online]*
- *alter table add primary/unique [*  *using_index_clause*  *]*
- *alter table enable 约束(disable 时drop index) [*  *using_index_clause*  *]*
- *覆盖一二级分区表的分区索引*
- *索引类型。reverse/*  *unique*


  


### 2、功能

已有用例已覆盖。上车能覆盖到

- 不指定默认创建后的索引功能正常，使用正常


### 3、不走并行创建的，保证ddl功能不受影响。

已有用例已覆盖。上车能覆盖到

- lsc表的btree
- 函数索引
- rtree索引


  


|序号|模块|  
|测试点|  
|预期|
|---|---|---|---|---|---|
|  
|性能|单机/集群|*heap普通表的全局索引、一二级分区表的分区索引。*,*指定 parallel = 1 、parallel = cpu 数、不指定 三种方式。比对时间*,1. *create index  [visable/invisable]  *
1. *create unique index *
1. *create index reverse *
1. *create index unusable*
1. *create function index  --不并行*
1. *create rtree index  --不并行*
1. *create columnar index  --不并行*
1. *alter index xxx rebuild 普通索引  [online]*
1. *alter index xxx rebuild 唯一索引  [online]*
1. *alter index xxx rebuild reverse索引 [online]*
1. *alter index xxx rebuild 函数索引  --不并行*
1. *alter index xxx rebuild 列索引  --不并行*
1. *alter table add primary/unique 不带using index*
1. *alter table add primary/unique 带using index指定建索引语句*
1. *alter table enable primary/unique  不带using index(disable 时drop index)*
1. *alter table enable primary/unique  带using index(disable 时drop index)*
|  
|time(指定cpu 数 )  =  time(不指定)   &&    time(不指定) > time(1)。|
|  
|  
|分布式|同上,1. lsc表不走并行
|  
|  
|
|  
|  
|单机|旧功能不受影响,1. 指定parallel 时默认cpu数量
1. 指定parallel integer时integer，非cpu核数
|  
|  
|
|  
|功能|  
|不指定默认创建后的索引功能正常，使用正常|  
|  
|
|  
|  
|  
|默认不走并行创建的，保证ddl功能不受影响|  
|  
|


## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|---|---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|是|
|可维护性|否|


  


# 4. 测试用例

# 5. 测试框架设计

- 不自动化。保留测试记录


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：1  *人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Attachments:

[如何开启大页内存 (1).docx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZmMDY4OTcwYzJhZjRmNTIxZDI0IiwicmVmX2lkIjoiNjczOTZmMDU3MjgyMDZlZmI5MmYyZmEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5MDIxLCJleHAiOjE3ODI1NDU0MjF9.VZgH2Tj7lvB0O96KykswRQPxCRbRUfXlP0gM3lpyAoE)

 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)    


[索引并行创建.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZmMDZhMWFkOWEzMzExZGM5Yjk2IiwicmVmX2lkIjoiNjczOTZmMDU3MjgyMDZlZmI5MmYyZmEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5MDIxLCJleHAiOjE3ODI1NDU0MjF9.mPL9BJdR9nBmjrYfWo05hHWizgjvvhEa9nBk36gs7_Y)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
