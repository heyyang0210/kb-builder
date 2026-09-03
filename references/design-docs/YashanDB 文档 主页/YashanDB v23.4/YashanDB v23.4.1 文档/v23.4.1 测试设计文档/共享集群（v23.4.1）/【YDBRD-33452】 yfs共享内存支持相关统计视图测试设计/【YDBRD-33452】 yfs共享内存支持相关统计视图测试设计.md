﻿﻿﻿﻿cIR链接：  [ YASHAN-3060yfs共享内存支持相关统计视图，支撑内存监控、使用统计分析 ](https://pingcode.yasdb.com/ship/ideas/66b5e04a5808037af1264e43?)  ﻿

SR链接：  [ #YDBRD-33452 yfs共享内存支持相关统计视图，支撑内存监控、使用统计分析 ](https://pingcode.yasdb.com/pjm/items/6704ac4fe489dd0868f19d67?)  ﻿

开发设计文档：  [ (1706) 详细设计-YDBRD-33452: YFS Share Memory Support View Design（yfs共享内存支持相关统计视图方案设计） | 知识管理 - PingCode ](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6768dedfa03b8234860bf0a0)  ﻿

# 1. 概述

本文描述的是yfs共享内存支持相关统计视图的测试设计。目前，yfs共享内存满后，无响应的告警和视图，此次特性增加yfs共享内存相关视图，提供yfs共享内存监控及问题定位手段。

# 2. 需求分析

## 2.1 功能点分析

新增视图3个：

- X$YFS_MEMORY_POOL
- V$YFS_MEMORY_POOL
- GV$YFS_MEMORY_POOL


其中，X$YFS_MEMORY_POOL为内部视图，只能用sys用户查询。

视图字段定义：

||||
|---|---|---|
|NAME|VARCHAR(68)|内存池的名字|
|TOTAL_SIZE|BIGINT|内存池的总大小（单位：字节）|
|USED_SIZE|BIGINT|内存池中被使用的空间大小（单位：字节）|
|FREE_SIZE|BIGINT|内存池中未被使用的空间大小（单位：字节）|
|MAX_SIZE|BIGINT|内存池最大大小（单位：字节）|


内存池NAME字段有两种取值：

- SYS_AREA_SIZE：yfs系统buffer区，主要存储root child array，就是目录树；
- SHM_POOL_SIZE：yfs共享内存pool区，主要存储FAT，简单来说就是通过文件名称、文件内偏移就能找到相应的block，然后直接去操作pread或者pwrite。


## 2.2 应用场景

集群、主备集群

## 2.3 规格约束

- 在集群下查询正常；
- 其他部署形态查询均为空。


# 3. 详细测试设计

## 3.1 测试设计方法

采用场景、故障推测法。

## 3.2 详细测试设计

|||
|---|---|
|系统级DFX分类|是否涉及|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具(sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|是|


### 3.2.1 功能测试：

通过设置SYS_AREA_SIZE、SHM_POOL_SIZE参数取值，测试视图各字段取值是否正确。

|||||
|---|---|---|---|
|﻿|测试项|测试场景|预期|
|1|V$YFS_MEMORY_POOL,GV$YFS_MEMORY_POOL,X$YFS_MEMORY_POOL,单个集群,﻿  
|db open，设置SYS_AREA_SIZE、SHM_POOL_SIZE（yfs参数，单节点生效非全局参数），内存使用正常时，单个实例查询三个视图（sys用户查询和普通用户查询）|v$视图为本实例使用yfs内存情况，全局gv$视图显示所有实例使用yfs内存情况，其中max size与两个参数设置值一致,sys用户均能查询到，普通用户查不到X$视图|
|2||db open，设置SYS_AREA_SIZE、SHM_POOL_SIZE，内存使用正常时，多个实例查询视图全局gv$视图（sys用户查询和普通用户查询）|视图各字段取值正常，且各实例查询结果差别不大,sys用户均能查询到，普通用户查不到X$视图|
|3||db nomount和mount时，sys用户查询和普通用户查询|sys用户均能查询到，普通用户查不到X$视图|
|4||设置SYS_AREA_SIZE、SHM_POOL_SIZE过小，构造内存使用超过最大值场景，nomount、mount、open状态查询三个视图|均能查到视图，且字段取值正确|
|5|V$YFS_MEMORY_POOL,GV$YFS_MEMORY_POOL,X$YFS_MEMORY_POOL,主备集群|主集群db open，设置SYS_AREA_SIZE、SHM_POOL_SIZE，内存使用正常时，单个实例查询本实例v$和全局gv$视图，备集群open节点、nomount节点查询三个视图（sys用户查询和普通用户查询）|主备均可查询，且取值正确|
|6||主集群db nomount、mount时，查询三个视图（sys用户查询和普通用户查询）|sys用户均能查询到，普通用户查不到X$视图|
|﻿  
||备集群db mount时，查询三个视图（sys用户查询和普通用户查询）|sys用户均能查询到，普通用户查不到X$视图|
|7||主集群设置SYS_AREA_SIZE、SHM_POOL_SIZE过小，构造内存使用超过最大值场景，主备集群db nomount、mount、open时查询三个视图|均能查询到|
|8|V$YFS_MEMORY_POOL,GV$YFS_MEMORY_POOL,X$YFS_MEMORY_POOL,单机、分布式|查询视图|视图存在，但内容为空|


### 3.2.2 升级测试：

|﻿|部署形态|旧版本|获取地址|新版本|
|---|---|---|---|---|
|1|单集群|23.2.1.100|﻿  [ Index of /YashanDB/vmp/master/ (yasdb.com) ](https://jenkins.yasdb.com/packages/YashanDB/vmp/master/)  ﻿|23.4|
|2||23.2.2.100|||
|3||23.2.3.100|||
|4||23.3.1.100|﻿  [ Index of /YashanDB/vmp/br23.3/ (yasdb.com) ](https://jenkins.yasdb.com/packages/YashanDB/vmp/br23.3/)  ﻿||


# 4. 测试用例

开发保证质量，与开发沟通，目前已覆盖用例如下：

|||||
|---|---|---|---|
|﻿|测试项|测试场景|预期|
|1|V$YFS_MEMORY_POOL,GV$YFS_MEMORY_POOL,X$YFS_MEMORY_POOL,单个集群,﻿  
|db open，设置SYS_AREA_SIZE、SHM_POOL_SIZE（yfs参数，单节点生效非全局参数），内存使用正常时，单个实例查询三个视图（sys用户查询和普通用户查询）|v$视图为本实例使用yfs内存情况，全局gv$视图显示所有实例使用yfs内存情况，其中max size与两个参数设置值一致,sys用户均能查询到，普通用户查不到X$视图|
|2||db open，设置SYS_AREA_SIZE、SHM_POOL_SIZE，内存使用正常时，多个实例查询视图全局gv$视图（sys用户查询和普通用户查询）|视图各字段取值正常，且各实例查询结果差别不大,sys用户均能查询到，普通用户查不到X$视图|
|3||db nomount和mount时，sys用户查询和普通用户查询|sys用户均能查询到，普通用户查不到X$视图|
|4|V$YFS_MEMORY_POOL,GV$YFS_MEMORY_POOL,X$YFS_MEMORY_POOL,单机、分布式|查询视图|视图存在，但内容为空|


目前，无自动化用例看护

