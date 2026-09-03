Created by 吕雷奇, last modified by  张茜 on 六月 28, 2024

**IR链接：**    [https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af6b](https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af6b)    **?**    
  **#YASHAN-27 YAC集群性能优化（TPCC指标）**

**SR链接：**    [https://pingcode.yasdb.com/pjm/items/661150f5579a3edb84d66dad](https://pingcode.yasdb.com/pjm/items/661150f5579a3edb84d66dad)    **?**    
  **#YDBRD-18693 支持session级别table lock cache**

**开发设计文档链接：**    [Session级资源 cache - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141584551)  

# 1. 概述

全局资源在访问时，通常需要通过加锁控制并发。在并发较高的情况下，spin lock冲突会很大，尤其是在ARM架构下，lock引起cache line失效会导致很容易出现跨NUMA节点的内存访问，严重影响并发性能。目前开发识别到的主要瓶颈有两种：

- block页面锁
- table表锁


# 2. 需求分析

## 功能点分析

**2.1增加本地cache机制**

a)本次主要增加两种锁资源可以放到本地cache中：block lock和table lock

b)block lock资源在session读较多的场景下，就会进入本地cache；table lock资源会在 session获取对象共享锁释放后，会进入本地cache；

c)本地cache失效：当资源状态发生变化时，本地cache会被失效：

- 当其他实例做DDL，会给table加排他锁，会失效本地cache相关对象的共享锁；
- 当其他实例做DML写操作，会给block加排他锁，会失效本地cache相关block锁；
- 当其他实例做DQL，本地cache不会失效；


**2.2 新增参数**

_SESSION_CACHE_BLOCKS: 控制每个session cache block lock 的数量，默认16，取值范围 0 ~ 1023

_SESSION_CACHE_TABLES: 控制每个session cache table lock的数量，默认16，取值范围 0 ~ 1023

_SESSION_BLOCK_CACHE_THRESHOLD：当某个block的shareCount大于该参数时，才会被cache到本地，默认32 ，取值范围1 ~ 65535

**2.3 新增视图**

V$SESSION_LOCK_CACHES: 查看每个session的cache情况：

|字段|类型|说明|
|:---|:---|:---|
|SID|INTEGER|会话ID|
|CACHE_TYPE|VARCHAR(16)|LOCK CACHE类型：TABLE CACHE、BLOCK CACHE|
|TOTAL|BIGINT|产生LOCK CACHE的总数（包含当前存在的数目以及被复用的数目）|
|HITS|BIGINT|LOCK CACHE命中次数|
|INVALIDS|BIGINT|LOCK CACHE失效次数|
|COUNT|BIGINT|当前LOCK CACHE的总数|


## 2.2 规格约束

- 在读写密集的场景下，session级cache可能会导致性能下降，需要进行参数调优


# 3. 详细测试设计

## 3.1 测试设计方法

1、测试参数和对应视图，使用边界值和场景组合。

2、性能调优，做专项测试；

## 3.2 详细测试设计

**3.2.1 测试参数和对应视图**

|  
|测试项|测试场景|预期结果|实际结果|备注|
|:---|:---|:---|:---|:---|:---|
|1|_SESSION_CACHE_BLOCKS|修改为边界值（上/下边界）|成功|  
|  
|
|2|ALTER SESSION SET/ALTER SYSTEM SET/config|修改为超过边界值（-1，1024）|失败|  
|  
|
|3|  
|修改为中间值|  
|  
|  
|
|4|  
|使用默认值|  
|  
|  
|
|5|_SESSION_CACHE_TABLES|修改为边界值（上/下边界）|  
|  
|  
|
|6|  
|修改为超过边界值（-1，1024）|  
|  
|  
|
|7|  
|修改为中间值|  
|  
|  
|
|8|  
|使用默认值|  
|  
|  
|
|9|_SESSION_BLOCK_CACHE_THRESHOLD|修改为边界值（上/下边界）|  
|  
|  
|
|10|  
|修改为超过边界值（-1，1024）|  
|  
|  
|
|11|  
|修改为中间值|  
|  
|  
|
|12|  
|使用默认值|  
|  
|  
|
|13|V$SESSION_LOCK_CACHES|视图字段显示正确|  
|  
|  
|
|14|  
|跑业务过程中并发查询视图|  
|  
|  
|


**3.2.2 性能调优**

|  
|测试项|测试场景|预期结果|实际结果|备注|
|:---|:---|:---|:---|:---|:---|
|1|x86下TPCC下2节点性能调优|在现有的调优参数基础上，调整参数,_SESSION_CACHE_BLOCKS、_SESSION_CACHE_TABLES、_SESSION_BLOCK_CACHE_THRESHOLD|  
|  
|  
|
|2|arm下TPCC下2节点性能调优|在现有的调优参数基础上，调整参数,_SESSION_CACHE_BLOCKS、_SESSION_CACHE_TABLES、_SESSION_BLOCK_CACHE_THRESHOLD|  
|  
|  
|
|3|x86下TPCC下4节点性能调优|在现有的调优参数基础上，调整参数,_SESSION_CACHE_BLOCKS、_SESSION_CACHE_TABLES、_SESSION_BLOCK_CACHE_THRESHOLD|  
|  
|  
|
|4|arm下TPCC下4节点性能调优|在现有的调优参数基础上，调整参数,_SESSION_CACHE_BLOCKS、_SESSION_CACHE_TABLES、_SESSION_BLOCK_CACHE_THRESHOLD|  
|  
||


3.2.3提前跑CI工程：

|工程类别|工程名称|复制工程连接|结果|
|---|---|---|---|
|功能|dev_L3_cluster_yasft_muti_SameObj_sa_1_arm|  
|  
|
|  
|dev_L3_cluster_yasft_muti_SameObj_sa_2_arm|  
|  
|
|  
|dev_L3_cluster_yasft_muti_SameObj_sa_3_arm|  
|  
|
|  
|dev_L3_cluster_yasft_muti_SameObj_sa_4_arm|  
|  
|
|  
|dev_L3_cluster_yasft_muti_SameObj_sa_5_arm|  
|  
|
|  
|dev_L3_cluster_yasft_muti_SameObj_sa_6_arm|  
|  
|
|KT|  [dev_L3_cluster_heap_KT_gcs_basic_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/dev_L3_cluster_heap_KT_gcs_basic_arm/)  |  
|  
|
|  
|  [dev_L3_cluster_heap_KT_gcs_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/dev_L3_cluster_heap_KT_gcs_arm/)  |  
|  
|
|  
|  [dev_L3_cluster_heap_KT_gls_1_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/dev_L3_cluster_heap_KT_gls_1_arm/)  |  
|  
|
|  
|  [dev_L3_cluster_heap_KT_gls_2_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/dev_L3_cluster_heap_KT_gls_2_arm/)  |  
|  
|
|  
|  [dev_L3_cluster_heap_KT_gcs_bcr_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/dev_L3_cluster_heap_KT_gcs_bcr_arm/)  |  
|  
|
|  
|  [dev_L3_cluster_heap_KT_gcs_pc_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/dev_L3_cluster_heap_KT_gcs_pc_arm/)  |  
|  
|
|上车工程|  
|-|  
|


**3.2.4 梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式**

|系统级DFX分类|是否涉及|备注|
|:---|:---|:---|
|CT|是|  
|
|KT|是|  
|
|长稳|是|  
|
|一致性|/|  
|
|三方测试工具    
  (sqltest，sqlancer)|/|  
|
|安全|/|  
|
|DFR|是|  
|
|HA|/|  
|
|压力|是|  
|
|性能|是|  
|
|可维护性|/|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


不涉及新增框架，ha_regress