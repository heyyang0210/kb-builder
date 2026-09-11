Created by 郭泽霖 on 七月 03, 2024

  [IR链接：YASHAN-2858  分布式支持在PN组查询数据](https://pingcode.yasdb.com/ship/ideas/66279c4c009f91eb87f67b1f)  

  [SR链接：YDBRD-26824 分布式支持在PN组执行查询](https://pingcode.yasdb.com/pjm/items/66384446c36a3d30a8617794)  

##   [1. 总述](#1-总述)  

  [pn查询概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=130127255)  

本方案主要涉及：

1. 计划预处理与下发
1. 支持pn查询的执行
1. 适配AC SCAN


###   [1.1 需求来源](#11-需求来源)  

内部技术需求，参见    [YashanDB存算分离总体方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=119559628)  

###   [1.2 调研文档](#12-调研文档)  

  [调研分析](https://conf.yasdb.com/pages/viewpage.action?pageId=147770107)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|计划下发|4.2|是|是|
|功能|支持pn table scan|4.3|是|是|
|功能|支持pn ac scan|4.4|是|是|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|s3|亚马逊对象存储|是|  [Amazon S3](https://en.wikipedia.org/wiki/Amazon_S3)  |
|pn|process node，存算分离架构下的worker承载者|无|  [PNG节点管理](https://conf.yasdb.com/pages/viewpage.action?pageId=130132006)  |


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

无

##   [3. 规格与约束](#3-规格与约束)  

无

##   [4. 特性](#4-特性)  

已在    [基于PN组的查询计划生成方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=130127255)    中分析

###   [4.1 特性设计](#41-特性设计)  

根据对优化的分析，执行的改动也只是在接口上，不涉及核心功能的变化。也就是：

1. 对接计划
1. 对接路由
1. 对接存储


###   [4.2 计划下发](#42-计划下发)  

1. 在cn上通过groupId与groupNodeId算出endpoint，记录到execGroupArray中，下发
1. 序列化新加的结构，同时在pn上因为没有存元数据，会去dn上拉一个残缺的dc


###   [4.3 pn table scan](#43-pn-table-scan)  

1. 根据路由信息，拿到需要在当前节点扫描的chunk，这一步调整为通过pipe的比较完成
1. transform适配新加的merge算子，并传递scan上的hot_only标记
1. ColScanCursor::try_new()时，一次性拉取所有以chunk粒度组织的元数据，存在hashmap中备用
1. 划分scanRange时，传入chunkMeta，hot_only，endpoint，sid
1. openCursor时，传入chunkMeta，hot_only，endpoint，sid
1. chunkMeta存储的hashmap跟随ColScanCursor释放
1. px计算接收端口时，要注意访问的是哪个路由表


###   [4.4 pn ac scan](#44-pn-ac-scan)  

1. ac有自己的dc，反序列化已经打开，rust内不需要再次打开，直接拿然后一路传到cursor上即可
1. openChunkMeta时同时拉取
1. 划分scanRange时，chunkMeta一定是排他的
1. openCursor时ac和原表chunkMeta同时赋值，且赋值ac的version


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- 检查结果正确性，复用已有DN LSC表用例。
- 基于规格，关注计划合理性，另外可以检查计划中的px端口正确性
- 由于AnlPlan结构变复杂，tableQueue变多，内存开销会变大
- pn scan加复杂filter，子查询等


##   [6.资料设计章节](#6资料设计章节)  

无

##   [7.未来规划](#7未来规划)  

无

  
