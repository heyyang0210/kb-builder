Created by 易文亮, last modified on 十二月 06, 2023

# 1. 概述

*本文档主要描述LSC表bulkload模式支持去重功能的测试设计*

*当前insert bulkload遇到唯一键冲突会报错，load bulkload导入遇到唯一键冲突因容错机制跳过冲突继续后续导入；本需求实现后，遇到唯一键约束适用on duplicate key的功能进行更新。*

# 2. 需求分析

SR链接：    [[YDBRD-21588] 支持insert /*+bulkload */支持去重或报错 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21588)  

开发设计：    [(2) LSC表bulkload模式支持去重功能 - 陈晓晴 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135608998)  

其他关联SR测试设计：    [【YDBRD-21586】INSERT INTO增量导入(写入)LSC冷数据测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133586731)  

## 2.1 功能点分析

- *insert语法：区别于insert *  */ * +bulkload * /*  *  into无去重能力，增加*  *insert / * +bulkload deduplicate * / into支持去重*
- *load语法：*  *新增option_clause：DEDUP，在ENABLE_BULK=true时使用生效，ENABLE_BULK=FALSE时将报错*


## 2.2 应用场景

- *增量insert写入冷数据，带唯一键拥有去重能力，待写入的数据与热数据重复、待写入的数据与冷数据重复、待写入的数据本身重复（考虑单会话和多会话）、含多条重复记录；*
- *load data/yasldr导入冷数据，带唯一键拥有去重能力，待导入的数据与热数据重复、待导入的数据与冷数据重复、待导入的数据本身重复（考虑单会话和多会话）、含多条重复记录；*
- *考虑带唯一键约束，触发唯一键约束冲突能去重并写入成功；不带唯一键，逻辑不变，不去重。*


## 2.3 规格约束

- bulkload支持部分容错功能，能容错的执行成功，无法容错的报错回滚整个事务
- 仅支持有唯一键冲突的bulkload写入的去重处理，热数据写入则不适用
- 通过升级流程，原LSC表的唯一索引将不可用，需在升级完成后rebuild index才可用


# 3. 详细测试设计

## 3.1 测试设计方法

*对于语法验证，主要使用等价类，覆盖所有有效语法执行成功，无效语法执行失败；*

*对于功能验证，主要使用场景分析法进行验证，遇到主键冲突能有去重能力，刷新数据，不报错；*

*对于异常处理，主要使用错误推测法进行设计。*

## 3.2 详细测试设计

1. *语法覆盖，copy一份*  *insert *  */ * +bulkload * /*  *  into改写为insert *  */ * +bulkload deduplicate* /*  *  into，除带唯一键触发冲突外，其他预期结果不变*
1. *测试对象*
1. 场景验证


|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|表类型|LSC普通表,分区表、二级分区表（hash/list/range/interval）|单机|heap/tac|  
|
||LSC复制表、分区复制表、二级分区复制表（hash/list/range/interval）,一级分区分布表、二级分区分布表（hash/list/range/interval）|分布式|tac|  
|
|唯一键类型|unique/primary key|  
|  
|  
|
|唯一键列数|单列唯一键、组合唯一键|  
|  
|  
|
|唯一键个数|单个、多个|  
|  
|  
|
|唯一键数据类型|char，varchar、tinyint，smallint，int，bigint、number、,float，double、time，timestamp，date、boolean|  
|  
|  
|


|序号|测试场景|预期|备注|
|---|---|---|---|
|1|建无唯一键的表  *insert / * +bulkload deduplicate * / into写入不重复的数据和重复的数据*|成功|  
|
|2|建无唯一键的表load data   *bulkload dedup导入不重复的数据和重复的数据*|成功|  
|
|3|带唯一键的表  *insert / * +bulkload deduplicate * / into写入重复数据*|成功写入，数据更新|  
|
|4|带唯一键的表load data  *导入*  *重复数据带ENABLE_BULK=true,dedup=true*|成功导入，数据更新|  
|
|5|insert / * +deduplicate * / into 缺失  *bulkload关键字*|报错|  
|
|6|load data导入option带ENABLE_BULK=FALSE,dedup=true|报错|  
|
|7|load data导入option带dedup=true|报错|  
|
|  
|...|  
|  
|


[LSC bulkload导入支持去重(ydbrd21588).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWI4OTcwYzJhZjRmNTIwN2ZkIiwicmVmX2lkIjoiNjczOTZiZWI1OTNmOTljOWZmMjM2ODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3ODkzLCJleHAiOjE3ODIzODQyOTN9.Lffbj1-hcA2-_twUsrbauWFMloh98yRAyUAO0ZeZh4g)

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|Y|
|KT|Y|
|长稳|N|
|一致性|Y|
|三方测试工具    
  (sqltest，sqlancer)|N|
|安全|N|
|DFR|Y|
|HA|Y|
|压力|N|
|性能|Y|
|可维护性|N|


  


# 4. 测试用例

1. 冒烟文本用例：
1. 功能文本用例：


详见附件

# 5. 测试框架设计

- yasft/ha_regress，不做额外框架设计


# 6. 测试环境说明

单机 + 分布式

# 7. 工作量评估

工作量：  *12人天*

计划测试完成时间：

## Attachments:

[LSC bulkload导入支持去重(ydbrd21588).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWI4OTcwYzJhZjRmNTIwN2ZlIiwicmVmX2lkIjoiNjczOTZiZWI1OTNmOTljOWZmMjM2ODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3ODkzLCJleHAiOjE3ODIzODQyOTN9.5YH4_PbFQ5W_7ljeCF_9XU5p_Hf_uBOtN2PfgsPk2h8)

 (application/x-xmind)    


[LSC bulkload导入支持去重(ydbrd21588).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWJhMWFkOWEzMzExZGM4NjczIiwicmVmX2lkIjoiNjczOTZiZWI1OTNmOTljOWZmMjM2ODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3ODkzLCJleHAiOjE3ODIzODQyOTN9.e4f6Fr1Mp4Q3w0jHwxmzrjEM8kO_2_AnkL6pvENCXIY)

 (application/x-xmind)    


[LSC bulkload导入支持去重(ydbrd21588).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWI4OTcwYzJhZjRmNTIwN2ZkIiwicmVmX2lkIjoiNjczOTZiZWI1OTNmOTljOWZmMjM2ODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3ODkzLCJleHAiOjE3ODIzODQyOTN9.Lffbj1-hcA2-_twUsrbauWFMloh98yRAyUAO0ZeZh4g)

 (application/x-xmind)    


## Comments:

|  [](null)  ,1、分区表唯一键不是分区键，插入的数据不在同一个分区，触发分区更新,2、容错机制变化，部分场景如数据无法插入当前分区报错后可能不会触发事务回滚,Posted by yiwenliang at 十二月 06, 2023 09:45|
|---|
