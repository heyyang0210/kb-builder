Created by 陈楚坤, last modified by  孟凡彬 on 十一月 15, 2024

*IR链接：*  ：    [https://pingcode.yasdb.com/ship/ideas/66b9828c5808037af126574a](https://pingcode.yasdb.com/ship/ideas/66b9828c5808037af126574a)    ?#YASHAN-3066 集群支持多机并行查询能力

##   [1. 总述](#1-总述)  

###   [1.1 需求背景](#11-需求背景)  

根据集群支持对象资源亲和性特性对用户使用场景的分析，需要探索基于对象资源亲和性的多机并行执行，提升查询性能，降低系统负载。

###   [1.2 需求来源](#12-需求来源)  

集群的应用部署通常有如下两种策略：

- 应用分区，业务系统划分到不同实例。跨实例查询通常来自于DBA运维，跨应用分析业务，多机并行将探索如何降低这类查询对应用的冲击。
- 应用透明，业务系统不关心集群的数据分布，更关心集群的高可用能力，多机并行将探索如何在集群间进行负载均衡。


演进规划：

- 23.4 优化器感知对象亲和性，生成跨节点的并行执行计划。执行器适配跨节点的并行执行，摸底多机执行的性能，提供算子级的统计信息，总结COST模型。
- 23.5 优化器和执行器感知数据分布状态，感知节点负载，包括内存，CPU，IO等，评估SQL交换数据和存储交换数据的代价，生成和执行负载均衡的计划。


###   [1.3 调研文档](#13-调研文档)  

####   [1.3.1 考虑数据亲和性的并行执行](#131-考虑数据亲和性的并行执行)  

- ORACLE的RAC的CBO优化器能感知集群的状态，包括：磁盘页面与节点的亲和性、表在存储上的最优并行度、节点数、cpu数等。优化器可根据这些信息，综合考虑本地执行、远程执行的成本，分配合适的节点生成并行执行计划。


####   [1.3.2 并行执行模型](#132-并行执行模型)  

- Presto，StarRocks，PolarDB-X等数据库将算子树根据数据分布和计算代价将算子树通过Exchange算子拆分为多个Stage，每个Stage采用PIPELINE执行模型进行调度。
- OceanBase，Oracle，TiDB等数据库也是采用Exchange算子来拆分Stage的方式，但每个Stage则采用VOLCANO执行模型，根据STAGE依赖关系进行任务编排和调度。


###   [1.4 现状分析](#14-现状分析)  

YashanDB当前采用了OceanBase和Oracle的设计。

- 优化器可以根据数据分布信息和COST选择数据的分发策略，生成分布式执行计划。
- 分布式行存和集群GV视图查询将其他节点的数据拉到查询发起节点，在本地做其他算子的运算。


###   [1.5 需求分析](#15-需求分析)  

集群已完成对象资源管理的设计，提供了对象的亲和性设置接口，当前特性基于拉通存储，优化器，执行器的亲和性感知和适配而展开。

- 执行器可以先基于HINT等方式强制下推查询，完成多机并行执行的功能开发，避免开发依赖。


|类别|子类|分析|结论|
|:---|:---|:---|:---|
|功能|\|存储提供对象亲和性的查询接口。,优化器将对象访问下推到对象亲和节点。,执行器执行多机并行计划，收集不同计划的执行统计信息。|优化器先基于对象在亲和节点访问的规则下推，再考虑复杂计划的下推。,执行器先完成多机并行的基础框架搭建，估算实际执行代价供优化器决策。|
|DFX|可靠性|多机并行执行是SQL粒度的，节点故障场景可以报错|暂不考虑|
|  
|可用性|对客户透明|暂不考虑|
|  
|性能|多机并行主要诉求是解决性能和负载均衡|需要进行性能测试设计|
|  
|安全性|只涉及SQL执行计划的选择和执行|不需要进行安全特性设计|
|  
|易运维|通过SQL视图可以查看并行执行计划和实际执行统计信息|需要考虑执行的可观测性|
|  
|兼容性|SQL执行是内存状态|暂不考虑|


###   [1.6 数据字典](#16-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|VOCALNO|火山模型|是||
|PIPELINE|流水线模型|是||


##   [2 对外接口](#2-对外接口)  

不涉及

##   [3. 规格与约束](#3-规格与约束)  

鉴于亲和性特性对执行性能和负载影响的不确定性，当前需求主要完成功能验证和基础性能数据摸底。

- 优化器只根据表的亲和性属性进行计划下推
- 只支持HashJoin和聚集函数（count, sum, min, max）的多机并行执行


##   [4. 架构设计](#4-架构设计)  

- 优化器获取对象的亲和性节点，生成跨节点执行计划
- 执行器完成SQL层的多机计划下发，执行，算子间的数据交互


![](https://pingcode.yasdb.com/atlas/files/public/67396eefa1ad9a3311dc9af6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUNBQUNBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBZ0FBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDSUFnQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0OTksImV4cCI6MTc4MjQ2NzI5OX0.6NQZIOtE_rxMpmqNl4ImJ_WPiLkCXjtjqYhXSPOh2cc)

###   [4.1 场景分析](#41-场景分析)  

表A的亲和性节点为实例1，表B的亲和性节点为实例2，SQL客户端连接实例1发起SQL查询。

- 将表B扫描下推到实例2，通过TabQueue将表B的数据传送到实例1，在实例1中做HashJoin和聚集，返回给客户端。


![](https://pingcode.yasdb.com/atlas/files/public/67396eef8970c2af4f521c86/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUNBQUNBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBZ0FBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDSUFnQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0OTksImV4cCI6MTc4MjQ2NzI5OX0.6NQZIOtE_rxMpmqNl4ImJ_WPiLkCXjtjqYhXSPOh2cc)

  


- 将表B扫描，JOIN，聚集都下推到实例2，将表A的数据传送到实例2，在实例2中做HashJoin和聚集，最终传送数据到实例1返回给客户端。


![](https://pingcode.yasdb.com/atlas/files/public/67396eef8970c2af4f521c87/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUNBQUNBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBZ0FBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDSUFnQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0OTksImV4cCI6MTc4MjQ2NzI5OX0.6NQZIOtE_rxMpmqNl4ImJ_WPiLkCXjtjqYhXSPOh2cc)

###   [4.2 功能设计](#42-功能设计)  

从模块维度进行功能设计拆分：

####   [4.2.1 存储引擎对象亲和性接口](#421-存储引擎对象亲和性接口)  

- 存储引擎提供对象的亲和性查询接口
- 对象亲和性属性变更使DC失效


####   [4.2.2 优化器感知对象亲和性](#422-优化器感知对象亲和性)  

基于分布式行存的积累经验，优化器已经实现按数据分布和COST添加PX算子，拆分STAGE的能力，该特性主要完成如下场景的适配：

- 表扫描计划根据对象亲和性实例和当前实例不同生成下推的扫描计划
- 对象亲和性属性变更，失效计划并重新生成
- COUNT(*)算子下推
- HASH_JOIN算子下推


####   [4.2.3 执行多机并行执行](#423-执行多机并行执行)  

|功能点|设计分析|关键点|
|:---|:---|:---|
|会话级任务调度器|用户态自调度，线程数量支持动态增删，Stmt动态切换|任务队列，并行环境创建和销毁|
|SQL执行的无状态化|任务无状态，细粒度，高并发，高缓存命中率|SQL执行与执行资源，Stmt，AnlHandler解耦，SQL可以调度到任意并行AnlHander中执行，|
|算子并行化|算子算法内存友好型改造，计算瓶颈的并行化拆分|算子算法的任务化，串行和并行状态机实现，一个线程跑完所有算子|
|SQL执行的资源管控|SQL内部算子级的资源感知和协商，避免一个算子，一条SQL耗尽数据库资源|并行算子之间创建同步点协商资源，资源感知的并行调度，算子最小化资源运行|


###   [4.3 可靠性设计](#43-可靠性设计)  

SQL执行过程中若算子运行所在的实例出现启停，则报错处理。

###   [4.4 性能设计](#44-性能设计)  

- 多机并行的初衷是减少存储层的跨节点全局资源的访问，利用就近计算的原理来提升整体的查询性能。
- 指定了亲和节点的对象，其实际业务的访问通常会绑定到亲和节点，将对该对象的访问下推到亲和节点可以避免非亲和节点的缓存无法命中，锁冲突。
- SQL级的数据交换只能服务于当前SQL，不同的SQL之间无法复用，因此会存在集群节点之间的流量增大问题。


性能测试可以根据事务的长短，事务的并发度，对象的大小，SQL的复杂度等维度进行设计和展开。

###   [4.5 可维可测设计](#45-可维可测设计)  

- AUTOTRACE增加展示计划执行的网络IO，执行等待统计信息
- EXPLAN增加展示计划的STAGE树，任务DAG


###   [4.6 安全性设计](#46-安全性设计)  

该特性为SQL执行内部通信协议，不涉及安全相关场景

###   [4.7 兼容性设计](#47-兼容性设计)  

该特性为执行态内存结构体修改，不涉及兼容性相关场景

##   [5. 需求分解](#5-需求分解)  

|需求分解|SR范围|工作量（人周）|产品形态|
|:---|:---|:---|:---|
|集群支持单节点并行聚集算子|并行执行无状态调度器，算子执行无状态化适配，两阶段聚集函数实现|8|单机，集群|
|优化器基于对象亲和性生成多机并行计划|优化器根据对象亲和性，下推对象访问，两阶段聚集，并行HASH_JOIN|2|集群|
|集群支持COUNT(*)和HASH_JOIN的多机并行|执行支持多机并行计划下发和执行，支持每个节点单线程跑完多机并行任务|6|集群|


  


## Attachments:

[image2024-11-7_14-32-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWVhMWFkOWEzMzExZGM5YWVkIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDk5LCJleHAiOjE3ODI1NDI4OTl9.CVTe2cdY6TsuNZ-DFdmp2Z0d71Qqu4vBVG4PD3Jbtv8)

 (image/png)    


[image2024-11-5_12-2-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWU4OTcwYzJhZjRmNTIxYzdjIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDk5LCJleHAiOjE3ODI1NDI4OTl9.jnuvH6KA_3Dbk0bm1xX7LmIs2t5U5_5cvJ2i_yHH0ts)

 (image/png)    


[image2024-11-5_11-14-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWU4OTcwYzJhZjRmNTIxYzdkIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDk5LCJleHAiOjE3ODI1NDI4OTl9.2PCdour-L9MUW2IgL3yzaEvbldR_jmz-_CWDseVYJe0)

 (image/png)    


[image2024-11-4_18-22-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWU4OTcwYzJhZjRmNTIxYzdlIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDk5LCJleHAiOjE3ODI1NDI4OTl9.5B5OXk5uxdCKfCtyGHmw-v_OAlcvDVowkEmPsprZ5Ms)

 (image/png)    


[image2024-11-4_18-21-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWVhMWFkOWEzMzExZGM5YWVlIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDk5LCJleHAiOjE3ODI1NDI4OTl9.zP_goUcK_ty8DypxWZ8eQ0hTBjlx62mAlCViORcUDYE)

 (image/png)    


[image2024-11-4_18-5-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWY4OTcwYzJhZjRmNTIxYzdmIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDk5LCJleHAiOjE3ODI1NDI4OTl9.pOFABpEvSzFPgxMe3hQz4ZnEl-X_kIz3OP4Sh8AFyro)

 (image/png)    


[image2024-11-4_18-0-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWZhMWFkOWEzMzExZGM5YWVmIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDk5LCJleHAiOjE3ODI1NDI4OTl9.w3ytGROObDKjqhx3xqEenyqgEa-yLScqbYzLgXN5_LU)

 (image/png)    


[image2024-11-4_17-19-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWY4OTcwYzJhZjRmNTIxYzgwIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDk5LCJleHAiOjE3ODI1NDI4OTl9.ed41qfhbDzLgPUMibe4g6twHb6LXZ1QnqdjnMZXxrTo)

 (image/png)    


[image2024-11-4_17-14-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWZhMWFkOWEzMzExZGM5YWYwIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDk5LCJleHAiOjE3ODI1NDI4OTl9.xbgx3n9WRQOHM62AOy7YDOfS5PS5pvGhBS0SnS_EYi0)

 (image/png)    


[image2024-11-4_16-45-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWZhMWFkOWEzMzExZGM5YWYxIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDk5LCJleHAiOjE3ODI1NDI4OTl9.5fjqun6Pl5rJuC45Mxlx09lJAk79_BD6uJcqcSQ_CMk)

 (image/png)    


[image2024-11-4_16-37-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWY4OTcwYzJhZjRmNTIxYzgxIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDk5LCJleHAiOjE3ODI1NDI4OTl9.sn2IbIvMr1wZivc2JcMt30xUTVWIvrZtY81dPq5NB3E)

 (image/png)    


[image2024-11-14_14-42-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWY4OTcwYzJhZjRmNTIxYzgyIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDk5LCJleHAiOjE3ODI1NDI4OTl9.VNIYLPY5cZd338DDKb7Xx3V26bJf7AwAmlPajwQa7wU)

 (image/png)    


## Comments:

|  [](null)  ,1. 单机并行另起议题讨论，争取达成一致意见
1. 集群基于亲和性的多机并行需要更详细的客户使用场景，以客户为导向
1. 亲和节点启停，故障等场景，优化器和执行器的选择策略需要细化
,Posted by luojihong at 十一月 15, 2024 14:55|
|---|
