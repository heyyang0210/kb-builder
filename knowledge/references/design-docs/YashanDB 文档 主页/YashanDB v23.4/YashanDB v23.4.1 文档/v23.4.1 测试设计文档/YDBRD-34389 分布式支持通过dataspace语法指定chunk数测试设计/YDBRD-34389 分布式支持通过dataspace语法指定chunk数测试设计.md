Created by 刘美秀, last modified on 十一月 14, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

本文描述将部署参数 USERS_DATASPACE_SCALE_OUT_FACTOR的默认值从7变更为32 的测试设计，此参数的变更会影响分布式的一级分区数



# 2. 需求分析

SR：  [https://pingcode.yasdb.com/pjm/items/67107453e489dd0868f8e24f](https://pingcode.yasdb.com/pjm/items/67107453e489dd0868f8e24f)  ?    
  #YDBRD-34389 分布式支持通过dataspace语法指定chunk数

开发设计：  [详细设计-YDBRD-34391：分布式支持通过dataspace语法指定chunk数方案设计](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/674c2a04d2baff0fd558ed73)  

需求场景：高并行度下，增大USERS_DATASPACE_SCALE_OUT_FACTOR的默认值以提高高并行度下的性能  


## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，*  *对应提供的功能点、函数、语法图、配置参数、视图、接口等；*
- *开发设计的主要原理*


### 2.1.    *1 功能点*

|功能点|描述|备注|
|---|---|---|
|USERS_DATASPACE_SCALE_OUT_FACTOR|默认值从7调整为32|USERS数据空间对  集群  每个DN组的分片数。创建USERS数据空间时指定的分片数为该参数值与集群DN组数的乘积。只在CN组生效,--资料需更新,概念统一：把数据空间改成表空间集，,分布式的表空间集都会受到这个参数的影响，不仅users,集群变更为分布式集群|




### **2.1.2 开发原理**

建库时指定的每个DN组的分片数，每个表空间集下的表空间的数量=USERS_DATASPACE_SCALE_OUT_FACTOR*DN组数=一级分区表的分区数

### **2.1.3 分区数变更影响**

**增加分区数对性能的影响：**

查询性能提升：  
分区可以减少查询时需要扫描的数据量，因为查询可以针对特定的分区进行，而不是整个表。这种分区修剪（Partition Pruning）可以提高查询速度。

**性能下降风险：--索引**    
分区数量过多可能导致索引维护开销增加，元数据管理复杂，以及查询优化器负担加重

元数据管理复杂：过多的分区会增加数据库元数据的管理复杂度，影响系统性能

查询优化器负担加重：查询优化器在处理大量分区时，需要更多时间进行分区选择和查询计划生成，可能导致性能下降

跨分区操：跨分区的联接或跨分区的DML操作，可能会非常低效，因为它们需要在多个分区之间移动大量数据    


**其他参数**

MMS_TABLESPACE_SET_SIZE 默认值是否需要增大？  --暂不变更

USERS_TABLESPACE_SET_NEXT_SIZE 是否需要变更？ 64M *32  *3=6G   --不变更



## 2.2 应用场景

针对分区场景

## 2.3 规格约束

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

*验证概要*

|  
|验证项|验证方法|
|---|---|---|
|1|性能验证|等价类划分|


  


## 3.2 详细测试设计

**功能验证**

|验证模块|验证项|测试点|备注|
|---|:---|:---|---|
|功能  
|部署|命令行部署，部署成功|  
|
|||可视化部署，页面参数默认值变更为32，且部署成功||
|||3DN组，USERS_DATASPACE_SCALE_OUT_FACTOR=7 和 32时：,1.部署,2.create tablespace set||
||user_aim|3DN 创建tac+user_aim 表||
|专项验证|TPCH性能  
|无索引时候，不同分区数对查询性能的影响：并行度不变，默认参数为7和32时，tpch100 不带索引查询对比，统计信息收集对比,|,DEGREE_OF_PARALLEL=16|
|||有索引时，不同分区数对查询性能的影响：并行度不变，默认参数为7和32时，tpch100 带索引查询对比|DEGREE_OF_PARALLEL=16,索引：  
  [tpch 100G 新增 heap 表工程 (!4320) · Merge requests · CoD-X / Yastest Dfx · GitLab](https://git.yasdb.com/cod-x/yastest_dfx/-/merge_requests/4320/diffs)  |
|||无索引时，提高并行度对查询性能的影响：默认参数不变，并行度为16和32时，tpch100 带索引查询对比|USERS_DATASPACE_SCALE_OUT_FACTOR=32|
||tpcds性能|有索引时，不同分区数对查询性能的影响：并行度不变，默认参数为7和32时，tpcds 100 带索引查询对比|```
CREATE INDEX index_ca_address_sk ON tpcds.customer_address (ca_address_sk);
CREATE INDEX multi_column_index ON tpcds.customer_address (ca_address_sk, ca_street_number);
CREATE INDEX partial_index ON tpcds.customer_address (ca_address_sk) WHERE ca_address_sk = 5050;
CREATE INDEX expression_index ON tpcds.customer_address (trunc(ca_street_number));
CREATE INDEX tpcds_web_returns_p2_index1 ON tpcds.web_returns_p2 (ca_address_id) LOCAL;
CREATE INDEX tpcds_web_returns_p2_global_index ON tpcds.web_returns_p2 (ca_street_number) GLOBAL;
ALTER INDEX tpcds.tpcds_web_returns_p2_index2 MOVE PARTITION web_returns_p2_P2_index TABLESPACE example1;
```|
|  
|导数性能  
|不同分区表类型导数，100tpch-hhd|  
|
|||SSD 导数||
||数据迁移|CN扩容性能-元数据|![image.png](https://pingcode.yasdb.com/atlas/files/public/674d5b64a1ad9a3311de3c37/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NjAwNDEsImV4cCI6MTc4MjQ3MDg0MX0.XJeKdF0aSkv5XeNUsFxiPe2538KVENok4t64ifYKNxI)|
|  
|  
|DN扩容性能-chunk搬迁，3DN组+1，100 tpch|  
|
|||建表指定多个分区数，CN扩容，元数据搬迁重组SQL是否越界||
|上车工程|CI用例刷新  
|建表指定partition||
|||自定义tablespace set size||


  


|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
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
|性能|是|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

  
  [分布式支持通过dataspace语法指定chunk数文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc0ZDY5ZTVhMWFkOWEzMzExZGUzY2E0IiwicmVmX2lkIjoiNjczOTk1Njc1OTNmOTljOWZmMjQ4ZjI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDYwMDQwLCJleHAiOjE3ODI1NDY0NDB9.cq3GEGZzNp4AX8wE-WP7T3-BCVVk0Ecp77z94jXZYmM)  

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *6人天*

计划测试完成时间：2024.12.13

  
