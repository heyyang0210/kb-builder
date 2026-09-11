*概要设计-*  YDBRD-33792  * : YStream 内存优化*

IR链接：  [https://pingcode.yasdb.com/ship/ideas/66d57a7f89f961f330105a43?](https://pingcode.yasdb.com/ship/ideas/66d57a7f89f961f330105a43?)  #YASHAN-3261  Ystream优化

SR链接：  [https://pingcode.yasdb.com/pjm/items/67074eebe489dd0868f39616?](https://pingcode.yasdb.com/pjm/items/67074eebe489dd0868f39616?)  #YDBRD-33792 Ystream内

##   [1. 总述](#1-总述)  

ystream 的 pool 需人工指定、内存占用较高，应支持 sharepool 中自动管理。

###   [1.1 需求来源](#11-需求来源)  

简化 ystream 的使用，自动管理 ystream pool，小事务、高并行度时内存占用较高，采用差异化内存分配策略，提高内存效率。

**该特性支持 ystream 所有部署形态：单机、集群。**

###   [1.2 调研文档](#12-调研文档)  

**概述**   

友商 O 厂支持自动内存管理或者手工指定，一般情况下用户无需关注具体的 stream pool size配置。

  [https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/674ecc94d2baff0fd5598f88](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/674ecc94d2baff0fd5598f88)  

###   [1.3 需求分析](#13-需求分析)  

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|share pool 管理 ystream pool|ystream pool 调整为 share pool 的子 pool|是|是|----|
|功能|ystream pool 支持伸缩|控制 ystream pool 的上下限实现，当调整阈值时触发 pool 扩展或回收|是|是|----|
|功能|share pool 支持在线扩展|为 share pool 扩充 free blocks|是|是|----|
||性能场景2|----|是/否|是/否|----|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|share pool|yashan db 的自动内存管理组件|自研|  [Share Pool内存管理](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67396ea3728206efb92f2a32)  |


###   [1.5 开源依赖](#15-开源依赖)  

无。

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|alter system set share_pool_size=xx;|新增,在线调整 share pool 大小|是|
|SQL语法|alter system set ystream_pool_size|调整已有实现,在线调整 ystream pool 的大小，由于 ystream pool 由 share pool 管理，该语句不一定预占字面大小的内存。|是|
|配置参数|SHARE_POOL_SIZE|调整已有实现|是|
|配置参数|YSTREAM_POOL_SIZYSTREAM_POOL_SIZE|调整已有实现|是|
|视图|V$SHARE_POOL|增加 ystream pool 数据|否，现有框架应已支持|


##   [3. 规格与约束](#3-规格与约束)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**  规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

1. share pool size：由于已分配的内存可能被随机占用，因此 share pool size 只能在线扩大，不能在线缩小。可修改配置参数，重启缩小。
1. ystream pool size: 指定 ystream pool size 上限。活跃 ystream 服务可能占用 pool 中的 block，只能所有 ystream 服务都停止时缩小 poo size。支持任意时刻扩展 pool size。ystream pool size 的调整不能低于硬编码的下限（暂定 100M）。系统会根据 ystream pool size，尽可能预占内存，这些预占内存会拒绝被其他 pool 抢占，最多预占 1G。


##   [4. 特性](#4-特性)  

###   [4.1 配置逻辑](#41-特性功能点1)  

ystream pool size 的取值范围： [100M, INFI)，小于下限报错。（  **暂定**  ）

如不指定 ystream pool size 或设置为 0，则 ystream pool size 为 share pool 的 10%，这里与 O 厂不同，不一定真实占有这么多内存，只设定了 ystream pool 的上限。当 share pool size 发生变化时，ystream pool 的上限也同步发生变化。如 share pool size 变化后，ystream pool 大小不符合要求，也报错。

ystream pool 作为 share pool 成员，有几个关键属性：

- max: 在 share pool 中占用size的上限，即 ystream pool size，ystream 的 pool size 配置，相当于 Oracle Stream 的动态管理模式配置，指定的始终是 pool 的上限。
- min：在 share pool 中占用size的下限，ystream pool 始终保留 min 大小的内存，拒绝其他 pool 的抢占请求，即使没有任何业务也会保留 min 大小的内存，保证 ystream 具备基本的启动能力。min 不大于 1G，超出部分可能在必要时被其他 pool 抢占。
- recycle：响应其他 pool 的抢占请求，淘汰一些 block，ystream 可尝试 ctx 整理达到类似效果。


下面是 ystream pool size 的几种情况：

![image.png](https://pingcode.yasdb.com/atlas/files/public/67502858a1ad9a3311de404c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY5MjEsImV4cCI6MTc4MjQ2NzcyMX0.rrUsxGqDVCB93lGuaAM0b4y9-67UNZOuH3uW5NOLF6Y)

ystream pool 在 pool size 约束内，尽可能保留内存，最多1G，如图 ystream pool 始终持有橙色部分内存（实际内存布局可能是稀疏的）。

###   [4.2 ystream pool 的内存抢占策略](#42-特性功能点2)  

ystream 服务通常会消耗大量内存（集群下尤其），约束 ystream 的内存抢占策略，避免 ystream 服务影响其他业务执行。ystream pool 不会对其他 pool 以 preempt 抢占内存，仅从其他 pool 的 free list 获取。

###   [4.3 share pool 扩展](#43-特性性能点1)  

向 share pool 的 free pool 扩充页面。

###   [4.4 ystream pool 的扩展和收缩](#44-特性性能点2)  

- 扩展：调整 ystream pool 的 max
- 收缩：所有 ystream 服务停止时，调整 ystream pool min。


###   [4.5 share pool各子 pool 支持多种size配置方式](#44-特性性能点2)  

- “%xxx”: 百分比
- “xxx”：size


###   [4.6 特性可维可测设计](#45-特性可维可测设计)  

无

###   [4.7 特性安全设计](#46-特性安全设计)  

无

###   [4.8 特性周边配合](#47-特性周边配合)  

无  

##   [5.未来规划](#5未来规划)  

无