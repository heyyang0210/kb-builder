Created by 吕雷奇, last modified on 四月 08, 2024

SR链接：    [YDBRD-29703](https://jira.yasdb.com/browse/YDBRD-29703?src=confmacro)    -  YFS 创建/删除/扩展文件性能优化  开发中

开发设计文档链接：

YFS多节点故障开发设计：    [YDBRD-29703 YFS 创建/删除/扩展文件性能优化 详细设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147776680)  

# 1. 概述

该需求为优化需求，解决集群下创建表空间慢的问题；

# 2. 需求分析

## 2.1 功能点分析

- 该需求主要针对通用场景下创建删除表和扩展表空间文件慢的问题进行优化，不对现有功能产生影响


## 2.2 规格约束

- 不涉及


# 3. 详细测试设计

## 3.1 测试设计方法

1、主要使用场景法分析对优化设计中的流程变更引入的新的测试点和风险进行测试；

## 3.2 关联特性/依赖分析

1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|故障和启停操作并发时会涉及，在故障里一起考虑|
|KT|涉及|
|长稳|不涉及，对原有的表空间功能不影响|
|一致性|不涉及，对原有的表空间功能不影响|
|三方测试工具    
  (sqltest，sqlancer)|不涉及任务新增语法，不涉及该专项|
|安全|不涉及任务用户/权限/密码等操作，不涉及该专项|
|DFR|涉及，涉及到不同类型的故障|
|HA|YFS多节点故障不支持集群HA模式，不涉及该专项|
|压力|yfs层面不考虑压力场景，不涉及该专项|
|性能|涉及，需要考虑测试不同场景下的性能提升|
|可维护性|不涉及日志观测以及其它不明显的观测点，不涉及该专项|
|RTO|不涉及故障检测时间和故障处理时间的修改，不涉及该专项|


## 3.3 详细测试设计

从新的实现机制来考虑，主要就是涉及到了异常，先进行多个扩展extent原子操作合并后，再做下一步操作，可能在yfs故障场景下有影响。当前主要考虑创建（删除）触发多个extent操作合并过程中，kill不同的主机和备机，以及网络相关的故障。

|编号|场景描述|子场景|备注|
|---|---|---|---|
|0|yfs创建删除扩展表空间功能和oracle rac对比|扩展表空间文件场景，创建100G表空间下和相同环境条件的oracle rac做性能对比|普通磁阵、高性能磁阵|
|  
|  
|删除表空间文件场景，创建删除100G表空间下和相同环境条件的oracle rac做性能对比|普通磁阵、高性能磁阵，参数配置为立即回收|
|  
|  
|扩展表空间文件场景，创建一个较小的表空间文件，使用改表空间插入10G的数据，对比相同条件下oracle rac的性能对比|分场景,1）单实例和单机对比；可以排除集群本身插入数据时候和单机下的差距。,2）两实例下和oracle rac对比；|
|  
|  
|  
|  
|
|1|yfs停止过程中进行表空间相关业务的操作|2实例场景下，备stop的同时，在主节点上创建表空间，触发多个extent操作合并并同步备机流程|表空间类型是否需要单独考虑，新特性temp表空间和swap本地表空间？---通过yfs创建在DG上的有性能提升|
|  
|  
|2实例场景下，备start的同时，在主节点上创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|2实例场景下，备kill的同时，在主节点上创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|  
|  
|
|  
|  
|3+实例场景下，多个备同时stop的时候，在主节点上创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|3+实例场景下，多个备同时start的时候，在主节点上创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|3+实例场景下，多个备同时kill的时候，在主节点上创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|  
|  
|
|  
|  
|2实例场景下，主机stop的同时，在主节点上创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|2实例场景下，主机kill的同时，在主节点上创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|  
|  
|
|  
|  
|3+实例场景下，主机stop的同时，在主节点上创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|3+实例场景下，主机kill的同时，在主节点上创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|  
|  
|
|2|网络故障|2实例下，有主备之间网络丢包10%的同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|当前丢包场景就会心跳超时。|
|  
|  
|2实例下，有主备之间网络丢包50%的同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|2实例下，有主备之间网络丢包80%的同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|  
|  
|
|  
|  
|3实例下，有主和1个备机之间网络丢包10%的同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|3实例下，有主和2个备机之间网络丢包10%的同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|3实例下，有2个备机之间网络丢包10%的同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|  
|  
|
|  
|  
|2实例下，有主备之间网卡down同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|3实例下，有主和1个备机之间网卡down同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|3实例下，有主和2个备机之间网卡down同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|3实例下，有2个备机之间网卡down同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|  
|  
|
|  
|  
|2实例下，有主备之间网络延迟x1S的同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|心跳超时30s|
|  
|  
|2实例下，有主备之间网络延迟x2S的同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|3实例下，有主和1个备机之间网络延迟x3S同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|3实例下，有主和2个备机之间网络延迟x4S同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|
|  
|  
|3实例下，有2个备机之间网络延迟x4S同时，主节点创建表空间，触发多个extent操作合并并同步备机流程|  
|


  
    


# 4. 测试用例

  


# 5. 测试框架设计

- 不涉及框架新增，使用ha框架即可


# 6. 测试环境说明

- 正常使用多节点多主机环境即可


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：xx

工作量分析：

|工作项|时间成本|备注|
|---|---|---|
|需求调研+开发串讲|0人/天|转测前完成|
|测试设计输出及细节沟通对齐|0.5人/天|转测前完成|
|测试设计评审|0.5人/天|转测前完成|
|测试用例输出|0.1人/天|转测前完成|
|测试用例自动化|1人/天|转测前完成|
|测试执行|2人/天|pass|
|问题单跟踪回归|0人/天|pass|
|CI工程新增和沟通对齐|0.1人/天|pass|
|需求上车|xx人/天|  
|


# 8. 测试用例维护

|测试项|框架|目录|备注|
|---|---|---|---|
|故障测试|ha框架|  
|  
|
|  
|  
|  
|  
|


# 9. 上车分析

  


# 10. TBD

  


  


  


## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjg4OTcwYzJhZjRmNTIwZTBhIiwicmVmX2lkIjoiNjczOTZjYjg1OTNmOTljOWZmMjM3MjViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyOTkxLCJleHAiOjE3ODIzODkzOTF9.VqNAh1NLLalE9GuDq8YlRiI4K7EuYcQ9JlwNc7jaP0M)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjhhMWFkOWEzMzExZGM4YzdjIiwicmVmX2lkIjoiNjczOTZjYjg1OTNmOTljOWZmMjM3MjViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyOTkxLCJleHAiOjE3ODIzODkzOTF9.K5vzoAQUSIpg831gUeqGcJfnHd3D3TWD2Mkf7hsOaNQ)

 (application/msword)    
