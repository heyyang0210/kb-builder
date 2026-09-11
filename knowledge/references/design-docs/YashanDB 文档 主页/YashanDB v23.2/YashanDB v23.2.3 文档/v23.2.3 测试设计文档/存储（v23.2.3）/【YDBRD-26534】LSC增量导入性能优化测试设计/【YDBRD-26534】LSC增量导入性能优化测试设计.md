Created by 易文亮, last modified on 六月 27, 2024

# 1. 概述

*本文档描述LSC表增量导入去重性能优化的测试设计*

datax支持writeMode为insert/update，分别代表热数据的insert与insert into on duplicate key，本次新增bulkinsert/bulkupsert，适应LSC冷数据写入的insert bulkload与insert bulkload dup。

# 2. 需求分析

## SR连接：    [https://pingcode.yasdb.com/pjm/items/662244a4fd997db58ade153a](https://pingcode.yasdb.com/pjm/items/662244a4fd997db58ade153a)    ?    
  #YDBRD-26534 分布式增量导入性能优化    

开发设计：    [【Spearfish】LSC 增量导入性能优化详细设计 ](https://conf.yasdb.com/pages/viewpage.action?pageId=153002157)  

相关测试设计：    [【YDBRD-21588】LSC表bulkload模式支持去重测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135622934)  

## 2.1 功能点分析

- 本次主要验证bulkload写入冷数据和去重功能，包括insert bulkload dup，使用datax导入带冲突和yasldr导入带冲突的情形


  


## 2.2 应用场景

- *验证datax走bulkload去重导入，20%/50%/100%冲突下，导入性能下降不超过1/3(原来100%冲突性能降为无冲突时的1/3)*
- *确认带唯一键时，主键冲突，能正常更新*


## 2.3 规格约束

- 无


# 3. 详细测试设计

## 3.1 测试设计方法

*本功能逻辑主要使用正交测试法，组合场景测试法进行验证*

## 3.2 详细测试设计

1. *测试对象*
1. 场景验证


|输入条件|有效等价类|备注|备注|
|:---|:---|:---|:---|
|表类型|LSC普通表,分区表、二级分区表（hash/list/range/interval）|单机|  
|
||LSC复制表、分区复制表、二级分区复制表（hash/list/range/interval）,一级分区分布表、二级分区分布表（hash/list/range/interval）|分布式|  
|
|唯一键类型|unique/primary key|  
|  
|
|唯一键列数|单列唯一键、组合唯一键|  
|  
|
|唯一键个数|单个、多个|  
|  
|
|唯一键数据类型|char，varchar、tinyint，smallint，int，bigint、number、,float，double、time，timestamp，date、boolean|  
|  
|


|序号|测试场景|预期|备注|
|---|---|---|---|
|1|普通表/分区表带单个主键/唯一键使用增量导入|导入成功，性能提升|  
|
|2|普通表/分区表带多个唯一键使用增量导入|导入成功，性能提升|  
|
|3|普通表/分区表带单个组合唯一索引使用增量导入|导入成功，性能提升|  
|
|4|普通表/分区表带多个唯一索引使用增量导入|导入成功，性能提升|  
|


|部署环境|序号|冲突率|导入方式|验证点|  
|
|:---|---|:---|:---|:---|:---|
|单机/分布式|1|  
|insert模式|不下降|  
|
|单机/分布式|2|0|bulkinsert模式|不下降|  
|
|单机/分布式|3|20%|bulkinsert模式|  
|  
|
|单机/分布式|4|50%|bulkinsert模式|  
|  
|
|单机/分布式|5|100%|bulkupsert模式|下降不超过测试项2的1/3|  
|


主要是内部逻辑变化，功能用例有看护，CI不失败即可，要求性能达标

|系统级DFX分类|是否涉及|备注|
|:---|:---|:---|
|CT|否|  
|
|KT|否|  
|
|长稳|否|  
|
|一致性|否|  
|
|三方测试工具    
  (sqltest，sqlancer)|否|  
|
|安全|否|  
|
|DFR|否|  
|
|HA|否|  
|
|压力|否|  
|
|性能|是|  
|
|可维护性|否|  
|


  


# 4. 测试用例

1. 冒烟文本用例：a.非分区表主键，bulkload带100%冲突导入性能提升，耗时由原来的3倍，降为2倍及以下    
                           b.分区表带多个唯一键，bulkload带100%冲突导入性能提升，耗时由原来的3倍，降为2倍及以下
1. 测试文本用例：


详见附件

# 5. 测试框架设计

  


# 6. 测试环境说明

*datax工具/yasldr*

# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：