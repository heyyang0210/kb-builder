

# 1. 概述

GV$BUFFER_POOL_STATISTICS视图支持查看databuffer的数据块情况信息，包含V$BUFFER_POOL_STATISTICS视图，主要为最大大小、DB_BLOCK_GETS、CONSISTENT_GETS、PHYSICAL_READS和PHYSICAL_WRITES



*IR链接： *  [YASHAN-1385 - GV$BUFFER_POOL_STATISTICS视图支持查看databuffer的数据块情况信息](https://pingcode.yasdb.com/ship/ideas/660b7482009f91eb87f2c075)  

*SR链接： *  [YDBRD-33636 - GV$BUFFER_POOL_STATISTICS视图支持查看databuffer的数据块情况信息](https://pingcode.yasdb.com/pjm/items/670655c9e489dd0868f2fea7)  

开发详细设计：  [https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/677f43e5ea9f2a287094c7d9](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/677f43e5ea9f2a287094c7d9)  

## 2.1 功能点分析

- 作为V$BUFFER_POOL_STATISTICS依赖的fixed table，X$BUFFER_POOL_STATISTICS需新增字段来提供动态视图所需的某些信息
- 具体新增字段：DB_BLOCK_GETS、CONSISTENT_GETS、PHYSICAL_READS、PHYSICAL_WRITES
- 视图字段定义：


|字段(加粗为新增字段)|类型|说明|
|---|---|---|
|ID|INTEGER|缓存区分区的编号|
|SIZE|BIGINT|缓存区分区的大小（单位：字节）|
|NUM_TOTAL|INTEGER|数据块总数|
|NUM_RESIDENT|INTEGER|常驻内存数据块数量|
|NUM_MAIN|INTEGER|热块链数据块数量|
|NUM_AUXILLIARY|INTEGER|辅助链数据块数量|
|NUM_WRITE|INTEGER|脏页链数据块数量|
|NUM_TEMP|INTEGER|临时链数据块数量|
|**NAME**|VARCHAR(32)|缓冲区名称，当前固定为DEFAULT|
|**SET_MSIZE**|BIGINT|缓冲区内可设置的最大的可容纳数据块数量|
|**BLOCK_SIZE**|BIGINT|缓冲区中被管理的数据块的大小|
|**DB_BLOCK_GETS**|BIGINT|从缓冲区中访问数据块的次数|
|**CONSISTENT_GETS**|BIGINT|一致性读次数|
|**PHYSICAL_READS**|BIGINT|物理读次数|
|**PHYSICAL_WRITES**|BIGINT|物理写次数|


## 2.2 应用场景

- GV$BUFFER_POOL_STATISTICS视图支持查看databuffer的数据块情况信息，包含V$BUFFER_POOL_STATISTICS视图，主要为最大大小、DB_BLOCK_GETS、CONSISTENT_GETS、PHYSICAL_READS和PHYSICAL_WRITES


## 2.3 规格约束

无

# 3. 详细测试设计

## 3.1 测试设计方法

- 查询、更新表前后确认视图数据是否增加，是否正确
    - CONSISTENT_GETS、PHYSICAL_READS、PHYSICAL_WRITES可以与V$SYSSTAT视图内的数据相互印证
    - DB_BLOCK_GETS暂时没有与之对应的其他视图
    - NAME固定为DEFAULT




## 3.2 是否涉及DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|不涉及，本SR仅新增动态视图字段|
|KT|不涉及，本SR仅新增动态视图字段|
|长稳|不涉及，本SR仅新增动态视图字段|
|一致性|不涉及，本SR仅新增动态视图字段|
|三方测试工具  
(sqltest，sqlancer)|不涉及，本SR仅新增动态视图字段|
|安全|不涉及，本SR仅新增动态视图字段|
|DFR|不涉及，本SR仅新增动态视图字段|
|HA|不涉及，本SR仅新增动态视图字段|
|压力|不涉及，本SR仅新增动态视图字段|
|性能|不涉及，本SR仅新增动态视图字段|
|可维护性|不涉及，本SR仅新增动态视图字段|


# 4. 测试用例

本sr不涉及自动化用例新增

## 5、测试框架设计

无

## 6、测试环境说明

|服务器|双机磁阵|
|:---|:---|
|操作系统|Linux x86/arm|
|部署|﻿|


## 7. 工作量评估

工作量：1人天