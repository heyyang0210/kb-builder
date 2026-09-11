Created by 任艳芬, last modified on 八月 08, 2024

# 1. 概述

存算分离架构下，查询时计算节点PN将通过网络从数据节点DN拉取LSC表元数据。因大部分AP场景下，冷数据大部分时间是稳态不变的，所以将其缓存在PN端，来减少元数据读取开销，提升性能。

SR链接：    [分布式支持PN上LSC元数据缓存](https://pingcode.yasdb.com/pjm/items/663f41ae288e197820895d0d? #YDBRD-27023 分布式支持PN上LSC元数据缓存)  

开发设计：    [YDBRD-27023:PN缓存元数据](159417287.html)  

# 2. 需求分析

## 2.1 功能点分析

1. scol_data_buffer新增mata cache 用来缓存元数据，buffer大小受参数scol_data_buffer_size控制，需要  关注配置缓存大小，看缓存申请淘汰是否正常，是否有泄露
1. 支持在PN端缓存LSC表的元数据，以及元数据版本校验。缓存元数据包含：slice元数据，chunk元数据，dbm元数据。
1. 元数据缓存使用scoldatebuffer, 受SCOL_DATA_BUFFER_SIZE参数影响。
1. 新增视图DV$PN_METACACHE，显示PN端meta cache相关信息。
1. 新增视图DV$DC_PART_STAT，显示DN端元数据最新版本和状态，只在DN端显示LSC表相关。
1. 视图DV$SYSSTAT，添加字段显示LSC meta cache相关信息，只在PN端 显示值。


## 2.2 应用场景

存算分离场景下，lsc 分布表的查询场景

## 2.3 规格约束

1.暂时只支持创建再S3 data bucket上的LSC分布表，不支持复制表；

2.暂不支持LOB/JSON类型；

3.咱不支持autotrace;

4.暂不支持资源隔离；

5.在PN查询时不支持主键索引；

## 2.4 部署模式

分布式，分布式HA

# 3. 详细测试设计

## 3.1 测试设计方法

- 参数设置语法：边界值分析法，等价类划分，路径覆盖
- 不同参数组合+不同表类型+不同数据量：场景覆盖法


## 3.2 详细测试设计

[YDBRD-27023_分布式支持PN上LSC元数据缓存.emmx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOGQ4OTcwYzJhZjRmNTIxOTRhIiwicmVmX2lkIjoiNjczOTZlOGQ3MjgyMDZlZmI5MmYyOTQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODk4LCJleHAiOjE3ODI1MjQyOTh9.gxwm4yVN-CeJ4_qek05vny0Ix6oSB2QyHtGjnWbUKpQ)

# 4. 测试用例

冒烟文本用例：

文本用例：  lsx

# 5. 测试框架设计

Guider需要支持部署存算分离架构。

# 6. 测试环境说明

部署：分布式

# 7. 工作量评估

工作量：14  *人天*

计划测试完成时间：2024/4/24

## Attachments:

[YDBRD-27023_分布式支持PN上LSC元数据缓存.emmx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOGQ4OTcwYzJhZjRmNTIxOTRhIiwicmVmX2lkIjoiNjczOTZlOGQ3MjgyMDZlZmI5MmYyOTQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODk4LCJleHAiOjE3ODI1MjQyOTh9.gxwm4yVN-CeJ4_qek05vny0Ix6oSB2QyHtGjnWbUKpQ)

 (application/octet-stream)    
