﻿IR链接：  [ ](https://pingcode.yasdb.com/ship/ideas/66b5e04a5808037af1264e43?)    [https://pingcode.yasdb.com/ship/ideas/66cdbf084283cf23d4f3ea5d?](https://pingcode.yasdb.com/ship/ideas/66cdbf084283cf23d4f3ea5d?)  

#YASHAN-3197  【DFX】GRC资源内存管理优化

SR链接：  [ ](https://pingcode.yasdb.com/pjm/items/6704ac4fe489dd0868f19d67?)    [https://pingcode.yasdb.com/pjm/items/67078693e489dd0868f3ddd9?](https://pingcode.yasdb.com/pjm/items/67078693e489dd0868f3ddd9?)  

#YDBRD-33827 【DFX】GRC资源内存管理优化

开发设计文档：  [GRC内存优化 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67909a81700aa28012619d69)  

# 1. 概述

本文描述的是GRC资源内存管理优化的测试设计。

# 2. 需求分析

共享内存相关内存分为三部分，1. 全局资源管理和协调模块使用的内存，具体包括：全局数据块资源内存、全局非数据块资源内存、资源请求内存、数据块past copy注册信息内存。2. 缓存全局资源的实例本地内存，具体包括：全局锁本地缓存。数据块资源缓存信息目前管理在data buffer中，不涉及。 3. 对象资源亲和管理的实例本地内存，用于管理亲和本实例的对象资源信息。其中，第1、3部分内存来源于share pool，第2部分内存来源于malloc。

share pool内存根据注册者划分为多个区域，这些注册者的内存有两种类型，一种称为动态内存，动态内存可以根据业务负载，于share pool提供内存均衡的能力。另一种称为静态内存，不参与share pool的内存均衡，一直被该注册者持有。此需求旨在将共享内存全部整合入share pool，且注册类型为动态内存。

## 2.1 功能点分析

本需求中第1、3部分内存需要修改为share pool动态内存类型。全局锁本地缓存内存整合入share pool，全局锁本地缓存的内存失效是通过淘汰机制被动触发，没有主动失效的逻辑，因此适合注册为静态内存类型。

SHARE_POOL_SIZE参数的默认值修改为320M，取值范围/格式：[256M,64T]（单机、分布式部署），[320M,64T]（共享集群部署）

等待事件新增 alloc gc pool wait 

## 2.2 应用场景

集群

# 3. 详细测试设计

## 3.1 测试设计方法

采用场景法

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具(sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|是|


### 3.2.1 功能测试

主要测试点及观察点：

1、share pool较小的情况下下发高压力业务，触发grc内存资源回收，业务正常，回收正常

2、内存资源不足，回收失败时的表现符合预期，以及在线调整sharePool size解决卡死问题

3、触发reform验证grc搬迁内存资源正确、视图查询正常

涉及到的测试因子：

|分类|场景|备注|
|---|---|---|
|业务类型|大数据量gcs/gls资源业务，高压力场景||
|集群启停|集群启动、集群停止，频繁集群启停||
|集群故障|集群单实例故障，多实例故障，混合故障（涉及master/非master）||
|视图查询|相关业务场景下并发查询v$share_pool视图，表现正常||
|参数验证|SHARE_POOL_SIZE参数默认值显示为320M，范围正确||
|等待事件查询|查询相关视图，新增等待事件，事件名正确||
|资料验证|SHARE_POOL_SIZE参数说明正确合理,等待事件新增 alloc gc pool wait 且事件说明正确合理||


### 3.2.2 长稳测试

SHARE_POOL_SIZE设置较小的情况下跑长稳，未出现core问题

# 4. 测试用例

开发保证质量，目前无自动化用例看护

﻿﻿﻿﻿

